export function clp(n) {
  return `$${Math.round(n || 0).toLocaleString("es-CL")}`;
}

export function qtyLabel(qty, unit) {
  const n = Number.isInteger(qty) ? qty : qty.toLocaleString("es-CL", { maximumFractionDigits: 3 });
  return unit === "kg" ? `${n} kg` : `${n} u`;
}

export function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Peso escrito como en la pesa: "0,735", "735 g", "1,2 kg". Devuelve kilos (NaN si no se entiende).
export function parseKg(text) {
  const t = String(text).toLowerCase().replace(/\s+/g, "").replace(",", ".");
  const m = t.match(/^(\d+(?:\.\d+)?|\.\d+)(kg|kilos?|g|gr|grs|gramos?)?$/);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return m[2]?.startsWith("g") ? n / 1000 : n;
}

// Kilos para mostrar en un campo editable: "0,735".
export function kgInput(n) {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 3, useGrouping: false });
}

export function pct(n, digits = 0) {
  return `${(n * 100).toFixed(digits).replace(".", ",")}%`;
}

export function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// "2× Fideos" o "1,5 kg Pan": como se anota en una boleta.
export function itemLabel(it) {
  const n = Number.isInteger(it.qty) ? it.qty : it.qty.toLocaleString("es-CL", { maximumFractionDigits: 3 });
  return it.unit === "kg" ? `${n} kg ${it.name}` : `${n}× ${it.name}`;
}

export function relativeDay(ts, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((start.getTime() - ts) / 86400000) + 1;
  if (ts >= start.getTime()) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff} días`;
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function normalize(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!]/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
