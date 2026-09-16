import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MarketTick, OrderBookL2 } from '../types/market';
import { fetchBinanceHistoricalKlines } from '../ingestion/binance_rest';
import { computeMonteCarloForecast, MonteCarloForecast } from '../indicators/monte_carlo';

export interface Candle {
  time: number; // timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

interface CandlestickChartProps {
  symbol?: string;
  orderBook: OrderBookL2 | null;
  recentTrades: MarketTick[];
  microPrice: number;
  activePersona: string;
  ofi: number;
  viewMode?: 'candlestick' | 'heatmap' | 'split';
  onViewModeChange?: (mode: 'candlestick' | 'heatmap' | 'split') => void;
}

export type Timeframe = '1s' | '5s' | '1m' | '5m' | '15m' | '1h' | '1D';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1s': 1000,
  '5s': 5000,
  '1m': 60000,
  '5m': 300000,
  '15m': 900000,
  '1h': 3600000,
  '1D': 86400000,
};

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol = 'BTCUSDT',
  orderBook,
  recentTrades,
  microPrice,
  ofi,
  viewMode,
  onViewModeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [hoverData, setHoverData] = useState<{
    candle: Candle | null;
    x: number;
    y: number;
    price: number;
  } | null>(null);

  // Indicator Toggles
  const [showVWAP, setShowVWAP] = useState(true);
  const [showEMA21, setShowEMA21] = useState(true);
  const [showEMA55, setShowEMA55] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showMonteCarlo, setShowMonteCarlo] = useState(true);
  const [showPositionMarker, setShowPositionMarker] = useState(true);

  // Monte Carlo 3,000-Path Forecast State
  const [mcForecast, setMcForecast] = useState<MonteCarloForecast | null>(null);

  // Base price reference for realistic fallback pre-population
  const fallbackBase = orderBook?.midPrice || (symbol === 'ETHUSDT' ? 2420 : symbol === 'SOLUSDT' ? 98 : 76200);

  // Fetch real Binance klines whenever symbol or timeframe changes
  useEffect(() => {
    let isMounted = true;

    const loadKlines = async () => {
      const realKlines = await fetchBinanceHistoricalKlines(symbol, timeframe, 85);
      if (!isMounted) return;

      if (realKlines && realKlines.length > 0) {
        setCandles(realKlines);
      } else {
        // Fallback: Generate synthetic candles if offline/rate-limited
        const count = 75;
        const tfMs = TIMEFRAME_MS[timeframe];
        const now = Date.now();
        const initialCandles: Candle[] = [];

        let currentPrice = fallbackBase * 0.985;
        const startTime = now - count * tfMs;

        for (let i = 0; i < count; i++) {
          const cTime = startTime + i * tfMs;
          const volatility = currentPrice * 0.0018;
          const change = (Math.random() - 0.48) * volatility;
          const open = currentPrice;
          const close = open + change;
          const high = Math.max(open, close) + Math.random() * volatility * 0.8;
          const low = Math.min(open, close) - Math.random() * volatility * 0.8;
          const volume = Math.round((2.5 + Math.random() * 8.5) * 100) / 100;
          const isBuy = close >= open;

          initialCandles.push({
            time: cTime,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume,
            buyVolume: isBuy ? volume * 0.7 : volume * 0.3,
            sellVolume: isBuy ? volume * 0.3 : volume * 0.7,
          });

          currentPrice = close;
        }

        setCandles(initialCandles);
      }
    };

    loadKlines();

    return () => {
      isMounted = false;
    };
  }, [symbol, timeframe]);

  // Aggregate incoming live ticks into the active candle
  const lastProcessedTradeRef = useRef<number>(0);
  useEffect(() => {
    if (recentTrades.length === 0) return;
    const latestTrade = recentTrades[0];
    if (latestTrade.timestamp === lastProcessedTradeRef.current) return;
    lastProcessedTradeRef.current = latestTrade.timestamp;

    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const tfMs = TIMEFRAME_MS[timeframe];
      const copy = [...prev];
      const lastCandle = { ...copy[copy.length - 1] };
      const currentBucket = Math.floor(latestTrade.timestamp / tfMs) * tfMs;

      if (lastCandle.time === currentBucket) {
        // Update existing active candle
        lastCandle.high = Math.max(lastCandle.high, latestTrade.price);
        lastCandle.low = Math.min(lastCandle.low, latestTrade.price);
        lastCandle.close = latestTrade.price;
        lastCandle.volume = Math.round((lastCandle.volume + latestTrade.quantity) * 1000) / 1000;
        if (latestTrade.side === 'buy') {
          lastCandle.buyVolume += latestTrade.quantity;
        } else {
          lastCandle.sellVolume += latestTrade.quantity;
        }
        copy[copy.length - 1] = lastCandle;
      } else if (currentBucket > lastCandle.time) {
        // Open a new candle
        const newCandle: Candle = {
          time: currentBucket,
          open: lastCandle.close,
          high: Math.max(lastCandle.close, latestTrade.price),
          low: Math.min(lastCandle.close, latestTrade.price),
          close: latestTrade.price,
          volume: latestTrade.quantity,
          buyVolume: latestTrade.side === 'buy' ? latestTrade.quantity : 0,
          sellVolume: latestTrade.side === 'sell' ? latestTrade.quantity : 0,
        };
        copy.push(newCandle);
        if (copy.length > 120) copy.shift(); // retain max 120 candles for performance
      }

      return copy;
    });
  }, [recentTrades, timeframe]);

  // Compute Moving Averages (EMA 21, EMA 55) & VWAP series
  const indicatorSeries = useMemo(() => {
    if (candles.length === 0) return { ema21: [], ema55: [], vwap: [] };

    const ema21: (number | null)[] = [];
    const ema55: (number | null)[] = [];
    const vwap: (number | null)[] = [];

    const k21 = 2 / (21 + 1);
    const k55 = 2 / (55 + 1);

    let prevEma21 = candles[0].close;
    let prevEma55 = candles[0].close;
    let cumVol = 0;
    let cumPv = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const typical = (c.high + c.low + c.close) / 3;

      cumVol += c.volume;
      cumPv += typical * c.volume;
      vwap.push(cumVol > 0 ? cumPv / cumVol : typical);

      if (i === 0) {
        ema21.push(prevEma21);
        ema55.push(prevEma55);
      } else {
        prevEma21 = c.close * k21 + prevEma21 * (1 - k21);
        prevEma55 = c.close * k55 + prevEma55 * (1 - k55);
        ema21.push(i >= 10 ? prevEma21 : null);
        ema55.push(i >= 20 ? prevEma55 : null);
      }
    }

    return { ema21, ema55, vwap };
  }, [candles]);

  // Compute Monte Carlo 3,000-Path Price Cone Forecast
  useEffect(() => {
    if (candles.length === 0) return;
    const latestPrice = candles[candles.length - 1].close;
    const forecast = computeMonteCarloForecast(
      latestPrice,
      microPrice,
      ofi,
      candles,
      symbol,
      timeframe,
      18,
      3000
    );
    if (forecast) {
      setMcForecast(forecast);
    }
  }, [candles, symbol, timeframe, ofi, microPrice]);

  // Canvas Rendering Pipeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background (Deep Carbon Slate from Terminal Horizon)
    ctx.fillStyle = '#090e18';
    ctx.fillRect(0, 0, width, height);

    // Padding parameters
    const rightAxisWidth = 72;
    const bottomAxisHeight = 22;
    const chartWidth = width - rightAxisWidth;
    const chartHeight = height - bottomAxisHeight;
    const volumeHeight = showVolume ? chartHeight * 0.18 : 0;
    const priceChartHeight = chartHeight - volumeHeight;

    // Determine Price Range
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    for (const c of candles) {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
      maxVolume = Math.max(maxVolume, c.volume);
    }

    // Expand price bounds for Monte Carlo forecast cone
    if (showMonteCarlo && mcForecast) {
      for (let t = 0; t < mcForecast.steps; t++) {
        minPrice = Math.min(minPrice, mcForecast.p05[t]);
        maxPrice = Math.max(maxPrice, mcForecast.p95[t]);
      }
    }

    if (maxPrice <= minPrice) {
      minPrice -= 10;
      maxPrice += 10;
    }

    // Add 8% padding to price bounds
    const pMargin = (maxPrice - minPrice) * 0.08;
    minPrice -= pMargin;
    maxPrice += pMargin;

    const priceToY = (p: number): number => {
      return priceChartHeight - ((p - minPrice) / (maxPrice - minPrice)) * priceChartHeight;
    };

    const volumeToY = (v: number): number => {
      const h = (v / (maxVolume || 1)) * (volumeHeight - 10);
      return chartHeight - h;
    };

    // Calculate Candle Geometry (with future slots reserved for Monte Carlo)
    const n = candles.length;
    const futureSlots = showMonteCarlo && mcForecast ? mcForecast.steps : 0;
    const totalSlots = n + futureSlots;
    const candleSlotWidth = chartWidth / (totalSlots || 1);
    const candleBodyWidth = Math.max(3, candleSlotWidth * 0.72);

    // 2. Draw Horizontal Gridlines & Price Scale
    const numGridLines = 7;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    const pStep = (maxPrice - minPrice) / numGridLines;
    for (let i = 0; i <= numGridLines; i++) {
      const p = minPrice + i * pStep;
      const y = Math.round(priceToY(p)) + 0.5;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Right Axis Label
      ctx.fillText(p.toFixed(2), chartWidth + 6, y + 3);
    }

    // 3. Draw Vertical Time Gridlines
    const timeStep = Math.max(1, Math.floor(n / 6));
    ctx.textAlign = 'center';
    for (let i = 0; i < n; i += timeStep) {
      const x = Math.round(i * candleSlotWidth + candleSlotWidth / 2) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, chartHeight);
      ctx.stroke();

      const d = new Date(candles[i].time);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      ctx.fillText(timeStr, x, height - 6);
    }

    // Future Time Grid Divider (boundary between historical and Monte Carlo prediction)
    if (showMonteCarlo && futureSlots > 0) {
      const forecastStartX = (n - 1) * candleSlotWidth + candleSlotWidth / 2;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(forecastStartX, 0);
      ctx.lineTo(forecastStartX, chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('FORECAST', forecastStartX + 28, 12);
    }

    // 4. Draw Volume Histogram Bars
    if (showVolume) {
      for (let i = 0; i < n; i++) {
        const c = candles[i];
        const isGreen = c.close >= c.open;
        const x = i * candleSlotWidth + (candleSlotWidth - candleBodyWidth) / 2;
        const y = volumeToY(c.volume);
        const barH = chartHeight - y;

        ctx.fillStyle = isGreen ? 'rgba(8, 153, 129, 0.28)' : 'rgba(242, 54, 69, 0.28)';
        ctx.fillRect(x, y, candleBodyWidth, barH);
        ctx.strokeStyle = isGreen ? '#089981' : '#f23645';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, candleBodyWidth, barH);
      }
    }

    // 5. Draw 3,000-Path Monte Carlo Quantile Price Cone Projection
    if (showMonteCarlo && mcForecast && mcForecast.p50.length > 0) {
      const startX = (n - 1) * candleSlotWidth + candleSlotWidth / 2;
      const latestPrice = candles[candles.length - 1].close;
      const spotY = priceToY(latestPrice);
      const steps = mcForecast.steps;

      // A. Outer Quantile Band (P05 to P95 Extreme Volatility Envelope)
      ctx.beginPath();
      ctx.moveTo(startX, spotY);
      for (let t = 0; t < steps; t++) {
        const x = startX + (t + 1) * candleSlotWidth;
        const y = priceToY(mcForecast.p95[t]);
        ctx.lineTo(x, y);
      }
      for (let t = steps - 1; t >= 0; t--) {
        const x = startX + (t + 1) * candleSlotWidth;
        const y = priceToY(mcForecast.p05[t]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
      ctx.fill();

      // Outer boundary stroke
      ctx.beginPath();
      ctx.moveTo(startX, spotY);
      for (let t = 0; t < steps; t++) {
        const x = startX + (t + 1) * candleSlotWidth;
        ctx.lineTo(x, priceToY(mcForecast.p95[t]));
      }
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX, spotY);
      for (let t = 0; t < steps; t++) {
        const x = startX + (t + 1) * candleSlotWidth;
        ctx.lineTo(x, priceToY(mcForecast.p05[t]));
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // B. Inner Quantile Band (P25 to P75 Interquartile High Probability Zone)
      ctx.beginPath();
      ctx.moveTo(startX, spotY);
      for (let t = 0; t < steps; t++) {
        const x = startX + (t + 1) * candleSlotWidth;
        const y = priceToY(mcForecast.p75[t]);
        ctx.lineTo(x, y);
      }
      for (let t = steps - 1; t >= 0; t--) {
        const x = startX + (t + 1) * candleSlotWidth;
        const y = priceToY(mcForecast.p25[t]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.fill();

      // C. Median Expected Trajectory (P50)
      ctx.beginPath();
      ctx.moveTo(startX, spotY);
      for (let t = 0; t < steps; t++) {
        const x = startX + (t + 1) * candleSlotWidth;
        const y = priceToY(mcForecast.p50[t]);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // D. Terminal TP & SL Horizontal Guidance Lines
      const endX = startX + steps * candleSlotWidth;
      const tpY = priceToY(mcForecast.targetTP);
      const slY = priceToY(mcForecast.targetSL);

      // TP Target Line (Green dashed)
      ctx.strokeStyle = 'rgba(8, 153, 129, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(endX, tpY);
      ctx.lineTo(chartWidth, tpY);
      ctx.stroke();

      // SL Risk Line (Red dashed)
      ctx.strokeStyle = 'rgba(242, 54, 69, 0.6)';
      ctx.beginPath();
      ctx.moveTo(endX, slY);
      ctx.lineTo(chartWidth, slY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Terminal Right Axis Target Badges
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';

      // TP Target Label
      ctx.fillStyle = '#089981';
      ctx.fillRect(chartWidth + 2, Math.round(tpY) - 7, rightAxisWidth - 4, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`TP ${mcForecast.targetTP.toFixed(1)}`, chartWidth + 5, Math.round(tpY) + 3);

      // SL Target Label
      ctx.fillStyle = '#f23645';
      ctx.fillRect(chartWidth + 2, Math.round(slY) - 7, rightAxisWidth - 4, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SL ${mcForecast.targetSL.toFixed(1)}`, chartWidth + 5, Math.round(slY) + 3);
    }

    // 6. Draw Technical Indicator Overlays
    // EMA 55 (Violet)
    if (showEMA55 && indicatorSeries.ema55.length === n) {
      ctx.beginPath();
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = 0; i < n; i++) {
        const val = indicatorSeries.ema55[i];
        if (val !== null) {
          const x = i * candleSlotWidth + candleSlotWidth / 2;
          const y = priceToY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // EMA 21 (Cyan)
    if (showEMA21 && indicatorSeries.ema21.length === n) {
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      let started = false;
      for (let i = 0; i < n; i++) {
        const val = indicatorSeries.ema21[i];
        if (val !== null) {
          const x = i * candleSlotWidth + candleSlotWidth / 2;
          const y = priceToY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // VWAP Line (Gold dashed)
    if (showVWAP && indicatorSeries.vwap.length === n) {
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (let i = 0; i < n; i++) {
        const val = indicatorSeries.vwap[i];
        if (val !== null) {
          const x = i * candleSlotWidth + candleSlotWidth / 2;
          const y = priceToY(val);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 7. Draw Candlesticks (Bodies & Wicks)
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const isGreen = c.close >= c.open;
      const color = isGreen ? '#089981' : '#f23645';

      const centerX = Math.round(i * candleSlotWidth + candleSlotWidth / 2) + 0.5;
      const bodyX = Math.round(i * candleSlotWidth + (candleSlotWidth - candleBodyWidth) / 2);

      const yHigh = priceToY(c.high);
      const yLow = priceToY(c.low);
      const yOpen = priceToY(c.open);
      const yClose = priceToY(c.close);

      const bodyY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));

      // Wick (1px line)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.stroke();

      // Body (Solid rectangle)
      ctx.fillStyle = color;
      ctx.fillRect(bodyX, bodyY, candleBodyWidth, bodyH);

      // Micro Highlight edge
      ctx.strokeStyle = isGreen ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bodyX, bodyY, candleBodyWidth, bodyH);
    }

    // 8. Micro-Price Tracer Line (Cyan dashed)
    if (microPrice > 0) {
      const microY = Math.round(priceToY(microPrice)) + 0.5;
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(0, microY);
      ctx.lineTo(chartWidth, microY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 9. Active Current Price Tag (Snapping on right axis)
    const latestCandle = candles[candles.length - 1];
    const curPrice = latestCandle.close;
    const curY = Math.round(priceToY(curPrice));
    const isCurGreen = latestCandle.close >= latestCandle.open;
    const tagColor = isCurGreen ? '#089981' : '#f23645';

    // Current Price Line across chart
    ctx.strokeStyle = tagColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, curY + 0.5);
    ctx.lineTo(chartWidth, curY + 0.5);
    ctx.stroke();

    // Right Axis Price Badge
    ctx.fillStyle = tagColor;
    ctx.fillRect(chartWidth + 1, curY - 9, rightAxisWidth - 2, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(curPrice.toFixed(2), chartWidth + rightAxisWidth / 2, curY + 4);

    // 10. Interactive Crosshair Hover
    if (hoverData && hoverData.x < chartWidth && hoverData.y < chartHeight) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Horizontal crosshair
      ctx.beginPath();
      ctx.moveTo(0, hoverData.y + 0.5);
      ctx.lineTo(chartWidth, hoverData.y + 0.5);
      ctx.stroke();

      // Vertical crosshair
      ctx.beginPath();
      ctx.moveTo(hoverData.x + 0.5, 0);
      ctx.lineTo(hoverData.x + 0.5, chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Hover Price Badge on Right Axis
      ctx.fillStyle = '#1e2433';
      ctx.fillRect(chartWidth + 1, hoverData.y - 8, rightAxisWidth - 2, 16);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.strokeRect(chartWidth + 1, hoverData.y - 8, rightAxisWidth - 2, 16);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(hoverData.price.toFixed(2), chartWidth + rightAxisWidth / 2, hoverData.y + 4);

      // Hover Time Badge on Bottom Axis
      if (hoverData.candle) {
        const d = new Date(hoverData.candle.time);
        const timeBadge = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
        const badgeW = 60;
        ctx.fillStyle = '#1e2433';
        ctx.fillRect(hoverData.x - badgeW / 2, chartHeight + 2, badgeW, 16);
        ctx.strokeRect(hoverData.x - badgeW / 2, chartHeight + 2, badgeW, 16);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(timeBadge, hoverData.x, chartHeight + 14);
      }
    }

    ctx.restore();
  }, [candles, showVWAP, showEMA21, showEMA55, showVolume, showMonteCarlo, mcForecast, microPrice, hoverData, indicatorSeries]);

  // Handle Mouse Hover & Crosshair Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rightAxisWidth = 72;
    const bottomAxisHeight = 22;
    const chartWidth = canvas.clientWidth - rightAxisWidth;
    const chartHeight = canvas.clientHeight - bottomAxisHeight;
    const priceChartHeight = showVolume ? chartHeight * 0.82 : chartHeight;

    if (x >= 0 && x <= chartWidth && y >= 0 && y <= chartHeight) {
      const futureSlots = showMonteCarlo && mcForecast ? mcForecast.steps : 0;
      const totalSlots = candles.length + futureSlots;
      const candleSlotWidth = chartWidth / (totalSlots || 1);
      const idx = Math.min(candles.length - 1, Math.max(0, Math.floor(x / candleSlotWidth)));
      const candle = candles[idx];

      // Calculate price from Y
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      for (const c of candles) {
        minPrice = Math.min(minPrice, c.low);
        maxPrice = Math.max(maxPrice, c.high);
      }
      if (showMonteCarlo && mcForecast) {
        for (let t = 0; t < mcForecast.steps; t++) {
          minPrice = Math.min(minPrice, mcForecast.p05[t]);
          maxPrice = Math.max(maxPrice, mcForecast.p95[t]);
        }
      }
      const pMargin = (maxPrice - minPrice) * 0.08;
      minPrice -= pMargin;
      maxPrice += pMargin;

      const p = maxPrice - (y / priceChartHeight) * (maxPrice - minPrice);

      setHoverData({
        candle,
        x,
        y,
        price: p,
      });
    } else {
      setHoverData(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  const activeDisplayCandle = hoverData?.candle || candles[candles.length - 1];
  const lastEma21 = indicatorSeries.ema21[indicatorSeries.ema21.length - 1];
  const lastVwap = indicatorSeries.vwap[indicatorSeries.vwap.length - 1];

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full w-full bg-[#090e18] text-[#dee2f1] font-mono select-none overflow-hidden"
    >
      {/* 1. Top Chart Secondary Toolbar (Timeframe, Indicators & Status HUD) */}
      <div className="h-8 border-b border-[#1b2232] bg-[#0e131d] px-3 flex items-center justify-between text-[11px] shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-[#64748b] font-medium text-[10px] uppercase tracking-wider">TF:</span>
          {(['1s', '5s', '1m', '5m', '15m', '1h', '1D'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-1.5 py-0.5 text-[11px] transition-colors ${timeframe === tf
                  ? 'bg-[#1b202a] text-[#089981] font-bold border-t-2 border-[#089981]'
                  : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#141a26]'
                }`}
            >
              {tf}
            </button>
          ))}

          <div className="h-3.5 w-px bg-[#1b2232] mx-1.5" />

          {/* Indicator Quick Toggles */}
          <span className="text-[#64748b] font-medium text-[10px] uppercase tracking-wider">IND:</span>
          <button
            onClick={() => setShowMonteCarlo((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-colors ${showMonteCarlo
                ? 'bg-[#1b202a] text-[#06b6d4] border-[#06b6d4]/50'
                : 'text-[#64748b] border-[#1b2232] hover:text-[#94a3b8]'
              }`}
          >
            ● MC CONE
          </button>
          <button
            onClick={() => setShowVWAP((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-colors ${showVWAP
                ? 'bg-[#1b202a] text-[#f59e0b] border-[#f59e0b]/50'
                : 'text-[#64748b] border-[#1b2232] hover:text-[#94a3b8]'
              }`}
          >
            ● VWAP
          </button>
          <button
            onClick={() => setShowEMA21((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-colors ${showEMA21
                ? 'bg-[#1b202a] text-[#06b6d4] border-[#06b6d4]/50'
                : 'text-[#64748b] border-[#1b2232] hover:text-[#94a3b8]'
              }`}
          >
            ● EMA 21
          </button>
          <button
            onClick={() => setShowEMA55((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-colors ${showEMA55
                ? 'bg-[#1b202a] text-[#8b5cf6] border-[#8b5cf6]/50'
                : 'text-[#64748b] border-[#1b2232] hover:text-[#94a3b8]'
              }`}
          >
            ● EMA 55
          </button>
          <button
            onClick={() => setShowVolume((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-colors ${showVolume
                ? 'bg-[#1b202a] text-[#089981] border-[#089981]/50'
                : 'text-[#64748b] border-[#1b2232] hover:text-[#94a3b8]'
              }`}
          >
            ● VOL
          </button>
        </div>

        {/* Position Overlay Toggle, View Mode & Quick Stats */}
        <div className="flex items-center gap-2.5 text-[10px]">
          {onViewModeChange && (
            <div className="flex items-center bg-[#090e18] border border-[#1b2232] p-0.5">
              <button
                onClick={() => onViewModeChange('candlestick')}
                className={`px-1.5 py-0.2 text-[9px] font-bold ${viewMode === 'candlestick'
                    ? 'bg-[#1b202a] text-[#089981] border-b border-[#089981]'
                    : 'text-[#64748b] hover:text-[#dee2f1]'
                  }`}
              >
                CANDLE
              </button>
              <button
                onClick={() => onViewModeChange('heatmap')}
                className={`px-1.5 py-0.2 text-[9px] font-bold ${viewMode === 'heatmap'
                    ? 'bg-[#1b202a] text-[#06b6d4] border-b border-[#06b6d4]'
                    : 'text-[#64748b] hover:text-[#dee2f1]'
                  }`}
              >
                HEATMAP
              </button>
              <button
                onClick={() => onViewModeChange('split')}
                className={`px-1.5 py-0.2 text-[9px] font-bold ${viewMode === 'split'
                    ? 'bg-[#1b202a] text-[#8b5cf6] border-b border-[#8b5cf6]'
                    : 'text-[#64748b] hover:text-[#dee2f1]'
                  }`}
              >
                SPLIT
              </button>
            </div>
          )}
          <button
            onClick={() => setShowPositionMarker((v) => !v)}
            className={`px-1.5 py-0.2 border text-[9px] font-bold ${showPositionMarker
                ? 'bg-[#089981]/15 text-[#089981] border-[#089981]/50'
                : 'text-[#64748b] border-[#1b2232]'
              }`}
          >
            SIGNALS {showPositionMarker ? 'ON' : 'OFF'}
          </button>
          <span className="text-[#64748b]">
            SPREAD: <strong className="text-[#089981] font-mono">${(orderBook?.spread || 0.5).toFixed(2)}</strong>
          </span>
          <span className="text-[#64748b]">
            OFI: <strong className={ofi >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>{ofi >= 0 ? `+${ofi.toFixed(1)}` : ofi.toFixed(1)}</strong>
          </span>
        </div>
      </div>

      {/* 2. Top Chart Overhead Inspection HUD Strip */}
      <div className="h-6 border-b border-[#1b2232] bg-[#090e18] px-3 flex items-center justify-between text-[11px] shrink-0 z-10">
        {activeDisplayCandle ? (
          <div className="flex items-center gap-3">
            <span className="text-[#e2e8f0] font-semibold tracking-wide">
              {symbol.replace('USDT', '/USDT')} PERP · {timeframe}
            </span>
            <span className="text-[#64748b]">
              O <strong className="text-[#dee2f1] font-normal">{activeDisplayCandle.open.toFixed(2)}</strong>
            </span>
            <span className="text-[#64748b]">
              H <strong className="text-[#dee2f1] font-normal">{activeDisplayCandle.high.toFixed(2)}</strong>
            </span>
            <span className="text-[#64748b]">
              L <strong className="text-[#dee2f1] font-normal">{activeDisplayCandle.low.toFixed(2)}</strong>
            </span>
            <span className="text-[#64748b]">
              C{' '}
              <strong
                className={
                  activeDisplayCandle.close >= activeDisplayCandle.open ? 'text-[#089981]' : 'text-[#f23645]'
                }
              >
                {activeDisplayCandle.close.toFixed(2)}
              </strong>
            </span>
            <span className="text-[#64748b]">
              VOL <strong className="text-[#06b6d4] font-normal">{activeDisplayCandle.volume.toFixed(2)} {symbol.replace('USDT', '')}</strong>
            </span>
          </div>
        ) : (
          <div className="text-[#64748b]">Streaming Candle Feed...</div>
        )}

        <div className="flex items-center gap-3 text-[10px]">
          {showMonteCarlo && mcForecast && (
            <span className="text-[#06b6d4] font-bold">
              MC P50: ${mcForecast.p50[mcForecast.p50.length - 1]?.toFixed(1)}
            </span>
          )}
          {showVWAP && lastVwap && (
            <span className="text-[#f59e0b]">VWAP: {lastVwap.toFixed(2)}</span>
          )}
          {showEMA21 && lastEma21 && (
            <span className="text-[#06b6d4]">EMA 21: {lastEma21.toFixed(2)}</span>
          )}
          {microPrice > 0 && (
            <span className="text-[#06b6d4]">µPrice: {microPrice.toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* 3. Main Candlestick Canvas Viewport */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Real-time Visual Execution Overlay Badges & Quant Sizing Card */}
        {showPositionMarker && mcForecast && (
          <div className="absolute left-3 top-3 bg-[#0e131d]/95 border border-[#1b2232] shadow-2xl p-2.5 font-mono text-[10px] w-64 select-none backdrop-blur-sm pointer-events-auto z-10">
            {/* Header / Signal Indicator */}
            <div className="flex items-center justify-between border-b border-[#1b2232] pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    mcForecast.signal.includes('BUY')
                      ? 'bg-[#089981] animate-pulse'
                      : mcForecast.signal.includes('SELL')
                      ? 'bg-[#f23645] animate-pulse'
                      : 'bg-[#f59e0b]'
                  }`}
                />
                <span className="text-[#64748b] font-bold text-[9px]">SIGNAL:</span>
                <span
                  className={`font-bold tracking-wider ${
                    mcForecast.signal.includes('BUY')
                      ? 'text-[#089981]'
                      : mcForecast.signal.includes('SELL')
                      ? 'text-[#f23645]'
                      : 'text-[#f59e0b]'
                  }`}
                >
                  {mcForecast.signal}
                </span>
              </div>
              <span className="text-[9px] px-1 bg-[#141a26] text-[#06b6d4] border border-[#1b2232]">
                {mcForecast.confidence}% CONF
              </span>
            </div>

            {/* Sizing & Capital Allocation */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[#64748b]">REC. SIZING:</span>
                <span className="text-[#dee2f1] font-bold">
                  {mcForecast.recommendedSize.quantity} {mcForecast.recommendedSize.unit}{' '}
                  <span className="text-[#64748b] font-normal">
                    (${mcForecast.recommendedSize.notionalUSD.toLocaleString()})
                  </span>
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#64748b]">ENTRY (SPOT):</span>
                <span className="text-[#dee2f1] font-mono">
                  ${mcForecast.spotPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-[#089981]">
                <span>TARGET (TP P75):</span>
                <span className="font-bold font-mono">
                  ${mcForecast.targetTP.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-[9px]">(+{mcForecast.expectedGainPct.toFixed(2)}%)</span>
                </span>
              </div>

              <div className="flex justify-between text-[#f23645]">
                <span>STOP LOSS (P25):</span>
                <span className="font-bold font-mono">
                  ${mcForecast.targetSL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-[9px]">(-{mcForecast.riskLossPct.toFixed(2)}%)</span>
                </span>
              </div>

              <div className="flex justify-between pt-1 border-t border-[#1b2232] text-[9px]">
                <span className="text-[#64748b]">R:R RATIO:</span>
                <span className="text-[#06b6d4] font-bold">{mcForecast.riskRewardRatio.toFixed(2)} : 1</span>
                <span className="text-[#64748b]">WIN PROB:</span>
                <span className="text-[#089981] font-bold">{(mcForecast.winProbability * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
