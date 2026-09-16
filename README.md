# AETHER-CORE // Autonomous Hardware-Accelerated Quantitative Trading Terminal

AETHER-CORE is an autonomous, hardware-accelerated quantitative trading terminal running entirely client-side inside the browser. It features:
- **High-Throughput Ingestion**: Real Binance L2 WebSocket (`depth20@100ms` & `trade`) combined with a clearly labeled **Simulated L3** order-injection simulator.
- **C++20 WebAssembly Core**: Lock-free SPSC cyclic ring buffer in linear memory computing Micro-Price, Cont-Kukanov-Stoikov Order Flow Imbalance (OFI), Kyle's Lambda, and queue priority.
- **WebGPU Compute Array (WGSL)**: 10,000-path Monte Carlo price cone with jump-diffusion, 2D volumetric order-book depth KDE, Hawkes point processes, and quantum probability-density wave $\Psi(x,t)$.
- **DuckDB-WASM Columnar Store**: Client-side tick/snapshot analytical database, microsecond time-travel replay scrubber, and walk-forward backtesting.
- **Behavioral Adaptive Core**: 5-vector telemetry tracker continuously classifying into **Micro-Scalper**, **Intraday Momentum**, or **Positional Quant**, live-mutating layout and GPU/CPU thread priority.
- **22-Indicator Matrix Across 5 Planes**: Complete analytical coverage with zero placeholder charts.
- **Visual Strategy-to-Code Compiler**: React Flow node canvas with 3 dynamic outputs:
  1. Zero-allocation C++20 HFT template
  2. Event-driven Python/asyncio backtest script with DuckDB SQL connection pooling
  3. zk-SNARK verifier circuit (Circom + SnarkJS) proving Sharpe $> 2.0$ and Max Drawdown $< 5.0\%$ without revealing strategy logic.

---

## The 22 Indicators Across 5 Planes

### 1. Microstructure & Depth Plane (8)
1. **Volumetric Liquidity Heatmap**: 2D luminance rasterization of depth distribution without 3D occlusion.
2. **Liquidity Gravity Vector**: Dynamic gravitational vector $G(p)$ pulling price toward concentrated liquidity clusters.
3. **Order Flow Imbalance (OFI)**: Cont-Kukanov-Stoikov formulation measuring changes in best bid/ask volume.
4. **Shannon Order Flow Entropy**: Information entropy measuring the predictability of order arrivals.
5. **Spoofing Risk Index**: Synthetic L3 detection of flash-placed and rapid-cancelled orders.
6. **Micro-Price Tracer**: Multi-level volume-weighted fundamental equilibrium price.
7. **CVD Divergence**: Cumulative volume delta divergence against price trajectory.
8. **Kyle's Lambda**: Rolling regression measuring price impact per unit of signed volume with edge-glow alert.

### 2. Point Processes & Regimes Plane (4)
9. **Hawkes Cascade Intensity**: Mutually-exciting point process branching ratio ($\lambda(t) \ge 1.0$ indicates cascade warning).
10. **Ising Phase Transition Index**: 2D statistical physics order parameter measuring market magnetization.
11. **Rolling Hurst Exponent**: Fractal persistence index (Amber $<0.5$ for mean-reverting, Cyan $>0.5$ for trending).
12. **Markov Regime Detector**: Multi-state regime classification across volatility regimes.

### 3. Spatial Probability & ML Plane (4)
13. **Quantum Probability Wave $\Psi(x,t)$**: Schrödinger wavepacket probability density $|\Psi(x,t)|^2$ in liquidity barrier potential wells.
14. **WebGPU Monte Carlo Envelope**: 10,000 parallel paths with jump-diffusion and 5th to 95th quantile bands.
15. **Relative Volatility Cone**: Realized vs implied volatility term structure.
16. **SHAP Attribution Matrix**: Shapley additive explanations decomposing microstructural predictive drivers.

### 4. Auction Theory & Structure Plane (4)
17. **RL Adaptive Fibonacci Suite**: Reinforcement learning dynamic auto-anchoring swing levels.
18. **Anchored VWAP + Bands**: Volume-weighted average price with $\pm 1\sigma, \pm 2\sigma, \pm 3\sigma$ dispersion bands.
19. **Dynamic Volume Profile (VPVR)**: High Volume Nodes (HVN) and Low Volume Nodes (LVN) liquidity shelves.
20. **Dynamic Volatility Envelopes**: Adaptive Keltner-ATR distribution channels.

### 5. Trend & Momentum Plane (2)
21. **Zero-Lag Trend MAs (20/50/200)**: WASM de-lagged moving average ribbon.
22. **Multi-Regime RSI/Stochastic**: Relative Strength Index with lookback dynamically modulated by the Hurst exponent.

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server with COOP/COEP headers
npm run dev

# 3. Build production bundle
npm run build
```

Open `http://localhost:5173` in any WebGPU-capable Chromium browser.