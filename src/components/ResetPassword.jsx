import { useState } from "react";
import { supabase } from "../supabase";

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleReset() {
    setError("");
    setOk("");
    if (!password || !confirmar) return setError("Completá todos los campos");
    if (password.length < 6)
      return setError("La contraseña debe tener al menos 6 caracteres");
    if (password !== confirmar) return setError("Las contraseñas no coinciden");

    setCargando(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("Error al actualizar la contraseña");
    } else {
      setOk("Contraseña actualizada correctamente");
      setTimeout(() => onDone(), 2000);
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
          <h2 style={{ margin: 0 }}>Nueva contraseña</h2>
          <p style={{ color: "#888", fontSize: "0.9rem", marginTop: "0.5rem" }}>
            Ingresá tu nueva contraseña
          </p>
        </div>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReset()}
        />
        <input
          type="password"
          placeholder="Repetir contraseña"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleReset()}
        />

        <button
          className="btn btn-primary"
          onClick={handleReset}
          disabled={cargando}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginTop: "0.5rem",
          }}
        >
          {cargando ? "Guardando..." : "Guardar contraseña"}
        </button>
      </div>
    </div>
  );
}
