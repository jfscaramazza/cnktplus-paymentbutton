-- ============================================
-- Script para agregar campos de artículo/servicio
-- DEFIPAGO - Actualización de payment_buttons
-- ============================================

-- 1. Agregar nuevas columnas para información del artículo/servicio
ALTER TABLE payment_buttons 
ADD COLUMN IF NOT EXISTS item_name TEXT,
ADD COLUMN IF NOT EXISTS item_description TEXT,
ADD COLUMN IF NOT EXISTS item_image TEXT; -- Almacenará la URL/path de la imagen en Supabase Storage

-- 2. Comentarios para documentación
COMMENT ON COLUMN payment_buttons.item_name IS 'Nombre del artículo o servicio a la venta';
COMMENT ON COLUMN payment_buttons.item_description IS 'Descripción detallada del artículo o servicio';
COMMENT ON COLUMN payment_buttons.item_image IS 'URL o path de la imagen almacenada en Supabase Storage';

-- ============================================
-- NOTAS:
-- ============================================
-- - Las columnas son opcionales (NULL permitido) para mantener compatibilidad
-- - item_image almacenará la ruta de la imagen en Supabase Storage
-- - El campo 'concept' se mantiene para compatibilidad con links antiguos
-- ============================================

