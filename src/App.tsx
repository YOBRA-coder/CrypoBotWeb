// App.tsx — NexusAI Trading Platform
import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useWebSocket } from "./hooks/useWebSocket";
import type { Ticker, Bot, Trade, Signal, Strategy, Page } from "./types";
import { PAIR_DISPLAY } from "./types";
import { marketApi, signalsApi, botsApi, tradesApi, strategiesApi } from "./api/client";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import TradingPage from "./pages/TradingPage";
import SignalsPage from "./pages/SignalsPage";
import BotsPage from "./pages/BotsPage";
import StrategyPage from "./pages/StrategyPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

// ── CSS injection ─────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #070d17; color: #e0eaf5; font-family: 'IBM Plex Mono', monospace; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #040a12; }
  ::-webkit-scrollbar-thumb { background: #1a2535; border-radius: 3px; }
  select option { background: #090f1a; color: #e0eaf5; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { to{transform:rotate(360deg)} }
  .nav-item:hover { background: #0d1a2a !important; color: #e0eaf5 !important; }
  input:focus, select:focus { border-color: #00d084 !important; box-shadow: 0 0 0 2px #00d08420 !important; outline: none !important; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button:not(:disabled):hover { opacity: 0.85; }
  tr:hover > td { background: #0c1420 !important; }
`;
if (!document.getElementById("nxcss")) {
  const el = document.createElement("style");
  el.id = "nxcss"; el.textContent = css;
  document.head.appendChild(el);
}

export default function App() {
  return <AuthProvider><Router /></AuthProvider>;
}

function Router() {
  const { auth } = useAuth();
  const [page, setPage] = useState<"login" | "signup">("login");
  if (!auth.user) {
    return page === "login"
      ? <LoginPage onSwitch={() => setPage("signup")} />
      : <SignupPage onSwitch={() => setPage("login")} />;
  }
  return <MainShell />;
}

// ── Main Shell ────────────────────────────────────────────────────────────────
function MainShell() {
  const { auth, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [sideOpen, setSideOpen] = useState(true);
  const [clock, setClock] = useState(new Date().toLocaleTimeString());
  const [notif, setNotif] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // State fed from both HTTP init and WebSocket updates
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [wsStatus, setWsStatus] = useState<"connecting" | "live" | "offline">("connecting");

  const notify = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setNotif({ msg, type });
    setTimeout(() => setNotif(null), 3800);
  }, []);

  // HTTP initial load
  useEffect(() => {
    if (!auth.token) return;
    Promise.all([
      botsApi.list(auth.token),
      tradesApi.list(auth.token),
      signalsApi.list(auth.token),
      strategiesApi.list(auth.token),
      marketApi.tickers(),
    ]).then(([b, t, s, st, tk]) => {
      setBots(b); setTrades(t); setSignals(s); setStrategies(st); setTickers(tk);
    }).catch(e => notify("Load error: " + e.message, "error"));
  }, [auth.token]);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(id);
  }, []);

  // WebSocket
  const { connected } = useWebSocket(auth.token, {
    onTickers: (t) => { setTickers(t); setWsStatus("live"); },
    onBotsUpdate: (b) => setBots(b),
    onNewTrade: (t) => setTrades(prev => [t, ...prev.slice(0, 499)]),
    onNewSignals: (s) => setSignals(prev => [...s, ...prev].slice(0, 100)),
    onInit: ({ bots: b, trades: t, signals: s }) => {
      setBots(b); setTrades(t); setSignals(s); setWsStatus("live");
    },
  });

  useEffect(() => {
    if (!connected) setWsStatus(ws => ws === "live" ? "offline" : "connecting");
    else setWsStatus("live");
  }, [connected]);

  const nav: { id: Page; icon: string; label: string }[] = [
    { id: "dashboard", icon: "◈", label: "Dashboard" },
    { id: "trading", icon: "◎", label: "Live Trading" },
    { id: "signals", icon: "◉", label: "Signals" },
    { id: "bots", icon: "⬡", label: "Bots" },
    { id: "strategy", icon: "◇", label: "Strategy" },
    { id: "history", icon: "◫", label: "History" },
    { id: "settings", icon: "⊕", label: "Settings" },
  ];

  const pp = { tickers, signals, setSignals, bots, setBots, trades, setTrades, strategies, setStrategies, notify };

  const statusColor = wsStatus === "live" ? "#00d084" : wsStatus === "offline" ? "#ff4757" : "#ffd700";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#070d17" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: sideOpen ? 220 : 58, flexShrink: 0, background: "#070d17", borderRight: "1px solid #0a1828", display: "flex", flexDirection: "column", transition: "width .2s ease", overflow: "hidden" }}>
        <div style={{ padding: "16px 10px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer", borderBottom: "1px solid #0a1828", flexShrink: 0 }} onClick={() => setSideOpen(x => !x)}>
          <span style={{ color: "#00d084", fontSize: 22, flexShrink: 0 }}>⬡</span>
          {sideOpen && <span style={{ color: "#e0eaf5", fontWeight: 900, fontSize: 15, letterSpacing: 3, whiteSpace: "nowrap" }}>NEXUS<span style={{ color: "#00d084" }}>AI</span></span>}
        </div>

        <nav style={{ flex: 1, padding: "8px 6px", overflowY: "auto" }}>
          {nav.map(n => (
            <div key={n.id} className="nav-item"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: 7, cursor: "pointer", marginBottom: 2, transition: "all .15s", color: page === n.id ? "#00d084" : "#4a6080", background: page === n.id ? "#0d1a2a" : "transparent", borderLeft: `2px solid ${page === n.id ? "#00d084" : "transparent"}` }}
              onClick={() => setPage(n.id)}>
              <span style={{ fontSize: 13, width: 18, textAlign: "center", flexShrink: 0 }}>{n.icon}</span>
              {sideOpen && <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{n.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid #0a1828", padding: "8px 6px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", cursor: "pointer", borderRadius: 7 }} onClick={() => setPage("settings")}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#00d084,#0094ff)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: "#000", flexShrink: 0 }}>
              {auth.user?.name?.[0]?.toUpperCase()}
            </div>
            {sideOpen && (
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e0eaf5", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.user?.name}</div>
                <div style={{ color: "#2e4060", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.user?.email}</div>
              </div>
            )}
          </div>
          {sideOpen && <div style={{ color: "#2e4060", fontSize: 10, padding: "5px 9px", cursor: "pointer", marginTop: 2 }} onClick={logout}>⏻ Sign out</div>}
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Topbar */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", height: 50, borderBottom: "1px solid #0a1828", background: "#070d17", flexShrink: 0 }}>
          <div style={{ color: "#e0eaf5", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
            {nav.find(n => n.id === page)?.label?.toUpperCase()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${statusColor}18`, border: `1px solid ${statusColor}44`, borderRadius: 20, padding: "3px 9px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, animation: wsStatus === "live" ? "pulse 2s infinite" : "none" }} />
              <span style={{ color: statusColor, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>{wsStatus.toUpperCase()}</span>
            </div>
            <span style={{ color: "#2e4060", fontSize: 10, fontFamily: "monospace" }}>{clock}</span>
          </div>
        </header>

        {/* Ticker Tape */}
        {tickers.length > 0 && (
          <div style={{ background: "#040a12", borderBottom: "1px solid #0a1828", height: 32, overflow: "hidden", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 24, padding: "0 14px", animation: "ticker 55s linear infinite", whiteSpace: "nowrap" }}>
              {[...tickers, ...tickers].map((t, i) => (
                <span key={i} style={{ fontSize: 11, display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <span style={{ color: "#e0eaf5", fontWeight: 700 }}>{PAIR_DISPLAY[t.symbol] || t.symbol}</span>
                  <span style={{ color: "#6080a0" }}>${t.price < 1 ? t.price.toFixed(4) : t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  <span style={{ color: t.changePct >= 0 ? "#00d084" : "#ff4757", fontWeight: 600 }}>{t.changePct >= 0 ? "▲" : "▼"}{Math.abs(t.changePct).toFixed(2)}%</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {page === "dashboard"  && <DashboardPage {...pp} />}
          {page === "trading"    && <TradingPage {...pp} />}
          {page === "signals"    && <SignalsPage {...pp} />}
          {page === "bots"       && <BotsPage {...pp} />}
          {page === "strategy"   && <StrategyPage {...pp} />}
          {page === "history"    && <HistoryPage {...pp} />}
          {page === "settings"   && <SettingsPage notify={notify} />}
        </main>
      </div>

      {/* Notification toast */}
      {notif && (
        <div style={{ position: "fixed", bottom: 22, right: 22, zIndex: 9999, animation: "fadeUp .3s ease", maxWidth: 360, borderRadius: 10, padding: "11px 18px", color: "#000", fontWeight: 700, fontSize: 12, letterSpacing: 0.5, background: notif.type === "success" ? "#00d084" : notif.type === "error" ? "#ff4757" : "#0094ff", boxShadow: "0 8px 32px #00000060" }}>
          {notif.msg}
          {notif.type=="success"? "Successful" : "Failed."}
          {notif.type}
   
        </div>
      )}
    </div>
  );
}
