import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function ConfirmarEmail() {
  const [estado, setEstado] = useState("verificando");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const confirmarEmail = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get("access_token");
      const refreshToken = urlParams.get("refresh_token");

      if (accessToken && refreshToken) {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setEstado("error");
            setMensaje("Error al confirmar tu email: " + error.message);
          } else {
            setEstado("confirmado");
            setMensaje("¡Email confirmado exitosamente! Ya puedes iniciar sesión.");
            
            // Redirigir al login después de 3 segundos
            setTimeout(() => {
              window.location.href = "/";
            }, 3000);
          }
        } catch {
          setEstado("error");
          setMensaje("Error inesperado al confirmar tu email.");
        }
      } else {
        setEstado("error");
        setMensaje("Enlace de confirmación inválido o expirado.");
      }
    };

    confirmarEmail();
  }, []);

  const renderContenido = () => {
    switch (estado) {
      case "verificando":
        return (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <h2>Verificando tu email...</h2>
            <p style={{ color: "#666" }}>Por favor, espera un momento.</p>
          </div>
        );

      case "confirmado":
        return (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ color: "#28a745" }}>¡Email Confirmado!</h2>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              {mensaje}
            </p>
            <p style={{ color: "#999", fontSize: "0.9rem" }}>
              Serás redirigido automáticamente a la página de inicio de sesión.
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => window.location.href = "/"}
              style={{ marginTop: "1rem" }}
            >
              Ir al Inicio de Sesión
            </button>
          </div>
        );

      case "error":
        return (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>❌</div>
            <h2 style={{ color: "#dc3545" }}>Error de Confirmación</h2>
            <p style={{ color: "#666", marginBottom: "1rem" }}>
              {mensaje}
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1rem" }}>
              <button 
                className="btn btn-primary"
                onClick={() => window.location.href = "/"}
              >
                Ir al Inicio de Sesión
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => window.location.href = "/register"}
              >
                Crear Nueva Cuenta
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      backgroundColor: "#f5f5f5"
    }}>
      <div style={{ 
        backgroundColor: "white", 
        padding: "2rem", 
        borderRadius: "8px", 
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        maxWidth: "500px",
        width: "90%"
      }}>
        {renderContenido()}
      </div>
    </div>
  );
}
