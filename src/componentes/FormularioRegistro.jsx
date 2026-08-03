import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";

/* Formulário de registro de sessão. Usado na tela do treinador (Hoje) e,
   com pelaGestao, no lugar dele pela coordenação (Gestao). A lógica de
   status, remarcação e disparo de pesquisa precisa ser a mesma nos dois —
   por isso mora aqui, num lugar só. O registrar_sessao decide sozinho, pelo
   papel de quem chama, se marca registrado_pela_gestao. */

const FERRAMENTAS = [
  "Roda da vida", "Metas SMART", "Mapa do comportamento",
  "Matriz de prioridades", "Feedback estruturado", "Plano 90 dias",
];

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

/* Mensagem pós-registro para quem não compareceu. A data vem do que quem
   registrou digitou; o treinador do conflito é o dono da sessão. */
export function avisoRemarcacao(r, sessao, novaData) {
  if (r?.remarcada) {
    let quando = "a nova data";
    if (novaData) {
      const d = new Date(novaData);
      quando = `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às `
        + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return { texto: `Registrado. Novo encontro marcado para ${quando}.`, tom: "bom" };
  }
  if (r?.conflito) {
    const treinador = sessao.processos.treinadores?.nome ?? "o treinador";
    return {
      texto: `Registrado, mas ${treinador} já tem atendimento nesse horário. `
        + "Marque o novo encontro na tela de agenda.",
      tom: "alerta",
    };
  }
  if (r?.pendente_remarcar) {
    return { texto: "Registrado. Este encontro ficou pendente de remarcação.", tom: "neutro" };
  }
  return null;
}

export default function FormularioRegistro({ sessao, onCancelar, onPronto, pelaGestao = false }) {
  const [ocorrencia, setOcorrencia] = useState("realizada");
  const [resumo, setResumo] = useState("");
  const [plano, setPlano] = useState("");
  const [proximos, setProximos] = useState("");
  const [ferramentas, setFerramentas] = useState([]);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const compareceu = ocorrencia === "realizada";
  // Quem registra pela coordenação não estava na sessão: o resumo é opcional.
  const resumoObrigatorio = compareceu && !pelaGestao;
  const pode = resumoObrigatorio ? resumo.trim().length > 0 : true;

  const salvar = async () => {
    if (!pode || salvando) return;
    setSalvando(true);
    setErro(null);

    // Só faz sentido para quem não compareceu; vazio vira null.
    const novaDataISO = !compareceu && novaData
      ? new Date(`${novaData}T${novaHora || "09:00"}:00`).toISOString()
      : null;

    const { data, error } = await supabase.rpc("registrar_sessao", {
      p_sessao_id: sessao.id,
      p_status: ocorrencia,
      p_resumo: resumo || null,
      p_plano: plano || null,
      p_proximos: proximos || null,
      p_ferramentas: ferramentas.length ? ferramentas : null,
      p_compromissos: null,
      p_nova_data: novaDataISO,
    });

    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onPronto(data, novaDataISO);
  };

  const primeiro = sessao.processos.clientes.nome.split(" ")[0];
  const treinador = sessao.processos.treinadores?.nome;

  return (
    <div style={{
      background: T.n100, borderTop: `2px solid ${T.n300}`, padding: "20px 16px",
      display: "flex", flexDirection: "column", gap: 20
    }}>
      {pelaGestao && (
        <p style={{
          background: T.goldSoft, borderLeft: `4px solid ${T.gold}`, color: "#8f6626",
          fontSize: 14, padding: "10px 12px", margin: 0
        }}>
          Você está registrando pela coordenação{treinador ? `, no lugar de ${treinador}` : ""}.
          Fica marcado como feito pela coordenação — o resumo é opcional. Se o encontro
          aconteceu, a pesquisa vai para o cliente do mesmo jeito.
        </p>
      )}

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
        <Rotulo>Resumo do encontro {resumoObrigatorio && <span style={{ color: T.danger }}>*</span>}</Rotulo>
        <textarea rows={3} value={resumo} onChange={(e) => setResumo(e.target.value)}
          placeholder={compareceu
            ? "O que foi tratado, em duas ou três linhas."
            : "O que houve."}
          style={{ ...entrada, resize: "vertical" }} />
      </label>

      {!compareceu && (
        <div>
          <Rotulo>Nova data, se já souber</Rotulo>
          <div style={{ display: "grid", gap: 12,
                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            <input type="date" value={novaData} aria-label="Nova data"
              onChange={(e) => setNovaData(e.target.value)} style={entrada} />
            <input type="time" value={novaHora} aria-label="Nova hora"
              onChange={(e) => setNovaHora(e.target.value)} style={entrada} />
          </div>
        </div>
      )}

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
            A pesquisa vai para {primeiro} assim que registrar.
          </span>
        )}
      </div>
    </div>
  );
}
