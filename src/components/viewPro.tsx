import { useRef, useEffect, useState, useCallback, useMemo } from "react";


// ─── Types (mirror your existing ../types OHLCV) ─────────────────────────────
export interface OHLCV {
  time: number;   // Unix ms timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface Trade {
  id: string;
  user_id?: string;
  bot_id?: string | null;
  pair: string;
  side: "BUY" | "SELL";
  price: number;
  amount: number;
  total: number;
  fee: number;
  pnl: number;
  status: "FILLED" | "PENDING" | "CANCELLED";
  created_at?: number;
  timestamp?: number;
}
export interface ProTradingChartProps {
  /** Live candle array — same shape as your existing OHLCV feed */
  candles: OHLCV[];
  trades: Trade[];
  /** Symbol label shown in header, e.g. "BTC/USDT" */
  symbol?: string;
  /** Market type badge, e.g. "SPOT" | "PERP" */
  marketType?: string;
  /** Active timeframe label (display only — parent controls switching) */
  timeframe?: string;
  /** Called when user clicks a timeframe button */
  onTimeframeChange?: (tf: string) => void;
  /** Available timeframe options */
  timeframes?: string[];
  /** Height of the chart area in px (default 540) */
  height?: number;
}

// ─── Internal types ──────────────────────────────────────────────────────────
interface OrderBookEntry { price: number; size: number }
interface OrderBook { asks: OrderBookEntry[]; bids: OrderBookEntry[] }
interface HoveredCandle { candle: OHLCV; ci: number }
interface Crosshair { x: number; y: number; price: number; time?: number }
interface Dims { w: number; h: number }
interface BB { upper: number; mid: number; lower: number }
interface MACDData { macdLine: number[]; signal: number[]; hist: number[] }

type ChartType = "candles" | "line";
type IndicatorId = "ema20" | "ema50" | "ema200" | "bb" | "volume" | "rsi" | "macd";

interface IndicatorDef { id: IndicatorId; label: string; color: string }

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"];

const INDICATOR_DEFS: IndicatorDef[] = [
  { id: "ema20", label: "EMA 20", color: "#f0a500" },
  { id: "ema50", label: "EMA 50", color: "#4da6ff" },
  { id: "ema200", label: "EMA 200", color: "#b06aff" },
  { id: "bb", label: "Bollinger", color: "#00d084" },
  { id: "volume", label: "Volume", color: "#4a5a7a" },
  { id: "rsi", label: "RSI", color: "#ff6b6b" },
  { id: "macd", label: "MACD", color: "#ffd700" },
];

const PAD = { l: 8, r: 80, t: 8, b: 24 } as const;
const SUB_H = 80;
const SUB_GAP = 6;
const CANDLE_GAP = 2;
const GRID_LINES = 6;
const GREEN = "#00e676";
const RED = "#ff4c6a";

// ─── Math helpers ─────────────────────────────────────────────────────────────
function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let e = values[0];
  return values.map((v, i) => { if (i === 0) return e; e = v * k + e * (1 - k); return e; });
}

function calcBB(values: number[], period = 20, mult = 2): (BB | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const sl = values.slice(i - period + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return { upper: mean + mult * std, mid: mean, lower: mean - mult * std };
  });
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    const sl = closes.slice(i - period, i + 1);
    let gains = 0, losses = 0;
    for (let j = 1; j < sl.length; j++) {
      const d = sl[j] - sl[j - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    out[i] = 100 - 100 / (1 + gains / (losses || 1e-9));
  }
  return out;
}
function calcMACD(closes: number[]): MACDData {
  const e12 = calcEMA(closes, 12);
  const e26 = calcEMA(closes, 26);
  const line = closes.map((_, i) => e12[i] - e26[i]);
  const sig = calcEMA(line, 9);
  return { macdLine: line, signal: sig, hist: line.map((v, i) => v - sig[i]) };
}

// ─── Format helpers ───────────────────────────────────────────────────────────
const fPrice = (v?: number | null, d = 2): string => {
  if (v == null) return "--";
  if (v < 0.01) return v.toFixed(6);
  if (v < 1) return v.toFixed(4);
  if (v < 10000) return v.toFixed(2);
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
};
const f2 = (v?: number | null, d = 2): string => v != null ? v.toFixed(d) : "--";
const fVol = (v: number): string =>
  v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : v.toFixed(0);
const fTime = (ms: number, tf: string): string => {
  const d = new Date(ms);
  if (tf === "1D") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};

// ─── Mock order-book (swap for your real WS feed) ────────────────────────────
function mockOrderBook(mid: number): OrderBook {
  return {
    asks: Array.from({ length: 12 }, (_, i) => ({
      price: +(mid + (i + 1) * 4 + Math.random() * 2).toFixed(2),
      size: +(0.05 + Math.random() * 2.5).toFixed(3),
    })),
    bids: Array.from({ length: 12 }, (_, i) => ({
      price: +(mid - (i + 1) * 4 - Math.random() * 2).toFixed(2),
      size: +(0.05 + Math.random() * 2.5).toFixed(3),
    })),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════════
export default function ProTradingChart({
  candles,
  trades,
  symbol = "BTC/USDT",
  marketType = "SPOT",
  timeframe = "1H",
  onTimeframeChange,
  timeframes = DEFAULT_TIMEFRAMES,
  height = 240,
}: ProTradingChartProps): JSX.Element {

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCandlesRef = useRef<OHLCV[]>([]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [chartType, setChartType] = useState<ChartType>("candles");
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorId>>(new Set(["ema20", "ema50", "volume"]));
  const [showIndicatorsPanel, setShowIndicatorsPanel] = useState(false);
  const [showOrderBook, setShowOrderBook] = useState(true);
  const [orderBook, setOrderBook] = useState<OrderBook>(() =>
    mockOrderBook(candles[candles.length - 1]?.close ?? 3000)
  );

  // ── Chart-navigation state ──────────────────────────────────────────────────
  const [offset, setOffset] = useState(0);
  const [candleW, setCandleW] = useState(10);
  const [hovered, setHovered] = useState<HoveredCandle | null>(null);
  const [crosshair, setCrosshair] = useState<Crosshair | null>(null);
  const [dims, setDims] = useState<Dims>({ w: 900, h: height });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const dragStartOff = useRef(0);

  // Sync height prop
  useEffect(() => setDims(d => ({ ...d, h: height })), [height]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) =>
      setDims({ w: e.contentRect.width, h: Math.max(380, e.contentRect.height) })
    );
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  // --- REMOVE THE MERGING LOGIC HERE ---
  // Simply use the 'candles' passed from props
  const lastClose = candles[candles.length - 1]?.close;

  // Keep visual-only effects
  const prevLen = useRef(candles.length);
  useEffect(() => {
    // Auto-scroll to newest when a new candle is added
    if (candles.length > prevLen.current) {
      setOffset(o => (o <= 5 ? 0 : o));
    }
    prevLen.current = candles.length;
  }, [candles.length]);

  // Keep mock order-book updates if they depend on the price
  useEffect(() => {
    if (lastClose != null) setOrderBook(mockOrderBook(lastClose));
  }, [lastClose]);


  // ── Derived geometry ─────────────────────────────────────────────────────────
  const hasRSI = activeIndicators.has("rsi");
  const hasMACD = activeIndicators.has("macd");
  const subCount = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0);
  const mainH = Math.max(80, dims.h - PAD.t - PAD.b - subCount * (SUB_H + SUB_GAP));
  const W = dims.w - PAD.l - PAD.r;

  const visibleCount = Math.max(1, Math.floor(W / (candleW + CANDLE_GAP)));
  const sliceEnd = Math.min(candles.length, Math.max(visibleCount, candles.length - offset));
  const sliceStart = Math.max(0, sliceEnd - visibleCount);
  const slice = candles.slice(sliceStart, sliceEnd);

  const minP = useMemo(() => (slice.length ? Math.min(...slice.map(c => c.low)) : 0), [slice]);
  const maxP = useMemo(() => (slice.length ? Math.max(...slice.map(c => c.high)) : 1), [slice]);
  const range = maxP - minP || 1;

  const hi24 = useMemo(() => (candles.length ? Math.max(...candles.slice(-288).map(c => c.high)) : 0), [candles]);
  const lo24 = useMemo(() => (candles.length ? Math.min(...candles.slice(-288).map(c => c.low)) : 0), [candles]);
  const vol24 = useMemo(() => candles.slice(-288).reduce((a, c) => a + c.volume, 0), [candles]);

  const toY = useCallback((v: number): number => PAD.t + mainH - ((v - minP) / range) * mainH, [mainH, minP, range]);
  const toX = useCallback((i: number): number => PAD.l + i * (candleW + CANDLE_GAP) + candleW / 2, [candleW]);

  // ── Indicator data ────────────────────────────────────────────────────────────
  const closes = useMemo(() => slice.map(c => c.close), [slice]);
  const ema20v = useMemo(() => calcEMA(closes, 20), [closes]);
  const ema50v = useMemo(() => calcEMA(closes, 50), [closes]);
  const ema200v = useMemo(() => calcEMA(closes, 200), [closes]);
  const bbv = useMemo(() => calcBB(closes), [closes]);
  const rsiV = useMemo(() => calcRSI(closes), [closes]);
  const macdV = useMemo(() => calcMACD(closes), [closes]);
  const maxVol = useMemo(() => (slice.length ? Math.max(...slice.map(c => c.volume)) : 1), [slice]);

  // ── Price info ────────────────────────────────────────────────────────────────
  const lastCandle = candles[candles.length - 1] as OHLCV | undefined;
  const prevCandle = candles[candles.length - 2] as OHLCV | undefined;
  const priceDelta = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const pricePct = prevCandle ? (priceDelta / prevCandle.close) * 100 : 0;
  const isBull = priceDelta >= 0;

  const gridPrices = useMemo(
    () => Array.from({ length: GRID_LINES }, (_, i) => minP + (i / (GRID_LINES - 1)) * range),
    [minP, range]
  );

  // Best bid/ask from order book
  const bestAsk = orderBook.asks[orderBook.asks.length - 1]?.price ?? 0;
  const bestBid = orderBook.bids[0]?.price ?? 0;
  const spread = bestAsk - bestBid;
  // Sub-panel positions
  const rsiPanelY = PAD.t + mainH + PAD.b + 6;
  const macdPanelY = rsiPanelY + (hasRSI ? SUB_H + SUB_GAP : 0);
  const totalH = macdPanelY + (hasMACD ? SUB_H : 0) + PAD.b;

  // ── Wheel zoom/pan ────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      setCandleW(w => Math.min(40, Math.max(3, w * (e.deltaY > 0 ? 0.9 : 1.1))));
    } else {
      // Pan
      setOffset(o => Math.max(0, Math.min(
        candles.length - visibleCount,
        o + Math.sign(e.deltaY) * Math.max(1, Math.ceil(visibleCount * 0.12))
      )));
    }
  }, [candles.length, visibleCount]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Touch events for mobile pinch/pan ─────────────────────────────────────
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchX = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      lastTouchX.current = e.touches[0].clientX;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / lastTouchDist.current;
      setCandleW(w => Math.min(40, Math.max(3, w * ratio)));
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && lastTouchX.current !== null) {
      const delta = e.touches[0].clientX - lastTouchX.current;
      const step = Math.round(delta / (candleW + CANDLE_GAP));
      if (step !== 0) {
        setOffset(o => Math.max(0, Math.min(candles.length - visibleCount, o - step)));
        lastTouchX.current = e.touches[0].clientX;
      }
    }
  }, [candleW, candles.length, visibleCount]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDist.current = null;
    lastTouchX.current = null;
  }, []);


  // ── Mouse events ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging && dragStartX.current !== null) {
      const delta = mx - dragStartX.current;
      const step = Math.round(delta / (candleW + CANDLE_GAP));
      if (step !== 0) {
        setOffset(Math.max(0, Math.min(candles.length - visibleCount, dragStartOff.current - step)));
      }
    }

    const price = minP + ((PAD.t + mainH - my) / mainH) * range;
    const ci = Math.floor((mx - PAD.l) / (candleW + CANDLE_GAP));
    const candle = slice[ci];
    if (my >= PAD.t && my <= PAD.t + mainH) {
      setCrosshair({ x: mx, y: my, price, time: candle?.time });
      setHovered(candle ? { candle, ci } : null);
    } else {
      setCrosshair(null);
      setHovered(null);
    }
  }, [isDragging, candleW, slice, minP, range, mainH, candles.length, visibleCount]);

  const toggleIndicator = (id: IndicatorId): void =>
    setActiveIndicators(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace",
      background: "#070b11", color: "#c5d4e8",
      display: "flex", flexDirection: "column",
      width: "100%", height: "100%", minHeight: height,
      border: "1px solid #0d1c2e",
      borderRadius: 10,
      userSelect: "none", overflow: "hidden",
    }}>

      {/* ════ TOP BAR ══════════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "7px 12px",
        borderBottom: "1px solid #0d1c2e", background: "#07111c",
        flexWrap: "wrap", flexShrink: 0,
      }}>

        {/* Symbol + live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: GREEN,
            boxShadow: `0 0 6px ${GREEN}`, animation: "ptcPulse 2s infinite",
          }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#e8f3ff", letterSpacing: 0.5 }}>{symbol}</span>
          <span style={{ fontSize: 9, color: "#1e3a55", background: "#0a1828", padding: "1px 6px", borderRadius: 3, letterSpacing: 1 }}>
            {marketType}
          </span>
        </div>

        {/* Live price */}
        {lastCandle && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>

            <span style={{ fontSize: 21, fontWeight: 800, color: isBull ? GREEN : RED, transition: "color 0.25s" }}>
              {fPrice(lastCandle.close)}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: isBull ? GREEN : RED,
              background: isBull ? "#00e67614" : "#ff4c6a14",
              padding: "2px 7px", borderRadius: 4,
            }}>
              {isBull ? "+" : ""}{f2(pricePct)}%
            </span>
            <span style={{ fontSize: 10, color: "#2a4060" }}>
              {isBull ? "▲" : "▼"} {f2(Math.abs(priceDelta))}
            </span>
          </div>
        )}

        {/* Bid / Ask / Spread */}
        <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
          <span>BID <b style={{ color: GREEN }}>{fPrice(bestBid)}</b></span>
          <span>ASK <b style={{ color: RED }}>{fPrice(bestAsk)}</b></span>
          <span style={{ color: "#2e4a68" }}>SPR <b style={{ color: "#4a6080" }}>{fPrice(spread)}</b></span>
        </div>

        {/* 24H stats */}
        <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#2e4a68", flexWrap: "wrap" }}>
          <span>H&nbsp;<b style={{ color: GREEN }}>{fPrice(hi24)}</b></span>
          <span>L&nbsp;<b style={{ color: RED }}>{fPrice(lo24)}</b></span>
          <span>Vol&nbsp;<b style={{ color: "#6a8aaa" }}>{fVol(vol24)}</b></span>
          <span style={{ color: "#1a3050" }}>{candles.length} candles</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Timeframe selector */}
        <div style={{ display: "flex", gap: 2 }}>
          {timeframes.map(tf => (
            <button key={tf} onClick={() => onTimeframeChange?.(tf)} style={{
              padding: "4px 9px", fontSize: 10, fontFamily: "inherit",
              background: timeframe === tf ? "#112240" : "transparent",
              color: timeframe === tf ? "#4da6ff" : "#2a4060",
              border: `1px solid ${timeframe === tf ? "#1e4a7a" : "transparent"}`,
              borderRadius: 4, cursor: "pointer",
              fontWeight: timeframe === tf ? 700 : 400,
              // transition: "all 0.15s",
            }}>{tf}</button>
          ))}
        </div>

        {/* Chart type toggle */}
        <div style={{
          display: "flex", gap: 2, background: "#05090e",
          borderRadius: 5, padding: 2, border: "1px solid #0d1c2e",
        }}>
          {([["candles", "🕯 Candles"], ["line", "📈 Line"]] as [ChartType, string][]).map(([t, lbl]) => (
            <button key={t} onClick={() => setChartType(t)} style={{
              padding: "3px 10px", fontSize: 9.5, fontFamily: "inherit",
              background: chartType === t ? "#112240" : "transparent",
              color: chartType === t ? "#4da6ff" : "#2a4060",
              border: "none", borderRadius: 4, cursor: "pointer", //transition: "all 0.15s",
            }}>{lbl}</button>
          ))}
        </div>

        {/* Indicators */}
        <button onClick={() => setShowIndicatorsPanel(p => !p)} style={{
          padding: "4px 10px", fontSize: 10, fontFamily: "inherit",
          background: showIndicatorsPanel ? "#112240" : "transparent",
          color: showIndicatorsPanel ? "#4da6ff" : "#2a4060",
          border: "1px solid #0d1c2e", borderRadius: 4, cursor: "pointer",
        }}>⚙ Indicators</button>

        {/* Order Book */}
        <button onClick={() => setShowOrderBook(p => !p)} style={{
          padding: "4px 10px", fontSize: 10, fontFamily: "inherit",
          background: showOrderBook ? "#112240" : "transparent",
          color: showOrderBook ? "#4da6ff" : "#2a4060",
          border: "1px solid #0d1c2e", borderRadius: 4, cursor: "pointer",
        }}>
          {showOrderBook ? "▶ Book" : "▷ Book"}
        </button>
      </div>

      {/* ════ INDICATORS PANEL ═════════════════════════════════════════════ */}
      {showIndicatorsPanel && (
        <div style={{
          display: "flex", gap: 6, padding: "7px 12px", flexWrap: "wrap",
          background: "#04080f", borderBottom: "1px solid #0d1c2e", flexShrink: 0,
        }}>
          {INDICATOR_DEFS.map(ind => {
            const active = activeIndicators.has(ind.id);
            return (
              <button key={ind.id} onClick={() => toggleIndicator(ind.id)} style={{
                padding: "4px 11px", fontSize: 10, fontFamily: "inherit",
                background: active ? "#0c1e30" : "transparent",
                color: active ? ind.color : "#2a4060",
                border: `1px solid ${active ? ind.color + "66" : "#0d1c2e"}`,
                borderRadius: 4, cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: active ? ind.color : "#1a2a3a", display: "inline-block",
                }} />
                {ind.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ════ OHLCV INFO BAR ══════════════════════════════════════════════ */}
      <div style={{
        display: "flex", gap: 14, padding: "4px 12px", fontSize: 10,
        background: "#05090e", borderBottom: "1px solid #0a1828",
        minHeight: 24, flexShrink: 0, alignItems: "center",
        opacity: hovered ? 1 : 0.3, transition: "opacity 0.2s",
      }}>
        {hovered ? (
          <>
            <span style={{ color: "#2e4a68" }}>{fTime(hovered.candle.time, timeframe)}</span>
            <span>O&nbsp;<b style={{ color: "#c5d4e8" }}>{fPrice(hovered.candle.open)}</b></span>
            <span>H&nbsp;<b style={{ color: GREEN }}>{fPrice(hovered.candle.high)}</b></span>
            <span>L&nbsp;<b style={{ color: RED }}>{fPrice(hovered.candle.low)}</b></span>
            <span>C&nbsp;<b style={{ color: hovered.candle.close >= hovered.candle.open ? GREEN : RED }}>
              {fPrice(hovered.candle.close)}
            </b></span>
            <span style={{ color: "#2e4a68" }}>Vol&nbsp;<b style={{ color: "#6a8aaa" }}>{fVol(hovered.candle.volume)}</b></span>
            <span style={{ color: hovered.candle.close >= hovered.candle.open ? GREEN : RED }}>
              {hovered.candle.close >= hovered.candle.open ? "▲" : "▼"}&nbsp;
              {fPrice(Math.abs(hovered.candle.close - hovered.candle.open))}&nbsp;
              ({f2(Math.abs((hovered.candle.close - hovered.candle.open) / hovered.candle.open * 100))}%)
            </span>
          </>
        ) : (
          <span style={{ color: "#112030" }}>Hover over a candle for OHLCV details</span>
        )}
      </div>

      {/* ════ MAIN LAYOUT ══════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── SVG Chart ───────────────────────────────────────────────────── */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}>
          {candles.length === 0 ? (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", color: "#1a3050", gap: 10,
            }}>
              <span style={{ fontSize: 32 }}>⏳</span>
              <span style={{ fontSize: 12, letterSpacing: 2 }}>WAITING FOR DATA…</span>
            </div>
          ) : (
            <svg
              ref={svgRef}
              width={dims.w} height={"500"}
              viewBox={`0 0 ${dims.w} ${totalH}`}
              preserveAspectRatio="none"
              style={{ display: "block", cursor: isDragging ? "grabbing" : "crosshair", touchAction: "none" }}
              onMouseDown={e => {
                setIsDragging(true);
                const rect = svgRef.current?.getBoundingClientRect();
                dragStartX.current = e.clientX - (rect?.left ?? 0);
                dragStartOff.current = offset;
              }}
              onMouseMove={handleMouseMove}
              onMouseUp={() => { setIsDragging(false); dragStartX.current = null; }}
              onMouseLeave={() => { setIsDragging(false); setCrosshair(null); setHovered(null); dragStartX.current = null; }}            >
              <defs>
                <linearGradient id="ptcBullG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e676" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#00a855" stopOpacity={0.75} />
                </linearGradient>
                <linearGradient id="ptcBearG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff4c6a" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#cc2244" stopOpacity={0.75} />
                </linearGradient>
                <linearGradient id="ptcLineG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4da6ff" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4da6ff" stopOpacity={0} />
                </linearGradient>
                <clipPath id="ptcMain">
                  <rect x={PAD.l} y={PAD.t} width={W} height={mainH} />
                </clipPath>
              </defs>

              {/* BG */}
              <rect width={dims.w} height={dims.h} fill="#070b11" />

              {/* ── Horizontal grid + price labels ── */}
              {gridPrices.map((p, i) => {
                const y = toY(p);
                return (
                  <g key={i}>
                    <line x1={PAD.l} y1={y} x2={dims.w - PAD.r} y2={y}
                      stroke="#0b1828" strokeWidth={1} />
                    <text x={dims.w - PAD.r + 4} y={y + 3.5}
                      fontSize={9} fill="#2a4060" fontFamily="inherit" textAnchor="start">
                      {fPrice(p, 0)}
                    </text>
                  </g>
                );
              })}

              {/* ── 24H High / Low ── */}
              {([
                { v: hi24, fillColor: "#00e67628", labelColor: "#00e67688", tag: "24H H" },
                { v: lo24, fillColor: "#ff4c6a28", labelColor: "#ff4c6a88", tag: "24H L" },
              ] as { v: number; fillColor: string; labelColor: string; tag: string }[]).map(({ v, fillColor, labelColor, tag }) => {
                const y = toY(v);
                if (y < PAD.t - 2 || y > PAD.t + mainH + 2) return null;
                return (
                  <g key={tag}>
                    <line x1={PAD.l} y1={y} x2={dims.w - PAD.r} y2={y}
                      stroke={fillColor} strokeWidth={1} strokeDasharray="5,4" />
                    <text x={dims.w - PAD.r + 4} y={y - 2}
                      fontSize={8} fill={labelColor} fontFamily="inherit">
                      {tag} {fPrice(v, 0)}
                    </text>
                  </g>
                );
              })}

              {/* ── Best Bid / Ask lines ── */}
              {[
                { v: bestBid, col: GREEN + "66", tag: "BID" },
                { v: bestAsk, col: RED + "66", tag: "ASK" },
              ].map(({ v, col, tag }) => {
                const y = toY(v);
                if (!v || y < PAD.t - 2 || y > PAD.t + mainH + 2) return null;
                return (
                  <g key={tag}>
                    <line x1={PAD.l} y1={y} x2={dims.w - PAD.r} y2={y} stroke={col} strokeWidth={0.8} strokeDasharray="2,4" />
                    <text x={PAD.l + 4} y={y - 2} fontSize={8} fill={col} fontFamily="inherit">{tag}</text>
                  </g>
                );
              })}

              {/* ── Volume bars ── */}
              {activeIndicators.has("volume") && (
                <g clipPath="url(#ptcMain)">
                  {slice.map((c, i) => {
                    const x = toX(i);
                    const vh = (c.volume / maxVol) * (mainH * 0.16);
                    return (
                      <rect key={`v${i}`}
                        x={x - candleW / 2} y={PAD.t + mainH - vh}
                        width={candleW} height={vh}
                        fill={c.close >= c.open ? "#00e67616" : "#ff4c6a16"} />
                    );
                  })}
                </g>
              )}

              {/* ── Bollinger Bands ── */}
              {activeIndicators.has("bb") && (() => {
                const valid = bbv
                  .map((b, i) => b ? { ...b, i } : null)
                  .filter((b): b is BB & { i: number } => b !== null);
                if (valid.length < 2) return null;
                const path = (key: keyof BB) =>
                  valid.map((b, idx) => `${idx === 0 ? "M" : "L"} ${toX(b.i)} ${toY(b[key])}`).join(" ");
                return (
                  <g clipPath="url(#ptcMain)">
                    <path d={path("upper")} fill="none" stroke="#00d08440" strokeWidth={1} />
                    <path d={path("lower")} fill="none" stroke="#00d08440" strokeWidth={1} />
                    <path d={path("mid")} fill="none" stroke="#00d08460" strokeWidth={0.8} strokeDasharray="3,3" />
                  </g>
                );
              })()}

              {/* ── Line chart ── */}
              {chartType === "line" && (
                <g clipPath="url(#ptcMain)">
                  <path
                    d={slice.map((c, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(c.close)}`).join(" ")}
                    fill="none" stroke="#4da6ff" strokeWidth={2} />
                  <path
                    d={[
                      ...slice.map((c, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(c.close)}`),
                      `L ${toX(slice.length - 1)} ${PAD.t + mainH}`,
                      `L ${toX(0)} ${PAD.t + mainH} Z`,
                    ].join(" ")}
                    fill="url(#ptcLineG)" />
                </g>
              )}

              {/* ── Candlesticks ── */}
              {chartType === "candles" && (
                <g clipPath="url(#ptcMain)">
                  {slice.map((c, i) => {
                    const x = toX(i);
                    const candBull = c.close >= c.open;
                    const bTop = toY(Math.max(c.open, c.close));
                    const bBot = toY(Math.min(c.open, c.close));
                    const bH = Math.max(1.5, bBot - bTop);
                    const isHov = hovered?.ci === i;
                    return (
                      <g key={i} opacity={isHov ? 1 : 0.88}>
                        <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)}
                          stroke={candBull ? GREEN : RED} strokeWidth={isHov ? 1.5 : 0.9} />
                        <rect
                          x={x - candleW / 2} y={bTop}
                          width={Math.max(candleW, 1)} height={bH}
                          fill={candBull ? "url(#ptcBullG)" : "url(#ptcBearG)"} rx={1}
                          stroke={isHov ? (candBull ? GREEN : RED) : "none"}
                          strokeWidth={isHov ? 1.5 : 0}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
              {trades.map(t => {

                const y = toY(t.price)
                return (
                  <g key={t.id}>
                    <line x1={PAD.l} y1={y} x2={dims.w - PAD.r} y2={y}
                      stroke={t.side === "BUY" ? "#0ECB81" : "#F6465D"} strokeDasharray="4 4" />
                    <text x={dims.w - PAD.r + 4} y={y - 2} fill={t.side === "BUY" ? "#0ECB81" : "#F6465D"}
                      fontSize={8} fontFamily="inherit">
                      {t.side} {f2(t.price, 0)}
                    </text>
                  </g>
                )

              })}
              {/* ── EMA lines ── */}
              {activeIndicators.has("ema20") && (
                <path clipPath="url(#ptcMain)"
                  d={ema20v.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
                  fill="none" stroke="#f0a500" strokeWidth={1.3} opacity={0.85} />
              )}
              {activeIndicators.has("ema50") && (
                <path clipPath="url(#ptcMain)"
                  d={ema50v.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
                  fill="none" stroke="#4da6ff" strokeWidth={1.3} opacity={0.85} />
              )}
              {activeIndicators.has("ema200") && (
                <path clipPath="url(#ptcMain)"
                  d={ema200v.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
                  fill="none" stroke="#b06aff" strokeWidth={1.3} opacity={0.85} />
              )}

              {/* ── Live price line + right-axis ticker ── */}
              {lastCandle && (() => {
                const py = toY(lastCandle.close);
                if (py < PAD.t || py > PAD.t + mainH) return null;
                const col = isBull ? GREEN : RED;
                return (
                  <g>
                    <line x1={PAD.l} y1={py} x2={dims.w - PAD.r} y2={py}
                      stroke={col} strokeOpacity={0.4} strokeDasharray="4,3" strokeWidth={1} />
                    <rect x={dims.w - PAD.r} y={py - 9} width={PAD.r} height={18} fill={col} rx={3} />
                    <text x={dims.w - PAD.r + 5} y={py + 4.5}
                      fontSize={10} fontWeight={700} fill="#070b11" fontFamily="inherit">
                      {fPrice(lastCandle.close)}
                    </text>
                  </g>
                );
              })()}

              {/* ── Crosshair ── */}
              {crosshair && (
                <g>
                  <line x1={crosshair.x} y1={PAD.t} x2={crosshair.x} y2={PAD.t + mainH}
                    stroke="#4da6ff" strokeWidth={0.7} strokeDasharray="3,3" opacity={0.55} />
                  <line x1={PAD.l} y1={crosshair.y} x2={dims.w - PAD.r} y2={crosshair.y}
                    stroke="#4da6ff" strokeWidth={0.7} strokeDasharray="3,3" opacity={0.55} />
                  <rect x={dims.w - PAD.r} y={crosshair.y - 8} width={PAD.r} height={16}
                    fill="#0d2040" rx={2} style={{ transition: "y 0.2s linear" }} />
                  <text x={dims.w - PAD.r + 4} y={crosshair.y + 4}
                    fontSize={9} fill="#4da6ff" fontFamily="inherit">
                    {f2(crosshair.price)}
                  </text>
                  {crosshair.time != null && (
                    <>
                      <rect x={crosshair.x - 32} y={PAD.t + mainH} width={64} height={16}
                        fill="#0d2040" rx={2} />
                      <text x={crosshair.x} y={PAD.t + mainH + 11}
                        fontSize={9} fill="#4da6ff" fontFamily="inherit" textAnchor="middle">
                        {fTime(crosshair.time, timeframe)}
                      </text>
                    </>
                  )}
                </g>
              )}

              {/* ── Time axis ── */}
              {slice
                .filter((_, i) => i % Math.max(1, Math.floor(slice.length / 8)) === 0)
                .map((c, idx) => {
                  const ri = idx * Math.max(1, Math.floor(slice.length / 8));
                  return (
                    <text key={idx} x={toX(ri)} y={PAD.t + mainH + 15}
                      fontSize={9} fill="#1a3a55" fontFamily="inherit" textAnchor="middle">
                      {fTime(c.time, timeframe)}
                    </text>
                  );
                })}

              {/* ── Chart border ── */}
              <rect x={PAD.l} y={PAD.t} width={W} height={mainH}
                fill="none" stroke="#0d1c2e" strokeWidth={1} />

              {/* ── Indicator legend ── */}
              <g>
                {([
                  activeIndicators.has("ema20") && { label: "EMA20", color: "#f0a500" },
                  activeIndicators.has("ema50") && { label: "EMA50", color: "#4da6ff" },
                  activeIndicators.has("ema200") && { label: "EMA200", color: "#b06aff" },
                  activeIndicators.has("bb") && { label: "BB(20)", color: "#00d084" },
                ] as ({ label: string; color: string } | false)[])
                  .filter((x): x is { label: string; color: string } => Boolean(x))
                  .map((item, idx) => (
                    <g key={item.label} transform={`translate(${PAD.l + 6 + idx * 68},${PAD.t + 5})`}>
                      <line x1={0} y1={5} x2={12} y2={5} stroke={item.color} strokeWidth={1.4} />
                      <text x={15} y={9} fontSize={9} fill={item.color} fontFamily="inherit" opacity={0.8}>
                        {item.label}
                      </text>
                    </g>
                  ))}
              </g>

              {/* ════ RSI SUB-PANEL ════════════════════════════════════════ */}
              {hasRSI && (() => {
                const rsiToY = (v: number) => rsiPanelY + SUB_H - (v / 100) * SUB_H;
                return (
                  <g>
                    <rect x={PAD.l} y={rsiPanelY} width={W} height={SUB_H} fill="#04080f" />
                    <line x1={PAD.l} y1={rsiPanelY} x2={dims.w - PAD.r} y2={rsiPanelY} stroke="#0d1c2e" />
                    <text x={PAD.l + 5} y={rsiPanelY + 12}
                      fontSize={9} fill="#ff6b6b55" fontFamily="inherit">RSI 14</text>
                    {[30, 50, 70].map(lv => (
                      <g key={lv}>
                        <line x1={PAD.l} y1={rsiToY(lv)} x2={dims.w - PAD.r} y2={rsiToY(lv)}
                          stroke={lv === 50 ? "#0f1e30" : "#ff6b6b18"} strokeDasharray="3,3" />
                        <text x={dims.w - PAD.r + 4} y={rsiToY(lv) + 3}
                          fontSize={8} fill="#ff6b6b44" fontFamily="inherit">{lv}</text>
                      </g>
                    ))}
                    <path
                      d={rsiV
                        .map((v, i) =>
                          v == null ? null
                            : `${i === 0 || rsiV[i - 1] == null ? "M" : "L"} ${toX(i)} ${rsiToY(v as number)}`
                        )
                        .filter((s): s is string => s !== null)
                        .join(" ")}
                      fill="none" stroke="#ff6b6b" strokeWidth={1.5} />
                    {crosshair && (() => {
                      const ci2 = Math.floor((crosshair.x - PAD.l) / (candleW + CANDLE_GAP));
                      const rv = rsiV[ci2];
                      if (rv == null) return null;
                      const cy = rsiToY(rv as number);
                      return (
                        <g>
                          <circle cx={toX(ci2)} cy={cy} r={3} fill="#ff6b6b" />
                          <rect x={dims.w - PAD.r} y={cy - 8} width={PAD.r} height={16} fill="#190a0a" rx={2} />
                          <text x={dims.w - PAD.r + 4} y={cy + 4}
                            fontSize={9} fill="#ff6b6b" fontFamily="inherit">{f2(rv as number, 1)}</text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })()}



              {/* ════ MACD SUB-PANEL ═══════════════════════════════════════ */}
              {hasMACD && (() => {
                const validH = macdV.hist.filter((v): v is number => v != null);
                if (!validH.length) return null;
                const mMin = Math.min(...validH);
                const mMax = Math.max(...validH);
                const mRange = mMax - mMin || 1;
                const mToY = (v: number) => macdPanelY + SUB_H - ((v - mMin) / mRange) * SUB_H;
                const zeroY = mToY(0);
                return (
                  <g>
                    <rect x={PAD.l} y={macdPanelY} width={W} height={SUB_H} fill="#04080f" />
                    <line x1={PAD.l} y1={macdPanelY} x2={dims.w - PAD.r} y2={macdPanelY} stroke="#0d1c2e" />
                    <text x={PAD.l + 5} y={macdPanelY + 12}
                      fontSize={9} fill="#ffd70055" fontFamily="inherit">MACD 12·26·9</text>
                    <line x1={PAD.l} y1={zeroY} x2={dims.w - PAD.r} y2={zeroY} stroke="#0f1e30" />
                    {macdV.hist.map((v, i) => {
                      if (v == null) return null;
                      const x = toX(i);
                      const y1 = mToY(v);
                      return (
                        <rect key={i}
                          x={x - candleW / 2} y={Math.min(zeroY, y1)}
                          width={Math.max(candleW, 1)} height={Math.abs(zeroY - y1)}
                          fill={v >= 0 ? "#00e67625" : "#ff4c6a25"} />
                      );
                    })}
                    <path
                      d={macdV.macdLine.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${mToY(v)}`).join(" ")}
                      fill="none" stroke="#ffd700" strokeWidth={1.2} />
                    <path
                      d={macdV.signal.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${mToY(v)}`).join(" ")}
                      fill="none" stroke="#ff6b9d" strokeWidth={1.2} />
                    {crosshair && (() => {
                      const ci2 = Math.floor((crosshair.x - PAD.l) / (candleW + CANDLE_GAP));
                      const mv = macdV.macdLine[ci2];
                      if (mv == null) return null;
                      return (
                        <g>
                          <rect x={dims.w - PAD.r} y={mToY(mv) - 8} width={PAD.r} height={16} fill="#130e00" rx={2} />
                          <text x={dims.w - PAD.r + 4} y={mToY(mv) + 4}
                            fontSize={9} fill="#ffd700" fontFamily="inherit">{f2(mv, 4)}</text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })()}

            </svg>
          )}

          {/* Hint */}
          <div style={{
            position: "absolute", bottom: 4, left: 8, fontSize: 9,
            color: "#0d1e30", pointerEvents: "none", letterSpacing: 0.4,
          }}>
            Ctrl+Scroll = zoom · Scroll = pan · Drag = navigate
          </div>
        </div>

        {/* ════ ORDER BOOK ═══════════════════════════════════════════════ */}
        {showOrderBook && (
          <div style={{
            width: 172, background: "#050910",
            borderLeft: "1px solid #0a1828",
            display: "flex", flexDirection: "column",
            overflow: "hidden", flexShrink: 0,
          }}>
            <div style={{
              padding: "7px 10px", borderBottom: "1px solid #0a1828",
              fontSize: 9, fontWeight: 700, color: "#1e3a55", letterSpacing: 2,
              display: "flex", justifyContent: "space-between",
            }}>
              <span>ORDER BOOK</span>
              <span style={{ color: GREEN, opacity: 0.5, animation: "ptcPulse 2s infinite" }}>LIVE</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 10px", fontSize: 8, color: "#112030" }}>
              <span>PRICE</span><span>SIZE</span>
            </div>

            {/* Asks (reversed so lowest ask is nearest the spread) */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column-reverse" }}>
              {orderBook.asks.map((a, i) => {
                const maxSz = Math.max(...orderBook.asks.map(x => x.size));
                return (
                  <div key={i} style={{ position: "relative", display: "flex", justifyContent: "space-between", padding: "2px 10px", fontSize: 10 }}>
                    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, background: "#ff4c6a0c", width: `${(a.size / maxSz) * 100}%` }} />
                    <span style={{ color: RED, position: "relative", zIndex: 1 }}>{f2(a.price)}</span>
                    <span style={{ color: "#2e4a68", position: "relative", zIndex: 1 }}>{f2(a.size, 3)}</span>
                  </div>
                );
              })}
            </div>

            {/* Mid price */}
            <div style={{
              padding: "6px 10px", background: "#06101c",
              borderTop: "1px solid #0a1828", borderBottom: "1px solid #0a1828",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: isBull ? GREEN : RED }}>
                {lastCandle ? f2(lastCandle.close) : "--"}
              </span>
              <span style={{ fontSize: 9, color: isBull ? GREEN : RED, opacity: 0.6 }}>
                {isBull ? "▲" : "▼"}
              </span>
            </div>

            {/* Spread + mid price */}
            <div style={{ padding: "5px 10px", background: "#06101c", borderTop: "1px solid #0a1828", borderBottom: "1px solid #0a1828" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: isBull ? GREEN : RED }}>
                  {lastCandle ? fPrice(lastCandle.close) : "--"}
                </span>
                <span style={{ fontSize: 9, color: isBull ? GREEN : RED, opacity: 0.6 }}>{isBull ? "▲" : "▼"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8 }}>
                <span style={{ color: GREEN + "99" }}>B {fPrice(bestBid)}</span>
                <span style={{ color: "#2a4060" }}>SPR {fPrice(spread)}</span>
                <span style={{ color: RED + "99" }}>A {fPrice(bestAsk)}</span>
              </div>
            </div>

            {/* Bids */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {orderBook.bids.map((b, i) => {
                const maxSz = Math.max(...orderBook.bids.map(x => x.size));
                return (
                  <div key={i} style={{ position: "relative", display: "flex", justifyContent: "space-between", padding: "2px 10px", fontSize: 10 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: "#00e6760c", width: `${(b.size / maxSz) * 100}%` }} />
                    <span style={{ color: GREEN, position: "relative", zIndex: 1 }}>{fPrice(b.price)}</span>
                    <span style={{ color: "#2e4a68", position: "relative", zIndex: 1 }}>{f2(b.size, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes @keyframes ptcPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #04080f; }
        ::-webkit-scrollbar-thumb { background: #0d1c2e; border-radius: 2px; }
      `}</style>
    </div>
  );
}