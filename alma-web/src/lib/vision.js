// Reconocimiento de productos con la cámara, 100% en el navegador.
// MediaPipe extrae una "huella" de cada imagen y Alma compara contra las fotos
// que le enseñaste (vecinos más cercanos). Funciona con la webcam conectada al iPad.

const MODEL_PATH = "/models/mobilenet_v3_small.tflite";
const WASM_PATH = "/mediapipe";
const STORAGE_KEY = "alma:vision:v1";
export const BACKGROUND = "__fondo__";

let embedderPromise = null;

export function loadEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { FilesetResolver, ImageEmbedder } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      const create = (delegate) =>
        ImageEmbedder.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate },
          runningMode: "VIDEO",
          l2Normalize: true,
          quantize: false,
        });
      try {
        return await create("GPU");
      } catch {
        return await create("CPU");
      }
    })().catch((e) => {
      embedderPromise = null;
      throw e;
    });
  }
  return embedderPromise;
}

// Solo se mira el centro de la imagen (el recuadro del visor), donde va el producto.
const ROI = { regionOfInterest: { left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 } };

let lastTs = 0;
export function embed(embedder, video) {
  const ts = Math.max(performance.now(), lastTs + 1);
  lastTs = ts;
  const res = embedder.embedForVideo(video, ts, ROI);
  return Array.from(res.embeddings[0].floatEmbedding);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/* ---------- muestras enseñadas (se guardan en el dispositivo) ---------- */

export function loadSamples() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSamples(samples) {
  try {
    const compact = Object.fromEntries(Object.entries(samples).map(([k, list]) => [k, list.map((v) => v.map((n) => Math.round(n * 1e4) / 1e4))]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  } catch {
    /* sin espacio: las muestras quedan solo en memoria */
  }
}

// k vecinos más cercanos por similitud coseno (los vectores vienen normalizados).
export function classify(vec, samples, k = 5) {
  const scored = [];
  for (const [label, list] of Object.entries(samples)) {
    for (const s of list) scored.push({ label, sim: dot(vec, s) });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, Math.min(k, scored.length));
  const votes = {};
  for (const t of top) votes[t.label] = (votes[t.label] || 0) + 1;
  const [label, count] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  const best = top.find((t) => t.label === label).sim;
  return { label, confidence: count / top.length, similarity: best };
}

/* ---------- cámara ---------- */

export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}

export async function openCamera(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(window.isSecureContext ? "Este navegador no permite usar la cámara." : "La cámara solo funciona con conexión segura (https).");
  }
  const video = deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } };
  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}
