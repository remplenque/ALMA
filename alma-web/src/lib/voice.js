// Voz de Alma: habla con voz natural (servicio /api/tts) y, si no está
// configurado, con la mejor voz femenina en español del dispositivo.
// Expone el nivel de la voz cuadro a cuadro para mover la boca del isotipo.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { normalize } from "./format.js";

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

/* ---------- texto hablado: números y unidades como los diría una persona ---------- */

export function speakable(text) {
  return text
    .replace(/\$\s?([\d.]+)/g, (_, n) => `${n.replace(/\./g, "")} pesos`)
    .replace(/(\d),(\d)/g, "$1 coma $2")
    .replace(/(\d)\s?kg\b/g, "$1 kilos")
    .replace(/\b1 kilos\b/g, "1 kilo")
    .replace(/(\d)\s?u\b/g, "$1 unidades")
    .replace(/\bc\/u\b/g, "cada uno")
    .replace(/[“”"]/g, "")
    .replace(/—/g, ", ");
}

/* ---------- motores de voz ---------- */

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
    u.rate = 1.02;
    u.pitch = 1.08;
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

async function speakWithCloud(text, id) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: speakable(text) }),
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 501) cloudAvailable = false;
    throw new Error(`tts ${res.status}`);
  }
  const blob = await res.blob();
  if (snapshot.id !== id) return;
  ensureAudio();
  await audioCtx?.resume?.();
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
let activeRec = null; // reconocimiento en curso (para cortarlo cuando Alma habla)
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

let voiceOn = true;
export function setVoiceEnabled(on) {
  voiceOn = on;
  if (!on) stop();
}

export function stop() {
  if (snapshot.speaking) noteSpoken(snapshot.text, false);
  stopLoop();
  if (canSynth) window.speechSynthesis.cancel();
  if (audioEl) audioEl.pause();
  setSnapshot({ speaking: false });
}

// Alma dice algo: se muestra en su globo de diálogo y, si la voz está activa, suena.
// source indica qué cara de Alma habla (inicio, notificación, caja…) para que solo esa mueva la boca.
export async function say(text, { mood = "smile", silent = false, source = "any" } = {}) {
  stop();
  // Mientras Alma habla el micrófono no escucha: si no, tomaría su voz como si fuera del dueño.
  activeRec?.abort();
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

export function useListener(onResult) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  useEffect(() => () => recRef.current?.abort(), []);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    unlockAudio();
    if (!Recognition) {
      setError("Este navegador no permite dictar. Escríbele a Alma o usa Chrome/Safari actualizado.");
      return false;
    }
    stop();
    recRef.current?.abort();
    const rec = new Recognition();
    rec.lang = "es-CL";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      setError(null);
      setListening(true);
    };
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      rec.abort(); // soltar el micrófono al tiro: no seguir escuchando mientras ella responde
      if (isEcho(transcript)) return;
      cbRef.current?.(transcript);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Necesito permiso para usar el micrófono.");
      else if (e.error !== "aborted" && e.error !== "no-speech") setError("No te escuché bien. ¿Me lo repites?");
    };
    rec.onend = () => {
      setListening(false);
      if (activeRec === rec) activeRec = null;
    };
    recRef.current = rec;
    activeRec = rec;
    try {
      rec.start();
      return true;
    } catch {
      setListening(false);
      return false;
    }
  }, []);

  const toggle = useCallback(() => (listening ? stopListening() : start()), [listening, start, stopListening]);
  return { listening, error, start, stop: stopListening, toggle, supported: canListen };
}
