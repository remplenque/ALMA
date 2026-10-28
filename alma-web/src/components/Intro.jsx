import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "../lib/voice.js";

// Intro al abrir la página: el logo de Alma animado, como en la campaña. Al tocarlo se entra a hablar con ella.
// La cara va cambiando de gesto dentro de la M; todas se cargan juntas para que el cambio no parpadee.
const FACES = ["alma-hd", "wink", "alma-hd", "surprised", "smile", "happy"];
const FIRST_MS = 1500; // la cara se queda quieta mientras entra el logo
const STEP_MS = 650;
const EXIT_MS = 550;

export default function Intro({ onDone }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    let loop;
    const first = setTimeout(() => {
      setStep(1);
      loop = setInterval(() => setStep((s) => s + 1), STEP_MS);
    }, FIRST_MS);
    return () => {
      clearTimeout(first);
      clearInterval(loop);
    };
  }, []);

  function enter() {
    if (leaving) return;
    // El toque también habilita el audio en iPad: Alma puede hablar apenas se entra.
    unlockAudio();
    setLeaving(true);
    setTimeout(onDone, EXIT_MS);
  }

  const face = leaving ? "happy" : FACES[step % FACES.length];

  return (
    <button ref={ref} className={`intro ${leaving ? "is-leaving" : ""}`} onClick={enter} aria-label="Alma. Toca para empezar">
      <span className="intro-logo">
        <img className="intro-word" src="/brand/wordmark.webp" alt="" width="900" height="539" draggable="false" />
        <span className="intro-face">
          {[...new Set(FACES)].map((f) => (
            <img key={f} src={`/brand/faces/${f}.webp`} alt="" className={f === face ? "is-on" : ""} draggable="false" />
          ))}
        </span>
      </span>
      <span className="intro-hint display">Toca para empezar</span>
    </button>
  );
}
