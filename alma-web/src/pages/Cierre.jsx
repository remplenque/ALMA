import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react";
import { AlmaFace, BrandIcon, SectionTitle } from "../components/Brand.jsx";
import HourlyChart from "../components/HourlyChart.jsx";
import Modal from "../components/Modal.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { RESERVE_RATE, dayStats, lowStock, peakHour, suggestedOrder } from "../lib/metrics.js";
import { clp, pct, qtyLabel } from "../lib/format.js";
import { perLuca } from "../lib/alma.js";
import { STORE } from "../data/seed.js";

function money(v) {
  return Number(String(v).replace(/\D/g, "")) || 0;
}

function OpenDay() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [cash, setCash] = useState(String(state.openingCash));
  const last = state.lastClose || state.history[0];
  const diff = last && last.counted != null ? last.counted - last.expectedCash : null;

  return (
    <div className="container page cierre">
      <section className="card closed-hero">
        <img src="/brand/icons/closed.webp" alt="" width="160" />
        <div>
          <SectionTitle as="h1" title={`¡Buen trabajo, ${STORE.owner}!`} kicker="El día quedó cerrado y guardado" size="lg" />
          {last && (
            <div className="closed-summary">
              <div>
                <span>Vendiste</span>
                <strong>{clp(last.total)}</strong>
              </div>
              <div>
                <span>Ganancia limpia</span>
                <strong>{clp(last.profit)}</strong>
              </div>
              <div>
                <span>Ventas</span>
                <strong>{last.count}</strong>
              </div>
              {diff != null && (
                <div>
                  <span>Arqueo</span>
                  <strong>{diff === 0 ? "Cuadró" : diff > 0 ? `Sobró ${clp(diff)}` : `Faltó ${clp(-diff)}`}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="cierre-grid">
        <section className="card open-day">
          <img src="/brand/icons/open.webp" alt="" width="120" />
          <SectionTitle title="Abrir el mostrador" kicker="Partimos de nuevo" size="sm" />
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              actions.openDay(money(cash));
              toast("¡Mostrador abierto! Que sea un buen día.", "happy");
            }}
          >
            <label className="field">
              <span className="field-label">Sencillo con el que partes la caja</span>
              <input className="input input-lg" inputMode="numeric" value={clp(money(cash))} onChange={(e) => setCash(e.target.value)} />
            </label>
            <button className="btn btn-pink btn-lg btn-block" type="submit">
              Abrir el día
            </button>
          </form>
        </section>

        <section className="card">
          <SectionTitle title="Días anteriores" size="sm" />
          {state.history.length === 0 ? (
            <p className="empty">Aquí quedarán tus cierres.</p>
          ) : (
            <ul className="history">
              {state.history.slice(0, 7).map((h) => (
                <li key={h.closedAt}>
                  <span>{new Date(`${h.dateKey}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</span>
                  <span className="muted">{h.count} ventas</span>
                  <strong>{clp(h.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Cierre() {
  const { state, actions, avgDay } = useStore();
  const toast = useToast();
  const stats = useMemo(() => dayStats(state.sales), [state.sales]);
  const [counted, setCounted] = useState("");
  const [confirm, setConfirm] = useState(false);

  if (!state.dayOpen) return <OpenDay />;

  const expected = state.openingCash + stats.byMethod.efectivo;
  const countedNum = money(counted);
  const diff = counted ? countedNum - expected : null;
  const reserve = stats.total * RESERVE_RATE;
  const low = lowStock(state.products);
  const peak = peakHour(stats.hourly);
  const methodMax = Math.max(1, ...Object.values(stats.byMethod));
  // Comparación justa: un día promedio hasta esta misma hora (al cierre, el día completo).
  const now = new Date();
  const nowDec = now.getHours() + now.getMinutes() / 60;
  const avgUntil = avgDay.hourly.reduce((s, h) => s + h.total * Math.max(0, Math.min(1, nowDec - h.hour)), 0);
  const frac = avgDay.total ? Math.max(0.05, avgUntil / avgDay.total) : 1;
  const fullDay = frac > 0.97;
  const vsAvg = avgDay.total ? stats.total / (avgDay.total * frac) - 1 : 0;
  const compare = [
    { label: "Vendido", today: stats.total, avg: avgDay.total * frac, fmt: clp },
    { label: "Ganancia limpia", today: stats.profit, avg: avgDay.profit * frac, fmt: clp },
    { label: "Ventas", today: stats.count, avg: avgDay.count * frac, fmt: (n) => Math.round(n) },
    { label: "Gasto por cliente", today: stats.avgTicket, avg: avgDay.avgTicket, fmt: clp },
  ];
  const arqueoMood = diff == null ? "neutral" : diff === 0 ? "happy" : diff > 0 ? "surprised" : "sad";

  return (
    <div className="container page cierre">
      <header className="page-head">
        <SectionTitle as="h1" title="Cierre del día" kicker="Cuadra la caja en dos minutos" size="lg" />
        <button className="btn btn-ink btn-lg" onClick={() => setConfirm(true)}>
          <BrandIcon name="closed" size={30} /> Cerrar el día
        </button>
      </header>

      <section className="cierre-hero">
        <div className="big-total">
          <span className="stat-label">Vendiste hoy</span>
          <strong className="display">{clp(stats.total)}</strong>
          <span className={`vs ${vsAvg >= 0 ? "up" : "down"}`}>
            {vsAvg >= 0 ? "▲" : "▼"} {pct(Math.abs(vsAvg))} {vsAvg >= 0 ? "sobre" : "bajo"} un día normal {fullDay ? `(${clp(avgDay.total)})` : `a esta hora (${clp(avgDay.total * frac)})`}
          </span>
        </div>
        <div className="profit">
          <span className="stat-label">Te queda limpio</span>
          <strong className="display">{clp(stats.profit)}</strong>
          <span>Ya pagada la mercadería: {perLuca(stats.margin)}.</span>
        </div>
      </section>

      <section className="card compare">
        <div className="card-head">
          <SectionTitle title="Hoy contra un día normal" kicker={fullDay ? "Promedio de tus últimos 7 días" : "Promedio de tus últimos 7 días, a esta misma hora"} size="sm" />
          <AlmaFace mood={vsAvg >= 0 ? "happy" : "sad"} size={60} />
        </div>
        <div className="compare-grid">
          {compare.map((c) => {
            const diff = c.avg ? c.today / c.avg - 1 : 0;
            const max = Math.max(c.today, c.avg, 1);
            return (
              <div className="compare-item" key={c.label}>
                <span className="stat-label">{c.label}</span>
                <strong className="display">{c.fmt(c.today)}</strong>
                <span className="compare-bars" aria-hidden="true">
                  <i className="today" style={{ width: `${(c.today / max) * 100}%` }} />
                  <i className="avg" style={{ width: `${(c.avg / max) * 100}%` }} />
                </span>
                <span className={`vs ${diff >= 0 ? "up" : "down"}`}>
                  {diff >= 0 ? "▲" : "▼"} {pct(Math.abs(diff))} · promedio {c.fmt(c.avg)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cierre-grid">
        <section className="card arqueo">
          <div className="card-head">
            <SectionTitle title="Arqueo de caja" kicker="¿Cuadra lo que hay en el cajón?" size="sm" />
            <AlmaFace mood={arqueoMood} size={64} />
          </div>
          <dl className="arqueo-calc">
            <div>
              <dt>Sencillo inicial</dt>
              <dd>{clp(state.openingCash)}</dd>
            </div>
            <div>
              <dt>Ventas en efectivo</dt>
              <dd>+ {clp(stats.byMethod.efectivo)}</dd>
            </div>
            <div className="arqueo-total">
              <dt>Debería haber en la caja</dt>
              <dd>{clp(expected)}</dd>
            </div>
          </dl>
          <label className="field">
            <span className="field-label">¿Cuánto contaste?</span>
            <input className="input input-lg" inputMode="numeric" placeholder="$0" value={counted ? clp(countedNum) : ""} onChange={(e) => setCounted(e.target.value)} />
          </label>
          {diff != null && (
            <p className={`arqueo-result ${diff === 0 ? "ok" : diff > 0 ? "over" : "short"}`}>
              {diff === 0
                ? "¡Cuadra perfecto! Ni un peso de más ni de menos."
                : diff > 0
                  ? `Sobran ${clp(diff)}. ¿Algún vuelto que no se entregó o una venta sin anotar?`
                  : `Faltan ${clp(-diff)}. Revisa vueltos y si hubo algún fiado sin anotar.`}
            </p>
          )}
        </section>

        <section className="card">
          <SectionTitle title="Cómo te pagaron" size="sm" />
          <ul className="methods">
            {[
              ["efectivo", "Efectivo", "bills"],
              ["debito", "Débito", "register"],
              ["fiado", "Fiado", "notebook"],
            ].map(([id, label, icon]) => (
              <li key={id}>
                <BrandIcon name={icon} size={38} />
                <span className="method-name">{label}</span>
                <span className="method-bar">
                  <i style={{ width: `${(stats.byMethod[id] / methodMax) * 100}%` }} className={id === "fiado" ? "pink" : ""} />
                </span>
                <strong>{clp(stats.byMethod[id])}</strong>
              </li>
            ))}
          </ul>
          <div className="sobre">
            <BrandIcon name="coins" size={46} />
            <div>
              <strong>La regla del sobre</strong>
              <p>
                Aparta <b>{clp(reserve)}</b> para proveedores y cuentas. Te quedan <b>{clp(stats.total - reserve)}</b> para el día a día.
              </p>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <SectionTitle title="Movimiento del día" size="sm" />
            {peak.total > 0 && <span className="muted small">Peak: {peak.hour}:00 – {peak.hour + 1}:00</span>}
          </div>
          <HourlyChart today={stats.hourly} lastWeek={avgDay.hourly} currentHour={new Date().getHours()} compareLabel="Día promedio" />
        </section>

        <section className="card">
          <SectionTitle title="Lo que más se vendió" size="sm" />
          {stats.topProducts.length === 0 ? (
            <p className="empty">Todavía no hay ventas hoy.</p>
          ) : (
            <ol className="top-list">
              {stats.topProducts.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <span className="top-name">{p.name}</span>
                  <span className="muted">{qtyLabel(+p.qty.toFixed(2), p.unit)}</span>
                  <strong>{clp(p.total)}</strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="alma-note">
        <AlmaFace mood="wink" size={88} animate={false} alt="" />
        <div>
          <p className="script">Consejo para mañana</p>
          <p>
            {low.length
              ? `Antes de abrir, encarga ${low.map((p) => `${qtyLabel(suggestedOrder(p), p.unit)} de ${p.name}`).join(" y ")}. `
              : "Estás bien surtido para mañana. "}
            Aparta {clp(reserve)} en el sobre y deja sencillo para la caja. Tu hora fuerte es la once: ten pan fresco desde las 18:00.
          </p>
          {low.length > 0 && (
            <Link to="/inventario" className="link-arrow">
              Ir a Inventario <ArrowRight size={16} weight="bold" />
            </Link>
          )}
        </div>
      </section>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Cerramos el día?" kicker="Se guarda el resumen y la caja parte en $0" size="sm">
        <div className="confirm-close">
          <AlmaFace mood="smile" size={96} animate={false} alt="" />
          <p>
            Vas a cerrar con <strong>{clp(stats.total)}</strong> en {stats.count} ventas
            {diff != null ? (diff === 0 ? " y la caja cuadrada." : diff > 0 ? `, con ${clp(diff)} de más en la caja.` : `, con ${clp(-diff)} de menos en la caja.`) : ". No anotaste el arqueo: puedes cerrar igual."}
          </p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-paper" onClick={() => setConfirm(false)}>
            Seguir vendiendo
          </button>
          <button
            className="btn btn-pink"
            onClick={() => {
              actions.closeDay(counted ? countedNum : null);
              setConfirm(false);
              toast("Día cerrado. ¡A descansar!", "happy");
            }}
          >
            Sí, cerrar el día
          </button>
        </div>
      </Modal>
    </div>
  );
}
