// pages/LoginPage.tsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { S, authBg } from "./styles";

export default function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("demo@nexusai.trade");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true); setError("");
    if (!await login(email, password)) setError("Invalid credentials. Try demo@nexusai.trade / demo123");
    setLoading(false);
  };

  return (
    <div style={authBg}>
      <div style={S.authGlow} />
      <div style={S.authCard}>
        <Logo />
        <p style={S.authSub}>Professional Crypto Trading Platform</p>
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} onEnter={handle} />
        {error && <div style={S.err}>{error}</div>}
        <button style={S.btn} onClick={handle} disabled={loading}>{loading ? "Authenticating..." : "Sign In →"}</button>
        <div style={{ textAlign: "center", marginTop: 18, color: "#2e4060", fontSize: 11 }}>
          No account? <span style={{ color: "#00d084", cursor: "pointer" }} onClick={onSwitch}>Create one</span>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, color: "#1a2535", fontSize: 10, borderTop: "1px solid #0a1828", paddingTop: 14 }}>
          Demo: demo@nexusai.trade / demo123
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
      <span style={{ color: "#00d084", fontSize: 34 }}>⬡</span>
      <span style={{ color: "#e0eaf5", fontWeight: 900, fontSize: 26, letterSpacing: 4 }}>
        NEXUS<span style={{ color: "#00d084" }}>AI</span>
      </span>
    </div>
  );
}

function Field({ label, type, value, onChange, onEnter }: { label: string; type: string; value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  return (
    <div style={S.fg}>
      <label style={S.lbl}>{label}</label>
      <input style={S.inp} type={type} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        placeholder={type === "email" ? "you@email.com" : "••••••••"} />
    </div>
  );
}
