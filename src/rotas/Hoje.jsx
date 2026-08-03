import { useEffect, useState } from "react";
import {
  Clock, MapPin, Video, Check, ChevronDown, Link2, X,
} from "lucide-react";
import { supabase } from "../supabase.js";
import { T } from "../tokens.js";
import Cabecalho from "../componentes/Cabecalho.jsx";
import LinksPesquisa from "../componentes/LinksPesquisa.jsx";
import ProximosEncontros from "../componentes/ProximosEncontros.jsx";
import FormularioRegistro, { avisoRemarcacao } from "../componentes/FormularioRegistro.jsx";

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

/* Sessão realizada — o envio é manual, então o link não some ao fechar o
   painel. Este botão volta a buscar os envios ainda não respondidos. */
function LinkPesquisa({ sessao, onAbrir }) {
  const [estado, setEstado] = useState("pronto"); // pronto | buscando | vazio
  const [erro, setErro] = useState(null);

  const abrir = async () => {
    if (estado === "buscando") return;
    setEstado("buscando");
    setErro(null);

    // vw_links_pendentes já resolve o destinatário (participante ou contato do
    // cliente) e respeita o RLS: o treinador só enxerga os próprios envios não
    // respondidos.
    const { data, error } = await supabase
      .from("vw_links_pendentes")
      .select("token, destinatario, telefone, treinador")
      .eq("sessao_id", sessao.id);

    if (error) { setEstado("pronto"); setErro(error.message); return; }
    if (!data || data.length === 0) { setEstado("vazio"); return; }

    setEstado("pronto");
    onAbrir({
      links: data.map((l) => ({
        nome: l.destinatario,
        telefone: l.telefone,
        token: l.token,
      })),
      treinador: data[0].treinador,
    });
  };

  if (estado === "vazio") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14,
        padding: "9px 12px", background: T.successSoft, color: "#12603c"
      }}>
        <Check size={15} strokeWidth={2} /> Todos já responderam a pesquisa desta sessão
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button type="button" onClick={abrir} disabled={estado === "buscando"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px",
          fontSize: 14, fontWeight: 600, cursor: estado === "buscando" ? "default" : "pointer",
          background: T.bg, color: T.n700, border: `2px solid ${T.n300}`
        }}>
        <Link2 size={15} strokeWidth={2} />
        {estado === "buscando" ? "Buscando…" : "Ver link da pesquisa"}
      </button>
      {erro && (
        <span style={{ fontSize: 13, color: T.danger, textAlign: "right", maxWidth: 220 }}>
          Não deu para buscar o link: {erro}
        </span>
      )}
    </div>
  );
}

/* ============================================================
   LINHA
   ============================================================ */
function Linha({ sessao, aberta, onAbrir, onFechar, onPronto, onVerLink }) {
  const p = sessao.processos;
  const registrada = sessao.status !== "agendada";
  const realizada = sessao.status === "realizada";
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
            realizada ? (
              <LinkPesquisa sessao={sessao} onAbrir={onVerLink} />
            ) : (
              <span style={{
                display: "inline-flex", alignItems: "center", fontSize: 14,
                padding: "9px 12px", background: T.n200, color: T.n600
              }}>
                {sessao.status === "faltou" ? "Cliente não veio" : "Remarcada"}
              </span>
            )
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

      {aberta && <FormularioRegistro sessao={sessao} onCancelar={onFechar} onPronto={onPronto} />}
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
  const [aviso, setAviso] = useState(null);

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

  const registrado = (sessao, resultado, novaData) => {
    setAbertaId(null);
    if (resultado?.pesquisa) {
      setEnvio(resultado);
      setAviso(null);
    } else {
      setEnvio(null);
      setAviso(avisoRemarcacao(resultado, sessao, novaData));
    }
    carregar();
  };

  const pendentes = (sessoes || []).filter((s) => s.status === "agendada");
  const hoje = new Date().toLocaleDateString("pt-BR",
    { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ minHeight: "100vh" }}>
      <Cabecalho />

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

        {aviso && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            marginBottom: 20, padding: "12px 16px",
            background: aviso.tom === "alerta" ? T.dangerSoft
              : aviso.tom === "bom" ? T.successSoft : T.bg,
            border: `2px solid ${aviso.tom === "alerta" ? T.danger
              : aviso.tom === "bom" ? T.success : T.n300}`,
            borderLeft: `4px solid ${aviso.tom === "alerta" ? T.danger
              : aviso.tom === "bom" ? T.success : T.gold}`,
            color: aviso.tom === "alerta" ? "#8f2119"
              : aviso.tom === "bom" ? "#12603c" : T.text
          }}>
            <p style={{ margin: 0, fontSize: 14 }}>{aviso.texto}</p>
            <button type="button" onClick={() => setAviso(null)} aria-label="Fechar"
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>
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
                onAbrir={() => { setAbertaId(s.id); setEnvio(null); setAviso(null); }}
                onFechar={() => setAbertaId(null)}
                onPronto={(r, nd) => registrado(s, r, nd)}
                onVerLink={(r) => { setAbertaId(null); setEnvio(r); setAviso(null); }} />
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

        <ProximosEncontros />
      </main>
    </div>
  );
}
