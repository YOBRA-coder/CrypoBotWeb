import { useState, useEffect, useRef } from "react";
import { marketApi } from "../api/client";

export interface OHLCV {
  time: number;   // Unix ms timestamp — MUST be unique per candle
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Merges two candle arrays by timestamp.
 * - Existing candles with the same `time` as an incoming candle are replaced
 *   (live update of the forming candle).
 * - New candles are appended in order.
 * - Result is always sorted ascending by time, capped at `maxLen`.
 */
export function mergeCandles(
  existing: OHLCV[],
  incoming: OHLCV[],
  maxLen = 500
): OHLCV[] {
  if (!incoming.length) return existing;

  // Build a map from the existing set
  const map = new Map<number, OHLCV>(existing.map(c => [c.time, c]));

  // Upsert every incoming candle
  for (const c of incoming) map.set(c.time, c);

  // Re-sort and cap
  return Array.from(map.values())
    .sort((a, b) => a.time - b.time)
    .slice(-maxLen);
}

interface UseLiveCandlesOptions {
  /** Fetch function: returns OHLCV array for given symbol + interval + limit */
  fetchKlines: (symbol: string, interval: string, limit: number) => Promise<OHLCV[]>;
  symbol: string;
  interval: string;
  /** How many candles to load initially (default 150) */
  initialLimit?: number;
  /** How often to poll for updates in ms (default 15000) */
  pollMs?: number;
  /** How many candles to fetch on each poll (default 5) */
  pollLimit?: number;
  /** Max candles to keep in memory (default 500) */
  maxLen?: number;
}

interface UseLiveCandlesResult {
  candles: OHLCV[];
  loading: boolean;
  error: string | null;
}

/**
 * Drop-in replacement for the inline useEffect pattern.
 *
 * Usage:
 *   const { candles, loading } = useLiveCandles({
 *     fetchKlines: (sym, iv, lim) => marketApi.klines(sym, iv, lim),
 *     symbol: sel,
 *     interval: iv,
 *   });
 */
export function useLiveCandles({
  fetchKlines,
  symbol,
  interval,
  initialLimit = 150,
  pollMs       = 15_000,   // 15s — tighter than 30s so the forming candle updates visibly
  pollLimit    = 3,        // only fetch the last 3 candles on each tick
  maxLen       = 500,
}: UseLiveCandlesOptions): UseLiveCandlesResult {

  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState<string | null>(null);

  // Keep a stable ref to the latest candles so the poll closure never goes stale
  const candlesRef = useRef<OHLCV[]>([]);
  useEffect(() => { candlesRef.current = candles; }, [candles]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setCandles([]);
      candlesRef.current = [];
      try {
        const initial = await marketApi.klines(symbol, interval, initialLimit);
        if (!alive) return;
        const sorted = [...initial].sort((a, b) => a.time - b.time);
        setCandles(sorted);
        candlesRef.current = sorted;
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load candles");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    // Poll: merge incoming updates by timestamp — no duplicates, no gaps
    const id = setInterval(async () => {
      if (!alive) return;
      try {
        const fresh = await fetchKlines(symbol, interval, pollLimit);
        if (!alive || !fresh.length) return;
        setCandles(prev => mergeCandles(prev, fresh, maxLen));
      } catch {
        // Silent — don't thrash the error state on transient poll failures
      }
    }, pollMs);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symbol, interval, fetchKlines, initialLimit, pollMs, pollLimit, maxLen]);

  return { candles, loading, error };
}