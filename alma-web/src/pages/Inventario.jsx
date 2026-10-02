import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { ArrowRight, MagnifyingGlass, Minus, PencilSimple, Plus, X } from "@phosphor-icons/react";
import { AlmaFace, BrandIcon, SectionTitle, productIcon } from "../components/Brand.jsx";
import Modal from "../components/Modal.jsx";
import { useStore, useToast } from "../lib/store.jsx";
import { lowStock, margin, priceSuggestions, suggestedOrder } from "../lib/metrics.js";
import { clp, normalize, pct, qtyLabel } from "../lib/format.js";
import { CATEGORIES } from "../data/seed.js";

function Suggestions() {
  const { state, actions } = useStore();
  const toast = useToast();
  const list = priceSuggestions(state.products, state.dismissed.suggestions);
  if (!list.length) return null;

  return (
    <section className="card suggestions" id="consejos">
      <div className="card-head">
        <div className="sugg-title">
          <AlmaFace mood="wink" size={56} animate={false} alt="" />
          <SectionTitle title="Consejos de precio" kicker="Para no regalar tu margen" size="sm" />
        </div>
        <span className="muted small">Calculados con tu costo y lo que se vende</span>
      </div>
      <div className="sugg-grid">
        {list.map((s) => (
          <article key={s.id} className={`sugg sugg-${s.kind}`}>
            <span className="tag">{s.tag}</span>
            <h3>{s.name}</h3>
            <p>{s.reason}</p>
            <div className="sugg-prices">
              <span className="old">{clp(s.current)}</span>
              <ArrowRight size={18} weight="bold" />
              <strong>{clp(s.suggested)}</strong>
              <em>{s.gain}</em>
            </div>
            <div className="sugg-actions">
              <button
                className="btn btn-sm btn-ink"
                onClick={() => {
                  actions.updateProduct(s.id, { price: s.suggested });
                  actions.dismissSuggestion(s.id);
                  toast(`${s.name} ahora a ${clp(s.suggested)}.`, "wink");
                }}
              >
                Aplicar {clp(s.suggested)}
              </button>
              <button className="btn btn-sm btn-quiet" onClick={() => actions.dismissSuggestion(s.id)}>
                Ahora no
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PriceCell({ p }) {
  const { actions } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(p.price));

  if (!editing) {
    return (
      <button className="price-edit" onClick={() => (setValue(String(p.price)), setEditing(true))} aria-label={`Cambiar precio de ${p.name}`}>
        {clp(p.price)}
        <PencilSimple size={14} weight="bold" />
      </button>
    );
  }
  return (
    <form
      className="price-form"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.replace(/\D/g, ""));
        if (n > 0) {
          actions.updateProduct(p.id, { price: n });
          toast(`${p.name}: nuevo precio ${clp(n)}.`, "smile");
        }
        setEditing(false);
      }}
    >
      <input className="input input-sm" autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => setEditing(false)} aria-label="Nuevo precio" />
    </form>
  );
}

const EMPTY_FORM = { name: "", category: "Abarrotes", price: "", cost: "", stock: "", unit: "u" };

function AddProduct({ open, onClose }) {
  const { actions } = useStore();
  const toast = useToast();
  const [f, setF] = useState(EMPTY_FORM);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (v) => Number(String(v).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const valid = f.name.trim() && num(f.price) > 0;

  return (
    <Modal open={open} onClose={onClose} title="Agregar producto" kicker="A la vitrina en un minuto">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const name = f.name.trim();
          actions.addProduct({
            name,
            category: f.category,
            price: num(f.price),
            cost: num(f.cost) || Math.round(num(f.price) * 0.7),
            stock: num(f.stock),
            minStock: f.unit === "kg" ? 3 : 4,
            unit: f.unit,
            speed: "media",
            aliases: [normalize(name).split(" ")[0]],
          });
          toast(`${name} agregado a la vitrina.`, "happy");
          setF(EMPTY_FORM);
          onClose();
        }}
      >
        <label className="field">
          <span className="field-label">Nombre</span>
          <input className="input" value={f.name} onChange={set("name")} placeholder="Ej: Mermelada de durazno 250 g" required />
        </label>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Categoría</span>
            <select className="input" value={f.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c.id}>{c.id}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Se vende por</span>
            <select className="input" value={f.unit} onChange={set("unit")}>
              <option value="u">Unidad</option>
              <option value="kg">Kilo</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span className="field-label">Precio de venta</span>
            <input className="input" inputMode="numeric" value={f.price} onChange={set("price")} placeholder="$" required />
          </label>
          <label className="field">
            <span className="field-label">Te cuesta</span>
            <input className="input" inputMode="numeric" value={f.cost} onChange={set("cost")} placeholder="$ (opcional)" />
          </label>
          <label className="field">
            <span className="field-label">Stock</span>
            <input className="input" inputMode="decimal" value={f.stock} onChange={set("stock")} placeholder="0" />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-paper" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-pink" disabled={!valid}>
            Agregar a la vitrina
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Inventario() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todos");
  const [onlyLow, setOnlyLow] = useState(false);
  const [adding, setAdding] = useState(false);

  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#consejos") document.getElementById("consejos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  const low = lowStock(state.products);
  const value = state.products.reduce((s, p) => s + p.cost * Math.max(0, p.stock), 0);
  const list = state.products.filter(
    (p) => (cat === "Todos" || p.category === cat) && (!onlyLow || p.stock <= p.minStock) && normalize(p.name).includes(normalize(query))
  );

  return (
    <div className="container page inventario">
      <header className="page-head">
        <SectionTitle as="h1" title="Inventario" kicker="Tu vitrina, sin anotar al ojo" size="lg" />
        <button className="btn btn-pink" onClick={() => setAdding(true)}>
          <Plus size={20} weight="bold" /> Agregar producto
        </button>
      </header>

      <section className="stats-grid stats-3">
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Productos</span>
            <BrandIcon name="basket" size={34} />
          </div>
          <div className="stat-value">{state.products.length}</div>
          <div className="stat-sub">en {CATEGORIES.length} categorías</div>
        </div>
        <div className={`stat ${low.length ? "stat-pink" : ""}`}>
          <div className="stat-top">
            <span className="stat-label">Por encargar</span>
            <BrandIcon name="megaphone" size={34} />
          </div>
          <div className="stat-value">{low.length}</div>
          <div className="stat-sub">{low.length ? low.map((p) => p.name).join(", ") : "Todo bien surtido"}</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Plata en la vitrina</span>
            <BrandIcon name="bills" size={34} />
          </div>
          <div className="stat-value">{clp(value)}</div>
          <div className="stat-sub">a precio de costo</div>
        </div>
      </section>

      <Suggestions />

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <MagnifyingGlass size={20} weight="bold" />
            <input className="input" placeholder="Buscar en la vitrina…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar producto" />
            {query && (
              <button className="search-clear" onClick={() => setQuery("")} aria-label="Limpiar búsqueda">
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
          <label className="switch">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
            <span className="switch-ui" />
            Solo por encargar
          </label>
        </div>
        <div className="chips cat-chips">
          {[{ id: "Todos", icon: "basket" }, ...CATEGORIES].map((c) => (
            <button key={c.id} className={`chip chip-icon ${cat === c.id ? "is-on" : ""}`} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}>
              <BrandIcon name={c.icon} size={22} />
              {c.id}
            </button>
          ))}
        </div>

        <div className="inv-table" role="table" aria-label="Productos">
          <div className="inv-row inv-headrow" role="row">
            <span role="columnheader">Producto</span>
            <span role="columnheader">Precio</span>
            <span role="columnheader">Costo</span>
            <span role="columnheader">Margen</span>
            <span role="columnheader">Stock</span>
            <span role="columnheader" className="sr-only">
              Acciones
            </span>
          </div>
          {list.map((p) => {
            const m = margin(p);
            const isLow = p.stock <= p.minStock;
            const order = suggestedOrder(p);
            const step = p.unit === "kg" ? 0.5 : 1;
            const fill = Math.min(1, p.stock / (p.minStock * 4));
            return (
              <div className={`inv-row ${isLow ? "is-low" : ""}`} role="row" key={p.id}>
                <span className="inv-product" role="cell">
                  <BrandIcon name={productIcon(p)} size={40} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.category} · se vende {p.speed}
                    </small>
                  </span>
                </span>
                <span role="cell" data-label="Precio">
                  <PriceCell p={p} />
                </span>
                <span role="cell" data-label="Costo" className="muted">
                  {clp(p.cost)}
                </span>
                <span role="cell" data-label="Margen">
                  <span className={`tag ${m < 0.28 ? "tag-warn" : ""}`}>{pct(m)}</span>
                </span>
                <span role="cell" data-label="Stock" className="inv-stock">
                  <span className="stepper">
                    <button onClick={() => actions.restock(p.id, -Math.min(step, p.stock))} aria-label={`Restar stock de ${p.name}`} disabled={p.stock <= 0}>
                      <Minus size={14} weight="bold" />
                    </button>
                    <span>{qtyLabel(p.stock, p.unit)}</span>
                    <button onClick={() => actions.restock(p.id, step)} aria-label={`Sumar stock de ${p.name}`}>
                      <Plus size={14} weight="bold" />
                    </button>
                  </span>
                  <span className="meter" aria-hidden="true">
                    <i style={{ width: `${fill * 100}%` }} />
                  </span>
                </span>
                <span role="cell" className="inv-actions">
                  <button
                    className={`btn btn-sm ${isLow ? "btn-pink" : "btn-paper"}`}
                    onClick={() => {
                      actions.restock(p.id, order);
                      toast(`Pedido anotado: +${qtyLabel(order, p.unit)} de ${p.name}.`, "happy");
                    }}
                  >
                    Encargar +{qtyLabel(order, p.unit)}
                  </button>
                </span>
              </div>
            );
          })}
          {list.length === 0 && <p className="empty">Nada por aquí. {onlyLow ? "¡Todo está bien surtido!" : "Prueba otra búsqueda."}</p>}
        </div>
      </section>

      <AddProduct open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
