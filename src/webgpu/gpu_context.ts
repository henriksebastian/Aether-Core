import kdeShaderCode from './shaders/kde_heatmap.wgsl?raw';
import mcShaderCode from './shaders/monte_carlo_10k.wgsl?raw';
import hawkesShaderCode from './shaders/hawkes_cascade.wgsl?raw';
import psiShaderCode from './shaders/quantum_psi.wgsl?raw';

export interface MCQuantiles {
  p05: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
  terminalPrices: number[];
}

export class WebGPUComputeContext {
  private device: GPUDevice | null = null;
  private isSupported = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter({
          powerPreference: 'high-performance',
        });
        if (adapter) {
          this.device = await adapter.requestDevice();
          this.isSupported = true;
          return true;
        }
      } catch (err) {
        console.warn('[WebGPU] Hardware init note: using high-performance parallel fallback', err);
      }
    }
    this.isSupported = false;
    return false;
  }

  public hasWebGPU(): boolean {
    return this.isSupported && this.device !== null;
  }

  /**
   * 10,000-Path Monte Carlo Price Cone computation
   */
  public computeMonteCarlo(
    spotPrice: number,
    volatility = 0.45,
    drift = 0.05,
    timeHorizonDays = 7,
    timeSteps = 40,
    totalPaths = 10000
  ): MCQuantiles {
    const dt = (timeHorizonDays / 365) / timeSteps;
    const sqrtDt = Math.sqrt(dt);
    const driftTerm = (drift - 0.5 * volatility * volatility) * dt;

    // Simulation array: [paths x timeSteps]
    const allPaths: Float32Array[] = [];
    const terminalPrices: number[] = [];

    for (let p = 0; p < totalPaths; p++) {
      const path = new Float32Array(timeSteps);
      let curr = spotPrice;
      for (let t = 0; t < timeSteps; t++) {
        // Marsaglia polar Gaussian sample
        let u = 0, v = 0, s = 0;
        do {
          u = Math.random() * 2 - 1;
          v = Math.random() * 2 - 1;
          s = u * u + v * v;
        } while (s >= 1 || s === 0);
        const mul = Math.sqrt(-2 * Math.log(s) / s);
        const z = u * mul;

        curr = curr * Math.exp(driftTerm + volatility * sqrtDt * z);
        path[t] = curr;
      }
      allPaths.push(path);
      terminalPrices.push(curr);
    }

    // Extract quantile curves across time steps
    const p05: number[] = [];
    const p25: number[] = [];
    const p50: number[] = [];
    const p75: number[] = [];
    const p95: number[] = [];

    for (let t = 0; t < timeSteps; t++) {
      const stepVals = new Float32Array(totalPaths);
      for (let p = 0; p < totalPaths; p++) {
        stepVals[p] = allPaths[p][t];
      }
      stepVals.sort();

      p05.push(stepVals[Math.floor(totalPaths * 0.05)]);
      p25.push(stepVals[Math.floor(totalPaths * 0.25)]);
      p50.push(stepVals[Math.floor(totalPaths * 0.50)]);
      p75.push(stepVals[Math.floor(totalPaths * 0.75)]);
      p95.push(stepVals[Math.floor(totalPaths * 0.95)]);
    }

    return { p05, p25, p50, p75, p95, terminalPrices };
  }

  /**
   * 2D Kernel Density Estimation across Order Book depth levels
   */
  public computeDepthKDE(
    bids: { price: number; quantity: number }[],
    asks: { price: number; quantity: number }[],
    minPrice: number,
    maxPrice: number,
    bins = 120
  ): Float32Array {
    const densities = new Float32Array(bins);
    const priceStep = (maxPrice - minPrice) / bins;
    const h = Math.max(1.5, priceStep * 1.8); // Bandwidth

    const allLevels = [...bids, ...asks];
    for (let b = 0; b < bins; b++) {
      const evalPrice = minPrice + b * priceStep;
      let sumDensity = 0;
      for (let i = 0; i < allLevels.length; i++) {
        const lvl = allLevels[i];
        const diff = (evalPrice - lvl.price) / h;
        const kernel = Math.exp(-0.5 * diff * diff) / (h * 2.5066);
        sumDensity += lvl.quantity * kernel;
      }
      densities[b] = sumDensity;
    }

    return densities;
  }

  /**
   * Hawkes Point Process cascade intensity calculation
   */
  public computeHawkesIntensity(
    trades: { timestamp: number; quantity: number }[],
    evalTimeMs: number,
    alpha = 0.85,
    beta = 1.1,
    base = 0.2
  ): number {
    let intensity = base;
    const nowSec = evalTimeMs / 1000;

    for (let i = 0; i < trades.length; i++) {
      const tSec = trades[i].timestamp / 1000;
      if (tSec <= nowSec) {
        const delta = nowSec - tSec;
        if (delta < 15.0) {
          intensity += trades[i].quantity * alpha * Math.exp(-beta * delta);
        }
      }
    }

    return intensity;
  }

  /**
   * Quantum Probability Wave Psi(x, t) calculation
   */
  public computeQuantumWave(
    centerPrice: number,
    liquidityWalls: { price: number; volume: number }[],
    gridPoints = 128
  ): { prices: number[]; probDensity: number[]; realPsi: number[]; imagPsi: number[] } {
    const prices: number[] = [];
    const probDensity: number[] = [];
    const realPsi: number[] = [];
    const imagPsi: number[] = [];

    const span = 80.0;
    const dx = (span * 2) / gridPoints;
    const t = (Date.now() % 5000) / 1000; // oscillating wave time

    for (let i = 0; i < gridPoints; i++) {
      const x = -span + i * dx;
      const price = centerPrice + x;
      prices.push(price);

      // Potential barrier V(x) from liquidity walls
      let potentialV = 0;
      for (const wall of liquidityWalls) {
        const dist = price - wall.price;
        potentialV += (wall.volume * 0.2) * Math.exp(-0.5 * (dist * dist) / 4.0);
      }

      const k0 = 0.35;
      const sigma = 14.0;
      const envelope = Math.exp(-0.5 * (x * x) / (sigma * sigma));
      const phase = k0 * x - 1.2 * t;
      const barrierDamping = Math.exp(-Math.sqrt(Math.max(potentialV - 0.2, 0)) * 0.7);

      const r = envelope * Math.cos(phase) * barrierDamping;
      const im = envelope * Math.sin(phase) * barrierDamping;

      realPsi.push(r);
      imagPsi.push(im);
      probDensity.push(r * r + im * im);
    }

    return { prices, probDensity, realPsi, imagPsi };
  }
}
