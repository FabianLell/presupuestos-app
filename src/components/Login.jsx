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

  async function handleForgotPassword() {
    setError("");
    setOk("");
    if (!email.trim()) {
      return setError("Ingresá tu email para recuperar la contraseña");
    }

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
            src="/logo.png"
            alt="Logo"
            style={{
              height: "80px",
              objectFit: "contain",
              marginBottom: "1rem",
            }}
          />
          <p style={{ color: "#888", fontSize: "0.9rem" }}>
            Ingresá para continuar
          </p>
        </div>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

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
