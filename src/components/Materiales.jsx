import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";
import { useDirtyForm } from "../hooks/useDirtyForm";

const UNIDADES = [
  "unidad",
  "metro",
  "metro²",
  "kilo",
  "barra",
  "chapa",
  "tubo",
  "litro",
];

const VACIO = {
  nombre: "",
  descripcion: "",
  unidad: "unidad",
  precio_unitario: "",
  categoria_id: "",
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

export default function Materiales({ soloLectura }) {
  console.log("Materiales soloLectura:", soloLectura);
  const [materiales, setMateriales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
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

  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [errorCategoria, setErrorCategoria] = useState("");

  const [mostrarGestionCategorias, setMostrarGestionCategorias] =
    useState(false);
  const [editCategoria, setEditCategoria] = useState(null);
  const [formCategoria, setFormCategoria] = useState({ nombre: "" });
  const [okCategoria, setOkCategoria] = useState("");

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
    cargarCategorias();
  }, []);

  useEffect(() => {
    cargar();
  }, [mostrarEliminados]);

  async function cargar() {
    setCargando(true);

    let query = supabase
      .from("materiales")
      .select(`*, categorias ( nombre )`)
      .order("nombre");
    
    // Filtrar por deleted_at según el toggle
    if (!mostrarEliminados) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;

    if (error) setError("Error al cargar materiales");
    else setMateriales(data || []);

    setCargando(false);
  }

  async function cargarCategorias() {
    setCargandoCategorias(true);

    const { data } = await supabase
      .from("categorias")
      .select("id, nombre")
      .order("nombre");

    setCategorias(data || []);
    setCargandoCategorias(false);
  }

  function handleChange(e) {
    const newForm = { ...form, [e.target.name]: e.target.value };
    setForm(newForm);
    dirtyForm.updateData(newForm);
  }

  function seleccionar(m) {
    // Verificar si hay cambios sin guardar antes de seleccionar
    if (dirtyForm.isDirty && modoEdicion) {
      if (window.showDirtyFormModal) {
        window.showDirtyFormModal(
          async () => {
            await guardar();
            doSeleccionar(m);
          },
          () => {
            doSeleccionar(m);
          },
          () => {
            // Cancelar
          },
        );
      }
    } else {
      doSeleccionar(m);
    }
  }

  function doSeleccionar(m) {
    setSelId(m.id);
    const materialForm = {
      nombre: m.nombre,
      descripcion: m.descripcion || "",
      unidad: m.unidad,
      precio_unitario: m.precio_unitario || "",
      categoria_id: m.categoria_id || "",
    };
    setForm(materialForm);
    dirtyForm.updateData(materialForm);
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
      const m = materiales.find((x) => x.id === selId);
      if (m) seleccionar(m);
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
        unidad: dirtyForm.currentData.unidad || "",
        precio_unitario: dirtyForm.currentData.precio_unitario || "",
        categoria_id: dirtyForm.currentData.categoria_id || null,
      };
    }

    if (!currentForm.nombre.trim()) {
      setError("El nombre es obligatorio");
      throw new Error("El nombre es obligatorio");
    }
    if (!currentForm.precio_unitario || isNaN(currentForm.precio_unitario)) {
      setError("El precio debe ser un número");
      throw new Error("El precio debe ser un número");
    }

    const userId = await getUserId();

    const datos = {
      user_id: userId,
      nombre: currentForm.nombre.trim(),
      descripcion: currentForm.descripcion.trim(),
      unidad: currentForm.unidad,
      precio_unitario: parseFloat(currentForm.precio_unitario),
      categoria_id: currentForm.categoria_id || null,
    };

    if (!esNuevo && selId) {
      const { error } = await supabase
        .from("materiales")
        .update(datos)
        .eq("id", selId);

      if (error) {
        setError("Error al actualizar");
        throw new Error("Error al actualizar");
      }
      setOk("Material actualizado");
      setModoEdicion(false);
      dirtyForm.markAsClean();
    } else {
      const { data, error } = await supabase
        .from("materiales")
        .insert([datos])
        .select()
        .single();

      if (error) {
        setError("Error al guardar");
        throw new Error("Error al guardar");
      }
      setOk("Material agregado");
      setEsNuevo(false);
      setModoEdicion(false);
      setSelId(data.id);
      dirtyForm.markAsClean();
    }

    setForm(VACIO);
    setEditCategoria(null);
    cargar();
  }

  async function eliminar(id) {
    // Soft delete: actualizar deleted_at en lugar de borrar
    const { error } = await supabase
      .from("materiales")
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
      .from("materiales")
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

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return;
    setErrorCategoria("");
    setGuardandoCategoria(true);

    const userId = await getUserId();

    const { data, error } = await supabase
      .from("categorias")
      .insert([{ user_id: userId, nombre: nuevaCategoria.trim() }])
      .select()
      .single();

    setGuardandoCategoria(false);

    if (error) {
      if (error.code === "23505") {
        setErrorCategoria("Ya existe una categoría con ese nombre");
      } else {
        setErrorCategoria("Error al crear la categoría");
      }
      return;
    }

    setCategorias((prev) =>
      [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    setForm((prev) => ({ ...prev, categoria_id: data.id }));
    setNuevaCategoria("");
    setErrorCategoria("");
    setMostrarModalCategoria(false);
  }

  async function guardarCategoria() {
    setErrorCategoria("");
    setOkCategoria("");
    if (!formCategoria.nombre.trim())
      return setErrorCategoria("El nombre es obligatorio");

    const userId = await getUserId();

    if (editCategoria) {
      const { error } = await supabase
        .from("categorias")
        .update({ nombre: formCategoria.nombre.trim(), user_id: userId })
        .eq("id", editCategoria.id);
      if (error) {
        if (error.code === "23505")
          setErrorCategoria("Ya existe una categoría con ese nombre");
        else setErrorCategoria("Error al actualizar");
        return;
      }
      setOkCategoria("Categoría actualizada");
    } else {
      const { data, error } = await supabase
        .from("categorias")
        .insert([{ user_id: userId, nombre: formCategoria.nombre.trim() }])
        .select()
        .single();
      if (error) {
        if (error.code === "23505")
          setErrorCategoria("Ya existe una categoría con ese nombre");
        else setErrorCategoria("Error al guardar");
        return;
      }
      setCategorias((prev) =>
        [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );
      setOkCategoria("Categoría agregada");
    }

    setFormCategoria({ nombre: "" });
    setEditCategoria(null);
    cargarCategorias();
  }

  function editarCategoria(c) {
    setEditCategoria(c);
    setFormCategoria({ nombre: c.nombre });
    setErrorCategoria("");
    setOkCategoria("");
  }

  async function eliminarCategoria(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) return setErrorCategoria("Error al eliminar");
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  }

  const filtrados = materiales.filter((m) => {
    if (!busqueda) return true;
    const t = busqueda.toLowerCase();
    return (
      m.nombre?.toLowerCase().includes(t) ||
      m.descripcion?.toLowerCase().includes(t) ||
      m.unidad?.toLowerCase().includes(t) ||
      m.categorias?.nombre?.toLowerCase().includes(t)
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
              ? "Nuevo material"
              : selId
                ? "Datos del material"
                : "Seleccioná un material"}
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
                const material = materiales.find(m => m.id === selId);
                const isEliminado = material?.deleted_at;
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
                const material = materiales.find(m => m.id === selId);
                const isEliminado = material?.deleted_at;
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
            placeholder="Nombre (ej: Caño 40x20) *"
            value={form.nombre}
            onChange={handleChange}
            readOnly={!modoEdicion}
          />
          <select
            name="unidad"
            value={form.unidad}
            onChange={handleChange}
            disabled={!modoEdicion}
          >
            {UNIDADES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="form-row" style={{ marginTop: "0.65rem" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <select
              name="categoria_id"
              value={form.categoria_id || ""}
              onChange={handleChange}
              disabled={!modoEdicion}
              style={{ width: "100%" }}
            >
              <option value="">
                {cargandoCategorias ? "Cargando..." : "Sin categoría"}
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          {!soloLectura && modoEdicion && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ whiteSpace: "nowrap", padding: "0.6rem 1rem" }}
              onClick={() => setMostrarModalCategoria(true)}
            >
              + Nueva
            </button>
          )}
        </div>

        <input
          name="descripcion"
          placeholder="Descripción"
          value={form.descripcion}
          onChange={handleChange}
          readOnly={!modoEdicion}
          style={{ marginTop: "0.65rem" }}
        />

        <input
          name="precio_unitario"
          type="number"
          placeholder="Precio unitario ($) *"
          value={form.precio_unitario}
          onChange={handleChange}
          readOnly={!modoEdicion}
          style={{ marginTop: "0.65rem" }}
        />
      </div>

      {/* BUSCADOR */}
      <div className="md-search-area">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <input
            placeholder="Buscar material..."
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
          {!soloLectura && (
            <button
              className="btn btn-secondary"
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 0.75rem",
              }}
              onClick={() => {
                setMostrarGestionCategorias(true);
                setErrorCategoria("");
                setOkCategoria("");
                setFormCategoria({ nombre: "" });
                setEditCategoria(null);
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>🏷️</span>

              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: "1.1",
                }}
              >
                <span>Categorías</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* LISTADO */}
      <div className="md-list-area">
        {cargando ? (
          <p style={{ color: "#888", padding: "1rem" }}>Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p style={{ color: "#888", padding: "1rem" }}>No hay materiales</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <tr
                  key={m.id}
                  className={`${selId === m.id ? "seleccionado" : ""} ${m.deleted_at ? "eliminado" : ""}`}
                  onClick={() => seleccionar(m)}
                  style={m.deleted_at ? { 
                    color: "#999", 
                    textDecoration: "line-through",
                    opacity: 0.7 
                  } : {}}
                >
                  <td>
                    {m.nombre}
                    {m.descripcion && (
                      <div style={{ fontSize: "0.75rem", color: "#888" }}>
                        {m.descripcion}
                      </div>
                    )}
                    {m.deleted_at && (
                      <div style={{ fontSize: "0.7rem", color: "#ff6b6b", fontWeight: "bold" }}>
                        ELIMINADO
                      </div>
                    )}
                  </td>
                  <td>{m.categorias?.nombre || "—"}</td>
                  <td>{m.unidad}</td>
                  <td>
                    ${parseFloat(m.precio_unitario).toLocaleString("es-AR")}
                  </td>
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
            <h3>¿Eliminar material?</h3>
            <p
              style={{
                color: "#888",
                fontSize: "0.9rem",
                margin: "0.5rem 0 1rem",
              }}
            >
              El material será archivado y no aparecerá en los listados. Podrás restaurarlo más tarde si es necesario.
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

      {/* MODAL NUEVA CATEGORÍA */}
      {mostrarModalCategoria && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nueva categoría</h3>
            {errorCategoria && (
              <p className="msg-error" style={{ marginTop: "0.5rem" }}>
                {errorCategoria}
              </p>
            )}
            <input
              value={nuevaCategoria}
              onChange={(e) => {
                setNuevaCategoria(e.target.value);
                setErrorCategoria("");
              }}
              placeholder="Nombre"
              onKeyDown={(e) => e.key === "Enter" && crearCategoria()}
            />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                onClick={crearCategoria}
                disabled={guardandoCategoria}
              >
                {guardandoCategoria ? "Guardando..." : "Guardar"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setMostrarModalCategoria(false);
                  setErrorCategoria("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN CATEGORÍAS */}
      {mostrarGestionCategorias && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: "480px", maxWidth: "95%" }}>
            <h3 style={{ margin: 0, marginBottom: "1rem" }}>
              🏷️ Gestionar categorías
            </h3>

            {errorCategoria && <p className="msg-error">{errorCategoria}</p>}
            {okCategoria && <p className="msg-ok">{okCategoria}</p>}

            <div
              style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
            >
              <input
                placeholder={
                  editCategoria ? "Editar nombre..." : "Nueva categoría..."
                }
                value={formCategoria.nombre}
                onChange={(e) => {
                  setFormCategoria({ nombre: e.target.value });
                  setErrorCategoria("");
                  setOkCategoria("");
                }}
                onKeyDown={(e) => e.key === "Enter" && guardarCategoria()}
                style={{ margin: 0 }}
              />
              <button
                className="btn btn-primary"
                onClick={guardarCategoria}
                style={{ whiteSpace: "nowrap" }}
              >
                {editCategoria ? "Guardar" : "+ Agregar"}
              </button>
              {editCategoria && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditCategoria(null);
                    setFormCategoria({ nombre: "" });
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {categorias.length === 0 ? (
              <p style={{ color: "#888", fontSize: "0.9rem" }}>
                No hay categorías todavía
              </p>
            ) : (
              <table>
                <tbody>
                  {categorias.map((c) => (
                    <tr key={c.id}>
                      <td
                        style={{
                          color:
                            editCategoria?.id === c.id ? "#60a5fa" : "#f0f0f0",
                        }}
                      >
                        {c.nombre}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            className="btn btn-secondary"
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              editarCategoria(c);
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn btn-danger"
                            title="Eliminar"
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarCategoria(c.id);
                            }}
                          >
                            <svg
                              width="13"
                              height="13"
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
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "1rem" }}
              onClick={() => {
                setMostrarGestionCategorias(false);
                setEditCategoria(null);
                setFormCategoria({ nombre: "" });
                setErrorCategoria("");
                setOkCategoria("");
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
