-- ============================================
-- Migración: Agregar owner_address y deleted_at
-- DEFIPAGO - Historial de botones por wallet
-- ============================================

-- 1. Agregar columna owner_address (el recipient_address es el dueño)
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS owner_address TEXT;

-- 2. Actualizar owner_address con recipient_address para registros existentes
UPDATE payment_buttons 
SET owner_address = recipient_address 
WHERE owner_address IS NULL;

-- 3. Agregar columna deleted_at para soft delete
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 3.1. Agregar columna payment_type para tipo de pago
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'fixed';

-- 4. Crear índice para búsquedas por owner
CREATE INDEX IF NOT EXISTS idx_payment_buttons_owner ON payment_buttons(owner_address);

-- 5. Crear índice para búsquedas por deleted_at
CREATE INDEX IF NOT EXISTS idx_payment_buttons_deleted ON payment_buttons(deleted_at);

-- 6. Crear índice compuesto para búsquedas por owner y deleted_at
CREATE INDEX IF NOT EXISTS idx_payment_buttons_owner_deleted ON payment_buttons(owner_address, deleted_at);

-- 7. Crear política para actualización (solo el owner puede actualizar sus propios botones)
CREATE POLICY "Owner can update own buttons"
  ON payment_buttons
  FOR UPDATE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'address' OR true)
  WITH CHECK (owner_address = current_setting('request.jwt.claims', true)::json->>'address' OR true);

-- Nota: La política anterior permite actualizaciones públicas porque no tenemos autenticación.
-- Si quieres restringir, elimina "OR true" y usa Service Role Key para actualizaciones.

-- ============================================
-- NOTAS:
-- ============================================
-- - owner_address será igual a recipient_address (el dueño del link)
-- - deleted_at será NULL para botones activos, y tendrá timestamp cuando se eliminen
-- - Los índices mejoran el rendimiento de las consultas por owner
-- - La política de UPDATE permite que cualquiera actualice (por ahora)
-- ============================================

