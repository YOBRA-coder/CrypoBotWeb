// pages/styles.ts — Shared style tokens
import type { CSSProperties } from "react";

export const authBg: CSSProperties = {
  minHeight: "100vh", background: "#050c16", display: "flex", alignItems: "center",
  justifyContent: "center", position: "relative", overflow: "hidden",
  fontFamily: "'IBM Plex Mono', monospace",
  backgroundImage: "linear-gradient(#0a1828 1px,transparent 1px),linear-gradient(90deg,#0a1828 1px,transparent 1px)",
  backgroundSize: "44px 44px",
};

export const S: Record<string, CSSProperties> = {
  authGlow: { position: "absolute", width: 500, height: 500, background: "radial-gradient(circle,#00d08420 0%,transparent 65%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" },
  authCard: { background: "#080e18", border: "1px solid #0d1a2a", borderRadius: 14, padding: "38px 34px", width: 400, maxWidth: "92vw", position: "relative", zIndex: 1, boxShadow: "0 24px 80px #00000090" },
  authSub: { color: "#2e4060", textAlign: "center", marginBottom: 28, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  fg: { marginBottom: 12 },
  lbl: { display: "block", color: "#2e4060", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" },
  inp: { width: "100%", background: "#040a12", border: "1px solid #0d1a2a", borderRadius: 7, padding: "9px 12px", color: "#e0eaf5", fontSize: 12, fontFamily: "'IBM Plex Mono',monospace", transition: "border-color .15s, box-shadow .15s" },
  btn: { width: "100%", background: "#00d084", color: "#000", border: "none", borderRadius: 7, padding: "11px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: 1 },
  btnO: { background: "transparent", border: "1px solid #1a2535", borderRadius: 7, padding: "9px 16px", color: "#4a6080", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 },
  err: { background: "#ff475718", border: "1px solid #ff475744", borderRadius: 7, padding: "9px 12px", color: "#ff4757", fontSize: 11, marginBottom: 12 },
  card: { background: "#080e18", border: "1px solid #0a1828", borderRadius: 12, padding: "15px 17px" },
  ch: { color: "#2e4060", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 13, paddingBottom: 9, borderBottom: "1px solid #0a1828" },
  pill: { display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "3px 8px", fontSize: 9, fontWeight: 700 },
};
