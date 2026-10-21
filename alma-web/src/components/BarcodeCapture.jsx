import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { loadBarcodeDetector } from "../lib/barcode.js";
import { openCamera, stopStream } from "../lib/vision.js";

// Abre la cámara solo para leer UN código de barras (por ejemplo, al registrar un producto).
export default function BarcodeCapture({ open, onClose, onCode }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState("starting"); // starting | ready | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream = null;
    let timer = 0;
    setPhase("starting");
    setError("");
    (async () => {
      try {
        const [s, detector] = await Promise.all([openCamera(""), loadBarcodeDetector()]);
        stream = s;
        if (cancelled) return stopStream(s);
        const v = videoRef.current;
        v.srcObject = s;
        await v.play();
        setPhase("ready");
        let busy = false;
        timer = setInterval(async () => {
          if (busy || v.readyState < 2) return;
          busy = true;
          try {
            const code = await detector.detect(v);
            if (code && !cancelled) {
              cancelled = true;
              onCode(code);
              onClose();
            }
          } catch {
            /* un cuadro malo no importa */
          } finally {
            busy = false;
          }
        }, 220);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setError(e?.name === "NotAllowedError" ? "Necesito permiso para usar la cámara." : e?.message || "No pude abrir la cámara.");
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      stopStream(stream);
    };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Lee el código de barras" kicker="Acércalo hasta que se vea nítido">
      <div className={`cam ${phase}`}>
        <video ref={videoRef} playsInline muted />
        {phase === "starting" && <p className="cam-msg">Abriendo la cámara…</p>}
        {phase === "error" && <p className="cam-msg">{error}</p>}
        {phase === "ready" && <span className="cam-frame" aria-hidden="true" />}
      </div>
    </Modal>
  );
}
