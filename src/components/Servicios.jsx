import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";

const VACIO = { nombre: "", descripcion: "", precio: "" };

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
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
      .from("servicios")
      .select("*")
      .order("nombre");
    if (error) setError("Error al cargar servicios");
    else setServicios(data);
    setCargando(false);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function guardar() {
    setError("");
    setOk("");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.precio || isNaN(form.precio))
      return setError("El precio debe ser un número");

    const userId = await getUserId();
    const datos = {
      user_id: userId,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio: parseFloat(form.precio),
    };

    if (editId) {
      const { error } = await supabase
        .from("servicios")
        .update(datos)
        .eq("id", editId);
      if (error) return setError("Error al actualizar");
      setOk("Servicio actualizado");
    } else {
      const { error } = await supabase.from("servicios").insert([datos]);
      if (error) return setError("Error al guardar");
      setOk("Servicio agregado");
    }

    setForm(VACIO);
    setEditId(null);
    cargar();
  }

  function editar(s) {
    setForm({
      nombre: s.nombre,
      descripcion: s.descripcion || "",
      precio: s.precio,
    });
    setEditId(s.id);
    setError("");
    setOk("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este servicio?")) return;
    const { error } = await supabase.from("servicios").delete().eq("id", id);
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
      <h1>🔧 Servicios</h1>

      <div className="card">
        <h2>{editId ? "Editar servicio" : "Nuevo servicio"}</h2>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <input
          name="nombre"
          placeholder="Nombre (ej: Armado, Pintado, Soldadura)"
          value={form.nombre}
          onChange={handleChange}
        />
        <input
          name="descripcion"
          placeholder="Descripción opcional"
          value={form.descripcion}
          onChange={handleChange}
        />
        <input
          name="precio"
          type="number"
          placeholder="Precio ($)"
          value={form.precio}
          onChange={handleChange}
        />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-primary" onClick={guardar}>
            {editId ? "Guardar cambios" : "Agregar servicio"}
          </button>
          {editId && (
            <button className="btn btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Servicios cargados</h2>
        {cargando ? (
          <p style={{ color: "#888" }}>Cargando...</p>
        ) : servicios.length === 0 ? (
          <p style={{ color: "#888" }}>No hay servicios todavía</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <tr key={s.id}>
                  <td>{s.nombre}</td>
                  <td style={{ color: "#888" }}>{s.descripcion || "—"}</td>
                  <td>${parseFloat(s.precio).toLocaleString("es-AR")}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        className="btn btn-secondary"
                        title="Editar"
                        onClick={() => editar(s)}
                      >
                        <IconoEditar />
                      </button>
                      <button
                        className="btn btn-danger"
                        title="Eliminar"
                        onClick={() => eliminar(s.id)}
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
