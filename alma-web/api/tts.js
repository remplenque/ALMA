// Función serverless de Vercel: POST /api/tts { text } → audio/mpeg con la voz de Alma.
import { synthesize } from "./_tts.js";

export async function POST(request) {
  let text = "";
  try {
    ({ text } = await request.json());
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const out = await synthesize(text, process.env);
  return new Response(out.body, {
    status: out.status,
    headers: { "Content-Type": out.contentType, "Cache-Control": "no-store" },
  });
}
