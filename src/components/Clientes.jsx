import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";
import { useDirtyForm } from "../hooks/useDirtyForm";

const VACIO = {
  nombre: "",
  apellido: "",
  telefono: "",
  dni: "",
  cuil_cuit: "",
  email: "",
  direccion: "",
};

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

export default function Clientes({ soloLectura }) {
  const [clientes, setClientes] = useState([]);
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
      .from("clientes")
      .select("*")
      .order("apellido");
    
    // Filtrar por deleted_at según el toggle
    if (!mostrarEliminados) {
      query = query.is("deleted_at", null);
    }
    
    const { data, error } = await query;
    if (error) setError("Error al cargar clientes");
    else setClientes(data || []);
    setCargando(false);
  }

  function handleChange(e) {
    const newForm = { ...form, [e.target.name]: e.target.value };
    setForm(newForm);
    dirtyForm.updateData(newForm);
  }

  function seleccionar(c) {
    // Verificar si hay cambios sin guardar antes de seleccionar
    if (dirtyForm.isDirty && modoEdicion) {
      // Mostrar confirmación usando el sistema global
      if (window.showDirtyFormModal) {
        window.showDirtyFormModal(
          async () => {
            // Guardar
            await guardar();
            // Luego seleccionar el cliente
            doSeleccionar(c);
          },
          () => {
            // Descartar
            doSeleccionar(c);
          },
          () => {
            // Cancelar - no hacer nada
          },
        );
      }
    } else {
      // Si no hay cambios, seleccionar normalmente
      doSeleccionar(c);
    }
  }

  function doSeleccionar(c) {
    setSelId(c.id);
    const clienteForm = {
      nombre: c.nombre,
      apellido: c.apellido,
      telefono: c.telefono || "",
      dni: c.dni || "",
      cuil_cuit: c.cuil_cuit || "",
      email: c.email || "",
      direccion: c.direccion || "",
    };
    setForm(clienteForm);
    dirtyForm.updateData(clienteForm);
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
      const c = clientes.find((x) => x.id === selId);
      if (c) seleccionar(c);
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
        apellido: dirtyForm.currentData.apellido || "",
        telefono: dirtyForm.currentData.telefono || "",
        dni: dirtyForm.currentData.dni || "",
        cuil_cuit: dirtyForm.currentData.cuil_cuit || "",
        email: dirtyForm.currentData.email || "",
        direccion: dirtyForm.currentData.direccion || "",
      };
    }

    if (!currentForm.nombre.trim()) {
      setError("El nombre es obligatorio");
      throw new Error("El nombre es obligatorio");
    }
    if (!currentForm.apellido.trim()) {
      setError("El apellido es obligatorio");
      throw new Error("El apellido es obligatorio");
    }

    const userId = await getUserId();
    const datos = {
      user_id: userId,
      nombre: currentForm.nombre.trim(),
      apellido: currentForm.apellido.trim(),
      telefono: currentForm.telefono.trim(),
      dni: currentForm.dni.trim(),
      cuil_cuit: currentForm.cuil_cuit.trim(),
      email: currentForm.email.trim(),
      direccion: currentForm.direccion.trim(),
    };

    if (!esNuevo && selId) {
      const { error } = await supabase
        .from("clientes")
        .update(datos)
        .eq("id", selId);
      if (error) {
        setError("Error al actualizar");
        throw new Error("Error al actualizar");
      }
      setOk("Cliente actualizado");
      setModoEdicion(false);
      dirtyForm.markAsClean();
    } else {
      const { data, error } = await supabase
        .from("clientes")
        .insert([datos])
        .select()
        .single();
      if (error) {
        setError("Error al guardar");
        throw new Error("Error al guardar");
      }
      setOk("Cliente agregado");
      setEsNuevo(false);
      setModoEdicion(false);
      setSelId(data.id);
      dirtyForm.markAsClean();
    }
    await cargar();
  }

  async function eliminar(id) {
    // Soft delete: actualizar deleted_at en lugar de borrar
    const { error } = await supabase
      .from("clientes")
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
      .from("clientes")
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

  const filtrados = clientes.filter((c) => {
    if (!busqueda) return true;
    const t = busqueda.toLowerCase();
    return (
      c.nombre?.toLowerCase().includes(t) ||
      c.apellido?.toLowerCase().includes(t) ||
      c.telefono?.toLowerCase().includes(t) ||
      c.email?.toLowerCase().includes(t) ||
      c.dni?.toLowerCase().includes(t)
    );
  });

  const formularioVacio = !selId && !esNuevo;

  return (
    <div className="md-layout">
      {/* FORMULARIO */}
      <div className="md-form-area">
        <div className="md-form-header">
          <h2 className={formularioVacio ? "" : "activo"}>
            {esNuevo
              ? "Nuevo cliente"
              : selId
                ? "Datos del cliente"
                : "Seleccioná un cliente"}
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
                const cliente = clientes.find(c => c.id === selId);
                const isEliminado = cliente?.deleted_at;
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
                const cliente = clientes.find(c => c.id === selId);
                const isEliminado = cliente?.deleted_at;
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

        <div className="form-row">
          <input
            name="nombre"
            placeholder="Nombre *"
            value={form.nombre}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
          <input
            name="apellido"
            placeholder="Apellido *"
            value={form.apellido}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
        </div>
        <div className="form-row" style={{ marginTop: "0.65rem" }}>
          <input
            name="telefono"
            placeholder="Teléfono"
            value={form.telefono}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
        </div>
        <div className="form-row" style={{ marginTop: "0.65rem" }}>
          <input
            name="dni"
            placeholder="DNI"
            value={form.dni}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
          <input
            name="cuil_cuit"
            placeholder="CUIL / CUIT"
            value={form.cuil_cuit}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
        </div>
        <input
          name="direccion"
          placeholder="Dirección"
          value={form.direccion}
          onChange={handleChange}
          readOnly={!modoEdicion}
          style={{ marginTop: "0.65rem" }}
        />
      </div>

      {/* BUSCADOR */}
      <div className="md-search-area">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <input
            placeholder="Buscar cliente..."
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

      {/* LISTADO */}
      <div className="md-list-area">
        {cargando ? (
          <p style={{ color: "#888", padding: "1rem" }}>Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: "#888", padding: "1rem" }}>No hay clientes</p>
        ) : (
          <table style={{ tableLayout: "fixed", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "40%", textAlign: "left" }}>Apellido, Nombre</th>
                <th style={{ width: "15%" }}>Teléfono</th>
                <th style={{ width: "30%" }}>Email</th>
                <th style={{ width: "15%" }}>DNI</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr
                  key={c.id}
                  className={`${selId === c.id ? "seleccionado" : ""} ${c.deleted_at ? "eliminado" : ""}`}
                  onClick={() => seleccionar(c)}
                  style={c.deleted_at ? { 
                    color: "#999", 
                    textDecoration: "line-through",
                    opacity: 0.7 
                  } : {}}
                >
                  <td style={{ textAlign: "left" }}>
                    <span>
                      {c.apellido}, {c.nombre}
                    </span>
                    {c.deleted_at && (
                      <span style={{ 
                        fontSize: "0.7rem", 
                        color: "#ff6b6b", 
                        fontWeight: "bold",
                        marginLeft: "0.5rem"
                      }}>
                        ELIMINADO
                      </span>
                    )}
                  </td>
                  <td>{c.telefono || "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>{c.dni || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CONFIRMAR ELIMINAR */}
      {confirmEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>¿Eliminar cliente?</h3>
            <p
              style={{
                color: "#666",
                fontSize: "0.9rem",
                margin: "0.5rem 0 1rem",
              }}
            >
              El cliente será archivado y no aparecerá en los listados. Podrás restaurarlo más tarde si es necesario.
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
