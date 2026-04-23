import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";

const VACIO = { nombre: "" };

export default function Categorias() {
  const [categorias, setCategorias] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .order("nombre");
    if (error) setError("Error al cargar categorías");
    else setCategorias(data);
    setCargando(false);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function guardar() {
    setError("");
    setOk("");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");

    const userId = await getUserId();
    const datos = {
      user_id: userId,
      nombre: form.nombre.trim(),
    };

    if (editId) {
      const { error } = await supabase
        .from("categorias")
        .update(datos)
        .eq("id", editId);
      if (error) return setError("Error al actualizar");
      setOk("Categoría actualizada");
    } else {
      const { error } = await supabase.from("categorias").insert([datos]);
      if (error) return setError("Error al guardar");
      setOk("Categoría agregada");
    }

    setForm(VACIO);
    setEditId(null);
    cargar();
  }

  function editar(c) {
    setForm({ nombre: c.nombre });
    setEditId(c.id);
    setError("");
    setOk("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("categorias").delete().eq("id", id);
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
      <h1>🏷️ Categorías</h1>

      <div className="card">
        <h2>{editId ? "Editar categoría" : "Nueva categoría"}</h2>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <input
          name="nombre"
          placeholder="Nombre de la categoría (ej: Maderas, Repuestos, Telas...)"
          value={form.nombre}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && guardar()}
        />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-primary" onClick={guardar}>
            {editId ? "Guardar cambios" : "Agregar categoría"}
          </button>
          {editId && (
            <button className="btn btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Categorías cargadas</h2>
        {cargando ? (
          <p style={{ color: "#888" }}>Cargando...</p>
        ) : categorias.length === 0 ? (
          <p style={{ color: "#888" }}>No hay categorías todavía</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        className="btn btn-secondary"
                        title="Editar"
                        onClick={() => editar(c)}
                      >
                        <IconoEditar />
                      </button>
                      <button
                        className="btn btn-danger"
                        title="Eliminar"
                        onClick={() => eliminar(c.id)}
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
    </>
  );
}
