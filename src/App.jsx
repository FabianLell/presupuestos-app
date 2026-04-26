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
import Perfil from "./components/Perfil";
import Onboarding from "./components/Onboarding";

const ADMIN_EMAILS = (
  import.meta.env.VITE_ADMIN_EMAIL || "admin@presupuestos-app.com"
)
  .split(",")
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

const SECCIONES = [
  { id: "presupuestos", label: "📋 Presupuestos" },
  { id: "clientes", label: "👤 Clientes" },
  { id: "materiales", label: "🔩 Materiales" },
  { id: "servicios", label: "🔧 Servicios" },
];

export default function App() {
  const [seccion, setSeccion] = useState("presupuestos");
  const [session, setSession] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [resetMode, setResetMode] = useState(false);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCargando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setResetMode(true);
      if (event === "SIGNED_IN") setMostrarRegistro(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) cargarPerfil();
    else setPerfil(null);
  }, [session]);

  async function cargarPerfil() {
    const { data } = await supabase
      .from("perfil")
      .select("*")
      .eq("user_id", session.user.id)
      .single();
    setPerfil(data || null);
    // Si no tiene perfil o no tiene rubros_seleccionados definido → onboarding
    if (!data || data.rubros_seleccionados === null) {
      setOnboarding(true);
    } else {
      setOnboarding(false);
    }
  }

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
  if (session && onboarding)
    return (
      <Onboarding
        onComplete={() => {
          setOnboarding(false);
          cargarPerfil();
        }}
      />
    );

  if (!session) {
    if (mostrarRegistro)
      return <Registro onBackToLogin={() => setMostrarRegistro(false)} />;
    return <Login onShowRegistro={() => setMostrarRegistro(true)} />;
  }

  const sessionEmail = (session?.user?.email || "").trim().toLowerCase();
  const isAdmin = ADMIN_EMAILS.includes(sessionEmail);
  const nombreNegocio =
    perfil?.nombre_negocio ||
    session?.user?.user_metadata?.nombre_negocio ||
    "Mi negocio";

  function LogoNegocio() {
    if (perfil?.logo_url) {
      return (
        <img
          src={perfil.logo_url}
          alt="Logo"
          style={{
            width: "56px",
            height: "56px",
            objectFit: "contain",
            borderRadius: "8px",
            background: "#222",
            padding: "3px",
          }}
        />
      );
    }
    const palabras = nombreNegocio.trim().split(" ");
    const iniciales =
      palabras.length >= 2
        ? palabras[0][0] + palabras[1][0]
        : palabras[0].slice(0, 2);
    return (
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.2rem",
          fontWeight: "700",
          color: "#fff",
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        {iniciales.toUpperCase()}
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div
          style={{
            textAlign: "center",
            marginBottom: "0.75rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid #2a2a2a",
          }}
        >
          <img
            src="/logo-app.png"
            alt="PresuPro"
            style={{ height: "72px", objectFit: "contain" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          <LogoNegocio />
          <p
            style={{
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: "500",
              textAlign: "center",
              wordBreak: "break-word",
              lineHeight: "1.3",
            }}
          >
            {nombreNegocio}
          </p>
          <button
            className={seccion === "perfil" ? "active" : ""}
            onClick={() => setSeccion("perfil")}
            style={{
              fontSize: "0.8rem",
              padding: "0.35rem 0.75rem",
              width: "auto",
            }}
          >
            ⚙️ Editar perfil
          </button>
        </div>

        <div style={{ borderTop: "1px solid #2a2a2a", margin: "0.5rem 0" }} />

        {SECCIONES.map((s) => (
          <button
            key={s.id}
            className={seccion === s.id ? "active" : ""}
            onClick={() => setSeccion(s.id)}
          >
            {s.label}
          </button>
        ))}

        {isAdmin && (
          <button
            className={seccion === "admin" ? "active" : ""}
            onClick={() => setSeccion("admin")}
          >
            🛡️ Admin
          </button>
        )}

        <div
          style={{
            borderTop: "1px solid #2a2a2a",
            margin: "0.5rem 0",
            marginTop: "auto",
          }}
        />

        <button onClick={handleLogout} style={{ color: "#f87171" }}>
          🚪 Cerrar sesión
        </button>
      </nav>

      <main className="main-content">
        {seccion === "presupuestos" && <Presupuestos perfil={perfil} />}
        {seccion === "materiales" && <Materiales />}
        {seccion === "servicios" && <Servicios />}
        {seccion === "clientes" && <Clientes />}
        {seccion === "perfil" && <Perfil onPerfilActualizado={cargarPerfil} />}
        {isAdmin && seccion === "admin" && <Admin />}
      </main>
    </div>
  );
}
