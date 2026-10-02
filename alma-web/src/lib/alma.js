// "Cerebro" local de Alma para el prototipo: entiende pedidos dictados y
// responde preguntas del negocio con los datos del día. Sin servidor.
import { clp, greeting, normalize, pct, qtyLabel, timeLabel } from "./format.js";
import { RESERVE_RATE, dayStats, fiadoSummary, lowStock, peakHour, priceSuggestions, suggestedOrder, totalUntil } from "./metrics.js";
import { hourNow } from "../data/seed.js";

const NUMBER_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, medio: 0.5, media: 0.5, cuarto: 0.25,
};

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Índice de alias ordenado del más largo al más corto ("pan hallulla" antes que "pan").
function aliasIndex(products) {
  const list = [];
  for (const p of products) {
    for (const a of [normalize(p.name), ...p.aliases.map(normalize)]) list.push({ alias: a, product: p });
  }
  return list.sort((a, b) => b.alias.length - a.alias.length);
}

function parseQty(words) {
  let qty = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\d+([.,]\d+)?$/.test(w)) qty = (qty || 0) + parseFloat(w.replace(",", "."));
    else if (w === "ymedio") qty = (qty || 1) + 0.5;
    else if (w in NUMBER_WORDS) {
      // "medio kilo" = 0.5; "un kilo" = 1; "un cuarto" = 0.25
      if ((w === "un" || w === "una") && NUMBER_WORDS[words[i + 1]] < 1) continue;
      qty = (qty || 0) + NUMBER_WORDS[w];
    }
  }
  // "300 gramos de hallulla" = 0,3 kg
  if (qty != null && words.some((w) => /^(g|gr|grs|gramo|gramos)$/.test(w))) qty /= 1000;
  return qty ?? 1;
}

export function parseOrder(text, products) {
  const index = aliasIndex(products);
  const clean = normalize(text)
    .replace(/\b(kilos?|kg|\d+|un|uno|una|dos|tres|cuatro|cinco) y (medio|media)\b/g, "$1 ymedio")
    .replace(/\b(anota|anotame|agrega|agregame|vende|vendi|cobra|cobrame|dame|quiero|me llevo|ponme|pasame|por favor|porfa)\b/g, " ");
  const segments = clean.split(/(?<!\d),|,(?!\d)|\by\b|\bmas\b|\+|\bcon\b/).map((s) => s.trim()).filter(Boolean);

  const found = new Map();
  const unknown = [];
  for (const seg of segments) {
    // Todos los productos nombrados en el tramo ("dos cocas tres super 8"), del alias más largo al más corto.
    let rest = ` ${seg} `;
    const hits = [];
    for (const { alias, product } of index) {
      const re = new RegExp(`\\s${escapeRe(alias)}(?=\\s)`, "g");
      let m;
      while ((m = re.exec(rest))) {
        hits.push({ product, start: m.index, end: m.index + m[0].length });
        rest = rest.slice(0, m.index) + " " + "\u0000".repeat(m[0].length - 1) + rest.slice(m.index + m[0].length);
        re.lastIndex = m.index + m[0].length;
      }
    }
    if (!hits.length) {
      if (seg.replace(/\b(de|del|la|el|los|las|kilo|kilos|kg|gramos?|grs?|unidad|unidades)\b/g, "").trim().length > 2) unknown.push(seg);
      continue;
    }
    hits.sort((a, b) => a.start - b.start);
    hits.forEach((h, i) => {
      // La cantidad son las palabras entre el producto anterior y este ("medio kilo de" hallulla).
      const from = i === 0 ? 0 : hits[i - 1].end;
      const words = rest.slice(from, h.start).replace(/\u0000/g, " ").split(" ").filter(Boolean);
      const qty = parseQty(words);
      const prev = found.get(h.product.id);
      found.set(h.product.id, { product: h.product, qty: (prev?.qty || 0) + qty });
    });
  }
  return { items: [...found.values()], unknown };
}

function has(t, ...words) {
  return words.some((w) => t.includes(w));
}

function listJoin(arr) {
  if (arr.length <= 1) return arr.join("");
  return `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;
}

// ctx: { state, lastWeek }
export function buildContext({ state, lastWeek }) {
  const stats = dayStats(state.sales);
  const now = hourNow();
  const lastWeekNow = totalUntil(lastWeek, now);
  const lastWeekStats = dayStats(lastWeek);
  return {
    state,
    stats,
    lastWeekNow,
    lastWeekStats,
    trend: lastWeekNow > 0 ? stats.total / lastWeekNow - 1 : 0,
    low: lowStock(state.products),
    suggestions: priceSuggestions(state.products, state.dismissed.suggestions),
    fiados: fiadoSummary(state.vecinos),
    peak: peakHour(lastWeekStats.hourly),
  };
}

// "De cada $1.000 que vendes, te quedan $340": la ganancia sin tecnicismos.
export function perLuca(marginRate) {
  return `de cada $1.000 que vendes te quedan unos ${clp(Math.round((marginRate * 1000) / 10) * 10)}`;
}

export function salesLine(ctx) {
  const { stats, lastWeekNow, trend } = ctx;
  if (stats.count === 0) return "Todavía no hay ventas hoy. ¡Partamos con todo!";
  const vs = lastWeekNow > 0 ? (trend >= 0 ? `vamos ${pct(trend)} mejor que la semana pasada a esta misma hora` : `vamos un poquito más lento que la semana pasada a esta hora`) : null;
  return `Llevas ${clp(stats.total)} en ${stats.count} ventas${vs ? ` y ${vs}` : ""}.`;
}

export function welcome(ctx, owner) {
  const urgent = ctx.low[0];
  return `${greeting()}, ${owner}. ${salesLine(ctx)} ${urgent ? `Ojo, que se está acabando ${urgent.name}.` : "El stock está al día."} ¿En qué te ayudo?`;
}

export function answer(raw, ctx) {
  const t = normalize(raw);
  const { state, stats, low, suggestions, fiados, peak, lastWeekStats, trend } = ctx;

  // Pedido dictado en la conversación: queda listo en la boleta.
  if (has(t, "anota", "agrega", "vende", "cobra", "vendi")) {
    const order = parseOrder(raw, state.products);
    if (order.items.length) {
      return {
        mood: "wink",
        text: `Listo, te dejé en la boleta ${listJoin(order.items.map((i) => `${qtyLabel(i.qty, i.product.unit)} de ${i.product.name}`))}. Cuando quieras, cobramos.`,
        order: order.items,
        link: { to: "/vender", label: "Ir a cobrar" },
      };
    }
  }

  if (has(t, "hola", "buenas", "buenos dias", "como estas", "que tal")) {
    return { mood: "happy", text: `¡Hola, casero! Aquí estoy, atenta al mostrador. ${salesLine(ctx)}` };
  }
  if (has(t, "gracias", "buena alma", "eres seca", "bacan")) {
    return { mood: "happy", text: "¡De nada, pues! Para eso estamos. Tú atiende tranquilo, que yo llevo las cuentas." };
  }

  if (has(t, "fiad", "me debe", "deben", "deuda", "cuaderno", "libreta")) {
    const named = state.vecinos.find((v) => t.includes(normalize(v.name).replace(/^(don|sra|tia|profe) /, "")));
    if (named) {
      const v = fiados.list.find((x) => x.id === named.id);
      return v
        ? { mood: "smile", text: `${named.name} te debe ${clp(v.balance)}. Lo más antiguo es de hace ${v.days} días.`, link: { to: "/fiados", label: "Abrir cuaderno" } }
        : { mood: "happy", text: `${named.name} está al día, no te debe ni un peso.` };
    }
    if (!fiados.count) return { mood: "happy", text: "El cuaderno está limpiecito: nadie te debe nada." };
    return {
      mood: "smile",
      text: `En el cuaderno tienes ${clp(fiados.total)} por cobrar entre ${fiados.count} vecinos. La cuenta más grande es la de ${fiados.top.name}, con ${clp(fiados.top.balance)}${fiados.oldest.days >= 5 ? `, y la más antigua es de ${fiados.oldest.name}: lleva ${fiados.oldest.days} días. Recuérdale con cariño cuando pase` : ""}.`,
      link: { to: "/fiados", label: "Abrir cuaderno" },
    };
  }

  if (has(t, "encarg", "falta", "acab", "stock", "pedir", "pedido", "reponer", "queda")) {
    if (!low.length) return { mood: "happy", text: "Estamos bien surtidos. Por ahora no hace falta encargar nada." };
    return {
      mood: "surprised",
      text: `Se está acabando ${listJoin(low.map((p) => `${p.name}, quedan ${qtyLabel(p.stock, p.unit)}`))}. Yo encargaría ${listJoin(low.map((p) => `${qtyLabel(suggestedOrder(p), p.unit)} de ${p.name.split(" ").slice(0, 2).join(" ")}`))} al tiro, para no quedar cortos en la once.`,
      link: { to: "/inventario", label: "Ver inventario" },
    };
  }

  if (has(t, "precio", "subir", "margen", "caro", "barato", "ajust")) {
    if (!suggestions.length) return { mood: "smile", text: "Tus precios están bien puestos. No veo nada que te esté haciendo perder plata." };
    const s = suggestions[0];
    return {
      mood: "wink",
      text: `Te soplo uno: ${s.name}, de ${clp(s.current)} a ${clp(s.suggested)}. ${s.reason}${suggestions.length > 1 ? ` Tengo ${suggestions.length - 1} consejo${suggestions.length > 2 ? "s" : ""} más en Inventario.` : ""}`,
      link: { to: "/inventario", label: "Ver consejos" },
    };
  }

  if (has(t, "guard", "arriendo", "proveedor", "sobre", "apart", "ahorr", "cuentas")) {
    const reserve = stats.total * RESERVE_RATE;
    return {
      mood: "wink",
      text: `De lo que llevas hoy, aparta ${clp(reserve)} en el sobre de proveedores y cuentas. Así, cuando llegue el camión, pagas sin sustos.`,
    };
  }

  if (has(t, "a que hora", "horario", "que hora", "gente", "peak", "movid", "lleno", "cuando viene")) {
    return {
      mood: "smile",
      text: `Lo más movido es entre las ${peak.hour} y las ${peak.hour + 1}, cuando los vecinos pasan a comprar para la once. A la hora de almuerzo también se llena, por las bebidas y el pan.`,
    };
  }

  if (has(t, "gan", "limpi", "utilidad", "bolsillo", "rentab")) {
    return {
      mood: stats.profit > 0 ? "happy" : "smile",
      text: `De los ${clp(stats.total)} que entraron hoy, después de pagar lo que te costó la mercadería te quedan unos ${clp(stats.profit)} limpios. O sea, ${perLuca(stats.margin)}.`,
    };
  }

  if (has(t, "caja", "efectivo", "billete", "plata en")) {
    const cash = state.openingCash + stats.byMethod.efectivo;
    return {
      mood: "smile",
      text: `En el cajón debería haber ${clp(cash)}: ${clp(state.openingCash)} de sencillo con que partiste, más ${clp(stats.byMethod.efectivo)} de ventas en efectivo. Lo del débito, ${clp(stats.byMethod.debito)}, te llega a la cuenta.`,
      link: { to: "/cierre", label: "Cuadrar caja" },
    };
  }

  if (has(t, "mas vend", "estrella", "top", "que se vende", "lo que mas")) {
    const top = stats.topProducts.slice(0, 3);
    if (!top.length) return { mood: "smile", text: "Todavía no hay ventas hoy para saber qué es lo que más sale." };
    return { mood: "happy", text: `Hoy lo que más sale es ${listJoin(top.map((p) => p.name))}. Que no falten en la vitrina.` };
  }

  if (has(t, "ticket", "promedio", "cuanto gasta")) {
    return { mood: "smile", text: `Cada cliente está gastando más o menos ${clp(stats.avgTicket)} por compra.` };
  }

  if (has(t, "semana", "pasad", "compar", "venta", "vend", "como va", "como vamos", "llevo")) {
    const mood = stats.count === 0 ? "smile" : trend >= 0 ? "happy" : "sad";
    return {
      mood,
      text: `${salesLine(ctx)} El mismo día de la semana pasada cerraste con ${clp(lastWeekStats.total)}.${trend < 0 && stats.count ? " Tranquilo, que la once todavía puede dar vuelta el día." : ""}`,
    };
  }

  if (has(t, "ultima venta", "ultima boleta")) {
    const last = state.sales[0];
    return last ? { mood: "smile", text: `La última venta fue a las ${timeLabel(last.ts)}, por ${clp(last.total)}.` } : { mood: "smile", text: "Todavía no hay ventas hoy." };
  }

  return {
    mood: "smile",
    text: `${salesLine(ctx)} Pregúntame qué falta encargar, qué precio conviene ajustar, cuánto te deben en el cuaderno o cuánto ganaste limpio. También puedes dictarme una venta, por ejemplo: anota dos cocas y un kilo de pan.`,
  };
}

export const SUGGESTED_QUESTIONS = [
  "¿Cómo van las ventas?",
  "¿Qué tengo que encargar?",
  "¿Qué precio me conviene subir?",
  "¿Cuánto me deben en el cuaderno?",
  "¿Cuánto gané limpio hoy?",
  "¿Cuánta plata guardo para proveedores?",
];
