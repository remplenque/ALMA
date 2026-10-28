// Voz natural de Alma. Con TTS_PROVIDER=azure|elevenlabs|openai se elige el proveedor a mano;
// si no, se usa el primero configurado en variables de entorno:
//   1. Azure Speech  (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION) → voz chilena es-CL-CatalinaNeural
//   2. ElevenLabs    (ELEVENLABS_API_KEY; opcional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL)
//   3. OpenAI        (OPENAI_API_KEY) → gpt-4o-mini-tts con instrucciones de tono
// Si ninguno está configurado responde 501 y el navegador usa su propia voz.

const MAX_CHARS = 900;

const TONE =
  "Eres Alma, una mujer chilena cálida y cercana que trabaja codo a codo con el dueño de un almacén de barrio. " +
  "Habla en español de Chile, con calma, amable y natural, como una vecina de confianza. Nada de tono de locutora ni robótico.";

// El ánimo de la frase (el mismo que muestra la cara de Alma) decide cómo la dice:
//   tag     → etiqueta de emoción que entiende ElevenLabs eleven_v3
//   v2      → expresividad para los modelos ElevenLabs v2/v2.5, que no entienden etiquetas
//   azure   → ritmo y altura para Azure
//   openai  → indicación de tono para gpt-4o-mini-tts
const MOODS = {
  happy: { tag: "[cheerfully]", v2: { stability: 0.35, style: 0.45 }, azure: ["0%", "+6%"], openai: "contenta, con una sonrisa en la voz" },
  smile: { tag: "[warmly]", v2: { stability: 0.45, style: 0.3 }, azure: ["-4%", "+2%"], openai: "cálida y tranquila" },
  wink: { tag: "[playfully]", v2: { stability: 0.4, style: 0.4 }, azure: ["-2%", "+4%"], openai: "cómplice, como quien da un buen dato" },
  surprised: { tag: "[surprised]", v2: { stability: 0.3, style: 0.5 }, azure: ["0%", "+8%"], openai: "sorprendida, llamando la atención" },
  sad: { tag: "[concerned]", v2: { stability: 0.55, style: 0.2 }, azure: ["-10%", "-2%"], openai: "preocupada pero comprensiva, más pausada" },
  neutral: { tag: "", v2: { stability: 0.5, style: 0.2 }, azure: ["-4%", "+2%"], openai: "atenta, preguntando con interés" },
};

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
}

async function azure(text, env, mood = MOODS.smile) {
  const voice = env.AZURE_SPEECH_VOICE || "es-CL-CatalinaNeural";
  const [rate, pitch] = mood.azure;
  const ssml = `<speak version="1.0" xml:lang="es-CL"><voice name="${voice}"><prosody rate="${rate}" pitch="${pitch}">${escapeXml(text)}</prosody></voice></speak>`;
  return fetch(`https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "alma-web",
    },
    body: ssml,
  });
}

// Voz de la biblioteca básica de ElevenLabs (disponible en cualquier cuenta). Con el modelo multilingüe habla
// español, pero con acento extranjero: para Alma conviene elegir en elevenlabs.io/app/voice-library una voz en
// español (acento chileno o neutro latino), agregarla a "My Voices" y poner su id en ELEVENLABS_VOICE_ID.
const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // "Rachel"

// pcm: audio crudo de 16 bits a PCM_RATE, que el navegador reproduce a medida que llega (Web Audio).
export const PCM_RATE = 24000;

async function elevenlabs(text, env, mood = MOODS.smile, pcm = false) {
  const voice = encodeURIComponent((env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE).trim());
  const model = env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  // eleven_v3 actúa la emoción que le pide la etiqueta; con estabilidad "natural" (0.5) no se sobreactúa.
  const v3 = /^eleven_v3/.test(model);
  // /stream manda el audio a medida que se genera: el primer trozo llega en menos de un segundo.
  const format = pcm ? `pcm_${PCM_RATE}` : "mp3_44100_128";
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=${format}`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY.trim(), "Content-Type": "application/json", Accept: pcm ? "audio/pcm" : "audio/mpeg" },
    body: JSON.stringify({
      text: v3 && mood.tag ? `${mood.tag} ${text}` : text,
      model_id: model,
      // Los modelos v2.5 (flash/turbo, más rápidos) aceptan fijar el idioma; el multilingual v2 lo detecta solo.
      ...(/v2_5/.test(model) ? { language_code: "es" } : {}),
      voice_settings: v3
        ? { stability: 0.5, similarity_boost: 0.8 }
        : { ...mood.v2, similarity_boost: 0.8, use_speaker_boost: true },
    }),
  });
}

async function openai(text, env, mood = MOODS.smile) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: env.OPENAI_TTS_VOICE || "coral",
      input: text,
      instructions: `${TONE} En esta frase suena ${mood.openai}.`,
      response_format: "mp3",
    }),
  });
}

const PROVIDERS = {
  azure: { run: azure, ready: (env) => env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION },
  elevenlabs: { run: elevenlabs, ready: (env) => env.ELEVENLABS_API_KEY },
  openai: { run: openai, ready: (env) => env.OPENAI_API_KEY },
};

export function ttsProviderName(env) {
  const wanted = String(env.TTS_PROVIDER || "").trim().toLowerCase();
  // Elegido a mano pero sin su clave: no se cambia de proveedor a escondidas, se usa la voz del dispositivo.
  if (wanted) return PROVIDERS[wanted]?.ready(env) ? wanted : null;
  return Object.keys(PROVIDERS).find((name) => PROVIDERS[name].ready(env)) || null;
}

export function ttsProvider(env) {
  const name = ttsProviderName(env);
  return name ? PROVIDERS[name].run : null;
}

// Un error del proveedor, con su motivo (clave inválida, sin créditos...) pero sin datos sensibles.
async function failure(name, res) {
  let reason = "";
  try {
    const data = await res.json();
    const d = data?.detail;
    reason = typeof d === "string" ? d : d?.status || d?.message || data?.error?.message || data?.error?.code || "";
  } catch {
    /* sin cuerpo legible */
  }
  return `Proveedor de voz (${name}) respondió ${res.status}${reason ? `: ${String(reason).slice(0, 120)}` : ""}`;
}

// Devuelve { status, body, contentType } para usarlo igual en Vercel y en el servidor de desarrollo.
// mood: happy | smile | wink | surprised | sad | neutral (cualquier otro valor se dice como "smile").
// stream: devuelve el cuerpo como ReadableStream para reenviarlo a medida que llega.
// format "pcm": audio crudo (solo ElevenLabs); los demás proveedores responden mp3 igual.
export async function synthesize(rawText, env, rawMood, { stream = false, format = "mp3" } = {}) {
  const name = ttsProviderName(env);
  const provider = name && PROVIDERS[name].run;
  if (!provider) return { status: 501, body: "Voz natural no configurada", contentType: "text/plain" };
  const text = String(rawText || "").trim().slice(0, MAX_CHARS);
  if (!text) return { status: 400, body: "Falta el texto", contentType: "text/plain" };
  const mood = Object.hasOwn(MOODS, rawMood) ? MOODS[rawMood] : MOODS.smile;
  const pcm = format === "pcm" && name === "elevenlabs";
  let res;
  try {
    res = await provider(text, env, mood, pcm);
  } catch (e) {
    console.warn(`[tts] ${name}: no se pudo conectar (${e?.message || e})`);
    return { status: 502, body: `Proveedor de voz (${name}) sin conexión`, contentType: "text/plain" };
  }
  if (!res.ok) {
    const body = await failure(name, res);
    console.warn(`[tts] ${body}`);
    return { status: 502, body, contentType: "text/plain" };
  }
  const contentType = pcm ? `audio/pcm;rate=${PCM_RATE}` : "audio/mpeg";
  return { status: 200, body: stream ? res.body : Buffer.from(await res.arrayBuffer()), contentType };
}
