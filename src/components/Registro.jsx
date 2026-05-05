import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

export default function Registro({ onBackToLogin }) {
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cargando, setCargando] = useState(false);
  const timeoutRef = useRef(null);

  async function handleRegistro() {
    setError("");
    setOk("");

    if (!nombreNegocio.trim() || !email.trim() || !password || !confirmar) {
      return setError("Completá todos los campos");
    }
    if (password.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres");
    }
    if (password !== confirmar) {
      return setError("Las contraseñas no coinciden");
    }

    setCargando(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nombre_negocio: nombreNegocio.trim(),
        },
      },
    });

    if (error) {
      setError(error.message || "No se pudo crear la cuenta");
    } else {
      setOk("¡Cuenta creada! Revisá tu email para confirmar el registro antes de iniciar sesión.");
      // No redirigir automáticamente, dejar que el usuario decida
    }
    setCargando(false);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111",
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "420px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src="/logo.png"
            alt="Logo"
            style={{
              height: "80px",
              objectFit: "contain",
              marginBottom: "1rem",
            }}
          />
          <h2 style={{ margin: 0 }}>Crear cuenta nueva</h2>
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Registrá tu negocio para empezar a usar la app
          </p>
        </div>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <input
          type="text"
          placeholder="Nombre del negocio"
          value={nombreNegocio}
          onChange={(e) => setNombreNegocio(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegistro()}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegistro()}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegistro()}
        />
        <input
          type="password"
          placeholder="Confirmar contraseña"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRegistro()}
        />

        <button
          className="btn btn-primary"
          onClick={handleRegistro}
          disabled={cargando}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginTop: "0.5rem",
          }}
        >
          {cargando ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <button
          className="btn btn-secondary"
          onClick={onBackToLogin}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginTop: "0.6rem",
          }}
        >
          Volver al login
        </button>
      </div>
    </div>
  );
}
