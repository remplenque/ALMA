import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Barcode, MagnifyingGlass, Microphone, MicrophoneSlash, Minus, PaperPlaneRight, Plus, Trash, X } from "@phosphor-icons/react";
import { BrandIcon, SectionTitle, productIcon } from "../components/Brand.jsx";
import AlmaLive from "../components/AlmaLive.jsx";
import CameraScanner from "../components/CameraScanner.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { parseOrder } from "../lib/alma.js";
import { say, useListener } from "../lib/voice.js";
import { dayStats, vecinoBalance } from "../lib/metrics.js";
import { clp, kgInput, parseKg, qtyLabel, round3 } from "../lib/format.js";
import Modal from "../components/Modal.jsx";
import { CATEGORIES, STORE } from "../data/seed.js";

const EXAMPLES = ["dos cocas y un kilo de marraqueta", "medio kilo de hallulla, una leche y tres super 8", "un aceite y dos fideos"];
const CASH_NOTES = [1000, 2000, 5000, 10000, 20000];

function VoiceOrder() {
  const { state, actions } = useStore();
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [example] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);

  function handle(raw) {
    const said = raw.trim();
    if (!said) return;
    const { items, unknown } = parseOrder(said, state.products);
    const added = [];
    const short = [];
    for (const { product, qty } of items) {
      const got = actions.addToCart(product.id, qty);
      if (got > 0) added.push(`${qtyLabel(got, product.unit)} de ${product.name}`);
      if (got < qty) short.push(product.name);
    }
    let msg;
    let mood;
    if (added.length) {
      msg = `Anoté ${added.join(", ")}.`;
      mood = "happy";
      if (short.length) msg += ` No me alcanzó el stock de ${short.join(", ")}.`;
      if (unknown.length) msg += ` No encontré “${unknown.join("”, “")}”.`;
    } else {
      msg = unknown.length ? `No encontré “${unknown.join("”, “")}” en tu vitrina. ¿Me lo repites?` : "No te entendí el pedido. Prueba con “dos cocas y un pan”.";
      mood = "sad";
    }
    setFeedback({ said, msg, mood });
    say(msg, { mood, source: "order" });
    setText("");
  }

  const mic = useListener(handle);

  return (
    <section className={`voice-order ${mic.listening ? "is-listening" : ""}`}>
      <AlmaLive mood={mic.listening ? "neutral" : feedback?.mood || "smile"} size={72} listening={mic.listening} source="order" />
      <div className="voice-main">
        <label htmlFor="voice-input" className="voice-label">
          {mic.listening ? "Te escucho… dime el pedido" : "Dicta o escribe el pedido"}
        </label>
        <form
          className="voice-form"
          onSubmit={(e) => {
            e.preventDefault();
            handle(text);
          }}
        >
          <input id="voice-input" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ej: “${example}”`} autoComplete="off" />
          <button type="submit" className="icon-btn icon-btn-ink" aria-label="Anotar pedido" disabled={!text.trim()}>
            <PaperPlaneRight size={20} weight="bold" />
          </button>
        </form>
        {(feedback || mic.error) && (
          <p className="voice-feedback">
            {mic.error ? (
              mic.error
            ) : (
              <>
                <em>“{feedback.said}”</em> {feedback.msg}
              </>
            )}
          </p>
        )}
      </div>
      <button
        className={`mic-btn ${mic.listening ? "is-on" : ""}`}
        onClick={mic.toggle}
        aria-pressed={mic.listening}
        aria-label={mic.listening ? "Dejar de escuchar" : "Dictar pedido"}
      >
        {mic.listening ? <MicrophoneSlash size={30} weight="bold" /> : <Microphone size={30} weight="bold" />}
      </button>
    </section>
  );
}

function ProductTile({ p, onAdd }) {
  const { actions } = useStore();
  const free = actions.available(p.id);
  const isLow = p.stock <= p.minStock;
  return (
    <button className={`product-tile ${free <= 0 ? "is-out" : ""}`} onClick={() => onAdd(p)} disabled={free <= 0}>
      <span className="tile-top">
        <BrandIcon name={productIcon(p)} size={50} />
        <span className={`stock-pill ${isLow ? "is-low" : ""}`}>{free <= 0 ? "Agotado" : qtyLabel(round3(free), p.unit)}</span>
      </span>
      <span className="tile-name">{p.name}</span>
      <span className="tile-price">
        {clp(p.price)}
        {p.unit === "kg" && <small>/kg</small>}
      </span>
      {p.unit === "kg" && <span className="tile-weigh">Pesar</span>}
    </button>
  );
}

const WEIGH_CHIPS = [0.25, 0.5, 0.75, 1, 1.5];

// Productos a granel: se anota el peso exacto que marcó la pesa, o cuánta plata quiere llevar.
function WeighModal({ product, onClose }) {
  const { actions } = useStore();
  const toast = useToast();
  const [kg, setKg] = useState("");
  const [money, setMoney] = useState("");

  useEffect(() => {
    setKg("");
    setMoney("");
  }, [product?.id]);

  if (!product) return <Modal open={false} onClose={onClose} title="" />;
  const free = round3(actions.available(product.id));
  const w = round3(parseKg(kg));
  const tooMuch = w > free;
  const valid = w > 0 && !tooMuch;

  function byMoney(v) {
    setMoney(v);
    const n = Number(v.replace(/\D/g, ""));
    setKg(n ? kgInput(round3(n / product.price)) : "");
  }

  return (
    <Modal open onClose={onClose} title={product.name} kicker="¿Cuánto marcó la pesa?" size="sm">
      <form
        className="form weigh"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          actions.addToCart(product.id, w);
          toast(`Anoté ${qtyLabel(w, "kg")} de ${product.name}: ${clp(product.price * w)}.`, "happy");
          onClose();
        }}
      >
        <label className="field">
          <span className="field-label">Peso</span>
          <span className="weigh-input">
            <input
              className="input input-lg"
              autoFocus
              inputMode="decimal"
              placeholder="0,000"
              value={kg}
              onChange={(e) => {
                setKg(e.target.value);
                setMoney("");
              }}
              aria-describedby="weigh-help"
            />
            <span>kg</span>
          </span>
          <span id="weigh-help" className="muted small">
            Escribe el peso tal cual: 0,735 o 735 g.
          </span>
        </label>
        <div className="chips">
          {WEIGH_CHIPS.map((n) => (
            <button type="button" key={n} className={`chip ${w === n ? "is-on" : ""}`} onClick={() => (setKg(kgInput(n)), setMoney(""))} disabled={n > free}>
              {n < 1 ? `${n * 1000} g` : `${kgInput(n)} kg`}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">O por plata (“dame una luca”)</span>
          <input className="input" inputMode="numeric" placeholder="$" value={money ? clp(Number(money.replace(/\D/g, ""))) : ""} onChange={(e) => byMoney(e.target.value)} />
        </label>
        <div className={`weigh-total ${tooMuch ? "is-short" : ""}`}>
          {tooMuch ? (
            <span>Solo quedan {qtyLabel(free, "kg")}</span>
          ) : (
            <span>
              {w > 0 ? qtyLabel(w, "kg") : "0 kg"} × {clp(product.price)}/kg
            </span>
          )}
          <strong>{clp(valid ? product.price * w : 0)}</strong>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-paper" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-pink" disabled={!valid}>
            Agregar a la boleta
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Peso editable en la boleta: se corrige escribiendo el número.
function WeightField({ p, qty }) {
  const { actions } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState(null);

  function commit() {
    if (draft == null) return;
    const w = round3(parseKg(draft));
    if (w > 0) {
      if (w > p.stock) toast(`Solo quedan ${qtyLabel(p.stock, "kg")} de ${p.name}.`, "sad");
      actions.setCartQty(p.id, w);
    }
    setDraft(null);
  }

  return (
    <span className="weight-field">
      <input
        inputMode="decimal"
        value={draft ?? kgInput(qty)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        aria-label={`Peso de ${p.name} en kilos`}
      />
      <span>kg</span>
    </span>
  );
}

function Ticket() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [method, setMethod] = useState("efectivo");
  const [paid, setPaid] = useState("");
  const [vecinoId, setVecinoId] = useState("");

  const lines = state.cart
    .map((c) => ({ ...c, p: state.products.find((p) => p.id === c.id) }))
    .filter((l) => l.p);
  const total = Math.round(lines.reduce((s, l) => s + l.p.price * l.qty, 0));
  const paidNum = Number(String(paid).replace(/\D/g, "")) || 0;
  const change = paidNum - total;
  const canCharge = total > 0 && (method !== "fiado" || vecinoId) && (method !== "efectivo" || !paidNum || paidNum >= total);

  useEffect(() => {
    if (!state.cart.length) setPaid("");
  }, [state.cart.length]);

  function charge() {
    const vecino = state.vecinos.find((v) => v.id === vecinoId);
    actions.checkout(method, method === "fiado" ? vecinoId : null);
    const msg =
      method === "fiado"
        ? `Anotado en el cuaderno: ${clp(total)} a ${vecino?.name}.`
        : method === "efectivo" && paidNum > total
          ? `¡Venta de ${clp(total)}! Vuelto: ${clp(change)}.`
          : `¡Venta de ${clp(total)} cobrada con ${method === "debito" ? "débito" : "efectivo"}!`;
    toast(msg, "happy");
    say(msg.replace("¡", ""), { mood: "happy", source: "corner" });
    setPaid("");
    setVecinoId("");
    setMethod("efectivo");
  }

  return (
    <aside className="ticket" aria-label="Boleta en curso">
      <div className="ticket-paper">
        <header className="ticket-head">
          <div>
            <h2 className="display">Boleta</h2>
            <span className="muted small">
              {STORE.name} · {new Date().toLocaleDateString("es-CL")}
            </span>
          </div>
          {lines.length > 0 && (
            <button className="btn btn-sm btn-quiet" onClick={actions.clearCart}>
              <Trash size={16} weight="bold" /> Vaciar
            </button>
          )}
        </header>

        {lines.length === 0 ? (
          <div className="ticket-empty">
            <BrandIcon name="basket" size={72} />
            <p>La boleta está vacía. Toca productos, escanea o dicta el pedido.</p>
          </div>
        ) : (
          <ul className="ticket-lines">
            {lines.map(({ p, qty }) => {
              return (
                <li key={p.id}>
                  <div className="tl-name">
                    <strong>{p.name}</strong>
                    <span>
                      {clp(p.price)}
                      {p.unit === "kg" ? " el kg" : " c/u"}
                    </span>
                  </div>
                  {p.unit === "kg" ? (
                    <div className="tl-weight">
                      <WeightField p={p} qty={qty} />
                      <button className="icon-btn icon-btn-sm" onClick={() => actions.setCartQty(p.id, 0)} aria-label={`Quitar ${p.name}`}>
                        <Trash size={16} weight="bold" />
                      </button>
                    </div>
                  ) : (
                    <div className="stepper">
                      <button onClick={() => actions.setCartQty(p.id, qty - 1)} aria-label={`Quitar ${p.name}`}>
                        <Minus size={14} weight="bold" />
                      </button>
                      <span>{qtyLabel(qty, p.unit)}</span>
                      <button onClick={() => actions.addToCart(p.id, 1)} aria-label={`Agregar ${p.name}`} disabled={actions.available(p.id) < 1}>
                        <Plus size={14} weight="bold" />
                      </button>
                    </div>
                  )}
                  <strong className="tl-total">{clp(p.price * qty)}</strong>
                </li>
              );
            })}
          </ul>
        )}

        <div className="ticket-total">
          <span>Total</span>
          <strong>{clp(total)}</strong>
        </div>
      </div>

      <div className="pay">
        <div className="segmented" role="radiogroup" aria-label="Medio de pago">
          {[
            ["efectivo", "Efectivo", "bills"],
            ["debito", "Débito", "register"],
            ["fiado", "Fiado", "notebook"],
          ].map(([id, label, icon]) => (
            <button key={id} role="radio" aria-checked={method === id} className={method === id ? "is-on" : ""} onClick={() => setMethod(id)}>
              <BrandIcon name={icon} size={26} />
              {label}
            </button>
          ))}
        </div>

        {method === "efectivo" && (
          <div className="cash">
            <span className="field-label">¿Con cuánto paga?</span>
            <div className="chips">
              {CASH_NOTES.filter((n) => n >= total || n === 20000).map((n) => (
                <button key={n} className={`chip ${paidNum === n ? "is-on" : ""}`} onClick={() => setPaid(String(n))} disabled={!total}>
                  {clp(n)}
                </button>
              ))}
            </div>
            <input className="input" inputMode="numeric" placeholder="Otro monto" value={paid ? clp(paidNum) : ""} onChange={(e) => setPaid(e.target.value)} disabled={!total} />
            {paidNum > 0 && (
              <div className={`change ${change < 0 ? "is-short" : ""}`}>
                <span>{change < 0 ? "Falta" : "Vuelto"}</span>
                <strong>{clp(Math.abs(change))}</strong>
              </div>
            )}
          </div>
        )}

        {method === "fiado" && (
          <div className="cash">
            <label className="field-label" htmlFor="vecino">
              ¿A quién le anotamos?
            </label>
            <select id="vecino" className="input" value={vecinoId} onChange={(e) => setVecinoId(e.target.value)}>
              <option value="">Elige un vecino…</option>
              {state.vecinos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {vecinoBalance(v) > 0 ? `(debe ${clp(vecinoBalance(v))})` : ""}
                </option>
              ))}
            </select>
            <Link to="/fiados" className="link-arrow small">
              ¿Vecino nuevo? Anótalo en el cuaderno
            </Link>
          </div>
        )}

        <button className="btn btn-pink btn-lg btn-block" disabled={!canCharge} onClick={charge}>
          {method === "fiado" ? `Anotar fiado ${clp(total)}` : `Cobrar ${clp(total)}`}
        </button>
      </div>
    </aside>
  );
}

export default function Vender() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todos");
  const [scanning, setScanning] = useState(false);
  const [weighing, setWeighing] = useState(null);
  const stats = useMemo(() => dayStats(state.sales), [state.sales]);
  const cartCount = state.cart.length;

  const list = state.products.filter(
    (p) => (cat === "Todos" || p.category === cat) && p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
  );

  function add(p) {
    // A granel se pesa: el peso real casi nunca es exacto.
    if (p.unit === "kg") return setWeighing(p);
    const got = actions.addToCart(p.id, 1);
    if (!got) toast(`No queda stock de ${p.name}.`, "sad");
  }

  if (!state.dayOpen) {
    return (
      <div className="container page">
        <section className="card closed-hero">
          <img src="/brand/icons/closed.webp" alt="" width="150" />
          <div>
            <SectionTitle title="La caja está cerrada" kicker="Abre el día para vender" size="sm" />
            <Link to="/cierre" className="btn btn-pink btn-lg">
              Abrir el mostrador
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container page vender">
      <header className="page-head">
        <SectionTitle as="h1" title="Vender" kicker="Por voz, al toque o con la cámara" size="lg" />
        <div className="head-stat">
          <span>Hoy llevas</span>
          <strong>{clp(stats.total)}</strong>
          <span>{stats.count} ventas</span>
        </div>
      </header>

      <div className="vender-grid">
        <div className="vender-main">
          <VoiceOrder />

          <div className="toolbar">
            <div className="search">
              <MagnifyingGlass size={20} weight="bold" />
              <input className="input" placeholder="Buscar producto…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar producto" />
              {query && (
                <button className="search-clear" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                  <X size={16} weight="bold" />
                </button>
              )}
            </div>
            <button className="btn btn-ink" onClick={() => setScanning(true)}>
              <Barcode size={22} weight="bold" /> Escanear con cámara
            </button>
          </div>

          <div className="chips cat-chips" role="tablist" aria-label="Categorías">
            {[{ id: "Todos", icon: "basket" }, ...CATEGORIES].map((c) => (
              <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip chip-icon ${cat === c.id ? "is-on" : ""}`} onClick={() => setCat(c.id)}>
                <BrandIcon name={c.icon} size={22} />
                {c.id}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="empty">No encontré “{query}”. Revisa cómo está escrito o agrégalo en Inventario.</p>
          ) : (
            <div className="product-grid">
              {list.map((p) => (
                <ProductTile key={p.id} p={p} onAdd={add} />
              ))}
            </div>
          )}
        </div>

        <div id="boleta">
          <Ticket />
        </div>
      </div>

      {cartCount > 0 && (
        <a href="#boleta" className="mobile-ticket-bar">
          <span>
            Boleta · {cartCount} producto{cartCount > 1 ? "s" : ""}
          </span>
          <strong>{clp(state.cart.reduce((s, c) => s + (state.products.find((p) => p.id === c.id)?.price || 0) * c.qty, 0))}</strong>
        </a>
      )}

      <CameraScanner open={scanning} onClose={() => setScanning(false)} />
      <WeighModal product={weighing} onClose={() => setWeighing(null)} />
    </div>
  );
}
