import { useEffect, useRef, useState } from "react";
import { Camera, GraduationCap, Trash } from "@phosphor-icons/react";
import Modal from "./Modal.jsx";
import AlmaLive from "./AlmaLive.jsx";
import { BrandIcon, productIcon } from "./Brand.jsx";
import { useStore } from "../lib/store.jsx";
import { clp } from "../lib/format.js";
import { say } from "../lib/voice.js";
import { BACKGROUND, classify, embed, listCameras, loadEmbedder, loadSamples, openCamera, saveSamples, stopStream } from "../lib/vision.js";

const DEFAULT_TEACH = ["p13", "p1", "p22"]; // Arroz Banquete, Coca-Cola, Galletas
const MIN_SAMPLES = 8;
const STABLE_FRAMES = 4;
const CAMERA_KEY = "alma:camera";

function readCamera() {
  try {
    return localStorage.getItem(CAMERA_KEY) || "";
  } catch {
    return "";
  }
}

export default function CameraScanner({ open, onClose }) {
  const { state, actions } = useStore();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const embedderRef = useRef(null);
  const samplesRef = useRef(loadSamples());
  const loopRef = useRef(0);
  const holdRef = useRef(null);
  const streakRef = useRef({ label: null, n: 0, locked: null, emptyFrames: 0 });

  const [mode, setMode] = useState("scan"); // scan | teach
  const [phase, setPhase] = useState("idle"); // idle | starting | ready | error
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState(readCamera);
  const [counts, setCounts] = useState(() => countOf(samplesRef.current));
  const [teachIds, setTeachIds] = useState(() => [...new Set([...DEFAULT_TEACH, ...Object.keys(samplesRef.current).filter((k) => k !== BACKGROUND)])]);
  const [seeing, setSeeing] = useState(null);
  const [last, setLast] = useState(null);

  function countOf(samples) {
    return Object.fromEntries(Object.entries(samples).map(([k, v]) => [k, v.length]));
  }

  const trained = (counts[BACKGROUND] || 0) >= MIN_SAMPLES && teachIds.filter((id) => (counts[id] || 0) >= MIN_SAMPLES).length >= 1;
  const product = (id) => state.products.find((p) => p.id === id);

  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setLast(null), 2600);
    return () => clearTimeout(t);
  }, [last]);

  // Abrir cámara y modelo al mostrar el escáner.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("starting");
    setError("");
    setMode(trained ? "scan" : "teach");
    (async () => {
      try {
        const [stream, embedder] = await Promise.all([openCamera(cameraId), loadEmbedder()]);
        if (cancelled) return stopStream(stream);
        streamRef.current = stream;
        embedderRef.current = embedder;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        setCameras(await listCameras());
        setPhase("ready");
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e?.name === "NotAllowedError" ? "Necesito permiso para usar la cámara." : e?.message || "No pude abrir la cámara.");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(loopRef.current);
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, [open, cameraId]);

  // Bucle de reconocimiento (~6 cuadros por segundo).
  useEffect(() => {
    if (!open || phase !== "ready" || mode !== "scan" || !trained) return;
    let lastRun = 0;
    const tick = (now) => {
      loopRef.current = requestAnimationFrame(tick);
      if (now - lastRun < 160) return;
      lastRun = now;
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      const res = classify(embed(embedderRef.current, v), samplesRef.current);
      const st = streakRef.current;
      const sure = res && res.label !== BACKGROUND && res.confidence >= 0.8 && res.similarity >= 0.6;
      if (!sure) {
        st.emptyFrames += 1;
        st.n = 0;
        st.label = null;
        if (st.emptyFrames >= 5) st.locked = null; // el producto salió del cuadro
        setSeeing(null);
        return;
      }
      st.emptyFrames = 0;
      st.n = st.label === res.label ? st.n + 1 : 1;
      st.label = res.label;
      setSeeing({ id: res.label, confidence: res.confidence });
      if (st.n >= STABLE_FRAMES && st.locked !== res.label) {
        st.locked = res.label;
        const p = product(res.label);
        if (!p) return;
        const got = actions.addToCart(p.id, 1);
        setLast({ p, ok: got > 0, at: Date.now() });
        say(got > 0 ? `${p.name}, anotado.` : `No me queda stock de ${p.name}.`, { mood: got > 0 ? "happy" : "sad", source: "scan" });
      }
    };
    loopRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(loopRef.current);
  }, [open, phase, mode, trained]);

  function capture(label) {
    const v = videoRef.current;
    if (!embedderRef.current || !v || v.readyState < 2) return;
    const vec = embed(embedderRef.current, v);
    const s = samplesRef.current;
    s[label] = [...(s[label] || []), vec].slice(-40);
    setCounts(countOf(s));
  }

  // Mantener apretado = varias fotos seguidas, moviendo el producto.
  function startHold(label) {
    capture(label);
    holdRef.current = setInterval(() => capture(label), 180);
  }
  function endHold() {
    if (!holdRef.current) return;
    clearInterval(holdRef.current);
    holdRef.current = null;
    saveSamples(samplesRef.current);
  }

  function forget(label) {
    delete samplesRef.current[label];
    saveSamples(samplesRef.current);
    setCounts(countOf(samplesRef.current));
  }

  function simulate() {
    const candidates = state.products.filter((p) => DEFAULT_TEACH.includes(p.id) && actions.available(p.id) > 0);
    const p = candidates[Math.floor(Math.random() * candidates.length)];
    if (!p) return;
    actions.addToCart(p.id, 1);
    setLast({ p, ok: true, at: Date.now() });
    say(`${p.name}, anotado.`, { mood: "happy", source: "scan" });
  }

  const teachRows = [{ id: BACKGROUND, name: "Mostrador vacío", hint: "Sin productos: así Alma sabe cuándo no hay nada" }, ...teachIds.map((id) => ({ id, name: product(id)?.name || id }))];
  const addable = state.products.filter((p) => !teachIds.includes(p.id));

  return (
    <Modal open={open} onClose={onClose} title={mode === "scan" ? "Escanear con la cámara" : "Enséñale tus productos"} kicker={mode === "scan" ? "Muéstrale el producto a Alma" : "Una vez, y Alma los reconoce solita"} size="lg">
      <div className="scanner-layout">
        <div className={`cam ${phase}`}>
          <video ref={videoRef} playsInline muted />
          {phase === "starting" && <p className="cam-msg">Abriendo la cámara…</p>}
          {phase === "error" && (
            <div className="cam-msg">
              <p>{error}</p>
              <button className="btn btn-pink" onClick={simulate}>
                Simular escaneo
              </button>
            </div>
          )}
          {phase === "ready" && mode === "scan" && <span className="cam-frame" aria-hidden="true" />}
          {phase === "ready" && mode === "scan" && seeing && product(seeing.id) && (
            <span className="cam-label">
              Veo: {product(seeing.id).name} · {Math.round(seeing.confidence * 100)}%
            </span>
          )}
          {last && (
            <div className={`cam-found ${last.ok ? "" : "is-out"}`} key={last.at}>
              <BrandIcon name={productIcon(last.p)} size={56} />
              <div>
                <strong>{last.p.name}</strong>
                <span>{last.ok ? `${clp(last.p.price)} · anotado en la boleta` : "Sin stock"}</span>
              </div>
            </div>
          )}
        </div>

        <aside className="scanner-side">
          <div className="scan-alma">
            <AlmaLive mood={last ? (last.ok ? "happy" : "sad") : "smile"} size={64} source="scan" />
            <p>{phase === "starting" ? "Abriendo los ojos…" : seeing && product(seeing.id) ? `Mmm… ¿${product(seeing.id).name}?` : mode === "teach" ? "Muéstrame cada producto" : "Te miro, muéstrame algo"}</p>
          </div>
          <div className="segmented segmented-sm" role="tablist">
            <button role="tab" aria-selected={mode === "scan"} className={mode === "scan" ? "is-on" : ""} onClick={() => setMode("scan")}>
              <Camera size={18} weight="bold" /> Escanear
            </button>
            <button role="tab" aria-selected={mode === "teach"} className={mode === "teach" ? "is-on" : ""} onClick={() => setMode("teach")}>
              <GraduationCap size={18} weight="bold" /> Enseñar
            </button>
          </div>

          {mode === "scan" ? (
            <div className="scan-help">
              {trained ? (
                <>
                  <p>Pon el producto frente a la cámara, quieto un segundo. Cuando lo reconozca, lo anoto en la boleta.</p>
                  <p className="muted small">Para anotar otro igual, sácalo del cuadro y vuelve a mostrarlo.</p>
                </>
              ) : (
                <>
                  <p>Todavía no conozco tus productos. Enséñame una vez y después los reconozco al tiro.</p>
                  <button className="btn btn-pink btn-block" onClick={() => setMode("teach")}>
                    Enseñarle a Alma
                  </button>
                </>
              )}
              <button className="btn btn-sm btn-quiet" onClick={simulate}>
                Simular escaneo (sin cámara)
              </button>
            </div>
          ) : (
            <div className="teach">
              <p className="small">
                Mantén apretado el botón mientras giras el producto frente a la cámara. Con <b>{MIN_SAMPLES} fotos</b> o más ya aprende.
              </p>
              <ul className="teach-list">
                {teachRows.map((r) => {
                  const n = counts[r.id] || 0;
                  return (
                    <li key={r.id} className={n >= MIN_SAMPLES ? "is-ok" : ""}>
                      <div className="teach-name">
                        <strong>{r.name}</strong>
                        <span>{r.hint || `${n} foto${n === 1 ? "" : "s"}`}</span>
                        {r.hint && <span>{`${n} foto${n === 1 ? "" : "s"}`}</span>}
                      </div>
                      <button
                        className="btn btn-sm btn-ink teach-hold"
                        disabled={phase !== "ready"}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture?.(e.pointerId);
                          startHold(r.id);
                        }}
                        onPointerUp={endHold}
                        onPointerCancel={endHold}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        Mantén
                      </button>
                      {n > 0 && (
                        <button className="icon-btn icon-btn-sm" onClick={() => forget(r.id)} aria-label={`Borrar fotos de ${r.name}`}>
                          <Trash size={16} weight="bold" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {addable.length > 0 && (
                <select className="input input-sm" value="" onChange={(e) => e.target.value && setTeachIds((ids) => [...ids, e.target.value])} aria-label="Enseñar otro producto">
                  <option value="">+ Enseñar otro producto…</option>
                  {addable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn btn-pink btn-block" disabled={!trained} onClick={() => setMode("scan")}>
                {trained ? "¡Listo, a escanear!" : "Falta: mostrador vacío + 1 producto"}
              </button>
            </div>
          )}

          {cameras.length > 1 && (
            <label className="field">
              <span className="field-label">Cámara</span>
              <select
                className="input input-sm"
                value={cameraId}
                onChange={(e) => {
                  setCameraId(e.target.value);
                  try {
                    localStorage.setItem(CAMERA_KEY, e.target.value);
                  } catch {
                    /* sin almacenamiento */
                  }
                }}
              >
                <option value="">Automática</option>
                {cameras.map((c, i) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || `Cámara ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </aside>
      </div>
    </Modal>
  );
}
