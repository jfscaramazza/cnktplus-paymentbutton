-- ============================================
-- Script COMPLETO de corrección para Supabase
-- DEFIPAGO - Corregir todos los problemas
-- ============================================

-- 1. Agregar columna payment_type si no existe
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'fixed';

-- 2. Agregar columna owner_address si no existe
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS owner_address TEXT;

-- 3. Agregar columna deleted_at si no existe
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 4. Normalizar owner_address (copiar desde recipient_address si es NULL y normalizar a minúsculas)
UPDATE payment_buttons 
SET owner_address = LOWER(COALESCE(owner_address, recipient_address))
WHERE owner_address IS NULL OR owner_address != LOWER(owner_address);

-- 5. Normalizar recipient_address a minúsculas
UPDATE payment_buttons 
SET recipient_address = LOWER(recipient_address)
WHERE recipient_address != LOWER(recipient_address);

-- 6. Normalizar token_address a minúsculas
UPDATE payment_buttons 
SET token_address = LOWER(token_address)
WHERE token_address != LOWER(token_address);

-- 7. Asegurar que payment_type tenga un valor por defecto para registros existentes
UPDATE payment_buttons 
SET payment_type = 'fixed'
WHERE payment_type IS NULL;

-- 8. Eliminar políticas antiguas si existen
DROP POLICY IF EXISTS "Public insert access for payment buttons" ON payment_buttons;
DROP POLICY IF EXISTS "Public read access for payment buttons" ON payment_buttons;
DROP POLICY IF EXISTS "Owner can update own buttons" ON payment_buttons;

-- 9. Crear política de INSERT (permite crear botones)
CREATE POLICY "Public insert access for payment buttons"
  ON payment_buttons
  FOR INSERT
  WITH CHECK (true);

-- 10. Crear política de SELECT (permite leer botones)
CREATE POLICY "Public read access for payment buttons"
  ON payment_buttons
  FOR SELECT
  USING (true);

-- 11. Crear política de UPDATE (permite actualizar botones - necesario para archivar)
CREATE POLICY "Public update access for payment buttons"
  ON payment_buttons
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 12. Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_payment_buttons_owner ON payment_buttons(owner_address);
CREATE INDEX IF NOT EXISTS idx_payment_buttons_deleted ON payment_buttons(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payment_buttons_owner_deleted ON payment_buttons(owner_address, deleted_at);

-- ============================================
-- VERIFICACIÓN:
-- ============================================
-- Ejecuta esto para verificar que todo esté correcto:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payment_buttons'
-- ORDER BY ordinal_position;
-- ============================================

