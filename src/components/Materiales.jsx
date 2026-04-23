import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";

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

export default function Materiales() {
  const [materiales, setMateriales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  useEffect(() => {
    cargar();
    cargarCategorias();
  }, []);

  async function cargar() {
    setCargando(true);

    const { data, error } = await supabase
      .from("materiales")
      .select(`*, categorias ( nombre )`)
      .order("nombre");

    if (error) setError("Error al cargar materiales");
    else setMateriales(data);

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
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function guardar() {
    setError("");
    setOk("");

    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.precio_unitario || isNaN(form.precio_unitario))
      return setError("El precio debe ser un número");

    const userId = await getUserId();

    const datos = {
      user_id: userId,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      unidad: form.unidad,
      precio_unitario: parseFloat(form.precio_unitario),
      categoria_id: form.categoria_id || null,
    };

    if (editId) {
      const { error } = await supabase
        .from("materiales")
        .update(datos)
        .eq("id", editId);

      if (error) return setError("Error al actualizar");
      setOk("Material actualizado");
    } else {
      const { error } = await supabase.from("materiales").insert([datos]);

      if (error) return setError("Error al guardar");
      setOk("Material agregado");
    }

    setForm(VACIO);
    setEditId(null);
    cargar();
  }

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return;

    setGuardandoCategoria(true);

    const userId = await getUserId();

    const { data, error } = await supabase
      .from("categorias")
      .insert([
        {
          user_id: userId,
          nombre: nuevaCategoria.trim(),
        },
      ])
      .select()
      .single();

    setGuardandoCategoria(false);

    if (error) {
      alert("Error al crear categoría");
      return;
    }

    setCategorias((prev) => [...prev, data]);

    setForm((prev) => ({
      ...prev,
      categoria_id: data.id,
    }));

    setNuevaCategoria("");
    setMostrarModalCategoria(false);
  }

  function editar(m) {
    setForm({
      nombre: m.nombre,
      descripcion: m.descripcion || "",
      unidad: m.unidad,
      precio_unitario: m.precio_unitario,
      categoria_id: m.categoria_id || "",
    });

    setEditId(m.id);
    setError("");
    setOk("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este material?")) return;

    const { error } = await supabase.from("materiales").delete().eq("id", id);

    if (error) return setError("Error al eliminar");

    cargar();
  }

  function cancelar() {
    setForm(VACIO);
    setEditId(null);
    setError("");
    setOk("");
  }

  function IconoEditar() {
    return (
      <svg
        width="15"
        height="15"
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
        width="15"
        height="15"
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

  return (
    <>
      <h1>🔩 Materiales</h1>

      {/* FORMULARIO */}
      <div className="card">
        <h2>{editId ? "Editar material" : "Nuevo material"}</h2>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <div className="form-block">
          <div className="form-row" style={{ gridTemplateColumns: "2fr 1fr" }}>
            <input
              name="nombre"
              placeholder="Nombre (ej: Caño 40x20)"
              value={form.nombre}
              onChange={handleChange}
            />
            <select name="unidad" value={form.unidad} onChange={handleChange}>
              {UNIDADES.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: "2fr auto" }}>
            <select
              name="categoria_id"
              value={form.categoria_id || ""}
              onChange={handleChange}
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
            <button
              type="button"
              className="btn btn-secondary"
              style={{ whiteSpace: "nowrap", padding: "0.6rem 1rem" }}
              onClick={() => setMostrarModalCategoria(true)}
            >
              + Nueva
            </button>
          </div>

          <input
            name="descripcion"
            placeholder="Descripción"
            value={form.descripcion}
            onChange={handleChange}
          />

          <input
            name="precio_unitario"
            type="number"
            placeholder="Precio unitario ($)"
            value={form.precio_unitario}
            onChange={handleChange}
          />

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary" onClick={guardar}>
              {editId ? "Guardar cambios" : "Agregar material"}
            </button>

            {editId && (
              <button className="btn btn-secondary" onClick={cancelar}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LISTADO */}
      <div className="card">
        <h2>Materiales cargados</h2>

        {cargando ? (
          <p style={{ color: "#888" }}>Cargando...</p>
        ) : materiales.length === 0 ? (
          <p style={{ color: "#888" }}>No hay materiales</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td>{m.nombre}</td>
                  <td>{m.categorias?.nombre || "—"}</td>
                  <td>{m.unidad}</td>
                  <td>
                    ${parseFloat(m.precio_unitario).toLocaleString("es-AR")}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        className="btn btn-secondary"
                        title="Editar"
                        onClick={() => editar(m)}
                      >
                        <IconoEditar />
                      </button>
                      <button
                        className="btn btn-danger"
                        title="Eliminar"
                        onClick={() => eliminar(m.id)}
                      >
                        <IconoEliminar />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {mostrarModalCategoria && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Nueva categoría</h3>

            <input
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Nombre"
            />

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                onClick={crearCategoria}
                disabled={guardandoCategoria}
              >
                Guardar
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setMostrarModalCategoria(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
