import { Link } from "react-router-dom";
import { CalendarPlus, Activity, LogOut } from "lucide-react";
import { supabase } from "../supabase.js";
import { T } from "../tokens.js";
import { usePapel } from "../papel.js";

/* Cabeçalho único das telas internas. Os links mudam com o papel:
   a gestão vê "Acompanhamento" e "Marcar encontros"; o treinador vê
   só "Marcar encontros". A marca leva cada um para a sua tela inicial. */

const linkEstilo = {
  color: "#b3c3d8", fontSize: 14, textDecoration: "none",
  display: "inline-flex", alignItems: "center", gap: 6,
};

export default function Cabecalho() {
  const papel = usePapel();
  const gestao = ["gestao", "admin"].includes(papel);
  const inicio = gestao ? "/gestao" : "/hoje";

  return (
    <header style={{ background: T.accentDeep, color: "#fff", padding: "12px 16px",
                     display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Link to={inicio} style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800,
                                 color: "#fff", textDecoration: "none" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                       width: 28, height: 28, background: T.gold, color: T.accentDeep }}>F</span>
        Febracis · Gestão
      </Link>

      <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {gestao && (
          <Link to="/gestao" style={linkEstilo}>
            <Activity size={16} strokeWidth={2} /> Acompanhamento
          </Link>
        )}
        <Link to="/agendar" style={linkEstilo}>
          <CalendarPlus size={16} strokeWidth={2} /> Marcar encontros
        </Link>
        <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sair"
          style={{ background: "none", border: "none", color: "#b3c3d8", cursor: "pointer" }}>
          <LogOut size={18} strokeWidth={2} />
        </button>
      </nav>
    </header>
  );
}
