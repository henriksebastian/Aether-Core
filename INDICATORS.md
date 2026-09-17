# Replace Hardcoded Constants in `indicator_engine.ts`

## What's Currently Hardcoded (and wrong)

| Line | What | Problem |
|---|---|---|
| L23 | `shannonEntropy = 0.76` | Initial value OK, but never truly initialized from data |
| L24 | `isingMagnetization = 0.12` | Seed value |
| L25 | `hurstExponent = 0.58` | Seed value — fine, but no warm-up |
| L28 | `rsiValue = 54.2` | **Fully fake** — RSI is computed from `sin()` noise, not price changes |
| L54 | `midPrice = 64500` | Fallback when book is null — should be last known price |
| L68 | `cvdDivergenceScore = 0.15` | Magic number |
| L73 | `cvdDivergenceScore = 0.82` | Magic number |
| L111 | `tanh(ofi * 0.15)` | Magic scaling factor |
| L120–121 | RSI via `Math.sin(Date.now()/3000) * 8` | **Completely fake** — uses clock noise |
| L132–134 | `ma20 = price * 0.9992` etc. | **Fake MAs** — multiply by magic constants |
| L140–144 | VPVR with `isHVN = i === 0 \|\| i === 2` | Hardcoded node positions & volumes |
| L151–152 | `swingHigh = price * 1.015` | Fixed ±1.5% instead of actual price swing |
| L166–171 | SHAP weights all hardcoded | Never change |
| L176–178 | GARCH omega/alpha/beta hardcoded | Fine for GARCH but omega should be data-driven |
| L186–187 | `gammaAversion = 0.08`, `kappaIntensity = 1.4` | Avellaneda params could be vol-adaptive |
| L196 | `bookCurvature = 0.38` | Fallback magic number |
| L215 | `csSpreadPct = 0.00075` | Fallback magic number |
| L441 | `'E = 4.82 eV'` | Completely fake/static |
| L459 | `'48.2% IV'` | Fake IV |
| L506 | `'±1.82 ATR'` | Static ATR value |

## Proposed Changes

### 1. Real RSI (replaces `Math.sin` fake)
Compute Wilder's smoothed RSI from `priceHistory`:
- Track `avgGain`, `avgLoss` as EWMA over `adaptiveLookback` periods
- Store persistent `prevAvgGain`, `prevAvgLoss` on the class

### 2. Real Zero-Lag EMA (replaces magic multiplier MAs)
Proper EMA formula: `ema = α * price + (1−α) * prevEma` where `α = 2/(n+1)`
- Store `ema20`, `ema50`, `ema200` as class fields
- Zero-lag correction: `ZL_EMA = 2*EMA(n) − EMA(EMA(n))`

### 3. Real VPVR from `priceHistory` (replaces hardcoded HVN/LVN)
- Bucket `priceHistory` into 11 price bins around current price
- Count hits per bin → actual volume nodes
- Mark top-3 bins as HVN, bottom-3 as LVN

### 4. Real Swing High/Low for Fibonacci (replaces ±1.5%)
- Actual max/min over `priceHistory.slice(-50)` lookback

### 5. Dynamic SHAP weights from live computed values
- OFI weight ∝ `|wasmMetrics.ofi|`
- Hawkes weight ∝ `wasmMetrics.hawkesIntensity`
- Hurst weight ∝ `|hurstExponent - 0.5|` (how far from random walk)
- VPIN weight ∝ `wasmMetrics.vpin`
- Spoof weight ∝ `l3State.spoofingRiskIndex`
- Normalize all to sum to 1.0

### 6. Dynamic ATR (replaces `'±1.82 ATR'`)
- Store high/low arrays, compute ATR(14) = EWMA of True Range

### 7. Dynamic IV from GARCH vol (replaces `'48.2% IV'`)
- Use `garchVolAnn` as realized vol proxy for IV display

### 8. Quantum Ψ energy level from GARCH (replaces `'E = 4.82 eV'`)
- Map `garchVolAnn` to a pseudo-energy level: `E = garchVol * 0.1` eV (cosmetic but computed)

### 9. Fallback `midPrice` from `priceHistory` (replaces hardcoded `64500`)
- Use `priceHistory[priceHistory.length - 1]` or `this.kalmanPrice` if book is null

### 10. New Indicators to Add
| Indicator | Computation |
|---|---|
| **ATR(14)** | Wilder's average true range — already partially mentioned above |
| **Bollinger Band Width** | `(upper - lower) / mid` — measures volatility compression |
| **Momentum / ROC** | `(price_now - price_n) / price_n * 100` |
| **Stochastic %K/%D** | `(close - low_n) / (high_n - low_n)` |
| **Williams %R** | `(high_n - close) / (high_n - low_n) * -100` |
| **CMF (Chaikin Money Flow)** | Uses price + volume from trades |
| **OBV (On-Balance Volume)** | Cumulative signed volume |
| **MACD** | EMA(12) − EMA(26) + signal EMA(9) |

## Verification
- `npx tsc --noEmit` must pass with 0 errors
- All indicator `currentValue` strings must change each tick based on actual data
- No `Math.sin(Date.now())` or magic `* 0.9992` style constants remain

## Open Questions
- Should GARCH omega/alpha/beta be user-tunable? (Currently fine as GARCH literature defaults)
- Avellaneda `gammaAversion` — should it scale with `garchVolAnn`?
