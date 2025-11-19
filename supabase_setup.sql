-- ============================================
-- Script de configuración para Supabase
-- CNKT+ Pay - Tabla de botones de pago
-- ============================================

-- 1. Crear la tabla payment_buttons
CREATE TABLE IF NOT EXISTS payment_buttons (
  id TEXT PRIMARY KEY,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  concept TEXT,
  button_text TEXT,
  button_color TEXT,
  token_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índice para búsquedas rápidas por ID
CREATE INDEX IF NOT EXISTS idx_payment_buttons_id ON payment_buttons(id);

-- 3. Crear índice para búsquedas por fecha de creación (opcional, útil para limpieza)
CREATE INDEX IF NOT EXISTS idx_payment_buttons_created_at ON payment_buttons(created_at);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE payment_buttons ENABLE ROW LEVEL SECURITY;

-- 5. Crear política para lectura pública (cualquiera puede leer los links)
-- Esto permite que los links cortos funcionen sin autenticación
CREATE POLICY "Public read access for payment buttons"
  ON payment_buttons
  FOR SELECT
  USING (true);

-- 6. Crear política para inserción pública (cualquiera puede crear links)
-- Esto permite que la app genere nuevos links sin autenticación
CREATE POLICY "Public insert access for payment buttons"
  ON payment_buttons
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- NOTAS:
-- ============================================
-- - Los links cortos funcionarán desde cualquier dispositivo
-- - No se requiere autenticación para leer o crear links
-- - Si quieres restringir la escritura, elimina la política de INSERT
--   y usa la Service Role Key en lugar de la Anon Key en tu app
-- ============================================

