import { useEffect, useState } from "react";
import { CalendarDays, Video, MapPin } from "lucide-react";
import { supabase } from "../supabase.js";
import { T } from "../tokens.js";

/* Se a coordenação marca por ele, o treinador precisa ver
   além de hoje — senão descobre o compromisso no dia. */

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function rotuloDia(iso) {
  const d = new Date(iso);
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);

  const mesmoDia = d.toDateString() === amanha.toDateString();
  if (mesmoDia) return "amanhã";

  return `${DIAS[d.getDay()]}, ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const hora = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function ProximosEncontros({ dias = 7 }) {
  const [sessoes, setSessoes] = useState(null);

  useEffect(() => {
    (async () => {
      const fimDeHoje = new Date();
      fimDeHoje.setHours(23, 59, 59, 999);

      const limite = new Date();
      limite.setDate(limite.getDate() + dias);
      limite.setHours(23, 59, 59, 999);

      // Sem filtro por treinador: o RLS já devolve só o que é dele.
      const { data } = await supabase
        .from("sessoes")
        .select(`
          id, numero, agendado_inicio, status,
          processos ( codigo, tipo, total_sessoes,
            clientes ( nome, empresa ),
            treinadores ( nome ) )
        `)
        .eq("status", "agendada")
        .gt("agendado_inicio", fimDeHoje.toISOString())
        .lte("agendado_inicio", limite.toISOString())
        .order("agendado_inicio");

      setSessoes(data ?? []);
    })();
  }, [dias]);

  if (!sessoes || sessoes.length === 0) return null;

  // Mostra o nome do treinador só quando há mais de um — útil
  // para a coordenação, ruído para o treinador.
  const varios =
    new Set(sessoes.map((s) => s.processos.treinadores.nome)).size > 1;

  // Agrupa por dia
  const porDia = sessoes.reduce((acc, s) => {
    const chave = new Date(s.agendado_inicio).toDateString();
    (acc[chave] ??= []).push(s);
    return acc;
  }, {});

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8,
                   marginBottom: 4 }}>
        <CalendarDays size={20} strokeWidth={2} style={{ color: T.gold }} />
        Próximos {dias} dias
      </h2>
      <p style={{ fontSize: 14, color: T.n600, margin: "0 0 12px" }}>
        {sessoes.length} {sessoes.length === 1 ? "encontro marcado" : "encontros marcados"}.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(porDia).map(([chave, doDia]) => (
          <div key={chave} style={{ background: T.bg, border: `2px solid ${T.n300}` }}>
            <p style={{ margin: 0, padding: "10px 16px", fontSize: 12, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.06em", color: T.n700,
                        background: T.n100, borderBottom: `2px solid ${T.n200}` }}>
              {rotuloDia(doDia[0].agendado_inicio)}
            </p>

            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {doDia.map((s, i) => {
                const p = s.processos;
                const coaching = p.tipo === "coaching";
                return (
                  <li key={s.id}
                      style={{ display: "flex", alignItems: "center", gap: 14,
                               padding: "12px 16px",
                               borderTop: i ? `2px solid ${T.n200}` : "none",
                               borderLeft: `4px solid ${coaching ? T.accentMid : T.gold}` }}>
                    <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums",
                                   minWidth: 46 }}>
                      {hora(s.agendado_inicio)}
                    </span>

                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700 }}>
                        {p.clientes.nome}
                      </span>
                      <span style={{ display: "block", fontSize: 13, color: T.n600 }}>
                        {coaching
                          ? `Sessão ${s.numero} de ${p.total_sessoes}`
                          : `${s.numero}º encontro`}
                        {varios && ` · ${p.treinadores.nome}`}
                      </span>
                    </span>

                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
                                   fontSize: 13, color: T.n500 }}>
                      {p.clientes.empresa
                        ? <><MapPin size={14} strokeWidth={2} /> {p.clientes.empresa}</>
                        : <><Video size={14} strokeWidth={2} /> Online</>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
