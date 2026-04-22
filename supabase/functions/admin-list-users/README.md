# admin-list-users

Edge Function que devuelve usuarios de `auth.users` solo si quien invoca tiene el email administrador configurado.

## Variables requeridas (en Supabase Functions Secrets)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

## Seguridad

- Requiere JWT válido (el frontend envía `Authorization` automáticamente en `supabase.functions.invoke`).
- Valida `user.email === ADMIN_EMAIL`.
- Si no coincide, responde `403 Forbidden`.
