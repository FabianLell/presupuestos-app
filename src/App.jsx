import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import "./App.css";
import Login from "./components/Login";
import Registro from "./components/Registro";
import ResetPassword from "./components/ResetPassword";
import Materiales from "./components/Materiales";
import Servicios from "./components/Servicios";
import Clientes from "./components/Clientes";
import Presupuestos from "./components/Presupuestos";
import Admin from "./components/Admin";

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAIL || "admin@presupuestos-app.com")
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const SECCIONES = [
  { id: "presupuestos", label: "📋 Presupuestos" },
  { id: "clientes", label: "👤 Clientes" },
  { id: "materiales", label: "🔩 Materiales" },
  { id: "servicios", label: "🔧 Servicios" },
  { id: "admin", label: "🛡️ Admin" },
];

export default function App() {
  const [seccion, setSeccion] = useState("presupuestos");
  const [session, setSession] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [resetMode, setResetMode] = useState(false);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") {
        setResetMode(true);
      }
      if (event === "SIGNED_IN") {
        setMostrarRegistro(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (cargando)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#888" }}>Cargando...</p>
      </div>
    );

  if (resetMode) return <ResetPassword onDone={() => setResetMode(false)} />;

  if (!session) {
    if (mostrarRegistro) {
      return <Registro onBackToLogin={() => setMostrarRegistro(false)} />;
    }
    return (
      <Login onShowRegistro={() => setMostrarRegistro(true)} />
    );
  }

  const sessionEmail = (session?.user?.email || "").trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(sessionEmail);
  const secciones = isAdmin
    ? SECCIONES
    : SECCIONES.filter((s) => s.id !== "admin");

  return (
    <div className="app">
      <nav className="sidebar">
        <h2>Herrería</h2>
        {secciones.map((s) => (
          <button
            key={s.id}
            className={seccion === s.id ? "active" : ""}
            onClick={() => setSeccion(s.id)}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={handleLogout}
          style={{ marginTop: "auto", color: "#f87171" }}
        >
          🚪 Cerrar sesión
        </button>
      </nav>
      <main className="main-content">
        {seccion === "materiales" && <Materiales />}
        {seccion === "servicios" && <Servicios />}
        {seccion === "clientes" && <Clientes />}
        {seccion === "presupuestos" && <Presupuestos />}
        {isAdmin && seccion === "admin" && <Admin />}
      </main>
    </div>
  );
}
