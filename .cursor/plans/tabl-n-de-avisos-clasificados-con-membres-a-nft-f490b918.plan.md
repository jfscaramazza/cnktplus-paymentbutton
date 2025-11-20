<!-- f490b918-3739-420f-9258-3ab66bcff343 507a476a-783f-4abc-a9e5-80be393fe3c2 -->
# Plan: Tablón de Avisos Clasificados con Membresía NFT

## Arquitectura General

El sistema se integrará en la misma aplicación DEFIPAGO, añadiendo una nueva sección "Tablón" accesible desde el menú principal. Requiere membresía NFT para publicar, sistema de reputación basado en transacciones y ratings, KYC obligatorio, y flujo de escrow para compras.

## Fase 1: Base de Datos y Esquema

### 1.1 Tablas en Supabase

**Archivo**: `supabase_classifieds_schema.sql`

Crear las siguientes tablas:

- `users`: Información de usuarios (wallet address, KYC status, reputación calculada)
- `nft_memberships`: Precios y metadata del NFT de membresía (editable por admin)
- `user_memberships`: Membresías NFT adquiridas por usuarios
- `classifieds`: Avisos publicados (hasta 3 fotos, descripción, precio, vendedor)
- `classified_images`: Imágenes asociadas a avisos (hasta 3 por aviso, <5MB cada una)
- `transactions`: Transacciones de compra/venta (estado, tracking, fechas)
- `ratings`: Ratings y reviews (1-5 estrellas, comprador/vendedor)
- `admin_settings`: Configuración del admin (precio NFT, metadata dinámica)

### 1.2 Supabase Storage

Crear buckets:

- `classified-images`: Para fotos de avisos
- `nft-images`: Para imágenes de NFTs de membresía

Configurar políticas RLS para acceso controlado.

### 1.3 Políticas RLS

Definir políticas para lectura/escritura según roles:

- Lectura pública para avisos activos
- Escritura solo para usuarios con membresía NFT
- Lectura de transacciones solo para partes involucradas
- Acceso admin solo para direcciones autorizadas

## Fase 2: Contrato ERC-1155 para Membresía NFT

### 2.1 Smart Contract

**Archivo**: `contracts/MembershipNFT.sol`

Contrato ERC-1155 con:

- Función `mintMembership(address to, uint256 amount)`: Mintea membresía a cambio de pago en CNKT+
- Función `hasMembership(address user)`: Verifica si usuario tiene membresía activa
- Metadata dinámica editable por admin
- Precio variable en CNKT+ (configurable)

### 2.2 Integración Frontend

**Archivos a modificar**:

- `src/App.jsx`: Agregar lógica de verificación de membresía
- `src/components/MembershipMinter.jsx`: Componente para comprar membresía NFT
- `src/components/MembershipChecker.jsx`: Hook para verificar membresía antes de publicar

**Dependencias nuevas**:

- Contrato ABI para ERC-1155
- Lógica para transferir CNKT+ tokens al contrato

## Fase 3: Integración Stripe Identity

### 3.1 Configuración

**Archivos nuevos**:

- `src/lib/stripe.js`: Cliente Stripe configurado
- `src/components/KYCVerification.jsx`: Componente de verificación KYC

**Variables de entorno**:

- `VITE_STRIPE_PUBLISHABLE_KEY`

### 3.2 Flujo KYC

1. Usuario inicia verificación desde perfil
2. Redirige a Stripe Identity verification
3. Webhook de Stripe actualiza estado en DB (`users.kyc_status`)
4. UI muestra badge de verificación

### 3.3 Validación en Transacciones

Verificar KYC status antes de permitir:

- Publicar avisos (vendedor)
- Comprar (comprador)

## Fase 4: Componentes UI del Tablón

### 4.1 Listado de Avisos

**Archivo**: `src/components/ClassifiedsList.jsx`

- Grid de avisos con imágenes, título, precio, reputación del vendedor
- Filtros y búsqueda
- Paginación

### 4.2 Formulario de Publicación

**Archivo**: `src/components/ClassifiedForm.jsx`

- Validación de membresía NFT antes de mostrar formulario
- Campos: título, descripción, precio, categoría
- Upload de hasta 3 imágenes (<5MB cada una)
- Validación de tamaño y formato
- Preview de imágenes antes de subir

### 4.3 Detalle de Aviso

**Archivo**: `src/components/ClassifiedDetail.jsx`

- Vista completa del aviso con todas las imágenes
- Información del vendedor (reputación, KYC badge)
- Botón de compra (integra botón de pago existente)
- Historial de ventas del vendedor

### 4.4 Sistema de Imágenes

**Archivo**: `src/lib/imageUpload.js`

- Función para subir imágenes a Supabase Storage
- Validación de tamaño (<5MB)
- Redimensionamiento opcional
- URLs públicas para las imágenes

## Fase 5: Sistema de Reputación y Ratings

### 5.1 Cálculo de Reputación

**Archivo**: `src/lib/reputation.js`

Función que calcula reputación basada en:

- Ratio: `tx_completadas / tx_iniciadas`
- Promedio de ratings (1-5 estrellas)
- Peso: 60% transacciones, 40% ratings

Fórmula: `(ratio_tx * 0.6 + (avg_rating / 5) * 0.4) * 100`

### 5.2 Componente de Rating

**Archivo**: `src/components/RatingSystem.jsx`

- Componente de estrellas (1-5)
- Formulario de review opcional
- Submit al confirmar recepción de producto

### 5.3 Actualización Automática

Cron job o función de Supabase Edge Function para recalcular reputaciones periódicamente.

## Fase 6: Flujo de Compra/Venta con Escrow

### 6.1 Estados de Transacción

1. `pending_payment`: Comprador debe pagar
2. `paid`: Pago confirmado, esperando envío
3. `shipped`: Vendedor agregó tracking, esperando confirmación
4. `completed`: Comprador confirmó recepción
5. `disputed`: Disputa abierta (requiere admin)

### 6.2 Componente de Transacción

**Archivo**: `src/components/TransactionFlow.jsx`

Flujo por estado:

- **pending_payment**: Botón de pago (usar PaymentButton existente)
- **paid**: Campo para vendedor agregar tracking URL
- **shipped**: Botón para comprador confirmar recepción + rating
- **completed**: Vista de transacción completada

### 6.3 Timer de 1 Semana

**Archivo**: `src/lib/transactionTimer.js`

- Al llegar a estado `shipped`, iniciar timer de 7 días
- Si no hay confirmación, mostrar opción de confirmación manual (solo admin)
- UI que muestra días restantes

### 6.4 Tabla de Transacciones

**Tabla**: `transactions`

- Campos: `classified_id`, `buyer_address`, `seller_address`, `amount`, `token_address`, `status`, `tracking_url`, `shipped_at`, `completed_at`, `expires_at`

## Fase 7: Dashboard de Administración

### 7.1 Verificación de Admin

**Archivo**: `src/lib/admin.js`

Lista de direcciones wallet autorizadas como admin (configurable en `.env`).

### 7.2 Componentes Admin

**Archivo**: `src/components/AdminDashboard.jsx`

Secciones:

1. **Configuración NFT**: Editar precio, metadata dinámica, imagen
2. **Gestionar Transacciones**: Ver todas, confirmar manualmente si expira
3. **Gestionar Usuarios**: Ver lista, banear si necesario
4. **Estadísticas**: Total de avisos, transacciones, usuarios

### 7.3 Formulario Metadata NFT

**Archivo**: `src/components/AdminNFTConfig.jsx`

- Editar precio en CNKT+
- Cambiar imagen del NFT (Supabase Storage)
- Editar metadata (nombre, descripción)
- Preview del NFT

## Fase 8: Integración en App Principal

### 8.1 Navegación

**Modificar**: `src/App.jsx`

Agregar tabs/navegación:

- "Botones de Pago" (funcionalidad existente)
- "Tablón" (nueva funcionalidad)
- "Mi Perfil" (estado de membresía, KYC, reputación)

### 8.2 Rutas

Considerar usar React Router para:

- `/`: Landing / Generador de botones
- `/classifieds`: Listado de avisos
- `/classifieds/:id`: Detalle de aviso
- `/publish`: Formulario de publicación (requiere membresía)
- `/transactions`: Historial de transacciones del usuario
- `/profile`: Perfil del usuario
- `/admin`: Dashboard admin (solo para admins)

### 8.3 Estados Globales

Agregar estados para:

- Membresía NFT del usuario conectado
- Estado KYC
- Reputación del usuario

## Fase 9: Estilos y UI/UX

### 9.1 CSS

**Archivo**: `src/App.css`

Agregar estilos para:

- Grid de avisos
- Formulario de publicación
- Componente de rating (estrellas)
- Badges de reputación y KYC
- Dashboard admin

### 9.2 Responsive Design

Asegurar que todos los componentes sean responsive (mobile-first).

## Dependencias Nuevas a Instalar

```json
{
  "@stripe/stripe-js": "^2.x",
  "react-router-dom": "^6.x",
  "date-fns": "^2.x" // Para manejo de fechas y timers
}
```

## Archivos SQL Principales

1. `supabase_classifieds_schema.sql`: Esquema completo de tablas
2. `supabase_classifieds_rls.sql`: Políticas RLS
3. `supabase_storage_setup.sql`: Configuración de buckets

## Archivos de Contrato

1. `contracts/MembershipNFT.sol`: Contrato ERC-1155
2. `contracts/MembershipNFT.json`: ABI compilado
3. `scripts/deploy.js`: Script de despliegue (Hardhat o similar)

## Consideraciones de Seguridad

1. Validar en frontend Y backend todas las operaciones
2. RLS en Supabase para proteger datos
3. Verificar membresía NFT en contrato antes de permitir publicación
4. Validar KYC antes de transacciones
5. Sanitizar inputs de usuario (XSS prevention)
6. Validar tamaño y tipo de imágenes antes de upload

### To-dos

- [ ] Crear esquema de base de datos en Supabase (tablas: users, nft_memberships, user_memberships, classifieds, classified_images, transactions, ratings, admin_settings)
- [ ] Configurar Supabase Storage buckets (classified-images, nft-images) con políticas RLS
- [ ] Desarrollar contrato ERC-1155 MembershipNFT.sol con funciones de mint, verificación y metadata dinámica
- [ ] Integrar verificación de membresía NFT en frontend (componentes MembershipMinter.jsx, MembershipChecker.jsx)
- [ ] Integrar Stripe Identity para KYC (componente KYCVerification.jsx, webhook handler, actualización de estado en DB)
- [ ] Desarrollar componentes UI del tablón (ClassifiedsList.jsx, ClassifiedForm.jsx, ClassifiedDetail.jsx)
- [ ] Implementar sistema de upload de imágenes (validación <5MB, hasta 3 fotos, almacenamiento en Supabase Storage)
- [ ] Desarrollar sistema de reputación (cálculo de ratio tx + ratings, componente RatingSystem.jsx)
- [ ] Implementar flujo de compra/venta con escrow (TransactionFlow.jsx, estados, tracking URL, timer de 1 semana)
- [ ] Crear dashboard de administración (AdminDashboard.jsx, AdminNFTConfig.jsx, gestión de transacciones y usuarios)
- [ ] Integrar tablón en App.jsx (navegación, rutas con React Router, estados globales)
- [ ] Agregar estilos CSS para todos los nuevos componentes (grid de avisos, formularios, ratings, admin dashboard)