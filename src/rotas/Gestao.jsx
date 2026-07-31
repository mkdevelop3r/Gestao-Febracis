import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock3, Star, CalendarClock } from "lucide-react";
import { supabase } from "../supabase.js";
import { T } from "../tokens.js";
import Cabecalho from "../componentes/Cabecalho.jsx";

/* Termômetro do piloto — não é o painel da diretoria.
   Responde duas perguntas: o treinador registra? o cliente responde? */

const dia = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/* Quem lê "Encontros para remarcar" vai ligar para o cliente — precisa do
   horário original, não só do dia. */
const dataHora = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às `
    + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

function Numero({ rotulo, valor, sufixo, tom }) {
  const cor = tom === "alerta" ? T.danger : tom === "bom" ? T.success : T.text;
  return (
    <div style={{ background: T.bg, border: `2px solid ${T.n300}`, padding: "16px" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                     letterSpacing: "0.06em", color: T.n600, marginBottom: 8 }}>
        {rotulo}
      </span>
      <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.015em", color: cor }}>
        {valor}
      </span>
      {sufixo && <span style={{ fontSize: 14, color: T.n600, marginLeft: 6 }}>{sufixo}</span>}
    </div>
  );
}

function Bloco({ Icone, titulo, descricao, vazio, children }) {
  return (
    <section style={{ background: T.bg, border: `2px solid ${T.n300}`, marginBottom: 20 }}>
      <div style={{ padding: "16px", borderBottom: `2px solid ${T.n200}` }}>
        <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
          <Icone size={20} strokeWidth={2} style={{ color: T.gold }} />
          {titulo}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: T.n600 }}>{descricao}</p>
      </div>
      {children ?? (
        <p style={{ margin: 0, padding: "24px 16px", fontSize: 14, color: T.n600,
                    textAlign: "center" }}>
          {vazio}
        </p>
      )}
    </section>
  );
}

function Tabela({ colunas, linhas }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c} style={{ textAlign: "left", padding: "10px 16px",
                                   fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                                   letterSpacing: "0.06em", color: T.n600,
                                   borderBottom: `2px solid ${T.n200}`, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{linhas}</tbody>
      </table>
    </div>
  );
}

const td = { padding: "12px 16px", borderBottom: `2px solid ${T.n200}` };

export default function Gestao() {
  const [papel, setPapel] = useState(undefined);
  const [resumo, setResumo] = useState(null);
  const [pendencias, setPendencias] = useState([]);
  const [pesquisas, setPesquisas] = useState([]);
  const [satisfacao, setSatisfacao] = useState([]);
  const [remarcar, setRemarcar] = useState([]);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    (async () => {
      // A gestão enxerga todos os perfis pelo RLS, então sem filtro a
      // consulta volta várias linhas e o maybeSingle() quebra. Filtra pelo
      // próprio usuário para trazer só o dele.
      const { data: { user } } = await supabase.auth.getUser();
      const { data: perfil } = await supabase
        .from("perfis").select("papel").eq("id", user.id).maybeSingle();

      setPapel(perfil?.papel ?? null);
      if (!["gestao", "admin"].includes(perfil?.papel)) return;

      const [r, p, q, s, rm] = await Promise.all([
        supabase.from("vw_piloto_resumo").select("*").maybeSingle(),
        supabase.from("vw_piloto_pendencias").select("*").order("agendado_fim"),
        supabase.from("vw_piloto_pesquisas").select("*").order("criado_em"),
        supabase.from("vw_piloto_satisfacao").select("*").order("media"),
        supabase.from("vw_precisa_remarcar").select("*").order("dias_parado", { ascending: false }),
      ]);

      const falha = [r, p, q, s, rm].find((x) => x.error);
      if (falha) { setErro(falha.error.message); return; }

      setResumo(r.data);
      setPendencias(p.data ?? []);
      setPesquisas(q.data ?? []);
      setSatisfacao(s.data ?? []);
      setRemarcar(rm.data ?? []);
    })();
  }, []);

  if (papel === undefined) {
    return <p style={{ padding: 24, color: T.n600 }}>Carregando…</p>;
  }

  if (!["gestao", "admin"].includes(papel)) {
    return (
      <main style={{ padding: "48px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Esta área é da coordenação</h1>
        <p style={{ color: T.n700, marginBottom: 20 }}>
          Seu acesso é de treinador. As sessões do dia ficam na tela inicial.
        </p>
        <Link to="/hoje" style={{ color: T.accent, fontWeight: 700 }}>Ir para as sessões</Link>
      </main>
    );
  }

  const taxa = resumo && resumo.links_gerados > 0
    ? Math.round((resumo.respostas_recebidas / resumo.links_gerados) * 100)
    : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Cabecalho />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 48px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.08em", color: T.n600, marginBottom: 4 }}>
          Acompanhamento do piloto
        </p>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Como está indo</h1>
        <p style={{ fontSize: 14, color: T.n600, marginBottom: 24 }}>
          Duas perguntas: o treinador registra as sessões e o cliente responde a pesquisa.
        </p>

        {erro && (
          <p style={{ background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
                      color: "#8f2119", fontSize: 14, padding: "12px 16px" }}>
            Não deu para carregar: {erro}
          </p>
        )}

        {resumo && (
          <div style={{ display: "grid", gap: 12, marginBottom: 24,
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Numero rotulo="Sessões registradas" valor={resumo.sessoes_registradas} />
            <Numero rotulo="Sem registrar" valor={resumo.sessoes_pendentes}
                    tom={resumo.sessoes_pendentes > 0 ? "alerta" : "bom"} />
            <Numero rotulo="Links gerados" valor={resumo.links_gerados} />
            <Numero rotulo="Taxa de resposta"
                    valor={taxa === null ? "—" : `${taxa}%`}
                    sufixo={taxa === null ? "" : `${resumo.respostas_recebidas} de ${resumo.links_gerados}`}
                    tom={taxa === null ? null : taxa >= 50 ? "bom" : "alerta"} />
          </div>
        )}

        <Bloco Icone={AlertTriangle} titulo="Sessões que passaram e ninguém registrou"
          descricao="Se esta lista cresce, o problema está na tela do treinador ou no hábito."
          vazio="Nenhuma sessão pendente. É o que se quer ver aqui.">
          {pendencias.length > 0 && (
            <Tabela colunas={["Quando", "Cliente", "Treinador", "Parada há"]}
              linhas={pendencias.map((s) => (
                <tr key={s.sessao_id}>
                  <td style={td}>{dia(s.agendado_inicio)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.cliente}</td>
                  <td style={td}>{s.treinador}</td>
                  <td style={{ ...td, color: s.dias_parada >= 2 ? T.danger : T.n700,
                               fontWeight: s.dias_parada >= 2 ? 700 : 400 }}>
                    {s.dias_parada === 0 ? "hoje" : `${s.dias_parada} dia${s.dias_parada > 1 ? "s" : ""}`}
                  </td>
                </tr>
              ))} />
          )}
        </Bloco>

        <Bloco Icone={Clock3} titulo="Pesquisas enviadas sem resposta"
          descricao="Se esta lista cresce, o problema é a pesquisa ou o canal de envio."
          vazio="Ninguém devendo resposta.">
          {pesquisas.length > 0 && (
            <Tabela colunas={["Destinatário", "Cliente", "Treinador", "Esperando há"]}
              linhas={pesquisas.map((p) => (
                <tr key={p.token}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.destinatario}</td>
                  <td style={td}>{p.cliente}</td>
                  <td style={td}>{p.treinador}</td>
                  <td style={{ ...td, color: p.dias_esperando >= 3 ? T.danger : T.n700 }}>
                    {p.dias_esperando === 0 ? "hoje" : `${p.dias_esperando} dia${p.dias_esperando > 1 ? "s" : ""}`}
                  </td>
                </tr>
              ))} />
          )}
        </Bloco>

        <Bloco Icone={Star} titulo="Satisfação por treinador"
          descricao="Média de todas as notas recebidas. Só a coordenação enxerga isto."
          vazio="Nenhuma resposta ainda.">
          {satisfacao.length > 0 && (
            <Tabela colunas={["Treinador", "Média", "Pior nota", "Respostas"]}
              linhas={satisfacao.map((s) => (
                <tr key={s.treinador_id}>
                  <td style={{ ...td, fontWeight: 700 }}>{s.treinador}</td>
                  <td style={{ ...td, fontWeight: 800, fontSize: 16,
                               color: s.media >= 8 ? T.success : s.media >= 6 ? T.text : T.danger }}>
                    {s.media}
                  </td>
                  <td style={{ ...td, color: s.pior_nota <= 5 ? T.danger : T.n700 }}>
                    {s.pior_nota}
                  </td>
                  <td style={{ ...td, color: T.n600 }}>{s.respostas}</td>
                </tr>
              ))} />
          )}
        </Bloco>

        <Bloco Icone={CalendarClock} titulo="Encontros para remarcar"
          descricao="Sessão que não aconteceu e ainda não tem novo horário marcado."
          vazio="Nada pendente de remarcação.">
          {remarcar.length > 0 && (
            <Tabela colunas={["Cliente", "Treinador", "Quando era", "Situação", "Motivo", "Parado há"]}
              linhas={remarcar.map((s) => (
                <tr key={s.sessao_id}>
                  <td style={{ ...td, fontWeight: 700 }}>{s.cliente}</td>
                  <td style={td}>{s.treinador}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{dataHora(s.era_para_ser_em)}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, textTransform: "uppercase", padding: "2px 8px",
                      background: s.status === "faltou" ? T.dangerSoft : T.goldSoft,
                      color: s.status === "faltou" ? "#8f2119" : "#8f6626"
                    }}>
                      {s.status === "faltou" ? "Cliente não veio" : "Remarcada"}
                    </span>
                  </td>
                  <td style={{ ...td, color: T.n600 }}>{s.motivo || "—"}</td>
                  <td style={{ ...td, color: s.dias_parado >= 2 ? T.danger : T.n700,
                               fontWeight: s.dias_parado >= 2 ? 700 : 400 }}>
                    {s.dias_parado === 0 ? "hoje" : `${s.dias_parado} dia${s.dias_parado > 1 ? "s" : ""}`}
                  </td>
                </tr>
              ))} />
          )}
        </Bloco>

        <p style={{ fontSize: 14, color: T.n600, marginTop: 24 }}>
          Poucas respostas fazem qualquer média mentir. Nas primeiras semanas, leia
          as duas primeiras listas — elas dizem se o sistema está sendo usado. A
          terceira só passa a significar alguma coisa depois de umas vinte respostas.
        </p>
      </main>
    </div>
  );
}
