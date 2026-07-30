import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import { PapelContext } from "./papel.js";
import Login from "./rotas/Login.jsx";
import Hoje from "./rotas/Hoje.jsx";
import Gestao from "./rotas/Gestao.jsx";
import Agendar from "./rotas/Agendar.jsx";
import Pesquisa from "./rotas/Pesquisa.jsx";
import { T } from "./tokens.js";

export default function App() {
  const [sessao, setSessao] = useState(undefined); // undefined = ainda carregando
  const [papel, setPapel] = useState(undefined);   // undefined = ainda carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sessao === undefined) return;           // sessão ainda carregando
    if (!sessao) { setPapel(null); return; }    // deslogado: sem papel

    let vivo = true;
    // Filtra pelo próprio usuário: o RLS deixa a gestão ver todos os perfis,
    // então uma consulta sem filtro volta várias linhas e o maybeSingle() quebra.
    supabase.from("perfis").select("papel").eq("id", sessao.user.id).maybeSingle()
      .then(({ data }) => { if (vivo) setPapel(data?.papel ?? null); });
    return () => { vivo = false; };
  }, [sessao]);

  // Espera a sessão e, quando logado, também o papel — senão a tela pisca
  // no destino errado antes de saber quem é.
  if (sessao === undefined || (sessao && papel === undefined)) {
    return <p style={{ padding: 24, color: T.n600 }}>Carregando…</p>;
  }

  const inicio = ["gestao", "admin"].includes(papel) ? "/gestao" : "/hoje";

  return (
    <PapelContext.Provider value={papel}>
      <BrowserRouter>
        <Routes>
          {/* Pública: o cliente abre pelo WhatsApp, sem login. */}
          <Route path="/s/:token" element={<Pesquisa />} />

          <Route path="/entrar" element={sessao ? <Navigate to={inicio} replace /> : <Login />} />
          <Route path="/hoje" element={sessao ? <Hoje /> : <Navigate to="/entrar" replace />} />
          <Route path="/gestao" element={sessao ? <Gestao /> : <Navigate to="/entrar" replace />} />
          <Route path="/agendar" element={sessao ? <Agendar /> : <Navigate to="/entrar" replace />} />
          <Route path="*" element={<Navigate to={sessao ? inicio : "/entrar"} replace />} />
        </Routes>
      </BrowserRouter>
    </PapelContext.Provider>
  );
}
