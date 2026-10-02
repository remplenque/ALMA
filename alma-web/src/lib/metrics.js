import { clp, pct } from "./format.js";

export const OPEN_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

// Parte de lo vendido que conviene apartar para proveedores y cuentas.
export const RESERVE_RATE = 0.35;

export function dayStats(sales) {
  const byMethod = { efectivo: 0, debito: 0, fiado: 0 };
  const hourly = Object.fromEntries(OPEN_HOURS.map((h) => [h, { hour: h, total: 0, count: 0 }]));
  const products = new Map();
  let total = 0;
  let cost = 0;

  for (const s of sales) {
    total += s.total;
    byMethod[s.method] = (byMethod[s.method] || 0) + s.total;
    const h = new Date(s.ts).getHours();
    if (hourly[h]) {
      hourly[h].total += s.total;
      hourly[h].count += 1;
    }
    for (const it of s.items) {
      cost += it.cost * it.qty;
      const prev = products.get(it.id) || { id: it.id, name: it.name, unit: it.unit, qty: 0, total: 0 };
      prev.qty += it.qty;
      prev.total += it.price * it.qty;
      products.set(it.id, prev);
    }
  }

  const count = sales.length;
  const profit = total - cost;
  return {
    total,
    count,
    cost,
    profit,
    margin: total > 0 ? profit / total : 0,
    avgTicket: count > 0 ? total / count : 0,
    byMethod,
    hourly: Object.values(hourly),
    topProducts: [...products.values()].sort((a, b) => b.total - a.total),
  };
}

export function totalUntil(sales, hourDec) {
  return sales.reduce((s, sale) => {
    const d = new Date(sale.ts);
    return d.getHours() + d.getMinutes() / 60 <= hourDec ? s + sale.total : s;
  }, 0);
}

export function peakHour(hourly) {
  return hourly.reduce((best, h) => (h.total > best.total ? h : best), hourly[0]);
}

export function lowStock(products) {
  return products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock / a.minStock - b.stock / b.minStock);
}

export function margin(p) {
  return p.price > 0 ? (p.price - p.cost) / p.price : 0;
}

// Cantidad sugerida para encargar: cubrir ~3 días de venta normal.
export function suggestedOrder(p) {
  const perDay = { "muy alta": 8, alta: 5, media: 3, baja: 1.5 }[p.speed] || 3;
  const target = Math.ceil(perDay * 3 + p.minStock);
  return Math.max(p.unit === "kg" ? 5 : 6, target - p.stock);
}

function roundPrice(n) {
  return Math.round(n / 50) * 50;
}

// Consejos de precio en lenguaje de mostrador, calculados con costo y rotación.
export function priceSuggestions(products, dismissed = []) {
  const out = [];
  for (const p of products) {
    if (dismissed.includes(p.id)) continue;
    const m = margin(p);
    if (p.speed === "muy alta" && p.category === "Abarrotes") {
      const suggested = Math.ceil((p.price * 1.07) / 100) * 100 - 10;
      out.push({
        id: p.id,
        kind: "subir",
        tag: "Se está vendiendo harto",
        name: p.name,
        current: p.price,
        suggested,
        reason: `Se está vendiendo como pan caliente y sigue más barato que en el súper. Con ${clp(suggested)} sigue conveniente y ganas más por cada uno.`,
        gain: `+${clp(suggested - p.price)} por unidad`,
      });
      continue;
    }
    if (m < 0.28) {
      const suggested = roundPrice(p.cost / (1 - 0.33));
      if (suggested > p.price) {
        out.push({
          id: p.id,
          kind: "subir",
          tag: "Te está comiendo el margen",
          name: p.name,
          current: p.price,
          suggested,
          reason: `Te cuesta ${clp(p.cost)} y lo vendes a ${clp(p.price)}: ganas apenas ${pct(m)} por unidad. Con ${clp(suggested)} sigues barato para el barrio.`,
          gain: `+${clp(suggested - p.price)} por unidad`,
        });
        continue;
      }
    }
    if (p.speed === "muy alta" && p.category === "Panadería" && m < 0.36 && p.stock <= p.minStock * 1.5) {
      const suggested = roundPrice(p.price * 1.06);
      out.push({
        id: p.id,
        kind: "subir",
        tag: "Se vende solo",
        name: p.name,
        current: p.price,
        suggested,
        reason: "La harina subió y igual se te acaba antes de la once. Un pequeño ajuste no espanta a nadie.",
        gain: `+${clp(suggested - p.price)} por kilo`,
      });
      continue;
    }
    if (p.speed === "baja" && p.stock >= 10 && p.category === "Lácteos") {
      const suggested = roundPrice(p.price * 0.88);
      out.push({
        id: p.id,
        kind: "bajar",
        tag: "Se está quedando",
        name: p.name,
        current: p.price,
        suggested,
        reason: `Tienes ${p.stock} y sale poco. Bájalo un poco antes de que se venza: mejor plata en la caja que merma en la vitrina.`,
        gain: "Evitas pérdida",
      });
    }
  }
  return out.slice(0, 4);
}

// Promedio de varios días completos (para comparar el cierre con un día normal).
export function averageDay(days) {
  const all = days.map(dayStats);
  const n = all.length || 1;
  const avg = (f) => all.reduce((s, d) => s + f(d), 0) / n;
  return {
    total: avg((d) => d.total),
    count: avg((d) => d.count),
    profit: avg((d) => d.profit),
    margin: avg((d) => d.margin),
    avgTicket: avg((d) => d.avgTicket),
    hourly: OPEN_HOURS.map((h, i) => ({ hour: h, total: avg((d) => d.hourly[i].total), count: avg((d) => d.hourly[i].count) })),
  };
}

export function vecinoBalance(v) {
  return v.movements.reduce((s, m) => s + (m.type === "fiado" ? m.amount : -m.amount), 0);
}

export function lastMovement(v) {
  return v.movements.reduce((last, m) => (m.ts > last ? m.ts : last), 0);
}

// Días desde el fiado más antiguo que sigue sin pagar (FIFO).
export function oldestDebtDays(v, now = Date.now()) {
  let paid = v.movements.filter((m) => m.type === "abono").reduce((s, m) => s + m.amount, 0);
  const fiados = v.movements.filter((m) => m.type === "fiado").sort((a, b) => a.ts - b.ts);
  for (const f of fiados) {
    if (paid >= f.amount) {
      paid -= f.amount;
      continue;
    }
    return Math.floor((now - f.ts) / 86400000);
  }
  return 0;
}

export function fiadoSummary(vecinos) {
  const withDebt = vecinos
    .map((v) => ({ ...v, balance: vecinoBalance(v), days: oldestDebtDays(v) }))
    .filter((v) => v.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  return {
    total: withDebt.reduce((s, v) => s + v.balance, 0),
    count: withDebt.length,
    top: withDebt[0] || null,
    oldest: [...withDebt].sort((a, b) => b.days - a.days)[0] || null,
    list: withDebt,
  };
}
