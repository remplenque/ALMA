import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { synthesize } from "./api/_tts.js";
import { chat } from "./api/_chat.js";

// En desarrollo, /api/tts y /api/chat responden igual que las funciones de Vercel (leen .env.local).
function almaApiDev(env) {
  const route = (server, path, handle) =>
    server.middlewares.use(path, (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end();
      }
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", async () => {
        try {
          const out = await handle(JSON.parse(raw || "{}"));
          res.statusCode = out.status;
          res.setHeader("Content-Type", out.contentType);
          res.end(out.body);
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    });
  return {
    name: "alma-api-dev",
    configureServer(server) {
      route(server, "/api/tts", ({ text }) => synthesize(text, env));
      route(server, "/api/chat", (input) => chat(input, env));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // HTTPS=1 para probar cámara y micrófono desde el iPad en la red local.
  const https = process.env.HTTPS === "1";
  return {
    plugins: [react(), almaApiDev(env), ...(https ? [basicSsl()] : [])],
    server: { host: https ? true : undefined },
  };
});
