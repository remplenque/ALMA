import { useEffect, useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import BarcodeCapture from "./BarcodeCapture.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { canonical, isValidEan, sameCode } from "../lib/barcode.js";
import { lookupBarcode } from "../lib/lookup.js";

// Campo del código de barras: se escribe, se lee con una pistola USB o con la cámara.
// Con `lookup`, además busca el producto en la base pública y avisa con `onFound` para llenar el formulario.
export default function BarcodeField({ value, onChange, ownId, lookup = false, onFound, label = "Código de barras (opcional)" }) {
  const { state } = useStore();
  const toast = useToast();
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState({ phase: "idle", info: null }); // idle | loading | found | none | offline
  const looked = useRef("");
  const code = canonical(value);
  const owner = code ? state.products.find((p) => p.id !== ownId && sameCode(p.barcode, code)) : null;
  const odd = code && /^\d+$/.test(code) && !isValidEan(code);

  useEffect(() => {
    if (!code) {
      looked.current = "";
      setStatus({ phase: "idle", info: null });
    }
  }, [code]);

  async function run(raw) {
    const c = canonical(raw);
    if (!lookup || !/^\d{8,14}$/.test(c) || looked.current === c) return;
    looked.current = c;
    const mine = state.products.find((p) => p.id !== ownId && sameCode(p.barcode, c));
    if (mine) return toast(`Ya tienes este producto: ${mine.name}.`, "surprised");
    setStatus({ phase: "loading", info: null });
    try {
      const info = await lookupBarcode(c);
      if (looked.current !== c) return;
      if (!info) {
        setStatus({ phase: "none", info: null });
        return toast("No aparece en la base pública: llena los datos a mano.", "sad");
      }
      setStatus({ phase: "found", info });
      toast(`Encontré: ${info.name}`, "happy");
      onFound?.(info);
    } catch {
      if (looked.current !== c) return;
      looked.current = "";
      setStatus({ phase: "offline", info: null });
      toast("No pude consultar la base de productos. ¿Hay internet?", "sad");
    }
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="barcode-field">
        <input
          className="input"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\dA-Za-z-]/g, ""))}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault(); // un lector USB termina con Enter: no debe enviar el formulario
            run(value);
          }}
          onBlur={() => run(value)}
          placeholder="Escríbelo, o léelo con la pistola o la cámara"
        />
        <button type="button" className="btn btn-ink" onClick={() => setCapturing(true)} aria-label="Leer con la cámara">
          <Camera size={20} weight="bold" />
        </button>
      </span>
      {status.phase === "loading" && <small className="muted">Buscando este código…</small>}
      {status.phase === "found" && status.info && (
        <span className="barcode-found">
          {status.info.image && <img src={status.info.image} alt="" width="48" height="48" />}
          <span>
            <strong>{status.info.name}</strong>
            <span>Datos de {status.info.source}: revisa el nombre y pon tu precio.</span>
          </span>
        </span>
      )}
      {status.phase === "none" && <small className="muted">No aparece en la base pública (las marcas chilenas a veces faltan): llena los datos a mano.</small>}
      {status.phase === "offline" && <small className="muted">No pude consultar la base de productos. Llena los datos a mano.</small>}
      {owner && <small className="muted">Lo tiene {owner.name}: si guardas, se lo quito a ese producto.</small>}
      {!owner && odd && <small className="muted">Ese número no parece un código válido: revisa que esté completo.</small>}
      <BarcodeCapture
        open={capturing}
        onClose={() => setCapturing(false)}
        onCode={(c) => {
          onChange(c);
          run(c);
        }}
      />
    </label>
  );
}
