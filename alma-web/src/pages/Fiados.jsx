import { useEffect, useRef, useState } from "react";
import { Check, Plus, WhatsappLogo } from "@phosphor-icons/react";
import { AlmaFace, BrandIcon, SectionTitle } from "../components/Brand.jsx";
import Modal from "../components/Modal.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { fiadoSummary, lastMovement, oldestDebtDays, vecinoBalance } from "../lib/metrics.js";
import { clp, relativeDay } from "../lib/format.js";
import { STORE } from "../data/seed.js";

function money(v) {
  return Number(String(v).replace(/\D/g, "")) || 0;
}

function waLink(v, balance) {
  const text = `Hola ${v.name}, ¿cómo está? Le escribo del ${STORE.name}. Le recuerdo con cariño que en el cuaderno quedan ${clp(balance)} pendientes. Pase cuando pueda. ¡Saludos!`;
  return `https://wa.me/${v.phone}?text=${encodeURIComponent(text)}`;
}

function VecinoDetail({ v }) {
  const { actions } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState("fiado");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const balance = vecinoBalance(v);
  const days = oldestDebtDays(v);
  const moves = [...v.movements].sort((a, b) => b.ts - a.ts);

  function submit(e) {
    e.preventDefault();
    const n = money(amount);
    if (!n) return;
    if (mode === "fiado") {
      actions.fiar(v.id, n, note);
      toast(`Anotado: ${clp(n)} fiado a ${v.name}.`, "smile");
    } else {
      actions.abonar(v.id, Math.min(n, balance), note || "Abono");
      toast(`${v.name} abonó ${clp(Math.min(n, balance))}.`, "happy");
    }
    setAmount("");
    setNote("");
  }

  return (
    <section className="card vecino-detail" aria-label={`Cuenta de ${v.name}`}>
      <header className="vd-head">
        <div>
          <h2 className="script vd-name">{v.name}</h2>
          {v.note && <p className="muted">{v.note}</p>}
        </div>
        <div className="vd-balance">
          <span>{balance > 0 ? "Debe" : "Al día"}</span>
          <strong className={balance > 0 ? "pink" : ""}>{clp(balance)}</strong>
          {balance > 0 && days > 0 && <small>lo más antiguo, hace {days} días</small>}
        </div>
      </header>

      {balance > 0 && days >= 5 && (
        <div className="alma-tip">
          <AlmaFace mood="wink" size={44} animate={false} alt="" />
          <p>Lleva {days} días. Un recordatorio amable hoy evita un mal rato después.</p>
        </div>
      )}

      <form className="vd-form" onSubmit={submit}>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Tipo de movimiento">
          <button type="button" role="radio" aria-checked={mode === "fiado"} className={mode === "fiado" ? "is-on" : ""} onClick={() => setMode("fiado")}>
            Anotar fiado
          </button>
          <button type="button" role="radio" aria-checked={mode === "abono"} className={mode === "abono" ? "is-on" : ""} onClick={() => setMode("abono")} disabled={balance <= 0}>
            Recibir abono
          </button>
        </div>
        <div className="form-row">
          <input className="input" inputMode="numeric" placeholder="Monto $" value={amount ? clp(money(amount)) : ""} onChange={(e) => setAmount(e.target.value)} aria-label="Monto" />
          <input className="input" placeholder={mode === "fiado" ? "¿Qué llevó? (opcional)" : "Nota (opcional)"} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nota" />
        </div>
        <div className="vd-actions">
          <button className="btn btn-pink" type="submit" disabled={!money(amount)}>
            {mode === "fiado" ? "Anotar en el cuaderno" : "Registrar abono"}
          </button>
          {balance > 0 && (
            <button
              type="button"
              className="btn btn-paper"
              onClick={() => {
                const paid = actions.saldar(v.id);
                toast(`¡${v.name} saldó ${clp(paid)}! Cuenta al día.`, "happy");
              }}
            >
              <Check size={18} weight="bold" /> Saldó todo
            </button>
          )}
          {balance > 0 && v.phone && (
            <a className="btn btn-ink" href={waLink(v, balance)} target="_blank" rel="noreferrer">
              <WhatsappLogo size={20} weight="bold" /> Recordar
            </a>
          )}
        </div>
      </form>

      <h3 className="vd-sub">Movimientos</h3>
      {moves.length === 0 ? (
        <p className="empty">Sin movimientos todavía.</p>
      ) : (
        <ul className="moves">
          {moves.map((m) => (
            <li key={m.id} className={`move move-${m.type}`}>
              <span className="move-day">{relativeDay(m.ts)}</span>
              <span className="move-note">{m.note || (m.type === "fiado" ? "Fiado" : "Abono")}</span>
              <strong>
                {m.type === "fiado" ? "+" : "−"}
                {clp(m.amount)}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddVecino({ open, onClose }) {
  const { actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Anotar vecino" kicker="Una página nueva en el cuaderno" size="sm">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          actions.addVecino({ name: name.trim(), note: note.trim(), phone: phone.replace(/\D/g, "") });
          toast(`${name.trim()} ya tiene su página en el cuaderno.`, "smile");
          setName("");
          setNote("");
          setPhone("");
          onClose();
        }}
      >
        <label className="field">
          <span className="field-label">Nombre o como le dices</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Don Pedro" required />
        </label>
        <label className="field">
          <span className="field-label">¿Dónde vive o de dónde lo conoces?</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Casa verde del pasaje" />
        </label>
        <label className="field">
          <span className="field-label">WhatsApp (opcional)</span>
          <input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-paper" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-pink" disabled={!name.trim()}>
            Anotar vecino
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Fiados() {
  const { state } = useStore();
  const summary = fiadoSummary(state.vecinos);
  const sorted = [...state.vecinos].sort((a, b) => vecinoBalance(b) - vecinoBalance(a) || lastMovement(b) - lastMovement(a));
  const [selectedId, setSelectedId] = useState(sorted[0]?.id);
  const [adding, setAdding] = useState(false);
  const selected = state.vecinos.find((v) => v.id === selectedId) || sorted[0];
  const prevCount = useRef(state.vecinos.length);

  // Al anotar un vecino nuevo, abrir su página.
  useEffect(() => {
    if (state.vecinos.length > prevCount.current) setSelectedId(state.vecinos[state.vecinos.length - 1].id);
    prevCount.current = state.vecinos.length;
  }, [state.vecinos]);

  return (
    <div className="container page fiados">
      <header className="page-head">
        <SectionTitle as="h1" title="Cuaderno de fiados" kicker="Lo que te deben, sin libreta perdida" size="lg" />
        <button className="btn btn-pink" onClick={() => setAdding(true)}>
          <Plus size={20} weight="bold" /> Anotar vecino
        </button>
      </header>

      <section className="stats-grid stats-3">
        <div className={`stat ${summary.total ? "stat-pink" : ""}`}>
          <div className="stat-top">
            <span className="stat-label">Por cobrar</span>
            <BrandIcon name="coins" size={34} />
          </div>
          <div className="stat-value">{clp(summary.total)}</div>
          <div className="stat-sub">entre {summary.count} vecinos</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Cuenta más alta</span>
            <BrandIcon name="person" size={34} />
          </div>
          <div className="stat-value">{summary.top ? clp(summary.top.balance) : "—"}</div>
          <div className="stat-sub">{summary.top ? summary.top.name : "Nadie debe"}</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Lo más antiguo</span>
            <BrandIcon name="calendar" size={34} />
          </div>
          <div className="stat-value">{summary.oldest ? `${summary.oldest.days} días` : "—"}</div>
          <div className="stat-sub">{summary.oldest ? summary.oldest.name : "Todo al día"}</div>
        </div>
      </section>

      <div className="fiados-grid">
        <section className="notebook" aria-label="Vecinos">
          <ul>
            {sorted.map((v) => {
              const bal = vecinoBalance(v);
              return (
                <li key={v.id}>
                  <button className={`nb-row ${selected?.id === v.id ? "is-on" : ""}`} onClick={() => setSelectedId(v.id)} aria-current={selected?.id === v.id}>
                    <span className="nb-name script">{v.name}</span>
                    <span className="nb-meta">{v.note || relativeDay(lastMovement(v))}</span>
                    <strong className={bal > 0 ? "nb-debt" : "nb-ok"}>{bal > 0 ? clp(bal) : "Al día"}</strong>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {selected && <VecinoDetail key={selected.id} v={selected} />}
      </div>

      <AddVecino open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
