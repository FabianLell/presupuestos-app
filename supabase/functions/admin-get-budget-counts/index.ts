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
    // Crear cliente con service role para bypassear RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Obteniendo conteo de presupuestos para todos los usuarios con service role')

    // Obtener todos los presupuestos con service role
    const { data: presupuestos, error } = await supabase
      .from('presupuestos')
      .select('user_id')

    if (error) {
      console.error('Error obteniendo presupuestos:', error)
      throw error
    }

    // Contar presupuestos por usuario
    const mapaCant: Record<string, number> = {}
    if (presupuestos) {
      presupuestos.forEach((p) => {
        mapaCant[p.user_id] = (mapaCant[p.user_id] || 0) + 1
      })
    }

    console.log('Conteos de presupuestos por usuario:', mapaCant)

    return new Response(
      JSON.stringify({ 
        success: true,
        budgetCounts: mapaCant
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error en admin-get-budget-counts:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error interno del servidor',
        details: error
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
