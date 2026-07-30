import { useState } from "react";
import { MessageCircle, Copy, Check, X } from "lucide-react";
import { T } from "../tokens.js";

/* Enquanto o disparo automático não existe, quem envia é o treinador.
   Este painel entrega o link pronto — um por destinatário. */

const somenteDigitos = (tel) => (tel || "").replace(/\D/g, "");

export default function LinksPesquisa({ links, treinador, onFechar }) {
  const [copiado, setCopiado] = useState(null);

  const copiar = async (url, token) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Alguns navegadores bloqueiam fora de https — seleção manual resolve.
      window.prompt("Copie o link:", url);
    }
    setCopiado(token);
    setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <div style={{ background: T.bg, border: `2px solid ${T.success}`, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: T.successSoft, padding: "12px 16px" }}>
        <p style={{ margin: 0, fontWeight: 800, color: "#12603c" }}>
          Sessão registrada — {links.length === 1
            ? "envie a pesquisa"
            : `envie a pesquisa para ${links.length} participantes`}
        </p>
        <button type="button" onClick={onFechar} aria-label="Fechar"
          style={{ background: "none", border: "none", color: "#12603c", cursor: "pointer" }}>
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {links.map((l, i) => {
          const url = `${window.location.origin}/s/${l.token}`;
          const texto =
            `Oi, ${l.nome.split(" ")[0]}! Aqui é ${treinador || "a Febracis"}. ` +
            `Pode avaliar nosso encontro de hoje? Leva menos de um minuto: ${url}`;
          const numero = somenteDigitos(l.telefone);
          const whats = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

          return (
            <li key={l.token}
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
                         padding: "14px 16px",
                         borderTop: i ? `2px solid ${T.n200}` : "none" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ margin: 0, fontWeight: 800 }}>{l.nome}</p>
                <p style={{ margin: 0, fontSize: 14, color: T.n600 }}>
                  {l.telefone || "sem telefone cadastrado"}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => copiar(url, l.token)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6,
                           padding: "9px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer",
                           background: T.bg, color: T.n700, border: `2px solid ${T.n300}` }}>
                  {copiado === l.token
                    ? <><Check size={15} strokeWidth={2} /> Copiado</>
                    : <><Copy size={15} strokeWidth={2} /> Copiar link</>}
                </button>

                {numero ? (
                  <a href={whats} target="_blank" rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6,
                             padding: "9px 14px", fontSize: 14, fontWeight: 800,
                             textDecoration: "none",
                             background: T.accent, color: "#fff" }}>
                    <MessageCircle size={15} strokeWidth={2} /> WhatsApp
                  </a>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "9px 12px",
                                 fontSize: 14, color: T.n500, border: `2px dashed ${T.n300}` }}>
                    Cadastre o telefone
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p style={{ margin: 0, padding: "12px 16px", fontSize: 14, color: T.n600,
                  borderTop: `2px solid ${T.n200}`, background: T.n100 }}>
        O link vale 30 dias e só pode ser respondido uma vez.
      </p>
    </div>
  );
}
