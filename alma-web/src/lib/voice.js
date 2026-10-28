// Voz de Alma: habla con voz natural (servicio /api/tts) y, si no está
// configurado, con la mejor voz femenina en español del dispositivo.
// Expone el nivel de la voz cuadro a cuadro para mover la boca del isotipo.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { normalize } from "./format.js";
import { speakable } from "./spoken.js";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canListen = Boolean(Recognition);
const canSynth = typeof window !== "undefined" && "speechSynthesis" in window;

/* ---------- estado compartido: ¿está hablando? ¿qué dice? ---------- */

let snapshot = { speaking: false, text: "", id: 0, source: "any", mood: "smile" };
const speechListeners = new Set();
function setSnapshot(patch) {
  snapshot = { ...snapshot, ...patch };
  speechListeners.forEach((fn) => fn());
}
function subscribe(fn) {
  speechListeners.add(fn);
  return () => speechListeners.delete(fn);
}
export function useSpeech() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// Nivel de apertura de boca (0..1), leído en cada cuadro sin re-render de React.
let level = 0;
export function getLevel() {
  return level;
}

/* ---------- audio: desbloqueo en iPad y análisis de volumen ---------- */

let audioCtx = null;
let audioEl = null;
let analyser = null;
let unlocked = false;

function ensureAudio() {
  if (audioEl) return;
  audioEl = new Audio();
  audioEl.preload = "auto";
  audioEl.playsInline = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    const src = audioCtx.createMediaElementSource(audioEl);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch {
    analyser = null;
  }
}

// Safari en iPad solo deja sonar audio después de un toque del usuario.
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  ensureAudio();
  audioCtx?.resume?.();
  if (canSynth) {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }
}

/* ---------- motores de voz ---------- */

// Voz del dispositivo: el ánimo de la frase se nota en el ritmo y la altura.
const SYNTH_TONE = {
  happy: { rate: 1.06, pitch: 1.12 },
  surprised: { rate: 1.05, pitch: 1.15 },
  wink: { rate: 1.03, pitch: 1.1 },
  sad: { rate: 0.94, pitch: 1.0 },
  neutral: { rate: 1.0, pitch: 1.06 },
};

let cloudAvailable = true; // se desactiva si /api/tts no está configurado
let rafId = 0;
let synthPulse = 0;

function stopLoop() {
  cancelAnimationFrame(rafId);
  level = 0;
}

function analyserLoop() {
  const data = new Uint8Array(analyser.fftSize);
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const target = Math.min(1, rms * 5.5);
    level += (target - level) * 0.45;
    rafId = requestAnimationFrame(tick);
  };
  tick();
}

// Sin acceso al audio de la voz del sistema: boca con ritmo de sílabas.
function syntheticLoop() {
  const start = performance.now();
  const tick = (now) => {
    const t = (now - start) / 1000;
    const syllable = Math.abs(Math.sin(t * 11.5)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.3 + 1)));
    synthPulse *= 0.9;
    const target = Math.min(1, 0.15 + syllable * 0.75 + synthPulse * 0.3);
    level += (target - level) * 0.5;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

const FEMALE_HINTS = ["catalina", "paulina", "monica", "mónica", "marisol", "dalia", "elvira", "paloma", "sabina", "helena", "laura", "lucia", "lucía", "francisca", "google español"];

function pickVoice() {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const score = (v) => {
    const name = v.name.toLowerCase();
    let s = 0;
    if (v.lang === "es-CL") s += 50;
    else if (/es-(419|us|mx|ar|co)/i.test(v.lang)) s += 20;
    if (name.includes("natural") || name.includes("online") || name.includes("premium") || name.includes("enhanced") || name.includes("mejorada")) s += 30;
    if (FEMALE_HINTS.some((h) => name.includes(h))) s += 25;
    return s;
  };
  return voices.sort((a, b) => score(b) - score(a))[0];
}

function speakWithSynth(text, id) {
  return new Promise((resolve) => {
    if (!canSynth) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakable(text));
    u.lang = "es-CL";
    const tone = SYNTH_TONE[snapshot.mood];
    u.rate = tone?.rate ?? 1.02;
    u.pitch = tone?.pitch ?? 1.08;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    // La boca parte al tiro: no todos los navegadores avisan cuándo empieza la voz.
    syntheticLoop();
    u.onboundary = () => {
      synthPulse = 1;
    };
    const done = (failed = false) => {
      stopLoop();
      resolve(failed);
    };
    u.onend = () => done(false);
    // Sin voces instaladas el navegador falla al tiro: avisamos para animar igual.
    u.onerror = (e) => done(e.error !== "interrupted" && e.error !== "canceled");
    window.speechSynthesis.speak(u);
    // Respaldo: algunos navegadores no avisan el final.
    setTimeout(() => snapshot.id === id && done(false), Math.max(4000, text.length * 95));
  });
}

// Voz en PCM (ElevenLabs): cada trozo suena apenas llega, sin esperar a que se genere la frase entera.
let pcmSources = [];

function stopPcm() {
  for (const s of pcmSources) {
    try {
      s.stop();
    } catch {
      /* ya terminó */
    }
  }
  pcmSources = [];
}

async function playPcmStream(res, id, rate) {
  const reader = res.body.getReader();
  let at = 0; // cuándo parte el próximo trozo, en el reloj de audioCtx
  let carry = null; // cada muestra son 2 bytes y los trozos de la red no siempre calzan
  for (;;) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (!pcmSources.length) throw e;
      break; // se cortó la red a medio camino: que termine lo que alcanzó a llegar
    }
    if (snapshot.id !== id || !snapshot.speaking) {
      reader.cancel().catch(() => {});
      return;
    }
    if (chunk.done) break;
    let bytes = chunk.value;
    if (carry) {
      bytes = new Uint8Array(carry.length + chunk.value.length);
      bytes.set(carry);
      bytes.set(chunk.value, carry.length);
      carry = null;
    }
    if (bytes.length % 2) {
      carry = bytes.slice(-1);
      bytes = bytes.subarray(0, -1);
    }
    if (!bytes.length) continue;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const buffer = audioCtx.createBuffer(1, bytes.length / 2, rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(analyser);
    // Un colchón chico al partir evita cortes si el segundo trozo se atrasa.
    at = Math.max(at, audioCtx.currentTime + (pcmSources.length ? 0.02 : 0.08));
    src.start(at);
    at += buffer.duration;
    if (!pcmSources.length) analyserLoop();
    pcmSources.push(src);
  }
  // Espera a que suene lo ya programado; stop() lo corta antes (y dispara onended).
  const last = pcmSources[pcmSources.length - 1];
  if (last) {
    await new Promise((resolve) => {
      last.onended = resolve;
      setTimeout(resolve, Math.max(0, at - audioCtx.currentTime) * 1000 + 150);
    });
  }
  pcmSources = [];
}

async function speakWithCloud(text, id) {
  ensureAudio();
  await audioCtx?.resume?.();
  const pcm = Boolean(audioCtx && analyser);
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: speakable(text), mood: snapshot.mood, ...(pcm ? { format: "pcm" } : {}) }),
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 501) cloudAvailable = false;
    throw new Error(`tts ${res.status}`);
  }
  if (snapshot.id !== id || !snapshot.speaking) return;
  const type = res.headers.get("Content-Type") || "";
  if (type.startsWith("audio/pcm")) {
    await playPcmStream(res, id, Number(type.match(/rate=(\d+)/)?.[1]) || 24000);
    stopLoop();
    return;
  }
  const blob = await res.blob();
  if (snapshot.id !== id || !snapshot.speaking) return;
  audioEl.src = URL.createObjectURL(blob);
  await new Promise((resolve, reject) => {
    audioEl.onended = resolve;
    audioEl.onerror = reject;
    audioEl.play().then(() => (analyser ? analyserLoop() : syntheticLoop()), reject);
  });
  stopLoop();
}

/* ---------- anti-eco: que Alma no se escuche a sí misma ---------- */

const ECHO_TAIL_MS = 1500; // el parlante sigue sonando un instante después de terminar
const ECHO_WINDOW_MS = 10000;
let activeTake = null; // micrófono abierto (para cerrarlo cuando Alma habla)
let lastSpoken = { text: "", at: 0, tail: false };

// tail=false: el audio se cortó a propósito (el dueño la interrumpió), no queda eco que esperar.
function noteSpoken(text, tail = true) {
  lastSpoken = { text, at: Date.now(), tail };
}

// ¿Lo que "escuchó" el micrófono es la propia voz de Alma?
function isEcho(transcript) {
  if (snapshot.speaking) return true;
  const since = Date.now() - lastSpoken.at;
  if (lastSpoken.tail && since < ECHO_TAIL_MS) return true;
  if (since > ECHO_WINDOW_MS || !lastSpoken.text) return false;
  const heard = normalize(transcript).split(" ").filter(Boolean);
  if (heard.length < 3) return false;
  const said = new Set(normalize(lastSpoken.text).split(" "));
  return heard.filter((w) => said.has(w)).length / heard.length >= 0.7;
}

/* ---------- API pública ---------- */

// ¿Alma está escuchando al dueño o hablando desde otra cara? Sirve para no interrumpirla.
export function isBusy(except) {
  return Boolean(activeTake) || (snapshot.speaking && snapshot.source !== except);
}

let voiceOn = true;
export function setVoiceEnabled(on) {
  voiceOn = on;
  if (!on) stop();
}

export function stop() {
  if (snapshot.speaking) noteSpoken(snapshot.text, false);
  stopLoop();
  stopPcm();
  if (canSynth) window.speechSynthesis.cancel();
  if (audioEl) audioEl.pause();
  setSnapshot({ speaking: false });
}

// Alma dice algo: se muestra en su globo de diálogo y, si la voz está activa, suena.
// source indica qué cara de Alma habla (inicio, notificación, caja…) para que solo esa mueva la boca.
export async function say(text, { mood = "smile", silent = false, source = "any" } = {}) {
  stop();
  // Mientras Alma habla el micrófono no escucha: si no, tomaría su voz como si fuera del dueño.
  activeTake?.cancel();
  const id = snapshot.id + 1;
  setSnapshot({ speaking: true, text, mood, id, source });
  // Sin voz (o si el dispositivo no puede hablar): la boca se mueve un momento
  // para que se entienda que es ella quien habla.
  const mime = async () => {
    syntheticLoop();
    await new Promise((r) => setTimeout(r, Math.min(2600, 900 + text.length * 22)));
  };
  if (!voiceOn || silent) {
    await mime();
  } else {
    try {
      if (!cloudAvailable) throw new Error("sin voz en la nube");
      await speakWithCloud(text, id);
    } catch {
      if (snapshot.id === id && !canSynth) await mime();
      else if (snapshot.id === id && (await speakWithSynth(text, id)) && snapshot.id === id) await mime();
    }
  }
  if (snapshot.id === id) {
    stopLoop();
    // Si ya la cortaron a propósito, stop() dejó anotado que no hay eco que esperar.
    if (snapshot.speaking) noteSpoken(text);
    setSnapshot({ speaking: false });
  }
}

/* ---------- escuchar (micrófono) ---------- */

const FINISH_WAIT_MS = 400; // al cerrar, cuánto se espera a que el navegador entregue la última frase
const SILENCE_LIMIT_MS = 60000; // si no oye nada en un minuto, se cierra solo
const QUICK_END_MS = 1500; // un reconocimiento que se cae antes de esto cuenta como falla

// El micrófono queda abierto desde que se toca hasta que se vuelve a tocar: el dueño puede pensar,
// hacer pausas y seguir hablando. Al cerrarlo se entrega todo lo que dijo de una vez.
export function useListener(onResult) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState(""); // lo que va entendiendo, para mostrarlo en vivo
  const [error, setError] = useState(null);
  const takeRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => () => takeRef.current?.cancel(), []);

  const start = useCallback(() => {
    unlockAudio();
    if (!Recognition) {
      setError("Este navegador no permite dictar. Escríbele a Alma o usa Chrome/Safari actualizado.");
      return false;
    }
    stop();
    takeRef.current?.cancel();

    // Una toma puede usar varios reconocimientos: el navegador los corta solo tras un silencio
    // y aquí se vuelven a abrir, sumando lo que ya se dijo.
    const take = { on: true, done: false, said: "", current: "", rec: null, openedAt: 0, fails: 0, silence: 0 };
    const text = () => `${take.said} ${take.current}`.replace(/\s+/g, " ").trim();

    const end = (deliver) => {
      if (take.done) return;
      take.done = true;
      take.on = false;
      clearTimeout(take.silence);
      take.rec?.abort();
      if (activeTake === take) activeTake = null;
      if (takeRef.current === take) takeRef.current = null;
      setListening(false);
      setPartial("");
      const heard = text();
      if (deliver && heard && !isEcho(heard)) cbRef.current?.(heard);
    };

    const quiet = () => {
      clearTimeout(take.silence);
      take.silence = setTimeout(() => take.finish(), SILENCE_LIMIT_MS);
    };

    const open = () => {
      const rec = new Recognition();
      rec.lang = "es-CL";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = () => setError(null);
      rec.onresult = (e) => {
        take.current = Array.from(e.results, (r) => r[0].transcript).join(" ");
        setPartial(text());
        quiet();
      };
      rec.onerror = (e) => {
        if (e.error !== "not-allowed" && e.error !== "service-not-allowed") return; // onend decide si reabrir
        // Sin permiso al partir: avisar. Si ya venía escuchando, se entrega lo que alcanzó a oír.
        if (!text()) setError("Necesito permiso para usar el micrófono.");
        end(true);
      };
      rec.onend = () => {
        if (take.rec !== rec || take.done) return;
        take.said = text();
        take.current = "";
        if (!take.on) return end(true);
        take.fails = Date.now() - take.openedAt < QUICK_END_MS ? take.fails + 1 : 0;
        if (take.fails >= 3) {
          if (!text()) setError("No te escuché bien. ¿Me lo repites?");
          return end(true);
        }
        open();
      };
      take.rec = rec;
      take.openedAt = Date.now();
      try {
        rec.start();
      } catch {
        end(true);
      }
    };

    take.finish = () => {
      if (!take.on) return;
      take.on = false;
      take.rec?.stop(); // el navegador cierra la última frase y llama a onend
      setTimeout(() => end(true), FINISH_WAIT_MS); // por si se demora
    };
    take.cancel = () => end(false);

    takeRef.current = take;
    activeTake = take;
    setError(null);
    setPartial("");
    setListening(true);
    quiet();
    open();
    return true;
  }, []);

  const finish = useCallback(() => takeRef.current?.finish(), []);
  const toggle = useCallback(() => (takeRef.current ? finish() : start()), [start, finish]);
  return { listening, partial, error, start, stop: finish, toggle, supported: canListen };
}
