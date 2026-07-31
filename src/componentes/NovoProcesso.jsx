import { useEffect, useState } from "react";
import { Plus, X, Check, AlertTriangle } from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";

/* Cadastro enxuto de propósito: cliente e processo, nada mais.
   Participantes e entregas entram depois, na tela do processo —
   formulário de quinze campos é formulário que ninguém completa. */

function Rotulo({ children, opcional }) {
  return (
    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                   marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: "0.06em", color: T.n700 }}>
        {children}
      </span>
      {opcional && <span style={{ fontSize: 12, color: T.n500 }}>opcional</span>}
    </span>
  );
}

export default function NovoProcesso({ onCriado }) {
  const [aberto, setAberto] = useState(false);
  const [papel, setPapel] = useState(null);
  const [treinadores, setTreinadores] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  const vazio = {
    tipo: "coaching", nome: "", empresa: "", telefone: "", email: "",
    treinador_id: "", total: 10,
  };
  const [f, setF] = useState(vazio);
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Filtro explícito: a policy deixa gestão ver todos os perfis,
      // então sem o .eq a consulta devolve várias linhas.
      const { data: perfil } = await supabase
        .from("perfis").select("papel").eq("id", user.id).maybeSingle();

      setPapel(perfil?.papel ?? null);

      if (["gestao", "admin"].includes(perfil?.papel)) {
        const { data } = await supabase
          .from("treinadores").select("id, nome").eq("ativo", true).order("nome");
        setTreinadores(data ?? []);
      }
    })();
  }, []);

  const ehGestao = ["gestao", "admin"].includes(papel);
  const pode = f.nome.trim().length > 1 && (!ehGestao || f.treinador_id !== "");

  const salvar = async () => {
    if (!pode || salvando) return;
    setSalvando(true);
    setErro(null);
    setOk(null);

    const { data, error } = await supabase.rpc("criar_processo", {
      p_tipo: f.tipo,
      p_cliente_nome: f.nome,
      p_cliente_telefone: f.telefone || null,
      p_cliente_email: f.email || null,
      p_cliente_empresa: f.empresa || null,
      p_treinador_id: ehGestao ? Number(f.treinador_id) : null,
      p_total_sessoes: f.tipo === "coaching" ? Number(f.total) : null,
    });

    setSalvando(false);

    if (error) { setErro(error.message); return; }

    setOk(
      `${data.codigo} criado para ${data.cliente}.` +
      (data.reusou_cliente ? " O cliente já existia e foi reaproveitado." : "")
    );
    setF(vazio);
    onCriado?.();
  };

  if (!aberto) {
    return (
      <div style={{ marginBottom: 20 }}>
        <button type="button" onClick={() => { setAberto(true); setOk(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8,
                   padding: "12px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer",
                   background: T.accent, color: "#fff", border: "none" }}>
          <Plus size={16} strokeWidth={2} /> Novo processo
        </button>
        {ok && (
          <p style={{ background: T.successSoft, border: `2px solid ${T.success}`,
                      color: "#12603c", fontSize: 14, padding: "12px 16px",
                      marginTop: 12, display: "flex", gap: 10 }}>
            <Check size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> {ok}
          </p>
        )}
      </div>
    );
  }

  return (
    <section style={{ background: T.bg, border: `2px solid ${T.accent}`, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: T.accentDeep, color: "#fff", padding: "12px 16px" }}>
        <p style={{ margin: 0, fontWeight: 800 }}>Novo processo</p>
        <button type="button" onClick={() => { setAberto(false); setErro(null); }}
          aria-label="Fechar"
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Rotulo>Tipo</Rotulo>
          <div style={{ display: "flex", border: `2px solid ${T.n300}` }} role="radiogroup">
            {[["coaching", "Coaching"], ["mentoria", "Mentoria"]].map(([v, r], i) => (
              <button key={v} type="button" role="radio" aria-checked={f.tipo === v}
                onClick={() => set("tipo", v)}
                style={{ flex: 1, padding: "10px", fontSize: 14, fontWeight: 600,
                         cursor: "pointer", border: "none",
                         borderLeft: i ? `2px solid ${T.n300}` : "none",
                         background: f.tipo === v ? T.accent : T.bg,
                         color: f.tipo === v ? "#fff" : T.n700 }}>
                {r}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 13, color: T.n600, margin: "8px 0 0" }}>
            {f.tipo === "coaching"
              ? "Processo individual com número fechado de sessões."
              : "Mentoria empresarial. Os participantes você adiciona depois."}
          </p>
        </div>

        <label>
          <Rotulo>Nome do cliente</Rotulo>
          <input value={f.nome} onChange={(e) => set("nome", e.target.value)}
            placeholder={f.tipo === "coaching" ? "Marcos Vieira" : "Padaria Bela Vista"}
            style={entrada} />
        </label>

        <div style={{ display: "grid", gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label>
            <Rotulo opcional>Empresa</Rotulo>
            <input value={f.empresa} onChange={(e) => set("empresa", e.target.value)}
              style={entrada} />
          </label>
          <label>
            <Rotulo>WhatsApp</Rotulo>
            <input value={f.telefone} onChange={(e) => set("telefone", e.target.value)}
              placeholder="+55 71 90000-0000" style={entrada} />
          </label>
          <label>
            <Rotulo opcional>E-mail</Rotulo>
            <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)}
              style={entrada} />
          </label>
        </div>

        <p style={{ fontSize: 13, color: T.n600, margin: 0 }}>
          O WhatsApp é por onde a pesquisa vai. Sem ele, o link precisa ser copiado à mão.
        </p>

        <div style={{ display: "grid", gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {ehGestao && (
            <label>
              <Rotulo>Treinador responsável</Rotulo>
              <select value={f.treinador_id} onChange={(e) => set("treinador_id", e.target.value)}
                style={entrada}>
                <option value="">escolha…</option>
                {treinadores.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>
          )}

          {f.tipo === "coaching" && (
            <label>
              <Rotulo>Número de sessões</Rotulo>
              <select value={f.total} onChange={(e) => set("total", e.target.value)}
                style={entrada}>
                {[6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} sessões</option>)}
              </select>
            </label>
          )}
        </div>

        {!ehGestao && papel && (
          <p style={{ fontSize: 13, color: T.n600, margin: 0 }}>
            O processo nasce sob a sua responsabilidade.
          </p>
        )}

        {erro && (
          <p style={{ background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
                      color: "#8f2119", fontSize: 14, padding: "12px 16px", margin: 0,
                      display: "flex", gap: 10 }}>
            <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> {erro}
          </p>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center",
                      borderTop: `2px solid ${T.n200}`, paddingTop: 16 }}>
          <button type="button" onClick={() => setAberto(false)}
            style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                     background: T.bg, color: T.n700, border: `2px solid ${T.n300}` }}>
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={!pode || salvando}
            style={{ padding: "10px 20px", fontSize: 14, fontWeight: 800, border: "none",
                     background: pode ? T.accent : T.n300,
                     color: pode ? "#fff" : T.n500,
                     cursor: pode ? (salvando ? "wait" : "pointer") : "not-allowed" }}>
            {salvando ? "Criando…" : "Criar processo"}
          </button>
          <span style={{ fontSize: 13, color: T.n600 }}>
            O código é gerado automaticamente.
          </span>
        </div>
      </div>
    </section>
  );
}
