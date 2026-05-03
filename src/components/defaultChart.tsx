import React, { useRef, useEffect, useState, useMemo } from "react"

type Candle = {
  time:number
  open:number
  high:number
  low:number
  close:number
  volume:number
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

type Props = {
  candles:Candle[]
  trades?:Trade[]
}

const GREEN = "#0ECB81"
const RED = "#F6465D"

const PAD = { top:20, bottom:30, left:10, right:70 }

const CANDLE_GAP = 2

export default function ProTradingChart({candles,trades=[]}:Props){

 const containerRef = useRef<HTMLDivElement>(null)

 const [dims,setDims] = useState({w:800,h:420})

 const [candleW,setCandleW] = useState(8)

 const [offset,setOffset] = useState(0)

 const [hover,setHover] = useState<number|null>(null)

 useEffect(()=>{

  const resize = () => {

   if(!containerRef.current) return

   const r = containerRef.current.getBoundingClientRect()

   setDims({
    w:r.width,
    h:r.height
   })

  }

  resize()

  window.addEventListener("resize",resize)

  return ()=>window.removeEventListener("resize",resize)

 },[])

 const visibleCount = useMemo(()=>{

  return Math.floor(
   (dims.w - PAD.right) / (candleW + CANDLE_GAP)
  )

 },[dims.w,candleW])

 const start = Math.max(
  0,
  candles.length - visibleCount - offset
 )

 const end = start + visibleCount

 const slice = candles.slice(start,end)

 const prices = slice.flatMap(c=>[c.high,c.low])

 const maxPrice = Math.max(...prices)

 const minPrice = Math.min(...prices)

 const priceScale = (price:number)=>{

  const h = dims.h - PAD.top - PAD.bottom

  return PAD.top +
   (maxPrice-price)/(maxPrice-minPrice) * h

 }

 const handleWheel = (e:React.WheelEvent)=>{

  e.preventDefault()

  if(e.ctrlKey){

   setCandleW(w=>{

    const next = w - e.deltaY*0.01

    return Math.max(3,Math.min(30,next))

   })

  }else{

   const step = Math.ceil(visibleCount*0.15)

   setOffset(o=>{

    const next = o + (e.deltaY>0 ? step:-step)

    return Math.max(
     0,
     Math.min(candles.length-visibleCount,next)
    )

   })

  }

 }

 const lastPrice = candles[candles.length-1]?.close

 return (

 <div
  ref={containerRef}
  style={{
   height:"420px",
   width:"100%",
   position:"relative"
  }}
 >

 <svg
  width={dims.w}
  height={dims.h}
  onWheel={handleWheel}
  style={{background:"#0b0f14"}}
 >

 {/* grid */}

 {Array.from({length:6}).map((_,i)=>{

  const y =
   PAD.top +
   i*(dims.h-PAD.top-PAD.bottom)/5

  return (

   <line
    key={i}
    x1={0}
    x2={dims.w}
    y1={y}
    y2={y}
    stroke="#1f2937"
   />

  )

 })}

 {/* candles */}

 {slice.map((c,i)=>{

  const x = i*(candleW+CANDLE_GAP)

  const openY = priceScale(c.open)
  const closeY = priceScale(c.close)
  const highY = priceScale(c.high)
  const lowY = priceScale(c.low)

  const color = c.close>=c.open ? GREEN : RED

  const bodyY = Math.min(openY,closeY)

  const bodyH = Math.max(
   1,
   Math.abs(openY-closeY)
  )

  return (

  <g
   key={c.time}
   onMouseEnter={()=>setHover(i)}
   onMouseLeave={()=>setHover(null)}
  >

  <line
   x1={x+candleW/2}
   x2={x+candleW/2}
   y1={highY}
   y2={lowY}
   stroke={color}
  />

  <rect
   x={x}
   y={bodyY}
   width={candleW}
   height={bodyH}
   fill={color}
   opacity={hover===i ? 1 : 0.9}
  />

  </g>

  )

 })}

 {/* trade lines */}

 {trades.map(t=>{

  const y = priceScale(t.price)

  const col =
   t.side==="BUY"
   ? GREEN
   : RED

  return (

   <g key={t.id}>

   <line
    x1={0}
    x2={dims.w}
    y1={y}
    y2={y}
    stroke={col}
    strokeDasharray="4 4"
   />

   <text
    x={dims.w-PAD.right+5}
    y={y+4}
    fill={col}
    fontSize={10}
   >
    {t.side.toUpperCase()} {t.price}
   </text>

   </g>

  )

 })}

 {/* current price */}

 {lastPrice && (

 <g>

 <line
  x1={0}
  x2={dims.w}
  y1={priceScale(lastPrice)}
  y2={priceScale(lastPrice)}
  stroke="#16a34a"
  strokeDasharray="3 3"
 />

 <rect
  x={dims.w-PAD.right}
  y={priceScale(lastPrice)-9}
  width={PAD.right}
  height={18}
  fill="#16a34a"
  rx={3}
 />

 <text
  x={dims.w-PAD.right+6}
  y={priceScale(lastPrice)+4}
  fill="#fff"
  fontSize={11}
 >
  {lastPrice.toFixed(2)}
 </text>

 </g>

 )}

 </svg>

 </div>

 )

}