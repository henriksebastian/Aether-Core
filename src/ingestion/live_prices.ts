/**
 * AETHER-CORE Live Price Feed
 * ───────────────────────────
 * - Crypto (BINANCE):    Binance REST /api/v3/ticker/price  — CORS-enabled, no proxy needed
 * - Equities, FX, Commodities, Indices: Yahoo Finance v7 quote API via Vite /api/yf proxy
 *
 * Yahoo Finance symbol mapping for instruments where the internal symbol differs
 * from the Yahoo Finance ticker (e.g. indices use ^ prefix, futures use =F suffix).
 */

/** Internal symbol → Yahoo Finance ticker. Crypto (isCrypto=true) is handled by Binance. */
export const YAHOO_SYMBOL_MAP: Record<string, string> = {
  // Global Indices
  'DAX':       '^GDAXI',
  'FTSE':      '^FTSE',
  'N225':      '^N225',

  // Commodities & Futures
  'GOLD':      'GC=F',
  'SILVER':    'SI=F',
  'WTI_OIL':  'CL=F',
  'BRENT':     'BZ=F',
  'NATGAS':    'NG=F',

  // FX Pairs
  'EURUSD':   'EURUSD=X',
  'GBPUSD':   'GBPUSD=X',
  'USDJPY':   'USDJPY=X',
  'AUDUSD':   'AUDUSD=X',

  // All other equity/index symbols (AAPL, MSFT, SHEL.L, etc.) pass through unchanged.
};

/**
 * Resolves the Yahoo Finance ticker for an internal AETHER symbol.
 * Returns null for crypto (handled by Binance instead).
 */
export function toYahooSymbol(internalSymbol: string): string | null {
  if (internalSymbol.endsWith('USDT')) return null;
  return YAHOO_SYMBOL_MAP[internalSymbol] ?? internalSymbol;
}

// ─── Yahoo Finance (equities, FX, indices, commodities) ──────────────────────

interface YahooQuoteResult {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  regularMarketChangePercent?: number;
}

/**
 * Fetches live quotes from Yahoo Finance for a batch of internal symbols.
 * Uses the Vite dev-server proxy at /api/yf → https://query1.finance.yahoo.com
 *
 * @returns Map of internal symbol → live price
 */
export async function fetchYahooPrices(
  internalSymbols: string[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (internalSymbols.length === 0) return priceMap;

  // Build the mapping: yahoo ticker → internal symbol
  const yahooToInternal = new Map<string, string>();
  for (const sym of internalSymbols) {
    const yahoo = toYahooSymbol(sym);
    if (yahoo) yahooToInternal.set(yahoo, sym);
  }

  if (yahooToInternal.size === 0) return priceMap;

  const symbolList = [...yahooToInternal.keys()].join(',');

  try {
    const url = `/api/yf/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=regularMarketPrice,regularMarketChangePercent`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[AETHER/YF] HTTP ${res.status} for ${symbolList.slice(0, 60)}`);
      return priceMap;
    }

    const data = await res.json();
    const quotes: YahooQuoteResult[] = data?.quoteResponse?.result ?? [];

    for (const q of quotes) {
      const price = q.regularMarketPrice;
      if (price != null && price > 0) {
        const internal = yahooToInternal.get(q.symbol);
        if (internal) priceMap.set(internal, price);
      }
    }

    if (priceMap.size > 0) {
      console.info(`[AETHER/YF] Fetched ${priceMap.size}/${internalSymbols.length} live prices`);
    }
  } catch (err) {
    console.warn('[AETHER/YF] Quote fetch failed:', err);
  }

  return priceMap;
}

// ─── Binance (crypto) ─────────────────────────────────────────────────────────

interface BinanceTickerPrice {
  symbol: string;
  price: string;
}

/**
 * Fetches current spot prices for a list of Binance symbols (e.g. BTCUSDT).
 * Binance API is CORS-enabled — no proxy needed.
 *
 * @returns Map of symbol → live price
 */
export async function fetchBinanceSpotPrices(
  symbols: string[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (symbols.length === 0) return priceMap;

  try {
    const symbolsJson = JSON.stringify(symbols);
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsJson)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!res.ok) {
      console.warn(`[AETHER/BN] HTTP ${res.status}`);
      return priceMap;
    }

    const data: BinanceTickerPrice[] = await res.json();
    for (const t of data) {
      const price = parseFloat(t.price);
      if (!isNaN(price) && price > 0) {
        priceMap.set(t.symbol, price);
      }
    }

    console.info(`[AETHER/BN] Fetched ${priceMap.size} crypto spot prices`);
  } catch (err) {
    console.warn('[AETHER/BN] Spot price fetch failed:', err);
  }

  return priceMap;
}

// ─── Unified Fetcher ──────────────────────────────────────────────────────────

import { MARKET_INSTRUMENTS } from '../data/market_directory';

/**
 * Fetches live prices for ALL instruments in the market directory.
 * - Crypto → Binance REST
 * - Everything else → Yahoo Finance (via Vite proxy)
 *
 * Falls back gracefully: missing prices simply won't appear in the returned map
 * (caller should then fall back to referencePrice).
 */
export async function fetchAllLivePrices(): Promise<Map<string, number>> {
  const cryptoSymbols  = MARKET_INSTRUMENTS.filter(i => i.isCrypto).map(i => i.symbol);
  const equitySymbols  = MARKET_INSTRUMENTS.filter(i => !i.isCrypto).map(i => i.symbol);

  const [cryptoPrices, equityPrices] = await Promise.allSettled([
    fetchBinanceSpotPrices(cryptoSymbols),
    fetchYahooPrices(equitySymbols),
  ]);

  const merged = new Map<string, number>();

  if (cryptoPrices.status === 'fulfilled') {
    cryptoPrices.value.forEach((p, s) => merged.set(s, p));
  }
  if (equityPrices.status === 'fulfilled') {
    equityPrices.value.forEach((p, s) => merged.set(s, p));
  }

  return merged;
}
