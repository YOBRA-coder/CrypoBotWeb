// pages/TradingPage.tsx
import { useState, useEffect } from "react";
import type { PageProps } from "./shared";
import { KlineUpdate, PAIR_DISPLAY, PAIRS, Trade, type OHLCV } from "../types";
import { marketApi, tradesApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ProTradingChart1 from "../components/viewPro";
import { S } from "./styles";
import { useLocation } from "react-router-dom";
import TradeModal from "../components/TradeModal";

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
  const location = useLocation();
  const pair = new URLSearchParams(location.search).get("pair");
  const { auth } = useAuth();
  const [sel, setSel] = useState(pair ? pair : "BTCUSDT");
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
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showPrices, setShowPrices] = useState(isMobile ? false : true);
  const [showPairsModal, setShowPairsModal] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.ceil(trades.length / pageSize);
  const paginated = trades.slice((page - 1) * pageSize, page * pageSize);
  const [editing, setEditing] = useState<any | null>(null);
   useEffect(() => {
    setPage(1);
  }, [trades]);

  const getPages = () => {
    const pages: number[] = [];

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };
useEffect(() => {
  const onResize = () => {
    const mobile = window.innerWidth < 992;

    setIsMobile(mobile);

    if (!mobile) {
      setShowPrices(true);
      setShowPairsModal(false);
    } else {
      setShowPrices(false);
    }
  };

  onResize();

  window.addEventListener("resize", onResize);

  return () => window.removeEventListener("resize", onResize);
}, []);

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
  useEffect(() => {

    const price = candles[candles.length - 1]?.close
    if (!price) return

    setTrades(t =>
      t.map(trade => {

        if (trade.status !== "FILLED") return trade

        const pnl =
          trade.side === "BUY"
            ? (price - trade.price) * trade.amount
            : (trade.price - price) * trade.amount


        return { ...trade, pnl }
      })
    )

  }, [candles])

  const closes = candles.map(c => c.close);
  const RSI = rsi(closes), MACD = macd(closes), BB = bb(closes);
  const fmt = (p: number) => p < 1 ? p.toFixed(4) : p < 10000 ? p.toFixed(2) : p.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const closeTrade = (id: string) => {

    const price = candles[candles.length - 1]?.close

    setTrades(t =>
      t.map(trade => {

        if (trade.id !== id) return trade

        const pnl =
          trade.side === "BUY"
            ? (price - trade.price) * trade.amount
            : (trade.price - price) * trade.amount

        return {
          ...trade,
          status: "CANCELLED",
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

  function renderOrderPanel() {
    return (
      <>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Order</div>
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
      </>
    );
  }

  function renderTrades() {
    return (
      <>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Recent Trades</div>

        <table style={{ width: "100%", fontSize: 12 }}>
          <thead style={{ color: "#8b98a5" }}>
            <tr>
              <th>Pair</th>
              <th>Side</th>
              <th>Price</th>
              <th>Amt</th>
              <th>PnL</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {paginated.map(t => (
              <tr key={t.id} onClick={() => setEditing(t)} style={{ background: editing?.id === t.id ? "#00d08411" : "transparent", cursor: "pointer" }}>
                <td>{PAIR_DISPLAY[t.pair]}</td>
                <td style={{ color: t.side === "BUY" ? "#00d084" : "#ff4757" }}>
                  {t.side}
                </td>
                <td>{t.price.toFixed(2)}</td>
                <td>{t.amount}</td>
                <td style={{ color: (t.pnl || 0) >= 0 ? "#00d084" : "#ff4757" }}>
                  {(t.pnl || 0).toFixed(2)}
                </td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
            <div style={{
              display: "flex",
              gap: 6,
              justifyContent: "center",
              marginTop: 15,
              alignItems: "center"
            }}>

              {/* Prev */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={S.btn}
              >
                Prev
              </button>

              {/* First page always */}
              {page > 3 && (
                <>
                  <button style={S.btn} onClick={() => setPage(1)}>1</button>
                  <span style={{ color: "#4a6080" }}>...</span>
                </>
              )}

              {/* Middle pages */}
              {getPages().map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    ...S.btn,
                    background: p === page ? "#00d084" : "#0c1420",
                    color: p === page ? "#000" : "#e0eaf5",
                    borderColor: p === page ? "#00d084" : "#0a1828"
                  }}
                >
                  {p}
                </button>
              ))}

              {/* Last page always */}
              {page < totalPages - 2 && (
                <>
                  <span style={{ color: "#4a6080" }}>...</span>
                  <button style={S.btn} onClick={() => setPage(totalPages)}>
                    {totalPages}
                  </button>
                </>
              )}

              {/* Next */}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={S.btn}
              >
                Next
              </button>

            </div>
          )}
      </>
    );
  }


 const styles = {
  page: {
    display: "flex",
    flexDirection: "column" as const,
    background: "#0a0e14",
    minHeight: "100vh",
    color: "#e6edf3",
    padding: 10,
    overflow: "hidden"
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
    padding: "12px 14px",
    background: "#0f1520",
    border: "1px solid #1a2233",
    borderRadius: 10,
    marginBottom: 10
  },

  symbol: {
    fontWeight: 700,
    fontSize: isMobile ? 13 : 15,
    display: "flex",
    gap: 10,
    alignItems: "center",
    cursor: "pointer"
  },

  metrics: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap" as const,
    fontSize: isMobile ? 10 : 12,
    color: "#8b98a5"
  },

  grid: {
    display: "flex",
    flex: 1,
    gap: 10,
    width: "100%",
    minHeight: 0,
    overflow: "hidden"
  },

  leftPanel: {
    width: 260,
    minWidth: 240,
    maxWidth: 280,
    background: "#0f1520",
    border: "1px solid #1a2233",
    borderRadius: 10,
    overflowY: "auto" as const,
    padding: 8,
    height: "calc(100vh - 170px)"
  },

  center: {
    flex: 1,
    minWidth: 0,
    background: "#0f1520",
    border: "1px solid #1a2233",
    borderRadius: 10,
    padding: isMobile ? 0 : 10,
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    height: "calc(100vh - 170px)"
  },

  rightPanel: {
    width: isMobile ? "100%" : 320,
    minWidth: isMobile ? "100%" : 300,
    background: "#0f1520",
    border: "1px solid #1a2233",
    borderRadius: 10,
    padding: 12,
    overflowY: "auto" as const,
    height: isMobile ? "auto" : "calc(100vh - 170px)"
  },

  bottom: {
    marginTop: 10,
    background: "#0f1520",
    border: "1px solid #1a2233",
    borderRadius: 10,
    padding: 10,
    overflowX: "auto" as const
  },

  pair: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px",
    borderBottom: "1px solid #1a2233",
    cursor: "pointer",
    fontSize: 12,
    borderRadius: 6
  },

  mobilePairsButton: {
    position: "fixed" as const,
    bottom: 20,
    left: 20,
    zIndex: 1000,
    background: "#0094ff",
    border: "none",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
  },

  mobileModal: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    zIndex: 2000,
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "stretch"
  },

  mobileModalContent: {
    width: 280,
    background: "#0f1520",
    borderRight: "1px solid #1a2233",
    overflowY: "auto" as const,
    padding: 10
  }

};
const panel = {
  width: 380,
  background: "#0c1420",
  border: "1px solid #0a1828",
  borderRadius: 12,
  padding: 16
};

const box = {
  background: "#070d17",
  border: "1px solid #0a1828",
  padding: 10,
  borderRadius: 8,
  marginTop: 10,
  fontSize: 12,
  color: "#4a6080"
};

const value = {
  color: "#e0eaf5",
  fontWeight: 700,
  fontSize: 14
};

const input = {
  flex: 1,
  padding: 8,
  background: "#070d17",
  border: "1px solid #0a1828",
  borderRadius: 6,
  width: "100%",
  color: "#e0eaf5"
};

const primary = {
  flex: 1,
  padding: 10,
  background: "#00d084",
  border: 0,
  borderRadius: 6,
  fontWeight: 700
};

const danger = {
  flex: 1,
  padding: 10,
  background: "#ff4757",
  border: 0,
  borderRadius: 6,
  fontWeight: 700,
  color: "#000"
};



  return (
    <>
      <div style={styles.page}>

        {/* TOP BAR */}
        <div style={styles.topBar}>
          <div style={styles.symbol} onClick={() => { isMobile ? setShowPairsModal(!showPairsModal) : setShowPrices(!showPrices);}}>
            {PAIR_DISPLAY[sel]}
            <span style={{ color: ticker?.changePct! >= 0 ? "#00d084" : "#ff4757", transition: "color 0.25s" }}>
              {ticker?.price}
            </span>
          </div>

          <div style={styles.metrics}>
            <span>RSI {RSI.toFixed(1)}</span>
            <span>MACD {MACD.hist.toFixed(3)}</span>
            <span>H {ticker?.high24h}</span>
            <span>L {ticker?.low24h}</span>
          </div>
        </div>

     <div
  style={{
    ...styles.grid,
    flexDirection: isMobile ? "column" : "row"
  }}
>
  {/* DESKTOP LEFT PANEL */}
  {!isMobile && showPrices && (
    <div style={styles.leftPanel}>
      {tickers.map(t => (
        <div
          key={t.symbol}
          onClick={() => setSel(t.symbol)}
          style={styles.pair}
        >
          <div>{PAIR_DISPLAY[t.symbol]}</div>

          <div
            style={{
              color: t.changePct >= 0 ? "#00d084" : "#ff4757"
            }}
          >
            {t.changePct.toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  )}

  {/* CENTER CHART */}
  <div style={styles.center}>
    <ProTradingChart1
      candles={candles}
      trades={trades}
      symbol={sel}
      timeframe={iv}
      onTimeframeChange={setIv}
      onTradeClick={setSelectedTrade}
    />

    {selectedTrade && (
      <TradeModal
        trade={selectedTrade}
        currentPrice={candles[candles.length - 1]?.close || 0}
        onClose={() => setSelectedTrade(null)}
        onUpdate={(updates: any) => {
          setTrades(prev =>
            prev.map(t =>
              t.id === selectedTrade.id
                ? { ...t, ...updates }
                : t
            )
          )
        }}
      />
    )}
  </div>

  {/* RIGHT PANEL */}
  <div style={styles.rightPanel}>
    {renderOrderPanel()}
  </div>
</div>
{/* MOBILE PAIRS BUTTON */}
{isMobile && (
  <>
    <button
      style={styles.mobilePairsButton}
      onClick={() => setShowPairsModal(true)}
    >
      Pairs
    </button>

    {showPairsModal && (
      <div
        style={styles.mobileModal}
        onClick={() => setShowPairsModal(false)}
      >
        <div
          style={styles.mobileModalContent}
          onClick={(e) => e.stopPropagation()}
        >
          {tickers.map(t => (
            <div
              key={t.symbol}
              onClick={() => {
                setSel(t.symbol);
                setShowPairsModal(false);
              }}
              style={styles.pair}
            >
              <div>{PAIR_DISPLAY[t.symbol]}</div>

              <div
                style={{
                  color:
                    t.changePct >= 0
                      ? "#00d084"
                      : "#ff4757"
                }}
              >
                {t.changePct.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </>
)}
         {/* BOTTOM: TRADES */}
      <div style={styles.bottom}>
        {renderTrades()}
      </div>
      </div>

       {editing && (
  <div style={{position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999}} onClick={() => setEditing(null)} >
    
    <div onClick={e => e.stopPropagation()} style={panel}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#e0eaf5", fontWeight: 700 }}>
            {editing.pair}
          </div>
          <div style={{ color: "#4a6080", fontSize: 11 }}>
            {editing.bot_id ? "Bot Trade" : "Manual Trade"}
          </div>
        </div>

        <div style={{
          color: editing.status === "OPEN" ? "#00d084" : "#ff4757",
          fontWeight: 700
        }}>
          {editing.status}
        </div>
      </div>

      {/* LIVE PRICE */}
      <div style={box}>
        <div>Live Price</div>
        <div style={value}>
          ${ticker?.price?.toFixed(4) || "—"}
        </div>
      </div>

      {/* ENTRY */}
      <div style={box}>
        <div>Entry Price</div>
        <div style={value}>
          ${editing.price.toFixed(4)}
        </div>
      </div>

      {/* PNL */}
      <div style={box}>
        <div>Unrealized P&L</div>
        <div style={{
          ...value,
          color: (editing.pnl || 0) >= 0 ? "#00d084" : "#ff4757"
        }}>
          ${(editing.pnl || 0).toFixed(4)}
        </div>
      </div>

      {/* STOP LOSS / TAKE PROFIT */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="Stop Loss"
          value={editing.sl || ""}
          onChange={e =>
            setEditing({ ...editing, sl: e.target.value })
          }
          style={input}
        />

        <input
          placeholder="Take Profit"
          value={editing.tp || ""}
          onChange={e =>
            setEditing({ ...editing, tp: e.target.value })
          }
          style={input}
        />
      </div>

      {/* ACTIONS */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>

        <button
          style={primary}
          onClick={() => {
            setTrades((prev: any[]) =>
              prev.map(t =>
                t.id === editing.id ? editing : t
              )
            );
            setEditing(null);
            notify("Trade updated", "success");
          }}
        >
          Save
        </button>

        <button
          style={danger}
          onClick={() => {
            setTrades((prev: any[]) =>
              prev.map(t =>
                t.id === editing.id
                  ? { ...t, status: "CLOSED" }
                  : t
              )
            );
            setEditing(null);
            notify("Trade closed", "info");
          }}
        >
          Close Trade
        </button>

      </div>

    </div>
  </div>
)}
     
    </>

  );
}