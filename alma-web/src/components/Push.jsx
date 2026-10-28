import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { X } from "@phosphor-icons/react";
import AlmaLive from "./AlmaLive.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { dayStats, priceSuggestions, suggestedOrder, vecinoBalance } from "../lib/metrics.js";
import { clp, qtyLabel } from "../lib/format.js";
import { isBusy, say, stop, useSpeech } from "../lib/voice.js";

// Notificaciones push simuladas. En la demo salen solo al tocar "Simular notificaciones",
// así nunca interrumpen mientras se le habla a Alma. Cada toque muestra el aviso siguiente.
const SHOW_DELAY = 450; // deja que se cierre el menú antes de aparecer
const BUSY_RETRY = 1200; // si Alma está escuchando o hablando, el aviso espera su turno

function buildPushes(state) {
  const pushes = [];

  // Lo que se está acabando: primero el pan, que es lo que más se nota.
  const low = state.products
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => (b.id === "p2") - (a.id === "p2") || a.stock - a.minStock - (b.stock - b.minStock))[0];
  if (low) {
    const qty = low.id === "p2" ? Math.max(20, suggestedOrder(low)) : suggestedOrder(low);
    const left = qtyLabel(low.stock, low.unit);
    const order = qtyLabel(qty, low.unit);
    pushes.push({
      id: "stock",
      mood: "surprised",
      title: low.id === "p2" ? "Se está acabando el pan" : `Se está acabando: ${low.name}`,
      body: low.id === "p2" ? `Quedan ${left} de ${low.name} y viene la hora de la once. ¿Te encargo ${order} al proveedor?` : `Quedan ${left}. ¿Te encargo ${order} al proveedor?`,
      speech:
        low.id === "p2"
          ? `Oye, se nos está acabando la hallulla: quedan solo ${left} y ya viene la once. ¿Te encargo ${order} al tiro?`
          : `Oye, se está acabando ${low.name}: quedan solo ${left}. ¿Te encargo ${order} al tiro?`,
      primary: { label: `Encargar ${order}`, run: (a) => a.restock(low.id, qty), done: `Listo, encargué ${order} de ${low.name}.` },
    });
  }

  // Un precio que conviene subir: primero el arroz Banquete.
  const tips = priceSuggestions(state.products, state.dismissed.suggestions).filter((s) => s.kind === "subir");
  const tip = tips.find((s) => s.id === "p13") || tips[0];
  if (tip) {
    const arroz = tip.id === "p13";
    const sold = dayStats(state.sales).topProducts.find((p) => p.id === tip.id)?.qty || 0;
    pushes.push({
      id: "precio",
      mood: "wink",
      title: arroz ? "El Arroz Banquete se vende harto" : `Conviene subir ${tip.name}`,
      body: arroz
        ? `${sold ? `Llevas ${sold} vendidos hoy, más que de costumbre. ` : ""}Súbelo a ${clp(tip.suggested)}: sigue más barato que en el súper y ganas ${clp(tip.suggested - tip.current)} más por bolsa.`
        : `${sold ? `Llevas ${sold} vendidos hoy. ` : ""}Súbelo a ${clp(tip.suggested)}: sigue conveniente y ganas ${clp(tip.suggested - tip.current)} más por cada uno.`,
      speech: arroz
        ? `Te cuento algo: el arroz Banquete se está vendiendo como pan caliente. Si lo subes a ${clp(tip.suggested)}, sigue conveniente para los vecinos y tú ganas un poquito más por cada bolsa.`
        : `Te cuento algo: si subes ${tip.name} a ${clp(tip.suggested)}, sigue conveniente para los vecinos y tú ganas un poquito más por cada uno.`,
      primary: {
        label: `Subir a ${clp(tip.suggested)}`,
        run: (a) => {
          a.updateProduct(tip.id, { price: tip.suggested });
          a.dismissSuggestion(tip.id);
        },
        done: `${tip.name} ahora a ${clp(tip.suggested)}.`,
      },
    });
  }

  // El fiado más grande: así el botón siempre tiene algo que mostrar, aunque ya se haya encargado y subido todo.
  const debt = state.vecinos
    .map((v) => ({ v, bal: vecinoBalance(v) }))
    .filter((d) => d.bal > 0)
    .sort((a, b) => b.bal - a.bal)[0];
  if (debt) {
    pushes.push({
      id: "fiado",
      mood: "smile",
      title: `${debt.v.name} te debe ${clp(debt.bal)}`,
      body: "Lleva un tiempo en el cuaderno. ¿Le mandamos un recordatorio amable por WhatsApp?",
      speech: `Te recuerdo que ${debt.v.name} te debe ${clp(debt.bal)}. Si quieres, le mandamos un recordatorio por WhatsApp, con cariño.`,
      primary: { label: "Ver el cuaderno", run: (a, go) => go("/fiados") },
    });
  }

  return pushes;
}

export default function Push() {
  const { state, actions } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const speech = useSpeech();
  const [current, setCurrent] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const shown = useRef([]); // avisos ya mostrados en esta vuelta
  const count = useRef(0);
  const timer = useRef(null);

  // "Simular notificaciones" desde el menú de funciones.
  useEffect(() => {
    const show = () => {
      if (isBusy("push")) {
        timer.current = setTimeout(show, BUSY_RETRY);
        return;
      }
      const all = buildPushes(stateRef.current);
      let next = all.find((p) => !shown.current.includes(p.id));
      if (!next) {
        shown.current = [];
        next = all[0];
      }
      if (!next) return;
      shown.current.push(next.id);
      setCurrent({ ...next, n: ++count.current });
      say(next.speech, { mood: next.mood, source: "push" });
    };
    const demo = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(show, SHOW_DELAY);
    };
    window.addEventListener("alma:demo-push", demo);
    return () => {
      window.removeEventListener("alma:demo-push", demo);
      clearTimeout(timer.current);
    };
  }, []);

  if (!current) return null;

  function close() {
    if (speech.speaking && speech.source === "push") stop();
    setCurrent(null);
  }

  return (
    <div className="push-wrap" role="region" aria-label="Aviso de Alma">
      <article className="push" key={current.n}>
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
                current.primary.run(actions, navigate);
                if (current.primary.done) toast(current.primary.done, "happy");
                close();
              }}
            >
              {current.primary.label}
            </button>
            <button className="btn btn-sm btn-quiet-light" onClick={close}>
              Más tarde
            </button>
          </div>
        </div>
        <button className="push-x" onClick={close} aria-label="Cerrar aviso">
          <X size={18} weight="bold" />
        </button>
      </article>
    </div>
  );
}
