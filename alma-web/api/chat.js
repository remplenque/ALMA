// Función serverless de Vercel: POST /api/chat { messages, tools?, context? } → respuesta de OpenRouter.
import { chat } from "./_chat.js";

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const out = await chat(input, process.env);
  return new Response(out.body, {
    status: out.status,
    headers: { "Content-Type": out.contentType, "Cache-Control": "no-store" },
  });
}
