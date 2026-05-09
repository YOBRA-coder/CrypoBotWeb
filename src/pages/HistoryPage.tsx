// pages/HistoryPage.tsx
import { useEffect, useState } from "react";
import type { PageProps } from "./shared";
import { PAIR_DISPLAY } from "../types";
import { S } from "./styles";

export default function HistoryPage({ trades, setTrades, notify, tickers }: PageProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const filtered = filter === "ALL" ? trades : trades.filter(t => t.side === filter);
  const pnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = trades.filter(t => (t.pnl || 0) > 0).length;
  const ts = (t: typeof trades[0]) => t.created_at ? t.created_at * 1000 : t.timestamp || 0;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const [editing, setEditing] = useState<any | null>(null);
  const ticker = tickers.find(t => t.symbol === editing?.pair);
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const getPages = () => {
    const pages: number[] = [];

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  const overlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999};

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
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 13, flexWrap: "wrap", alignItems: "center" }}>
        {(["ALL", "BUY", "SELL"] as const).map(f => (
          <div key={f} style={{ background: filter === f ? "#00d08422" : "#0c1420", border: `1px solid ${filter === f ? "#00d084" : "#0a1828"}`, color: filter === f ? "#00d084" : "#4a6080", borderRadius: 7, padding: "6px 13px", cursor: "pointer", fontSize: 11 }} onClick={() => setFilter(f)}>{f}</div>
        ))}
        {[{ l: "P&L", v: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, c: pnl >= 0 ? "#00d084" : "#ff4757" },
        { l: "Win %", v: `${trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : 0}%`, c: "#0094ff" },
        { l: "Total", v: trades.length.toString(), c: "#e0eaf5" }].map(s => (
          <div key={s.l} style={{ display: "flex", gap: 7, alignItems: "center", background: "#0c1420", border: "1px solid #0a1828", borderRadius: 7, padding: "5px 12px", fontSize: 11 }}>
            <span style={{ color: "#2e4060" }}>{s.l}</span>
            <span style={{ color: s.c, fontWeight: 700 }}>{s.v}</span>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "70px 0", color: "#1a2535" }}>
          <div style={{ fontSize: 44 }}>◫</div>
          <div style={{ color: "#2e4060", marginTop: 10, fontSize: 13, fontWeight: 600 }}>No trades yet</div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ overflowX: "auto" }}>
 

            {/* table of trades with columns time, pair, side, price, amount, total, fee, pnl, source (bot/manual), status (open/closed) , pop up view and edit plus pagination */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Time", "Pair", "Side", "Price", "Amount", "Total", "Fee", "P&L", "Source", "Status"].map(h => (
                  <th key={h} style={{ color: "#2e4060", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, padding: "7px 11px", textAlign: "left", borderBottom: "1px solid #0a1828", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {paginated.map(t => (
                  <tr key={t.id} onClick={() => setEditing(t)} style={{ background: editing?.id === t.id ? "#00d08411" : "transparent", cursor: "pointer" }}>
                    <td style={{ color: "#4a6080", fontSize: 10, padding: "8px 11px", whiteSpace: "nowrap" }}>{new Date(ts(t)).toLocaleString()}</td>
                    <td style={{ color: "#e0eaf5", fontWeight: 700, fontSize: 11, padding: "8px 11px" }}>{PAIR_DISPLAY[t.pair] || t.pair}</td>
                    <td style={{ padding: "8px 11px" }}><span style={{ color: t.side === "BUY" ? "#00d084" : "#ff4757", fontWeight: 700, fontSize: 10 }}>{t.side}</span></td>
                    <td style={{ color: "#8090a8", fontSize: 10, padding: "8px 11px", fontFamily: "monospace" }}>${t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ color: "#8090a8", fontSize: 10, padding: "8px 11px", fontFamily: "monospace" }}>{t.amount.toFixed(4)}</td>
                    <td style={{ color: "#8090a8", fontSize: 10, padding: "8px 11px", fontFamily: "monospace" }}>${t.total.toFixed(2)}</td>
                    <td style={{ color: "#2e4060", fontSize: 10, padding: "8px 11px", fontFamily: "monospace" }}>${t.fee.toFixed(4)}</td>
                    <td style={{ padding: "8px 11px" }}><span style={{ color: (t.pnl || 0) >= 0 ? "#00d084" : "#ff4757", fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>{(t.pnl || 0) >= 0 ? "+" : ""}${(t.pnl || 0).toFixed(4)}</span></td>
                    <td style={{ color: "#2e4060", fontSize: 9, padding: "8px 11px" }}>{t.bot_id ? "Bot" : "Manual"}</td>
                    <td style={{ color: "#2e4060", fontSize: 9, padding: "8px 11px" }}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
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
        </div>
      )}

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
    </div>
  );
}
