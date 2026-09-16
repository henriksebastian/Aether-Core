import { Candle, Timeframe } from '../components/CandlestickChart';

export interface Binance24hTicker {
  symbol: string;
  highPrice: number;
  lowPrice: number;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
}

export interface BinanceFundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  countdownFormatted: string;
}

/**
 * Formats quote asset volume into institutional B / M / K USD strings.
 */
export function formatVolumeUSD(quoteVolume: number): string {
  if (!quoteVolume || isNaN(quoteVolume)) return '$0.00';
  if (quoteVolume >= 1_000_000_000) {
    return `$${(quoteVolume / 1_000_000_000).toFixed(2)}B`;
  }
  if (quoteVolume >= 1_000_000) {
    return `$${(quoteVolume / 1_000_000).toFixed(2)}M`;
  }
  if (quoteVolume >= 1_000) {
    return `$${(quoteVolume / 1_000).toFixed(2)}K`;
  }
  return `$${quoteVolume.toFixed(2)}`;
}

/**
 * Fetches real 24-hour rolling ticker stats from Binance Spot REST API.
 */
export async function fetchBinance24hTicker(symbol: string): Promise<Binance24hTicker | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      symbol: data.symbol,
      highPrice: parseFloat(data.highPrice) || 0,
      lowPrice: parseFloat(data.lowPrice) || 0,
      lastPrice: parseFloat(data.lastPrice) || 0,
      priceChange: parseFloat(data.priceChange) || 0,
      priceChangePercent: parseFloat(data.priceChangePercent) || 0,
      volume: parseFloat(data.volume) || 0,
      quoteVolume: parseFloat(data.quoteVolume) || 0,
    };
  } catch (err) {
    console.warn(`[BinanceREST] Failed to fetch 24h ticker for ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetches current perpetual futures funding rate and countdown from Binance Futures REST API.
 */
export async function fetchBinanceFundingRate(symbol: string): Promise<BinanceFundingRate | null> {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol.toUpperCase()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const fundingRate = parseFloat(data.lastFundingRate) || 0;
    const nextFundingTime = Number(data.nextFundingTime) || 0;

    const diffMs = Math.max(0, nextFundingTime - Date.now());
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const countdownFormatted = `${hours}h ${mins.toString().padStart(2, '0')}m`;

    return {
      symbol,
      fundingRate,
      nextFundingTime,
      countdownFormatted,
    };
  } catch (err) {
    console.warn(`[BinanceREST] Failed to fetch funding rate for ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetches authentic historical OHLCV klines from Binance Spot REST API.
 * For unsupported Binance intervals like '5s', aggregates 1s klines into 5s candle bars.
 */
export async function fetchBinanceHistoricalKlines(
  symbol: string,
  timeframe: Timeframe,
  limit: number = 80
): Promise<Candle[]> {
  try {
    if (timeframe === '5s') {
      // 5s requires rolling up 1s klines (up to 400 1s bars to get ~80 5s bars)
      const fetchCount = Math.min(limit * 5, 500);
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=1s&limit=${fetchCount}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error('Expected array of klines');

      const buckets = new Map<number, Candle>();
      for (const k of raw) {
        const time = Number(k[0]);
        const bTime = Math.floor(time / 5000) * 5000;
        const open = parseFloat(k[1]);
        const high = parseFloat(k[2]);
        const low = parseFloat(k[3]);
        const close = parseFloat(k[4]);
        const volume = parseFloat(k[5]) || 0;
        const buyVolume = parseFloat(k[9]) || volume * 0.5;

        if (!buckets.has(bTime)) {
          buckets.set(bTime, {
            time: bTime,
            open,
            high,
            low,
            close,
            volume: Math.round(volume * 1000) / 1000,
            buyVolume: Math.round(buyVolume * 1000) / 1000,
            sellVolume: Math.max(0, Math.round((volume - buyVolume) * 1000) / 1000),
          });
        } else {
          const b = buckets.get(bTime)!;
          b.high = Math.max(b.high, high);
          b.low = Math.min(b.low, low);
          b.close = close;
          b.volume = Math.round((b.volume + volume) * 1000) / 1000;
          b.buyVolume = Math.round((b.buyVolume + buyVolume) * 1000) / 1000;
          b.sellVolume = Math.max(0, Math.round((b.volume - b.buyVolume) * 1000) / 1000);
        }
      }
      return Array.from(buckets.values()).slice(-limit);
    }

    const intervalMap: Record<Timeframe, string> = {
      '1s': '1s',
      '5s': '1s',
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '1D': '1d',
    };

    const binanceInterval = intervalMap[timeframe] || '1m';
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${binanceInterval}&limit=${limit}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error('Expected array of klines');

    return raw.map((k: any) => {
      const volume = parseFloat(k[5]) || 0;
      const buyVolume = parseFloat(k[9]) || volume * 0.5;
      return {
        time: Number(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: Math.round(volume * 1000) / 1000,
        buyVolume: Math.round(buyVolume * 1000) / 1000,
        sellVolume: Math.max(0, Math.round((volume - buyVolume) * 1000) / 1000),
      };
    });
  } catch (err) {
    console.warn(`[BinanceREST] Failed to fetch klines for ${symbol} (${timeframe}):`, err);
    return [];
  }
}
