import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== admin-delete-user function called ===')
  console.log('Method:', req.method)
  console.log('Headers:', Object.fromEntries(req.headers.entries()))

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting admin-delete-user function')

    // Obtener el token de autorización
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)

    if (!authHeader) {
      console.log('No authorization header found')
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Verificar variables de entorno
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const adminEmails = (Deno.env.get('ADMIN_EMAIL') || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)

    console.log('Environment check:')
    console.log('- SUPABASE_URL present:', !!supabaseUrl)
    console.log('- SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseServiceKey)
    console.log('- ADMIN_EMAIL:', adminEmails)

    // Parsear body
    let body;
    try {
      body = await req.json();
      console.log('Request body:', body)
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError)
      return new Response(JSON.stringify({
        error: 'Invalid JSON',
        details: parseError.toString()
      }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { userId } = body
    console.log('Target userId:', userId)

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Verificar usuario admin
    try {
      const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
        global: { headers: { Authorization: authHeader } },
      })

      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

      if (authError || !user) {
        console.error('Auth error:', authError)
        return new Response(JSON.stringify({ error: 'Invalid token', details: authError?.message }), {
          status: 401,
          headers: corsHeaders,
        })
      }

      const userEmail = user.email?.toLowerCase()
      console.log('Requesting user:', userEmail)
      console.log('Is admin:', userEmail && adminEmails.includes(userEmail))

      if (!userEmail || !adminEmails.includes(userEmail)) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: corsHeaders,
        })
      }
    } catch (adminCheckError) {
      console.error('Admin check failed:', adminCheckError)
      return new Response(JSON.stringify({
        error: 'Admin check failed',
        details: adminCheckError.toString()
      }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    // Eliminar usuario de auth.users - LOS DATOS YA SE ELIMINARON DESDE EL FRONTEND
    try {
      console.log('=== ELIMINANDO USUARIO DE AUTH (DATOS YA LIMPIOS) ===')

      // Verificar que no haya dependencias bloqueantes antes de eliminar auth user
      const adminSupabase = createClient(supabaseUrl!, supabaseServiceKey!)

      // Verificar si hay materiales con dependencias
      // Primero obtener los IDs de materiales del usuario
      const { data: materialesUsuario } = await adminSupabase
        .from('materiales')
        .select('id')
        .eq('user_id', userId)

      const materialesIds = materialesUsuario?.map(m => m.id) || []

      let materialesConDependencias = 0
      if (materialesIds.length > 0) {
        const { count } = await adminSupabase
          .from('presupuesto_materiales')
          .select('*', { count: 'exact', head: true })
          .in('material_id', materialesIds)
        materialesConDependencias = count || 0
      }

      if (materialesConDependencias && materialesConDependencias > 0) {
        console.log('ERROR: Todavia hay dependencias de materiales')
        return new Response(JSON.stringify({
          error: 'Cannot delete user: still has material dependencies',
          dependencies_count: materialesConDependencias
        }), {
          status: 400,
          headers: corsHeaders,
        })
      }

      console.log('Verificacion OK: No hay dependencias bloqueantes')

      // Intentar eliminar usuario de auth con el método estándar
      console.log('Intentando auth.admin.deleteUser()...')
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId)

      if (deleteError) {
        console.error('Error en auth.admin.deleteUser():', deleteError)
        return new Response(JSON.stringify({
          error: `Failed to delete auth user: ${deleteError.message}`,
          details: deleteError
        }), {
          status: 500,
          headers: corsHeaders,
        })
      }

      console.log('EXITO: Usuario de auth eliminado correctamente')
      return new Response(JSON.stringify({
        success: true,
        message: 'Auth user deleted successfully'
      }), {
        headers: corsHeaders,
      })

    } catch (deleteException) {
      console.error('Exception deleting auth user:', deleteException)
      return new Response(JSON.stringify({
        error: `Exception: ${deleteException.toString()}`,
        stack: deleteException.stack
      }), {
        status: 500,
        headers: corsHeaders,
      })
    }

  } catch (error) {
    console.error('Top-level error:', error)
    return new Response(JSON.stringify({
      error: `Unexpected error: ${error.toString()}`,
      details: error.stack
    }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
