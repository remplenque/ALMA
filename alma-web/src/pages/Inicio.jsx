import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Keyboard, Microphone, MicrophoneSlash, PaperPlaneRight, SquaresFour, X } from "@phosphor-icons/react";
import AlmaLive from "../components/AlmaLive.jsx";
import { BrandIcon } from "../components/Brand.jsx";
import { useStore } from "../lib/store.jsx";
import { SUGGESTED_QUESTIONS, answer, buildContext, welcome } from "../lib/alma.js";
import { askAlma } from "../lib/agent.js";
import { say, stop, unlockAudio, useListener, useSpeech } from "../lib/voice.js";
import { STORE } from "../data/seed.js";

export const FUNCTIONS = [
  { to: "/vender", icon: "register", title: "Vender", text: "Cobrar, escanear y dictar pedidos" },
  { to: "/inventario", icon: "basket", title: "Inventario", text: "Stock, encargos y precios" },
  { to: "/fiados", icon: "notebook", title: "Fiados", text: "El cuaderno de los vecinos" },
  { to: "/hoy", icon: "house", title: "Resumen de hoy", text: "Cómo va el día, de un vistazo" },
  { to: "/inventario#consejos", icon: "bulb", title: "Consejos", text: "Precios que conviene ajustar" },
  { to: "/cierre", icon: "closed", title: "Cierre del día", text: "Cuadrar la caja y ver el balance" },
];

export function FunctionsSheet({ open, onClose }) {
  const { state, actions } = useStore();
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Funciones de Alma" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <h2 className="display">¿Qué hacemos?</h2>
            <p className="kicker">Todo lo de tu almacén, a un toque</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={24} weight="bold" />
          </button>
        </header>
        <div className="fn-grid">
          {FUNCTIONS.map((f) => (
            <Link key={f.title} to={f.to} className="fn-tile" onClick={onClose}>
              <BrandIcon name={f.icon} size={72} />
              <strong className="display">{f.title}</strong>
              <span>{f.text}</span>
            </Link>
          ))}
        </div>
        <footer className="sheet-foot">
          <span className="muted small">Opciones de la demo</span>
          <button className="btn btn-sm btn-paper" onClick={() => window.dispatchEvent(new Event("alma:demo-push"))}>
            Simular notificaciones
          </button>
          <button className="btn btn-sm btn-paper" onClick={actions.toggleVoice}>
            Voz: {state.voice ? "activada" : "en silencio"}
          </button>
          <button className="btn btn-sm btn-quiet" onClick={actions.resetDemo}>
            Reiniciar datos
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function Inicio() {
  const { state, actions, lastWeek, avgDay } = useStore();
  const navigate = useNavigate();
  const ctx = useMemo(() => buildContext({ state, lastWeek }), [state, lastWeek]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const speech = useSpeech();

  const [bubble, setBubble] = useState(() => ({ text: welcome(ctx, STORE.owner), mood: "smile", link: null }));
  const [heard, setHeard] = useState("");
  const [thinking, setThinking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [sheet, setSheet] = useState(false);

  useEffect(() => stop, []);

  // Conversación con el agente (Haiku 5.5 vía OpenRouter). Si no responde, usa el cerebro local.
  const history = useRef([]);
  const busy = useRef(false);

  async function reply(raw) {
    const q = raw.trim();
    if (!q || busy.current) return;
    busy.current = true;
    setHeard(q);
    setText("");
    setThinking(true);

    let res = null;
    try {
      res = await askAlma(q, history.current, { getState: actions.getState, actions, lastWeek, avgDay });
    } catch (e) {
      console.warn("Alma: chat no disponible, uso el cerebro local.", e.message);
    }
    if (!res) {
      await new Promise((r) => setTimeout(r, 450));
      res = answer(q, ctxRef.current);
      if (res.order) res.order.forEach(({ product, qty }) => actions.addToCart(product.id, qty));
    }
    history.current = [...history.current, res.turn || [{ role: "user", content: q }, { role: "assistant", content: res.text }]].slice(-4);

    setBubble({ text: res.text, mood: res.mood, link: res.link || null });
    setThinking(false);
    busy.current = false;
    say(res.text, { mood: res.mood, source: "home" });
  }

  const mic = useListener(reply);

  function talk() {
    unlockAudio();
    if (!mic.supported) {
      setTyping(true);
      return;
    }
    mic.toggle();
  }

  const homeSpeaking = speech.speaking && speech.source === "home";
  const mood = mic.listening || thinking ? "neutral" : bubble.mood;
  const status = mic.listening ? "Te escucho…" : thinking ? "Déjame ver tus números…" : homeSpeaking ? "" : "Tócame para hablar";

  return (
    <div className="inicio">
      <div className="inicio-stage">
        <button
          className={`face-btn ${mic.listening ? "is-listening" : ""}`}
          onClick={talk}
          aria-label={mic.listening ? "Dejar de escuchar" : "Hablar con Alma"}
          aria-pressed={mic.listening}
        >
          <span className="face-ring" aria-hidden="true" />
          <AlmaLive mood={mood} size="var(--face-size)" listening={mic.listening} source="home" />
        </button>

        <div className="inicio-talk">
          {heard && (
            <p className="heard">
              <span>Tú</span> {heard}
            </p>
          )}
          <div className={`speech ${thinking ? "is-thinking" : ""}`} aria-live="polite">
            {thinking ? (
              <span className="typing" aria-label="Alma está pensando">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <>
                <p>{bubble.text}</p>
                {bubble.link && (
                  <button className="link-arrow" onClick={() => navigate(bubble.link.to)}>
                    {bubble.link.label} <ArrowRight size={16} weight="bold" />
                  </button>
                )}
              </>
            )}
            <span className="script speech-sign">—Alma</span>
          </div>
          {status && <p className="talk-status">{status}</p>}
        </div>
      </div>

      <div className="inicio-actions">
        <button className={`btn btn-lg ${mic.listening ? "btn-ink" : "btn-pink"}`} onClick={talk}>
          {mic.listening ? <MicrophoneSlash size={24} weight="bold" /> : <Microphone size={24} weight="bold" />}
          {mic.listening ? "Listo" : "Háblame"}
        </button>
        <button className="btn btn-lg btn-paper" onClick={() => setSheet(true)}>
          <SquaresFour size={24} weight="bold" /> Ver funciones
        </button>
        <button className="icon-btn icon-btn-lg" onClick={() => setTyping((t) => !t)} aria-label="Escribirle a Alma" aria-pressed={typing}>
          <Keyboard size={24} weight="bold" />
        </button>
      </div>

      {mic.error && <p className="talk-error">{mic.error}</p>}

      {typing && (
        <form
          className="inicio-type"
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            reply(text);
          }}
        >
          <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Escríbele a Alma…" aria-label="Mensaje para Alma" />
          <button type="submit" className="icon-btn icon-btn-ink" disabled={!text.trim()} aria-label="Enviar">
            <PaperPlaneRight size={20} weight="bold" />
          </button>
        </form>
      )}

      <div className="chips inicio-chips" aria-label="Preguntas frecuentes">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            className="chip"
            onClick={() => {
              unlockAudio();
              reply(q);
            }}
            disabled={thinking}
          >
            {q}
          </button>
        ))}
      </div>

      <FunctionsSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
