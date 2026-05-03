// pages/SettingsPage.tsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { settingsApi } from "../api/client";
import { S } from "./styles";

export default function SettingsPage({ notify }: { notify: (msg: string, type?: "success" | "error" | "info") => void }) {
  const { auth, updateUser } = useAuth();
  const [tk, setTk] = useState(auth.user?.telegram_token || "");
  const [ci, setCi] = useState(auth.user?.telegram_chat_id || "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!auth.token) return;
    setSaving(true);
    try {
      await settingsApi.updateTelegram(auth.token, tk, ci);
      updateUser({ telegram_token: tk, telegram_chat_id: ci });
      notify("Settings saved!", "success");
    } catch (e: any) { notify(e.message, "error"); }
    setSaving(false);
  };

  const test = async () => {
    if (!auth.token) return;
    if (!tk || !ci) { notify("Enter token and chat ID first", "error"); return; }
    // Save first
    await settingsApi.updateTelegram(auth.token, tk, ci).catch(() => {});
    setTesting(true);
    try {
      await settingsApi.testTelegram(auth.token);
      notify("✅ Telegram connected!", "success");
    } catch (e: any) { notify(e.message || "Telegram failed — check credentials", "error"); }
    setTesting(false);
  };

  return (
    <div style={{ maxWidth: 580, animation: "fadeUp .3s ease" }}>
      <div style={S.card}>
        <div style={S.ch}>Account</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={S.fg}><label style={S.lbl}>Name</label><input style={{ ...S.inp, opacity: 0.6 }} value={auth.user?.name || ""} disabled /></div>
          <div style={S.fg}><label style={S.lbl}>Email</label><input style={{ ...S.inp, opacity: 0.6 }} value={auth.user?.email || ""} disabled /></div>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 13 }}>
        <div style={S.ch}>✈ Telegram Integration</div>
        <p style={{ color: "#4a6080", fontSize: 11, marginBottom: 14, lineHeight: 1.7 }}>
          Connect Telegram to receive real-time trading signals.<br />
          1. Create bot via <span style={{ color: "#00d084" }}>@BotFather</span><br />
          2. Get your chat ID from <span style={{ color: "#00d084" }}>@userinfobot</span><br />
          3. Add bot to your channel as admin (for channels)
        </p>
        <div style={S.fg}><label style={S.lbl}>Bot Token</label><input style={S.inp} value={tk} onChange={e => setTk(e.target.value)} placeholder="1234567890:AABBB..." /></div>
        <div style={S.fg}><label style={S.lbl}>Chat ID or @channel</label><input style={S.inp} value={ci} onChange={e => setCi(e.target.value)} placeholder="-1001234567890 or @mychannel" /></div>
        <div style={{ display: "flex", gap: 9, marginTop: 4 }}>
          <button style={S.btn} onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
          <button style={S.btnO} onClick={test} disabled={testing}>{testing ? "Testing..." : "Test Connection"}</button>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 13 }}>
        <div style={S.ch}>Backend Connection</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { l: "API URL", v: import.meta.env.VITE_API_URL || "http://localhost:8000" },
            { l: "WebSocket", v: (import.meta.env.VITE_WS_URL || "ws://localhost:8000") + "/ws/{token}" },
          ].map(s => (
            <div key={s.l} style={{ background: "#060c14", border: "1px solid #0a1828", borderRadius: 7, padding: 11 }}>
              <div style={{ color: "#2e4060", fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{s.l}</div>
              <div style={{ color: "#4a6080", fontSize: 10, fontFamily: "monospace", wordBreak: "break-all" }}>{s.v}</div>
            </div>
          ))}
        </div>
        <p style={{ color: "#4a6080", fontSize: 11, lineHeight: 1.6 }}>
          Set <code style={{ color: "#00d084", fontSize: 10 }}>VITE_API_URL</code> and <code style={{ color: "#00d084", fontSize: 10 }}>VITE_WS_URL</code> in your <code style={{ color: "#00d084", fontSize: 10 }}>.env</code> file to point to your Python backend.
        </p>
      </div>
    </div>
  );
}
