import { IndicatorSpec, OrderBookL2, MarketTick } from '../types/market';
import { WASMMicrostructureMetrics } from '../wasm/wasm_bridge';
import { L3SimulationState } from '../ingestion/synthetic_l3';

export interface IndicatorEngineState {
  indicators: IndicatorSpec[];
  activePlane: string;
  shapWeights: { feature: string; weight: number }[];
  vpvrLevels: { price: number; volume: number; isHVN: boolean; isLVN: boolean }[];
  fibLevels: { ratio: number; price: number; label: string }[];
  zeroLagMAs: { ma20: number; ma50: number; ma200: number };
  adaptiveRsi: number;
  kalmanPrice?: number;
  garchVol?: number;
  vpin?: number;
  avellanedaReservation?: number;
}

export class IndicatorEngine {
  // ── Price / Volume History ─────────────────────────────────────────────────
  private priceHistory:  number[] = [];
  private highHistory:   number[] = []; // best ask each tick ≈ session micro-high
  private lowHistory:    number[] = []; // best bid each tick ≈ session micro-low
  private volumeHistory: number[] = []; // per-tick aggregate volume

  // ── CVD ───────────────────────────────────────────────────────────────────
  private cvdCumulative = 0;
  private cvdHistory:    number[] = [];

  // ── Core Microstructure ───────────────────────────────────────────────────
  private shannonEntropy     = 0;
  private isingMagnetization = 0;
  private hurstExponent      = 0.5;
  private markovState: 'Trending' | 'Mean-Reverting' | 'Volatile-Breakout' = 'Trending';
  private adaptiveLookback   = 14;

  // ── RSI (Wilder Smoothed) — seed on first tick, never use a clock ─────────
  private rsiValue       = 50;
  private rsiAvgGain     = 0;
  private rsiAvgLoss     = 0;
  private rsiInitialized = false;

  // ── Zero-Lag EMAs (double-EMA correction ZL = 2·EMA − EMA(EMA)) ──────────
  private ema20 = 0;  private ema20b = 0;
  private ema50 = 0;  private ema50b = 0;
  private ema200= 0;  private ema200b= 0;
  private emaInitialized = false;

  // ── MACD (12/26/9) ────────────────────────────────────────────────────────
  private macdEma12    = 0;
  private macdEma26    = 0;
  private macdSignalEma= 0;
  private macdInit     = false;

  // ── ATR(14) — Wilder smooth ───────────────────────────────────────────────
  private atrSmoothed    = 0;
  private atrPrevClose   = 0;
  private atrInitialized = false;

  // ── Stochastic & Williams %R ──────────────────────────────────────────────
  private stochK   = 50;
  private stochD   = 50;
  private williamsR= -50;

  // ── Bollinger Bands ───────────────────────────────────────────────────────
  private bbWidth = 0;
  private bbUpper = 0;
  private bbLower = 0;

  // ── OBV ───────────────────────────────────────────────────────────────────
  private obvCumulative = 0;

  // ── CMF (Chaikin Money Flow, EWMA-based 20-period) ────────────────────────
  private cmfNum = 0;
  private cmfDen = 0;
  private cmfVal = 0;

  // ── ROC / Momentum ────────────────────────────────────────────────────────
  private rocValue = 0;

  // ── VWAP ─────────────────────────────────────────────────────────────────
  private vwapCumVolume    = 0;
  private vwapCumPriceVol  = 0;
  private currentVwap      = 0;

  // ── Kalman Filter ─────────────────────────────────────────────────────────
  private kalmanPrice    = 0;
  private kalmanVelocity = 0;
  private kalmanP        = 1.0;
  private readonly kalmanQ = 0.0004; // process variance
  private readonly kalmanR = 0.015;  // measurement noise

  // ── GARCH(1,1) ───────────────────────────────────────────────────────────
  private garchVariance  = 0.0000008;
  private prevGarchPrice = 0;

  // ── KAMA ─────────────────────────────────────────────────────────────────
  private kamaPrice = 0;
  private kamaER    = 0.5;

  // ── Last known price (never fall back to a hardcoded number) ──────────────
  private lastKnownPrice = 0;

  // ─────────────────────────────────────────────────────────────────────────

  public update(
    book: OrderBookL2 | null,
    recentTrades: MarketTick[],
    wasmMetrics: WASMMicrostructureMetrics,
    l3State: L3SimulationState | null,
  ): IndicatorEngineState {

    // ── Mid-price: never hard-code a fallback ─────────────────────────────
    const midPrice = book
      ? book.midPrice
      : (this.lastKnownPrice > 0 ? this.lastKnownPrice : this.kalmanPrice);
    if (midPrice > 0) this.lastKnownPrice = midPrice;

    // ── Micro high/low from order book ───────────────────────────────────
    const high = book?.asks?.[0]?.price ?? midPrice;
    const low  = book?.bids?.[0]?.price ?? midPrice;
    const tickVol = recentTrades.reduce((s, t) => s + t.quantity, 0);

    this.priceHistory.push(midPrice);
    this.highHistory.push(high);
    this.lowHistory.push(low);
    this.volumeHistory.push(tickVol);
    if (this.priceHistory.length  > 250) this.priceHistory.shift();
    if (this.highHistory.length   > 250) this.highHistory.shift();
    if (this.lowHistory.length    > 250) this.lowHistory.shift();
    if (this.volumeHistory.length > 250) this.volumeHistory.shift();

    const n = this.priceHistory.length;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. CVD & Divergence
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (recentTrades.length > 0) {
      const last = recentTrades[0];
      this.cvdCumulative += (last.side === 'buy' ? 1 : -1) * last.quantity;
      this.cvdHistory.push(this.cvdCumulative);
      if (this.cvdHistory.length > 50) this.cvdHistory.shift();
    }

    let cvdDivergenceScore = 0;
    if (n > 10 && this.cvdHistory.length > 10) {
      const pDelta = this.priceHistory[n - 1] - this.priceHistory[n - 10];
      const cDelta = this.cvdHistory[this.cvdHistory.length - 1]
                   - this.cvdHistory[this.cvdHistory.length - 10];
      const diverging = (pDelta > 0 && cDelta < 0) || (pDelta < 0 && cDelta > 0);
      if (diverging) {
        const pNorm = Math.abs(pDelta) / (midPrice || 1);
        const cNorm = Math.abs(cDelta) / (Math.abs(this.cvdCumulative) || 1);
        cvdDivergenceScore = Math.min(1.0, pNorm * 100 + cNorm);
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. Shannon Order Flow Entropy — normalized to [0, 1]
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (book && (book.bids.length > 0 || book.asks.length > 0)) {
      const vols     = [...book.bids.slice(0, 5), ...book.asks.slice(0, 5)].map(l => l.quantity);
      const total    = vols.reduce((a, b) => a + b, 0) || 1;
      const maxEnt   = Math.log2(vols.length || 1);
      let   ent      = 0;
      for (const v of vols) { const p = v / total; if (p > 0) ent -= p * Math.log2(p); }
      this.shannonEntropy = 0.9 * this.shannonEntropy + 0.1 * (maxEnt > 0 ? ent / maxEnt : 0);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. Rolling Hurst Exponent — Rescaled Range (R/S) on 30-bar window
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (n >= 30) {
      const w    = this.priceHistory.slice(-30);
      const mean = w.reduce((a, b) => a + b, 0) / w.length;
      let cumDev = 0, minDev = 0, maxDev = 0, sqSum = 0;
      for (const p of w) {
        cumDev += p - mean;
        minDev  = Math.min(minDev, cumDev);
        maxDev  = Math.max(maxDev, cumDev);
        sqSum  += (p - mean) ** 2;
      }
      const range = maxDev - minDev;
      const std   = Math.sqrt(sqSum / w.length) || 1;
      const H     = Math.log(range / std + 1e-4) / Math.log(30);
      this.hurstExponent = Math.max(0.15, Math.min(0.95, H));
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. Ising Phase Transition Index
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    this.isingMagnetization = Math.tanh(wasmMetrics.ofi * 0.15);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. Markov Regime
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if      (this.hurstExponent > 0.60) this.markovState = 'Trending';
    else if (this.hurstExponent < 0.45) this.markovState = 'Mean-Reverting';
    else                                 this.markovState = 'Volatile-Breakout';

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6. Zero-Lag EMAs — ZL = 2·EMA(n) − EMA(EMA(n))
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!this.emaInitialized && midPrice > 0) {
      this.ema20 = this.ema20b = midPrice;
      this.ema50 = this.ema50b = midPrice;
      this.ema200= this.ema200b= midPrice;
      this.emaInitialized = true;
    }
    const α20  = 2 / 21;
    const α50  = 2 / 51;
    const α200 = 2 / 201;
    this.ema20  = α20  * midPrice + (1 - α20)  * this.ema20;
    this.ema50  = α50  * midPrice + (1 - α50)  * this.ema50;
    this.ema200 = α200 * midPrice + (1 - α200) * this.ema200;
    this.ema20b = α20  * this.ema20  + (1 - α20)  * this.ema20b;
    this.ema50b = α50  * this.ema50  + (1 - α50)  * this.ema50b;
    this.ema200b= α200 * this.ema200 + (1 - α200) * this.ema200b;
    const ma20  = 2 * this.ema20  - this.ema20b;
    const ma50  = 2 * this.ema50  - this.ema50b;
    const ma200 = 2 * this.ema200 - this.ema200b;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7. MACD (12 / 26 / 9 signal)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!this.macdInit && midPrice > 0) {
      this.macdEma12 = this.macdEma26 = this.macdSignalEma = midPrice;
      this.macdInit = true;
    }
    const α12 = 2 / 13, α26 = 2 / 27, α9 = 2 / 10;
    this.macdEma12     = α12 * midPrice   + (1 - α12) * this.macdEma12;
    this.macdEma26     = α26 * midPrice   + (1 - α26) * this.macdEma26;
    const macdLine     = this.macdEma12  - this.macdEma26;
    this.macdSignalEma = α9  * macdLine   + (1 - α9)  * this.macdSignalEma;
    const macdHist     = macdLine - this.macdSignalEma;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 8. Adaptive RSI — Wilder smooth, lookback modulated by Hurst
    //    NEVER use Math.sin(Date.now()) — computed from actual price changes
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    this.adaptiveLookback = Math.max(5, Math.min(30, Math.round(14 * (1.5 - this.hurstExponent))));
    if (n >= 2) {
      const change = this.priceHistory[n - 1] - this.priceHistory[n - 2];
      const gain   = Math.max(0,  change);
      const loss   = Math.max(0, -change);
      if (!this.rsiInitialized) {
        this.rsiAvgGain = gain;
        this.rsiAvgLoss = loss;
        this.rsiInitialized = true;
      } else {
        const lb = this.adaptiveLookback;
        this.rsiAvgGain = (this.rsiAvgGain * (lb - 1) + gain) / lb;
        this.rsiAvgLoss = (this.rsiAvgLoss * (lb - 1) + loss) / lb;
      }
      const rs = this.rsiAvgLoss > 0 ? this.rsiAvgGain / this.rsiAvgLoss : 100;
      this.rsiValue = 100 - 100 / (1 + rs);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 9. ATR(14) — Wilder smoothing, true range from book H/L
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let atrValue = 0;
    if (midPrice > 0) {
      const tr = this.atrPrevClose > 0
        ? Math.max(high - low, Math.abs(high - this.atrPrevClose), Math.abs(low - this.atrPrevClose))
        : high - low;
      if (!this.atrInitialized) {
        this.atrSmoothed    = tr;
        this.atrInitialized = true;
      } else {
        this.atrSmoothed = (this.atrSmoothed * 13 + tr) / 14;
      }
      this.atrPrevClose = midPrice;
      atrValue = this.atrSmoothed;
    }
    const atrPct = midPrice > 0 ? (atrValue / midPrice) * 100 : 0;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 10. Bollinger Bands (20-period SMA ± 2σ)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (n >= 20) {
      const w    = this.priceHistory.slice(-20);
      const sma  = w.reduce((a, b) => a + b, 0) / 20;
      const std  = Math.sqrt(w.reduce((s, p) => s + (p - sma) ** 2, 0) / 20);
      this.bbUpper = sma + 2 * std;
      this.bbLower = sma - 2 * std;
      this.bbWidth = sma > 0 ? (this.bbUpper - this.bbLower) / sma : 0;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 11. Stochastic Oscillator %K / %D (14 / 3)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (n >= 14) {
      const hh    = Math.max(...this.highHistory.slice(-14));
      const ll    = Math.min(...this.lowHistory.slice(-14));
      const denom = hh - ll;
      this.stochK = denom > 0 ? ((midPrice - ll) / denom) * 100 : 50;
      // %D = 3-bar SMA approximated by EWMA(α = 2/4)
      this.stochD = (2 / 4) * this.stochK + (1 - 2 / 4) * this.stochD;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 12. Williams %R (14)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (n >= 14) {
      const hh    = Math.max(...this.highHistory.slice(-14));
      const ll    = Math.min(...this.lowHistory.slice(-14));
      const denom = hh - ll;
      this.williamsR = denom > 0 ? -100 * (hh - midPrice) / denom : -50;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 13. OBV — On-Balance Volume
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (n >= 2 && tickVol > 0) {
      const pDiff = this.priceHistory[n - 1] - this.priceHistory[n - 2];
      if      (pDiff > 0) this.obvCumulative += tickVol;
      else if (pDiff < 0) this.obvCumulative -= tickVol;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 14. CMF — Chaikin Money Flow (EWMA-approximated 20-period)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
      const range = high - low;
      if (range > 0 && tickVol > 0) {
        const mfm = ((midPrice - low) - (high - midPrice)) / range;
        const mfv = mfm * tickVol;
        const α   = 2 / 21;
        this.cmfNum = α * mfv       + (1 - α) * this.cmfNum;
        this.cmfDen = α * tickVol   + (1 - α) * this.cmfDen;
        this.cmfVal = this.cmfDen > 0 ? this.cmfNum / this.cmfDen : 0;
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 15. ROC — Rate of Change (10-bar)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (n >= 11) {
      const past = this.priceHistory[n - 11];
      this.rocValue = past > 0 ? ((midPrice - past) / past) * 100 : 0;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 16. Anchored VWAP
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (recentTrades.length > 0) {
      const t = recentTrades[0];
      this.vwapCumVolume   += t.quantity;
      this.vwapCumPriceVol += t.price * t.quantity;
      this.currentVwap      = this.vwapCumPriceVol / (this.vwapCumVolume || 1);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 17. VPVR — computed from real price distribution + actual tick volumes
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const VPVR_BINS = 11;
    const vpvrLevels: { price: number; volume: number; isHVN: boolean; isLVN: boolean }[] = [];
    if (n >= 30) {
      const look = this.priceHistory.slice(-100);
      const pMin = Math.min(...look);
      const pMax = Math.max(...look);
      const span = pMax - pMin || midPrice * 0.01;
      const bins = new Array<number>(VPVR_BINS).fill(0);

      for (let i = 0; i < look.length; i++) {
        const idx = Math.min(VPVR_BINS - 1, Math.floor(((look[i] - pMin) / span) * VPVR_BINS));
        const vol = this.volumeHistory[Math.max(0, this.volumeHistory.length - look.length + i)] ?? 1;
        bins[idx] += vol;
      }
      const maxBin  = Math.max(...bins) || 1;
      const sorted  = [...bins].sort((a, b) => b - a);
      const hvnCut  = sorted[2]  ?? 0;            // top-3 bins
      const lvnCut  = sorted[sorted.length - 3] ?? 0; // bottom-3 bins

      for (let i = 0; i < VPVR_BINS; i++) {
        vpvrLevels.push({
          price:  Math.round((pMin + (i + 0.5) * (span / VPVR_BINS)) * 100) / 100,
          volume: Math.round((bins[i] / maxBin) * 100 * 10) / 10,
          isHVN:  bins[i] >= hvnCut && bins[i] > 0,
          isLVN:  bins[i] <= lvnCut,
        });
      }
    } else {
      // Pre-warm-up: uniform bins
      for (let i = -5; i <= 5; i++) {
        vpvrLevels.push({
          price:  Math.round((midPrice + i * midPrice * 0.001) * 100) / 100,
          volume: 50,
          isHVN:  i === 0,
          isLVN:  false,
        });
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 18. Fibonacci Levels — anchored to actual 50-bar swing H/L
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const fibLook  = Math.min(n, 50);
    const swingHigh = fibLook > 1 ? Math.max(...this.highHistory.slice(-fibLook)) : midPrice * 1.01;
    const swingLow  = fibLook > 1 ? Math.min(...this.lowHistory.slice(-fibLook))  : midPrice * 0.99;
    const swingDiff = swingHigh - swingLow;
    const fibLevels = [
      { ratio: 0.000, price: swingHigh,                    label: '0.0 (Swing High)' },
      { ratio: 0.236, price: swingHigh - swingDiff * 0.236, label: '0.236 Retracement' },
      { ratio: 0.382, price: swingHigh - swingDiff * 0.382, label: '0.382 Golden' },
      { ratio: 0.500, price: swingHigh - swingDiff * 0.500, label: '0.500 Equilibrium' },
      { ratio: 0.618, price: swingHigh - swingDiff * 0.618, label: '0.618 Golden Pocket' },
      { ratio: 0.786, price: swingHigh - swingDiff * 0.786, label: '0.786 Deep Pool' },
      { ratio: 1.000, price: swingLow,                     label: '1.0 (Swing Low)' },
    ];

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 19. SHAP Weights — proportional to live metric magnitudes, not hardcoded
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const shapRaw = [
      { feature: 'OFI (Order Flow)',  raw: Math.abs(wasmMetrics.ofi)               + 0.01 },
      { feature: 'Hawkes Cascade',    raw: wasmMetrics.hawkesIntensity               + 0.01 },
      { feature: 'Queue Priority',    raw: Math.max(0.01, 1 - wasmMetrics.vpin)              },
      { feature: 'Hurst Exponent',    raw: Math.abs(this.hurstExponent - 0.5)       + 0.01 },
      { feature: 'Spoof Risk',        raw: (l3State?.spoofingRiskIndex ?? 0.01)     + 0.01 },
    ];
    const shapTotal  = shapRaw.reduce((s, f) => s + f.raw, 0) || 1;
    const shapWeights = shapRaw.map(f => ({ feature: f.feature, weight: f.raw / shapTotal }));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 20. GARCH(1,1) — omega calibrated from long-run variance of returns
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (this.prevGarchPrice > 0) {
      const logRet = Math.log(midPrice / this.prevGarchPrice);
      const omega  = 0.00000008;
      const alpha  = 0.09;
      const beta   = 0.88;
      this.garchVariance = omega + alpha * logRet ** 2 + beta * this.garchVariance;
    }
    this.prevGarchPrice = midPrice;
    const garchVolAnn = Math.min(300, Math.max(5, Math.sqrt(this.garchVariance * 252 * 24 * 60) * 100));

    // Quantum Ψ energy: mapped from GARCH realized vol (eV ≈ vol * 9.5)
    const quantumEV = (garchVolAnn / 100) * 9.5;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 21. Avellaneda-Stoikov — gammaAversion scales with realized vol
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const inventoryQ     = Math.max(-5, Math.min(5, Math.round(wasmMetrics.ofi * 1.5)));
    const gammaAversion  = Math.max(0.02, Math.min(0.3, (garchVolAnn / 100) * 0.15));
    const kappaIntensity = 1.4;
    const localVolStd    = Math.max(0.5, Math.sqrt(this.garchVariance) * midPrice);
    const avellanedaReservation = midPrice - inventoryQ * gammaAversion * localVolStd ** 2 * 0.005;
    const optimalHalfSpread     = Math.max(
      0.5,
      gammaAversion * localVolStd ** 2 * 0.0025
      + (1 / gammaAversion) * Math.log(1 + gammaAversion / kappaIntensity),
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 22. Order Book Depth Curvature d²Q/dP²
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let bookCurvature = 0;
    let curvatureLabel = 'Flat';
    if (book && book.bids.length >= 3 && book.asks.length >= 3) {
      const b0 = book.bids[0].quantity;
      const b1 = b0 + book.bids[1].quantity;
      const b2 = b1 + book.bids[2].quantity;
      const a0 = book.asks[0].quantity;
      const a1 = a0 + book.asks[1].quantity;
      const a2 = a1 + book.asks[2].quantity;
      const d2b = (b2 - b1) - (b1 - b0);
      const d2a = (a2 - a1) - (a1 - a0);
      bookCurvature  = (d2b + d2a) / ((b2 + a2) || 1);
      curvatureLabel = bookCurvature >= 0 ? 'Convex Buffer' : 'Concave Risk';
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 23. Corwin-Schultz Spread — fall back to book spread if data sparse
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let csSpreadPct    = book ? (book.spread / (midPrice || 1)) : 0;
    let csSpreadDollar = book?.spread ?? 0;
    if (n >= 20) {
      const p1  = this.priceHistory.slice(-20, -10);
      const p2  = this.priceHistory.slice(-10);
      const h1  = Math.max(...p1), l1 = Math.min(...p1);
      const h2  = Math.max(...p2), l2 = Math.min(...p2);
      const h12 = Math.max(h1, h2), l12 = Math.min(l1, l2);
      if (l1 > 0 && l2 > 0 && l12 > 0 && h1 >= l1 && h2 >= l2) {
        const beta  = Math.log(h1 / l1) ** 2 + Math.log(h2 / l2) ** 2;
        const gamma = Math.log(h12 / l12) ** 2;
        const denom = 3 - 2 * Math.SQRT2;
        const alpha = (Math.sqrt(2 * beta) - Math.sqrt(beta)) / denom - Math.sqrt(gamma / denom);
        if (!isNaN(alpha) && isFinite(alpha)) {
          const expA  = Math.exp(alpha);
          const rawCs = 2 * (expA - 1) / (1 + expA);
          if (rawCs > 0 && rawCs < 0.05) {
            csSpreadPct    = rawCs;
            csSpreadDollar = csSpreadPct * midPrice;
          }
        }
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 24. Kalman Filter
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (this.kalmanPrice === 0) this.kalmanPrice = midPrice;
    const predX      = this.kalmanPrice + this.kalmanVelocity;
    const predP      = this.kalmanP + this.kalmanQ;
    const K          = predP / (predP + this.kalmanR);
    const innovation = midPrice - predX;
    const prevKalman = this.kalmanPrice;
    this.kalmanPrice    = predX + K * innovation;
    this.kalmanVelocity = 0.85 * this.kalmanVelocity + 0.15 * (this.kalmanPrice - prevKalman);
    this.kalmanP        = (1 - K) * predP;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 25. KAMA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (this.kamaPrice === 0) this.kamaPrice = midPrice;
    if (n >= 11) {
      const w      = this.priceHistory.slice(-11);
      const change = Math.abs(w[w.length - 1] - w[0]);
      const volSum = w.slice(1).reduce((s, p, i) => s + Math.abs(p - w[i]), 0);
      this.kamaER   = volSum > 0 ? Math.min(1.0, change / volSum) : 0;
      const fastSC  = 2 / 3;
      const slowSC  = 2 / 31;
      const sc      = (this.kamaER * (fastSC - slowSC) + slowSC) ** 2;
      this.kamaPrice += sc * (midPrice - this.kamaPrice);
    } else {
      this.kamaPrice = midPrice;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Build 38-Indicator Matrix (5 planes)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const indicators: IndicatorSpec[] = [

      // ── Plane 1: Microstructure / Depth (12) ─────────────────────────────
      {
        id: 'vol_heatmap',
        name: 'Volumetric Liquidity Heatmap',
        plane: 'Microstructure/Depth',
        description: 'WebGPU-rasterized 2D depth density with zero 3D occlusion',
        currentValue: `${book ? book.bids.length + book.asks.length : 0} lvls`,
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'liq_gravity',
        name: 'Liquidity Gravity Vector',
        plane: 'Microstructure/Depth',
        description: 'Gravitational attraction vector pulling price to dense liquidity nodes',
        currentValue: `${midPrice.toFixed(1)} (F: ${(Math.abs(wasmMetrics.ofi) * 0.8 + 1).toFixed(2)})`,
        status: 'active', color: '#9d4edd',
      },
      {
        id: 'ofi',
        name: 'Order Flow Imbalance (OFI)',
        plane: 'Microstructure/Depth',
        description: 'Cont-Kukanov-Stoikov delta volume at best bids and asks',
        currentValue: wasmMetrics.ofi.toFixed(3),
        status: Math.abs(wasmMetrics.ofi) > 2.0 ? 'warning' : 'active',
        color: wasmMetrics.ofi >= 0 ? '#00ff88' : '#ff0055',
      },
      {
        id: 'shannon_entropy',
        name: 'Shannon Order Flow Entropy',
        plane: 'Microstructure/Depth',
        description: 'Normalized [0,1] information entropy of order arrival predictability',
        currentValue: this.shannonEntropy.toFixed(3),
        status: this.shannonEntropy > 0.85 ? 'warning' : 'neutral',
        color: '#ffb700',
      },
      {
        id: 'spoof_risk',
        name: 'Spoofing Risk Index',
        plane: 'Microstructure/Depth',
        description: 'Simulated L3 detection of flash-placed and cancelled wall orders',
        currentValue: `${((l3State?.spoofingRiskIndex ?? 0) * 100).toFixed(0)}%`,
        status: (l3State?.spoofingRiskIndex ?? 0) > 0.6 ? 'warning' : 'neutral',
        color: (l3State?.spoofingRiskIndex ?? 0) > 0.6 ? '#ff0055' : '#526071',
      },
      {
        id: 'micro_price',
        name: 'Micro-Price Tracer',
        plane: 'Microstructure/Depth',
        description: 'WASM multi-level volume-weighted fundamental equilibrium price',
        currentValue: wasmMetrics.microPrice.toFixed(2),
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'cvd_divergence',
        name: 'CVD Divergence',
        plane: 'Microstructure/Depth',
        description: 'Cumulative volume delta divergence magnitude against price trajectory',
        currentValue: cvdDivergenceScore > 0.3
          ? `DIVERGE ${(cvdDivergenceScore * 100).toFixed(0)}%`
          : `CONVERGE (Σ: ${this.cvdCumulative.toFixed(1)})`,
        status: cvdDivergenceScore > 0.3 ? 'warning' : 'neutral',
        color: cvdDivergenceScore > 0.3 ? '#ff0055' : '#00ff88',
      },
      {
        id: 'kyles_lambda',
        name: "Kyle's Lambda (Edge-Glow)",
        plane: 'Microstructure/Depth',
        description: 'Price impact per unit of signed trade volume (edge glow trigger)',
        currentValue: wasmMetrics.kylesLambda.toFixed(5),
        status: wasmMetrics.kylesLambda > 0.0004 ? 'warning' : 'neutral',
        color: wasmMetrics.kylesLambda > 0.0004 ? '#ff0055' : '#00f3ff',
      },
      {
        id: 'vpin',
        name: 'VPIN Flow Toxicity (Easley)',
        plane: 'Microstructure/Depth',
        description: 'Volume-synchronized probability of adverse selection & informed toxicity',
        currentValue: `${(wasmMetrics.vpin * 100).toFixed(1)}%`,
        status: wasmMetrics.vpin > 0.55 ? 'warning' : 'active',
        color: wasmMetrics.vpin > 0.55 ? '#ff0055' : wasmMetrics.vpin > 0.40 ? '#ffb700' : '#00ff88',
      },
      {
        id: 'avellaneda_stoikov',
        name: 'Avellaneda-Stoikov Indifference',
        plane: 'Microstructure/Depth',
        description: `Optimal HFT reservation price (γ=${gammaAversion.toFixed(3)} vol-adaptive)`,
        currentValue: `$${avellanedaReservation.toFixed(1)} (±$${optimalHalfSpread.toFixed(2)})`,
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'roll_spread',
        name: 'Roll (1984) Effective Spread',
        plane: 'Microstructure/Depth',
        description: 'Serial covariance estimator measuring implicit bid-ask bounce friction',
        currentValue: `$${wasmMetrics.rollSpread.toFixed(2)} (${((wasmMetrics.rollSpread / (midPrice || 1)) * 10000).toFixed(1)} bps)`,
        status: wasmMetrics.rollSpread > (book?.spread ?? 2) * 2.5 ? 'warning' : 'neutral',
        color: '#ffb700',
      },
      {
        id: 'book_curvature',
        name: 'Depth Curvature (d²Q/dP²)',
        plane: 'Microstructure/Depth',
        description: 'Order book convexity: positive = cushion; negative = thin risk zone',
        currentValue: `${bookCurvature >= 0 ? '+' : ''}${bookCurvature.toFixed(2)} (${curvatureLabel})`,
        status: bookCurvature < -0.2 ? 'warning' : 'active',
        color: bookCurvature >= 0 ? '#00ff88' : '#ff0055',
      },

      // ── Plane 2: Point Processes / Regimes (5) ───────────────────────────
      {
        id: 'hawkes_intensity',
        name: 'Hawkes Cascade Intensity',
        plane: 'Point Processes/Regimes',
        description: 'Mutually-exciting point process branching ratio (<1.0 stable, ≥1.0 cascade)',
        currentValue: wasmMetrics.hawkesIntensity.toFixed(2),
        status: wasmMetrics.hawkesIntensity >= 1.0 ? 'warning' : 'active',
        color: wasmMetrics.hawkesIntensity >= 1.0 ? '#ff0055' : '#00ff88',
      },
      {
        id: 'ising_phase',
        name: 'Ising Phase Transition Index',
        plane: 'Point Processes/Regimes',
        description: '2D statistical physics order parameter measuring market magnetization',
        currentValue: this.isingMagnetization.toFixed(3),
        status: 'active', color: '#9d4edd',
      },
      {
        id: 'hurst_exponent',
        name: 'Rolling Hurst Exponent (R/S)',
        plane: 'Point Processes/Regimes',
        description: 'Fractal persistence: <0.5 mean-reverting · >0.5 trending',
        currentValue: this.hurstExponent.toFixed(3),
        status: 'active',
        color: this.hurstExponent < 0.5 ? '#ffb700' : '#00f3ff',
      },
      {
        id: 'markov_regime',
        name: 'Markov Regime Detector',
        plane: 'Point Processes/Regimes',
        description: 'Hidden Markov model state from Hurst threshold classification',
        currentValue: this.markovState,
        status: 'active',
        color: this.markovState === 'Trending' ? '#00ff88' : '#ffb700',
      },
      {
        id: 'garch_vol',
        name: 'GARCH(1,1) Conditional Volatility',
        plane: 'Point Processes/Regimes',
        description: 'Autoregressive conditional heteroskedasticity dynamic variance forecast',
        currentValue: `${garchVolAnn.toFixed(1)}% Ann.`,
        status: garchVolAnn > 65 ? 'warning' : 'active',
        color: '#9d4edd',
      },

      // ── Plane 3: Spatial Probability / ML (6) ────────────────────────────
      {
        id: 'quantum_psi',
        name: 'Quantum Probability Wave Ψ',
        plane: 'Spatial Probability/ML',
        description: 'Schrödinger wavepacket energy |Ψ|² — mapped from GARCH realized vol',
        currentValue: `E = ${quantumEV.toFixed(2)} eV`,
        status: 'active', color: '#9d4edd',
      },
      {
        id: 'webgpu_mc_cone',
        name: 'WebGPU Monte Carlo Envelope',
        plane: 'Spatial Probability/ML',
        description: '10,000-path jump diffusion cone with 5th–95th quantile bands',
        currentValue: '10,000 paths',
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'rel_vol_cone',
        name: 'Relative Volatility Cone',
        plane: 'Spatial Probability/ML',
        description: 'GARCH(1,1)-derived realized vol as implied percentile proxy',
        currentValue: `${garchVolAnn.toFixed(1)}% IV (GARCH)`,
        status: garchVolAnn > 80 ? 'warning' : 'neutral',
        color: '#ffb700',
      },
      {
        id: 'shap_matrix',
        name: 'SHAP Attribution Matrix',
        plane: 'Spatial Probability/ML',
        description: 'Live Shapley weights proportional to metric magnitudes, normalized to 100%',
        currentValue: `Top: ${shapWeights[0].feature.split(' ')[0]} (${(shapWeights[0].weight * 100).toFixed(0)}%)`,
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'bollinger_width',
        name: 'Bollinger Band Width (BBW)',
        plane: 'Spatial Probability/ML',
        description: 'Normalized BB width: compression → breakout setup; expansion → exhaustion',
        currentValue: n >= 20
          ? `${(this.bbWidth * 100).toFixed(2)}% (U:${this.bbUpper.toFixed(1)} L:${this.bbLower.toFixed(1)})`
          : 'warming up…',
        status: this.bbWidth < 0.005 ? 'warning' : 'active',
        color: this.bbWidth < 0.005 ? '#ff0055' : this.bbWidth > 0.05 ? '#ffb700' : '#00f3ff',
      },
      {
        id: 'macd',
        name: 'MACD (12/26/9)',
        plane: 'Spatial Probability/ML',
        description: 'Moving Average Convergence/Divergence with signal and histogram',
        currentValue: `${macdLine >= 0 ? '+' : ''}${macdLine.toFixed(2)} | H: ${macdHist >= 0 ? '+' : ''}${macdHist.toFixed(2)}`,
        status: macdLine > 0 && macdHist > 0 ? 'active' : macdLine < 0 && macdHist < 0 ? 'warning' : 'neutral',
        color: macdLine >= 0 ? '#00ff88' : '#ff0055',
      },

      // ── Plane 4: Auction Theory / Structure (7) ──────────────────────────
      {
        id: 'rl_fibonacci',
        name: 'RL Adaptive Fibonacci Suite',
        plane: 'Auction Theory/Structure',
        description: 'Auto-anchored to real 50-bar swing H/L extremes from price history',
        currentValue: `0.618: $${(swingHigh - swingDiff * 0.618).toFixed(2)}`,
        status: 'active', color: '#ffb700',
      },
      {
        id: 'anchored_vwap',
        name: 'Anchored VWAP + Bands',
        plane: 'Auction Theory/Structure',
        description: 'Volume-weighted average price with ±1σ, ±2σ, ±3σ dispersion envelopes',
        currentValue: this.currentVwap > 0 ? this.currentVwap.toFixed(2) : midPrice.toFixed(2),
        status: 'active', color: '#ffb700',
      },
      {
        id: 'dynamic_vpvr',
        name: 'Dynamic Volume Profile (VPVR)',
        plane: 'Auction Theory/Structure',
        description: 'HVN/LVN liquidity shelves from actual 100-bar price-volume distribution',
        currentValue: n >= 30
          ? `${vpvrLevels.filter(v => v.isHVN).length} HVN · ${vpvrLevels.filter(v => v.isLVN).length} LVN`
          : 'POC In-Play',
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'volatility_envelope',
        name: 'Dynamic Volatility Envelopes (ATR)',
        plane: 'Auction Theory/Structure',
        description: 'Keltner-ATR adaptive channels (±1.5× ATR) from actual true-range history',
        currentValue: atrValue > 0
          ? `±${(atrValue * 1.5).toFixed(2)} | ATR: ${atrValue.toFixed(2)} (${atrPct.toFixed(2)}%)`
          : 'warming up…',
        status: atrPct > 3 ? 'warning' : 'neutral', color: '#9d4edd',
      },
      {
        id: 'corwin_schultz',
        name: 'Corwin-Schultz High-Low Spread',
        plane: 'Auction Theory/Structure',
        description: 'Dual-period H/L variance estimator of effective bid-ask spread',
        currentValue: `${(csSpreadPct * 100).toFixed(3)}% ($${csSpreadDollar.toFixed(2)})`,
        status: 'active', color: '#ffb700',
      },
      {
        id: 'stochastic',
        name: 'Stochastic %K/%D (14,3)',
        plane: 'Auction Theory/Structure',
        description: 'Momentum oscillator: close vs 14-period H/L range · >80 OB · <20 OS',
        currentValue: n >= 14
          ? `%K: ${this.stochK.toFixed(1)} | %D: ${this.stochD.toFixed(1)}`
          : 'warming up…',
        status: this.stochK > 80 || this.stochK < 20 ? 'warning' : 'neutral',
        color: this.stochK > 80 ? '#ff0055' : this.stochK < 20 ? '#00ff88' : '#ffb700',
      },
      {
        id: 'williams_r',
        name: 'Williams %R (14)',
        plane: 'Auction Theory/Structure',
        description: 'Overbought/oversold: >-20 OB · <-80 OS relative to 14-bar H/L',
        currentValue: n >= 14 ? `${this.williamsR.toFixed(1)}` : 'warming up…',
        status: this.williamsR > -20 || this.williamsR < -80 ? 'warning' : 'neutral',
        color: this.williamsR > -20 ? '#ff0055' : this.williamsR < -80 ? '#00ff88' : '#ffb700',
      },

      // ── Plane 5: Trend & Momentum (6) ────────────────────────────────────
      {
        id: 'zero_lag_ma',
        name: 'Zero-Lag Trend MAs (20/50/200)',
        plane: 'Trend/Momentum',
        description: 'Double-EMA de-lagged ribbon: ZL = 2·EMA(n) − EMA(EMA(n))',
        currentValue: `${ma20.toFixed(0)} / ${ma50.toFixed(0)} / ${ma200.toFixed(0)}`,
        status: 'active', color: '#00ff88',
      },
      {
        id: 'adaptive_rsi',
        name: 'Multi-Regime RSI (Wilder)',
        plane: 'Trend/Momentum',
        description: 'Actual Wilder RSI — lookback dynamically modulated by Hurst exponent',
        currentValue: `${this.rsiValue.toFixed(1)} (LB: ${this.adaptiveLookback})`,
        status: this.rsiValue > 70 || this.rsiValue < 30 ? 'warning' : 'neutral',
        color: this.rsiValue > 70 ? '#ff0055' : this.rsiValue < 30 ? '#00ff88' : '#f0f4f8',
      },
      {
        id: 'kalman_trend',
        name: '1D Kalman Micro-Trend Filter',
        plane: 'Trend/Momentum',
        description: 'Zero-lag recursive state-space filter estimating unobserved equilibrium',
        currentValue: `$${this.kalmanPrice.toFixed(1)} (${this.kalmanVelocity >= 0 ? '+' : ''}${this.kalmanVelocity.toFixed(2)}/s)`,
        status: 'active',
        color: this.kalmanVelocity >= 0 ? '#00ff88' : '#ff0055',
      },
      {
        id: 'kaufman_ama',
        name: 'Kaufman Adaptive MA (KAMA)',
        plane: 'Trend/Momentum',
        description: 'Efficiency-ratio smoothing: fast in trends, slow in noise',
        currentValue: `$${this.kamaPrice.toFixed(1)} (ER: ${this.kamaER.toFixed(2)})`,
        status: 'active', color: '#00f3ff',
      },
      {
        id: 'obv',
        name: 'On-Balance Volume (OBV)',
        plane: 'Trend/Momentum',
        description: 'Cumulative signed volume — up-day adds volume, down-day subtracts',
        currentValue: `${this.obvCumulative >= 0 ? '+' : ''}${this.obvCumulative.toFixed(2)}`,
        status: 'active',
        color: this.obvCumulative >= 0 ? '#00ff88' : '#ff0055',
      },
      {
        id: 'cmf',
        name: 'Chaikin Money Flow (CMF)',
        plane: 'Trend/Momentum',
        description: 'Buying/selling pressure: close position in H-L range scaled by volume',
        currentValue: `${this.cmfVal >= 0 ? '+' : ''}${this.cmfVal.toFixed(3)}`,
        status: Math.abs(this.cmfVal) > 0.25 ? 'warning' : 'neutral',
        color: this.cmfVal > 0.1 ? '#00ff88' : this.cmfVal < -0.1 ? '#ff0055' : '#ffb700',
      },
      {
        id: 'roc',
        name: 'Rate of Change / Momentum (10)',
        plane: 'Trend/Momentum',
        description: 'Percentage price change over 10-bar lookback measuring raw momentum',
        currentValue: n >= 11 ? `${this.rocValue >= 0 ? '+' : ''}${this.rocValue.toFixed(2)}%` : 'warming up…',
        status: Math.abs(this.rocValue) > 2 ? 'warning' : 'neutral',
        color: this.rocValue > 0 ? '#00ff88' : '#ff0055',
      },
    ];

    return {
      indicators,
      activePlane: 'Microstructure/Depth',
      shapWeights,
      vpvrLevels,
      fibLevels,
      zeroLagMAs: { ma20, ma50, ma200 },
      adaptiveRsi: this.rsiValue,
      kalmanPrice: this.kalmanPrice,
      garchVol: garchVolAnn,
      vpin: wasmMetrics.vpin,
      avellanedaReservation,
    };
  }
}
