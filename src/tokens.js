/* Design System Febracis — azul escuro primária, dourado destaque,
   canto reto, réguas de 2px, rótulos à esquerda, Archivo. */
export const T = {
  bg: "#ffffff", surface: "#f5f6f8", text: "#0F1B2D",
  accent: "#16304F", accentDeep: "#0F1B2D", accentMid: "#3F6491",
  accent100: "#eef2f7",
  gold: "#D7A34B", goldSoft: "#fdf6e9",
  n100: "#f7f8fa", n200: "#eceef2", n300: "#dcdfe6",
  n500: "#98a0af", n600: "#757d8c", n700: "#575e6b",
  success: "#1E8E5A", successSoft: "#e9f6ef",
  danger: "#C8372B", dangerSoft: "#fceeec",
};

export const FONT = "'Archivo', system-ui, sans-serif";

export const entrada = {
  width: "100%", background: T.bg, border: `2px solid ${T.n300}`,
  color: T.text, fontFamily: FONT, fontSize: 15, lineHeight: 1.55,
  padding: "10px 12px", outline: "none",
};

export const estiloGlobal = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: ${FONT}; font-size: 15px; line-height: 1.55;
         background: ${T.surface}; color: ${T.text};
         -webkit-font-smoothing: antialiased; }
  h1,h2,h3 { font-weight: 800; letter-spacing: -0.015em; line-height: 1.12; margin: 0; }
  button, select, input, textarea { font-family: inherit; }
  button:focus-visible, select:focus-visible,
  input:focus-visible, textarea:focus-visible {
    outline: 2px solid ${T.gold}; outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
