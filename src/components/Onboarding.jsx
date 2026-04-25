import { useState, useEffect } from "react";
import { supabase, getUserId } from "../supabase";

export default function Onboarding({ onComplete }) {
  const [rubros, setRubros] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarRubros();
  }, []);

  async function cargarRubros() {
    const { data } = await supabase.from("rubros").select("*").order("nombre");
    setRubros(data || []);
    setCargando(false);
  }

  function toggleRubro(id) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  }

  async function confirmar() {
    setError("");
    setProcesando(true);

    const userId = await getUserId();

    // 1 — Cargar categorías y materiales de los rubros seleccionados
    if (seleccionados.length > 0) {
      const { data: rubroCats } = await supabase
        .from("rubro_categorias")
        .select("*")
        .in("rubro_id", seleccionados);

      const { data: rubroMats } = await supabase
        .from("rubro_materiales")
        .select("*")
        .in("rubro_id", seleccionados);

      // 2 — Cargar categorías existentes del usuario
      const { data: catsExistentes } = await supabase
        .from("categorias")
        .select("id, nombre")
        .eq("user_id", userId);

      const nombresExistentes = new Set(
        (catsExistentes || []).map((c) => c.nombre.toLowerCase()),
      );

      // 3 — Insertar categorías nuevas (sin duplicar)
      const catsAInsertar = (rubroCats || []).filter(
        (c) => !nombresExistentes.has(c.nombre.toLowerCase()),
      );

      let catsInsertadas = [];
      if (catsAInsertar.length > 0) {
        const { data: nuevasCats } = await supabase
          .from("categorias")
          .insert(
            catsAInsertar.map((c) => ({
              user_id: userId,
              nombre: c.nombre,
            })),
          )
          .select();
        catsInsertadas = nuevasCats || [];
      }

      // 4 — Mapa de nombre de categoría → id del usuario
      const todasLasCats = [...(catsExistentes || []), ...catsInsertadas];
      const mapaCats = {};
      todasLasCats.forEach((c) => {
        mapaCats[c.nombre.toLowerCase()] = c.id;
      });

      // 5 — Mapa de rubro_categoria_id → nombre (para resolver el id del usuario)
      const mapaRubroCats = {};
      (rubroCats || []).forEach((rc) => {
        mapaRubroCats[rc.id] = rc.nombre;
      });

      // 6 — Cargar materiales existentes del usuario
      const { data: matsExistentes } = await supabase
        .from("materiales")
        .select("nombre")
        .eq("user_id", userId);

      const matsNombresExistentes = new Set(
        (matsExistentes || []).map((m) => m.nombre.toLowerCase()),
      );

      // 7 — Insertar materiales nuevos (sin duplicar)
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

    // 8 — Guardar rubros seleccionados en el perfil
    await supabase.from("perfil").upsert(
      {
        user_id: userId,
        rubros_seleccionados: seleccionados,
      },
      { onConflict: "user_id" },
    );

    setProcesando(false);
    onComplete();
  }

  async function saltear() {
    const userId = await getUserId();
    await supabase.from("perfil").upsert(
      {
        user_id: userId,
        rubros_seleccionados: [],
      },
      { onConflict: "user_id" },
    );
    onComplete();
  }

  if (cargando)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#888" }}>Cargando...</p>
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "560px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>
            ¿En qué rubro trabajás?
          </h1>
          <p style={{ color: "#888", fontSize: "0.95rem", lineHeight: "1.6" }}>
            Seleccioná uno o más rubros y cargaremos automáticamente categorías
            y materiales de referencia en tu cuenta. Podés editarlos o
            eliminarlos cuando quieras.
          </p>
        </div>

        {seleccionados.length > 0 && (
          <div
            style={{
              background: "#1e3a5f",
              border: "1px solid #2563eb44",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              marginBottom: "1.5rem",
              fontSize: "0.85rem",
              color: "#93c5fd",
              lineHeight: "1.5",
            }}
          >
            ✓ Se cargarán materiales y categorías de:{" "}
            <strong>
              {rubros
                .filter((r) => seleccionados.includes(r.id))
                .map((r) => r.nombre)
                .join(", ")}
            </strong>
            . No se duplicarán si ya los tenés cargados.
          </div>
        )}

        {error && <p className="msg-error">{error}</p>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {rubros.map((r) => {
            const activo = seleccionados.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggleRubro(r.id)}
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "8px",
                  border: activo ? "2px solid #2563eb" : "1px solid #2a2a2a",
                  background: activo ? "#1e3a5f" : "#1a1a1a",
                  color: activo ? "#fff" : "#ccc",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.95rem",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <span style={{ fontSize: "1.3rem" }}>{r.icono}</span>
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
          onClick={confirmar}
          disabled={procesando}
          style={{
            width: "100%",
            padding: "0.85rem",
            fontSize: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          {procesando
            ? "Cargando materiales..."
            : seleccionados.length === 0
              ? "Continuar sin seleccionar"
              : `Confirmar y empezar →`}
        </button>

        {seleccionados.length > 0 && (
          <button
            className="btn btn-secondary"
            onClick={saltear}
            style={{ width: "100%", padding: "0.75rem" }}
          >
            Saltear por ahora
          </button>
        )}
      </div>
    </div>
  );
}
