import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { estiloGlobal } from "./tokens.js";

const folha = document.createElement("style");
folha.textContent = estiloGlobal;
document.head.appendChild(folha);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
