import { useEffect, useState } from "react";
import {
  CalendarPlus, Users, Check, AlertTriangle, Trash2,
} from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";
import Cabecalho from "../componentes/Cabecalho.jsx";
import NovoProcesso from "../componentes/NovoProcesso.jsx";

const dataHora = (iso) =>
  new Date(iso).toLocaleString("pt-BR",
    { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const hoje = () => new Date().toISOString().slice(0, 10);

function Rotulo({ children }) {
  return (
    <span style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                   letterSpacing: "0.06em", color: T.n700, marginBottom: 6 }}>
      {children}
    </span>
  );
}

/* Régua de progresso — mesma linguagem das outras telas. */
function Regua({ feitas, total }) {
  const segmentos = total || Math.max(feitas + 2, 6);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3 }} aria-hidden="true">
      {Array.from({ length: segmentos }).map((_, i) => (
        <span key={i} style={{
          width: 8, height: 2,
          background: i < feitas ? T.accent : T.n300,
        }} />
      ))}
    </div>
  );
}

export default function Agendar() {
  const [processos, setProcessos] = useState(null);
  const [ativo, setAtivo] = useState(null);
  const [sessoes, setSessoes] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [f, setF] = useState({ data: hoje(), hora: "09:00", duracao: 60, repetir: 1 });
  const set = (k, v) => setF((a) => ({ ...a, [k]: v }));

  const carregarProcessos = async () => {
    const { data, error } = await supabase.from("vw_processos_ativos").select("*");
    if (error) setErro(error.message);
    else setProcessos(data ?? []);
  };

  const carregarSessoes = async (processoId) => {
    const { data } = await supabase
      .from("sessoes")
      .select("id, numero, agendado_inicio, agendado_fim, status")
      .eq("processo_id", processoId)
      .order("agendado_inicio");
    setSessoes(data ?? []);
  };

  useEffect(() => { carregarProcessos(); }, []);

  const abrir = (p) => {
    setAtivo(p);
    setAviso(null);
    setErro(null);
    carregarSessoes(p.id);
  };

  const agendar = async () => {
    if (!ativo || salvando) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);

    const criadas = [];
    const choques = [];
    let numero = ativo.ultimo_numero;

    for (let i = 0; i < Number(f.repetir); i++) {
      const inicio = new Date(`${f.data}T${f.hora}:00`);
      inicio.setDate(inicio.getDate() + i * 7);
      const fim = new Date(inicio.getTime() + Number(f.duracao) * 60000);
      numero += 1;

      const { error } = await supabase.from("sessoes").insert({
        processo_id: ativo.id,
        numero,
        agendado_inicio: inicio.toISOString(),
        agendado_fim: fim.toISOString(),
      });

      if (error) {
        // 23P01 = a trava de choque de agenda do banco
        if (error.code === "23P01" || /exclusion|sem_choque/i.test(error.message)) {
          choques.push(inicio.toLocaleDateString("pt-BR"));
          numero -= 1;
        } else {
          setErro(error.message);
          break;
        }
      } else {
        criadas.push(inicio);
      }
    }

    setSalvando(false);

    if (criadas.length) {
      setAviso(
        criadas.length === 1
          ? `Encontro agendado para ${criadas[0].toLocaleDateString("pt-BR")}.`
          : `${criadas.length} encontros agendados, de ${criadas[0].toLocaleDateString("pt-BR")} a ${criadas[criadas.length - 1].toLocaleDateString("pt-BR")}.`
      );
    }
    if (choques.length) {
      setErro(
        `${ativo.treinador} já tem atendimento em: ${choques.join(", ")}. ` +
        `${criadas.length ? "Os demais foram agendados." : "Escolha outro horário."}`
      );
    }

    await carregarSessoes(ativo.id);
    await carregarProcessos();
  };

  const remover = async (sessao) => {
    if (sessao.status !== "agendada") return;
    const { error } = await supabase.from("sessoes").delete().eq("id", sessao.id);
    if (error) setErro(error.message);
    else {
      setAviso("Encontro removido.");
      carregarSessoes(ativo.id);
      carregarProcessos();
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Cabecalho />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 48px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: T.n600, marginBottom: 4 }}>
          Agenda
        </p>
        <h1 style={{ fontSize: 32, marginBottom: 20 }}>Marcar encontros</h1>

        <NovoProcesso onCriado={carregarProcessos} />

        {processos === null && <p style={{ color: T.n600 }}>Carregando…</p>}

        {processos?.length === 0 && (
          <div style={{ background: T.bg, border: `2px dashed ${T.n300}`,
                        padding: "48px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              Nenhum processo ativo
            </p>
            <p style={{ fontSize: 14, color: T.n600, margin: 0 }}>
              Crie o primeiro no botão “Novo processo” acima para começar a marcar encontros.
            </p>
          </div>
        )}

        {processos?.length > 0 && (
          <div style={{ display: "grid", gap: 20,
                        gridTemplateColumns: "minmax(260px, 340px) 1fr" }}>
            {/* Processos */}
            <div>
              <Rotulo>Processos ativos</Rotulo>
              <ul style={{ listStyle: "none", margin: 0, padding: 0,
                           display: "flex", flexDirection: "column", gap: 8 }}>
                {processos.map((p) => {
                  const on = ativo?.id === p.id;
                  return (
                    <li key={p.id}>
                      <button type="button" onClick={() => abrir(p)}
                        style={{ width: "100%", textAlign: "left", cursor: "pointer",
                                 background: T.bg, padding: "14px",
                                 border: `2px solid ${on ? T.accent : T.n300}`,
                                 borderLeft: `4px solid ${on ? T.accent
                                   : p.tipo === "coaching" ? T.accentMid : T.gold}` }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8,
                                       marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                                         letterSpacing: "0.04em", padding: "1px 6px",
                                         background: p.tipo === "coaching" ? T.accent100 : T.goldSoft,
                                         color: p.tipo === "coaching" ? T.accent : "#8f6626" }}>
                            {p.tipo}
                          </span>
                          <span style={{ fontSize: 12, color: T.n500 }}>{p.codigo}</span>
                        </span>
                        <span style={{ display: "block", fontWeight: 800, marginBottom: 2 }}>
                          {p.cliente}
                        </span>
                        <span style={{ display: "block", fontSize: 13, color: T.n600,
                                       marginBottom: 8 }}>
                          {p.treinador}
                          {p.participantes > 0 && (
                            <span style={{ marginLeft: 8, display: "inline-flex",
                                           alignItems: "center", gap: 4 }}>
                              <Users size={13} strokeWidth={2} /> {p.participantes}
                            </span>
                          )}
                        </span>
                        <Regua feitas={p.sessoes_realizadas} total={p.total_sessoes} />
                        <span style={{ display: "block", fontSize: 12, color: T.n500,
                                       marginTop: 6 }}>
                          {p.proxima_em
                            ? `próximo em ${dataHora(p.proxima_em)}`
                            : "sem encontro marcado"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Detalhe */}
            <div>
              {!ativo ? (
                <div style={{ background: T.bg, border: `2px dashed ${T.n300}`,
                              padding: "48px 24px", textAlign: "center" }}>
                  <p style={{ fontSize: 14, color: T.n600, margin: 0 }}>
                    Escolha um processo ao lado para marcar os encontros.
                  </p>
                </div>
              ) : (
                <>
                  {aviso && (
                    <p style={{ background: T.successSoft, border: `2px solid ${T.success}`,
                                color: "#12603c", fontSize: 14, padding: "12px 16px",
                                marginBottom: 16, display: "flex", gap: 10 }}>
                      <Check size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> {aviso}
                    </p>
                  )}
                  {erro && (
                    <p style={{ background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
                                color: "#8f2119", fontSize: 14, padding: "12px 16px",
                                marginBottom: 16, display: "flex", gap: 10 }}>
                      <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> {erro}
                    </p>
                  )}

                  {/* Formulário */}
                  <section style={{ background: T.bg, border: `2px solid ${T.n300}`,
                                    padding: "16px", marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 4 }}>
                      Marcar encontro — {ativo.cliente}
                    </h2>
                    <p style={{ fontSize: 14, color: T.n600, margin: "0 0 16px" }}>
                      Será o {ativo.ultimo_numero + 1}º
                      {ativo.total_sessoes ? ` de ${ativo.total_sessoes}` : ""} · {ativo.treinador}
                    </p>

                    <div style={{ display: "grid", gap: 12,
                                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                      <label>
                        <Rotulo>Data</Rotulo>
                        <input type="date" value={f.data} min={hoje()}
                          onChange={(e) => set("data", e.target.value)} style={entrada} />
                      </label>
                      <label>
                        <Rotulo>Hora</Rotulo>
                        <input type="time" value={f.hora}
                          onChange={(e) => set("hora", e.target.value)} style={entrada} />
                      </label>
                      <label>
                        <Rotulo>Duração</Rotulo>
                        <select value={f.duracao} onChange={(e) => set("duracao", e.target.value)}
                          style={entrada}>
                          {[45, 60, 90, 120, 180].map((m) => (
                            <option key={m} value={m}>{m} min</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <Rotulo>Repetir</Rotulo>
                        <select value={f.repetir} onChange={(e) => set("repetir", e.target.value)}
                          style={entrada}>
                          <option value={1}>só este</option>
                          <option value={4}>4 semanas</option>
                          <option value={8}>8 semanas</option>
                          <option value={10}>10 semanas</option>
                        </select>
                      </label>
                    </div>

                    {Number(f.repetir) > 1 && (
                      <p style={{ fontSize: 13, color: T.n600, margin: "12px 0 0" }}>
                        Cria {f.repetir} encontros semanais no mesmo horário. Se algum
                        cair em cima de outro atendimento, ele é pulado e os demais entram.
                      </p>
                    )}

                    <button type="button" onClick={agendar} disabled={salvando}
                      style={{ marginTop: 16, padding: "12px 20px", fontSize: 14, fontWeight: 800,
                               border: "none", background: T.accent, color: "#fff",
                               cursor: salvando ? "wait" : "pointer",
                               display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <CalendarPlus size={16} strokeWidth={2} />
                      {salvando ? "Marcando…" : "Marcar encontro"}
                    </button>
                  </section>

                  {/* Encontros já marcados */}
                  <section style={{ background: T.bg, border: `2px solid ${T.n300}` }}>
                    <h2 style={{ fontSize: 16, padding: "14px 16px",
                                 borderBottom: `2px solid ${T.n200}` }}>
                      Encontros deste processo
                    </h2>
                    {sessoes.length === 0 ? (
                      <p style={{ margin: 0, padding: "24px 16px", fontSize: 14,
                                  color: T.n600, textAlign: "center" }}>
                        Nenhum encontro marcado ainda.
                      </p>
                    ) : (
                      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                        {sessoes.map((s, i) => (
                          <li key={s.id}
                              style={{ display: "flex", alignItems: "center", gap: 12,
                                       padding: "12px 16px",
                                       borderTop: i ? `2px solid ${T.n200}` : "none" }}>
                            <span style={{ fontWeight: 800, minWidth: 28,
                                           color: s.status === "realizada" ? T.n500 : T.text }}>
                              {s.numero}º
                            </span>
                            <span style={{ flex: 1, fontSize: 14 }}>
                              {dataHora(s.agendado_inicio)}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                                           padding: "2px 8px",
                                           background: s.status === "realizada" ? T.successSoft
                                             : s.status === "agendada" ? T.n200 : T.dangerSoft,
                                           color: s.status === "realizada" ? "#12603c"
                                             : s.status === "agendada" ? T.n700 : "#8f2119" }}>
                              {s.status}
                            </span>
                            {s.status === "agendada" && (
                              <button type="button" onClick={() => remover(s)}
                                aria-label="Remover encontro"
                                style={{ background: "none", border: "none", cursor: "pointer",
                                         color: T.n500, padding: 4 }}>
                                <Trash2 size={16} strokeWidth={2} />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
