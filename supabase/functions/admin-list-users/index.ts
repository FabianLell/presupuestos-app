import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://presupro-app.vercel.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminEmails = (Deno.env.get("ADMIN_EMAIL") || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);

    if (!supabaseUrl || !serviceRoleKey || adminEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required env vars" }),
        {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization" }),
        {
          status: 401,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const userClient = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const callerEmail = (user.email || "").trim().toLowerCase();

    // Debug logs
    console.log('Admin emails from env:', adminEmails);
    console.log('Caller email:', callerEmail);
    console.log('Is admin:', adminEmails.includes(callerEmail));

    if (!adminEmails.includes(callerEmail)) {
      return new Response(JSON.stringify({
        error: "Forbidden",
        debug: {
          callerEmail,
          adminEmails,
          isAdmin: adminEmails.includes(callerEmail)
        }
      }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const allUsers = [];
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to list users", details: error.message }),
          {
            status: 500,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          },
        );
      }

      const batch = data?.users || [];
      allUsers.push(...batch);
      if (batch.length < perPage) break;
      page += 1;
    }

    const userIds = allUsers.map((u) => u.id);

    const { data: perfiles } = await adminClient
      .from("perfil")
      .select("user_id, nombre_negocio, estado, fecha_inicio_prueba")
      .in("user_id", userIds);

    const mapaPerfiles: Record<string, any> = {};
    (perfiles || []).forEach((p: any) => {
      mapaPerfiles[p.user_id] = p;
    });

    const users = allUsers.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      nombre_negocio: mapaPerfiles[u.id]?.nombre_negocio || u.user_metadata?.nombre_negocio || null,
      perfil: mapaPerfiles[u.id] || null,
    }));

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      },
    );
  }
});