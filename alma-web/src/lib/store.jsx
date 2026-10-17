import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PRODUCTS, dateKeyOf, generateDaySales, hourNow, lastWeekSales, pastDays, seedVecinos } from "../data/seed.js";
import { averageDay, dayStats, vecinoBalance } from "./metrics.js";
import { setVoiceEnabled } from "./voice.js";
import { round3, uid } from "./format.js";

const STORAGE_KEY = "alma:v1";
const VERSION = 1;

function freshState() {
  const dateKey = dateKeyOf();
  return {
    version: VERSION,
    dateKey,
    dayOpen: true,
    openingCash: 20000,
    products: PRODUCTS.map((p) => ({ ...p })),
    sales: generateDaySales(dateKey, hourNow()),
    vecinos: seedVecinos(),
    cart: [],
    history: [],
    dismissed: { suggestions: [], alerts: [] },
    voice: true,
    lastClose: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const saved = JSON.parse(raw);
    if (saved.version !== VERSION) return freshState();
    const today = dateKeyOf();
    if (saved.dateKey !== today) {
      // Día nuevo: la demo arranca con el movimiento de hoy hasta esta hora.
      return {
        ...saved,
        dateKey: today,
        dayOpen: true,
        sales: generateDaySales(today, hourNow()),
        cart: [],
        dismissed: { ...saved.dismissed, alerts: [] },
        lastClose: null,
      };
    }
    return saved;
  } catch {
    return freshState();
  }
}

function itemsNote(items) {
  return items
    .slice(0, 3)
    .map((it) => it.name.split(" ").slice(0, 2).join(" "))
    .join(", ");
}

function reducer(state, action) {
  switch (action.type) {
    case "cart/add": {
      const { id, qty } = action;
      const existing = state.cart.find((c) => c.id === id);
      const cart = existing
        ? state.cart.map((c) => (c.id === id ? { ...c, qty: round3(c.qty + qty) } : c))
        : [...state.cart, { id, qty }];
      return { ...state, cart };
    }
    case "cart/set": {
      const cart = state.cart
        .map((c) => (c.id === action.id ? { ...c, qty: round3(action.qty) } : c))
        .filter((c) => c.qty > 0);
      return { ...state, cart };
    }
    case "cart/clear":
      return { ...state, cart: [] };

    case "checkout": {
      const { method, vecinoId } = action;
      const items = state.cart.map((c) => {
        const p = state.products.find((x) => x.id === c.id);
        return { id: p.id, name: p.name, unit: p.unit, price: p.price, cost: p.cost, qty: c.qty };
      });
      const total = Math.round(items.reduce((s, it) => s + it.price * it.qty, 0));
      const ts = Date.now();
      const sale = { id: uid("v"), ts, items, total, method, vecinoId: vecinoId || null };
      const products = state.products.map((p) => {
        const c = state.cart.find((x) => x.id === p.id);
        return c ? { ...p, stock: round3(p.stock - c.qty) } : p;
      });
      const vecinos =
        method === "fiado"
          ? state.vecinos.map((v) =>
              v.id === vecinoId
                ? { ...v, movements: [...v.movements, { id: uid("m"), ts, type: "fiado", amount: total, note: itemsNote(items) }] }
                : v
            )
          : state.vecinos;
      return { ...state, products, vecinos, sales: [sale, ...state.sales], cart: [] };
    }

    case "product/restock":
      return {
        ...state,
        products: state.products.map((p) => (p.id === action.id ? { ...p, stock: round3(p.stock + action.qty) } : p)),
        dismissed: { ...state.dismissed, alerts: state.dismissed.alerts.filter((a) => a !== action.id) },
      };
    case "product/update":
      return { ...state, products: state.products.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case "product/add":
      return { ...state, products: [...state.products, action.product] };
    case "suggestion/dismiss":
      return { ...state, dismissed: { ...state.dismissed, suggestions: [...state.dismissed.suggestions, action.id] } };
    case "alert/dismiss":
      return { ...state, dismissed: { ...state.dismissed, alerts: [...state.dismissed.alerts, action.id] } };

    case "vecino/add":
      return { ...state, vecinos: [...state.vecinos, { id: uid("vc"), name: action.name, note: action.note || "", phone: action.phone || "", movements: [] }] };
    case "vecino/move":
      return {
        ...state,
        vecinos: state.vecinos.map((v) =>
          v.id === action.id
            ? { ...v, movements: [...v.movements, { id: uid("m"), ts: Date.now(), type: action.kind, amount: action.amount, note: action.note || "" }] }
            : v
        ),
      };

    case "day/close": {
      const stats = dayStats(state.sales);
      const summary = {
        dateKey: state.dateKey,
        closedAt: Date.now(),
        total: stats.total,
        profit: stats.profit,
        count: stats.count,
        byMethod: stats.byMethod,
        counted: action.counted,
        expectedCash: state.openingCash + stats.byMethod.efectivo,
      };
      return { ...state, dayOpen: false, sales: [], cart: [], history: [summary, ...state.history], lastClose: summary };
    }
    case "day/open":
      return { ...state, dayOpen: true, openingCash: action.openingCash, lastClose: null, dismissed: { ...state.dismissed, alerts: [] } };

    case "voice/toggle":
      return { ...state, voice: !state.voice };
    case "demo/reset":
      return freshState();
    default:
      return state;
  }
}

const StoreContext = createContext(null);
const ToastContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;
  // El reducer es puro: aplicarlo también sobre la referencia deja el cambio visible al instante
  // (el agente encadena escrituras y lecturas antes de que React vuelva a renderizar).
  const dispatch = useCallback((action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* almacenamiento no disponible: la demo sigue en memoria */
    }
  }, [state]);

  useEffect(() => setVoiceEnabled(state.voice), [state.voice]);

  const lastWeek = useMemo(() => lastWeekSales(state.dateKey), [state.dateKey]);
  const avgDay = useMemo(() => averageDay(pastDays(state.dateKey)), [state.dateKey]);

  const actions = useMemo(() => {
    const product = (id) => stateRef.current.products.find((p) => p.id === id);
    const available = (id) => {
      const p = product(id);
      const inCart = stateRef.current.cart.find((c) => c.id === id)?.qty || 0;
      return p ? p.stock - inCart : 0;
    };
    return {
      getState: () => stateRef.current,
      product,
      available,
      // Devuelve la cantidad realmente agregada (limitada por stock).
      addToCart(id, qty = 1) {
        const free = available(id);
        const add = Math.min(qty, Math.max(0, free));
        if (add > 0) dispatch({ type: "cart/add", id, qty: add });
        return add;
      },
      setCartQty(id, qty) {
        const p = product(id);
        dispatch({ type: "cart/set", id, qty: Math.min(qty, p ? p.stock : 0) });
      },
      clearCart: () => dispatch({ type: "cart/clear" }),
      checkout: (method, vecinoId) => dispatch({ type: "checkout", method, vecinoId }),
      restock: (id, qty) => dispatch({ type: "product/restock", id, qty }),
      updateProduct: (id, patch) => dispatch({ type: "product/update", id, patch }),
      addProduct: (product) => dispatch({ type: "product/add", product: { ...product, id: uid("p") } }),
      dismissSuggestion: (id) => dispatch({ type: "suggestion/dismiss", id }),
      dismissAlert: (id) => dispatch({ type: "alert/dismiss", id }),
      addVecino: (data) => dispatch({ type: "vecino/add", ...data }),
      fiar: (id, amount, note) => dispatch({ type: "vecino/move", id, kind: "fiado", amount, note }),
      abonar: (id, amount, note) => dispatch({ type: "vecino/move", id, kind: "abono", amount, note }),
      saldar(id) {
        const v = stateRef.current.vecinos.find((x) => x.id === id);
        const bal = v ? vecinoBalance(v) : 0;
        if (bal > 0) dispatch({ type: "vecino/move", id, kind: "abono", amount: bal, note: "Saldó la cuenta" });
        return bal;
      },
      closeDay: (counted) => dispatch({ type: "day/close", counted }),
      openDay: (openingCash) => dispatch({ type: "day/open", openingCash }),
      toggleVoice: () => dispatch({ type: "voice/toggle" }),
      resetDemo() {
        dispatch({ type: "demo/reset" });
        window.dispatchEvent(new Event("alma:demo-push"));
      },
    };
  }, []);

  const value = useMemo(() => ({ state, actions, lastWeek, avgDay }), [state, actions, lastWeek, avgDay]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, mood = "smile") => {
    const id = uid("t");
    setToasts((t) => [...t.slice(-2), { id, text, mood }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  const value = useMemo(() => ({ toasts, push }), [toasts, push]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext).push;
}

export function useToasts() {
  return useContext(ToastContext).toasts;
}
