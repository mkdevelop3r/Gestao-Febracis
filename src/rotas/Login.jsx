import { useState } from "react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro("E-mail ou senha não conferem.");
    setEntrando(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <form onSubmit={entrar} style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ background: T.accentDeep, color: "#fff", padding: "20px 24px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                         width: 28, height: 28, background: T.gold, color: T.accentDeep,
                         fontWeight: 800, marginBottom: 14 }}>F</span>
          <h1 style={{ fontSize: 24, color: "#fff" }}>Febracis · Gestão</h1>
        </div>

        <div style={{ background: T.bg, border: `2px solid ${T.n300}`, borderTop: "none", padding: 24 }}>
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                           letterSpacing: "0.06em", color: T.n700, marginBottom: 6 }}>E-mail</span>
            <input type="email" required value={email} autoComplete="username"
                   onChange={(e) => setEmail(e.target.value)} style={entrada} />
          </label>

          <label style={{ display: "block", marginBottom: 20 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                           letterSpacing: "0.06em", color: T.n700, marginBottom: 6 }}>Senha</span>
            <input type="password" required value={senha} autoComplete="current-password"
                   onChange={(e) => setSenha(e.target.value)} style={entrada} />
          </label>

          {erro && (
            <p style={{ background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
                        color: "#8f2119", fontSize: 14, padding: "10px 12px", marginBottom: 16 }}>
              {erro}
            </p>
          )}

          <button type="submit" disabled={entrando}
                  style={{ width: "100%", padding: "14px 16px", fontSize: 15, fontWeight: 800,
                           background: T.accent, color: "#fff", border: "none",
                           cursor: entrando ? "wait" : "pointer" }}>
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
