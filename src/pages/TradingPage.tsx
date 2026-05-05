// pages/TradingPage.tsx
import { useState, useEffect } from "react";
import type { PageProps } from "./shared";
import { KlineUpdate, PAIR_DISPLAY, PAIRS, type OHLCV } from "../types";
import { marketApi, tradesApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ProTradingChart1 from "../components/viewPro";
import { S } from "./styles";
import CandlestickChart from "../components/CandlestickChart";
import { useWebSocket } from "../hooks/useWebSocket";
// ── Technical Analysis ────────────────────────────────────────────────────────
function rsi(closes: number[], p = 14) {
  if (closes.length < p + 1) return 50;
  let g = 0, l = 0;
  for (let i = closes.length - p; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    d > 0 ? (g += d) : (l -= d);
  }
  return 100 - 100 / (1 + g / (l || 0.001));
}
function ema(d: number[], p: number) {
  const k = 2 / (p + 1); const e = [d[0]];
  for (let i = 1; i < d.length; i++) e.push(d[i] * k + e[i - 1] * (1 - k));
  return e;
}
function macd(closes: number[]) {
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0 };
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  const ml = e12.map((v, i) => v - e26[i]);
  const sl = ema(ml, 9);
  return { macd: ml[ml.length - 1], signal: sl[sl.length - 1], hist: ml[ml.length - 1] - sl[sl.length - 1] };
}
function bb(closes: number[], p = 20) {
  const sl = closes.slice(-p); const mean = sl.reduce((a, b) => a + b, 0) / sl.length;
  const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / sl.length);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

export default function TradingPage({ tickers, trades, setTrades, notify }: PageProps) {
  const { auth } = useAuth();
  const [sel, setSel] = useState("BTCUSDT");
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [iv, setIv] = useState("1h");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("0.001");
  const [limitPrice, setLimitPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const ticker = tickers.find(t => t.symbol === sel);
  const ts = (t: typeof trades[0]) => t.created_at ? t.created_at * 1000 : t.timestamp || 0;
   // 1. Initial Load (REST)
  useEffect(() => {
    let cancelled = false;
    marketApi.klines(sel, iv, 100).then(data => {
      if (!cancelled) setCandles(data);
    });
    return () => { cancelled = true; };
  }, [sel, iv]);

  // 2. Real-time updates via your existing hook
  const { send } = useWebSocket(auth.token, {
onKline: (updates: KlineUpdate[]) => {
  setCandles(prev => {
    // Clone previous state to avoid direct mutation
    const newCandles = [...prev];

    updates.forEach(update => {
      const lastIndex = newCandles.length - 1;
      
      // Check if this update belongs to the last existing candle
      if (lastIndex >= 0 && newCandles[lastIndex].time === update.time) {
        // UPDATE existing candle (same hour)
        newCandles[lastIndex] = update;
      } else if (lastIndex < 0 || update.time > newCandles[lastIndex].time) {
        // APPEND new candle (new hour started)
        newCandles.push(update);
      }
    });

    // Keep only the most recent 100 to maintain performance
    return newCandles.slice(-100);
  });
}


  });

   useEffect(() => {
    send({ type: "SUBSCRIBE_KLINES", symbol: sel, interval: iv });
  }, [sel, iv, send]);

  
  useEffect(() => {
    let cancelled = false;
  
    const loadInitial = async () => {
      try {
        const data = await marketApi.klines(sel, iv, 100);
        if (!cancelled) setCandles(data);
      } catch (err) {
        console.error("Failed to load candles", err);
      }
    };
  
    const pollUpdates = async () => {
      try {
        const updates = await marketApi.klines(sel, iv, 3);
  
        if (!cancelled && updates.length) {
          setCandles(prev => {
            const map = new Map(prev.map(c => [c.time, c]));
  
            updates.forEach(c => map.set(c.time, c));
  
            return Array
              .from(map.values())
              .sort((a, b) => a.time - b.time)
              .slice(-100);
          });
        }
      } catch (err) {
        console.error("Candle update failed", err);
      }
    };
  
    loadInitial();
  
    const interval = setInterval(pollUpdates, 15000);
  
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sel, iv]);

// Then pass to chart:
//<ProTradingChart candles={candles} loading={loading} symbol={sel} timeframe={iv} ... />

  const loadCandles = async (pair: string, interval: string) => {
    setCandles([])
    const data = await marketApi.klines(pair, interval, 100);
    setTimeout(() => {
      setCandles(data);
    }, 1000);
    
  };



/*
  useEffect(() => {
    let alive = true;
    setCandles([]);
    marketApi.klines(sel, iv, 100).then(d => { if (alive) setCandles(d); });
    const id = setInterval(() => marketApi.klines(sel, iv, 3).then(d => {
      if (alive && d.length) setCandles(prev => {
        const map = new Map(prev.map(c => [c.time, c]))
      
        for (const c of d) {
          map.set(c.time, c) // update existing or add new
        }
      
        const merged = Array.from(map.values()).sort((a, b) => a.time - b.time)
      
        return merged.slice(-100)
      })
    }), 15000);
    return () => { alive = false; clearInterval(id); };
  }, [sel, iv]);
*/
  useEffect(()=>{

    const price = candles[candles.length-1]?.close
    if(!price) return
  
    setTrades(t =>
      t.map(trade => {
  
        if(trade.status !== "FILLED") return trade
  
        const pnl =
          trade.side === "BUY"
          ? (price - trade.price) * trade.amount
          : (trade.price - price) * trade.amount

       
        return {...trade, pnl}
      })
    )
  
  },[candles])

  const closes = candles.map(c => c.close);
  const RSI = rsi(closes), MACD = macd(closes), BB = bb(closes);
  const fmt = (p: number) => p < 1 ? p.toFixed(4) : p < 10000 ? p.toFixed(2) : p.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const closeTrade = (id:string) => {

    const price = candles[candles.length-1]?.close
   
    setTrades(t =>
     t.map(trade => {
   
      if(trade.id !== id) return trade
   
      const pnl =
       trade.side === "BUY"
        ? (price - trade.price) * trade.amount
        : (trade.price - price) * trade.amount
   
      return {
        ...trade,
        status:"CANCELLED",
        closePrice: price,
        pnl
      }
   
     })
    )
   
   }

  const handleOrder = async () => {
    if (!auth.token) return;
    setLoading(true);
    try {
      const trade = await tradesApi.place(auth.token, {
        pair: sel, side, amount: parseFloat(amount),
        order_type: orderType,
        ...(orderType === "limit" && limitPrice ? { limit_price: parseFloat(limitPrice) } : {}),
      });
      setTrades(prev => [trade, ...prev]);
      notify(`${side} filled: ${amount} ${PAIR_DISPLAY[sel]} @ $${trade.price.toFixed(2)}`, "success");
    } catch (e: any) {
      notify(e.message, "error");
    }
    setLoading(false);
  };

  const handleAI = async () => {
    console.log("start");
    if (!ticker) return;
    console.log("end");
    setAiLoading(true); setAiText("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 450,
          messages: [{ role: "user", content: `Professional crypto analysis for ${sel}:\nPrice: $${ticker.price.toFixed(4)}, RSI: ${RSI.toFixed(1)}, MACD hist: ${MACD.hist.toFixed(5)}, 24h: ${ticker.changePct.toFixed(2)}%, High: $${ticker.high24h.toFixed(2)}, Low: $${ticker.low24h.toFixed(2)}\n\nProvide:\n📊 SIGNAL: BUY/SELL/HOLD\n🎯 CONFIDENCE: X%\n💰 TARGET: $X\n🛑 STOP: $X\n📝 Analysis (3 sentences)` }],
        }),
      });
      const data = await res.json();
      setAiText(data.content?.[0]?.text || "Analysis unavailable");
    } catch {
      setAiText(`RSI at ${RSI.toFixed(1)} ${RSI < 40 ? "— oversold, potential reversal" : RSI > 65 ? "— overbought, caution advised" : "— neutral range"}. MACD hist ${MACD.hist > 0 ? "positive (bullish)" : "negative (bearish)"}.`);
    }
    setAiLoading(false);
  };



  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Pair selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {tickers.map(t => (
          <div key={t.symbol}
            style={{ background: sel === t.symbol ? "#00d08411" : "#0c1420", border: `1px solid ${sel === t.symbol ? "#00d084" : "#0a1828"}`, borderRadius: 7, padding: "4px 9px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 1 }}
            onClick={() => setSel(t.symbol)}>
            <span style={{ color: "#e0eaf5", fontWeight: 700, fontSize: 10 }}>{PAIR_DISPLAY[t.symbol]}</span>
            <span style={{ color: t.changePct >= 0 ? "#00d084" : "#ff4757", fontSize: 9 }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {/* Chart */}
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#e0eaf5", fontWeight: 800, fontSize: 16 }}>{PAIR_DISPLAY[sel]}</span>
              {ticker && <>
                <span style={{ color: "#e0eaf5", fontSize: 18, fontWeight: 700 }}>${fmt(ticker.price)}</span>
                <span style={{ color: ticker.changePct >= 0 ? "#00d084" : "#ff4757", fontSize: 12 }}>
                  {ticker.changePct >= 0 ? "▲" : "▼"} {Math.abs(ticker.changePct).toFixed(2)}%
                </span>
              </>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["1m", "5m", "15m", "30m", "1h", "4h", "6h", "1d"].map(i => (
                <div key={i} style={{ background: iv === i ? "#00d08422" : "#0c1420", border: `1px solid ${iv === i ? "#00d084" : "#0a1828"}`, color: iv === i ? "#00d084" : "#4a6080", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 10 }} onClick={() => {
                  setCandles([]); // clear chart
                  setIv(i);
                }}>{i}</div>
              ))}
            </div>
          </div>

         {/** <CandlesStick candles={candles} height={300}/> 
          * 
          *
         */}
           <div style={S.card}>
  <div style={{ height: "100%" }}>
          <ProTradingChart1 candles={candles} trades={trades} symbol={sel} timeframe={iv} onTimeframeChange={(tf) => setIv(tf)} />
           <CandlestickChart candles={candles} height={270} /> 
          </div>
          </div>
         {/**
         <div style={S.card}>
  <div style={{ height: "100%", width: "100%"}}>
  
<ProTradingChart candles={candles}/>
    </div>
  </div>*/}
                 

          {/* Indicators */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {[
              { l: "RSI(14)", v: RSI.toFixed(1), c: RSI < 30 ? "#00d084" : RSI > 70 ? "#ff4757" : "#e0eaf5" },
              { l: "MACD", v: MACD.hist.toFixed(5), c: MACD.hist >= 0 ? "#00d084" : "#ff4757" },
              { l: "BB↑", v: fmt(BB.upper), c: "#4a6080" },
              { l: "BB↓", v: fmt(BB.lower), c: "#4a6080" },
              ...(ticker ? [
                { l: "High", v: "$" + fmt(ticker.high24h), c: "#00d084" },
                { l: "Low", v: "$" + fmt(ticker.low24h), c: "#ff4757" },
              ] : []),
            ].map(ind => (
              <div key={ind.l} style={{ display: "flex", gap: 4, alignItems: "center", background: "#060c14", border: "1px solid #0a1828", borderRadius: 5, padding: "4px 8px" }}>
                <span style={{ color: "#2e4060", fontSize: 9 }}>{ind.l}</span>
                <span style={{ color: ind.c, fontWeight: 700, fontSize: 10 }}>{ind.v}</span>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          <div style={{ marginTop: 12 }}>
            <button style={{ ...S.btnO, fontSize: 11, marginBottom: 9 }} onClick={()=>handleAI} disabled={aiLoading}>
              {aiLoading ? "⏳ Analyzing..." : "🤖 AI Analysis"}
            </button>
            {aiText && (
              <div style={{ background: "#040a12", border: "1px solid #00d08433", borderRadius: 9, padding: 13 }}>
                <div style={{ color: "#00d084", fontWeight: 700, fontSize: 9, marginBottom: 7, letterSpacing: 2 }}>AI ANALYSIS</div>
                <div style={{ color: "#8090a8", fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiText}</div>
              </div>
            )}
          </div>
        </div>

        {/* Order Panel */}
        <div style={S.card}>
          <div style={S.ch}>Place Order</div>
          {ticker && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 13 }}>
              {[{ l: "BID", v: "$" + fmt(ticker.bid), c: "#00d084" }, { l: "ASK", v: "$" + fmt(ticker.ask), c: "#ff4757" },
              { l: "HIGH", v: "$" + fmt(ticker.high24h), c: "#e0eaf5" }, { l: "LOW", v: "$" + fmt(ticker.low24h), c: "#e0eaf5" }].map(s => (
                <div key={s.l} style={{ background: "#040a12", border: "1px solid #0a1828", borderRadius: 7, padding: "7px 9px" }}>
                  <div style={{ color: "#2e4060", fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>{s.l}</div>
                  <div style={{ color: s.c, fontWeight: 700, fontSize: 11, marginTop: 1 }}>{s.v}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 5, marginBottom: 11 }}>
            {(["BUY", "SELL"] as const).map(s => (
              <button key={s} style={{ flex: 1, padding: 9, borderRadius: 7, cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: "inherit", border: `1px solid ${side === s ? (s === "BUY" ? "#00d084" : "#ff4757") : "#0a1828"}`, background: side === s ? (s === "BUY" ? "#00d084" : "#ff4757") : "#0c1420", color: side === s ? "#000" : "#4a6080" }} onClick={() => setSide(s)}>{s}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 11 }}>
            {(["market", "limit"] as const).map(t => (
              <div key={t} style={{ flex: 1, padding: "6px", borderRadius: 6, cursor: "pointer", background: orderType === t ? "#0094ff22" : "#0c1420", border: `1px solid ${orderType === t ? "#0094ff" : "#0a1828"}`, color: orderType === t ? "#0094ff" : "#4a6080", textAlign: "center", fontSize: 10 }} onClick={() => setOrderType(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>
            ))}
          </div>
          <div style={S.fg}>
            <label style={S.lbl}>Amount</label>
            <input style={S.inp} value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.001" />
          </div>
          {orderType === "limit" && (
            <div style={S.fg}>
              <label style={S.lbl}>Limit Price</label>
              <input style={S.inp} value={limitPrice} onChange={e => setLimitPrice(e.target.value)} type="number" placeholder={ticker?.price.toFixed(2)} />
            </div>
          )}
          {ticker && <div style={{ color: "#2e4060", fontSize: 10, marginBottom: 10 }}>Total ≈ <span style={{ color: "#e0eaf5" }}>${(parseFloat(amount) * ticker.price || 0).toFixed(2)}</span></div>}
          <button style={{ ...S.btn, background: side === "BUY" ? "#00d084" : "#ff4757", fontWeight: 800 }} onClick={handleOrder} disabled={loading}>
            {loading ? "Processing..." : `${side} ${PAIR_DISPLAY[sel]}`}
          </button>
        </div>

        <div style={S.card}>
        <div style={S.ch}>Live Trades</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Pair", "Side", "Entry", "Amount", "P&L", "Source", "Status"].map(h => (
                  <th key={h} style={{ color: "#2e4060", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, padding: "7px 11px", textAlign: "left", borderBottom: "1px solid #0a1828", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ color: "#e0eaf5", fontWeight: 700, fontSize: 11, padding: "8px 11px" }}>{PAIR_DISPLAY[t.pair] || t.pair}</td>
                    <td style={{ padding: "8px 11px" }}><span style={{ color: t.side === "BUY" ? "#00d084" : "#ff4757", fontWeight: 700, fontSize: 10 }}>{t.side}</span></td>
                    <td style={{ color: "#8090a8", fontSize: 10, padding: "8px 11px", fontFamily: "monospace" }}>{t.price.toFixed(4)}</td>
                    <td style={{ color: "#8090a8", fontSize: 10, padding: "8px 11px", fontFamily: "monospace" }}>{t.amount.toFixed(4)}</td>
                    <td style={{ padding: "8px 11px" }}><span style={{ color: (t.pnl || 0) >= 0 ? "#00d084" : "#ff4757", fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>{(t.pnl || 0) >= 0 ? "+" : ""}${(t.pnl || 0).toFixed(4)}</span></td>
                    <td style={{ color: "#2e4060", fontSize: 9, padding: "8px 11px" }}>{t.bot_id ? "Bot" : "Manual"}</td>
                    <td style={{ color: "#2e4060", fontSize: 9, padding: "8px 11px" }}>{t.status}</td>
                    <td style={{ color: "#2e4060", fontSize: 9, padding: "8px 11px" }}><button onClick={()=>closeTrade(t.id)}>Stop</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
}
