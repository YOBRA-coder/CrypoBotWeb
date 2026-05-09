// pages/BotsPage.tsx
import { useState } from "react";
import type { PageProps } from "./shared";
import { PAIR_DISPLAY, PAIRS } from "../types";
import { botsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { S } from "./styles";
import { useParams } from "react-router-dom";

const STRATEGIES = ["RSI Scalper", "EMA Cross", "Grid Trading", "MACD Divergence", "Bollinger Squeeze"];

export default function BotDetails({
  bots, setBots, tickers, notify
}: PageProps) {
  const { id } = useParams();
  const bot = bots.find((b: any) => String(b.id) === id); 
  const { auth } = useAuth();  


  const toggle = async (id: string, current: string) => {
    if (!auth.token) return;
    const newStatus = current === "RUNNING" ? "STOPPED" : "RUNNING";
    try {
      const updated = await botsApi.update(auth.token, id, { status: newStatus });
      setBots(prev => prev.map(b => b.id === id ? updated : b));
      notify(`Bot ${newStatus.toLowerCase()}`, "success");
    } catch (e: any) { notify(e.message, "error"); }
  };

  const remove = async (id: string, name: string) => {
    if (!auth.token || !confirm(`Remove bot "${name}"?`)) return;
    try {
      await botsApi.delete(auth.token, id);
      setBots(prev => prev.filter(b => b.id !== id));
      notify("Bot removed", "info");
    } catch (e: any) { notify(e.message, "error"); }
  };


  if (!bot) {
    return (
      <div style={{ color: "white" }}>
        Bot not found
      </div>
    );
  } 
 const t = tickers.find(t => t.symbol === bot.pair);
  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 13, alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ l: "Running", c: "#00d084", n: bots.filter(b => b.status === "RUNNING").length },
            { l: "Paused", c: "#ffd700", n: bots.filter(b => b.status === "PAUSED").length },
            { l: "Stopped", c: "#2e4060", n: bots.filter(b => b.status === "STOPPED").length }].map(s => (
            <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 5, background: "#0c1420", border: "1px solid #0a1828", borderRadius: 7, padding: "5px 11px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.c }} />
              <span style={{ color: "#e0eaf5", fontWeight: 700, fontSize: 12 }}>{s.n}</span>
              <span style={{ color: "#4a6080", fontSize: 11 }}>{s.l}</span>
            </div>
          ))}
        </div>
    
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 11 }}>
        {}
         {bot && (
          <div style={{ background: "#0c1420", border: "1px solid #0a1828", borderRadius: 12, padding: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 11 }}>
              <div>
                <div style={{ color: "#e0eaf5", fontWeight: 800, fontSize: 14 }}>{bot.name}</div>
                <div style={{ color: "#2e4060", fontSize: 10, marginTop: 2 }}>{PAIR_DISPLAY[bot.pair] || bot.pair} • {bot.strategy}</div>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                {bot.current_position && (
                  <span style={{ background: bot.current_position === "LONG" ? "#00d08418" : "#ff475718", border: `1px solid ${bot.current_position === "LONG" ? "#00d084" : "#ff4757"}`, color: bot.current_position === "LONG" ? "#00d084" : "#ff4757", fontSize: 8, padding: "2px 5px", borderRadius: 3, fontWeight: 700 }}>{bot.current_position}</span>  
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 3, background: bot.status === "RUNNING" ? "#00d08418" : bot.status === "PAUSED" ? "#ffd70018" : "#2e406018", border: `1px solid ${bot.status === "RUNNING" ? "#00d08444" : bot.status === "PAUSED" ? "#ffd70044" : "#2e406044"}`, borderRadius: 20, padding: "2px 7px" }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: bot.status === "RUNNING" ? "#00d084" : bot.status === "PAUSED" ? "#ffd700" : "#2e4060" }} />
                  <span style={{ color: bot.status === "RUNNING" ? "#00d084" : bot.status === "PAUSED" ? "#ffd700" : "#2e4060", fontSize: 8, fontWeight: 700 }}>{bot.status}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 11 }}>
              {[{ l: "P&L", v: `${bot.profit >= 0 ? "+" : ""}$${bot.profit.toFixed(2)}`, c: bot.profit >= 0 ? "#00d084" : "#ff4757" },
                { l: "WIN %", v: `${(bot.win_rate || 0).toFixed(1)}%`, c: "#e0eaf5" },
                { l: "TRADES", v: bot.trades.toString(), c: "#e0eaf5" },
                { l: "CAPITAL", v: `$${bot.capital >= 1000 ? (bot.capital / 1000).toFixed(1) + "K" : bot.capital}`, c: "#e0eaf5" }].map(m => (
                <div key={m.l} style={{ background: "#060c14", border: "1px solid #0a1828", borderRadius: 7, padding: "6px 7px", textAlign: "center" }}>
                  <div style={{ color: "#2e4060", fontSize: 7, fontWeight: 700, letterSpacing: 1 }}>{m.l}</div>
                  <div style={{ color: m.c, fontWeight: 800, fontSize: 12, marginTop: 2 }}>{m.v}</div>
                </div>
              ))}
            </div>
            {t && (
              <div style={{ color: "#2e4060", fontSize: 10, marginBottom: 11 }}>
                Price: <span style={{ color: "#e0eaf5" }}>${t.price < 1 ? t.price.toFixed(4) : t.price.toFixed(2)}</span>
                <span style={{ color: t.changePct >= 0 ? "#00d084" : "#ff4757", marginLeft: 8 }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 5 }}>
              <button style={{ flex: 1, padding: "7px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background
                : bot.status === "RUNNING" ? "#ff475718" : "#00d08418", border: `1px solid ${bot.status === "RUNNING" ? "#ff4757" : "#00d084"}`, color: bot.status === "RUNNING" ? "#ff4757" : "#00d084" }} onClick={() => toggle(bot.id, bot.status)}>
                {bot.status === "RUNNING" ? "⏹ Stop" : "▶ Start"}
              </button>
              <button style={{ padding: "7px 11px", borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid #0a1828", color: "#2e4060", fontFamily: "inherit" }} onClick={() => remove(bot.id, bot.name)}>🗑</button>
            </div>
          </div>
        )}

      </div>

      <div style={{ height: 11 }} />

      {bot && (
        <div style={{ background: "#0c1420", border: "1px solid #0a1828", borderRadius: 12, padding: 15 }}>
          <div style={{ color: "#e0eaf5", fontWeight: 800, fontSize: 14, marginBottom: 11 }}>Edit Bot</div>
          <div style={{ display: "flex", gap: 11, flexWrap: "wrap", alignItems: "center" }}>
            <div style={S.fg}>
              <label style={S.lbl}>Name</label>
              <input style={S.inp} value={bot.name} onChange={e => setBots(prev => prev.map(b => b.id === bot.id ? { ...b, name: e.target.value } : b))} />
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Pair</label>   
              <select style={S.inp} value={bot.pair} onChange={e => setBots(prev => prev.map(b => b.id === bot.id ? { ...b, pair: e.target.value } : b))}>{PAIRS.map(p => <option key={p} value={p}>{PAIR_DISPLAY[p]}</option>)}</select> 
            </div>
            <div style={S.fg}>
              <label style={S.lbl}>Strategy</label>
              <select style={S.inp} value={bot.strategy} onChange={e => setBots(prev => prev.map(b => b.id === bot.id ? { ...b, strategy: e.target.value } : b))}>{STRATEGIES.map(s => <option key={s}>{s}</option>)}</select>
            </div>
            <button style={{ ...S.btn, width: "auto", padding: "9px 18px" }} onClick={() => toggle(bot.id, bot.status === "RUNNING" ? "RUNNING" : "PAUSED")}>{bot.status === "RUNNING" ? "⏸ Pause" : "▶ Start"}</button>
           </div>
        </div>
      )}

      {!bot && (<>
      
      </>)}
      </div>

  );
}
