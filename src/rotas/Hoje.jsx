import { useEffect, useState } from "react";
import {
  Clock, MapPin, Video, Check, ChevronDown, Send, X, LogOut, Plus,
} from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";
import LinksPesquisa from "../componentes/LinksPesquisa.jsx";

const FERRAMENTAS = [
  "Roda da vida", "Metas SMART", "Mapa do comportamento",
  "Matriz de prioridades", "Feedback estruturado", "Plano 90 dias",
];

const hora = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/* Régua de sessões — a sequência é informação, então é desenhada. */
function Regua({ numero, total, ativo }) {
  const segmentos = total || Math.max((numero || 1) + 2, 6);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }} aria-hidden="true">
      {Array.from({ length: segmentos }).map((_, i) => {
        const passado = i + 1 < numero;
        const atual = i + 1 === numero;
        return (
          <span key={i} style={{
            width: 9, height: atual ? 12 : 2,
            background: passado ? T.accent : atual ? (ativo ? T.gold : T.accent) : T.n300,
          }} />
        );
      })}
    </div>
  );
}

function Rotulo({ children }) {
  return (
    <span style={{
      display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.06em", color: T.n700, marginBottom: 6
    }}>
      {children}
    </span>
  );
}

/* ============================================================
   FORMULÁRIO
   ============================================================ */
function Formulario({ sessao, onCancelar, onPronto }) {
  const [ocorrencia, setOcorrencia] = useState("realizada");
  const [resumo, setResumo] = useState("");
  const [plano, setPlano] = useState("");
  const [proximos, setProximos] = useState("");
  const [ferramentas, setFerramentas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const compareceu = ocorrencia === "realizada";
  const pode = compareceu ? resumo.trim().length > 0 : true;

  const salvar = async () => {
    if (!pode || salvando) return;
    setSalvando(true);
    setErro(null);

    const { data, error } = await supabase.rpc("registrar_sessao", {
      p_sessao_id: sessao.id,
      p_status: ocorrencia,
      p_resumo: resumo || null,
      p_plano: plano || null,
      p_proximos: proximos || null,
      p_ferramentas: ferramentas.length ? ferramentas : null,
      p_compromissos: null,
    });

    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onPronto(data);
  };

  const primeiro = sessao.processos.clientes.nome.split(" ")[0];

  return (
    <div style={{
      background: T.n100, borderTop: `2px solid ${T.n300}`, padding: "20px 16px",
      display: "flex", flexDirection: "column", gap: 20
    }}>
      <div>
        <Rotulo>O encontro aconteceu?</Rotulo>
        <div style={{ display: "flex", border: `2px solid ${T.n300}` }} role="radiogroup">
          {[["realizada", "Sim, aconteceu"], ["remarcada", "Remarcado"], ["faltou", "Cliente não veio"]]
            .map(([v, r], i) => (
              <button key={v} type="button" role="radio" aria-checked={ocorrencia === v}
                onClick={() => setOcorrencia(v)}
                style={{
                  flex: 1, padding: "9px 10px", fontSize: 14, fontWeight: 600, border: "none",
                  borderLeft: i ? `2px solid ${T.n300}` : "none", cursor: "pointer",
                  background: ocorrencia === v ? T.accent : T.bg,
                  color: ocorrencia === v ? "#fff" : T.n700
                }}>
                {r}
              </button>
            ))}
        </div>
      </div>

      <label style={{ display: "block" }}>
        <Rotulo>Resumo do encontro {compareceu && <span style={{ color: T.danger }}>*</span>}</Rotulo>
        <textarea rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)}
          placeholder={compareceu
            ? "O que foi tratado, em duas ou três linhas."
            : "O que houve."}
          style={{ ...entrada, resize: "vertical" }} />
      </label>

      {compareceu && (
        <>
          <label style={{ display: "block" }}>
            <Rotulo>Plano de ação</Rotulo>
            <textarea rows={2} value={plano} onChange={(e) => setPlano(e.target.value)}
              style={{ ...entrada, resize: "vertical" }} />
          </label>

          <label style={{ display: "block" }}>
            <Rotulo>Próximos passos</Rotulo>
            <textarea rows={2} value={proximos} onChange={(e) => setProximos(e.target.value)}
              style={{ ...entrada, resize: "vertical" }} />
          </label>

          <div>
            <Rotulo>Ferramentas usadas · opcional</Rotulo>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FERRAMENTAS.map((f) => {
                const on = ferramentas.includes(f);
                return (
                  <button key={f} type="button"
                    onClick={() => setFerramentas((a) =>
                      a.includes(f) ? a.filter((x) => x !== f) : [...a, f])}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 10px", fontSize: 14, cursor: "pointer",
                      background: on ? T.accent : T.bg, color: on ? "#fff" : T.n700,
                      border: `2px solid ${on ? T.accent : T.n300}`
                    }}>
                    {on ? <Check size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {erro && (
        <p style={{
          background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
          color: "#8f2119", fontSize: 14, padding: "10px 12px"
        }}>
          Não deu para registrar: {erro}
        </p>
      )}

      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
        paddingTop: 4, borderTop: `2px solid ${T.n200}`
      }}>
        <button type="button" onClick={onCancelar}
          style={{
            padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            background: T.bg, color: T.n700, border: `2px solid ${T.n300}`
          }}>
          Cancelar
        </button>
        <button type="button" onClick={salvar} disabled={!pode || salvando}
          style={{
            padding: "10px 20px", fontSize: 14, fontWeight: 800, border: "none",
            background: pode ? T.accent : T.n300, color: pode ? "#fff" : T.n500,
            cursor: pode ? "pointer" : "not-allowed"
          }}>
          {salvando ? "Registrando…" : compareceu ? "Registrar sessão" : "Registrar ausência"}
        </button>
        {compareceu && (
          <span style={{ fontSize: 14, color: T.n600 }}>
            A pesquisa vai para {primeiro} assim que você registrar.
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LINHA
   ============================================================ */
function Linha({ sessao, aberta, onAbrir, onFechar, onPronto }) {
  const p = sessao.processos;
  const registrada = sessao.status !== "agendada";
  const coaching = p.tipo === "coaching";

  return (
    <li style={{ background: T.bg, border: `2px solid ${aberta ? T.accent : T.n300}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "16px" }}>
        <div style={{ minWidth: 72 }}>
          <span style={{
            display: "block", fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums",
            color: registrada ? T.n500 : T.text
          }}>
            {hora(sessao.agendado_inicio)}
          </span>
          <span style={{ fontSize: 14, color: T.n500 }}>até {hora(sessao.agendado_fim)}</span>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
              padding: "2px 8px",
              background: coaching ? T.accent100 : T.goldSoft,
              color: coaching ? T.accent : "#8f6626"
            }}>
              {p.tipo}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.n500 }}>{p.codigo}</span>
            {registrada && (
              <span style={{
                fontSize: 12, fontWeight: 600, textTransform: "uppercase", padding: "2px 8px",
                background: T.successSoft, color: "#12603c"
              }}>
                Registrada
              </span>
            )}
          </div>

          <p style={{
            fontSize: 18, fontWeight: 800, letterSpacing: "-0.015em", margin: 0,
            color: registrada ? T.n700 : T.text
          }}>
            {p.clientes.nome}
          </p>

          <p style={{
            fontSize: 14, color: T.n600, margin: "6px 0 12px",
            display: "inline-flex", alignItems: "center", gap: 6
          }}>
            {p.clientes.empresa ? <MapPin size={15} strokeWidth={2} /> : <Video size={15} strokeWidth={2} />}
            {p.clientes.empresa || "Online"}
            <span style={{ marginLeft: 8 }}>
              {coaching ? `Sessão ${sessao.numero} de ${p.total_sessoes}` : `${sessao.numero}º encontro`}
            </span>
          </p>

          <Regua numero={sessao.numero} total={p.total_sessoes} ativo={!registrada} />
        </div>

        <div>
          {registrada ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14,
              padding: "9px 12px", background: T.successSoft, color: "#12603c"
            }}>
              <Send size={15} strokeWidth={2} /> Pesquisa enviada
            </span>
          ) : (
            <button type="button" onClick={aberta ? onFechar : onAbrir}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                background: aberta ? T.bg : T.accent,
                color: aberta ? T.n700 : "#fff",
                border: aberta ? `2px solid ${T.n300}` : "none"
              }}>
              {aberta ? <><X size={15} strokeWidth={2} /> Fechar</>
                : <>Registrar sessão <ChevronDown size={15} strokeWidth={2} /></>}
            </button>
          )}
        </div>
      </div>

      {aberta && <Formulario sessao={sessao} onCancelar={onFechar} onPronto={onPronto} />}
    </li>
  );
}

/* ============================================================
   TELA
   ============================================================ */
export default function Hoje() {
  const [sessoes, setSessoes] = useState(null);
  const [erro, setErro] = useState(null);
  const [abertaId, setAbertaId] = useState(null);
  const [envio, setEnvio] = useState(null);

  const carregar = async () => {
    const agora = new Date();
    const inicio = new Date(agora); inicio.setHours(0, 0, 0, 0);
    const fim = new Date(agora); fim.setHours(23, 59, 59, 999);

    // Sem filtro por treinador: o RLS já devolve só o que é dele.
    const { data, error } = await supabase
      .from("sessoes")
      .select(`
        id, numero, agendado_inicio, agendado_fim, status,
        processos ( codigo, tipo, total_sessoes,
          clientes ( nome, empresa, telefone ),
          treinadores ( nome ) )
      `)
      .gte("agendado_inicio", inicio.toISOString())
      .lte("agendado_inicio", fim.toISOString())
      .order("agendado_inicio");

    if (error) setErro(error.message);
    else setSessoes(data);
  };

  useEffect(() => { carregar(); }, []);

  const registrado = (sessao, resultado) => {
    setAbertaId(null);
    setEnvio(resultado?.pesquisa ? resultado : null);
    carregar();
  };

  const pendentes = (sessoes || []).filter((s) => s.status === "agendada");
  const hoje = new Date().toLocaleDateString("pt-BR",
    { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header style={{
        background: T.accentDeep, color: "#fff", padding: "12px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, background: T.gold, color: T.accentDeep
          }}>F</span>
          Febracis · Gestão
        </span>
        <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sair"
          style={{ background: "none", border: "none", color: "#b3c3d8", cursor: "pointer" }}>
          <LogOut size={18} strokeWidth={2} />
        </button>
      </header>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px 48px" }}>
        <p style={{
          fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.08em", color: T.n600, marginBottom: 4
        }}>
          {hoje}
        </p>
        <h1 style={{ fontSize: 32, marginBottom: 20 }}>Suas sessões de hoje</h1>

        {sessoes && (
          <div style={{
            display: "flex", alignItems: "center", gap: 12, background: T.bg,
            border: `2px solid ${T.n300}`, borderLeft: `4px solid ${T.gold}`,
            padding: "12px 16px", marginBottom: 20
          }}>
            <Clock size={20} strokeWidth={2} style={{ color: T.gold, flexShrink: 0 }} />
            <p style={{ fontSize: 14, margin: 0 }}>
              <strong style={{ fontWeight: 800 }}>
                {pendentes.length === 0 ? "Tudo registrado"
                  : `${pendentes.length} ${pendentes.length === 1 ? "sessão" : "sessões"} para registrar`}
              </strong>
              {pendentes.length > 0 && (
                <span style={{ color: T.n600 }}> — o registro dispara a pesquisa do cliente.</span>
              )}
            </p>
          </div>
        )}


        {envio && (
          <LinksPesquisa
            links={envio.links}
            treinador={envio.treinador}
            onFechar={() => setEnvio(null)}
          />
        )}

        {erro && (
          <p style={{
            background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
            color: "#8f2119", fontSize: 14, padding: "12px 16px"
          }}>
            Não deu para carregar a agenda: {erro}
          </p>
        )}

        {sessoes === null && !erro && <p style={{ color: T.n600 }}>Carregando…</p>}

        {sessoes && sessoes.length > 0 && (
          <ul style={{
            listStyle: "none", padding: 0, margin: 0,
            display: "flex", flexDirection: "column", gap: 12
          }}>
            {sessoes.map((s) => (
              <Linha key={s.id} sessao={s}
                aberta={abertaId === s.id}
                onAbrir={() => { setAbertaId(s.id); setEnvio(null); }}
                onFechar={() => setAbertaId(null)}
                onPronto={(r) => registrado(s, r)} />
            ))}
          </ul>
        )}

        {sessoes && sessoes.length === 0 && (
          <div style={{
            background: T.bg, border: `2px dashed ${T.n300}`,
            padding: "48px 24px", textAlign: "center"
          }}>
            <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Nenhuma sessão hoje</p>
            <p style={{ fontSize: 14, color: T.n600, margin: 0 }}>
              Quando a coordenação agendar uma mentoria ou sessão de coaching, ela aparece aqui.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
