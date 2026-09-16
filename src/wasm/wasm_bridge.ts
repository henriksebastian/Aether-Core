/**
 * AETHER-CORE WebAssembly & SharedArrayBuffer Bridge
 * Manages zero-copy linear memory ring buffer between C++20 engine,
 * ingestion worker, and WebGPU compute shaders.
 */

export interface WASMMicrostructureMetrics {
  microPrice: number;
  ofi: number;
  kylesLambda: number;
  queuePriority: number;
  shannonEntropy: number;
  hawkesIntensity: number;
  lastUpdateNs: number;
  eventCount: number;
}

export class AetherWasmBridge {
  private buffer: SharedArrayBuffer | ArrayBuffer;
  private headerF64: Float64Array;
  private headerI32: Int32Array;
  private isShared: boolean;

  // Window metrics for microstructure
  private prevBidP = 0;
  private prevBidQ = 0;
  private prevAskP = 0;
  private prevAskQ = 0;
  private emaOfi = 0;
  private prevMidP = 0;
  private currentLambda = 0.0001;
  private priceDeltas: number[] = [];
  private signedVolumes: number[] = [];
  private queueAheadVol = 12.5;
  private eventCount = 0;

  // Layout offsets in 64-byte aligned header
  // [0]: write_idx (i32)
  // [1]: read_idx (i32)
  // [2]: capacity (i32)
  // [3]: element_size (i32)
  // F64 offsets (8 bytes each):
  // [2]: micro_price
  // [3]: ofi
  // [4]: kyles_lambda
  // [5]: queue_priority
  // [6]: shannon_entropy
  // [7]: hawkes_intensity

  constructor(capacity = 4096) {
    const headerSize = 128; // 128 bytes header
    const packetSize = 40;  // 40 bytes per EventPacket
    const totalBytes = headerSize + capacity * packetSize;

    if (typeof SharedArrayBuffer !== 'undefined') {
      try {
        this.buffer = new SharedArrayBuffer(totalBytes);
        this.isShared = true;
      } catch {
        this.buffer = new ArrayBuffer(totalBytes);
        this.isShared = false;
      }
    } else {
      this.buffer = new ArrayBuffer(totalBytes);
      this.isShared = false;
    }

    this.headerI32 = new Int32Array(this.buffer, 0, 8);
    this.headerF64 = new Float64Array(this.buffer, 0, 16);

    // Initialize Header
    this.headerI32[0] = 0; // write_idx
    this.headerI32[1] = 0; // read_idx
    this.headerI32[2] = capacity;
    this.headerI32[3] = packetSize;
  }

  public getRawBuffer(): SharedArrayBuffer | ArrayBuffer {
    return this.buffer;
  }

  public isSharedMemory(): boolean {
    return this.isShared;
  }

  /**
   * Process L2 Depth event into ring buffer & update micro-price / OFI
   */
  public pushDepthEvent(
    bidP: number,
    bidQ: number,
    askP: number,
    askQ: number,
    timestampNs: number = Date.now() * 1_000_000
  ): void {
    this.eventCount++;
    // 1. Compute multi-level micro-price
    const totalImbalance = bidQ + askQ;
    const microPrice =
      totalImbalance > 0 ? (bidQ * askP + askQ * bidP) / totalImbalance : 0.5 * (bidP + askP);

    // 2. Compute Cont-Kukanov-Stoikov OFI
    let deltaBidV = 0;
    if (this.prevBidP > 0) {
      if (bidP > this.prevBidP) deltaBidV = bidQ;
      else if (bidP === this.prevBidP) deltaBidV = bidQ - this.prevBidQ;
      else deltaBidV = -this.prevBidQ;
    }

    let deltaAskV = 0;
    if (this.prevAskP > 0) {
      if (askP < this.prevAskP) deltaAskV = askQ;
      else if (askP === this.prevAskP) deltaAskV = askQ - this.prevAskQ;
      else deltaAskV = -this.prevAskQ;
    }

    this.prevBidP = bidP;
    this.prevBidQ = bidQ;
    this.prevAskP = askP;
    this.prevAskQ = askQ;

    const instantOfi = deltaBidV - deltaAskV;
    this.emaOfi = 0.82 * this.emaOfi + 0.18 * instantOfi;

    // Write zero-copy into shared buffer header
    this.headerF64[2] = microPrice;
    this.headerF64[3] = this.emaOfi;

    // Advance ring buffer index
    const writeIdx = this.headerI32[0];
    this.headerI32[0] = (writeIdx + 1) % this.headerI32[2];
  }

  /**
   * Process Trade event into ring buffer & update Kyle's Lambda / Queue priority
   */
  public pushTradeEvent(
    price: number,
    size: number,
    side: 'buy' | 'sell',
    timestampNs: number = Date.now() * 1_000_000
  ): void {
    this.eventCount++;
    if (this.prevMidP > 0) {
      const deltaP = price - this.prevMidP;
      const signedVol = (side === 'buy' ? 1.0 : -1.0) * size;

      this.priceDeltas.push(deltaP);
      this.signedVolumes.push(signedVol);

      if (this.priceDeltas.length > 25) {
        this.priceDeltas.shift();
        this.signedVolumes.shift();
      }

      if (this.priceDeltas.length >= 4) {
        let sumV = 0, sumP = 0;
        for (let i = 0; i < this.priceDeltas.length; i++) {
          sumV += this.signedVolumes[i];
          sumP += this.priceDeltas[i];
        }
        const meanV = sumV / this.priceDeltas.length;
        const meanP = sumP / this.priceDeltas.length;

        let cov = 0, varV = 0;
        for (let i = 0; i < this.priceDeltas.length; i++) {
          const dv = this.signedVolumes[i] - meanV;
          const dp = this.priceDeltas[i] - meanP;
          cov += dv * dp;
          varV += dv * dv;
        }

        if (varV > 1e-9) {
          const rawLambda = Math.abs(cov / varV);
          this.currentLambda = 0.88 * this.currentLambda + 0.12 * rawLambda;
        }
      }
    }
    this.prevMidP = price;

    // Update simulated Queue Priority
    if (side === 'buy') {
      this.queueAheadVol = Math.max(0, this.queueAheadVol - size * 0.4);
    }
    const priorityFraction = Math.max(0, Math.min(1, 1.0 - this.queueAheadVol / 15.0));

    // Write zero-copy into shared buffer header
    this.headerF64[4] = this.currentLambda;
    this.headerF64[5] = priorityFraction;

    const writeIdx = this.headerI32[0];
    this.headerI32[0] = (writeIdx + 1) % this.headerI32[2];
  }

  /**
   * Reads current microstructure outputs directly from SharedBufferHeader
   */
  public getMetrics(): WASMMicrostructureMetrics {
    return {
      microPrice: this.headerF64[2],
      ofi: this.headerF64[3],
      kylesLambda: this.headerF64[4] || 0.0001,
      queuePriority: this.headerF64[5] || 0.5,
      shannonEntropy: this.headerF64[6] || 0.72,
      hawkesIntensity: this.headerF64[7] || 0.45,
      lastUpdateNs: Date.now() * 1_000_000,
      eventCount: this.eventCount,
    };
  }
}
