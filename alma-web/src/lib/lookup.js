// Busca un código de barras desconocido en las bases públicas de Open Food Facts (comida y bebida)
// y Open Products Facts (aseo y otros). Son gratis y sin clave; solo se envía el número del código.
// La cobertura de marcas chilenas es parcial: si no aparece, Alma lo pide a mano.

import { normalize } from "./format.js";

const SOURCES = [
  { host: "https://world.openfoodfacts.org", id: "Open Food Facts" },
  { host: "https://world.openproductsfacts.org", id: "Open Products Facts" },
];
const FIELDS = "product_name,product_name_es,generic_name_es,brands,quantity,categories_tags,image_front_small_url";
const CACHE_KEY = "alma:lookup:v1";
const MISS_TTL = 24 * 3600 * 1000;
const TIMEOUT_MS = 6000;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}
function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* sin espacio: solo se pierde el ahorro de consultas */
  }
}

const CATEGORY_RULES = [
  [/beverage|drink|bebida|water|agua|soda|juice|jugo|beer|cerveza|wine|vino/, "Bebidas"],
  [/dair(y|ies)|lact|milk|leche|cheese|queso|yogh?urt|butter|mantequilla/, "Lácteos"],
  [/snack|biscuit|galleta|chocolate|confection|candy|sweet|chips|cookie/, "Snacks"],
  [/fruit|vegetable|fruta|verdura/, "Verdulería"],
  [/bread|pan\b|bakery|panader/, "Panadería"],
  [/clean|detergent|soap|jabon|hygiene|aseo|laundry|dish/, "Aseo"],
];

export function guessCategory(tags = []) {
  const text = tags.join(" ").toLowerCase();
  return CATEGORY_RULES.find(([re]) => re.test(text))?.[1] || "Abarrotes";
}

function titleCase(s) {
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (!letters || (letters !== letters.toLowerCase() && letters !== letters.toUpperCase())) return s;
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

// "Coca-Cola", "Coca-Cola, Otra" + "2,25 L" → "Coca-Cola 2,25 L"
function buildName(p) {
  const base = (p.product_name_es || p.product_name || p.generic_name_es || "").trim();
  if (!base) return "";
  const brand = (p.brands || "").split(",")[0].trim();
  const parts = [titleCase(base)];
  if (brand && !normalize(base).includes(normalize(brand))) parts.push(titleCase(brand));
  // La base trae "400 g e" (el símbolo ℮ de "peso estimado"): se deja solo "400 g".
  const qty = (p.quantity || "").replace(/(\d\s*(?:kg|g|ml|cl|l|lt|cc))\s*[e℮]\s*$/i, "$1").trim();
  if (qty && !normalize(base).includes(normalize(qty))) parts.push(qty);
  return parts.join(" ").replace(/\s+/g, " ");
}

async function fetchOne(source, code) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${source.host}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, { signal: ctl.signal });
    const data = await res.json().catch(() => null);
    if (!data && !res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    const p = data?.product;
    if (!p) return null;
    const name = buildName(p);
    if (!name) return null;
    return {
      name,
      brand: (p.brands || "").split(",")[0].trim(),
      quantity: (p.quantity || "").replace(/(\d\s*(?:kg|g|ml|cl|l|lt|cc))\s*[e℮]\s*$/i, "$1").trim(),
      category: source.id === "Open Products Facts" ? "Aseo" : guessCategory(p.categories_tags),
      image: p.image_front_small_url || "",
      source: source.id,
    };
  } finally {
    clearTimeout(timer);
  }
}

// → { name, brand, quantity, category, image, source } | null (no está en la base).
// Lanza si no se pudo consultar (sin internet, límite de la base...), para no confundirlo con "no existe".
export async function lookupBarcode(code) {
  const cache = readCache();
  const hit = cache[code];
  if (hit && (hit.found || Date.now() - hit.at < MISS_TTL)) return hit.found || null;

  let failed = 0;
  let found = null;
  for (const source of SOURCES) {
    try {
      found = await fetchOne(source, code);
    } catch {
      failed += 1;
    }
    if (found) break;
  }
  if (!found && failed === SOURCES.length) throw new Error("sin conexión con la base de productos");
  if (found || failed === 0) {
    cache[code] = { found, at: Date.now() };
    writeCache(cache);
  }
  return found;
}

// "2,25 L" → 2250, "350 ml" → 350, "1 kg" → 1000 (ml o g). null si no trae tamaño.
export function sizeOf(text) {
  const m = String(text || "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|lt|l|cc)\b/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Math.round(n * { kg: 1000, g: 1, ml: 1, cc: 1, cl: 10, l: 1000, lt: 1000 }[m[2]]);
}

// ¿Se parece a algo que el dueño ya tiene en su vitrina? (ej.: "Spaghetti Carozzi 400 g" ~ "Fideos Spaghetti 400 g")
export function suggestOwn(info, products) {
  const words = (s) => normalize(s).split(" ").filter((w) => w.length >= 3 && !/^\d/.test(w));
  const theirs = new Set(words(`${info.name} ${info.brand}`));
  let best = null;
  for (const p of products) {
    const nameWords = words(p.name);
    if (!nameWords.length) continue;
    // Misma marca pero otro tamaño es otro producto (otro código).
    const a = sizeOf(info.quantity) ?? sizeOf(info.name);
    const b = sizeOf(p.name);
    if (a && b && Math.abs(a - b) / Math.max(a, b) > 0.02) continue;
    const shared = nameWords.filter((w) => theirs.has(w)).length;
    const score = shared / nameWords.length;
    if (shared >= 1 && score >= 0.5 && (!best || score > best.score)) best = { product: p, score };
  }
  return best?.product || null;
}
