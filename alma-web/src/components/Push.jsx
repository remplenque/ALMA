import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
import AlmaLive from "./AlmaLive.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { dayStats, priceSuggestions, suggestedOrder } from "../lib/metrics.js";
import { clp, qtyLabel } from "../lib/format.js";
import { say, useSpeech } from "../lib/voice.js";

// Notificaciones push simuladas: Alma toma la iniciativa, de a una y sin bombardear.
const FIRST_DELAY = 7000;
const GAP = 14000;

function buildPushes(state) {
  const pushes = [];
  const pan = state.products.find((p) => p.id === "p2");
  if (pan && pan.stock <= pan.minStock) {
    const qty = Math.max(20, suggestedOrder(pan));
    pushes.push({
      id: "pan",
      icon: "bread",
      mood: "surprised",
      title: "Se está acabando el pan",
      body: `Quedan ${qtyLabel(pan.stock, pan.unit)} de ${pan.name} y viene la hora de la once. ¿Te encargo ${qtyLabel(qty, pan.unit)} al proveedor?`,
      speech: `Oye, se nos está acabando la hallulla: quedan solo ${qtyLabel(pan.stock, pan.unit)} y ya viene la once. ¿Te encargo ${qtyLabel(qty, pan.unit)} al tiro?`,
      primary: { label: `Encargar ${qtyLabel(qty, pan.unit)}`, run: (a) => a.restock(pan.id, qty), done: `Listo, encargué ${qtyLabel(qty, pan.unit)} de ${pan.name}.` },
    });
  }
  const arroz = priceSuggestions(state.products, state.dismissed.suggestions).find((s) => s.id === "p13");
  if (arroz) {
    const sold = dayStats(state.sales).topProducts.find((p) => p.id === "p13")?.qty || 0;
    pushes.push({
      id: "arroz",
      icon: "cans",
      mood: "wink",
      title: "El Arroz Banquete se vende harto",
      body: `${sold ? `Llevas ${sold} vendidos hoy, más que de costumbre. ` : ""}Súbelo a ${clp(arroz.suggested)}: sigue más barato que en el súper y ganas ${clp(arroz.suggested - arroz.current)} más por bolsa.`,
      speech: `Te cuento algo: el arroz Banquete se está vendiendo como pan caliente. Si lo subes a ${clp(arroz.suggested)}, sigue conveniente para los vecinos y tú ganas un poquito más por cada bolsa.`,
      primary: {
        label: `Subir a ${clp(arroz.suggested)}`,
        run: (a) => {
          a.updateProduct("p13", { price: arroz.suggested });
          a.dismissSuggestion("p13");
        },
        done: `Arroz Banquete ahora a ${clp(arroz.suggested)}.`,
      },
    });
  }
  return pushes;
}

export default function Push() {
  const { state, actions } = useStore();
  const toast = useToast();
  const speech = useSpeech();
  const [handled, setHandled] = useState([]);
  const [current, setCurrent] = useState(null);
  const [round, setRound] = useState(0);
  const timer = useRef(null);
  const busyRef = useRef(false);
  busyRef.current = speech.speaking && speech.source !== "push";

  const pending = useMemo(() => (state.dayOpen ? buildPushes(state).filter((p) => !handled.includes(p.id)) : []), [state, handled]);
  const next = pending[0];

  const show = useCallback(
    (p) => {
      // Si Alma está conversando en otra parte, espera a que termine.
      if (busyRef.current) {
        timer.current = setTimeout(() => show(p), 2500);
        return;
      }
      setCurrent(p);
      say(p.speech, { mood: p.mood, source: "push" });
    },
    []
  );

  useEffect(() => {
    if (current || !next) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => show(next), handled.length === 0 ? FIRST_DELAY : GAP);
    return () => clearTimeout(timer.current);
  }, [current, next?.id, handled.length, round, show]);

  // "Simular notificaciones" desde el menú de funciones: vuelve a empezar.
  useEffect(() => {
    const replay = () => {
      setHandled([]);
      setCurrent(null);
      setRound((r) => r + 1);
    };
    window.addEventListener("alma:demo-push", replay);
    return () => window.removeEventListener("alma:demo-push", replay);
  }, []);

  if (!current) return null;

  function close(p) {
    setHandled((h) => [...h, p.id]);
    setCurrent(null);
  }

  return (
    <div className="push-wrap" role="region" aria-label="Aviso de Alma">
      <article className="push" key={current.id}>
        <AlmaLive mood={current.mood} size={64} source="push" />
        <div className="push-body">
          <header>
            <span className="push-app">ALMA</span>
            <span className="push-time">ahora</span>
          </header>
          <strong>{current.title}</strong>
          <p>{current.body}</p>
          <div className="push-actions">
            <button
              className="btn btn-sm btn-pink"
              onClick={() => {
                current.primary.run(actions);
                toast(current.primary.done, "happy");
                close(current);
              }}
            >
              {current.primary.label}
            </button>
            <button className="btn btn-sm btn-quiet-light" onClick={() => close(current)}>
              Más tarde
            </button>
          </div>
        </div>
        <button className="push-x" onClick={() => close(current)} aria-label="Cerrar aviso">
          <X size={18} weight="bold" />
        </button>
      </article>
    </div>
  );
}
