// Voz natural de Alma. Usa el primer proveedor configurado en variables de entorno:
//   1. Azure Speech  (AZURE_SPEECH_KEY + AZURE_SPEECH_REGION) → voz chilena es-CL-CatalinaNeural
//   2. ElevenLabs    (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)
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

async function elevenlabs(text, env) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
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

export function ttsProvider(env) {
  if (env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION) return azure;
  if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID) return elevenlabs;
  if (env.OPENAI_API_KEY) return openai;
  return null;
}

// Devuelve { status, body, contentType } para usarlo igual en Vercel y en el servidor de desarrollo.
export async function synthesize(rawText, env) {
  const provider = ttsProvider(env);
  if (!provider) return { status: 501, body: "Voz natural no configurada", contentType: "text/plain" };
  const text = String(rawText || "").trim().slice(0, MAX_CHARS);
  if (!text) return { status: 400, body: "Falta el texto", contentType: "text/plain" };
  const res = await provider(text, env);
  if (!res.ok) return { status: 502, body: `Proveedor de voz respondió ${res.status}`, contentType: "text/plain" };
  return { status: 200, body: Buffer.from(await res.arrayBuffer()), contentType: "audio/mpeg" };
}
