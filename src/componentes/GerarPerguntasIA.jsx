import { useState } from "react";
import { Sparkles, Upload, X, AlertTriangle, FileText } from "lucide-react";
import { supabase } from "../supabase.js";
import { T, entrada } from "../tokens.js";

/* Gera um rascunho das perguntas a partir do objetivo da mentoria.
   O texto é extraído aqui no navegador — o arquivo não sai do
   computador da Elis. Quem decide o que vale é ela: nada entra
   no banco sem ela salvar. */

const CDN_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

async function extrairPdf(arquivo) {
  // Carrega a biblioteca sob demanda: quem nunca usa a IA não paga o download
  if (!window.pdfjsLib) {
    await new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = `${CDN_PDFJS}/pdf.min.js`;
      s.onload = ok;
      s.onerror = () => falha(new Error("não deu para carregar o leitor de PDF"));
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${CDN_PDFJS}/pdf.worker.min.js`;
  }

  const buffer = await arquivo.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;

  let texto = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const pagina = await pdf.getPage(i);
    const conteudo = await pagina.getTextContent();
    texto += conteudo.items.map((t) => t.str).join(" ") + "\n";
  }
  return texto.trim();
}

export default function GerarPerguntasIA({ processo, onGerado }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  const anexar = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErro(null);
    setLendo(true);
    setArquivo(f.name);

    try {
      let extraido = "";
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        extraido = await extrairPdf(f);
      } else {
        extraido = await f.text();
      }

      if (extraido.length < 40) {
        setErro(
          "Quase nenhum texto foi encontrado. Se o PDF for digitalizado, ele é imagem — " +
          "copie e cole o conteúdo no campo abaixo."
        );
      }
      setTexto(extraido);
    } catch (err) {
      setErro(String(err.message ?? err));
    } finally {
      setLendo(false);
    }
  };

  const gerar = async () => {
    setGerando(true);
    setErro(null);

    const { data, error } = await supabase.functions.invoke("gerar-perguntas", {
      body: { processo_id: processo.id, texto_objetivo: texto },
    });

    setGerando(false);

    if (error) { setErro(error.message); return; }
    if (data?.erro) { setErro(data.erro); return; }

    if (!data?.perguntas?.length) {
      setErro("Nada foi gerado. O material está vago demais — descreva melhor o objetivo.");
      return;
    }

    onGerado(data.perguntas);
    setAberto(false);
  };

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)}
        style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8,
                 padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                 background: T.goldSoft, color: "#8f6626", border: `2px solid ${T.gold}` }}>
        <Sparkles size={15} strokeWidth={2} /> Gerar a partir do objetivo
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, border: `2px solid ${T.gold}`, background: T.bg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: T.goldSoft }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8,
                       fontWeight: 800, color: "#8f6626", fontSize: 14 }}>
          <Sparkles size={16} strokeWidth={2} /> Rascunho a partir do objetivo
        </span>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#8f6626" }}>
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: T.n700 }}>
          Anexe o documento do objetivo desta mentoria, ou cole o conteúdo.
          As entregas cadastradas entram no contexto automaticamente.
        </p>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "9px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                        background: T.bg, color: T.n700, border: `2px solid ${T.n300}`,
                        alignSelf: "flex-start" }}>
          <Upload size={15} strokeWidth={2} />
          {lendo ? "Lendo…" : "Anexar PDF ou texto"}
          <input type="file" accept=".pdf,.txt,.md" onChange={anexar}
            style={{ display: "none" }} />
        </label>

        {arquivo && !lendo && (
          <p style={{ margin: 0, fontSize: 13, color: T.n600,
                      display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} strokeWidth={2} /> {arquivo} · {texto.length} caracteres lidos
          </p>
        )}

        <label>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600,
                         textTransform: "uppercase", letterSpacing: "0.06em",
                         color: T.n700, marginBottom: 6 }}>
            Objetivo da mentoria
          </span>
          <textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Reduzir o custo por produto e implantar rotina de caixa diário na padaria, com a equipe assumindo o controle até o fim do processo."
            style={{ ...entrada, resize: "vertical" }} />
        </label>

        {erro && (
          <p style={{ background: T.dangerSoft, borderLeft: `4px solid ${T.danger}`,
                      color: "#8f2119", fontSize: 14, padding: "10px 12px", margin: 0,
                      display: "flex", gap: 10 }}>
            <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {erro}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={gerar} disabled={gerando || lendo}
            style={{ display: "inline-flex", alignItems: "center", gap: 8,
                     padding: "10px 18px", fontSize: 14, fontWeight: 800, border: "none",
                     background: T.accent, color: "#fff",
                     cursor: gerando ? "wait" : "pointer" }}>
            <Sparkles size={15} strokeWidth={2} />
            {gerando ? "Gerando…" : "Gerar perguntas"}
          </button>
          <span style={{ fontSize: 13, color: T.n600 }}>
            O rascunho substitui o que estiver escrito. Revise antes de salvar.
          </span>
        </div>
      </div>
    </div>
  );
}
