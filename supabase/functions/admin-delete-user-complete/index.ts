import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = [
  "https://presupuestos-app.vercel.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId es requerido' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Crear cliente con service role para bypassear RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Iniciando eliminación completa con service role para:', userId)

    // 1. Eliminar presupuestos y sus items
    console.log('1. Eliminando presupuestos y sus items...')
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('id')
      .eq('user_id', userId)

    if (presupuestos && presupuestos.length > 0) {
      const presupuestoIds = presupuestos.map(p => p.id)
      await supabase
        .from('presupuesto_materiales')
        .delete()
        .in('presupuesto_id', presupuestoIds)

      await supabase
        .from('presupuesto_servicios')
        .delete()
        .in('presupuesto_id', presupuestoIds)
    }

    const { error: errorPresupuestos } = await supabase
      .from('presupuestos')
      .delete()
      .eq('user_id', userId)

    if (errorPresupuestos) throw errorPresupuestos

    // 2. Eliminar clientes
    console.log('2. Eliminando clientes...')
    const { error: errorClientes } = await supabase
      .from('clientes')
      .delete()
      .eq('user_id', userId)

    if (errorClientes) throw errorClientes

    // 3. Eliminar categorías
    console.log('3. Eliminando categorías...')
    const { error: errorCategorias } = await supabase
      .from('categorias')
      .delete()
      .eq('user_id', userId)

    if (errorCategorias) throw errorCategorias

    // 4. Eliminar servicios
    console.log('4. Eliminando servicios...')
    const { error: errorServicios, count: countServicios } = await supabase
      .from('servicios')
      .delete({ count: 'exact' })
      .eq('user_id', userId)

    if (errorServicios) throw errorServicios
    console.log('Servicios eliminados:', countServicios)

    // 5. Eliminar materiales
    console.log('5. Eliminando materiales...')
    const { error: errorMateriales, count: countMateriales } = await supabase
      .from('materiales')
      .delete({ count: 'exact' })
      .eq('user_id', userId)

    if (errorMateriales) throw errorMateriales
    console.log('Materiales eliminados:', countMateriales)

    // 6. Eliminar perfil
    console.log('6. Eliminando perfil...')
    const { error: errorPerfil } = await supabase
      .from('perfil')
      .delete()
      .eq('id', userId)

    if (errorPerfil) throw errorPerfil

    console.log('=== DATOS ELIMINADOS CORRECTAMENTE ===')

    // 7. Eliminar usuario de auth.users
    console.log('7. Eliminando usuario de auth.users...')
    const { error: errorAuth } = await supabase.auth.admin.deleteUser(userId)

    if (errorAuth) {
      console.log('Error eliminando auth user:', errorAuth)
      throw errorAuth
    }

    console.log('=== USUARIO ELIMINADO COMPLETAMENTE ===')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario eliminado completamente',
        deleted: {
          materiales: countMateriales,
          servicios: countServicios
        }
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error en admin-delete-user-complete:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Error interno del servidor',
        details: error
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
