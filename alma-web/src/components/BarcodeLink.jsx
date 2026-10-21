import { useEffect, useState } from "react";
import { Barcode } from "@phosphor-icons/react";
import { CATEGORIES } from "../data/seed.js";
import { useStore, useToast } from "../lib/store.jsx";
import { lookupBarcode, suggestOwn } from "../lib/lookup.js";
import { normalize } from "../lib/format.js";
import { say } from "../lib/voice.js";

const num = (v) => Number(String(v).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

// Un código que Alma no conoce: lo busca en la base pública de productos y deja
// crear el producto con sus datos, o vincularlo a uno que ya está en la vitrina.
export default function BarcodeLink({ code, addToCart = false, onDone, onCancel }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const [phase, setPhase] = useState("loading"); // loading | found | none | offline
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("mine"); // mine | new
  const [id, setId] = useState("");
  const [form, setForm] = useState({ name: "", category: "Abarrotes", price: "", stock: "" });

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    setInfo(null);
    setId("");
    setMode("mine");
    setForm({ name: "", category: "Abarrotes", price: "", stock: "" });
    lookupBarcode(code)
      .then((found) => {
        if (!alive) return;
        if (!found) {
          toast("No aparece en la base pública de productos.", "sad");
          return setPhase("none");
        }
        toast(`Encontré: ${found.name}`, "happy");
        const similar = suggestOwn(found, actions.getState().products);
        setInfo(found);
        setPhase("found");
        setForm((f) => ({ ...f, name: found.name, category: found.category }));
        if (similar) setId(similar.id);
        else setMode("new");
      })
      .catch(() => {
        if (!alive) return;
        toast("No pude consultar la base de productos. ¿Hay internet?", "sad");
        setPhase("offline");
      });
    return () => {
      alive = false;
    };
  }, [code]);

  const sorted = [...state.products].sort((a, b) => Number(Boolean(a.barcode)) - Number(Boolean(b.barcode)) || a.name.localeCompare(b.name, "es"));
  const target = state.products.find((p) => p.id === id);
  const suggested = info ? suggestOwn(info, state.products) : null;
  const newOk = form.name.trim() && num(form.price) > 0;

  function linkExisting() {
    if (!target) return;
    actions.setBarcode(target.id, code);
    // Lo que se pesa no se anota solo: hay que pesarlo.
    const added = addToCart && target.unit !== "kg" && actions.addToCart(target.id, 1) > 0;
    toast(`Listo: ${target.name} ya tiene su código.${added ? " Lo anoté en la boleta." : ""}`, "happy");
    say(`Listo, ya me aprendí el código de ${target.name}.`, { mood: "happy", source: "scan" });
    onDone?.(target);
  }

  function createNew() {
    if (!newOk) return;
    const name = form.name.trim();
    const price = num(form.price);
    const stock = num(form.stock);
    const created = actions.addProduct({
      name,
      category: form.category,
      price,
      cost: Math.round(price * 0.7),
      stock,
      minStock: 4,
      unit: "u",
      speed: "media",
      aliases: [normalize(name).split(" ")[0]],
      barcode: code,
    });
    const added = addToCart && stock > 0 && actions.addToCart(created.id, 1) > 0;
    toast(`${name} agregado a la vitrina.${added ? " Lo anoté en la boleta." : stock > 0 ? "" : " Anota cuántos tienes en Inventario."}`, "happy");
    say(`Listo, agregué ${name}.`, { mood: "happy", source: "scan" });
    onDone?.(created);
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="barcode-link">
      <p className="barcode-link-title">
        <Barcode size={22} weight="bold" /> {phase === "loading" ? "Buscando este código…" : phase === "found" ? "Encontré este producto" : "Este código no lo conozco"}
      </p>
      <code className="barcode-code">{code}</code>

      {phase === "found" && info && (
        <div className="barcode-found">
          {info.image && <img src={info.image} alt="" width="64" height="64" />}
          <div>
            <strong>{info.name}</strong>
            <span>
              {[info.brand, info.quantity].filter(Boolean).join(" · ") || "Sin más datos"} · {info.source}
            </span>
          </div>
        </div>
      )}
      {phase === "offline" && <p className="muted small">No pude consultar la base de productos (¿sin internet?). Igual puedes decirme a cuál corresponde.</p>}
      {phase === "none" && <p className="muted small">No aparece en la base pública (las marcas chilenas a veces faltan). Dime a cuál producto corresponde.</p>}

      {phase !== "loading" && (
        <>
          <div className="segmented segmented-sm" role="tablist">
            <button role="tab" aria-selected={mode === "mine"} className={mode === "mine" ? "is-on" : ""} onClick={() => setMode("mine")}>
              Ya lo tengo
            </button>
            <button role="tab" aria-selected={mode === "new"} className={mode === "new" ? "is-on" : ""} onClick={() => setMode("new")}>
              Producto nuevo
            </button>
          </div>

          {mode === "mine" ? (
            <>
              <label className="field">
                <span className="field-label">{suggested && id === suggested.id ? `Parece ser tu “${suggested.name}”` : "¿De qué producto es?"}</span>
                <select className="input input-sm" value={id} onChange={(e) => setId(e.target.value)} aria-label="Producto de este código">
                  <option value="">Elige el producto…</option>
                  {sorted.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.barcode ? " (ya tiene código)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {target?.barcode && <p className="muted small">Ojo: {target.name} ya tenía otro código; quedará solo con este.</p>}
              <div className="barcode-link-actions">
                <button className="btn btn-sm btn-paper" onClick={onCancel}>
                  Ahora no
                </button>
                <button className="btn btn-sm btn-pink" disabled={!target} onClick={linkExisting}>
                  Guardar código
                </button>
              </div>
            </>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                createNew();
              }}
            >
              <label className="field">
                <span className="field-label">Nombre</span>
                <input className="input input-sm" value={form.name} onChange={set("name")} placeholder="Ej: Mermelada de durazno 250 g" aria-label="Nombre del producto nuevo" />
              </label>
              <div className="form-row">
                <label className="field">
                  <span className="field-label">Categoría</span>
                  <select className="input input-sm" value={form.category} onChange={set("category")}>
                    {CATEGORIES.map((c) => (
                      <option key={c.id}>{c.id}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">¿Cuánto lo vendes?</span>
                  <input className="input input-sm" inputMode="numeric" value={form.price} onChange={set("price")} placeholder="$" aria-label="Precio de venta" />
                </label>
                <label className="field">
                  <span className="field-label">¿Cuántos tienes?</span>
                  <input className="input input-sm" inputMode="decimal" value={form.stock} onChange={set("stock")} placeholder="0" aria-label="Stock inicial" />
                </label>
              </div>
              <div className="barcode-link-actions">
                <button type="button" className="btn btn-sm btn-paper" onClick={onCancel}>
                  Ahora no
                </button>
                <button type="submit" className="btn btn-sm btn-pink" disabled={!newOk}>
                  Agregar a la vitrina
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
