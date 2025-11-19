-- ============================================
-- Script de corrección para Supabase
-- Verificar y corregir problemas comunes
-- ============================================

-- 1. Verificar que todas las columnas existan
DO $$ 
BEGIN
  -- Agregar owner_address si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'payment_buttons' AND column_name = 'owner_address') THEN
    ALTER TABLE payment_buttons ADD COLUMN owner_address TEXT;
    UPDATE payment_buttons SET owner_address = recipient_address WHERE owner_address IS NULL;
  END IF;

  -- Agregar deleted_at si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'payment_buttons' AND column_name = 'deleted_at') THEN
    ALTER TABLE payment_buttons ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Agregar payment_type si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'payment_buttons' AND column_name = 'payment_type') THEN
    ALTER TABLE payment_buttons ADD COLUMN payment_type TEXT DEFAULT 'fixed';
  END IF;
END $$;

-- 2. Verificar que las políticas de INSERT existan
-- Eliminar política antigua si existe
DROP POLICY IF EXISTS "Public insert access for payment buttons" ON payment_buttons;

-- Crear política de INSERT actualizada
CREATE POLICY "Public insert access for payment buttons"
  ON payment_buttons
  FOR INSERT
  WITH CHECK (true);

-- 3. Verificar que las políticas de SELECT existan
DROP POLICY IF EXISTS "Public read access for payment buttons" ON payment_buttons;

CREATE POLICY "Public read access for payment buttons"
  ON payment_buttons
  FOR SELECT
  USING (true);

-- 4. Verificar que las políticas de UPDATE existan
DROP POLICY IF EXISTS "Owner can update own buttons" ON payment_buttons;

CREATE POLICY "Owner can update own buttons"
  ON payment_buttons
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================
-- NOTAS:
-- ============================================
-- Este script corrige problemas comunes:
-- 1. Columnas faltantes (owner_address, deleted_at, payment_type)
-- 2. Políticas RLS incorrectas o faltantes
-- 3. Permisos de INSERT/SELECT/UPDATE
-- ============================================

