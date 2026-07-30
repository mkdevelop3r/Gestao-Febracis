import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./supabase.js";
import Login from "./rotas/Login.jsx";
import Hoje from "./rotas/Hoje.jsx";
import Gestao from "./rotas/Gestao.jsx";
import Pesquisa from "./rotas/Pesquisa.jsx";
import { T } from "./tokens.js";
import Agendar from "./rotas/Agendar.jsx";

export default function App() {
  const [sessao, setSessao] = useState(undefined); // undefined = ainda carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (sessao === undefined) {
    return <p style={{ padding: 24, color: T.n600 }}>Carregando…</p>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Pública: o cliente abre pelo WhatsApp, sem login. */}
        <Route path="/s/:token" element={<Pesquisa />} />

        <Route path="/entrar" element={sessao ? <Navigate to="/hoje" replace /> : <Login />} />
        <Route path="/hoje" element={sessao ? <Hoje /> : <Navigate to="/entrar" replace />} />
        <Route path="/gestao" element={sessao ? <Gestao /> : <Navigate to="/entrar" replace />} />
        <Route path="*" element={<Navigate to={sessao ? "/hoje" : "/entrar"} replace />} />
        <Route path="/agendar" element={sessao ? <Agendar /> : <Navigate to="/entrar" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
