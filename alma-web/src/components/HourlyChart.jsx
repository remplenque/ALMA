import { clp } from "../lib/format.js";

// Barras por hora: hoy (tinta) contra el mismo día de la semana pasada (contorno).
export default function HourlyChart({ today, lastWeek, currentHour, compareLabel = "Mismo día, semana pasada" }) {
  const max = Math.max(1, ...today.map((h) => h.total), ...(lastWeek || []).map((h) => h.total));
  return (
    <div className="hourly">
      <div className="hourly-bars" role="img" aria-label="Ventas por hora de hoy comparadas con la semana pasada">
        {today.map((h, i) => {
          const lw = lastWeek?.[i]?.total || 0;
          const isNow = h.hour === currentHour;
          const future = currentHour != null && h.hour > currentHour;
          return (
            <div className={`hourly-col ${isNow ? "is-now" : ""} ${future ? "is-future" : ""}`} key={h.hour}>
              <div className="hourly-track">
                {lastWeek && <span className="bar-ghost" style={{ height: `${(lw / max) * 100}%` }} />}
                <span className="bar" style={{ height: `${(h.total / max) * 100}%` }}>
                  <span className="bar-tip">
                    {clp(h.total)}
                    {lastWeek ? ` · ${compareLabel.toLowerCase()}: ${clp(lw)}` : ""}
                  </span>
                </span>
              </div>
              <span className="hourly-label">{h.hour}</span>
            </div>
          );
        })}
      </div>
      {lastWeek && (
        <div className="legend">
          <span>
            <i className="lg-today" /> Hoy
          </span>
          <span>
            <i className="lg-ghost" /> {compareLabel}
          </span>
        </div>
      )}
    </div>
  );
}
