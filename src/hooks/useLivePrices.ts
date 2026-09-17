import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllLivePrices } from '../ingestion/live_prices';

const REFRESH_INTERVAL_MS = 30_000; // refresh every 30 seconds

export interface LivePriceState {
  /** symbol → live price. Falls back to referencePrice if not present. */
  prices:       Map<string, number>;
  isLoading:    boolean;
  /** null until first successful fetch */
  lastUpdated:  Date | null;
  /** true if the most recent fetch failed entirely */
  hasError:     boolean;
  /** manually trigger an immediate refresh */
  refresh:      () => void;
}

/**
 * useLivePrices
 * ─────────────
 * Fetches live market prices for ALL instruments in the directory on mount,
 * then auto-refreshes every 30 seconds.
 *
 * Sources:
 *  - Crypto  → Binance REST  (api.binance.com, CORS-enabled)
 *  - Equities / FX / Indices / Commodities → Yahoo Finance (via Vite /api/yf proxy)
 *
 * Usage:
 *   const { prices, isLoading, lastUpdated } = useLivePrices();
 *   const livePrice = prices.get('AAPL') ?? instrument.referencePrice;
 */
export function useLivePrices(): LivePriceState {
  const [prices, setPrices]           = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasError, setHasError]       = useState(false);
  const isMounted                     = useRef(true);

  const fetchPrices = useCallback(async () => {
    setIsLoading(true);
    try {
      const newPrices = await fetchAllLivePrices();
      if (!isMounted.current) return;
      if (newPrices.size > 0) {
        setPrices(newPrices);
        setLastUpdated(new Date());
        setHasError(false);
      } else {
        // Empty map = all fetches failed
        setHasError(true);
      }
    } catch {
      if (isMounted.current) setHasError(true);
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchPrices();
    const timer = setInterval(fetchPrices, REFRESH_INTERVAL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(timer);
    };
  }, [fetchPrices]);

  return { prices, isLoading, lastUpdated, hasError, refresh: fetchPrices };
}
