import { useEffect, useState } from "react";
import { Plus, Trash2, Check, AlertTriangle, Send, Lock } from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";
import GerarPerguntasIA from "./GerarPerguntasIA.jsx";

/* Pesquisa de resultado de uma mentoria. Estrutura fixa:
   1. NPS, texto travado, para o número ser comparável entre mentorias.
   2..5. Até 4 perguntas livres da Elis, cada uma com categoria — o texto
      muda, a categoria é o que permite comparar.
   última. Uma pergunta aberta, sempre no fim. */

const MAX = 4;

/* recomendacao (NPS) e aberta são posicionadas pelo banco — não entram aqui. */
const CATEGORIAS = [
  ["aplicacao", "Aplicação"],
  ["resultado", "Resultado no negócio"],
  ["evolucao", "Evolução do gestor"],
  ["continuidade", "Continuidade"],
  ["dificuldade", "Dificuldade"],
];
const CATS_VALIDAS = CATEGORIAS.map(([v]) => v);
const ABERTA_PADRAO = "O que faria esta mentoria valer mais para você?";

export default function PerguntasResultado({ processo }) {
  const [npsTexto, setNpsTexto] = useState("");
  const [custom, setCustom] = useState([]);
  const [aberta, setAberta] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [links, setLinks] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from("vw_perguntas_resultado")
      .select("*")
      .eq("processo_id", processo.id)
      .order("ordem");

    if (error) { setErro(error.message); setCarregando(false); return; }

    if (data?.length) {
      // Distingue pela categoria, não pela posição.
      const nps = data.find((p) => p.categoria === "recomendacao");
      const fim = data.find((p) => p.categoria === "aberta");
      const livres = data.filter(
        (p) => p.categoria !== "recomendacao" && p.categoria !== "aberta");

      setNpsTexto(nps?.enunciado ?? "");
      setCustom(livres.map((p) => ({
        enunciado: p.enunciado,
        categoria: CATS_VALIDAS.includes(p.categoria) ? p.categoria : "resultado",
      })));
      setAberta(fim?.enunciado ?? "");
    } else {
      // Sem modelo próprio: o texto do NPS vem do banco.
      const { data: texto } = await supabase.rpc("nps_enunciado");
      setNpsTexto(texto ?? "");
      setCustom([]);
      setAberta("");
    }
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [processo.id]);

  const trocar = (i, campo, valor) =>
    setCustom((a) => a.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setAviso(null);

    const { error } = await supabase.rpc("salvar_perguntas_resultado", {
      p_processo_id: processo.id,
      p_perguntas: custom
        .filter((p) => p.enunciado.trim())
        .map((p) => ({ enunciado: p.enunciado.trim(), categoria: p.categoria })),
      p_aberta: aberta.trim() || null,
    });

    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setAviso("Perguntas salvas. Vale como uma versão nova — quem já respondeu continua ligado à anterior.");
    carregar();
  };

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    setAviso(null);
    setLinks(null);

    const { data, error } = await supabase.rpc("enviar_pesquisa_resultado", {
      p_processo_id: processo.id,
    });

    setEnviando(false);
    if (error) { setErro(error.message); return; }
    setLinks(data.links ?? []);
  };

  if (processo.tipo !== "mentoria") return null;

  const rotulo = {
    display: "block", fontSize: 12, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.06em", color: T.n700, marginBottom: 8,
  };

  return (
    <section style={{ background: T.bg, border: `2px solid ${T.n300}`, marginTop: 20 }}>
      <div style={{ padding: "14px 16px", borderBottom: `2px solid ${T.n200}` }}>
        <h2 style={{ fontSize: 16 }}>Pesquisa de resultado</h2>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: T.n600 }}>
          Enviada nos marcos da mentoria, não a cada encontro.
        </p>
      </div>

      {carregando ? (
        <p style={{ margin: 0, padding: "20px 16px", fontSize: 14, color: T.n600 }}>
          Carregando…
        </p>
      ) : (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* NPS — travado */}
          <div>
            <span style={rotulo}>Pergunta fixa · NPS</span>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14,
                          color: T.n700, padding: "10px 12px",
                          background: T.n100, borderLeft: `4px solid ${T.gold}` }}>
              <span style={{ fontWeight: 700, color: T.n500 }}>01</span>
              <span style={{ flex: 1 }}>{npsTexto}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                             fontSize: 12, color: T.n500, whiteSpace: "nowrap" }}>
                <Lock size={13} strokeWidth={2} /> não editável
              </span>
            </div>
            <p style={{ fontSize: 13, color: T.n600, margin: "8px 0 0" }}>
              Igual em toda mentoria. É o que torna o número comparável com o mercado.
            </p>
          </div>

          {/* Livres, com categoria */}
          <div>
            <span style={rotulo}>Perguntas desta mentoria</span>
            <p style={{ fontSize: 13, color: T.n600, margin: "0 0 10px" }}>
              A categoria é o que permite comparar: o texto muda entre mentorias, a
              categoria não.
            </p>

            {custom.length === 0 && (
              <p style={{ fontSize: 14, color: T.n600, margin: "0 0 10px" }}>
                Nenhuma ainda. Acrescente perguntas ligadas ao objetivo desta mentoria —
                elas entram entre o NPS e a pergunta aberta.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {custom.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start",
                                      flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: T.gold, paddingTop: 12,
                                 minWidth: 22, fontSize: 13 }}>
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <textarea
                    rows={2}
                    value={p.enunciado}
                    onChange={(e) => trocar(i, "enunciado", e.target.value)}
                    placeholder="Quanto o controle de custo por produto melhorou desde o início?"
                    style={{ ...entrada, flex: "1 1 220px", resize: "vertical" }}
                  />
                  <select value={p.categoria}
                    onChange={(e) => trocar(i, "categoria", e.target.value)}
                    aria-label="Categoria da pergunta"
                    style={{ ...entrada, flex: "0 0 auto", width: 190 }}>
                    {CATEGORIAS.map(([v, r]) => (
                      <option key={v} value={v}>{r}</option>
                    ))}
                  </select>
                  <button type="button"
                    onClick={() => setCustom((a) => a.filter((_, j) => j !== i))}
                    aria-label="Remover pergunta"
                    style={{ background: "none", border: "none", cursor: "pointer",
                             color: T.n500, padding: "12px 4px" }}>
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>

            {custom.length < MAX && (
              <button type="button"
                onClick={() => setCustom((a) => [...a, { enunciado: "", categoria: "resultado" }])}
                style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8,
                         padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                         background: T.bg, color: T.n700, border: `2px solid ${T.n300}` }}>
                <Plus size={15} strokeWidth={2} /> Acrescentar pergunta
              </button>
            )}

            <p style={{ fontSize: 13, color: T.n600, margin: "10px 0 0" }}>
              Até {MAX} perguntas. Todas usam escala de 0 a 10 — misturar escalas quebra a comparação.
            </p>

            <GerarPerguntasIA processo={processo}
              onGerado={(perguntas) =>
                setCustom(perguntas.slice(0, MAX).map((p) => ({
                  enunciado: p.enunciado,
                  categoria: CATS_VALIDAS.includes(p.categoria) ? p.categoria : "resultado",
                })))} />
          </div>

          {/* Aberta — sempre por último */}
          <div>
            <span style={rotulo}>Pergunta aberta · sempre por último</span>
            <textarea
              rows={2}
              value={aberta}
              onChange={(e) => setAberta(e.target.value)}
              placeholder={ABERTA_PADRAO}
              style={{ ...entrada, resize: "vertical" }}
            />
            <p style={{ fontSize: 13, color: T.n600, margin: "8px 0 0" }}>
              Resposta em texto, no fim da pesquisa. Em branco, usa a padrão: “{ABERTA_PADRAO}”
            </p>
          </div>

          {erro && (
            <p style={{ background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
                        color: "#8f2119", fontSize: 14, padding: "12px 16px", margin: 0,
                        display: "flex", gap: 10 }}>
              <AlertTriangle size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> {erro}
            </p>
          )}

          {aviso && (
            <p style={{ background: T.successSoft, border: `2px solid ${T.success}`,
                        color: "#12603c", fontSize: 14, padding: "12px 16px", margin: 0,
                        display: "flex", gap: 10 }}>
              <Check size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> {aviso}
            </p>
          )}

          {links && (
            <div style={{ border: `2px solid ${T.success}` }}>
              <p style={{ margin: 0, padding: "10px 14px", background: T.successSoft,
                          color: "#12603c", fontWeight: 800, fontSize: 14 }}>
                Pesquisa gerada para {links.length}{" "}
                {links.length === 1 ? "destinatário" : "destinatários"}
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {links.map((l, i) => (
                  <li key={l.token}
                      style={{ padding: "10px 14px", fontSize: 14,
                               borderTop: i ? `2px solid ${T.n200}` : "none" }}>
                    <strong>{l.nome}</strong>
                    <br />
                    <code style={{ fontSize: 12, color: T.n600, wordBreak: "break-all" }}>
                      {window.location.origin}/s/{l.token}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
                        borderTop: `2px solid ${T.n200}`, paddingTop: 16 }}>
            <button type="button" onClick={salvar} disabled={salvando}
              style={{ padding: "10px 20px", fontSize: 14, fontWeight: 800, border: "none",
                       background: T.accent, color: "#fff",
                       cursor: salvando ? "wait" : "pointer" }}>
              {salvando ? "Salvando…" : "Salvar perguntas"}
            </button>

            <button type="button" onClick={enviar} disabled={enviando}
              style={{ display: "inline-flex", alignItems: "center", gap: 8,
                       padding: "10px 16px", fontSize: 14, fontWeight: 600,
                       background: T.bg, color: T.n700, border: `2px solid ${T.n300}`,
                       cursor: enviando ? "wait" : "pointer" }}>
              <Send size={15} strokeWidth={2} />
              {enviando ? "Gerando…" : "Enviar pesquisa de resultado"}
            </button>

            <span style={{ fontSize: 13, color: T.n600 }}>
              Salve antes de enviar, senão vale a versão anterior.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
