import { createContext, useContext } from "react";

/* Papel do usuário logado: "gestao" | "admin" | "treinador" | null.
   O App resolve uma vez e expõe aqui para o cabeçalho decidir os links
   e para as rotas mandarem cada um para a tela inicial certa. */
export const PapelContext = createContext(null);

export const usePapel = () => useContext(PapelContext);
