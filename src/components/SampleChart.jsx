import { useRef, useEffect, useState, useCallback } from "react";

// ─── Mock data generator ────────────────────────────────────────────────────
function generateCandles(count = 200, basePrice = 43250) {
  const candles = [];
  let price = basePrice;
  const now = Date.now();
  const intervalMs = 60000;
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.012;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * price * 0.006;
    const low = Math.min(open, close) - Math.random() * price * 0.006;
    const volume = 100 + Math.random() * 900;
    candles.push({
      time: now - i * intervalMs,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: +volume.toFixed(2),
    });
    price = close;
  }
  return candles;
}

function generateOrderBook(midPrice) {
  const asks = [], bids = [];
  for (let i = 0; i < 12; i++) {
    asks.push({ price: +(midPrice + (i + 1) * 5 + Math.random() * 3).toFixed(2), size: +(0.1 + Math.random() * 3).toFixed(3) });
    bids.push({ price: +(midPrice - (i + 1) * 5 - Math.random() * 3).toFixed(2), size: +(0.1 + Math.random() * 3).toFixed(3) });
  }
  return { asks, bids };
}

// ─── EMA ─────────────────────────────────────────────────────────────────────
function calcEMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  return values.map((v, i) => { if (i === 0) return ema; ema = v * k + ema * (1 - k); return ema; });
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────
function calcBB(values, period = 20, mult = 2) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    return { upper: mean + mult * std, mid: mean, lower: mean - mult * std };
  });
}

// ─── RSI ─────────────────────────────────────────────────────────────────────
function calcRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    const slice = closes.slice(i - period, i + 1);
    let gains = 0, losses = 0;
    for (let j = 1; j < slice.length; j++) {
      const d = slice[j] - slice[j - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    const rs = gains / (losses || 0.0001);
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

// ─── MACD ─────────────────────────────────────────────────────────────────────
function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = calcEMA(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signal[i]);
  return { macdLine, signal, hist };
}

// ─── Format helpers ──────────────────────────────────────────────────────────
const fmt = (v, d = 2) => v != null ? v.toFixed(d) : "--";
const fmtTime = (ts, tf) => {
  const d = new Date(ts);
  if (tf === "1D") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};
const fmtVol = v => v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : v.toFixed(0);

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"];
const INDICATORS = [
  { id: "ema20", label: "EMA 20", color: "#f0a500" },
  { id: "ema50", label: "EMA 50", color: "#4da6ff" },
  { id: "ema200", label: "EMA 200", color: "#b06aff" },
  { id: "bb", label: "Bollinger", color: "#00d084" },
  { id: "volume", label: "Volume", color: "#3a4a6a" },
  { id: "rsi", label: "RSI", color: "#ff6b6b" },
  { id: "macd", label: "MACD", color: "#ffd700" },
];

export default function ProTradingChart() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [candles, setCandles] = useState(() => generateCandles(300));
  const [tf, setTf] = useState("1H");
  const [chartType, setChartType] = useState("candles"); // candles | line
  const [activeIndicators, setActiveIndicators] = useState(new Set(["ema20", "ema50", "volume"]));
  const [showIndicatorsPanel, setShowIndicatorsPanel] = useState(false);
  const [showOrderBook, setShowOrderBook] = useState(true);
  const [orderBook, setOrderBook] = useState(() => generateOrderBook(43250));

  // Chart state
  const [offset, setOffset] = useState(0);   // candles scrolled from right
  const [candleW, setCandleW] = useState(10); // zoom = candle width
  const [hovered, setHovered] = useState(null); // {index, candle, x, y}
  const [crosshair, setCrosshair] = useState(null); // {x, y, price, time}
  const [dims, setDims] = useState({ w: 900, h: 520 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(null);

  const PAD = { l: 8, r: 72, t: 38, b: 32 };
  const hasRSI = activeIndicators.has("rsi");
  const hasMACD = activeIndicators.has("macd");
  const subPanels = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0);
  const subH = 80;
  const mainH = dims.h - PAD.t - PAD.b - subPanels * (subH + 4);
  const W = dims.w - PAD.l - PAD.r;

  // Observe size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: Math.max(400, e.contentRect.height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Live price tick
  useEffect(() => {
    const id = setInterval(() => {
      setCandles(prev => {
        const last = prev[prev.length - 1];
        const change = (Math.random() - 0.49) * last.close * 0.002;
        const newClose = +(last.close + change).toFixed(2);
        const updated = { ...last, close: newClose, high: Math.max(last.high, newClose), low: Math.min(last.low, newClose) };
        const next = [...prev.slice(0, -1), updated];
        // Every ~30s, new candle
        if (Math.random() < 0.03) {
          return [...next, { time: Date.now(), open: newClose, high: newClose, low: newClose, close: newClose, volume: Math.random() * 50 }];
        }
        return next;
      });
      setOrderBook(prev => generateOrderBook(candles[candles.length - 1]?.close || 43250));
    }, 800);
    return () => clearInterval(id);
  }, [candles]);

  const visibleCount = Math.floor(W / (candleW + 2));
  const start = Math.max(0, candles.length - visibleCount - offset);
  const end = Math.max(visibleCount, candles.length - offset);
  const slice = candles.slice(start, Math.min(end, candles.length));

  const minP = Math.min(...slice.map(c => c.low));
  const maxP = Math.max(...slice.map(c => c.high));
  const range = maxP - minP || 1;
  const priceH24 = Math.max(...candles.slice(-144).map(c => c.high));
  const priceLow24 = Math.min(...candles.slice(-144).map(c => c.low));

  const toY = v => PAD.t + mainH - ((v - minP) / range) * mainH;
  const toX = i => PAD.l + i * (candleW + 2) + candleW / 2;

  const closes = slice.map(c => c.close);
  const ema20v = calcEMA(closes, 20);
  const ema50v = calcEMA(closes, 50);
  const ema200v = calcEMA(closes, 200);
  const bbv = calcBB(closes);
  const rsiV = calcRSI(closes);
  const macdV = calcMACD(closes);
  const maxVol = Math.max(...slice.map(c => c.volume));

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const priceChange = lastCandle && prevCandle ? lastCandle.close - prevCandle.close : 0;
  const pricePct = prevCandle ? (priceChange / prevCandle.close) * 100 : 0;

  // Grid prices
  const gridLines = 6;
  const gridPrices = Array.from({ length: gridLines }, (_, i) => minP + (i / (gridLines - 1)) * range);

  // ── Mouse handlers ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(e => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging && dragX !== null) {
      const dx = mx - dragX;
      const step = Math.round(dx / (candleW + 2));
      if (step !== 0) {
        setOffset(o => Math.max(0, Math.min(candles.length - visibleCount, o - step)));
        setDragX(mx);
      }
    }

    const price = minP + ((PAD.t + mainH - my) / mainH) * range;
    const ci = Math.floor((mx - PAD.l) / (candleW + 2));
    const candle = slice[ci];
    setCrosshair({ x: mx, y: Math.min(my, PAD.t + mainH), price, time: candle?.time });
    setHovered(candle ? { candle, ci, x: toX(ci), y: my } : null);
  }, [isDragging, dragX, candleW, slice, minP, range, mainH, candles.length, visibleCount]);

  const handleWheel = useCallback(e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setCandleW(w => Math.min(30, Math.max(3, w - e.deltaY * 0.05)));
    } else {
      setOffset(o => Math.max(0, Math.min(candles.length - visibleCount, o + Math.sign(e.deltaY) * 3)));
    }
  }, [candles.length, visibleCount]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const toggleIndicator = id => {
    setActiveIndicators(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── RSI sub-panel ────────────────────────────────────────────────────────
  const rsiPanelY = PAD.t + mainH + PAD.b + 4;
  const macdPanelY = rsiPanelY + (hasRSI ? subH + 4 : 0);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      background: "#070b11",
      color: "#c5d4e8",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      userSelect: "none",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, padding: "8px 14px",
        borderBottom: "1px solid #0f1e32", background: "#080e18", flexWrap: "wrap",
      }}>
        {/* Symbol */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#e8f2ff", letterSpacing: 1 }}>BTC/USDT</span>
          <span style={{ fontSize: 10, color: "#2a3d55", background: "#0d1a2a", padding: "1px 6px", borderRadius: 3 }}>SPOT</span>
        </div>

        {/* Live price */}
        {lastCandle && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{
              fontSize: 22, fontWeight: 800,
              color: priceChange >= 0 ? "#00e676" : "#ff4c6a",
              transition: "color 0.3s"
            }}>
              {fmt(lastCandle.close, 2)}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: pricePct >= 0 ? "#00e676" : "#ff4c6a",
              background: pricePct >= 0 ? "#00e67618" : "#ff4c6a18",
              padding: "2px 6px", borderRadius: 4,
            }}>
              {pricePct >= 0 ? "+" : ""}{fmt(pricePct, 2)}%
            </span>
            <span style={{ fontSize: 10, color: "#2a4060" }}>
              {priceChange >= 0 ? "▲" : "▼"} {fmt(Math.abs(priceChange), 2)}
            </span>
          </div>
        )}

        {/* 24H stats */}
        <div style={{ display: "flex", gap: 14, fontSize: 10, color: "#3a5070" }}>
          <span>24H High <span style={{ color: "#00e676" }}>{fmt(priceH24)}</span></span>
          <span>24H Low <span style={{ color: "#ff4c6a" }}>{fmt(priceLow24)}</span></span>
          <span>Vol <span style={{ color: "#8899aa" }}>{fmtVol(slice.reduce((a, c) => a + c.volume, 0))}</span></span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Timeframes */}
        <div style={{ display: "flex", gap: 2 }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: "4px 8px", fontSize: 10, fontFamily: "inherit",
              background: tf === t ? "#1a3a5c" : "transparent",
              color: tf === t ? "#4da6ff" : "#2e4060",
              border: tf === t ? "1px solid #1e4a7a" : "1px solid transparent",
              borderRadius: 4, cursor: "pointer", fontWeight: tf === t ? 700 : 400,
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>

        {/* Chart type */}
        <div style={{ display: "flex", gap: 2 }}>
          {[["candles", "🕯"], ["line", "📈"]].map(([type, icon]) => (
            <button key={type} onClick={() => setChartType(type)} style={{
              padding: "4px 8px", fontSize: 11, fontFamily: "inherit",
              background: chartType === type ? "#1a3a5c" : "transparent",
              color: chartType === type ? "#4da6ff" : "#2e4060",
              border: chartType === type ? "1px solid #1e4a7a" : "1px solid transparent",
              borderRadius: 4, cursor: "pointer", transition: "all 0.15s",
            }}>{icon}</button>
          ))}
        </div>

        {/* Indicators toggle */}
        <button onClick={() => setShowIndicatorsPanel(p => !p)} style={{
          padding: "4px 10px", fontSize: 10, fontFamily: "inherit",
          background: showIndicatorsPanel ? "#1a3a5c" : "transparent",
          color: showIndicatorsPanel ? "#4da6ff" : "#2e4060",
          border: "1px solid #0f1e32", borderRadius: 4, cursor: "pointer",
        }}>Indicators ▾</button>

        {/* Orderbook toggle */}
        <button onClick={() => setShowOrderBook(p => !p)} style={{
          padding: "4px 10px", fontSize: 10, fontFamily: "inherit",
          background: showOrderBook ? "#1a3a5c" : "transparent",
          color: showOrderBook ? "#4da6ff" : "#2e4060",
          border: "1px solid #0f1e32", borderRadius: 4, cursor: "pointer",
        }}>Orderbook</button>
      </div>

      {/* ── Indicators Panel ── */}
      {showIndicatorsPanel && (
        <div style={{
          display: "flex", gap: 8, padding: "8px 14px", flexWrap: "wrap",
          background: "#05090f", borderBottom: "1px solid #0f1e32",
        }}>
          {INDICATORS.map(ind => (
            <button key={ind.id} onClick={() => toggleIndicator(ind.id)} style={{
              padding: "4px 10px", fontSize: 10, fontFamily: "inherit",
              background: activeIndicators.has(ind.id) ? "#0d1e30" : "transparent",
              color: activeIndicators.has(ind.id) ? ind.color : "#2e4060",
              border: `1px solid ${activeIndicators.has(ind.id) ? ind.color + "88" : "#0f1e32"}`,
              borderRadius: 4, cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: activeIndicators.has(ind.id) ? ind.color : "#1a2a3a", display: "inline-block" }} />
              {ind.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Hovered candle info bar ── */}
      {hovered && (
        <div style={{
          display: "flex", gap: 16, padding: "5px 14px", fontSize: 10,
          background: "#06101a", borderBottom: "1px solid #0a1828",
        }}>
          <span style={{ color: "#3a5070" }}>{fmtTime(hovered.candle.time, tf)}</span>
          <span>O <span style={{ color: "#c5d4e8" }}>{fmt(hovered.candle.open)}</span></span>
          <span>H <span style={{ color: "#00e676" }}>{fmt(hovered.candle.high)}</span></span>
          <span>L <span style={{ color: "#ff4c6a" }}>{fmt(hovered.candle.low)}</span></span>
          <span>C <span style={{ color: hovered.candle.close >= hovered.candle.open ? "#00e676" : "#ff4c6a" }}>{fmt(hovered.candle.close)}</span></span>
          <span style={{ color: "#3a5070" }}>Vol <span style={{ color: "#8899aa" }}>{fmtVol(hovered.candle.volume)}</span></span>
          <span style={{ color: hovered.candle.close >= hovered.candle.open ? "#00e67677" : "#ff4c6a77" }}>
            {hovered.candle.close >= hovered.candle.open ? "▲" : "▼"} {fmt(Math.abs(hovered.candle.close - hovered.candle.open))} ({fmt(Math.abs((hovered.candle.close - hovered.candle.open) / hovered.candle.open * 100), 2)}%)
          </span>
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Chart ── */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <svg ref={svgRef}
            width="100%" height={dims.h}
            style={{ display: "block", cursor: isDragging ? "grabbing" : "crosshair" }}
            onMouseDown={e => { setIsDragging(true); setDragX(e.clientX - svgRef.current.getBoundingClientRect().left); }}
            onMouseMove={handleMouseMove}
            onMouseUp={() => { setIsDragging(false); setDragX(null); }}
            onMouseLeave={() => { setIsDragging(false); setCrosshair(null); setHovered(null); }}
          >
            <defs>
              <linearGradient id="bullG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e676" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#00b856" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="bearG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff4c6a" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#cc2244" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4da6ff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#4da6ff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="chartArea">
                <rect x={PAD.l} y={PAD.t} width={W} height={mainH} />
              </clipPath>
            </defs>

            {/* Background */}
            <rect x={0} y={0} width={dims.w} height={dims.h} fill="#070b11" />

            {/* Grid horizontal */}
            {gridPrices.map((p, i) => {
              const y = toY(p);
              return (
                <g key={i}>
                  <line x1={PAD.l} y1={y} x2={dims.w - PAD.r} y2={y}
                    stroke="#0d1824" strokeWidth="1" />
                  <text x={dims.w - PAD.r + 4} y={y + 3.5}
                    fontSize="9" fill="#2e4a6a" fontFamily="inherit" textAnchor="start">
                    {fmt(p, 0)}
                  </text>
                </g>
              );
            })}

            {/* 24H high/low lines */}
            {[{ v: priceH24, color: "#00e67633", label: "24H H" },
              { v: priceLow24, color: "#ff4c6a33", label: "24H L" }].map(({ v, color, label }) => {
              const y = toY(v);
              if (y < PAD.t || y > PAD.t + mainH) return null;
              return (
                <g key={label}>
                  <line x1={PAD.l} y1={y} x2={dims.w - PAD.r} y2={y}
                    stroke={color} strokeWidth="1" strokeDasharray="4,4" />
                  <text x={dims.w - PAD.r + 4} y={y - 2} fontSize="8"
                    fill={label.includes("H") ? "#00e67699" : "#ff4c6a99"} fontFamily="inherit">
                    {label} {fmt(v, 0)}
                  </text>
                </g>
              );
            })}

            {/* ── Volume bars (behind candles) ── */}
            {activeIndicators.has("volume") && (
              <g clipPath="url(#chartArea)">
                {slice.map((c, i) => {
                  const bull = c.close >= c.open;
                  const x = toX(i);
                  const volH = (c.volume / maxVol) * (mainH * 0.18);
                  const barY = PAD.t + mainH - volH;
                  return (
                    <rect key={`vol${i}`} x={x - candleW / 2} y={barY} width={candleW} height={volH}
                      fill={bull ? "#00e67618" : "#ff4c6a18"} />
                  );
                })}
              </g>
            )}

            {/* ── Bollinger Bands ── */}
            {activeIndicators.has("bb") && (
              <g clipPath="url(#chartArea)">
                <path d={bbv.filter(Boolean).map((b, i) => `${i === 0 ? "M" : "L"} ${toX(bbv.findIndex((v, j) => j >= i && v))} ${toY(b.upper)}`).filter(Boolean).join(" ")}
                  fill="none" stroke="#00d08444" strokeWidth="1" />
                <path d={bbv.filter(Boolean).map((b, i) => `${i === 0 ? "M" : "L"} ${toX(bbv.indexOf(b))} ${toY(b.lower)}`).join(" ")}
                  fill="none" stroke="#00d08444" strokeWidth="1" />
                <path d={bbv.filter(Boolean).map((b, i) => `${i === 0 ? "M" : "L"} ${toX(bbv.indexOf(b))} ${toY(b.mid)}`).join(" ")}
                  fill="none" stroke="#00d08488" strokeWidth="0.8" strokeDasharray="3,3" />
              </g>
            )}

            {/* ── Line chart ── */}
            {chartType === "line" && (
              <g clipPath="url(#chartArea)">
                <path
                  d={slice.map((c, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(c.close)}`).join(" ")}
                  fill="none" stroke="#4da6ff" strokeWidth="2"
                />
                <path
                  d={[
                    ...slice.map((c, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(c.close)}`),
                    `L ${toX(slice.length - 1)} ${PAD.t + mainH}`,
                    `L ${toX(0)} ${PAD.t + mainH} Z`
                  ].join(" ")}
                  fill="url(#lineGrad)"
                />
              </g>
            )}

            {/* ── Candlesticks ── */}
            {chartType === "candles" && (
              <g clipPath="url(#chartArea)">
                {slice.map((c, i) => {
                  const x = toX(i);
                  const bull = c.close >= c.open;
                  const bTop = toY(Math.max(c.open, c.close));
                  const bBot = toY(Math.min(c.open, c.close));
                  const bH = Math.max(1.5, bBot - bTop);
                  const isHov = hovered?.ci === i;
                  return (
                    <g key={i} opacity={isHov ? 1 : 0.9}>
                      {/* Wick */}
                      <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)}
                        stroke={bull ? "#00e676" : "#ff4c6a"} strokeWidth={isHov ? 1.5 : 1} />
                      {/* Body */}
                      <rect x={x - candleW / 2} y={bTop} width={Math.max(candleW, 1)} height={bH}
                        fill={bull ? "url(#bullG)" : "url(#bearG)"} rx="1"
                        stroke={isHov ? (bull ? "#00e676" : "#ff4c6a") : "none"}
                        strokeWidth={isHov ? 1 : 0}
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* ── EMAs ── */}
            {activeIndicators.has("ema20") && (
              <path clipPath="url(#chartArea)"
                d={ema20v.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
                fill="none" stroke="#f0a500" strokeWidth="1.4" opacity="0.85" />
            )}
            {activeIndicators.has("ema50") && (
              <path clipPath="url(#chartArea)"
                d={ema50v.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
                fill="none" stroke="#4da6ff" strokeWidth="1.4" opacity="0.85" />
            )}
            {activeIndicators.has("ema200") && (
              <path clipPath="url(#chartArea)"
                d={ema200v.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ")}
                fill="none" stroke="#b06aff" strokeWidth="1.4" opacity="0.85" />
            )}

            {/* ── Last price line ── */}
            {lastCandle && (() => {
              const lp = lastCandle.close;
              const py = toY(lp);
              if (py < PAD.t || py > PAD.t + mainH) return null;
              const bull = priceChange >= 0;
              return (
                <g>
                  <line x1={PAD.l} y1={py} x2={dims.w - PAD.r} y2={py}
                    stroke={bull ? "#00e67666" : "#ff4c6a66"} strokeDasharray="4,3" strokeWidth="1" />
                  <rect x={dims.w - PAD.r} y={py - 9} width={PAD.r} height={18}
                    fill={bull ? "#00e676" : "#ff4c6a"} rx="3" />
                  <text x={dims.w - PAD.r + 4} y={py + 4} fontSize="10" fontWeight="700"
                    fill="#070b11" fontFamily="inherit">
                    {fmt(lp, 2)}
                  </text>
                </g>
              );
            })()}

            {/* ── Crosshair ── */}
            {crosshair && (
              <g opacity="0.6">
                <line x1={crosshair.x} y1={PAD.t} x2={crosshair.x} y2={PAD.t + mainH}
                  stroke="#4da6ff" strokeWidth="0.8" strokeDasharray="3,3" />
                <line x1={PAD.l} y1={crosshair.y} x2={dims.w - PAD.r} y2={crosshair.y}
                  stroke="#4da6ff" strokeWidth="0.8" strokeDasharray="3,3" />
                {/* Price label on right */}
                <rect x={dims.w - PAD.r} y={crosshair.y - 8} width={PAD.r} height={16}
                  fill="#1a3a5c" rx="2" />
                <text x={dims.w - PAD.r + 4} y={crosshair.y + 4} fontSize="9"
                  fill="#4da6ff" fontFamily="inherit">
                  {fmt(crosshair.price, 2)}
                </text>
                {/* Time label on bottom */}
                {crosshair.time && (
                  <>
                    <rect x={crosshair.x - 30} y={PAD.t + mainH} width={60} height={16} fill="#1a3a5c" rx="2" />
                    <text x={crosshair.x} y={PAD.t + mainH + 11} fontSize="9" fill="#4da6ff"
                      fontFamily="inherit" textAnchor="middle">{fmtTime(crosshair.time, tf)}</text>
                  </>
                )}
              </g>
            )}

            {/* ── Time axis labels ── */}
            {slice.filter((_, i) => i % Math.max(1, Math.floor(slice.length / 8)) === 0).map((c, idx) => {
              const realI = idx * Math.max(1, Math.floor(slice.length / 8));
              const x = toX(realI);
              return (
                <text key={idx} x={x} y={PAD.t + mainH + 14} fontSize="9"
                  fill="#1e3a55" fontFamily="inherit" textAnchor="middle">
                  {fmtTime(c.time, tf)}
                </text>
              );
            })}

            {/* ── RSI Sub-panel ── */}
            {hasRSI && (() => {
              const py0 = rsiPanelY;
              const rsiMin = 0, rsiMax = 100;
              const rsiToY = v => py0 + subH - ((v - rsiMin) / (rsiMax - rsiMin)) * subH;
              return (
                <g>
                  <rect x={PAD.l} y={py0} width={W} height={subH} fill="#04080f" />
                  <line x1={PAD.l} y1={py0} x2={dims.w - PAD.r} y2={py0} stroke="#0f1e32" />
                  <text x={PAD.l + 4} y={py0 + 11} fontSize="9" fill="#ff6b6b88" fontFamily="inherit">RSI(14)</text>
                  {[30, 50, 70].map(lv => (
                    <g key={lv}>
                      <line x1={PAD.l} y1={rsiToY(lv)} x2={dims.w - PAD.r} y2={rsiToY(lv)}
                        stroke={lv === 50 ? "#1a2a3a" : "#ff6b6b22"} strokeDasharray="3,3" />
                      <text x={dims.w - PAD.r + 4} y={rsiToY(lv) + 3} fontSize="8" fill="#ff6b6b44" fontFamily="inherit">{lv}</text>
                    </g>
                  ))}
                  <path clipPath="url(#chartArea)"
                    d={rsiV.map((v, i) => v == null ? null : `${i === 0 || rsiV[i - 1] == null ? "M" : "L"} ${toX(i)} ${rsiToY(v)}`).filter(Boolean).join(" ")}
                    fill="none" stroke="#ff6b6b" strokeWidth="1.5"
                  />
                  {crosshair && (() => {
                    const ci2 = Math.floor((crosshair.x - PAD.l) / (candleW + 2));
                    const rv = rsiV[ci2];
                    if (!rv) return null;
                    return (
                      <g>
                        <circle cx={toX(ci2)} cy={rsiToY(rv)} r="3" fill="#ff6b6b" />
                        <rect x={dims.w - PAD.r} y={rsiToY(rv) - 8} width={PAD.r} height={16} fill="#1a0a0a" rx="2" />
                        <text x={dims.w - PAD.r + 4} y={rsiToY(rv) + 4} fontSize="9" fill="#ff6b6b" fontFamily="inherit">{fmt(rv, 1)}</text>
                      </g>
                    );
                  })()}
                </g>
              );
            })()}

            {/* ── MACD Sub-panel ── */}
            {hasMACD && (() => {
              const py0 = macdPanelY;
              const allVals = [...macdV.hist.filter(v => v != null)];
              const macdMin = Math.min(...allVals);
              const macdMax = Math.max(...allVals);
              const macdRange = macdMax - macdMin || 1;
              const mToY = v => py0 + subH - ((v - macdMin) / macdRange) * subH;
              const zeroY = mToY(0);
              return (
                <g>
                  <rect x={PAD.l} y={py0} width={W} height={subH} fill="#04080f" />
                  <line x1={PAD.l} y1={py0} x2={dims.w - PAD.r} y2={py0} stroke="#0f1e32" />
                  <text x={PAD.l + 4} y={py0 + 11} fontSize="9" fill="#ffd70088" fontFamily="inherit">MACD(12,26,9)</text>
                  <line x1={PAD.l} y1={zeroY} x2={dims.w - PAD.r} y2={zeroY} stroke="#1a2a3a" />
                  {macdV.hist.map((v, i) => {
                    if (v == null) return null;
                    const x = toX(i);
                    const y0 = zeroY, y1 = mToY(v);
                    return (
                      <rect key={i} x={x - candleW / 2} y={Math.min(y0, y1)}
                        width={Math.max(candleW, 1)} height={Math.abs(y0 - y1)}
                        fill={v >= 0 ? "#00e67633" : "#ff4c6a33"} />
                    );
                  })}
                  <path
                    d={macdV.macdLine.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${mToY(v)}`).join(" ")}
                    fill="none" stroke="#ffd700" strokeWidth="1.2" />
                  <path
                    d={macdV.signal.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${mToY(v)}`).join(" ")}
                    fill="none" stroke="#ff6b9d" strokeWidth="1.2" />
                </g>
              );
            })()}

            {/* Chart border */}
            <rect x={PAD.l} y={PAD.t} width={W} height={mainH}
              fill="none" stroke="#0d1824" strokeWidth="1" />

            {/* Indicator legend */}
            <g>
              {[
                activeIndicators.has("ema20") && { label: "EMA20", color: "#f0a500" },
                activeIndicators.has("ema50") && { label: "EMA50", color: "#4da6ff" },
                activeIndicators.has("ema200") && { label: "EMA200", color: "#b06aff" },
                activeIndicators.has("bb") && { label: "BB(20)", color: "#00d084" },
              ].filter(Boolean).map((item, idx) => (
                <g key={item.label} transform={`translate(${PAD.l + 4 + idx * 70}, ${PAD.t + 4})`}>
                  <line x1="0" y1="5" x2="14" y2="5" stroke={item.color} strokeWidth="1.5" />
                  <text x="17" y="9" fontSize="9" fill={item.color} fontFamily="inherit" opacity="0.8">{item.label}</text>
                </g>
              ))}
            </g>
          </svg>

          {/* Zoom hint */}
          <div style={{
            position: "absolute", bottom: 8, left: 10, fontSize: 9, color: "#1a2a3a",
            pointerEvents: "none"
          }}>
            Ctrl+Scroll to zoom • Drag to scroll • Click candle for details
          </div>
        </div>

        {/* ── Order Book ── */}
        {showOrderBook && (
          <div style={{
            width: 180, background: "#05090e", borderLeft: "1px solid #0d1824",
            display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
          }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #0d1824", fontSize: 10, fontWeight: 700, color: "#2e4060", letterSpacing: 1 }}>
              ORDER BOOK
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", fontSize: 9, color: "#1e3050" }}>
              <span>Price</span><span>Size</span>
            </div>
            {/* Asks */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {orderBook.asks.slice().reverse().map((a, i) => {
                const maxSz = Math.max(...orderBook.asks.map(x => x.size));
                return (
                  <div key={i} style={{ position: "relative", display: "flex", justifyContent: "space-between", padding: "2px 10px", fontSize: 10 }}>
                    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, background: "#ff4c6a0e", width: `${(a.size / maxSz) * 100}%` }} />
                    <span style={{ color: "#ff4c6a", position: "relative" }}>{fmt(a.price, 2)}</span>
                    <span style={{ color: "#3a5070", position: "relative" }}>{fmt(a.size, 3)}</span>
                  </div>
                );
              })}
            </div>
            {/* Spread */}
            <div style={{ padding: "6px 10px", background: "#070d16", borderTop: "1px solid #0d1824", borderBottom: "1px solid #0d1824", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: priceChange >= 0 ? "#00e676" : "#ff4c6a" }}>
                {lastCandle ? fmt(lastCandle.close, 2) : "--"}
              </span>
              <span style={{ fontSize: 8, color: "#1e3050", marginLeft: 4 }}>
                {priceChange >= 0 ? "▲" : "▼"}
              </span>
            </div>
            {/* Bids */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {orderBook.bids.map((b, i) => {
                const maxSz = Math.max(...orderBook.bids.map(x => x.size));
                return (
                  <div key={i} style={{ position: "relative", display: "flex", justifyContent: "space-between", padding: "2px 10px", fontSize: 10 }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: "#00e6760e", width: `${(b.size / maxSz) * 100}%` }} />
                    <span style={{ color: "#00e676", position: "relative" }}>{fmt(b.price, 2)}</span>
                    <span style={{ color: "#3a5070", position: "relative" }}>{fmt(b.size, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}