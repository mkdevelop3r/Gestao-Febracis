import { useEffect, useState } from "react";
import { Plus, Trash2, Check, AlertTriangle, Send, Sparkles } from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";

/* Pesquisa de resultado de uma mentoria: núcleo fixo mais até
   três perguntas ligadas ao objetivo daquela mentoria.
   O núcleo não é editável — é ele que permite comparar mentorias
   entre si. As sob medida aparecem só no acompanhamento do
   próprio processo. */

const MAX = 3;

export default function PerguntasResultado({ processo }) {
  const [nucleo, setNucleo] = useState([]);
  const [custom, setCustom] = useState([]);
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
      setNucleo(data.filter((p) => p.nucleo));
      setCustom(data.filter((p) => !p.nucleo).map((p) => ({ enunciado: p.enunciado })));
    } else {
      // Ainda sem modelo próprio: mostra o núcleo global
      const { data: global } = await supabase
        .from("pesquisa_perguntas")
        .select("ordem, enunciado, formato, pesquisa_modelos!inner(tipo, ativo, processo_id)")
        .eq("pesquisa_modelos.tipo", "resultado")
        .eq("pesquisa_modelos.ativo", true)
        .is("pesquisa_modelos.processo_id", null)
        .order("ordem");
      setNucleo(global ?? []);
      setCustom([]);
    }
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [processo.id]);

  const trocar = (i, valor) =>
    setCustom((a) => a.map((p, j) => (j === i ? { enunciado: valor } : p)));

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setAviso(null);

    const { error } = await supabase.rpc("salvar_perguntas_resultado", {
      p_processo_id: processo.id,
      p_perguntas: custom.filter((p) => p.enunciado.trim()),
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
          {/* Núcleo */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: T.n700, marginBottom: 8 }}>
              Perguntas padrão
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0,
                         display: "flex", flexDirection: "column", gap: 6 }}>
              {nucleo.map((p, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 14,
                                     color: T.n700, padding: "8px 12px",
                                     background: T.n100, borderLeft: `4px solid ${T.n300}` }}>
                  <span style={{ fontWeight: 700, color: T.n500 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {p.enunciado}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 13, color: T.n600, margin: "8px 0 0" }}>
              Iguais em todas as mentorias. É o que permite comparar uma com a outra.
            </p>
          </div>

          {/* Sob medida */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.06em", color: T.n700, marginBottom: 8 }}>
              Perguntas desta mentoria
            </p>

            {custom.length === 0 && (
              <p style={{ fontSize: 14, color: T.n600, margin: "0 0 10px" }}>
                Nenhuma ainda. Acrescente perguntas ligadas ao objetivo desta mentoria —
                elas entram depois das padrão.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {custom.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 700, color: T.gold, paddingTop: 12,
                                 minWidth: 22, fontSize: 13 }}>
                    {String(nucleo.length + i + 1).padStart(2, "0")}
                  </span>
                  <textarea
                    rows={2}
                    value={p.enunciado}
                    onChange={(e) => trocar(i, e.target.value)}
                    placeholder="Quanto o controle de custo por produto melhorou desde o início?"
                    style={{ ...entrada, resize: "vertical" }}
                  />
                  <button type="button" onClick={() => setCustom((a) => a.filter((_, j) => j !== i))}
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
                onClick={() => setCustom((a) => [...a, { enunciado: "" }])}
                style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8,
                         padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                         background: T.bg, color: T.n700, border: `2px solid ${T.n300}` }}>
                <Plus size={15} strokeWidth={2} /> Acrescentar pergunta
              </button>
            )}

            <p style={{ fontSize: 13, color: T.n600, margin: "10px 0 0" }}>
              Máximo de {MAX}. Todas usam escala de 0 a 10 — misturar escalas quebra a comparação.
            </p>

            <p style={{ fontSize: 13, color: T.n500, margin: "10px 0 0",
                        display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} strokeWidth={2} />
              Em breve: gerar um rascunho a partir do PDF de objetivo e das entregas.
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
