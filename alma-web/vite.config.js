import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { synthesize } from "./api/_tts.js";

// En desarrollo, /api/tts responde igual que la función de Vercel (lee .env.local).
function almaVoiceDev(env) {
  return {
    name: "alma-voice-dev",
    configureServer(server) {
      server.middlewares.use("/api/tts", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", async () => {
          try {
            const { text } = JSON.parse(raw || "{}");
            const out = await synthesize(text, env);
            res.statusCode = out.status;
            res.setHeader("Content-Type", out.contentType);
            res.end(out.body);
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // HTTPS=1 para probar cámara y micrófono desde el iPad en la red local.
  const https = process.env.HTTPS === "1";
  return {
    plugins: [react(), almaVoiceDev(env), ...(https ? [basicSsl()] : [])],
    server: { host: https ? true : undefined },
  };
});
