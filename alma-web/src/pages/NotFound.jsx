import { Link } from "react-router";
import { AlmaFace, SectionTitle } from "../components/Brand.jsx";

export default function NotFound() {
  return (
    <div className="container page not-found">
      <AlmaFace mood="surprised" size={160} />
      <SectionTitle as="h1" title="Aquí no hay nada" kicker="Esta página se fue a comprar pan" size="lg" />
      <Link to="/hoy" className="btn btn-pink btn-lg">
        Volver al mostrador
      </Link>
    </div>
  );
}
