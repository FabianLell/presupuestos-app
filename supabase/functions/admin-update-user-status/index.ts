import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, nuevoEstado } = await req.json()

    if (!userId || !nuevoEstado) {
      return new Response(
        JSON.stringify({ error: 'userId y nuevoEstado son requeridos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!['activo', 'desactivado', 'prueba'].includes(nuevoEstado)) {
      return new Response(
        JSON.stringify({ error: 'Estado no válido. Use: activo, desactivado o prueba' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Verificar token y autorización
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response('No autorizado', { headers: corsHeaders, status: 401 })
    }

    // Crear cliente con service role para bypassear RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar que el token sea válido y obtener usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response('Token inválido', { headers: corsHeaders, status: 401 })
    }

    // Verificar que sea admin
    const adminEmails = ["fabianlell@gmail.com"]
    if (!adminEmails.includes(user.email || "")) {
      return new Response('No autorizado', { headers: corsHeaders, status: 403 })
    }

    console.log(`Actualizando estado de usuario ${userId} a ${nuevoEstado} por admin ${user.email}`)

    // Actualizar estado del perfil con service role usando update
    const { data, error } = await supabase
      .from('perfil')
      .update({
        estado: nuevoEstado,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error actualizando estado:', error)
      throw error
    }

    console.log('Estado actualizado exitosamente:', data)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Estado actualizado correctamente',
        perfil: data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error en admin-update-user-status:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Error interno del servidor',
        details: error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
