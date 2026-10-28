// Texto para la voz: plata, pesos, horas y códigos escritos como los diría una persona en Chile.
// Las voces sintéticas leen mal las cifras ("$86.275" → "ochenta y seis doscientos setenta y cinco"),
// así que todo número llega al sintetizador ya escrito en palabras.

const UNITS = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
const ORDINALS = ["", "primer", "segundo", "tercer", "cuarto", "quinto", "sexto", "séptimo", "octavo", "noveno", "décimo"];

// gender: "n" sin sustantivo ("uno"), "m" antes de un sustantivo masculino ("un", "veintiún"),
// "f" antes de uno femenino ("una", "doscientas").
function below100(n, gender) {
  const w = n < 30 ? UNITS[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` y ${UNITS[n % 10]}` : "");
  if (gender === "n" || !w.endsWith("uno")) return w;
  if (gender === "f") return w.replace(/uno$/, "una");
  return w === "veintiuno" ? "veintiún" : w.replace(/uno$/, "un");
}

function below1000(n, gender) {
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hundreds = gender === "f" && h > 1 ? HUNDREDS[h].replace(/os$/, "as") : HUNDREDS[h];
  return [h ? hundreds : "", r || !h ? below100(r, gender) : ""].filter(Boolean).join(" ");
}

export function numberWords(n, gender = "n") {
  if (n === 0) return "cero";
  const millions = Math.floor(n / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (millions) parts.push(millions === 1 ? "un millón" : `${numberWords(millions, "m")} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${below1000(thousands, gender === "f" ? "f" : "m")} mil`);
  if (rest) parts.push(below1000(rest, gender));
  return parts.join(" ");
}

// "1,25" → "uno coma veinticinco"; "0,05" → "cero coma cero cinco".
function decimalWords(int, frac, gender) {
  if (!frac) return numberWords(int, gender);
  const zeros = frac.match(/^0*/)[0].length;
  const tail = frac.slice(zeros);
  return `${numberWords(int)} coma ${"cero ".repeat(zeros)}${tail ? numberWords(Number(tail)) : ""}`.trim();
}

// "86.275" → 86275 (en Chile el punto separa miles).
const toInt = (s) => Number(s.replace(/\./g, ""));
const counted = (n, one, many, gender = "m") => `${numberWords(n, gender)} ${n === 1 ? one : many}`;

function pesos(n) {
  if (n === 1) return "un peso";
  // "un millón de pesos", pero "un millón quinientos mil pesos".
  return `${numberWords(n, "m")}${n >= 1e6 && n % 1e6 === 0 ? " de" : ""} pesos`;
}

// Pesos de la pesa como se dicen en el mostrador: "medio kilo", "un kilo y medio", "setecientos treinta y cinco gramos".
function kilos(int, frac) {
  const grams = Math.round(Number(`0.${frac || 0}`) * 1000);
  const whole = int ? counted(int, "kilo", "kilos") : "";
  if (!grams) return whole || "cero kilos";
  if (grams === 500) return int ? `${whole} y medio` : "medio kilo";
  if (!int && grams === 250) return "un cuarto de kilo";
  if (!int && grams === 750) return "tres cuartos de kilo";
  return [whole, counted(grams, "gramo", "gramos")].filter(Boolean).join(" ");
}

function litros(int, frac) {
  if (frac === "5") return int ? `${counted(int, "litro", "litros")} y medio` : "medio litro";
  if (frac) return `${decimalWords(int, frac)} litros`;
  return counted(int, "litro", "litros");
}

// Palabras que suelen ir después de una cifra sin ser el sustantivo contado ("1 de cada 3").
const LINKS = new Set(["de", "del", "a", "al", "y", "e", "o", "u", "en", "por", "para", "con", "que", "más", "menos", "entre", "hasta", "desde", "cada", "como", "es", "son", "se", "me", "te", "le", "lo", "la", "los", "las"]);
const FEMININE = new Set(["vez", "veces", "leche", "leches", "noche", "noches", "tarde", "tardes", "gente", "carne", "carnes", "sal", "miel", "luz", "llave", "llaves"]);
const MASCULINE = new Set(["día", "días", "mapa", "mapas", "problema", "problemas", "sistema", "sistemas", "programa", "programas", "kilo", "kilos"]);

function genderOf(after) {
  const word = after.match(/^\s*(\p{L}+)/u)?.[1]?.toLowerCase();
  if (!word || LINKS.has(word)) return "n";
  if (FEMININE.has(word)) return "f";
  if (MASCULINE.has(word)) return "m";
  return /(a|as|dad|dades|ción|ciones|sión|siones|tud|tudes)$/.test(word) ? "f" : "m";
}

const NUM = String.raw`\d{1,3}(?:\.\d{3})+|\d+`; // "86.275" o "86275"

export function speakable(text) {
  return (
    String(text)
      .replace(/\p{Extended_Pictographic}️?/gu, "")
      .replace(/[“”"«»*_#`]/g, "")
      .replace(/\s?[—–]\s?/g, ", ")
      .replace(/\s?\(([^)]*)\)/g, ", $1,")
      .replace(/\bc\/u\b/gi, "cada uno")
      .replace(/\bSra\./g, "señora")
      .replace(/\bSr\./g, "señor")
      .replace(/\bN[°º]\s?/g, "número ")
      .replace(/\baprox\./gi, "aproximadamente")
      // Cantidades de boleta: "2 x $1.000" es "dos por mil pesos"; "2× Fideos" es "dos fideos"; "x12" es "de doce".
      .replace(/(\d)\s?[x×]\s?(?=\$)/g, "$1 por ")
      .replace(/(\d)\s?×\s?/g, "$1 ")
      .replace(/(\d)\s?x\s(?=\p{L})/gu, "$1 ")
      .replace(/\bx(\d)/g, "de $1")
      // Plata: "$86.275" → "ochenta y seis mil doscientos setenta y cinco pesos".
      .replace(new RegExp(String.raw`(-\s?)?\$\s?(${NUM})`, "g"), (_, minus, n) => `${minus ? "menos " : ""}${pesos(toInt(n))}`)
      .replace(/(\d+)(?:,(\d+))?\s?%/g, (_, i, f) => `${decimalWords(Number(i), f)} por ciento`)
      // Unidades de la pesa y de los envases.
      .replace(/(\d+)(?:,(\d+))?\s?(?:kg|kgs|kilos?)\b/gi, (_, i, f) => kilos(Number(i), f))
      .replace(new RegExp(String.raw`(${NUM})\s?(?:g|gr|grs|gramos?)\b`, "gi"), (_, n) => counted(toInt(n), "gramo", "gramos"))
      .replace(/(\d+)(?:,(\d+))?\s?(?:l|lt|lts|litros?)\b/gi, (_, i, f) => litros(Number(i), f))
      .replace(/(\d+)\s?(?:ml|cc)\b/gi, (_, n) => counted(Number(n), "mililitro", "mililitros"))
      .replace(/(\d+)\s?u\b\.?/g, (_, n) => counted(Number(n), "unidad", "unidades", "f"))
      // Horas: "14:30" → "catorce treinta"; "9:05" → "nueve cero cinco".
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => `${numberWords(Number(h), "f")}${m === "00" ? "" : ` ${m[0] === "0" ? "cero " : ""}${numberWords(Number(m))}`}`)
      .replace(/\b(\d{1,2})\s?[°º]/g, (_, n) => ORDINALS[n] || numberWords(Number(n)))
      .replace(/(\d)\s?-\s?(\d)/g, "$1 a $2")
      // Todo lo demás. Códigos largos (de barras, teléfonos) se dicen dígito por dígito.
      .replace(new RegExp(String.raw`(${NUM})(?:,(\d+))?`, "g"), (match, n, frac, offset, all) => {
        if (!frac && !n.includes(".") && n.length >= 7) return [...n].map((d) => UNITS[d]).join(" ");
        return decimalWords(toInt(n), frac, genderOf(all.slice(offset + match.length)));
      })
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/,\s*([,.;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
