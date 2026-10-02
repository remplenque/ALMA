import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import { List, SpeakerHigh, SpeakerSlash, X } from "@phosphor-icons/react";
import AlmaLive from "./AlmaLive.jsx";
import Push from "./Push.jsx";
import { AlmaFace, BrandIcon, Logo, preloadFaces } from "./Brand.jsx";
import { useStore, useToasts } from "../lib/store.jsx";
import { unlockAudio, useSpeech } from "../lib/voice.js";
import { STORE } from "../data/seed.js";

const NAV = [
  { to: "/", label: "Alma", icon: "face", end: true },
  { to: "/vender", label: "Vender", icon: "register" },
  { to: "/inventario", label: "Inventario", icon: "basket" },
  { to: "/fiados", label: "Fiados", icon: "notebook" },
  { to: "/hoy", label: "Resumen", icon: "house" },
  { to: "/cierre", label: "Cierre", icon: "closed" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Header({ home }) {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const now = useClock();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className={`site-header ${home ? "is-home" : ""}`}>
      <div className="container header-row">
        <Link to="/" className="header-logo" aria-label="Alma, inicio">
          <Logo />
        </Link>

        {!home && (
          <nav className={`main-nav ${open ? "is-open" : ""}`} aria-label="Funciones">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
                <BrandIcon name={n.icon} size={28} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        <div className="header-side">
          <Link to="/cierre" className="store-status" title={state.dayOpen ? "Mostrador abierto" : "Día cerrado"}>
            <img src={`/brand/icons/${state.dayOpen ? "open" : "closed"}.webp`} alt={state.dayOpen ? "Abierto" : "Cerrado"} height="30" />
            <span className="store-meta">
              <strong>{STORE.name}</strong>
              <span>
                {now.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                {now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
            </span>
          </Link>
          <button
            className="icon-btn"
            onClick={actions.toggleVoice}
            aria-pressed={state.voice}
            aria-label={state.voice ? "Silenciar la voz de Alma" : "Activar la voz de Alma"}
            title={state.voice ? "Voz de Alma activada" : "Alma en silencio"}
          >
            {state.voice ? <SpeakerHigh size={22} weight="bold" /> : <SpeakerSlash size={22} weight="bold" />}
          </button>
          {!home && (
            <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menú">
              {open ? <X size={24} weight="bold" /> : <List size={24} weight="bold" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

// Fuera del inicio, Alma acompaña desde la esquina y habla desde ahí.
function AlmaCorner() {
  const speech = useSpeech();
  const navigate = useNavigate();
  const talking = speech.speaking && speech.source === "corner";
  return (
    <div className={`alma-corner ${talking ? "is-talking" : ""}`}>
      <button className="corner-face" onClick={() => navigate("/")} aria-label="Volver a hablar con Alma">
        <AlmaLive mood={speech.mood || "smile"} size={78} source="corner" />
      </button>
      {talking && (
        <p className="corner-bubble" aria-live="polite">
          {speech.text}
        </p>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <AlmaFace mood={t.mood} size={40} animate={false} alt="" />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const home = pathname === "/";

  useEffect(preloadFaces, []);
  useEffect(() => {
    // En iPad el audio se habilita con el primer toque.
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  return (
    <div className={`site ${home ? "site-home" : ""}`}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <Header home={home} />
      <Push />
      <main id="contenido" className="site-main">
        <Outlet />
      </main>
      {!home && <AlmaCorner />}
      <Toasts />
      <ScrollRestoration />
    </div>
  );
}
