import { useEffect, useRef } from "react";
import { FACE_SIZE, LOWER_LIP, UPPER_LIP } from "../data/lips.js";
import { getLevel, useSpeech } from "../lib/voice.js";

// Isotipo vivo: la cara HD de Alma mueve la boca al ritmo de su voz.
// Los gestos con ojos distintos (guiño, sorpresa, pena) usan las ilustraciones del brand book.

const X0 = UPPER_LIP[0][0];
const X1 = UPPER_LIP[UPPER_LIP.length - 1][0];
const SKIN = "#F1F1EF";
const IMAGE_MOODS = new Set(["wink", "surprised", "sad"]);

function bell(x, k = 1.3) {
  return Math.pow(Math.sin((Math.PI * (x - X0)) / (X1 - X0)), k);
}

function poly(top, bottom) {
  const pts = [...top, ...bottom.slice().reverse()];
  return `M${pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join("L")}Z`;
}

function mouth(open) {
  const lift = open * 3;
  const drop = open * 30;
  const upTop = UPPER_LIP.map(([x, t]) => [x, t - lift * bell(x)]);
  const upBot = UPPER_LIP.map(([x, , b]) => [x, b - lift * bell(x)]);
  const cavBot = UPPER_LIP.map(([x, , b]) => [x, b + drop * bell(x, 1.6)]);
  const inner = upBot.filter(([x]) => bell(x) > 0.4);
  const teethH = Math.min(9, drop * 0.4);
  return {
    upper: poly(upTop, upBot),
    cavity: open > 0.03 ? poly(upBot.map(([x, y]) => [x, y - 1]), cavBot) : "",
    teeth: open > 0.25 ? poly(inner, inner.map(([x, y]) => [x, y + teethH * bell(x, 2)])) : "",
    lower: poly(
      LOWER_LIP.map(([x, t]) => [x, t + drop * 0.85 * bell(x, 1.6)]),
      LOWER_LIP.map(([x, , b]) => [x, b + drop * 0.85 * bell(x, 1.6)])
    ),
  };
}

export default function AlmaLive({ mood = "smile", size = 320, listening = false, source = "any", className = "", label = "Alma" }) {
  const speech = useSpeech();
  const speaking = speech.speaking && (source === "any" || speech.source === source);
  const refs = { upper: useRef(null), cavity: useRef(null), teeth: useRef(null), lower: useRef(null) };
  const svgRef = useRef(null);

  const staticOpen = mood === "happy" ? 0.5 : 0;
  const useImage = !speaking && !listening && IMAGE_MOODS.has(mood);
  const overlay = speaking || staticOpen > 0;

  function draw(open) {
    const m = mouth(open);
    for (const k of Object.keys(refs)) refs[k].current?.setAttribute("d", m[k]);
  }

  useEffect(() => {
    if (!speaking) {
      draw(staticOpen);
      return;
    }
    let raf;
    const tick = () => {
      draw(getLevel());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speaking, staticOpen]);

  return (
    <div
      className={`alma-live ${speaking ? "is-speaking" : ""} ${listening ? "is-listening" : ""} ${className}`}
      style={{ width: size }}
      role="img"
      aria-label={speaking ? `${label} está hablando` : label}
    >
      <img src={useImage ? `/brand/faces/${mood}.webp` : "/brand/faces/alma-hd.webp"} alt="" width={FACE_SIZE.w} height={FACE_SIZE.h} draggable="false" />
      <svg ref={svgRef} className="alma-mouth" viewBox={`0 0 ${FACE_SIZE.w} ${FACE_SIZE.h}`} style={{ opacity: overlay && !useImage ? 1 : 0 }} aria-hidden="true">
        <ellipse cx="305" cy="533" rx="106" ry="47" fill={SKIN} />
        <path ref={refs.cavity} fill="#111" />
        <path ref={refs.teeth} fill="#fff" />
        <path ref={refs.upper} fill="#111" />
        <path ref={refs.lower} fill="#111" />
      </svg>
    </div>
  );
}
