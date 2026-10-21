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

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
}

async function azure(text, env) {
  const voice = env.AZURE_SPEECH_VOICE || "es-CL-CatalinaNeural";
  const ssml = `<speak version="1.0" xml:lang="es-CL"><voice name="${voice}"><prosody rate="-4%" pitch="+2%">${escapeXml(text)}</prosody></voice></speak>`;
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

async function elevenlabs(text, env) {
  const voice = encodeURIComponent((env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE).trim());
  const model = env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY.trim(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: model,
      // Los modelos v2.5 (flash/turbo, más rápidos) aceptan fijar el idioma; el multilingual v2 lo detecta solo.
      ...(/v2_5/.test(model) ? { language_code: "es" } : {}),
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  });
}

async function openai(text, env) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: env.OPENAI_TTS_VOICE || "coral",
      input: text,
      instructions: TONE,
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
export async function synthesize(rawText, env) {
  const name = ttsProviderName(env);
  const provider = name && PROVIDERS[name].run;
  if (!provider) return { status: 501, body: "Voz natural no configurada", contentType: "text/plain" };
  const text = String(rawText || "").trim().slice(0, MAX_CHARS);
  if (!text) return { status: 400, body: "Falta el texto", contentType: "text/plain" };
  let res;
  try {
    res = await provider(text, env);
  } catch (e) {
    console.warn(`[tts] ${name}: no se pudo conectar (${e?.message || e})`);
    return { status: 502, body: `Proveedor de voz (${name}) sin conexión`, contentType: "text/plain" };
  }
  if (!res.ok) {
    const body = await failure(name, res);
    console.warn(`[tts] ${body}`);
    return { status: 502, body, contentType: "text/plain" };
  }
  return { status: 200, body: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" };
}
