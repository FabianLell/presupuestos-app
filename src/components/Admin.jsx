import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabase";
import { calcularEstadoCuenta } from "../supabase";

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [perfiles, setPerfiles] = useState({});
  const [cantPresupuestos, setCantPresupuestos] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [ultimoEstado, setUltimoEstado] = useState("ok");
  const [activando, setActivando] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarTodo();
    function handleClick() {
      setMenuAbierto(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function formatearError(detalle) {
    const texto = String(detalle || "").toLowerCase();
    if (texto.includes("401") || texto.includes("unauthorized"))
      return "Tu sesión no es válida. Cerrá sesión y volvé a ingresar.";
    if (texto.includes("403") || texto.includes("forbidden"))
      return "Tu cuenta no tiene permisos de admin.";
    if (texto.includes("failed to fetch") || texto.includes("network"))
      return "No se pudo conectar. Verificá tu conexión.";
    return "No se pudo cargar el panel. Reintentá en unos segundos.";
  }

  async function cargarTodo() {
    setCargando(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError("No hay sesión activa.");
        setCargando(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "admin-list-users",
        {
          method: "POST",
          body: {},
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (error) {
        let detalle = error.message || "";
        if (error.context) {
          const body = await error.context.json().catch(() => null);
          if (body?.error) detalle = body.error;
        }
        setError(formatearError(detalle));
        setCargando(false);
        return;
      }

      if (data?.error) {
        setError(formatearError(data.error));
        setCargando(false);
        return;
      }

      const listaUsuarios = Array.isArray(data?.users) ? data.users : [];
      setUsuarios(listaUsuarios);

      const mapaPerfiles = {};
      listaUsuarios.forEach((u) => {
        if (u.perfil) mapaPerfiles[u.id] = u.perfil;
      });
      setPerfiles(mapaPerfiles);

      // Obtener conteos de presupuestos con service_role (solución RLS)
      const { data: budgetCounts, error: budgetError } = await supabase.functions.invoke(
        "admin-get-budget-counts",
        {
          method: "POST",
          body: {},
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!budgetError && budgetCounts?.budgetCounts) {
        setCantPresupuestos(budgetCounts.budgetCounts);
      } else {
        console.error('Error obteniendo conteos de presupuestos:', budgetError);
        setCantPresupuestos({});
      }

      setUltimaActualizacion(new Date());
      setUltimoEstado("ok");
    } catch (e) {
      setError("Error inesperado. Reintentá en unos segundos.");
      setUltimoEstado("error");
    }
    setCargando(false);
  }

  async function cambiarEstado(userId, nuevoEstado) {
    setActivando(userId);
    setMenuAbierto(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("No hay sesión activa");

      // Usar Edge Function con service_role para bypassear RLS
      const { data, error } = await supabase.functions.invoke(
        "admin-update-user-status",
        {
          method: "POST",
          body: { userId, nuevoEstado },
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (error) throw new Error(`Error al cambiar estado: ${error.message}`);

      // Actualizar estado local
      setPerfiles(prev => ({
        ...prev,
        [userId]: { ...prev[userId], estado: nuevoEstado }
      }));

      setUltimaActualizacion(new Date());
      setUltimoEstado("ok");
    } catch (error) {
      setError(`Error al cambiar estado: ${error.message}`);
      setUltimoEstado("error");
      console.error("Error cambiando estado:", error);
    } finally {
      setActivando(null);
    }
  }

  async function handleEliminarUsuario(userId, userEmail) {
    if (!confirm(`¿Estás seguro de eliminar permanentemente el usuario ${userEmail}?\n\nEsta acción eliminará:\n• Todos los presupuestos\n• Todos los clientes, materiales y servicios\n• El perfil del usuario\n• La cuenta de autenticación\n\nEsta acción NO se puede deshacer.`)) {
      return;
    }

    setActivando(userId);
    setError("");

    try {
      // 1. Eliminar presupuestos (y sus dependencias)
      
      // Primero obtener IDs de presupuestos para eliminar sus items
      const { data: presupuestosIds } = await supabase
        .from("presupuestos")
        .select("id")
        .eq("user_id", userId);

      const presupuestoIdsList = presupuestosIds?.map(p => p.id) || [];

      // Eliminar items de presupuestos
      if (presupuestoIdsList.length > 0) {
        const { error: errorItemsM } = await supabase
          .from("presupuesto_materiales")
          .delete()
          .in("presupuesto_id", presupuestoIdsList);
        if (errorItemsM) throw new Error(`Error al eliminar items de materiales: ${errorItemsM.message}`);

        const { error: errorItemsS } = await supabase
          .from("presupuesto_servicios")
          .delete()
          .in("presupuesto_id", presupuestoIdsList);
        if (errorItemsS) throw new Error(`Error al eliminar items de servicios: ${errorItemsS.message}`);
      }

      // Eliminar presupuestos
      const { error: errorPresupuestos } = await supabase
        .from("presupuestos")
        .delete()
        .eq("user_id", userId);
      if (errorPresupuestos) throw new Error(`Error al eliminar presupuestos: ${errorPresupuestos.message}`);

      // 2. Eliminar clientes
      const { error: errorClientes } = await supabase
        .from("clientes")
        .delete()
        .eq("user_id", userId);
      if (errorClientes) throw new Error(`Error al eliminar clientes: ${errorClientes.message}`);

      // 3. Eliminar categorías
      const { error: errorCategorias } = await supabase
        .from("categorias")
        .delete()
        .eq("user_id", userId);
      if (errorCategorias) throw new Error(`Error al eliminar categorías: ${errorCategorias.message}`);

      // 4. Eliminar materiales y servicios
      
      const { error: errorMateriales } = await supabase
        .from("materiales")
        .delete()
        .eq("user_id", userId);
      if (errorMateriales) throw new Error(`Error al eliminar materiales: ${errorMateriales.message}`);

      // 5. Eliminar servicios
      const { error: errorServicios } = await supabase
        .from("servicios")
        .delete()
        .eq("user_id", userId);
      if (errorServicios) throw new Error(`Error al eliminar servicios: ${errorServicios.message}`);

      // 6. Eliminar perfil
      const { error: errorPerfil } = await supabase
        .from("perfil")
        .delete()
        .eq("id", userId);
      if (errorPerfil) throw new Error(`Error al eliminar perfil: ${errorPerfil.message}`);

      // 9. Eliminar usuario completo con service role (solución definitiva)
      const { data: sessionData } = await supabase.auth.getSession();
      const { error: error9 } = await supabase.functions.invoke(
        "admin-delete-user-complete",
        {
          method: "POST",
          body: { userId },
          headers: { 
            Authorization: `Bearer ${sessionData.session?.access_token}` 
          },
        }
      );
      
      if (error9) throw new Error(`Error al eliminar usuario completo: ${error9.message}`);

      // Éxito: actualizar estado local
      setUsuarios(prev => prev.filter(u => u.id !== userId));
      setPerfiles(prev => {
        const newPerfiles = { ...prev };
        delete newPerfiles[userId];
        return newPerfiles;
      });
      setCantPresupuestos(prev => {
        const newCant = { ...prev };
        delete newCant[userId];
        return newCant;
      });

      setUltimaActualizacion(new Date());
      setUltimoEstado("ok");
      
    } catch (error) {
      setError(`Error al eliminar usuario: ${error.message}`);
      setUltimoEstado("error");
      console.error("Error en eliminación de usuario:", error);
    } finally {
      setActivando(null);
    }
  }

  function getEstadoInfo(userId) {
    const perfil = perfiles[userId];
    const cant = cantPresupuestos[userId] || 0;
    const estadoPerfil = perfil?.estado ?? "prueba";
    const estadoCalc = calcularEstadoCuenta(perfil, cant);

    if (estadoPerfil === "activo")
      return { label: "Activo", color: "#4ade80", bg: "#14532d" };
    if (estadoPerfil === "desactivado")
      return { label: "Desactivado", color: "#f87171", bg: "#450a0a" };
    if (estadoCalc.soloLectura)
      return { label: "Prueba vencida", color: "#f87171", bg: "#450a0a" };
    return {
      label: `Prueba ${estadoCalc.diasRestantes}d/${estadoCalc.presupuestosRestantes}p`,
      color: "#60a5fa",
      bg: "#1e3a5f",
    };
  }

  function DropdownEstado({ userId }) {
    const perfil = perfiles[userId];
    const estadoPerfil = perfil?.estado ?? "prueba";
    const abierto = menuAbierto === userId;
    const info = getEstadoInfo(userId);

    return (
      <div
        style={{ position: "relative", display: "inline-block" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuAbierto(abierto ? null : userId)}
          disabled={activando === userId}
          style={{
            padding: "0.25rem 0.6rem",
            borderRadius: "20px",
            border: "none",
            background: info.bg,
            color: info.color,
            cursor: "pointer",
            fontSize: "0.78rem",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            whiteSpace: "nowrap",
          }}
        >
          {activando === userId ? "..." : info.label} {!activando && "▾"}
        </button>

        {abierto && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "calc(100% + 4px)",
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: "8px",
              zIndex: 9999,
              minWidth: "130px",
              overflow: "visible",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            {estadoPerfil !== "activo" && (
              <button
                onClick={() => cambiarEstado(userId, "activo")}
                style={{
                  width: "100%",
                  padding: "0.55rem 1rem",
                  background: "none",
                  border: "none",
                  color: "#4ade80",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#2a2a2a")
                }
                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
              >
                ✓ Activar
              </button>
            )}
            {estadoPerfil !== "desactivado" && (
              <button
                onClick={() => cambiarEstado(userId, "desactivado")}
                style={{
                  width: "100%",
                  padding: "0.55rem 1rem",
                  background: "none",
                  border: "none",
                  color: "#f87171",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.85rem",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#2a2a2a")
                }
                onMouseOut={(e) => (e.currentTarget.style.background = "none")}
              >
                ✕ Desactivar
              </button>
            )}
          </div>
        )}
      </div>
    );
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
              </p>
            )}
          </div>
          <button className="btn btn-secondary" onClick={cargarTodo}>
            Actualizar
          </button>
        </div>

        {/* Input de búsqueda */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="🔍 Buscar por email o nombre de negocio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value.toLowerCase())}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              border: "1px solid #333",
              borderRadius: "8px",
              background: "#1e1e1e",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>

        {error && <p className="msg-error">{error}</p>}

        {cargando ? (
          <p style={{ color: "#888" }}>Cargando usuarios...</p>
        ) : usuarios.length === 0 ? (
          <p style={{ color: "#888" }}>No hay usuarios para mostrar</p>
        ) : (
          <div style={{ overflow: "visible" }}>
            <table style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Negocio</th>
                  <th>Registro</th>
                  <th>Último acceso</th>
                  <th style={{ textAlign: "center" }}>№</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "center", position: "relative" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios
                  .filter((u) => {
                    if (!busqueda) return true;
                    const email = (u.email || "").toLowerCase();
                    const negocio = (perfiles[u.id]?.nombre_negocio || "").toLowerCase();
                    return email.includes(busqueda) || negocio.includes(busqueda);
                  })
                  .map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontSize: "0.82rem" }}>{u.email || "—"}</td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {perfiles[u.id]?.nombre_negocio || "—"}
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "#888" }}>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td style={{ fontSize: "0.78rem", color: "#888" }}>
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString(
                            "es-AR",
                          )
                        : "—"}
                    </td>
                    <td style={{ textAlign: "center", fontSize: "0.85rem" }}>
                      {cantPresupuestos[u.id] || 0}
                    </td>
                    <td>
                      <DropdownEstado userId={u.id} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleEliminarUsuario(u.id, u.email)}
                        style={{
                          padding: "0.3rem 0.6rem",
                          fontSize: "0.75rem",
                          minWidth: "60px",
                        }}
                        title="Eliminar usuario permanentemente"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
