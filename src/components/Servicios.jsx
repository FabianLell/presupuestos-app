import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";
import { useDirtyForm } from "../hooks/useDirtyForm";

const VACIO = { nombre: "", descripcion: "", precio: "" };

function IconoEditar() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconoEliminar() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export default function Servicios({ soloLectura }) {
  const [servicios, setServicios] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [selId, setSelId] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [esNuevo, setEsNuevo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [mostrarEliminados, setMostrarEliminados] = useState(false);

  // Hook de protección contra pérdida de datos
  const dirtyForm = useDirtyForm(VACIO, async () => {
    if (modoEdicion) {
      await guardar();
    }
  });

  // Registrar estado del formulario con sistema global
  useEffect(() => {
    if (dirtyForm.isDirty && modoEdicion) {
      window.currentDirtyForm = {
        isDirty: dirtyForm.isDirty,
        onSave: async () => {
          await guardar();
        },
      };
    } else {
      window.currentDirtyForm = null;
    }
  }, [dirtyForm.isDirty, modoEdicion]);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    cargar();
  }, [mostrarEliminados]);

  async function cargar() {
    setCargando(true);
    let query = supabase
      .from("servicios")
      .select("*")
      .order("nombre");
    
    // Filtrar por deleted_at según el toggle
    if (!mostrarEliminados) {
      query = query.is("deleted_at", null);
    }
    
    const { data, error } = await query;
    if (error) setError("Error al cargar servicios");
    else setServicios(data || []);
    setCargando(false);
  }

  function handleChange(e) {
    const newForm = { ...form, [e.target.name]: e.target.value };
    setForm(newForm);
    dirtyForm.updateData(newForm);
  }

  function seleccionar(s) {
    // Verificar si hay cambios sin guardar antes de seleccionar
    if (dirtyForm.isDirty && modoEdicion) {
      if (window.showDirtyFormModal) {
        window.showDirtyFormModal(
          async () => {
            await guardar();
            doSeleccionar(s);
          },
          () => {
            doSeleccionar(s);
          },
          () => {
            // Cancelar
          },
        );
      }
    } else {
      doSeleccionar(s);
    }
  }

  function doSeleccionar(s) {
    setSelId(s.id);
    const servicioForm = {
      nombre: s.nombre,
      descripcion: s.descripcion || "",
      precio: s.precio || "",
    };
    setForm(servicioForm);
    dirtyForm.updateData(servicioForm);
    dirtyForm.markAsClean();
    setModoEdicion(false);
    setEsNuevo(false);
    setError("");
    setOk("");
  }

  function nuevo() {
    setSelId(null);
    setForm(VACIO);
    dirtyForm.updateData(VACIO);
    dirtyForm.markAsClean();
    setModoEdicion(true);
    setEsNuevo(true);
    setError("");
    setOk("");
  }

  function cancelar() {
    if (esNuevo) {
      setSelId(null);
      setForm(VACIO);
      setModoEdicion(false);
      setEsNuevo(false);
    } else {
      const s = servicios.find((x) => x.id === selId);
      if (s) seleccionar(s);
      setModoEdicion(false);
    }
    setError("");
    setOk("");
  }

  async function guardar() {
    setError("");
    setOk("");

    // Obtener datos del hook si el componente está vacío
    let currentForm = form;
    if (dirtyForm.currentData && dirtyForm.currentData.nombre) {
      currentForm = {
        nombre: dirtyForm.currentData.nombre || "",
        descripcion: dirtyForm.currentData.descripcion || "",
        precio: dirtyForm.currentData.precio || "",
      };
    }

    if (!currentForm.nombre.trim()) {
      setError("El nombre es obligatorio");
      throw new Error("El nombre es obligatorio");
    }
    if (!currentForm.precio || isNaN(currentForm.precio)) {
      setError("El precio debe ser un número");
      throw new Error("El precio debe ser un número");
    }

    const userId = await getUserId();
    const datos = {
      user_id: userId,
      nombre: currentForm.nombre.trim(),
      descripcion: currentForm.descripcion.trim(),
      precio: parseFloat(currentForm.precio),
    };

    if (!esNuevo && selId) {
      const { error } = await supabase
        .from("servicios")
        .update(datos)
        .eq("id", selId);
      if (error) {
        setError("Error al actualizar");
        throw new Error("Error al actualizar");
      }
      setOk("Servicio actualizado");
      setModoEdicion(false);
      dirtyForm.markAsClean();
    } else {
      const { data, error } = await supabase
        .from("servicios")
        .insert([datos])
        .select()
        .single();
      if (error) {
        setError("Error al guardar");
        throw new Error("Error al guardar");
      }
      setOk("Servicio agregado");
      setEsNuevo(false);
      setModoEdicion(false);
      setSelId(data.id);
      dirtyForm.markAsClean();
    }

    setForm(VACIO);
    cargar();
  }

  async function eliminar(id) {
    // Soft delete: actualizar deleted_at en lugar de borrar
    const { error } = await supabase
      .from("servicios")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setError("Error al eliminar");
      return;
    }
    setSelId(null);
    setForm(VACIO);
    setModoEdicion(false);
    setConfirmEliminar(null);
    cargar();
  }
  
  async function restaurar(id) {
    // Restaurar: setear deleted_at a null
    const { error } = await supabase
      .from("servicios")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) {
      setError("Error al restaurar");
      return;
    }
    setSelId(null);
    setForm(VACIO);
    setModoEdicion(false);
    cargar();
  }

  const filtrados = servicios.filter((s) => {
    if (!busqueda) return true;
    const t = busqueda.toLowerCase();
    return (
      s.nombre?.toLowerCase().includes(t) ||
      s.descripcion?.toLowerCase().includes(t)
    );
  });

  const formularioVacio = !selId && !esNuevo;

  return (
    <div className="md-layout">
      <div className="md-form-area">
        <div className="md-form-header">
          <h2 className={formularioVacio ? "" : "activo"}>
            {esNuevo
              ? "Nuevo servicio"
              : selId
                ? "Datos del servicio"
                : "Seleccioná un servicio"}
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {error && <span className="msg-error">{error}</span>}
            {ok && <span className="msg-ok">{ok}</span>}
            {!soloLectura && !modoEdicion && (
              <button className="btn btn-primary" onClick={nuevo}>
                + Nuevo
              </button>
            )}
            {!soloLectura && selId && !modoEdicion && !esNuevo && (
              (() => {
                const servicio = servicios.find(s => s.id === selId);
                const isEliminado = servicio?.deleted_at;
                return !isEliminado ? (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModoEdicion(true)}
                  >
                    <IconoEditar /> Editar
                  </button>
                ) : null;
              })()
            )}
            {!soloLectura && selId && !esNuevo && !modoEdicion && (
              (() => {
                const servicio = servicios.find(s => s.id === selId);
                const isEliminado = servicio?.deleted_at;
                return isEliminado ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => restaurar(selId)}
                  >
                    ↺ Restaurar
                  </button>
                ) : (
                  <button
                    className="btn btn-danger"
                    onClick={() => setConfirmEliminar(selId)}
                  >
                    <IconoEliminar /> Eliminar
                  </button>
                );
              })()
            )}
            {modoEdicion && (
              <>
                <button className="btn btn-primary" onClick={guardar}>
                  Guardar
                </button>
                <button className="btn btn-secondary" onClick={cancelar}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>

        <input
          name="nombre"
          placeholder="Nombre (ej: Armado, Pintado, Soldadura) *"
          value={form.nombre}
          onChange={handleChange}
          readOnly={!modoEdicion}
        />

        <input
          name="descripcion"
          placeholder="Descripción opcional"
          value={form.descripcion}
          onChange={handleChange}
          readOnly={!modoEdicion}
          style={{ marginTop: "0.65rem" }}
        />

        <input
          name="precio"
          type="number"
          placeholder="Precio ($) *"
          value={form.precio}
          onChange={handleChange}
          readOnly={!modoEdicion}
          style={{ marginTop: "0.65rem" }}
        />
      </div>

      <div className="md-search-area">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <input
            placeholder="Buscar servicio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1 }}
          />
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "0.5rem", 
            fontSize: "0.9rem", 
            color: "#888",
            whiteSpace: "nowrap"
          }}>
            <input
              type="checkbox"
              checked={mostrarEliminados}
              onChange={(e) => setMostrarEliminados(e.target.checked)}
            />
            Ver Eliminados
          </label>
        </div>
      </div>

      <div className="md-list-area">
        {cargando ? (
          <p style={{ color: "#888", padding: "1rem" }}>Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: "#888", padding: "1rem" }}>No hay servicios</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s) => (
                <tr
                  key={s.id}
                  className={`${selId === s.id ? "seleccionado" : ""} ${s.deleted_at ? "eliminado" : ""}`}
                  onClick={() => seleccionar(s)}
                  style={s.deleted_at ? { 
                    color: "#999", 
                    textDecoration: "line-through",
                    opacity: 0.7 
                  } : {}}
                >
                  <td>
                    {s.nombre}
                    {s.descripcion && (
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>
                        {s.descripcion}
                      </div>
                    )}
                    {s.deleted_at && (
                      <div style={{ fontSize: "0.7rem", color: "#ff6b6b", fontWeight: "bold" }}>
                        ELIMINADO
                      </div>
                    )}
                  </td>
                  <td style={{ color: "#888" }}>{s.descripcion || "—"}</td>
                  <td>${parseFloat(s.precio).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>¿Eliminar servicio?</h3>
            <p
              style={{
                color: "#888",
                fontSize: "0.9rem",
                margin: "0.5rem 0 1rem",
              }}
            >
              El servicio será archivado y no aparecerá en los listados. Podrás restaurarlo más tarde si es necesario.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={() => eliminar(confirmEliminar)}
              >
                Eliminar
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmEliminar(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
