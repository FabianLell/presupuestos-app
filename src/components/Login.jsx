import { useState } from "react";
import { supabase } from "../supabase";

export default function Login({ onShowRegistro }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleLogin() {
    setError("");
    setOk("");
    if (!email || !password) return setError("Completá todos los campos");
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError("Email o contraseña incorrectos");
    setCargando(false);
  }

  async function handleGoogle() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) setError("No se pudo iniciar sesión con Google");
  }

  async function handleForgotPassword() {
    setError("");
    setOk("");
    if (!email.trim())
      return setError("Ingresá tu email para recuperar la contraseña");
    setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}`,
    });
    if (error) {
      setError("No se pudo enviar el email de recuperación");
    } else {
      setOk(
        "Te enviamos un enlace para recuperar la contraseña. Revisá tu email.",
      );
    }
    setCargando(false);
  }

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
          maxWidth: "380px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src="/logo-app.png"
            alt="PresuPro"
            style={{
              height: "122px",
              objectFit: "contain",
              marginBottom: "0.75rem",
            }}
          />
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Ingresá para continuar
          </p>
        </div>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        {/* BOTÓN GOOGLE */}
        <button
          onClick={handleGoogle}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "8px",
            border: "1px solid #333",
            background: "#222",
            color: "#f0f0f0",
            fontSize: "0.95rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.6rem",
            marginBottom: "1.25rem",
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#2a2a2a")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#222")}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.7-.2-3.3-.9-4.9z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.5 15.8 18.9 12.5 24 12.5c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.7 29.3 4.5 24 4.5c-7.7 0-14.3 4.4-17.7 10.2z"
            />
            <path
              fill="#4CAF50"
              d="M24 45.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 37 26.7 38 24 38c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.7 41.1 16.4 45.5 24 45.5z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C41.1 35.5 44.5 30.7 44.5 25c0-1.7-.2-3.3-.9-4.9z"
            />
          </svg>
          Continuar con Google
        </button>

        {/* SEPARADOR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "#2a2a2a" }} />
          <span style={{ color: "#555", fontSize: "0.82rem" }}>
            o ingresá con email
          </span>
          <div style={{ flex: 1, height: "1px", background: "#2a2a2a" }} />
        </div>

        {/* FORMULARIO EMAIL/PASSWORD */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={cargando}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginTop: "0.5rem",
          }}
        >
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>

        <button
          className="btn btn-secondary"
          onClick={onShowRegistro}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginTop: "0.6rem",
          }}
        >
          Crear cuenta nueva
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleForgotPassword}
          style={{
            width: "100%",
            padding: "0.65rem",
            fontSize: "0.92rem",
            marginTop: "0.5rem",
          }}
        >
          Olvidé mi contraseña
        </button>
      </div>
    </div>
  );
}
