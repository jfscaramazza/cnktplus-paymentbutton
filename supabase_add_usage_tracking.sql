-- ============================================
-- Script para agregar sistema de uso/tracking
-- DEFIPAGO - Control de uso de botones
-- ============================================

-- 1. Agregar columnas para control de uso
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS usage_type TEXT DEFAULT 'single_use', -- 'single_use', 'unlimited', 'limited'
ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1, -- Para 'limited', el inventario máximo
ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0; -- Contador de usos actuales

-- 2. Comentarios para documentación
COMMENT ON COLUMN payment_buttons.usage_type IS 'Tipo de uso: single_use (un solo pago), unlimited (ilimitado), limited (hasta max_uses)';
COMMENT ON COLUMN payment_buttons.max_uses IS 'Número máximo de usos permitidos (solo para usage_type = limited)';
COMMENT ON COLUMN payment_buttons.current_uses IS 'Número de pagos realizados exitosamente';

-- 3. Crear tabla para registrar transacciones (opcional, para historial detallado)
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id TEXT NOT NULL REFERENCES payment_buttons(id) ON DELETE CASCADE,
  payer_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_address TEXT NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_payment_transactions_button_id ON payment_transactions(button_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payer ON payment_transactions(payer_address);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at);

-- 5. Habilitar RLS en payment_transactions
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- 6. Política para lectura pública (cualquiera puede ver transacciones de un botón)
CREATE POLICY "Public read access for payment transactions"
  ON payment_transactions
  FOR SELECT
  USING (true);

-- 7. Política para inserción pública (cualquiera puede registrar transacciones)
CREATE POLICY "Public insert access for payment transactions"
  ON payment_transactions
  FOR INSERT
  WITH CHECK (true);

-- 8. Actualizar registros existentes para que tengan valores por defecto
UPDATE payment_buttons 
SET 
  usage_type = COALESCE(usage_type, 'single_use'),
  max_uses = COALESCE(max_uses, 1),
  current_uses = COALESCE(current_uses, 0)
WHERE usage_type IS NULL OR max_uses IS NULL OR current_uses IS NULL;

-- 9. Crear función para verificar si un botón puede ser usado
CREATE OR REPLACE FUNCTION can_use_button(button_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  button_record RECORD;
BEGIN
  SELECT usage_type, max_uses, current_uses, deleted_at
  INTO button_record
  FROM payment_buttons
  WHERE id = button_id_param;
  
  -- Si no existe o está eliminado, no se puede usar
  IF NOT FOUND OR button_record.deleted_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Si es unlimited, siempre se puede usar
  IF button_record.usage_type = 'unlimited' THEN
    RETURN TRUE;
  END IF;
  
  -- Si es single_use, solo se puede usar si current_uses = 0
  IF button_record.usage_type = 'single_use' THEN
    RETURN button_record.current_uses = 0;
  END IF;
  
  -- Si es limited, verificar que current_uses < max_uses
  IF button_record.usage_type = 'limited' THEN
    RETURN button_record.current_uses < button_record.max_uses;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFICACIÓN:
-- ============================================
-- Para verificar que todo se creó correctamente:
-- 
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payment_buttons'
-- AND column_name IN ('usage_type', 'max_uses', 'current_uses')
-- ORDER BY column_name;
-- 
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_name = 'payment_transactions';
-- ============================================

-- ============================================
-- NOTAS:
-- ============================================
-- 1. usage_type puede ser:
--    - 'single_use': Solo se puede usar una vez (por defecto)
--    - 'unlimited': Se puede usar ilimitadamente
--    - 'limited': Se puede usar hasta max_uses veces
--
-- 2. Cuando se realiza un pago exitoso:
--    - Se incrementa current_uses
--    - Se registra en payment_transactions
--    - Se verifica si el botón aún puede usarse
--
-- 3. La función can_use_button() puede ser usada en la app
--    para verificar antes de permitir el pago
-- ============================================

