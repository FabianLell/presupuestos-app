import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";

const VACIO = {
  nombre: "",
  apellido: "",
  telefono: "",
  dni: "",
  cuil_cuit: "",
  email: "",
  direccion: "",
};

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
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
      .from("clientes")
      .select("*")
      .order("apellido");
    if (error) setError("Error al cargar clientes");
    else setClientes(data);
    setCargando(false);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function guardar() {
    setError("");
    setOk("");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.apellido.trim()) return setError("El apellido es obligatorio");

    const userId = await getUserId();
    const datos = {
      user_id: userId,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono.trim(),
      dni: form.dni.trim(),
      cuil_cuit: form.cuil_cuit.trim(),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
    };

    if (editId) {
      const { error } = await supabase
        .from("clientes")
        .update(datos)
        .eq("id", editId);
      if (error) return setError("Error al actualizar");
      setOk("Cliente actualizado");
    } else {
      const { error } = await supabase.from("clientes").insert([datos]);
      if (error) return setError("Error al guardar");
      setOk("Cliente agregado");
    }

    setForm(VACIO);
    setEditId(null);
    cargar();
  }

  function editar(c) {
    setForm({
      nombre: c.nombre,
      apellido: c.apellido,
      telefono: c.telefono || "",
      dni: c.dni || "",
      cuil_cuit: c.cuil_cuit || "",
      email: c.email || "",
      direccion: c.direccion || "",
    });
    setEditId(c.id);
    setError("");
    setOk("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este cliente?")) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
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
      <h1>👤 Clientes</h1>

      <div className="card">
        <h2>{editId ? "Editar cliente" : "Nuevo cliente"}</h2>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <div className="form-row">
          <input
            name="nombre"
            placeholder="Nombre *"
            value={form.nombre}
            onChange={handleChange}
          />
          <input
            name="apellido"
            placeholder="Apellido *"
            value={form.apellido}
            onChange={handleChange}
          />
        </div>
        <div className="form-row">
          <input
            name="telefono"
            placeholder="Teléfono"
            value={form.telefono}
            onChange={handleChange}
          />
          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div className="form-row">
          <input
            name="dni"
            placeholder="DNI"
            value={form.dni}
            onChange={handleChange}
          />
          <input
            name="cuil_cuit"
            placeholder="CUIL / CUIT"
            value={form.cuil_cuit}
            onChange={handleChange}
          />
        </div>
        <input
          name="direccion"
          placeholder="Dirección"
          value={form.direccion}
          onChange={handleChange}
        />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-primary" onClick={guardar}>
            {editId ? "Guardar cambios" : "Agregar cliente"}
          </button>
          {editId && (
            <button className="btn btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Clientes cargados</h2>
        {cargando ? (
          <p style={{ color: "#888" }}>Cargando...</p>
        ) : clientes.length === 0 ? (
          <p style={{ color: "#888" }}>No hay clientes todavía</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>DNI</th>
                <th>CUIL/CUIT</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.apellido}</strong>, {c.nombre}
                    {c.direccion && (
                      <div style={{ fontSize: "0.8rem", color: "#888" }}>
                        {c.direccion}
                      </div>
                    )}
                  </td>
                  <td>{c.telefono || "—"}</td>
                  <td>{c.dni || "—"}</td>
                  <td>{c.cuil_cuit || "—"}</td>
                  <td>{c.email || "—"}</td>
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
