import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowRight, Microphone, ShoppingBagOpen, TrendDown, TrendUp } from "@phosphor-icons/react";
import { AlmaFace, BrandIcon, SectionTitle } from "../components/Brand.jsx";
import HourlyChart from "../components/HourlyChart.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { buildContext, perLuca, salesLine } from "../lib/alma.js";
import { RESERVE_RATE, dayStats, suggestedOrder } from "../lib/metrics.js";
import { clp, greeting, itemLabel, pct, qtyLabel, timeLabel } from "../lib/format.js";
import { STORE } from "../data/seed.js";

const METHOD_LABEL = { efectivo: "Efectivo", debito: "Débito", fiado: "Fiado" };

function Stat({ label, value, sub, tone, icon }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <BrandIcon name={icon} size={34} />}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function ClosedDay() {
  return (
    <section className="card closed-hero">
      <img src="/brand/icons/closed.webp" alt="" width="150" />
      <div>
        <SectionTitle title="El día está cerrado" kicker="Descansa, que mañana seguimos" size="sm" />
        <p className="lead">Abre el mostrador cuando estés listo y Alma parte la caja desde cero.</p>
        <Link to="/cierre" className="btn btn-pink btn-lg">
          Abrir el mostrador <ArrowRight size={20} weight="bold" />
        </Link>
      </div>
    </section>
  );
}

export default function Hoy() {
  const { state, actions, lastWeek } = useStore();
  const toast = useToast();
  const ctx = useMemo(() => buildContext({ state, lastWeek }), [state, lastWeek]);
  const lw = useMemo(() => dayStats(lastWeek), [lastWeek]);
  const { stats, trend, low, suggestions, fiados } = ctx;
  const nowHour = new Date().getHours();

  if (!state.dayOpen) {
    return (
      <div className="container page">
        <ClosedDay />
      </div>
    );
  }

  const mood = low.length ? "surprised" : trend >= 0.03 ? "happy" : trend < -0.05 ? "sad" : "smile";
  const headline =
    stats.count === 0
      ? "Partamos el día con todo"
      : trend >= 0
        ? `Vamos ${pct(trend)} arriba de la semana pasada`
        : `Vamos ${pct(-trend)} bajo la semana pasada`;

  const recs = [
    ...low.map((p) => ({
      key: `low-${p.id}`,
      icon: "megaphone",
      title: `Encarga ${p.name}`,
      text: `Quedan ${qtyLabel(p.stock, p.unit)} y se vende ${p.speed}. Con ${qtyLabel(suggestedOrder(p), p.unit)} cubres tres días.`,
      action: (
        <button
          className="btn btn-sm btn-pink"
          onClick={() => {
            actions.restock(p.id, suggestedOrder(p));
            toast(`Pedido anotado: +${qtyLabel(suggestedOrder(p), p.unit)} de ${p.name}.`, "happy");
          }}
        >
          Encargar
        </button>
      ),
    })),
    ...suggestions.slice(0, 2).map((s) => ({
      key: `price-${s.id}`,
      icon: "bulb",
      title: `${s.kind === "subir" ? "Sube" : "Baja"} ${s.name} a ${clp(s.suggested)}`,
      text: s.reason,
      action: (
        <button
          className="btn btn-sm btn-paper"
          onClick={() => {
            actions.updateProduct(s.id, { price: s.suggested });
            actions.dismissSuggestion(s.id);
            toast(`${s.name} ahora a ${clp(s.suggested)}.`, "wink");
          }}
        >
          Aplicar
        </button>
      ),
    })),
    fiados.oldest && fiados.oldest.days >= 5
      ? {
          key: "fiado",
          icon: "notebook",
          title: `Recuérdale a ${fiados.oldest.name}`,
          text: `Debe ${clp(fiados.oldest.balance)} desde hace ${fiados.oldest.days} días. Un recordatorio amable a tiempo evita malos ratos.`,
          action: (
            <Link className="btn btn-sm btn-paper" to="/fiados">
              Ver cuaderno
            </Link>
          ),
        }
      : null,
    {
      key: "sobre",
      icon: "bills",
      title: `Aparta ${clp(stats.total * RESERVE_RATE)} para proveedores`,
      text: "La regla del sobre: guarda un poco de cada venta y el día del pedido pagas sin apuros.",
      action: null,
    },
  ].filter(Boolean);

  return (
    <div className="container page hoy">
      <section className="hoy-hero">
        <div className="hoy-face">
          <AlmaFace mood={mood} size={176} />
        </div>
        <div className="hoy-hero-copy">
          <p className="script hello">
            {greeting()}, {STORE.owner}
          </p>
          <h1 className="display hoy-title">{headline}</h1>
          <p className="lead">
            {salesLine(ctx)} {low.length ? `Lo único urgente: ${low.map((p) => `${p.name} (${qtyLabel(p.stock, p.unit)})`).join(", ")}.` : "El stock está al día."}
          </p>
          <div className="hero-actions">
            <Link to="/vender" className="btn btn-pink btn-lg">
              <ShoppingBagOpen size={22} weight="bold" /> Nueva venta
            </Link>
            <Link to="/" className="btn btn-paper btn-lg">
              <Microphone size={22} weight="bold" /> Preguntarle a Alma
            </Link>
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Resumen del día">
        <Stat
          label="Vendido hoy"
          value={clp(stats.total)}
          icon="register"
          tone="ink"
          sub={
            <>
              {trend >= 0 ? <TrendUp size={16} weight="bold" /> : <TrendDown size={16} weight="bold" />}
              {ctx.lastWeekNow ? `${trend >= 0 ? "+" : "−"}${pct(Math.abs(trend))} vs. semana pasada a esta hora` : "Sin comparación aún"}
            </>
          }
        />
        <Stat label="Ganancia limpia" value={clp(stats.profit)} icon="coins" sub={`Ya descontada la mercadería: ${perLuca(stats.margin)}`} />
        <Stat label="Ventas" value={stats.count} icon="cart" sub={`Cada cliente gasta ${clp(stats.avgTicket)} en promedio`} />
        <Stat label="Fiado por cobrar" value={clp(fiados.total)} icon="notebook" sub={`${fiados.count} vecinos en el cuaderno`} tone={fiados.total > 0 ? "pink" : undefined} />
      </section>

      <div className="hoy-grid">
        <section className="card">
          <div className="card-head">
            <SectionTitle title="Lo que Alma te recomienda" size="sm" />
            <AlmaFace mood="wink" size={48} animate={false} alt="" />
          </div>
          <ul className="recs">
            {recs.map((r) => (
              <li key={r.key} className="rec">
                <BrandIcon name={r.icon} size={42} />
                <div className="rec-text">
                  <strong>{r.title}</strong>
                  <span>{r.text}</span>
                </div>
                {r.action}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <SectionTitle title="Movimiento por hora" size="sm" />
            <span className="muted small">Semana pasada: {clp(lw.total)}</span>
          </div>
          <HourlyChart today={stats.hourly} lastWeek={lw.hourly} currentHour={nowHour} />
          <p className="script note">Tu peak es la once: no dejes la vitrina del pan vacía después de las 18:00.</p>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <SectionTitle title="Últimas ventas" size="sm" />
          <Link to="/cierre" className="link-arrow">
            Ver cierre del día <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
        {state.sales.length === 0 ? (
          <p className="empty">Aún no hay ventas. La primera boleta del día está a un toque.</p>
        ) : (
          <ul className="sales-list">
            {state.sales.slice(0, 7).map((s) => (
              <li key={s.id}>
                <span className="sale-time">{timeLabel(s.ts)}</span>
                <span className="sale-items">{s.items.map(itemLabel).join(" · ")}</span>
                <span className={`tag tag-${s.method}`}>{METHOD_LABEL[s.method]}</span>
                <strong className="sale-total">{clp(s.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
