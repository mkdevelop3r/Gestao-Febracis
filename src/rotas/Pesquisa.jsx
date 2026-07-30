import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Lock, Clock3, CircleCheck } from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";

const ANCORAS = {
  qualidade: ["Ruim", "Excelente"],
  clareza: ["Confusas", "Muito claras"],
  avaliacao_treinador: ["Ruim", "Excelente"],
};

function Topo({ dados, compacto }) {
  return (
    <header style={{ background: T.accentDeep, color: "#fff", padding: "24px 20px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: compacto ? 0 : 20 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                         width: 28, height: 28, background: T.gold, color: T.accentDeep,
                         fontWeight: 800 }}>F</span>
          <span style={{ fontWeight: 800 }}>Febracis Bahia</span>
        </div>

        {!compacto && (
          <>
            {dados.total && (
              <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase",
                          letterSpacing: "0.08em", color: "#b3c3d8", margin: "0 0 8px" }}>
                Sessão {dados.numero} de {dados.total}
              </p>
            )}
            <h1 style={{ fontSize: 24, color: "#fff", marginBottom: 16 }}>
              {dados.cliente.split(" ")[0]}, como foi seu encontro com {dados.treinador}?
            </h1>
            {dados.total && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }} aria-hidden="true">
                {Array.from({ length: dados.total }).map((_, i) => (
                  <span key={i} style={{
                    width: 12, height: i + 1 === dados.numero ? 12 : 2,
                    background: i + 1 < dados.numero ? T.accentMid
                      : i + 1 === dados.numero ? T.gold : "#2A4B73",
                  }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}

function Escala({ valor, onChange, rotulo, ancoras }) {
  return (
    <div>
      <div role="radiogroup" aria-label={rotulo}
           style={{ display: "grid", gridTemplateColumns: "repeat(11, minmax(0,1fr))", gap: 2 }}>
        {Array.from({ length: 11 }).map((_, n) => {
          const on = valor === n;
          return (
            <button key={n} type="button" role="radio" aria-checked={on} aria-label={`Nota ${n}`}
              onClick={() => onChange(n)}
              style={{ height: 52, fontSize: 14, fontWeight: 800, cursor: "pointer",
                       fontVariantNumeric: "tabular-nums",
                       background: on ? T.accent : T.bg, color: on ? "#fff" : T.n700,
                       border: `2px solid ${on ? T.accent : T.n300}` }}>
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 12, color: T.n600 }}>{ancoras[0]}</span>
        <span style={{ fontSize: 12, color: T.n600 }}>{ancoras[1]}</span>
      </div>
    </div>
  );
}

function Aviso({ Icone, titulo, texto }) {
  return (
    <main style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                       width: 56, height: 56, marginBottom: 20,
                       background: T.n100, border: `2px solid ${T.n300}` }}>
          <Icone size={28} strokeWidth={2} style={{ color: T.n600 }} />
        </span>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{titulo}</h1>
        <p style={{ fontSize: 16, color: T.n700, margin: 0 }}>{texto}</p>
      </div>
    </main>
  );
}

export default function Pesquisa() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [notas, setNotas] = useState({});
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    supabase.rpc("pesquisa_abrir", { p_token: token }).then(({ data, error }) => {
      if (error) setErro(error.message);
      else setDados(data);
    });
  }, [token]);

  if (erro) {
    return <Aviso Icone={Clock3} titulo="Não deu para abrir a pesquisa"
                  texto="Tente de novo em alguns minutos ou peça um link novo." />;
  }
  if (!dados) return <p style={{ padding: 24, color: T.n600 }}>Carregando…</p>;

  if (dados.estado === "respondida") {
    return (<><Topo dados={dados} compacto />
      <Aviso Icone={CircleCheck} titulo="Você já respondeu esta sessão"
             texto="Cada sessão tem uma pesquisa própria — a próxima chega depois do seu próximo encontro." /></>);
  }
  if (dados.estado === "expirada") {
    return (<><Topo dados={dados} compacto />
      <Aviso Icone={Clock3} titulo="Este link não vale mais"
             texto="Links de pesquisa expiram em 30 dias. Peça um novo para a coordenação." /></>);
  }
  if (dados.estado === "invalido") {
    return <Aviso Icone={Clock3} titulo="Link não encontrado"
                  texto="Confira se o endereço veio completo da mensagem." />;
  }
  if (dados.estado === "enviada") {
    return (<><Topo dados={dados} compacto />
      <Aviso Icone={Check} titulo="Resposta enviada"
             texto={`Obrigado, ${dados.cliente.split(" ")[0]}. Pode fechar esta página.`} /></>);
  }

  const perguntasNota = dados.perguntas.filter((p) => p.formato !== "texto");
  const perguntaTexto = dados.perguntas.find((p) => p.formato === "texto");
  const completo = perguntasNota.every((p) => notas[p.chave] !== undefined);

  const enviar = async () => {
    if (!completo || enviando) return;
    setEnviando(true);

    const respostas = perguntasNota.map((p) => ({ chave: p.chave, nota: notas[p.chave] }));
    if (perguntaTexto && comentario.trim()) {
      respostas.push({ chave: perguntaTexto.chave, texto: comentario.trim() });
    }

    const { data, error } = await supabase.rpc("pesquisa_responder", {
      p_token: token, p_respostas: respostas,
    });

    setEnviando(false);
    if (error) { setErro(error.message); return; }
    setDados({ ...dados, estado: data.estado === "ok" ? "enviada" : data.estado });
  };

  return (
    <>
      <Topo dados={dados} />
      <main style={{ padding: "24px 20px 48px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p style={{ fontSize: 14, color: T.n700, marginBottom: 24 }}>
            São {perguntasNota.length} perguntas e leva menos de um minuto.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {perguntasNota.map((p, i) => (
              <section key={p.chave}
                style={{ background: T.bg, border: `2px solid ${T.n300}`, padding: "20px 16px" }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.gold,
                                 fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 style={{ fontSize: 16, lineHeight: 1.3 }}>{p.enunciado}</h2>
                </div>
                <Escala valor={notas[p.chave]} rotulo={p.enunciado}
                  ancoras={ANCORAS[p.chave] || ["Pouco", "Muito"]}
                  onChange={(n) => setNotas((a) => ({ ...a, [p.chave]: n }))} />
              </section>
            ))}

            {perguntaTexto && (
              <section style={{ background: T.bg, border: `2px solid ${T.n300}`, padding: "20px 16px" }}>
                <label>
                  <span style={{ display: "flex", justifyContent: "space-between",
                                 alignItems: "baseline", marginBottom: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.015em" }}>
                      {perguntaTexto.enunciado}
                    </span>
                    <span style={{ fontSize: 12, color: T.n500 }}>opcional</span>
                  </span>
                  <textarea rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)}
                    placeholder="O que funcionou bem, o que poderia ser diferente."
                    style={{ ...entrada, resize: "vertical" }} />
                </label>
              </section>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, background: T.goldSoft,
                        borderLeft: `4px solid ${T.gold}`, padding: "12px 16px", marginTop: 24 }}>
            <Lock size={16} strokeWidth={2} style={{ color: "#8f6626", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 14, color: "#6d4c1e", margin: 0 }}>
              Sua resposta vai direto para a coordenação. {dados.treinador} vê apenas a
              média do time, nunca a nota de um cliente.
            </p>
          </div>

          <button type="button" onClick={enviar} disabled={!completo || enviando}
            style={{ width: "100%", marginTop: 20, padding: "16px", fontSize: 16, fontWeight: 800,
                     border: "none", background: completo ? T.accent : T.n300,
                     color: completo ? "#fff" : T.n500,
                     cursor: completo ? "pointer" : "not-allowed" }}>
            {enviando ? "Enviando…" : "Enviar resposta"}
          </button>

          {!completo && (
            <p style={{ fontSize: 14, color: T.n600, textAlign: "center", marginTop: 12 }}>
              Falta responder {perguntasNota.filter((p) => notas[p.chave] === undefined).length} de{" "}
              {perguntasNota.length}.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
