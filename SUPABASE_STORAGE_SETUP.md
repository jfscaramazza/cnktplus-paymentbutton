# Configuración de Supabase Storage para Imágenes

Esta guía te ayudará a configurar Supabase Storage para almacenar las imágenes de los artículos/servicios en lugar de usar Base64 en las URLs.

## 📋 Pasos de Configuración

### 1. Ejecutar Scripts SQL

Ejecuta los siguientes scripts en el **SQL Editor** de Supabase en este orden:

#### a) Agregar columnas a la tabla
```bash
# Ejecuta el contenido de: supabase_add_item_fields.sql
```
Este script agrega las columnas `item_name`, `item_description` e `item_image` a la tabla `payment_buttons`.

#### b) Configurar Storage
```bash
# Ejecuta el contenido de: supabase_storage_setup.sql
```
Este script:
- Crea el bucket `payment-item-images`
- Configura políticas RLS para acceso público
- Establece límites (5MB por archivo, formatos permitidos)

### 2. Verificar Configuración en Supabase Dashboard

1. Ve a tu proyecto en Supabase
2. Navega a **Storage** en el menú lateral
3. Verifica que el bucket `payment-item-images` existe
4. Verifica que el bucket está marcado como **Público**

### 3. Verificar Políticas RLS

1. Ve a **Storage** → **Policies**
2. Verifica que existen las siguientes políticas para `payment-item-images`:
   - ✅ Public read access for payment item images
   - ✅ Public insert access for payment item images
   - ✅ Public update access for payment item images
   - ✅ Public delete access for payment item images

### 4. Configurar Variables de Entorno

Asegúrate de que tu archivo `.env` tenga las credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 Funcionamiento

### Subida de Imágenes

Cuando un usuario selecciona una imagen en el formulario:

1. **Validación**: Se verifica que la imagen no exceda 5MB
2. **Subida**: La imagen se sube a Supabase Storage en el bucket `payment-item-images`
3. **Path**: Se genera un path único: `payment-items/{timestamp}-{random}.{ext}`
4. **URL**: Se obtiene la URL pública de la imagen
5. **Almacenamiento**: Solo se guarda la URL en la base de datos (no Base64)

### Carga de Imágenes

Cuando se carga un botón de pago:

1. Se lee la URL de la imagen desde la base de datos
2. La imagen se muestra directamente desde Supabase Storage
3. Si la URL es Base64 (links antiguos), se muestra igualmente

## 📝 Notas Importantes

- **Tamaño máximo**: 5MB por imagen
- **Formatos permitidos**: JPEG, JPG, PNG, WEBP, GIF
- **Bucket público**: Las imágenes son accesibles públicamente sin autenticación
- **Compatibilidad**: El código mantiene compatibilidad con imágenes Base64 de links antiguos

## 🔒 Seguridad (Opcional)

Si quieres restringir la escritura de imágenes:

1. Elimina las políticas de INSERT/UPDATE/DELETE del bucket
2. Usa la **Service Role Key** en lugar de la **Anon Key** para operaciones de escritura
3. Implementa autenticación en tu aplicación

## 🐛 Solución de Problemas

### Error: "Bucket not found"
- Verifica que ejecutaste el script `supabase_storage_setup.sql`
- Verifica que el bucket se llama exactamente `payment-item-images`

### Error: "New row violates row-level security policy"
- Verifica que las políticas RLS están configuradas correctamente
- Verifica que el bucket está marcado como público

### Las imágenes no se muestran
- Verifica que la URL de la imagen es correcta
- Verifica que el bucket tiene políticas de lectura pública
- Revisa la consola del navegador para errores de CORS

### Imágenes muy grandes
- El límite es 5MB por archivo
- Considera comprimir las imágenes antes de subirlas
- Puedes ajustar el límite en `supabase_storage_setup.sql`

