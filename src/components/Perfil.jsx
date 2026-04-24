import { useState, useEffect, useRef } from "react";
import { supabase, getUserId } from "../supabase";

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
    if (data) setForm({ ...VACIO, ...data });
    setCargando(false);
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
    </>
  );
}
