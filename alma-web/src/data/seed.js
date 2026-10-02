// Datos de demostración para el prototipo: un almacén de barrio en Santiago.

export const STORE = {
  name: "Almacén Don Mario",
  owner: "Mario",
  place: "Santiago Centro",
  openHour: 8.5,
  closeHour: 21.5,
};

export const CATEGORIES = [
  { id: "Panadería", icon: "bread" },
  { id: "Bebidas", icon: "soda" },
  { id: "Lácteos", icon: "milk" },
  { id: "Abarrotes", icon: "cans" },
  { id: "Snacks", icon: "chips" },
  { id: "Verdulería", icon: "apple" },
  { id: "Aseo", icon: "soap" },
];

// speed: rotación habitual. minStock: bajo esto Alma avisa.
export const PRODUCTS = [
  { id: "p1", name: "Coca-Cola 350 ml", category: "Bebidas", price: 950, cost: 620, stock: 22, minStock: 8, unit: "u", speed: "alta", icon: "cola", aliases: ["coca cola", "cocacola", "coca", "cocas"] },
  { id: "p2", name: "Pan Hallulla", category: "Panadería", price: 2200, cost: 1450, stock: 3, minStock: 5, unit: "kg", speed: "muy alta", aliases: ["hallulla", "hallullas", "ayuya", "ayuyas"] },
  { id: "p3", name: "Pan Marraqueta", category: "Panadería", price: 2250, cost: 1480, stock: 18, minStock: 5, unit: "kg", speed: "muy alta", aliases: ["marraqueta", "marraquetas", "pan batido", "pan"] },
  { id: "p4", name: "Leche Entera 1 L", category: "Lácteos", price: 1250, cost: 890, stock: 15, minStock: 6, unit: "u", speed: "media", aliases: ["leche", "leches"] },
  { id: "p5", name: "Huevos de campo x12", category: "Abarrotes", price: 3800, cost: 2700, stock: 14, minStock: 4, unit: "u", speed: "alta", aliases: ["huevos", "huevo", "docena de huevos", "docena"] },
  { id: "p6", name: "Aceite Maravilla 900 ml", category: "Abarrotes", price: 2590, cost: 1950, stock: 12, minStock: 4, unit: "u", speed: "media", aliases: ["aceite", "aceites"] },
  { id: "p7", name: "Papas Fritas 150 g", category: "Snacks", price: 1600, cost: 1050, stock: 16, minStock: 5, unit: "u", speed: "alta", icon: "snack", aliases: ["papas fritas", "papitas", "papas"] },
  { id: "p8", name: "Ramitas Queso 150 g", category: "Snacks", price: 1400, cost: 900, stock: 14, minStock: 5, unit: "u", speed: "alta", aliases: ["ramitas", "ramita"] },
  { id: "p9", name: "Agua Mineral 500 ml", category: "Bebidas", price: 700, cost: 380, stock: 24, minStock: 8, unit: "u", speed: "media", icon: "bottle", aliases: ["agua", "aguas", "agua mineral"] },
  { id: "p10", name: "Cerveza Lager 350 ml", category: "Bebidas", price: 1100, cost: 720, stock: 26, minStock: 10, unit: "u", speed: "alta", icon: "cola", aliases: ["cerveza", "cervezas", "chela", "chelas", "lata de cerveza"] },
  { id: "p11", name: "Detergente 1 kg", category: "Aseo", price: 3400, cost: 2350, stock: 10, minStock: 3, unit: "u", speed: "baja", aliases: ["detergente", "omo"] },
  { id: "p12", name: "Lavalozas 500 ml", category: "Aseo", price: 1800, cost: 1150, stock: 15, minStock: 4, unit: "u", speed: "media", aliases: ["lavalozas", "quix"] },
  { id: "p13", name: "Arroz Banquete 1 kg", category: "Abarrotes", price: 1850, cost: 1250, stock: 18, minStock: 5, unit: "u", speed: "muy alta", aliases: ["arroz banquete", "banquete", "arroz"] },
  { id: "p14", name: "Fideos Spaghetti 400 g", category: "Abarrotes", price: 1050, cost: 680, stock: 25, minStock: 6, unit: "u", speed: "media", aliases: ["fideos", "fideo", "tallarines", "spaghetti"] },
  { id: "p15", name: "Salsa de Tomate 200 g", category: "Abarrotes", price: 650, cost: 390, stock: 20, minStock: 6, unit: "u", speed: "alta", aliases: ["salsa de tomate", "salsa", "salsas"] },
  { id: "p16", name: "Azúcar 1 kg", category: "Abarrotes", price: 1450, cost: 980, stock: 16, minStock: 4, unit: "u", speed: "media", aliases: ["azucar"] },
  { id: "p17", name: "Té x20 bolsitas", category: "Abarrotes", price: 990, cost: 610, stock: 18, minStock: 5, unit: "u", speed: "media", icon: "coffee-cup", aliases: ["te", "tecito", "bolsitas de te"] },
  { id: "p18", name: "Café Instantáneo 100 g", category: "Abarrotes", price: 3200, cost: 2200, stock: 11, minStock: 3, unit: "u", speed: "baja", icon: "coffee-cup", aliases: ["cafe", "nescafe"] },
  { id: "p19", name: "Yogurt Batido 1 L", category: "Lácteos", price: 1750, cost: 1180, stock: 14, minStock: 4, unit: "u", speed: "baja", aliases: ["yogurt", "yogur", "yogures", "yogurts"] },
  { id: "p20", name: "Queso Gouda Laminado 250 g", category: "Lácteos", price: 2600, cost: 1750, stock: 12, minStock: 4, unit: "u", speed: "alta", aliases: ["queso", "quesito", "gauda", "gouda"] },
  { id: "p21", name: "Mantequilla 250 g", category: "Lácteos", price: 2300, cost: 1720, stock: 8, minStock: 3, unit: "u", speed: "media", aliases: ["mantequilla", "mantequillas"] },
  { id: "p22", name: "Galletas Morocha", category: "Snacks", price: 850, cost: 510, stock: 19, minStock: 6, unit: "u", speed: "alta", icon: "snack", aliases: ["galletas morocha", "morocha", "morochas", "galletas", "galleta"] },
  { id: "p23", name: "Chocolate Super 8", category: "Snacks", price: 400, cost: 210, stock: 35, minStock: 10, unit: "u", speed: "muy alta", icon: "snack", aliases: ["super 8", "super ocho", "superocho", "chocolate"] },
  { id: "p24", name: "Bebida 1,5 L", category: "Bebidas", price: 1700, cost: 1150, stock: 15, minStock: 5, unit: "u", speed: "alta", icon: "bottle", aliases: ["bebida", "bebidas", "bebida grande"] },
  { id: "p25", name: "Palta Hass", category: "Verdulería", price: 4990, cost: 3600, stock: 6, minStock: 3, unit: "kg", speed: "alta", aliases: ["palta", "paltas"] },
  { id: "p26", name: "Tomate", category: "Verdulería", price: 1490, cost: 950, stock: 9, minStock: 3, unit: "kg", speed: "media", aliases: ["tomate", "tomates"] },
  { id: "p27", name: "Plátano", category: "Verdulería", price: 1290, cost: 850, stock: 11, minStock: 3, unit: "kg", speed: "media", aliases: ["platano", "platanos"] },
];

const DAY = 86400000;

export function seedVecinos(now = Date.now()) {
  return [
    {
      id: "v1",
      name: "Don Carlos",
      note: "Vecino del taller",
      phone: "56912345678",
      movements: [
        { id: "m1", ts: now - 8 * DAY, type: "fiado", amount: 6000, note: "Pan y bebida" },
        { id: "m2", ts: now - 3 * DAY, type: "fiado", amount: 8500, note: "Cervezas y papas" },
      ],
    },
    {
      id: "v2",
      name: "Sra. Gladys",
      note: "Casa de la esquina",
      phone: "",
      movements: [
        { id: "m3", ts: now - 6 * DAY, type: "fiado", amount: 5400, note: "Leche, huevos" },
        { id: "m4", ts: now - 4 * DAY, type: "abono", amount: 3000, note: "Abono" },
        { id: "m5", ts: now - 2 * DAY, type: "fiado", amount: 7400, note: "Aceite, arroz y pan" },
      ],
    },
    {
      id: "v3",
      name: "Profe Manuel",
      note: "Colegio de la vuelta",
      phone: "",
      movements: [{ id: "m6", ts: now - 0.2 * DAY, type: "fiado", amount: 6200, note: "Café y queso" }],
    },
    {
      id: "v4",
      name: "Tía Rosita",
      note: "Pasaje 4",
      phone: "",
      movements: [
        { id: "m7", ts: now - 10 * DAY, type: "fiado", amount: 6500, note: "Mercadería del mes" },
        { id: "m8", ts: now - 4 * DAY, type: "abono", amount: 2000, note: "Abono" },
      ],
    },
    {
      id: "v5",
      name: "Javiera",
      note: "Depto 3B",
      phone: "",
      movements: [
        { id: "m9", ts: now - 12 * DAY, type: "fiado", amount: 3200, note: "Pan y palta" },
        { id: "m10", ts: now - 7 * DAY, type: "abono", amount: 3200, note: "Pagó todo" },
      ],
    },
  ];
}

// PRNG determinista: mismas ventas de demo para el mismo día.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SPEED_WEIGHT = { "muy alta": 6, alta: 4, media: 2, baja: 1 };

// Clientes por hora en un día normal (pico almuerzo y pico de la once).
const TRAFFIC = { 8: 2, 9: 4, 10: 4, 11: 5, 12: 8, 13: 9, 14: 6, 15: 4, 16: 4, 17: 6, 18: 10, 19: 11, 20: 8, 21: 3 };

function pickProduct(rand, products) {
  const total = products.reduce((s, p) => s + SPEED_WEIGHT[p.speed], 0);
  let r = rand() * total;
  for (const p of products) {
    r -= SPEED_WEIGHT[p.speed];
    if (r <= 0) return p;
  }
  return products[0];
}

function buildSale(rand, products, ts, id) {
  const lines = new Map();
  const n = 1 + Math.floor(rand() * 3.2);
  for (let i = 0; i < n; i++) {
    const p = pickProduct(rand, products);
    const qty = p.unit === "kg" ? [0.5, 1, 1, 1.5][Math.floor(rand() * 4)] : 1 + Math.floor(rand() * 1.6);
    const prev = lines.get(p.id);
    lines.set(p.id, { id: p.id, name: p.name, unit: p.unit, price: p.price, cost: p.cost, qty: (prev?.qty || 0) + qty });
  }
  const items = [...lines.values()];
  const total = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0));
  const method = rand() < 0.62 ? "efectivo" : "debito";
  return { id, ts, items, total, method };
}

// Ventas de un día hasta `untilHour` (hora decimal). factor escala el tráfico.
export function generateDaySales(dateKey, untilHour, factor = 1, products = PRODUCTS) {
  const rand = mulberry32(hashString(dateKey));
  const base = new Date(`${dateKey}T00:00:00`);
  const sales = [];
  for (let h = 8; h <= 21; h++) {
    const count = Math.round(TRAFFIC[h] * factor * (0.85 + rand() * 0.3));
    for (let i = 0; i < count; i++) {
      const minute = h === 8 ? 30 + rand() * 30 : h === 21 ? rand() * 30 : rand() * 60;
      const hourDec = h + minute / 60;
      const sale = buildSale(rand, products, base.getTime() + hourDec * 3600000, `${dateKey}-${h}-${i}`);
      if (hourDec <= untilHour) sales.push(sale);
    }
  }
  return sales.sort((a, b) => b.ts - a.ts);
}

export function dateKeyOf(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hourNow(d = new Date()) {
  return d.getHours() + d.getMinutes() / 60;
}

// Mismo día de la semana pasada: día completo, con algo menos de movimiento.
export function lastWeekSales(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return generateDaySales(dateKeyOf(d), 24, 0.86);
}

// Los últimos n días completos: base para comparar con un "día promedio".
export function pastDays(dateKey, n = 7) {
  const days = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(`${dateKey}T12:00:00`);
    d.setDate(d.getDate() - i);
    days.push(generateDaySales(dateKeyOf(d), 24, 0.9 + (i % 3) * 0.05));
  }
  return days;
}
