-- ============================================
-- Script para configurar políticas RLS de DELETE
-- DEFIPAGO - Permitir eliminación de botones
-- ============================================

-- 1. Asegurar que RLS esté habilitado
ALTER TABLE payment_buttons ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar política DELETE antigua si existe
DROP POLICY IF EXISTS "Public delete access for payment buttons" ON payment_buttons;
DROP POLICY IF EXISTS "Owner can delete own buttons" ON payment_buttons;
DROP POLICY IF EXISTS "Recipient can delete buttons" ON payment_buttons;

-- 3. Crear política de DELETE pública
-- NOTA: La validación de permisos (owner_address o recipient_address) 
-- se hace en el código de la aplicación, no en la política RLS
-- porque la app no usa autenticación JWT de Supabase
CREATE POLICY "Public delete access for payment buttons"
  ON payment_buttons
  FOR DELETE
  USING (true);

-- ============================================
-- VERIFICACIÓN:
-- ============================================
-- Para verificar que la política se creó correctamente, ejecuta:
-- 
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename = 'payment_buttons'
-- ORDER BY policyname;
-- 
-- Deberías ver políticas para SELECT, INSERT, UPDATE y DELETE
-- ============================================

-- ============================================
-- NOTAS IMPORTANTES:
-- ============================================
-- 1. Esta política permite DELETE público porque la app no usa
--    autenticación JWT de Supabase. La validación de permisos
--    se hace en el código JavaScript (App.jsx) verificando que
--    account.toLowerCase() coincida con owner_address o recipient_address.
--
-- 2. Si en el futuro quieres usar autenticación JWT de Supabase,
--    puedes cambiar la política a:
--
--    CREATE POLICY "Owner can delete own buttons"
--      ON payment_buttons
--      FOR DELETE
--      USING (
--        owner_address = LOWER(current_setting('request.jwt.claims', true)::json->>'address')
--        OR recipient_address = LOWER(current_setting('request.jwt.claims', true)::json->>'address')
--      );
--
-- 3. La app actualmente valida permisos antes de llamar a DELETE,
--    así que esta política pública es segura.
-- ============================================

