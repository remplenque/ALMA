// Función serverless de Vercel: POST /api/tts { text, mood?, format? } → la voz de Alma, enviada a medida que se genera
// (audio/mpeg, o audio/pcm si se pide format "pcm" y la voz es de ElevenLabs).
import { synthesize } from "./_tts.js";

export async function POST(request) {
  let text = "";
  let mood;
  let format;
  try {
    ({ text, mood, format } = await request.json());
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const out = await synthesize(text, process.env, mood, { stream: true, format });
  return new Response(out.body, {
    status: out.status,
    headers: { "Content-Type": out.contentType, "Cache-Control": "no-store" },
  });
}
