import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase, getUserId } from "../supabase";
import { useDirtyForm } from "../hooks/useDirtyForm";

const HOY = new Date().toISOString().split("T")[0];

const FORM_VACIO = {
  cliente_id: "",
  fecha: HOY,
  observaciones: "",
  estado: "borrador",
};

export default function Presupuestos({ perfil, soloLectura }) {
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
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const pdfRef = useRef(null);

  // Hook de protección contra pérdida de datos
  const dirtyForm = useDirtyForm(FORM_VACIO, async () => {
    if (vista === "nuevo") {
      await guardarPresupuesto();
    }
  });

  // Registrar estado del formulario con sistema global
  useEffect(() => {
    if (dirtyForm.isDirty && vista === "nuevo") {
      window.currentDirtyForm = {
        isDirty: dirtyForm.isDirty,
        onSave: async () => {
          await guardarPresupuesto();
        },
      };
    } else {
      window.currentDirtyForm = null;
    }
  }, [dirtyForm.isDirty, vista]);

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
      supabase.from("clientes").select("*").is("deleted_at", null).order("apellido"),
      supabase
        .from("materiales")
        .select("*, categorias(nombre)")
        .is("deleted_at", null)
        .order("nombre"),
      supabase.from("servicios").select("*").is("deleted_at", null).order("nombre"),
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
    // Verificar si hay cambios sin guardar antes de editar
    if (dirtyForm.isDirty && vista === "nuevo") {
      if (window.showDirtyFormModal) {
        window.showDirtyFormModal(
          async () => {
            // Guardar
            await guardarPresupuesto();
            doCargarParaEditar(p);
          },
          () => {
            // Descartar
            doCargarParaEditar(p);
          },
          () => {
            // Cancelar
          },
        );
      }
    } else {
      doCargarParaEditar(p);
    }
  }

  async function doCargarParaEditar(p) {
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
    const presupuestoForm = {
      cliente_id: p.cliente_id,
      fecha: p.fecha,
      observaciones: p.observaciones || "",
      estado: p.estado || "borrador",
    };
    const newItemsMat = (pm.data || []).map((i) => ({
      material_id: i.material_id,
      nombre: i.materiales?.nombre,
      unidad: i.materiales?.unidad,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      subtotal: i.subtotal,
    }));
    const newItemsSer = (ps.data || []).map((i) => ({
      servicio_id: i.servicio_id,
      nombre: i.servicios?.nombre,
      precio: i.precio,
      descripcion: i.descripcion || "",
    }));

    setForm(presupuestoForm);
    setItemsMat(newItemsMat);
    setItemsSer(newItemsSer);

    // Actualizar el estado del hook con los datos cargados
    dirtyForm.updateData({
      ...presupuestoForm,
      itemsMat: newItemsMat,
      itemsSer: newItemsSer,
    });
    dirtyForm.markAsClean();

    setEditId(p.id);
    setError("");
    setVista("nuevo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleChange(e) {
    const newForm = { ...form, [e.target.name]: e.target.value };
    setForm(newForm);
    dirtyForm.updateData(newForm);
  }

  function agregarMaterial() {
    if (!matSel) return;
    const mat = materiales.find((m) => m.id === matSel);
    if (!mat) return;
    const cant = parseFloat(matCant) || 1;
    const existe = itemsMat.find((i) => i.material_id === matSel);
    let newItemsMat;
    if (existe) {
      newItemsMat = itemsMat.map((i) =>
        i.material_id === matSel
          ? {
              ...i,
              cantidad: i.cantidad + cant,
              subtotal: (i.cantidad + cant) * i.precio_unitario,
            }
          : i,
      );
    } else {
      newItemsMat = [
        ...itemsMat,
        {
          material_id: mat.id,
          nombre: mat.nombre,
          unidad: mat.unidad,
          cantidad: cant,
          precio_unitario: mat.precio_unitario,
          subtotal: cant * mat.precio_unitario,
        },
      ];
    }
    setItemsMat(newItemsMat);
    dirtyForm.updateData({
      ...form,
      itemsMat: newItemsMat,
      itemsSer: itemsSer,
    });
    setMatSel("");
    setMatCant(1);
  }

  function quitarMaterial(material_id) {
    const newItemsMat = itemsMat.filter((i) => i.material_id !== material_id);
    setItemsMat(newItemsMat);
    dirtyForm.updateData({
      ...form,
      itemsMat: newItemsMat,
      itemsSer: itemsSer,
    });
  }

  function agregarServicio() {
    if (!serSel) return;
    const ser = servicios.find((s) => s.id === serSel);
    if (!ser) return;
    if (itemsSer.find((i) => i.servicio_id === serSel)) return;
    const newItemsSer = [
      ...itemsSer,
      {
        servicio_id: ser.id,
        nombre: ser.nombre,
        precio: ser.precio,
        descripcion: ser.descripcion || "",
      },
    ];
    setItemsSer(newItemsSer);
    dirtyForm.updateData({
      ...form,
      itemsMat: itemsMat,
      itemsSer: newItemsSer,
    });
    setSerSel("");
  }

  function quitarServicio(servicio_id) {
    const newItemsSer = itemsSer.filter((i) => i.servicio_id !== servicio_id);
    setItemsSer(newItemsSer);
    dirtyForm.updateData({
      ...form,
      itemsMat: itemsMat,
      itemsSer: newItemsSer,
    });
  }

  function actualizarServicio(servicio_id, campo, valor) {
    const newItemsSer = itemsSer.map((i) =>
      i.servicio_id === servicio_id ? { ...i, [campo]: valor } : i,
    );
    setItemsSer(newItemsSer);
    dirtyForm.updateData({
      ...form,
      itemsMat: itemsMat,
      itemsSer: newItemsSer,
    });
  }

  // Función para volver al listado con protección
  function volverAlListado() {
    // Verificar si hay cambios sin guardar
    if (dirtyForm.isDirty && window.currentDirtyForm) {
      // Mostrar modal de confirmación
      window.showDirtyFormModal(
        async () => {
          // Guardar
          await guardarPresupuesto();
          setVista("lista");
          setEditId(null);
        },
        () => {
          // Descartar cambios
          setVista("lista");
          setEditId(null);
          dirtyForm.markAsClean();
          window.currentDirtyForm = null;
        }
      );
    } else {
      // No hay cambios, volver directamente
      setVista("lista");
      setEditId(null);
    }
  }

  const presupuestosFiltrados = presupuestos.filter((p) => {
    if (!filtroCliente) return true;
    const texto = filtroCliente.toLowerCase();
    const nombre =
      `${p.clientes?.apellido} ${p.clientes?.nombre}`.toLowerCase();
    const obs = (p.observaciones || "").toLowerCase();
    return nombre.includes(texto) || obs.includes(texto);
  });

  const totalMat = itemsMat.reduce((acc, i) => acc + i.subtotal, 0);
  const totalSer = itemsSer.reduce(
    (acc, i) => acc + (parseFloat(i.precio) || 0),
    0,
  );
  const totalGen = totalMat + totalSer;

  async function guardarPresupuesto() {
    setError("");

    // Obtener datos actualizados del hook si los arrays del componente están vacíos
    let currentItemsMat = itemsMat;
    let currentItemsSer = itemsSer;

    // Si los arrays están vacíos pero el hook tiene datos, usar los datos del hook
    if (
      itemsMat.length === 0 &&
      itemsSer.length === 0 &&
      dirtyForm.currentData
    ) {
      if (dirtyForm.currentData.itemsMat) {
        currentItemsMat = dirtyForm.currentData.itemsMat;
      }
      if (dirtyForm.currentData.itemsSer) {
        currentItemsSer = dirtyForm.currentData.itemsSer;
      }
    }

    // Obtener datos del formulario del hook si están disponibles
    let currentForm = form;
    if (dirtyForm.currentData && dirtyForm.currentData.cliente_id) {
      currentForm = {
        cliente_id: dirtyForm.currentData.cliente_id,
        fecha: dirtyForm.currentData.fecha,
        observaciones: dirtyForm.currentData.observaciones || "",
        estado: dirtyForm.currentData.estado || "borrador",
      };
    }

    if (!currentForm.cliente_id) {
      setError("Seleccioná un cliente");
      throw new Error("Seleccioná un cliente");
    }
    if (currentItemsMat.length === 0 && currentItemsSer.length === 0) {
      setError("Agregá al menos un material o servicio");
      throw new Error("Agregá al menos un material o servicio");
    }
    setGuardando(true);

    const userId = await getUserId();
    // Calcular totales con los datos actualizados
    const totalMat = currentItemsMat.reduce((acc, i) => acc + i.subtotal, 0);
    const totalSer = currentItemsSer.reduce(
      (acc, i) => acc + (parseFloat(i.precio) || 0),
      0,
    );
    const totalGen = totalMat + totalSer;

    const clienteSeleccionado = clientes.find(c => c.id === currentForm.cliente_id);
    const datosPresupuesto = {
      user_id: userId,
      cliente_id: currentForm.cliente_id,
      fecha: currentForm.fecha,
      observaciones: currentForm.observaciones.trim(),
      estado: currentForm.estado,
      total_materiales: totalMat,
      total_servicios: totalSer,
      total: totalGen,
      cliente_snapshot: clienteSeleccionado ? {
        nombre: clienteSeleccionado.nombre,
        apellido: clienteSeleccionado.apellido,
        telefono: clienteSeleccionado.telefono || "",
        direccion: clienteSeleccionado.direccion || "",
      } : null,
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
        throw new Error("Error al actualizar el presupuesto");
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
        throw new Error("Error al guardar el presupuesto");
      }
      pid = pData.id;
    }

    if (currentItemsMat.length > 0) {
      await supabase.from("presupuesto_materiales").insert(
        currentItemsMat.map((i) => {
          const material = materiales.find(m => m.id === i.material_id);
          return {
            presupuesto_id: pid,
            material_id: i.material_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            subtotal: i.subtotal,
            nombre_snapshot: material?.nombre || "",
            unidad_snapshot: material?.unidad || "",
          };
        }),
      );
    }
    if (currentItemsSer.length > 0) {
      await supabase.from("presupuesto_servicios").insert(
        currentItemsSer.map((i) => {
          const servicio = servicios.find(s => s.id === i.servicio_id);
          return {
            presupuesto_id: pid,
            servicio_id: i.servicio_id,
            precio: parseFloat(i.precio) || 0,
            descripcion: i.descripcion,
            nombre_snapshot: servicio?.nombre || "",
          };
        }),
      );
    }

    setGuardando(false);
    setEditId(null);
    setForm(FORM_VACIO);
    setItemsMat([]);
    setItemsSer([]);
    dirtyForm.updateData(FORM_VACIO);
    dirtyForm.markAsClean();
    await cargarTodo();
    // Volver al listado de presupuestos
    setVista("lista");
  }

  async function descargarPDFDesdeLista(id) {
    await cargarDetalle(id);
    setTimeout(async () => {
      await generarPDF();
      volverAlListado();
    }, 500);
  }

  async function eliminarPresupuesto(id) {
    await supabase.from("presupuestos").delete().eq("id", id);
    setConfirmEliminar(null);
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
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="btn btn-secondary"
              onClick={volverAlListado}
            >
              {"←"} Volver
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => cargarParaEditar(p)}
            >
              Editar
            </button>
          </div>
          <button className="btn btn-primary" onClick={generarPDF}>
            Descargar PDF
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
            <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
              <strong>Cliente:</strong>{" "}
              {cliente
                ? `${cliente.apellido}, ${cliente.nombre}`
                : p.cliente_snapshot
                  ? `${p.cliente_snapshot.apellido}, ${p.cliente_snapshot.nombre}`
                  : "—"}
              {(cliente?.telefono || p.cliente_snapshot?.telefono) && (
                <span style={{ marginLeft: "1.5rem" }}>
                  Tel: {cliente?.telefono || p.cliente_snapshot?.telefono}
                </span>
              )}
              {(cliente?.direccion || p.cliente_snapshot?.direccion) && (
                <span style={{ marginLeft: "1.5rem" }}>
                  {cliente?.direccion || p.cliente_snapshot?.direccion}
                </span>
              )}
            </p>
          </div>
        </div>

        <div
          className="card no-print"
          style={{ borderColor: "#3a3a3a", padding: "0.5rem" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.4rem",
              paddingBottom: "0.3rem",
              borderBottom: "1px solid #374151",
            }}
          >
            <h2 style={{ fontSize: "0.85rem", margin: 0 }}>
              Datos del Presupuesto Nro: {p.numero}
            </h2>
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              Fecha: {p.fecha}
            </div>
          </div>
          <div
            style={{
              fontSize: "0.8rem",
            }}
          >
            {/* Primera fila con línea horizontal abajo */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0",
                paddingBottom: "0.3rem",
                borderBottom: "1px solid #374151",
                marginBottom: "0.3rem",
              }}
            >
              <div
                style={{
                  paddingRight: "1rem",
                  borderRight: "1px solid #374151",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Cliente:
                </span>
                <div
                  style={{
                    color: "#e5e7eb",
                    fontWeight: "500",
                    marginTop: "0.1rem",
                  }}
                >
                  {cliente
                    ? `${cliente.apellido}, ${cliente.nombre}`
                    : p.cliente_snapshot
                      ? `${p.cliente_snapshot.apellido}, ${p.cliente_snapshot.nombre}`
                      : "Cliente no encontrado"}
                </div>
              </div>
              <div
                style={{
                  paddingLeft: "1rem",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Teléfono:
                </span>
                <div style={{ color: "#e5e7eb", marginTop: "0.1rem" }}>
                  {cliente?.telefono || p.cliente_snapshot?.telefono || "—"}
                </div>
              </div>
            </div>
            
            {/* Segunda fila con línea horizontal abajo */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0",
                paddingBottom: "0.3rem",
                borderBottom: "1px solid #374151",
                marginBottom: "0.3rem",
              }}
            >
              <div
                style={{
                  paddingRight: "1rem",
                  borderRight: "1px solid #374151",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Dirección:
                </span>
                <div style={{ color: "#e5e7eb", marginTop: "0.1rem" }}>
                  {cliente?.direccion || p.cliente_snapshot?.direccion || "—"}
                </div>
              </div>
              <div
                style={{
                  paddingLeft: "1rem",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                  Estado:
                </span>
                <div style={{ color: "#e5e7eb", marginTop: "0.1rem" }}>
                  {badgeEstado(p.estado)}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: "0.5rem",
            }}
          >
            <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
              Observaciones:
            </span>
            <div style={{ color: "#e5e7eb", marginTop: "0.1rem" }}>
              {p.observaciones || "—"}
            </div>
          </div>
        </div>

        {p.items_materiales.length > 0 && (
          <div className="card" style={{ padding: "0.75rem" }}>
            <h2 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
              Materiales
            </h2>
            <table
              style={{
                marginTop: "0.25rem",
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr style={{ background: "#2c3e50" }}>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "left",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                    }}
                  >
                    Material
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "center",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                      width: "80px",
                    }}
                  >
                    Cant.
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "right",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                      width: "110px",
                    }}
                  >
                    Precio unit.
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "right",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                      width: "110px",
                    }}
                  >
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.items_materiales.map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid #34495e" }}>
                    <td style={{ padding: "0.25rem 0.5rem", color: "#e5e7eb" }}>
                      {i.materiales?.nombre || i.nombre_snapshot}{" "}
                      <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>
                        ({i.materiales?.unidad || i.unidad_snapshot})
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.25rem 0.5rem",
                        textAlign: "center",
                        color: "#e5e7eb",
                      }}
                    >
                      {i.cantidad}
                    </td>
                    <td
                      style={{
                        padding: "0.25rem 0.5rem",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: "#e5e7eb",
                      }}
                    >
                      ${parseFloat(i.precio_unitario).toLocaleString("es-AR")}
                    </td>
                    <td
                      style={{
                        padding: "0.25rem 0.5rem",
                        textAlign: "right",
                        fontFamily: "monospace",
                        fontWeight: "600",
                        color: "#e5e7eb",
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0.75rem",
                backgroundColor: "#1e3a5f",
                border: "1px solid #2563eb",
                borderRadius: "4px",
                marginTop: "0.25rem",
              }}
            >
              <span style={{ fontWeight: "600", color: "#93c5fd" }}>
                Total materiales
              </span>
              <strong
                style={{
                  fontSize: "0.95rem",
                  color: "#fff",
                  fontFamily: "monospace",
                }}
              >
                ${parseFloat(p.total_materiales).toLocaleString("es-AR")}
              </strong>
            </div>
          </div>
        )}

        {p.items_servicios.length > 0 && (
          <div className="card" style={{ padding: "0.75rem" }}>
            <h2 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
              Servicios
            </h2>
            <table
              style={{
                marginTop: "0.25rem",
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr style={{ background: "#2c3e50" }}>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "left",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                    }}
                  >
                    Servicio
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "left",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                    }}
                  >
                    Descripción / nota
                  </th>
                  <th
                    style={{
                      padding: "0.25rem 0.5rem",
                      textAlign: "right",
                      borderBottom: "2px solid #34495e",
                      fontWeight: "600",
                      color: "#e5e7eb",
                      width: "110px",
                    }}
                  >
                    Precio
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.items_servicios.map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid #34495e" }}>
                    <td
                      style={{
                        padding: "0.25rem 0.5rem",
                        color: "#e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {i.servicios?.nombre || i.nombre_snapshot}
                    </td>
                    <td style={{ padding: "0.25rem 0.5rem", color: "#9ca3af" }}>
                      {i.descripcion || "â"}
                    </td>
                    <td
                      style={{
                        padding: "0.25rem 0.5rem",
                        textAlign: "right",
                        fontFamily: "monospace",
                        color: "#e5e7eb",
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0.75rem",
                backgroundColor: "#1e3a5f",
                border: "1px solid #2563eb",
                borderRadius: "4px",
                marginTop: "0.25rem",
              }}
            >
              <span style={{ fontWeight: "600", color: "#93c5fd" }}>
                Total servicios
              </span>
              <strong
                style={{
                  fontSize: "0.95rem",
                  color: "#fff",
                  fontFamily: "monospace",
                }}
              >
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
            flexShrink: 0,
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={volverAlListado}
          >
            ← Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={guardarPresupuesto}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>

        {error && <p className="msg-error">{error}</p>}

        <div style={{ flex: 1, paddingBottom: "0.5rem" }}>
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
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <select
                value={matSel}
                onChange={(e) => setMatSel(e.target.value)}
              >
                <option value="">Seleccioná un material</option>
                {materiales
                  .filter(
                    (m) =>
                      !categoriaSel || m.categorias?.nombre === categoriaSel,
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} - $
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
              <button className="btn btn-secondary" onClick={agregarMaterial}>
                + Agregar
              </button>
            </div>
            {itemsMat.length > 0 && (
              <>
                <table
                  style={{
                    marginTop: "0.25rem",
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.85rem",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#2c3e50" }}>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "left",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                        }}
                      >
                        Material
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "center",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                          width: "80px",
                        }}
                      >
                        Cant.
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "right",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                          width: "110px",
                        }}
                      >
                        Precio unit.
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "right",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                          width: "110px",
                        }}
                      >
                        Subtotal
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "center",
                          borderBottom: "2px solid #34495e",
                          width: "40px",
                          color: "#e5e7eb",
                        }}
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsMat.map((i) => (
                      <tr
                        key={i.material_id}
                        style={{ borderBottom: "1px solid #34495e" }}
                      >
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            color: "#e5e7eb",
                          }}
                        >
                          {i.nombre}{" "}
                          <span
                            style={{ color: "#9ca3af", fontSize: "0.8rem" }}
                          >
                            ({i.unidad})
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "center",
                          }}
                        >
                          <input
                            style={{
                              margin: 0,
                              width: "60px",
                              padding: "0.2rem",
                              textAlign: "center",
                              border: "1px solid #4b5563",
                              borderRadius: "3px",
                              backgroundColor: "#374151",
                              color: "#e5e7eb",
                            }}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={i.cantidad}
                            onChange={(e) => {
                              const cant = parseFloat(e.target.value) || 0;
                              const newItemsMat = itemsMat.map((m) =>
                                m.material_id === i.material_id
                                  ? {
                                      ...m,
                                      cantidad: cant,
                                      subtotal: cant * m.precio_unitario,
                                    }
                                  : m,
                              );
                              setItemsMat(newItemsMat);
                              dirtyForm.updateData({
                                ...form,
                                itemsMat: newItemsMat,
                                itemsSer: itemsSer,
                              });
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "right",
                            fontFamily: "monospace",
                            color: "#e5e7eb",
                          }}
                        >
                          $
                          {parseFloat(i.precio_unitario).toLocaleString(
                            "es-AR",
                          )}
                        </td>
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "right",
                            fontFamily: "monospace",
                            fontWeight: "600",
                            color: "#e5e7eb",
                          }}
                        >
                          ${parseFloat(i.subtotal).toLocaleString("es-AR")}
                        </td>
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "center",
                          }}
                        >
                          <button
                            className="btn btn-danger"
                            style={{
                              padding: "0.2rem 0.4rem",
                              fontSize: "0.75rem",
                            }}
                            onClick={() => quitarMaterial(i.material_id)}
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.4rem 0.75rem",
                    backgroundColor: "#1e3a5f",
                    border: "1px solid #2563eb",
                    borderRadius: "4px",
                    marginTop: "0.25rem",
                  }}
                >
                  <span style={{ fontWeight: "600", color: "#93c5fd" }}>
                    Total materiales
                  </span>
                  <strong
                    style={{
                      fontSize: "0.95rem",
                      color: "#fff",
                      fontFamily: "monospace",
                    }}
                  >
                    ${totalMat.toLocaleString("es-AR")}
                  </strong>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h2>Agregar servicios</h2>
            <div className="form-row">
              <select
                value={serSel}
                onChange={(e) => setSerSel(e.target.value)}
              >
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
                <table
                  style={{
                    marginTop: "0.25rem",
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.85rem",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#2c3e50" }}>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "left",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                        }}
                      >
                        Servicio
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "left",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                        }}
                      >
                        Descripción / nota
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "right",
                          borderBottom: "2px solid #34495e",
                          fontWeight: "600",
                          color: "#e5e7eb",
                          width: "110px",
                        }}
                      >
                        Precio
                      </th>
                      <th
                        style={{
                          padding: "0.25rem 0.5rem",
                          textAlign: "center",
                          borderBottom: "2px solid #34495e",
                          width: "40px",
                          color: "#e5e7eb",
                        }}
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsSer.map((i) => (
                      <tr
                        key={i.servicio_id}
                        style={{ borderBottom: "1px solid #34495e" }}
                      >
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            whiteSpace: "nowrap",
                            color: "#e5e7eb",
                          }}
                        >
                          {i.nombre}
                        </td>
                        <td style={{ padding: "0.25rem 0.5rem" }}>
                          <input
                            style={{
                              margin: 0,
                              width: "100%",
                              padding: "0.2rem",
                              border: "1px solid #4b5563",
                              borderRadius: "3px",
                              backgroundColor: "#374151",
                              color: "#e5e7eb",
                            }}
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
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "right",
                          }}
                        >
                          <input
                            style={{
                              margin: 0,
                              width: "90px",
                              padding: "0.2rem",
                              textAlign: "right",
                              border: "1px solid #4b5563",
                              borderRadius: "3px",
                              fontFamily: "monospace",
                              backgroundColor: "#374151",
                              color: "#e5e7eb",
                            }}
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
                        <td
                          style={{
                            padding: "0.25rem 0.5rem",
                            textAlign: "center",
                          }}
                        >
                          <button
                            className="btn btn-danger"
                            style={{
                              padding: "0.2rem 0.4rem",
                              fontSize: "0.75rem",
                            }}
                            onClick={() => quitarServicio(i.servicio_id)}
                          >
                            X
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.4rem 0.75rem",
                    backgroundColor: "#1e3a5f",
                    border: "1px solid #2563eb",
                    borderRadius: "4px",
                    marginTop: "0.25rem",
                  }}
                >
                  <span style={{ fontWeight: "600", color: "#93c5fd" }}>
                    Total servicios
                  </span>
                  <strong
                    style={{
                      fontSize: "0.95rem",
                      color: "#fff",
                      fontFamily: "monospace",
                    }}
                  >
                    ${totalSer.toLocaleString("es-AR")}
                  </strong>
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
        </div>
      </div>
    );
  }

  // ── VISTA LISTA ────────────────────────────────────────────
  return (
    <div className="md-layout">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.75rem",
          flexShrink: 0,
        }}
      >
        <input
          placeholder="Buscar..."
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          style={{ flex: 1, margin: 0 }}
        />
        {!soloLectura && (
          <button
            className="btn btn-primary"
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
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
        )}
      </div>

      <div className="md-list-area">
        {presupuestos.length === 0 ? (
          <p style={{ color: "#888", padding: "1rem" }}>
            No hay presupuestos todavía
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Observaciones</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {presupuestosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ color: "#888" }}>
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
                          {p.clientes.apellido}, {p.clientes.nombre}
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
                    <td>${parseFloat(p.total).toLocaleString("es-AR")}</td>
                    <td style={{ color: "#888" }}>{p.observaciones || "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          className="btn btn-secondary"
                          title="Descargar PDF"
                          onClick={() => descargarPDFDesdeLista(p.id)}
                        >
                          <IconoPDF />
                        </button>
                        {!soloLectura && (
                          <button
                            className="btn btn-danger"
                            title="Eliminar"
                            onClick={() => setConfirmEliminar(p.id)}
                          >
                            <IconoEliminar />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL CONFIRMAR ELIMINAR */}
      {confirmEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>¿Eliminar presupuesto?</h3>
            <p
              style={{
                color: "#888",
                fontSize: "0.9rem",
                margin: "0.5rem 0 1rem",
              }}
            >
              Esta acción no se puede deshacer.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={() => eliminarPresupuesto(confirmEliminar)}
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
