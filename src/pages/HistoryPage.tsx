// pages/HistoryPage.tsx
import { useState } from "react";
import type { PageProps } from "./shared";
import { PAIR_DISPLAY } from "../types";
import { S } from "./styles";

export default function HistoryPage({ trades }: PageProps) {
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const filtered = filter === "ALL" ? trades : trades.filter(t => t.side === filter);
  const pnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = trades.filter(t => (t.pnl || 0) > 0).length;
  const ts = (t: typeof trades[0]) => t.created_at ? t.created_at * 1000 : t.timestamp || 0;

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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Time", "Pair", "Side", "Price", "Amount", "Total", "Fee", "P&L", "Source", "Status"].map(h => (
                  <th key={h} style={{ color: "#2e4060", fontSize: 8, fontWeight: 700, letterSpacing: 1.5, padding: "7px 11px", textAlign: "left", borderBottom: "1px solid #0a1828", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
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
        </div>
      )}
    </div>
  );
}
