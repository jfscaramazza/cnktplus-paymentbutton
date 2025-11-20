-- ============================================
-- Script de configuración de Supabase Storage
-- DEFIPAGO - Bucket para imágenes de artículos
-- ============================================

-- 1. Crear el bucket para imágenes de artículos/servicios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-item-images',
  'payment-item-images',
  true, -- Público para que las imágenes sean accesibles
  5242880, -- 5MB máximo por archivo
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Política RLS: Permitir lectura pública de imágenes
CREATE POLICY "Public read access for payment item images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-item-images');

-- 3. Política RLS: Permitir inserción pública de imágenes
-- Cualquiera puede subir imágenes (puedes restringir esto si lo deseas)
CREATE POLICY "Public insert access for payment item images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-item-images');

-- 4. Política RLS: Permitir actualización de imágenes
CREATE POLICY "Public update access for payment item images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'payment-item-images')
WITH CHECK (bucket_id = 'payment-item-images');

-- 5. Política RLS: Permitir eliminación de imágenes
CREATE POLICY "Public delete access for payment item images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'payment-item-images');

-- ============================================
-- NOTAS:
-- ============================================
-- - El bucket es público para que las imágenes sean accesibles sin autenticación
-- - Límite de 5MB por archivo
-- - Formatos permitidos: JPEG, JPG, PNG, WEBP, GIF
-- - Si quieres restringir la escritura, elimina las políticas de INSERT/UPDATE/DELETE
--   y usa la Service Role Key en lugar de la Anon Key para operaciones de escritura
-- ============================================

