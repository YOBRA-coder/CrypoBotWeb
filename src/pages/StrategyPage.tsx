// pages/StrategyPage.tsx
import { useState } from "react";
import type { PageProps } from "./shared";
import type { Strategy, BacktestResult } from "../types";
import { strategiesApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { S } from "./styles";

export default function StrategyPage({ strategies, setStrategies, notify }: PageProps) {
  const { auth } = useAuth();
  const [sel, setSel] = useState<Strategy | null>(null);
  const [bt, setBt] = useState(false);
  const [br, setBr] = useState<BacktestResult | null>(null);

  const parseParams = (s: Strategy): Record<string, number> => {
    if (typeof s.parameters === "string") {
      try { return JSON.parse(s.parameters); } catch { return {}; }
    }
    return s.parameters as Record<string, number>;
  };

  const runBacktest = async () => {
    if (!sel || !auth.token) return;
    setBt(true); setBr(null);
    try {
      const result = await strategiesApi.backtest(auth.token, sel.id);
      notify(`Strategy "${sel.name}" finished backtesting!`, "success");
      setBr(result);
    } catch (e: any) { notify(e.message, "error"); }
    setBt(false);
  };

  const updateParam = async (k: string, v: number) => {
    if (!sel || !auth.token) return;
    const params = { ...parseParams(sel), [k]: v };
    const updated = { ...sel, parameters: params };
    setSel(updated);
    try {
      const result = await strategiesApi.update(auth.token, sel.id, params);
      setStrategies(prev => prev.map(s => s.id === sel.id ? result : s));
    } catch {}
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 12, animation: "fadeUp .3s ease" }}>
      <div style={S.card}>
        <div style={S.ch}>Strategies</div>
        {strategies.map(s => (
          <div key={s.id} style={{ padding: "10px", borderRadius: 7, cursor: "pointer", marginBottom: 3, border: `1px solid ${sel?.id === s.id ? "#00d084" : "transparent"}`, background: sel?.id === s.id ? "#0d1a2a" : "transparent" }} onClick={() => { setSel(s); setBr(null); }}>
            <div style={{ color: "#e0eaf5", fontWeight: 700, fontSize: 12 }}>{s.name}</div>
            <div style={{ color: "#2e4060", fontSize: 9, marginTop: 2 }}>{s.win_rate}% win • {s.total_trades} trades</div>
          </div>
        ))}
        {strategies.length === 0 && <div style={{ color: "#2e4060", fontSize: 11, padding: 12, textAlign: "center" }}>No strategies yet</div>}
      </div>

      {sel ? (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ color: "#e0eaf5", fontWeight: 800, fontSize: 18 }}>{sel.name}</div>
            <button style={{ ...S.btn, width: "auto", padding: "8px 16px" }} onClick={runBacktest} disabled={bt}>{bt ? "⏳ Backtesting..." : "▶ Run Backtest"}</button>
          </div>
          <p style={{ color: "#4a6080", fontSize: 12, marginBottom: 18, lineHeight: 1.6 }}>{sel.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
            {[{ l: "Win Rate", v: `${sel.win_rate}%`, c: "#00d084" }, { l: "Profit Factor", v: sel.profit_factor.toFixed(2), c: "#0094ff" },
              { l: "Max DD", v: `${sel.max_drawdown}%`, c: "#ff4757" }, { l: "Trades", v: sel.total_trades.toString(), c: "#ffd700" }].map(m => (
              <div key={m.l} style={{ background: "#060c14", border: "1px solid #0a1828", borderRadius: 9, padding: 13 }}>
                <div style={{ color: "#2e4060", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{m.l}</div>
                <div style={{ color: m.c, fontSize: 20, fontWeight: 800, marginTop: 5 }}>{m.v}</div>
              </div>
            ))}
          </div>
          <div style={S.ch}>Parameters</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 9, marginBottom: 18 }}>
            {Object.entries(parseParams(sel)).map(([k, v]) => (
              <div key={k} style={S.fg}>
                <label style={S.lbl}>{k.replace(/([A-Z])/g, " $1").trim()}</label>
                <input style={S.inp} type="number" value={v} onChange={e => updateParam(k, parseFloat(e.target.value) || 0)} />
              </div>
            ))}
          </div>
          {br && (
            <div style={{ background: "#040a12", border: "1px solid #00d08433", borderRadius: 9, padding: 14 }}>
              <div style={{ color: "#00d084", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>BACKTEST RESULTS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr) repeat(2,1fr)", gap: 9 }}>
                {[{ l: "Net Profit", v: `${br.profit >= 0 ? "+" : ""}$${br.profit.toFixed(2)}`, c: br.profit >= 0 ? "#00d084" : "#ff4757" },
                  { l: "Trades", v: br.trades.toString(), c: "#e0eaf5" },
                  { l: "Win Rate", v: `${br.winRate.toFixed(1)}%`, c: "#0094ff" },
                  { l: "Sharpe", v: br.sharpeRatio.toFixed(2), c: "#ffd700" },
                  { l: "Max DD", v: `${br.maxDrawdown.toFixed(1)}%`, c: "#ff4757" }].map(m => (
                  <div key={m.l} style={{ background: "#060c14", border: "1px solid #0a1828", borderRadius: 7, padding: 11 }}>
                    <div style={{ color: "#2e4060", fontSize: 9 }}>{m.l}</div>
                    <div style={{ color: m.c, fontSize: 18, fontWeight: 800, marginTop: 3 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#1a2535", padding: 60 }}>
          <div style={{ fontSize: 48 }}>◇</div>
          <div style={{ color: "#2e4060", marginTop: 10, fontWeight: 600, fontSize: 13 }}>Select a strategy</div>
        </div>
      )}
    </div>
  );
}
