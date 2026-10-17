// Agente de chat de Alma: Claude Haiku 5.5 (vía /api/chat → OpenRouter) con acceso a toda la
// base de datos del almacén mediante herramientas que se ejecutan acá, en el navegador, sobre
// el mismo estado que usan las pantallas (productos, ventas, fiados, caja, cierres).
// Si el chat no está configurado o falla, Inicio cae al cerebro local de alma.js.
import { clp, itemLabel, normalize, pct, round3, timeLabel } from "./format.js";
import { RESERVE_RATE, dayStats, fiadoSummary, lowStock, margin, oldestDebtDays, peakHour, priceSuggestions, suggestedOrder, totalUntil, vecinoBalance } from "./metrics.js";
import { STORE, hourNow } from "../data/seed.js";

const MAX_STEPS = 6;
// Tope de lo que se reenvía de turnos anteriores (el servidor rechaza conversaciones enormes).
const MAX_PAST_MESSAGES = 30;
const MAX_PAST_CHARS = 60000;
const TIMEOUT_MS = 30000;
const MOODS = new Set(["happy", "smile", "wink", "surprised", "sad", "neutral"]);

const SCREENS = {
  inicio: { to: "/", label: "Volver al inicio" },
  vender: { to: "/vender", label: "Ir a cobrar" },
  inventario: { to: "/inventario", label: "Ver inventario" },
  consejos: { to: "/inventario#consejos", label: "Ver consejos" },
  fiados: { to: "/fiados", label: "Abrir cuaderno" },
  hoy: { to: "/hoy", label: "Ver resumen" },
  cierre: { to: "/cierre", label: "Cuadrar caja" },
};

export class ChatUnavailable extends Error {}

/* ---------- definición de herramientas (formato OpenAI/OpenRouter) ---------- */

const fn = (name, description, properties = {}, required = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});
const str = (description) => ({ type: "string", description });
const num = (description) => ({ type: "number", description });

export const TOOLS = [
  fn(
    "consultar_inventario",
    "Lista los productos del inventario con precio, costo, ganancia por unidad, stock, stock mínimo, unidad (u o kg) y rotación. Úsala para stock, precios, qué falta encargar o cuánta mercadería queda.",
    { buscar: str("Texto para filtrar por nombre, alias o categoría (opcional)"), solo_bajo_stock: { type: "boolean", description: "true para ver solo lo que se está acabando" } }
  ),
  fn(
    "resumen_del_dia",
    "Números del día en curso: total vendido, cantidad de ventas, ganancia limpia, ticket promedio, ventas por medio de pago, ventas por hora, productos más vendidos, plata esperada en caja y comparación con el mismo día de la semana pasada y con un día promedio.",
  ),
  fn(
    "consultar_ventas",
    "Lista las boletas del día (hora, total, medio de pago, productos y vecino si fue fiado). La más reciente primero.",
    {
      producto: str("Solo boletas que incluyan este producto (opcional)"),
      metodo: { type: "string", enum: ["efectivo", "debito", "fiado"], description: "Filtrar por medio de pago (opcional)" },
      desde_hora: num("Solo desde esta hora del día, 0 a 23 (opcional)"),
      limite: num("Máximo de boletas, por defecto 15"),
    }
  ),
  fn(
    "consultar_fiados",
    "Cuaderno de fiados: cada vecino con su saldo, días de su deuda más antigua, teléfono, nota y últimos movimientos. Sin parámetros devuelve a todos los vecinos y el total por cobrar.",
    { vecino: str("Nombre del vecino (opcional)") }
  ),
  fn("consultar_boleta", "Muestra lo que está anotado ahora en la boleta (el carrito) sin cobrar."),
  fn("historial_cierres", "Resúmenes de los días que ya se cerraron: total, ganancia, medios de pago y cuadre de caja."),
  fn("consejos_de_precios", "Precios que conviene subir o bajar según costo y rotación, y cuánto encargar de lo que se está acabando."),
  fn(
    "agregar_a_boleta",
    "Anota productos en la boleta actual (no cobra). Respeta el stock disponible.",
    {
      productos: {
        type: "array",
        description: "Productos a anotar",
        items: { type: "object", properties: { producto: str("Nombre o alias del producto"), cantidad: num("Unidades, o kilos si el producto es a granel (0,5 = medio kilo)") }, required: ["producto", "cantidad"] },
      },
    },
    ["productos"]
  ),
  fn("reponer_stock", "Suma unidades (o kilos) al stock de un producto cuando llega mercadería.", { producto: str("Nombre o alias"), cantidad: num("Cantidad que llegó") }, ["producto", "cantidad"]),
  fn("cambiar_precio", "Cambia el precio de venta de un producto.", { producto: str("Nombre o alias"), precio: num("Nuevo precio en pesos chilenos") }, ["producto", "precio"]),
  fn("anotar_fiado", "Anota una deuda nueva en el cuaderno de un vecino.", { vecino: str("Nombre del vecino"), monto: num("Monto en pesos"), detalle: str("Qué se llevó (opcional)") }, ["vecino", "monto"]),
  fn("registrar_abono", "Registra un abono o pago de un vecino en el cuaderno. Para saldar todo usa su saldo completo.", { vecino: str("Nombre del vecino"), monto: num("Monto en pesos") }, ["vecino", "monto"]),
  fn(
    "abrir_pantalla",
    "Deja un botón en la respuesta para ir a una pantalla de la app (por ejemplo para cobrar la boleta o cerrar la caja).",
    { pantalla: { type: "string", enum: Object.keys(SCREENS) } },
    ["pantalla"]
  ),
];

/* ---------- ejecución de herramientas sobre la base de datos ---------- */

function findProduct(query, products) {
  const q = normalize(String(query || ""));
  if (!q) return { error: "Falta indicar el producto" };
  const byId = products.find((p) => p.id === query);
  if (byId) return { product: byId };
  const names = (p) => [normalize(p.name), ...p.aliases.map(normalize)];
  let hits = products.filter((p) => names(p).includes(q));
  if (!hits.length) hits = products.filter((p) => names(p).some((n) => (q.length >= 3 && n.includes(q)) || ` ${q} `.includes(` ${n} `)));
  if (hits.length === 1) return { product: hits[0] };
  if (!hits.length) return { error: `No encontré "${query}" en el inventario` };
  return { error: `"${query}" puede ser varios productos, hay que precisar`, opciones: hits.map((p) => p.name) };
}

function findVecino(query, vecinos) {
  const strip = (s) => normalize(s).replace(/^(don|dona|sra|sr|tia|tio|profe) /, "");
  const q = strip(String(query || ""));
  if (!q) return { error: "Falta indicar el vecino" };
  const hits = vecinos.filter((v) => strip(v.name).includes(q) || q.includes(strip(v.name)));
  if (hits.length === 1) return { vecino: hits[0] };
  if (!hits.length) return { error: `No hay un vecino "${query}" en el cuaderno`, vecinos: vecinos.map((v) => v.name) };
  return { error: `"${query}" puede ser varios vecinos`, opciones: hits.map((v) => v.name) };
}

const vecinoView = (v, withMovements = true) => ({
  nombre: v.name,
  nota: v.note || undefined,
  telefono: v.phone || undefined,
  saldo: vecinoBalance(v),
  dias_deuda_mas_antigua: oldestDebtDays(v),
  ...(withMovements
    ? { ultimos_movimientos: [...v.movements].sort((a, b) => b.ts - a.ts).slice(0, 8).map((m) => ({ fecha: new Date(m.ts).toLocaleDateString("es-CL"), tipo: m.type, monto: m.amount, detalle: m.note })) }
    : {}),
});

const productView = (p) => ({
  nombre: p.name,
  categoria: p.category,
  precio: p.price,
  costo: p.cost,
  ganancia_por_unidad: p.price - p.cost,
  margen: pct(margin(p)),
  stock: p.stock,
  stock_minimo: p.minStock,
  unidad: p.unit === "kg" ? "kg (a granel)" : "unidades",
  rotacion: p.speed,
  bajo_stock: p.stock <= p.minStock,
});

const saleView = (s, vecinos) => ({
  hora: timeLabel(s.ts),
  total: s.total,
  medio_de_pago: s.method,
  vecino: s.vecinoId ? vecinos.find((v) => v.id === s.vecinoId)?.name : undefined,
  productos: s.items.map(itemLabel),
});

// ctx: { getState, actions, lastWeek, avgDay }
function runTool(name, args, ctx, out) {
  const state = ctx.getState();
  const { actions } = ctx;

  switch (name) {
    case "consultar_inventario": {
      const q = normalize(args.buscar || "");
      let list = state.products;
      if (q) list = list.filter((p) => normalize(`${p.name} ${p.category} ${p.aliases.join(" ")}`).includes(q));
      if (args.solo_bajo_stock) list = lowStock(list);
      return { total_productos: state.products.length, productos: list.map(productView) };
    }

    case "resumen_del_dia": {
      const s = dayStats(state.sales);
      const lw = dayStats(ctx.lastWeek);
      const lwNow = totalUntil(ctx.lastWeek, hourNow());
      return {
        fecha: state.dateKey,
        caja_abierta: state.dayOpen,
        vendido_hoy: s.total,
        ventas: s.count,
        ganancia_limpia: s.profit,
        ganancia_por_cada_1000: Math.round((s.margin * 1000) / 10) * 10,
        ticket_promedio: Math.round(s.avgTicket),
        por_medio_de_pago: s.byMethod,
        efectivo_inicial_en_caja: state.openingCash,
        efectivo_esperado_en_caja: state.openingCash + s.byMethod.efectivo,
        reserva_sugerida_para_proveedores: Math.round(s.total * RESERVE_RATE),
        mas_vendidos: s.topProducts.slice(0, 5).map((p) => ({ producto: p.name, cantidad: round3(p.qty), total: Math.round(p.total) })),
        ventas_por_hora: s.hourly.filter((h) => h.count).map((h) => ({ hora: h.hour, total: h.total, ventas: h.count })),
        semana_pasada_a_esta_hora: lwNow,
        semana_pasada_dia_completo: lw.total,
        hora_mas_movida_semana_pasada: peakHour(lw.hourly).hour,
        dia_promedio: { vendido: Math.round(ctx.avgDay.total), ventas: Math.round(ctx.avgDay.count), ganancia: Math.round(ctx.avgDay.profit) },
      };
    }

    case "consultar_ventas": {
      let list = state.sales;
      if (args.producto) {
        const f = findProduct(args.producto, state.products);
        if (f.error) return f;
        list = list.filter((s) => s.items.some((it) => it.id === f.product.id));
      }
      if (args.metodo) list = list.filter((s) => s.method === args.metodo);
      if (Number.isFinite(args.desde_hora)) list = list.filter((s) => new Date(s.ts).getHours() >= args.desde_hora);
      const limit = Math.min(Math.max(Math.round(args.limite) || 15, 1), 40);
      return { coinciden: list.length, mostrando: Math.min(limit, list.length), boletas: list.slice(0, limit).map((s) => saleView(s, state.vecinos)) };
    }

    case "consultar_fiados": {
      if (args.vecino) {
        const f = findVecino(args.vecino, state.vecinos);
        return f.error ? f : vecinoView(f.vecino);
      }
      const sum = fiadoSummary(state.vecinos);
      return {
        total_por_cobrar: sum.total,
        vecinos_con_deuda: sum.count,
        vecinos: state.vecinos.map((v) => vecinoView(v, false)),
      };
    }

    case "consultar_boleta": {
      const items = state.cart.map((c) => {
        const p = state.products.find((x) => x.id === c.id);
        return { producto: p?.name, cantidad: c.qty, subtotal: Math.round((p?.price || 0) * c.qty) };
      });
      return { items, total: items.reduce((s, i) => s + i.subtotal, 0) };
    }

    case "historial_cierres":
      return {
        cierres: state.history.slice(0, 10).map((h) => ({
          fecha: h.dateKey,
          vendido: h.total,
          ganancia: h.profit,
          ventas: h.count,
          por_medio_de_pago: h.byMethod,
          efectivo_esperado: h.expectedCash,
          efectivo_contado: h.counted,
        })),
      };

    case "consejos_de_precios":
      return {
        precios: priceSuggestions(state.products, state.dismissed.suggestions).map((s) => ({ producto: s.name, accion: s.kind, precio_actual: s.current, precio_sugerido: s.suggested, motivo: s.reason })),
        encargar: lowStock(state.products).map((p) => ({ producto: p.name, stock: p.stock, unidad: p.unit, cantidad_sugerida: suggestedOrder(p) })),
      };

    case "agregar_a_boleta": {
      const lines = Array.isArray(args.productos) ? args.productos : [];
      if (!lines.length) return { error: "No indicaste productos" };
      const resultado = lines.map((l) => {
        const f = findProduct(l.producto, state.products);
        if (f.error) return f;
        const qty = Number(l.cantidad);
        if (!(qty > 0)) return { producto: f.product.name, error: "Cantidad inválida" };
        const added = actions.addToCart(f.product.id, qty);
        return { producto: f.product.name, pedido: qty, anotado: added, ...(added < qty ? { aviso: `Solo quedaba ${f.product.stock} en stock disponible` } : {}) };
      });
      return { resultado, nota: "Quedó en la boleta; el cobro se hace en la pantalla de venta." };
    }

    case "reponer_stock": {
      const f = findProduct(args.producto, state.products);
      if (f.error) return f;
      const qty = Number(args.cantidad);
      if (!(qty > 0)) return { error: "Cantidad inválida" };
      actions.restock(f.product.id, qty);
      return { producto: f.product.name, sumado: qty, stock_nuevo: round3(f.product.stock + qty) };
    }

    case "cambiar_precio": {
      const f = findProduct(args.producto, state.products);
      if (f.error) return f;
      const price = Math.round(Number(args.precio));
      if (!(price > 0)) return { error: "Precio inválido" };
      actions.updateProduct(f.product.id, { price });
      return { producto: f.product.name, precio_anterior: f.product.price, precio_nuevo: price, ganancia_por_unidad: price - f.product.cost };
    }

    case "anotar_fiado":
    case "registrar_abono": {
      const f = findVecino(args.vecino, state.vecinos);
      if (f.error) return f;
      const amount = Math.round(Number(args.monto));
      if (!(amount > 0)) return { error: "Monto inválido" };
      const before = vecinoBalance(f.vecino);
      if (name === "anotar_fiado") actions.fiar(f.vecino.id, amount, args.detalle || "");
      else actions.abonar(f.vecino.id, amount, "Abono");
      return { vecino: f.vecino.name, saldo_anterior: before, saldo_nuevo: before + (name === "anotar_fiado" ? amount : -amount) };
    }

    case "abrir_pantalla": {
      const screen = SCREENS[args.pantalla];
      if (!screen) return { error: "Pantalla desconocida", pantallas: Object.keys(SCREENS) };
      out.link = screen;
      return { ok: true, nota: "Se muestra un botón en tu respuesta; la pantalla no se abre sola, el dueño decide si lo toca." };
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

/* ---------- contexto breve que acompaña cada consulta ---------- */

function buildContext(ctx) {
  const state = ctx.getState();
  const s = dayStats(state.sales);
  const low = lowStock(state.products);
  const debt = fiadoSummary(state.vecinos);
  const now = new Date();
  return [
    `Almacén: ${STORE.name} (${STORE.place}). Dueño: ${STORE.owner}.`,
    `Ahora: ${now.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}, ${timeLabel(now.getTime())}. Horario ${STORE.openHour | 0}:30 a ${STORE.closeHour | 0}:30.`,
    `Caja del día: ${state.dayOpen ? "abierta" : "cerrada"}.`,
    `Hoy: ${clp(s.total)} en ${s.count} ventas, ganancia limpia ${clp(s.profit)}.`,
    low.length ? `Se está acabando: ${low.map((p) => p.name).join(", ")}.` : "Stock al día.",
    `Fiados por cobrar: ${clp(debt.total)} entre ${debt.count} vecinos.`,
    `Boleta abierta: ${state.cart.length} productos.`,
    "Para el detalle usa las herramientas.",
  ].join("\n");
}

/* ---------- llamada al modelo ---------- */

async function callChat(messages, context) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, tools: TOOLS, context }),
      signal: ctrl.signal,
    });
    if (res.status === 501) throw new ChatUnavailable("Chat no configurado");
    if (!res.ok) throw new Error(`/api/chat respondió ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Error del modelo");
    const choice = data.choices?.[0];
    if (!choice?.message) throw new Error("Respuesta vacía del modelo");
    if (choice.finish_reason && choice.finish_reason !== "stop" && choice.finish_reason !== "tool_calls") {
      console.warn("Alma: el modelo terminó con", choice.finish_reason);
    }
    return choice.message;
  } finally {
    clearTimeout(timer);
  }
}

function parseReply(content) {
  let text = String(content || "").trim();
  let mood = "smile";
  const m = text.match(/^\[(\w+)\]\s*/);
  if (m) {
    if (MOODS.has(m[1].toLowerCase())) mood = m[1].toLowerCase();
    text = text.slice(m[0].length);
  }
  return { text: text.replace(/[*_#`]/g, "").trim(), mood };
}

// Los turnos más recientes que caben en el tope, siempre completos (nunca se separa una
// llamada a herramienta de su resultado).
function recentTurns(turns) {
  const kept = [];
  let count = 0;
  let chars = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const size = JSON.stringify(turns[i]).length;
    if (kept.length && (count + turns[i].length > MAX_PAST_MESSAGES || chars + size > MAX_PAST_CHARS)) break;
    kept.unshift(turns[i]);
    count += turns[i].length;
    chars += size;
  }
  return kept;
}

// turns: turnos anteriores, cada uno es la lista de mensajes que generó (pregunta, herramientas y
// respuesta), para que Alma recuerde de dónde salió cada cifra que dijo.
// Devuelve { text, mood, link, acted, turn } o lanza error si no se pudo conversar.
export async function askAlma(question, turns, ctx) {
  const past = recentTurns(turns).flat();
  const messages = [...past, { role: "user", content: question }];
  const context = buildContext(ctx);
  const out = { link: null, acted: false };

  for (let step = 0; step < MAX_STEPS; step++) {
    const msg = await callChat(messages, context);
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      const { text, mood } = parseReply(msg.content);
      if (!text) throw new Error("Respuesta vacía del modelo");
      messages.push({ role: "assistant", content: msg.content });
      return { text, mood, link: out.link, acted: out.acted, turn: messages.slice(past.length) };
    }
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const call of calls) {
      let result;
      try {
        const args = JSON.parse(call.function.arguments || "{}");
        result = runTool(call.function.name, args, ctx, out);
        if (/^(agregar_a_boleta|reponer_stock|cambiar_precio|anotar_fiado|registrar_abono)$/.test(call.function.name)) out.acted = true;
      } catch (e) {
        result = { error: String(e.message || e) };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error("El agente no terminó de responder");
}
