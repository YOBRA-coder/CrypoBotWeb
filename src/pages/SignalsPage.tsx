// pages/SignalsPage.tsx
import { useState } from "react";
import type { PageProps } from "./shared";
import { PAIR_DISPLAY } from "../types";
import { signalsApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { S } from "./styles";
import { useNavigate } from "react-router";

export default function SignalsPage({ signals, setSignals, notify }: PageProps) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [gen, setGen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
    const [sendingCopy, setSendingCopy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL" | "HOLD">("ALL");

  const generate = async () => {
    if (!auth.token) return;
    setGen(true);
    try {
      const results = await signalsApi.generate(auth.token);
      setSignals(prev => [...results, ...prev].slice(0, 100));
      notify(`${results.length} signals generated!`, "success");
    } catch (e: any) { notify(e.message, "error"); }
    setGen(false);
  };

  const sendTG = async (s: typeof signals[0]) => {
    if (!auth.token) return;
    setSending(s.id);
    try {
      await signalsApi.sendTelegram(auth.token, s.id);
      notify("Signal sent to Telegram! ✈", "success");
    } catch (e: any) { notify(e.message || "Telegram failed", "error"); }
    setSending(null);
  };

  const copyTrade = async (s: typeof signals[0]) => {
    if (!auth.token) return;
    setSendingCopy(s.id);
    try {
      await signalsApi.copy(auth.token, s.id );
      notify("Signal copied to trade! ✈", "success");
    } catch (e: any) { notify(e.message || "Copy trade failed", "error"); }
    setSendingCopy(null);
  };



  const filtered = filter === "ALL" ? signals : signals.filter(s => s.type === filter);

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button style={{ ...S.btn, width: "auto", padding: "9px 18px" }} onClick={generate} disabled={gen}>
          {gen ? "⏳ Scanning..." : "⚡ Generate Signals"}
        </button>
        {(["ALL", "BUY", "SELL", "HOLD"] as const).map(f => (
          <div key={f} style={{ background: filter === f ? "#00d08422" : "#0c1420", border: `1px solid ${filter === f ? "#00d084" : "#0a1828"}`, color: filter === f ? "#00d084" : "#4a6080", borderRadius: 7, padding: "7px 14px", cursor: "pointer", fontSize: 11 }} onClick={() => setFilter(f)}>{f}</div>
        ))}
        <span style={{ color: "#2e4060", fontSize: 10, marginLeft: "auto" }}>{filtered.length} signals</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "70px 0", color: "#1a2535" }}>
          <div style={{ fontSize: 44 }}>◉</div>
          <div style={{ color: "#2e4060", marginTop: 10, fontWeight: 600, fontSize: 13 }}>Generate signals to see them here</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 11 }}>
        {filtered.map(s => {
          const tp = s.target_price ?? s.targetPrice ?? s.price;
          const sl = s.stop_loss ?? s.stopLoss ?? s.price;
          const isAI = !!(s.ai_generated || s.aiGenerated);
          return (
            <div key={s.id} style={{ background: "#0c1420", border: `1px solid ${s.type === "BUY" ? "#00d08444" : s.type === "SELL" ? "#ff475744" : "#ffd70044"}`, borderRadius: 11, padding: 15, }} >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }} onClick={() => navigate('/trading?pair=' + s.pair)}>
                  <span style={{ color: "#e0eaf5", fontWeight: 800, fontSize: 14 }}>{PAIR_DISPLAY[s.pair] || s.pair}</span>
                  {isAI && <span style={{ background: "#0094ff18", border: "1px solid #0094ff44", color: "#0094ff", fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>AI</span>}
                </div>
                <span style={{ background: s.type === "BUY" ? "#00d084" : s.type === "SELL" ? "#ff4757" : "#ffd700", color: "#000", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4 }}>{s.type}</span>
              </div>
              <p style={{ color: "#4a6080", fontSize: 10, marginBottom: 10, lineHeight: 1.55 }}>{s.reason}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 10 }}>
                {[{ l: "ENTRY", v: "$" + (s.price || 0).toFixed(4), c: "#e0eaf5" }, { l: "TARGET", v: "$" + (tp || 0).toFixed(4), c: "#00d084" }, { l: "STOP", v: "$" + (sl || 0).toFixed(4), c: "#ff4757" }].map(m => (
                  <div key={m.l} style={{ background: "#060c14", border: "1px solid #0a1828", borderRadius: 6, padding: "6px 7px" }}>
                    <div style={{ color: "#2e4060", fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>{m.l}</div>
                    <div style={{ color: m.c, fontWeight: 700, fontSize: 10, marginTop: 1 }}>{m.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ background: "#040a12", borderRadius: 8, overflow: "hidden", width: 60, height: 4 }}>
                    <div style={{ width: `${s.confidence}%`, height: "100%", background: s.type === "BUY" ? "#00d084" : s.type === "SELL" ? "#ff4757" : "#ffd700" }} />
                  </div>
                  <span style={{ color: "#4a6080", fontSize: 9 }}>{(s.confidence || 0).toFixed(0)}%</span>
                </div>
                <button style={{ background: "#0094ff18", border: "1px solid #0094ff44", color: "#0094ff", borderRadius: 6, padding: "4px 11px", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }} onClick={() => copyTrade(s)} disabled={sendingCopy === s.id}>
                  {sendingCopy === s.id ? "..." : "✈ Copy"}
                </button>
                <button style={{ background: "#0094ff18", border: "1px solid #0094ff44", color: "#0094ff", borderRadius: 6, padding: "4px 11px", cursor: "pointer", fontSize: 10, fontFamily: "inherit" }} onClick={() => sendTG(s)} disabled={sendingCopy === s.id}>
                  {sending === s.id ? "..." : "✈ Send"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
