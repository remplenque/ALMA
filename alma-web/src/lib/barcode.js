// Códigos de barras: lectura con la cámara y con lectores USB/Bluetooth.
// En Chrome/Android se usa el detector nativo del navegador; en Safari (iPad) no existe,
// así que se carga ZXing (wasm) desde el propio sitio, sin depender de ningún CDN.

import { useEffect, useRef } from "react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];
const WASM_PATH = "/zxing/zxing_reader.wasm";

/* ---------- códigos ---------- */

// Deja solo los dígitos; un UPC-A (12) es un EAN-13 con cero adelante, así que todo se compara en 13.
export function canonical(code) {
  const raw = String(code ?? "").trim();
  if (/^\d{12}$/.test(raw)) return `0${raw}`;
  return raw;
}

function checkDigit(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[digits.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

// ¿Es un EAN-8/UPC-A/EAN-13 con dígito verificador correcto? Sirve para validar lo que se escribe a mano.
export function isValidEan(code) {
  const c = String(code ?? "").trim();
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(c)) return false;
  return checkDigit(c.slice(0, -1)) === Number(c.at(-1));
}

export function sameCode(a, b) {
  return Boolean(a) && Boolean(b) && canonical(a) === canonical(b);
}

export function findByBarcode(products, code) {
  return products.find((p) => sameCode(p.barcode, code)) || null;
}

/* ---------- detector ---------- */

let detectorPromise = null;

// Devuelve { kind: "nativo" | "wasm", detect(video) -> Promise<string | null> }.
export function loadBarcodeDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      let Detector = null;
      let kind = "nativo";
      if (typeof globalThis.BarcodeDetector === "function") {
        try {
          const supported = await globalThis.BarcodeDetector.getSupportedFormats();
          if (supported.includes("ean_13")) Detector = globalThis.BarcodeDetector;
        } catch {
          /* se prueba con el wasm */
        }
      }
      if (!Detector) {
        const mod = await import("barcode-detector/ponyfill");
        mod.prepareZXingModule({
          overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? WASM_PATH : prefix + path) },
        });
        Detector = mod.BarcodeDetector;
        kind = "wasm";
      }
      const detector = new Detector({ formats: FORMATS });
      return {
        kind,
        async detect(source) {
          const found = await detector.detect(source);
          const hit = found.find((f) => f.rawValue);
          return hit ? hit.rawValue.trim() : null;
        },
      };
    })().catch((e) => {
      detectorPromise = null;
      throw e;
    });
  }
  return detectorPromise;
}

/* ---------- lector USB / Bluetooth ---------- */

// Un lector "teclea" el código muy rápido y termina con Enter. A mano es imposible escribir así de rápido.
export const WEDGE_MIN_LENGTH = 8;
const WEDGE_MAX_GAP_MS = 60;

export function useWedgeScanner(onCode, enabled = true) {
  const handler = useRef(onCode);
  handler.current = onCode;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let lastAt = 0;
    let fast = true;

    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (e.key === "Enter") {
        const code = buffer;
        const ok = code.length >= WEDGE_MIN_LENGTH && fast;
        buffer = "";
        if (!ok) return;
        e.preventDefault();
        e.stopPropagation();
        handler.current(code);
        return;
      }
      if (e.key.length !== 1) return;
      if (buffer && now - lastAt > WEDGE_MAX_GAP_MS) {
        buffer = "";
        fast = true;
      }
      if (buffer) fast = fast && now - lastAt <= WEDGE_MAX_GAP_MS;
      buffer += e.key;
      lastAt = now;
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
