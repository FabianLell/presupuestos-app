import { useState, useEffect, useRef } from "react";
import { supabase, getUserId } from "../supabase";
import Onboarding from "./Onboarding";

const VACIO = {
  nombre_negocio: "",
  direccion: "",
  telefono: "",
  cuil_cuit: "",
  email_contacto: "",
  leyenda_presupuesto:
    "EL PRESENTE TIENE VALIDEZ DE 30 DIAS. PASADOS ESOS DIAS SE ACTUALIZARÁ EL COSTO SEGÚN PORCENTAJE DE INFLACIÓN. LO QUE NO SE HAYA PRESUPUESTADO Y APAREZCA CON POSTERIORIDAD EN EL TRABAJO, SERÁ ANEXADO OPORTUNAMENTE.",
  logo_url: "",
};

export default function Perfil({ onPerfilActualizado }) {
  const [form, setForm] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const fileInputRef = useRef(null);
  const [rubros, setRubros] = useState([]);
  const [rubrosSeleccionados, setRubrosSeleccionados] = useState([]);
  const [procesandoRubros, setProcesandoRubros] = useState(false);
  const [okRubros, setOkRubros] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const userId = await getUserId();
    const { data } = await supabase
      .from("perfil")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (data) {
      setForm({ ...VACIO, ...data });
      setRubrosSeleccionados(data.rubros_seleccionados || []);
    }
    await cargarRubros();
    setCargando(false);
  }

  async function cargarRubros() {
    const { data } = await supabase.from("rubros").select("*").order("nombre");
    setRubros(data || []);
  }

  function toggleRubro(id) {
    setRubrosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function agregarRubros() {
    setProcesandoRubros(true);
    setOkRubros("");

    const userId = await getUserId();
    const nuevosRubros = rubrosSeleccionados.filter(
      (id) => !(form.rubros_seleccionados || []).includes(id),
    );

    if (nuevosRubros.length > 0) {
      const { data: rubroCats } = await supabase
        .from("rubro_categorias")
        .select("*")
        .in("rubro_id", nuevosRubros);

      const { data: rubroMats } = await supabase
        .from("rubro_materiales")
        .select("*")
        .in("rubro_id", nuevosRubros);

      const { data: catsExistentes } = await supabase
        .from("categorias")
        .select("id, nombre")
        .eq("user_id", userId);

      const nombresExistentes = new Set(
        (catsExistentes || []).map((c) => c.nombre.toLowerCase()),
      );

      const catsAInsertar = (rubroCats || []).filter(
        (c) => !nombresExistentes.has(c.nombre.toLowerCase()),
      );

      let catsInsertadas = [];
      if (catsAInsertar.length > 0) {
        const { data: nuevasCats } = await supabase
          .from("categorias")
          .insert(
            catsAInsertar.map((c) => ({ user_id: userId, nombre: c.nombre })),
          )
          .select();
        catsInsertadas = nuevasCats || [];
      }

      const todasLasCats = [...(catsExistentes || []), ...catsInsertadas];
      const mapaCats = {};
      todasLasCats.forEach((c) => {
        mapaCats[c.nombre.toLowerCase()] = c.id;
      });

      const mapaRubroCats = {};
      (rubroCats || []).forEach((rc) => {
        mapaRubroCats[rc.id] = rc.nombre;
      });

      const { data: matsExistentes } = await supabase
        .from("materiales")
        .select("nombre")
        .eq("user_id", userId);

      const matsNombresExistentes = new Set(
        (matsExistentes || []).map((m) => m.nombre.toLowerCase()),
      );

      const matsAInsertar = (rubroMats || []).filter(
        (m) => !matsNombresExistentes.has(m.nombre.toLowerCase()),
      );

      if (matsAInsertar.length > 0) {
        await supabase.from("materiales").insert(
          matsAInsertar.map((m) => {
            const nombreCat = m.rubro_categoria_id
              ? mapaRubroCats[m.rubro_categoria_id]
              : null;
            const categoriaId = nombreCat
              ? mapaCats[nombreCat.toLowerCase()]
              : null;
            return {
              user_id: userId,
              nombre: m.nombre,
              descripcion: m.descripcion || null,
              unidad: m.unidad,
              precio_unitario: m.precio_unitario,
              categoria_id: categoriaId || null,
            };
          }),
        );
      }
    }

    await supabase
      .from("perfil")
      .upsert(
        { user_id: userId, rubros_seleccionados: rubrosSeleccionados },
        { onConflict: "user_id" },
      );

    setForm((prev) => ({ ...prev, rubros_seleccionados: rubrosSeleccionados }));
    setOkRubros("Rubros actualizados correctamente");
    setProcesandoRubros(false);
    if (onPerfilActualizado) onPerfilActualizado();
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function subirLogo(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("La imagen no puede superar 2MB");
      return;
    }

    setSubiendo(true);
    setError("");

    const userId = await getUserId();
    const extension = file.name.split(".").pop();
    const path = `${userId}/logo.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Error al subir la imagen");
      setSubiendo(false);
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    const logoUrl = `${data.publicUrl}?t=${Date.now()}`;

    setForm((prev) => ({ ...prev, logo_url: logoUrl }));
    setSubiendo(false);
  }

  async function guardar() {
    setError("");
    setOk("");
    if (!form.nombre_negocio?.trim()) {
      return setError("El Nombre del negocio es obligatorio");
    }

    setGuardando(true);
    const userId = await getUserId();

    const datos = {
      user_id: userId,
      nombre_negocio: form.nombre_negocio.trim(),
      direccion: form.direccion?.trim() || null,
      telefono: form.telefono?.trim() || null,
      cuil_cuit: form.cuil_cuit?.trim() || null,
      email_contacto: form.email_contacto?.trim() || null,
      leyenda_presupuesto: form.leyenda_presupuesto?.trim() || null,
      logo_url: form.logo_url || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("perfil")
      .upsert(datos, { onConflict: "user_id" });

    if (error) {
      setError("Error al guardar el perfil");
    } else {
      setOk("Perfil guardado correctamente");
      if (onPerfilActualizado) onPerfilActualizado();
    }

    setGuardando(false);
  }

  function Iniciales({ nombre }) {
    const palabras = (nombre || "?").trim().split(" ");
    const iniciales =
      palabras.length >= 2
        ? palabras[0][0] + palabras[1][0]
        : palabras[0].slice(0, 2);
    return (
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "#2563eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.6rem",
          fontWeight: "700",
          color: "#fff",
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        {iniciales.toUpperCase()}
      </div>
    );
  }

  if (cargando)
    return <p style={{ color: "#888", padding: "2rem" }}>Cargando...</p>;

  return (
    <>
      <h1>⚙️ Mi perfil</h1>

      <div className="card">
        <h2>Logo del negocio</h2>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="Logo"
              style={{
                width: "80px",
                height: "80px",
                objectFit: "contain",
                borderRadius: "8px",
                background: "#222",
                padding: "4px",
              }}
            />
          ) : (
            <Iniciales nombre={form.nombre_negocio} />
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendo}
            >
              {subiendo ? "Subiendo..." : "Subir logo"}
            </button>
            {form.logo_url && (
              <button
                className="btn btn-danger"
                onClick={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
              >
                Quitar logo
              </button>
            )}
            <p style={{ color: "#888", fontSize: "0.8rem" }}>
              PNG, JPG o SVG. Máx 2MB.
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => subirLogo(e.target.files[0])}
        />
      </div>

      <div className="card">
        <h2>Datos del negocio</h2>

        {error && <p className="msg-error">{error}</p>}
        {ok && <p className="msg-ok">{ok}</p>}

        <div className="form-row">
          <input
            name="nombre_negocio"
            placeholder="Nombre del negocio *"
            value={form.nombre_negocio || ""}
            onChange={handleChange}
          />
          <input
            name="telefono"
            placeholder="Teléfono"
            value={form.telefono || ""}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <input
            name="cuil_cuit"
            placeholder="CUIL / CUIT"
            value={form.cuil_cuit || ""}
            onChange={handleChange}
          />
          <input
            name="email_contacto"
            placeholder="Email de contacto"
            value={form.email_contacto || ""}
            onChange={handleChange}
          />
        </div>

        <input
          name="direccion"
          placeholder="Dirección"
          value={form.direccion || ""}
          onChange={handleChange}
        />

        <textarea
          name="leyenda_presupuesto"
          placeholder="Leyenda al pie del presupuesto"
          value={form.leyenda_presupuesto || ""}
          onChange={handleChange}
          rows={4}
          style={{ resize: "vertical" }}
        />

        <button
          className="btn btn-primary"
          onClick={guardar}
          disabled={guardando}
        >
          {guardando ? "Guardando..." : "Guardar perfil"}
        </button>
      </div>
      <div className="card">
        <h2>Rubros del negocio</h2>
        <p
          style={{
            color: "#888",
            fontSize: "0.88rem",
            marginBottom: "1rem",
            lineHeight: "1.6",
          }}
        >
          Seleccioná los rubros en los que trabajás. Al agregar un rubro nuevo
          se cargarán automáticamente sus categorías y materiales de referencia.
          No se duplicarán si ya los tenés cargados.
        </p>

        {okRubros && <p className="msg-ok">{okRubros}</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.6rem",
            marginBottom: "1rem",
          }}
        >
          {rubros.map((r) => {
            const activo = rubrosSeleccionados.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggleRubro(r.id)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  border: activo ? "2px solid #2563eb" : "1px solid #2a2a2a",
                  background: activo ? "#1e3a5f" : "#222",
                  color: activo ? "#fff" : "#ccc",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.9rem",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>{r.icono}</span>
                {r.nombre}
                {activo && (
                  <span style={{ marginLeft: "auto", color: "#60a5fa" }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          className="btn btn-primary"
          onClick={agregarRubros}
          disabled={procesandoRubros}
        >
          {procesandoRubros ? "Procesando..." : "Guardar rubros"}
        </button>
      </div>
    </>
  );
}
