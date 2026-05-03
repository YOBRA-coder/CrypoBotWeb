// pages/SignupPage.tsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { S, authBg } from "./styles";

export default function SignupPage({ onSwitch }: { onSwitch: () => void }) {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async () => {
    if (!form.name || !form.email || !form.password) { setError("All fields required"); return; }
    if (form.password.length < 6) { setError("Password min 6 chars"); return; }
    setLoading(true); setError("");
    if (!await signup(form.name, form.email, form.password)) setError("Email already registered");
    setLoading(false);
  };

  return (
    <div style={authBg}>
      <div style={S.authGlow} />
      <div style={S.authCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 }}>
          <span style={{ color: "#00d084", fontSize: 34 }}>⬡</span>
          <span style={{ color: "#e0eaf5", fontWeight: 900, fontSize: 26, letterSpacing: 4 }}>NEXUS<span style={{ color: "#00d084" }}>AI</span></span>
        </div>
        <p style={S.authSub}>Create your trading account</p>
        {(["name", "email", "password"] as const).map(k => (
          <div key={k} style={S.fg}>
            <label style={S.lbl}>{k}</label>
            <input style={S.inp} type={k === "password" ? "password" : k === "email" ? "email" : "text"} value={form[k]} onChange={f(k)} placeholder={k === "name" ? "Your name" : k === "email" ? "you@email.com" : "Min 6 chars"} />
          </div>
        ))}
        {error && <div style={S.err}>{error}</div>}
        <button style={S.btn} onClick={handle} disabled={loading}>{loading ? "Creating..." : "Create Account →"}</button>
        <div style={{ textAlign: "center", marginTop: 18, color: "#2e4060", fontSize: 11 }}>
          Have account? <span style={{ color: "#00d084", cursor: "pointer" }} onClick={onSwitch}>Sign in</span>
        </div>
      </div>
    </div>
  );
}
