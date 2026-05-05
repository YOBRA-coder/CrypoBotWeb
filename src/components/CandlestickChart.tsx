// components/CandlestickChart.tsx

import { useRef, useEffect, useState } from "react";
import type { OHLCV } from "../types";
import { fmtPrice } from "../types";

interface Props {
  candles: OHLCV[];
  height?: number;
  width?: number;
}

export default function CandlestickChart({ candles, width = 280, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [zoom, setZoom] = useState(8)

  useEffect(() => {
    if (!containerRef.current) return;
    /* const obs = new ResizeObserver(entries => {
       const w = entries[0]?.contentRect.width;
       if (w && w > 0) setWidth(w);
     });*/
    containerRef.current.scrollLeft = containerRef.current.scrollWidth
    //obs.observe(containerRef.current);
    //return () => obs.disconnect();
  }, []);

  if (candles.length === 0) {
    return (
      <div ref={containerRef} style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#1e3040", fontFamily: "monospace", fontSize: 13 }}>
        ⏳ Loading market data...
      </div>
    );
  }
  const visible = 70
  const start = Math.max(0, candles.length - visible - offset);
  const end = candles.length - offset;
  const slice = candles.slice(start, end);

  const pad = { l: 54, r: 12, t: 14, b: 26 };
  // const pad = { l:60, r:60, t:20, b:30 }
  const candleSpacing = 10
  const chartWidth = slice.length * candleSpacing + pad.l + pad.r;
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  //const slice = candles.slice(-Math.min(70, candles.length));
  //const min = Math.min(...slice.map(c => c.low));
  //const max = Math.max(...slice.map(c => c.high));
  //const range = max - min || 1;
  let min = Infinity
  let max = -Infinity

  for (const c of slice) {
    if (c.low < min) min = c.low
    if (c.high > max) max = c.high
  }

  const range = max - min || 1
  const cw = Math.max(2, W / slice.length - 1.2);
  const toY = (v: number) => H - ((v - min) / range) * H + pad.t;
  const toX = (i: number) => pad.l + i * candleSpacing
  //const toX = (i: number) => pad.l + i * (W / slice.length) + cw / 2;

  function onWheel(e: { deltaY: number; }) {

    if (e.deltaY < 0) setZoom(z => Math.min(30, z + 1))
    else setZoom(z => Math.max(3, z - 1))

  }
  function ema(values: number[], period: number) {
    const k = 2 / (period + 1)
    let ema = values[0]
    const result = [ema]

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k)
      result.push(ema)
    }

    return result
  }
  const closes = slice.map(c => c.close)
  const ema20 = ema(closes, 50)
  const ema50 = ema(closes, 100)

  const lastPrice = slice[slice.length - 1].close
  const py = toY(lastPrice)

  function handleDrag(clientX: number) {
    if (dragStart === null) return

    const dx = clientX - dragStart
    const step = Math.round(dx / 5)

    setOffset(o => Math.max(0, o - step))
    setDragStart(clientX)
  }

  function onMouseDown(e: React.MouseEvent) {
    setDragStart(e.clientX)
  }

  function onMouseMove(e: React.MouseEvent) {
    handleDrag(e.clientX)
  }

  function onMouseUp() {
    setDragStart(null)
  }

  function onTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]
    setDragStart(touch.clientX)
  }

  function onTouchMove(e: React.TouchEvent) {
    const touch = e.touches[0]
    handleDrag(touch.clientX)
  }

  function onTouchEnd() {
    setDragStart(null)
  }

  //const gridLevels = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const gridLevels = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={containerRef} style={{ width: "100%", overflowX: "auto" }}>
      <svg onWheel={onWheel}

        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd} width="100%" height={height} viewBox={`0 0 ${chartWidth} ${height}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d084" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00a866" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4757" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#cc3344" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLevels.map(t => {
          const y = toY(min + t * range);
          return (
            <g key={t}>
              <line x1={pad.l} y1={y} x2="100%" y2={y} stroke="#0a1828" strokeDasharray="3,3" />
              <text x={pad.l - 4} y={y + 4} fill="#2e4060" fontSize="9" textAnchor="end" fontFamily="monospace">
                {fmtPrice(min + t * range)}
              </text>
            </g>
          );
        })}

        {/* Volume bars */}
        {slice.map((c, i) => {
          const bull = c.close >= c.open;
          const maxVol = Math.max(...slice.map(s => s.volume));
          const volH = (c.volume / maxVol) * (H * 0.2);
          const x = toX(i);
          return (
            <rect key={`v${i}`} x={x - cw / 2} y={pad.t + H - volH} width={cw} height={volH}
              fill={bull ? "#00d08422" : "#ff475722"} />
          );
        })}

        {/* Candles */}
        {slice.map((c, i) => {
          const x = toX(i);
          const bull = c.close >= c.open;
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyBot = toY(Math.min(c.open, c.close));
          const bodyH = Math.max(1.5, bodyBot - bodyTop);
          return (
            <g key={i}>
              <line x1={x} y1={toY(c.high)} x2={x} y2={toY(c.low)}
                stroke={bull ? "#00d084" : "#ff4757"} strokeWidth="1" opacity="0.8" />
              <rect x={x - zoom / 2} y={bodyTop} width={zoom} height={bodyH}
                fill={bull ? "url(#bullGrad)" : "url(#bearGrad)"} rx="0.6" />
            </g>
          );
        })}

        {/* Axes */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + H} stroke="#0d1a2a" />
        <line x1={pad.l} y1={pad.t + H} x2={pad.l + W} y2={pad.t + H} stroke="#0d1a2a" />

        <g>
          <line
            x1={pad.l}
            x2="100%"
            y1={py}
            y2={py}
            stroke="#ffd166"
            strokeDasharray="4"
          />

          <text
            x="100%"
            y={py + 3}
            fontSize="10"
            fill="#ffd166"
          >
            {fmtPrice(lastPrice)}
          </text>
        </g>


        <path
          d={ema20
            .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`)
            .join(" ")}
          fill="none"
          stroke="#ffaa00"
          strokeWidth="1.4"
        />

        <path
          d={ema50
            .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`)
            .join(" ")}
          fill="none"
          stroke="#4da6ff"
          strokeWidth="1.4"
        />

      </svg>
    </div>
  );
}
