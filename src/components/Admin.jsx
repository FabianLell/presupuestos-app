import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [ultimoEstado, setUltimoEstado] = useState("ok");

  useEffect(() => {
    cargarUsuarios();
  }, []);

  function formatearError(detalle) {
    const texto = String(detalle || "").toLowerCase();
    if (texto.includes("401") || texto.includes("unauthorized")) {
      return "Tu sesión no es válida para acceder al panel admin. Cerrá sesión y volvé a ingresar.";
    }
    if (texto.includes("403") || texto.includes("forbidden")) {
      return "Tu cuenta no tiene permisos para ver usuarios registrados.";
    }
    if (texto.includes("missing required env vars")) {
      return "La función admin-list-users no está configurada correctamente en Supabase Secrets.";
    }
    if (texto.includes("failed to fetch") || texto.includes("network")) {
      return "No se pudo conectar con Supabase Edge Functions. Verificá conexión y deploy.";
    }
    return "No se pudo cargar la lista de usuarios. Verificá la configuración de admin-list-users.";
  }

  async function cargarUsuarios() {
    setCargando(true);
    setError("");
    setUltimoEstado("ok");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError("No hay sesión activa para consultar admin-list-users.");
        setCargando(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "admin-list-users",
        {
          method: "POST",
          body: {},
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (error) {
        let detalle = error.message || "Error al consultar admin-list-users";
        if (error.context) {
          const body = await error.context.json().catch(() => null);
          if (body?.error) {
            detalle = `${body.error}${body?.details ? ` (${body.details})` : ""}`;
          } else if (error.context.status) {
            detalle = `Error ${error.context.status} al consultar admin-list-users`;
          }
        }
        setError(formatearError(detalle));
        setUltimoEstado("error");
        setCargando(false);
        return;
      }

      if (data?.error) {
        const d = data?.details ? ` (${data.details})` : "";
        setError(formatearError(`${data.error}${d}`));
        setUltimoEstado("error");
        setCargando(false);
        return;
      }

      setUsuarios(Array.isArray(data?.users) ? data.users : []);
      setUltimaActualizacion(new Date());
      setUltimoEstado("ok");
    } catch (e) {
      setError(
        "No se pudo cargar el panel de administración. Reintentá en unos segundos.",
      );
      setUltimoEstado("error");
      console.error("admin-list-users unexpected error:", e);
    }
    setCargando(false);
  }

  return (
    <>
      <h1>🛡️ Panel Admin</h1>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Usuarios registrados</h2>
            {ultimaActualizacion && (
              <p
                style={{
                  margin: "0.3rem 0 0",
                  color: ultimoEstado === "error" ? "#f59e0b" : "#888",
                  fontSize: "0.82rem",
                }}
              >
                Última actualización:{" "}
                {ultimaActualizacion.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                {ultimoEstado === "error" ? " (último intento con error)" : ""}
              </p>
            )}
          </div>
          <button className="btn btn-secondary" onClick={cargarUsuarios}>
            Actualizar
          </button>
        </div>

        {error && <p className="msg-error">{error}</p>}

        {cargando ? (
          <p style={{ color: "#888" }}>Cargando usuarios...</p>
        ) : usuarios.length === 0 ? (
          <p style={{ color: "#888" }}>No hay usuarios para mostrar</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre taller</th>
                <th>Creado</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.email || "—"}</td>
                  <td>{u.nombre_taller || "—"}</td>
                  <td>
                    {u.created_at
                      ? new Date(u.created_at).toLocaleString("es-AR")
                      : "—"}
                  </td>
                  <td>
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString("es-AR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
