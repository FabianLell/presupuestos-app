import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase, getUserId } from "../supabase";

const HOY = new Date().toISOString().split("T")[0];

const FORM_VACIO = {
  cliente_id: "",
  fecha: HOY,
  observaciones: "",
  estado: "borrador",
};

export default function Presupuestos({ perfil }) {
  const [vista, setVista] = useState("lista");
  const [presupuestos, setPresupuestos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [form, setForm] = useState(FORM_VACIO);
  const [itemsMat, setItemsMat] = useState([]);
  const [itemsSer, setItemsSer] = useState([]);
  const [matSel, setMatSel] = useState("");
  const [matCant, setMatCant] = useState(1);
  const [serSel, setSerSel] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("");
  const [presupuestoActual, setPresupuestoActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [categorias, setCategorias] = useState([]);
  const pdfRef = useRef(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);
    const [p, c, m, s, cat] = await Promise.all([
      supabase
        .from("presupuestos")
        .select(`*, clientes(nombre, apellido)`)
        .order("created_at", { ascending: false }),
      supabase.from("clientes").select("*").order("apellido"),
      supabase
        .from("materiales")
        .select("*, categorias(nombre)")
        .order("nombre"),
      supabase.from("servicios").select("*").order("nombre"),
      supabase.from("categorias").select("id, nombre").order("nombre"),
    ]);
    if (p.data) setPresupuestos(p.data);
    if (c.data) setClientes(c.data);
    if (m.data) setMateriales(m.data);
    if (s.data) setServicios(s.data);
    if (cat.data) setCategorias(cat.data);
    setCargando(false);
  }

  async function cargarDetalle(id) {
    const [pm, ps] = await Promise.all([
      supabase
        .from("presupuesto_materiales")
        .select(`*, materiales(nombre, unidad)`)
        .eq("presupuesto_id", id),
      supabase
        .from("presupuesto_servicios")
        .select(`*, servicios(nombre)`)
        .eq("presupuesto_id", id),
    ]);
    const p = presupuestos.find((x) => x.id === id);
    setPresupuestoActual({
      ...p,
      items_materiales: pm.data || [],
      items_servicios: ps.data || [],
    });
    setVista("detalle");
  }

  async function cargarParaEditar(p) {
    const [pm, ps] = await Promise.all([
      supabase
        .from("presupuesto_materiales")
        .select(`*, materiales(nombre, unidad, precio_unitario)`)
        .eq("presupuesto_id", p.id),
      supabase
        .from("presupuesto_servicios")
        .select(`*, servicios(nombre)`)
        .eq("presupuesto_id", p.id),
    ]);
    setForm({
      cliente_id: p.cliente_id,
      fecha: p.fecha,
      observaciones: p.observaciones || "",
      estado: p.estado || "borrador",
    });
    setItemsMat(
      (pm.data || []).map((i) => ({
        material_id: i.material_id,
        nombre: i.materiales?.nombre,
        unidad: i.materiales?.unidad,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      })),
    );
    setItemsSer(
      (ps.data || []).map((i) => ({
        servicio_id: i.servicio_id,
        nombre: i.servicios?.nombre,
        precio: i.precio,
        descripcion: i.descripcion || "",
      })),
    );
    setEditId(p.id);
    setError("");
    setVista("nuevo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function agregarMaterial() {
    if (!matSel) return;
    const mat = materiales.find((m) => m.id === matSel);
    if (!mat) return;
    const cant = parseFloat(matCant) || 1;
    const existe = itemsMat.find((i) => i.material_id === matSel);
    if (existe) {
      setItemsMat(
        itemsMat.map((i) =>
          i.material_id === matSel
            ? {
                ...i,
                cantidad: i.cantidad + cant,
                subtotal: (i.cantidad + cant) * i.precio_unitario,
              }
            : i,
        ),
      );
    } else {
      setItemsMat([
        ...itemsMat,
        {
          material_id: mat.id,
          nombre: mat.nombre,
          unidad: mat.unidad,
          cantidad: cant,
          precio_unitario: mat.precio_unitario,
          subtotal: cant * mat.precio_unitario,
        },
      ]);
    }
    setMatSel("");
    setMatCant(1);
  }

  function quitarMaterial(material_id) {
    setItemsMat(itemsMat.filter((i) => i.material_id !== material_id));
  }

  function agregarServicio() {
    if (!serSel) return;
    const ser = servicios.find((s) => s.id === serSel);
    if (!ser) return;
    if (itemsSer.find((i) => i.servicio_id === serSel)) return;
    setItemsSer([
      ...itemsSer,
      {
        servicio_id: ser.id,
        nombre: ser.nombre,
        precio: ser.precio,
        descripcion: ser.descripcion || "",
      },
    ]);
    setSerSel("");
  }

  function quitarServicio(servicio_id) {
    setItemsSer(itemsSer.filter((i) => i.servicio_id !== servicio_id));
  }

  function actualizarServicio(servicio_id, campo, valor) {
    setItemsSer(
      itemsSer.map((i) =>
        i.servicio_id === servicio_id ? { ...i, [campo]: valor } : i,
      ),
    );
  }

  const presupuestosFiltrados = presupuestos.filter((p) => {
    if (!filtroCliente) return true;
    const nombre =
      `${p.clientes?.apellido} ${p.clientes?.nombre}`.toLowerCase();
    return nombre.includes(filtroCliente.toLowerCase());
  });

  const totalMat = itemsMat.reduce((acc, i) => acc + i.subtotal, 0);
  const totalSer = itemsSer.reduce(
    (acc, i) => acc + (parseFloat(i.precio) || 0),
    0,
  );
  const totalGen = totalMat + totalSer;

  async function guardarPresupuesto() {
    setError("");
    if (!form.cliente_id) return setError("Seleccioná un cliente");
    if (itemsMat.length === 0 && itemsSer.length === 0)
      return setError("Agregá al menos un material o servicio");
    setGuardando(true);

    const userId = await getUserId();
    const datosPresupuesto = {
      user_id: userId,
      cliente_id: form.cliente_id,
      fecha: form.fecha,
      observaciones: form.observaciones.trim(),
      estado: form.estado,
      total_materiales: totalMat,
      total_servicios: totalSer,
      total: totalGen,
    };

    let pid = editId;
    if (editId) {
      const { error: pErr } = await supabase
        .from("presupuestos")
        .update(datosPresupuesto)
        .eq("id", editId);
      if (pErr) {
        setError("Error al actualizar el presupuesto");
        setGuardando(false);
        return;
      }
      await supabase
        .from("presupuesto_materiales")
        .delete()
        .eq("presupuesto_id", editId);
      await supabase
        .from("presupuesto_servicios")
        .delete()
        .eq("presupuesto_id", editId);
    } else {
      const { data: pData, error: pErr } = await supabase
        .from("presupuestos")
        .insert([datosPresupuesto])
        .select()
        .single();
      if (pErr) {
        setError("Error al guardar el presupuesto");
        setGuardando(false);
        return;
      }
      pid = pData.id;
    }

    if (itemsMat.length > 0) {
      await supabase.from("presupuesto_materiales").insert(
        itemsMat.map((i) => ({
          presupuesto_id: pid,
          material_id: i.material_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal: i.subtotal,
        })),
      );
    }
    if (itemsSer.length > 0) {
      await supabase.from("presupuesto_servicios").insert(
        itemsSer.map((i) => ({
          presupuesto_id: pid,
          servicio_id: i.servicio_id,
          precio: parseFloat(i.precio) || 0,
          descripcion: i.descripcion,
        })),
      );
    }

    setGuardando(false);
    setEditId(null);
    setForm(FORM_VACIO);
    setItemsMat([]);
    setItemsSer([]);
    await cargarTodo();
    setVista("lista");
  }

  async function descargarPDFDesdeLista(id) {
    await cargarDetalle(id);
    setTimeout(async () => {
      await generarPDF();
      setVista("lista");
    }, 500);
  }

  async function eliminarPresupuesto(id) {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    await supabase.from("presupuestos").delete().eq("id", id);
    cargarTodo();
  }

  async function generarPDF() {
    const elemento = pdfRef.current;
    if (!elemento) return;
    elemento.style.display = "block";
    await new Promise((r) => setTimeout(r, 300));
    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    elemento.style.display = "none";
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    const nombreCliente = presupuestoActual?.clientes
      ? `${presupuestoActual.clientes.apellido}_${presupuestoActual.clientes.nombre}`
      : "cliente";
    pdf.save(`Presupuesto_${presupuestoActual.numero}_${nombreCliente}.pdf`);
  }

  function IconoVer() {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
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

  function IconoPDF() {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
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

  function badgeEstado(estado) {
    const estilos = {
      borrador: { background: "#2a2a2a", color: "#888" },
      enviado: { background: "#1e3a5f", color: "#60a5fa" },
      aprobado: { background: "#14532d", color: "#4ade80" },
      rechazado: { background: "#450a0a", color: "#f87171" },
    };
    const e = estilos[estado] || estilos.borrador;
    return (
      <span
        style={{
          ...e,
          padding: "0.2rem 0.7rem",
          borderRadius: "20px",
          fontSize: "0.78rem",
          fontWeight: 500,
        }}
      >
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </span>
    );
  }

  if (cargando)
    return <p style={{ color: "#888", padding: "2rem" }}>Cargando...</p>;

  // ── VISTA DETALLE ──────────────────────────────────────────
  if (vista === "detalle" && presupuestoActual) {
    const p = presupuestoActual;
    const cliente = clientes.find((c) => c.id === p.cliente_id);
    return (
      <>
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => {
              setVista("lista");
              setEditId(null);
            }}
          >
            ← Volver
          </button>
          <h1 style={{ margin: 0 }}>Presupuesto #{p.numero}</h1>
          <button
            className="btn btn-primary"
            onClick={generarPDF}
            style={{ marginLeft: "auto" }}
          >
            📄 Descargar PDF
          </button>
        </div>

        <div className="solo-print" style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}
            >
              {perfil?.logo_url ? (
                <img
                  src={perfil.logo_url}
                  alt="Logo"
                  style={{ height: "80px", objectFit: "contain" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.3rem",
                      fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    {(perfil?.nombre_negocio || "?")
                      .trim()
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  {perfil?.nombre_negocio && (
                    <p
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        color: "#333",
                        textAlign: "center",
                      }}
                    >
                      {perfil.nombre_negocio}
                    </p>
                  )}
                </div>
              )}
              <div
                style={{
                  color: "#333",
                  fontSize: "0.82rem",
                  lineHeight: "1.7",
                }}
              >
                {perfil?.cuil_cuit && <p>CUIL: {perfil.cuil_cuit}</p>}
                {perfil?.direccion && <p>{perfil.direccion}</p>}
                {perfil?.telefono && <p>Tel: {perfil.telefono}</p>}
                {perfil?.email_contacto && <p>{perfil.email_contacto}</p>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <h1
                style={{
                  fontSize: "2rem",
                  color: "#000",
                  margin: 0,
                  letterSpacing: "0.05em",
                }}
              >
                PRESUPUESTO
              </h1>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "#555",
                  marginTop: "0.2rem",
                }}
              >
                DOCUMENTO NO VÁLIDO COMO FACTURA
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#333",
                  marginTop: "0.5rem",
                }}
              >
                {new Date(p.fecha + "T12:00:00")
                  .toLocaleDateString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </p>
            </div>
          </div>
          <div
            style={{
              marginTop: "1rem",
              borderBottom: "2px solid #333",
              paddingBottom: "0.5rem",
            }}
          >
            <p style={{ color: "#333", fontSize: "0.9rem" }}>
              <strong>Cliente:</strong>{" "}
              {cliente ? `${cliente.apellido}, ${cliente.nombre}` : "—"}
              {cliente?.telefono && (
                <span style={{ marginLeft: "1.5rem" }}>
                  Tel: {cliente.telefono}
                </span>
              )}
              {cliente?.direccion && (
                <span style={{ marginLeft: "1.5rem" }}>
                  {cliente.direccion}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="card no-print" style={{ borderColor: "#3a3a3a" }}>
          <h2>Cliente</h2>
          {cliente ? (
            <p>
              <strong>
                {cliente.apellido}, {cliente.nombre}
              </strong>
              {cliente.telefono && (
                <span style={{ color: "#888", marginLeft: "1rem" }}>
                  {cliente.telefono}
                </span>
              )}
            </p>
          ) : (
            <p style={{ color: "#888" }}>Cliente no encontrado</p>
          )}
          <p style={{ color: "#888", marginTop: "0.5rem" }}>
            Fecha: {p.fecha} &nbsp;|&nbsp; Estado: {badgeEstado(p.estado)}
          </p>
          {p.observaciones && (
            <p style={{ marginTop: "0.5rem" }}>{p.observaciones}</p>
          )}
        </div>

        {p.items_materiales.length > 0 && (
          <div className="card">
            <h2>Materiales</h2>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Unidad</th>
                  <th>Cantidad</th>
                  <th>Precio unit.</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {p.items_materiales.map((i) => (
                  <tr key={i.id}>
                    <td>{i.materiales?.nombre}</td>
                    <td>
                      <span className="badge badge-blue">
                        {i.materiales?.unidad}
                      </span>
                    </td>
                    <td>{i.cantidad}</td>
                    <td>
                      ${parseFloat(i.precio_unitario).toLocaleString("es-AR")}
                    </td>
                    <td>${parseFloat(i.subtotal).toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total-box" style={{ marginTop: "1rem" }}>
              <span>Total materiales</span>
              <strong>
                ${parseFloat(p.total_materiales).toLocaleString("es-AR")}
              </strong>
            </div>
          </div>
        )}

        {p.items_servicios.length > 0 && (
          <div className="card">
            <h2>Servicios</h2>
            <table>
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Descripción</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {p.items_servicios.map((i) => (
                  <tr key={i.id}>
                    <td>{i.servicios?.nombre}</td>
                    <td style={{ color: "#888" }}>{i.descripcion || "—"}</td>
                    <td>${parseFloat(i.precio).toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="total-box" style={{ marginTop: "1rem" }}>
              <span>Total servicios</span>
              <strong>
                ${parseFloat(p.total_servicios).toLocaleString("es-AR")}
              </strong>
            </div>
          </div>
        )}

        <div
          className="total-box"
          style={{
            fontSize: "1.2rem",
            marginTop: "1rem",
            borderColor: "#2563eb",
            background: "#1e3a5f",
          }}
        >
          <span style={{ color: "#93c5fd" }}>TOTAL GENERAL</span>
          <strong style={{ color: "#fff", fontSize: "1.3rem" }}>
            ${parseFloat(p.total).toLocaleString("es-AR")}
          </strong>
        </div>

        <div
          className="solo-print"
          style={{
            marginTop: "3rem",
            borderTop: "1px solid #ccc",
            paddingTop: "1rem",
            color: "#444",
            fontSize: "0.85rem",
          }}
        >
          <p>{perfil?.leyenda_presupuesto || ""}</p>
        </div>

        <div
          ref={pdfRef}
          style={{
            display: "none",
            position: "fixed",
            top: 0,
            left: 0,
            width: "794px",
            padding: "40px",
            background: "#fff",
            color: "#000",
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            zIndex: -1,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}
            >
              {perfil?.logo_url ? (
                <img
                  src={perfil.logo_url}
                  alt="Logo"
                  style={{ height: "80px", objectFit: "contain" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.3rem",
                      fontWeight: "700",
                      color: "#fff",
                    }}
                  >
                    {(perfil?.nombre_negocio || "?")
                      .trim()
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  {perfil?.nombre_negocio && (
                    <p
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        color: "#333",
                        textAlign: "center",
                      }}
                    >
                      {perfil.nombre_negocio}
                    </p>
                  )}
                </div>
              )}
              <div
                style={{ fontSize: "12px", lineHeight: "1.8", color: "#333" }}
              >
                {perfil?.cuil_cuit && <p>CUIL: {perfil.cuil_cuit}</p>}
                {perfil?.direccion && <p>{perfil.direccion}</p>}
                {perfil?.telefono && <p>Tel: {perfil.telefono}</p>}
                {perfil?.email_contacto && <p>{perfil.email_contacto}</p>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <h1
                style={{
                  fontSize: "28px",
                  margin: 0,
                  letterSpacing: "2px",
                  color: "#000",
                }}
              >
                PRESUPUESTO
              </h1>
              <p style={{ fontSize: "10px", color: "#555", margin: "4px 0" }}>
                DOCUMENTO NO VÁLIDO COMO FACTURA
              </p>
              <p style={{ fontSize: "12px", color: "#333", margin: 0 }}>
                {new Date(presupuestoActual.fecha + "T12:00:00")
                  .toLocaleDateString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                  .replace(/^\w/, (c) => c.toUpperCase())}
              </p>
            </div>
          </div>
          <div
            style={{
              borderBottom: "2px solid #333",
              paddingBottom: "10px",
              marginBottom: "16px",
            }}
          >
            <p>
              <strong>Cliente:</strong>{" "}
              {cliente ? `${cliente.apellido}, ${cliente.nombre}` : "—"}
              {cliente?.telefono && (
                <span style={{ marginLeft: "24px" }}>
                  Tel: {cliente.telefono}
                </span>
              )}
              {cliente?.direccion && (
                <span style={{ marginLeft: "24px" }}>{cliente.direccion}</span>
              )}
            </p>
            {presupuestoActual.observaciones && (
              <p style={{ marginTop: "6px", color: "#444" }}>
                {presupuestoActual.observaciones}
              </p>
            )}
          </div>
          {presupuestoActual.items_materiales?.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h2
                style={{
                  fontSize: "13px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#333",
                }}
              >
                MATERIALES
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        border: "1px solid #ddd",
                      }}
                    >
                      Material
                    </th>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        border: "1px solid #ddd",
                      }}
                    >
                      Unidad
                    </th>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "center",
                        border: "1px solid #ddd",
                      }}
                    >
                      Cantidad
                    </th>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        border: "1px solid #ddd",
                      }}
                    >
                      Precio unit.
                    </th>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        border: "1px solid #ddd",
                      }}
                    >
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestoActual.items_materiales.map((i, idx) => (
                    <tr
                      key={i.id}
                      style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                    >
                      <td
                        style={{ padding: "5px 8px", border: "1px solid #ddd" }}
                      >
                        {i.materiales?.nombre}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                        }}
                      >
                        {i.materiales?.unidad}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          border: "1px solid #ddd",
                          textAlign: "center",
                        }}
                      >
                        {i.cantidad}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          border: "1px solid #ddd",
                          textAlign: "right",
                        }}
                      >
                        ${parseFloat(i.precio_unitario).toLocaleString("es-AR")}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          border: "1px solid #ddd",
                          textAlign: "right",
                        }}
                      >
                        ${parseFloat(i.subtotal).toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  textAlign: "right",
                  marginTop: "6px",
                  fontSize: "12px",
                }}
              >
                <strong>
                  Total materiales: $
                  {parseFloat(
                    presupuestoActual.total_materiales,
                  ).toLocaleString("es-AR")}
                </strong>
              </div>
            </div>
          )}
          {presupuestoActual.items_servicios?.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h2
                style={{
                  fontSize: "13px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#333",
                }}
              >
                SERVICIOS
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        border: "1px solid #ddd",
                      }}
                    >
                      Servicio
                    </th>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        border: "1px solid #ddd",
                      }}
                    >
                      Descripción
                    </th>
                    <th
                      style={{
                        padding: "6px 8px",
                        textAlign: "right",
                        border: "1px solid #ddd",
                      }}
                    >
                      Precio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestoActual.items_servicios.map((i, idx) => (
                    <tr
                      key={i.id}
                      style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                    >
                      <td
                        style={{ padding: "5px 8px", border: "1px solid #ddd" }}
                      >
                        {i.servicios?.nombre}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          border: "1px solid #ddd",
                          color: "#555",
                        }}
                      >
                        {i.descripcion || "—"}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          border: "1px solid #ddd",
                          textAlign: "right",
                        }}
                      >
                        ${parseFloat(i.precio).toLocaleString("es-AR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  textAlign: "right",
                  marginTop: "6px",
                  fontSize: "12px",
                }}
              >
                <strong>
                  Total servicios: $
                  {parseFloat(presupuestoActual.total_servicios).toLocaleString(
                    "es-AR",
                  )}
                </strong>
              </div>
            </div>
          )}
          <div
            style={{
              borderTop: "2px solid #333",
              paddingTop: "10px",
              textAlign: "right",
              fontSize: "15px",
            }}
          >
            <strong>
              TOTAL GENERAL: $
              {parseFloat(presupuestoActual.total).toLocaleString("es-AR")}
            </strong>
          </div>
          <div
            style={{
              marginTop: "40px",
              borderTop: "1px solid #ccc",
              paddingTop: "10px",
              fontSize: "10px",
              color: "#666",
            }}
          >
            <p>{perfil?.leyenda_presupuesto || ""}</p>
          </div>
        </div>
      </>
    );
  }

  // ── VISTA NUEVO ────────────────────────────────────────────
  if (vista === "nuevo") {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={() => {
              setVista("lista");
              setEditId(null);
            }}
          >
            ← Volver
          </button>
          <h1 style={{ margin: 0 }}>
            {editId ? "Editar presupuesto" : "Nuevo presupuesto"}
          </h1>
        </div>

        {error && <p className="msg-error">{error}</p>}

        <div className="card">
          <h2>Datos generales</h2>
          <div className="form-row">
            <select
              name="cliente_id"
              value={form.cliente_id}
              onChange={handleChange}
            >
              <option value="">— Seleccioná un cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apellido}, {c.nombre}
                </option>
              ))}
            </select>
            <input
              name="fecha"
              type="date"
              value={form.fecha}
              onChange={handleChange}
            />
          </div>
          <div className="form-row">
            <input
              name="observaciones"
              placeholder="Observaciones (opcional)"
              value={form.observaciones}
              onChange={handleChange}
            />
            <select name="estado" value={form.estado} onChange={handleChange}>
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
        </div>

        <div className="card">
          <h2>Agregar materiales</h2>
          <div className="form-row">
            <select
              value={categoriaSel}
              onChange={(e) => {
                setCategoriaSel(e.target.value);
                setMatSel("");
              }}
            >
              <option value="">— Todas las categorías —</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <select value={matSel} onChange={(e) => setMatSel(e.target.value)}>
              <option value="">— Seleccioná un material —</option>
              {materiales
                .filter(
                  (m) => !categoriaSel || m.categorias?.nombre === categoriaSel,
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} — $
                    {parseFloat(m.precio_unitario).toLocaleString("es-AR")} /{" "}
                    {m.unidad}
                  </option>
                ))}
            </select>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Cantidad"
              value={matCant}
              onChange={(e) => setMatCant(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={agregarMaterial}>
            + Agregar material
          </button>
          {itemsMat.length > 0 && (
            <>
              <table style={{ marginTop: "1rem" }}>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Cant.</th>
                    <th>Precio unit.</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itemsMat.map((i) => (
                    <tr key={i.material_id}>
                      <td>
                        {i.nombre}{" "}
                        <span className="badge badge-blue">{i.unidad}</span>
                      </td>
                      <td>
                        <input
                          style={{ margin: 0, width: "80px" }}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={i.cantidad}
                          onChange={(e) => {
                            const cant = parseFloat(e.target.value) || 0;
                            setItemsMat(
                              itemsMat.map((m) =>
                                m.material_id === i.material_id
                                  ? {
                                      ...m,
                                      cantidad: cant,
                                      subtotal: cant * m.precio_unitario,
                                    }
                                  : m,
                              ),
                            );
                          }}
                        />
                      </td>
                      <td>
                        ${parseFloat(i.precio_unitario).toLocaleString("es-AR")}
                      </td>
                      <td>${parseFloat(i.subtotal).toLocaleString("es-AR")}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => quitarMaterial(i.material_id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="total-box">
                <span>Total materiales</span>
                <strong>${totalMat.toLocaleString("es-AR")}</strong>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2>Agregar servicios</h2>
          <div className="form-row">
            <select value={serSel} onChange={(e) => setSerSel(e.target.value)}>
              <option value="">— Seleccioná un servicio —</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} — ${parseFloat(s.precio).toLocaleString("es-AR")}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={agregarServicio}>
              + Agregar servicio
            </button>
          </div>
          {itemsSer.length > 0 && (
            <>
              <table style={{ marginTop: "1rem" }}>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Descripción / nota</th>
                    <th>Precio</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {itemsSer.map((i) => (
                    <tr key={i.servicio_id}>
                      <td style={{ whiteSpace: "nowrap" }}>{i.nombre}</td>
                      <td>
                        <input
                          style={{ margin: 0 }}
                          placeholder="Nota opcional..."
                          value={i.descripcion}
                          onChange={(e) =>
                            actualizarServicio(
                              i.servicio_id,
                              "descripcion",
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          style={{ margin: 0, width: "120px" }}
                          type="number"
                          value={i.precio}
                          onChange={(e) =>
                            actualizarServicio(
                              i.servicio_id,
                              "precio",
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => quitarServicio(i.servicio_id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="total-box">
                <span>Total servicios</span>
                <strong>${totalSer.toLocaleString("es-AR")}</strong>
              </div>
            </>
          )}
        </div>

        {(itemsMat.length > 0 || itemsSer.length > 0) && (
          <div
            className="total-box"
            style={{
              fontSize: "1.2rem",
              marginTop: "1rem",
              borderColor: "#2563eb",
              background: "#1e3a5f",
            }}
          >
            <span style={{ color: "#93c5fd" }}>TOTAL GENERAL</span>
            <strong style={{ color: "#fff", fontSize: "1.3rem" }}>
              ${totalGen.toLocaleString("es-AR")}
            </strong>
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={guardarPresupuesto}
          disabled={guardando}
          style={{ width: "100%", padding: "0.75rem", fontSize: "1rem" }}
        >
          {guardando
            ? "Guardando..."
            : editId
              ? "💾 Guardar cambios"
              : "💾 Guardar presupuesto"}
        </button>
      </>
    );
  }

  // ── VISTA LISTA ────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>📋 Presupuestos</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setForm(FORM_VACIO);
            setItemsMat([]);
            setItemsSer([]);
            setError("");
            setVista("nuevo");
          }}
        >
          + Nuevo presupuesto
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <input
          placeholder="Buscar por cliente..."
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
        />
      </div>

      <div className="card">
        {presupuestos.length === 0 ? (
          <p style={{ color: "#888" }}>No hay presupuestos todavía</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {presupuestosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ color: "#888" }}>
                    No se encontraron presupuestos
                  </td>
                </tr>
              ) : (
                presupuestosFiltrados.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => cargarDetalle(p.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      {p.clientes ? (
                        <div>
                          <strong>
                            {p.clientes.apellido}, {p.clientes.nombre}
                          </strong>
                          <div style={{ fontSize: "0.8rem", color: "#888" }}>
                            #{p.numero}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#888" }}>—</span>
                      )}
                    </td>
                    <td>{p.fecha}</td>
                    <td>{badgeEstado(p.estado)}</td>
                    <td>
                      <strong>
                        ${parseFloat(p.total).toLocaleString("es-AR")}
                      </strong>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          className="btn btn-secondary"
                          title="Descargar PDF"
                          onClick={() => descargarPDFDesdeLista(p.id)}
                        >
                          <IconoPDF />
                        </button>
                        <button
                          className="btn btn-secondary"
                          title="Editar"
                          onClick={() => cargarParaEditar(p)}
                        >
                          <IconoEditar />
                        </button>
                        <button
                          className="btn btn-danger"
                          title="Eliminar"
                          onClick={() => eliminarPresupuesto(p.id)}
                        >
                          <IconoEliminar />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
