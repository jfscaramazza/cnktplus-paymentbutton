# Configuración de Supabase para Links Cortos

Esta guía te ayudará a configurar Supabase para que los links de pago sean de solo 6 dígitos.

## 📋 Requisitos

1. Una cuenta en [Supabase](https://supabase.com)
2. Un proyecto creado en Supabase

## 🗄️ Crear la Tabla en Supabase

1. Ve a tu proyecto en Supabase
2. Navega a **Table Editor** en el menú lateral
3. Haz clic en **"New Table"**
4. Configura la tabla con los siguientes datos:

### Nombre de la tabla:
```
payment_buttons
```

### Columnas:

| Nombre | Tipo | Configuración |
|--------|------|---------------|
| `id` | `text` | Primary Key, Unique |
| `recipient_address` | `text` | Not Null |
| `amount` | `text` | Not Null |
| `concept` | `text` | Nullable |
| `button_text` | `text` | Nullable |
| `button_color` | `text` | Nullable |
| `token_address` | `text` | Not Null |
| `created_at` | `timestamp` | Default: `now()` |

### SQL para crear la tabla (alternativa):

Si prefieres usar SQL, ejecuta este comando en el **SQL Editor** de Supabase:

```sql
CREATE TABLE payment_buttons (
  id TEXT PRIMARY KEY,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  concept TEXT,
  button_text TEXT,
  button_color TEXT,
  token_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas
CREATE INDEX idx_payment_buttons_id ON payment_buttons(id);
```

## 🔑 Obtener las Credenciales

1. Ve a **Settings** → **API** en tu proyecto de Supabase
2. Encontrarás:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: Una clave larga que comienza con `eyJ...`

## ⚙️ Configurar Variables de Entorno

1. Crea un archivo `.env` en la raíz del proyecto (si no existe)
2. Agrega las siguientes variables:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANTE**: 
- Reemplaza `xxxxx` con tu ID de proyecto real
- Reemplaza la clave anon con tu clave real
- El archivo `.env` ya está en `.gitignore` para proteger tus credenciales

## 🔒 Configurar Políticas de Seguridad (RLS)

Para que cualquiera pueda leer los links (pero solo tu app pueda escribir), configura Row Level Security:

1. Ve a **Authentication** → **Policies** en Supabase
2. Selecciona la tabla `payment_buttons`
3. Crea una política para lectura pública:

```sql
-- Permitir lectura pública (cualquiera puede leer los links)
CREATE POLICY "Public read access" ON payment_buttons
  FOR SELECT
  USING (true);
```

4. Opcional: Si quieres restringir la escritura, puedes crear una política más restrictiva o usar la clave de servicio en lugar de la anon key.

## ✅ Verificar la Configuración

1. Reinicia el servidor de desarrollo:
```bash
npm run dev
```

2. Intenta generar un botón de pago
3. El link generado debería ser algo como: `http://localhost:5173/ABC123` (6 caracteres)

## 🐛 Solución de Problemas

### Error: "Supabase credentials not configured"
- Verifica que el archivo `.env` existe y tiene las variables correctas
- Asegúrate de que las variables comienzan con `VITE_`
- Reinicia el servidor después de crear/modificar `.env`

### Error: "relation 'payment_buttons' does not exist"
- Verifica que la tabla se creó correctamente en Supabase
- Verifica que el nombre de la tabla es exactamente `payment_buttons`

### Error: "new row violates row-level security policy"
- Configura las políticas RLS como se indica arriba
- O desactiva RLS temporalmente para pruebas (no recomendado para producción)

## 📝 Notas

- Los links antiguos (con parámetros largos) seguirán funcionando como fallback
- Si Supabase no está configurado, la app usará el método antiguo automáticamente
- Los links cortos funcionan desde cualquier dispositivo/navegador
- Los datos se almacenan permanentemente en Supabase

