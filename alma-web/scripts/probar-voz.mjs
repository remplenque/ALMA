// Prueba la voz natural de Alma con las claves de .env.local, sin abrir la app.
//   npm run probar-voz                      → dice una frase de ejemplo
//   npm run probar-voz -- "Hola, soy Alma"  → dice lo que le pases
//   npm run probar-voz -- "[happy] Vas $86.275 hoy"  → con ánimo, y la plata dicha en palabras como en la app
// Guarda el audio en la carpeta temporal y lo reproduce (macOS: afplay).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { synthesize, ttsProviderName } from "../api/_tts.js";
import { speakable } from "../src/lib/spoken.js";

function readEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env.local: solo variables del sistema */
  }
  return env;
}

const env = readEnv();
const name = ttsProviderName(env);
if (!name) {
  console.error("No hay voz natural configurada. Pon ELEVENLABS_API_KEY (o AZURE_SPEECH_KEY + AZURE_SPEECH_REGION) en alma-web/.env.local.");
  process.exit(1);
}
const input = process.argv.slice(2).join(" ") || "[happy] Hola Mario, soy Alma. Hoy vas muy bien: llevas $212.000 en 40 ventas. ¿Te anoto el pedido del pan?";
const [, mood = "smile", raw] = input.match(/^(?:\[(\w+)\]\s*)?([\s\S]*)$/);
const text = speakable(raw);
console.log(`Proveedor: ${name}${name === "elevenlabs" ? ` · voz ${env.ELEVENLABS_VOICE_ID || "(por defecto)"} · modelo ${env.ELEVENLABS_MODEL || "eleven_multilingual_v2"}` : ""}`);

const t0 = Date.now();
console.log(`Ánimo: ${mood} · dice: "${text}"`);
const out = await synthesize(text, env, mood);
if (out.status !== 200) {
  console.error(`Falló (${out.status}): ${out.body}`);
  process.exit(1);
}
const file = join(tmpdir(), `alma-voz-${name}.mp3`);
writeFileSync(file, out.body);
console.log(`Listo en ${((Date.now() - t0) / 1000).toFixed(1)} s · ${(out.body.length / 1024).toFixed(0)} KB · ${file}`);
try {
  execFileSync("afplay", [file], { stdio: "ignore" });
} catch {
  console.log("(No pude reproducirlo solo; ábrelo a mano.)");
}
