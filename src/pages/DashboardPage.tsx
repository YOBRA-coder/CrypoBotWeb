// pages/DashboardPage.tsx
import type { PageProps } from "./shared";
import { PAIR_DISPLAY } from "../types";
import { S } from "./styles";

export default function DashboardPage({ tickers, signals, bots, trades }: PageProps) {
  const totalProfit = bots.reduce((s, b) => s + b.profit, 0);
  const activeBots = bots.filter(b => b.status === "RUNNING").length;
  const activeSignals = signals.filter(s => s.status === "ACTIVE").length;
  const todayTrades = trades.filter(t => Date.now() - ((t.created_at || 0) * 1000 || t.timestamp || 0) < 86400000).length;

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        {[
          { l: "Total P&L", v: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`, c: totalProfit >= 0 ? "#00d084" : "#ff4757", sub: "All bots" },
          { l: "Active Bots", v: activeBots.toString(), c: "#0094ff", sub: `${bots.length} total` },
          { l: "AI Signals", v: activeSignals.toString(), c: "#ffd700", sub: "Active" },
          { l: "Today Trades", v: todayTrades.toString(), c: "#ff6b8a", sub: "Executed" },
        ].map(s => (
          <div key={s.l} style={S.card}>
            <div style={{ color: "#2e4060", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{s.l}</div>
            <div style={{ color: s.c, fontSize: 26, fontWeight: 800, marginTop: 8, letterSpacing: -0.5 }}>{s.v}</div>
            <div style={{ color: "#2e4060", fontSize: 10, marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Live prices */}
        <div style={S.card}>
          <div style={S.ch}>Live Prices</div>
          {tickers.slice(0, 8).map(t => (
            <div key={t.symbol} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #0a1828" }}>
              <div>
                <span style={{ color: "#e0eaf5", fontWeight: 700, fontSize: 12 }}>{PAIR_DISPLAY[t.symbol] || t.symbol}</span>
                <span style={{ color: "#2e4060", fontSize: 9, marginLeft: 8 }}>{(t.volume24h / 1e6).toFixed(1)}M</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#e0eaf5", fontSize: 11, fontWeight: 600 }}>${t.price < 1 ? t.price.toFixed(4) : t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div style={{ color: t.changePct >= 0 ? "#00d084" : "#ff4757", fontSize: 10, fontWeight: 700 }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%</div>
              </div>
            </div>
          ))}
          {tickers.length === 0 && <div style={{ color: "#2e4060", fontSize: 11, padding: 16, textAlign: "center" }}>Connecting to market data...</div>}
        </div>

        {/* Bot performance */}
        <div style={S.card}>
          <div style={S.ch}>Bot Performance</div>
          {bots.map(bot => (
            <div key={bot.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #0a1828" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: bot.status === "RUNNING" ? "#00d084" : bot.status === "PAUSED" ? "#ffd700" : "#2e4060", flexShrink: 0 }} />
                <div>
                  <div style={{ color: "#e0eaf5", fontSize: 12, fontWeight: 600 }}>{bot.name}</div>
                  <div style={{ color: "#2e4060", fontSize: 10 }}>{PAIR_DISPLAY[bot.pair] || bot.pair} • {bot.trades} trades</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: bot.profit >= 0 ? "#00d084" : "#ff4757", fontWeight: 700, fontSize: 13 }}>{bot.profit >= 0 ? "+" : ""}${bot.profit.toFixed(2)}</div>
                <div style={{ color: "#2e4060", fontSize: 10 }}>{(bot.win_rate || 0).toFixed(1)}% win</div>
              </div>
            </div>
          ))}
          {bots.length === 0 && <div style={{ color: "#2e4060", fontSize: 11, padding: 16, textAlign: "center" }}>No bots yet — create in Bots tab</div>}
        </div>
      </div>

      {/* Signals */}
      <div style={S.card}>
        <div style={S.ch}>Recent Signals</div>
        {signals.length === 0 ? (
          <div style={{ color: "#2e4060", fontSize: 11, padding: 20, textAlign: "center" }}>No signals — generate in Signals tab</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
            {signals.slice(0, 6).map(s => {
              const tp = s.target_price ?? s.targetPrice ?? s.price;
              const sl = s.stop_loss ?? s.stopLoss ?? s.price;
              return (
                <div key={s.id} style={{ background: "#0c1420", border: `1px solid ${s.type === "BUY" ? "#00d08444" : s.type === "SELL" ? "#ff475744" : "#ffd70044"}`, borderRadius: 10, padding: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: "#e0eaf5", fontSize: 13 }}>{PAIR_DISPLAY[s.pair] || s.pair}</span>
                      {(s.ai_generated || s.aiGenerated) && <span style={{ background: "#0094ff18", border: "1px solid #0094ff44", color: "#0094ff", fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>AI</span>}
                    </div>
                    <span style={{ background: s.type === "BUY" ? "#00d084" : s.type === "SELL" ? "#ff4757" : "#ffd700", color: "#000", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 3 }}>{s.type}</span>
                  </div>
                  <div style={{ color: "#4a6080", fontSize: 10, marginBottom: 7, lineHeight: 1.5 }}>{s.reason?.slice(0, 70)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span style={{ color: "#8090a8" }}>${s.price?.toFixed(4)}</span>
                    <span style={{ color: "#00d084" }}>{s.confidence?.toFixed(0)}% conf</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
