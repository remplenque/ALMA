import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router";
import { StoreProvider, ToastProvider } from "./lib/store.jsx";
import Layout from "./components/Layout.jsx";
import Inicio from "./pages/Inicio.jsx";
import Hoy from "./pages/Hoy.jsx";
import Vender from "./pages/Vender.jsx";
import Inventario from "./pages/Inventario.jsx";
import Fiados from "./pages/Fiados.jsx";
import Cierre from "./pages/Cierre.jsx";
import NotFound from "./pages/NotFound.jsx";
import "./styles/global.css";
import "./styles/pages.css";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Inicio /> },
      { path: "/hoy", element: <Hoy /> },
      { path: "/vender", element: <Vender /> },
      { path: "/inventario", element: <Inventario /> },
      { path: "/fiados", element: <Fiados /> },
      { path: "/cierre", element: <Cierre /> },
      { path: "/alma", element: <Navigate to="/" replace /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>
);
