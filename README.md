# DEFIPAGO - Generador de Botones de Pago DeFi

Una aplicación descentralizada (dApp) sencilla para generar botones de pago DeFi con tokens ERC-20 en la red Polygon Mainnet.

## 🚀 Características

- ✅ Conexión con MetaMask
- ✅ Generación de botones de pago personalizables
- ✅ Pagos con tokens ERC-20 en Polygon Mainnet
- ✅ Interfaz moderna y responsive
- ✅ Validación de direcciones y montos
- ✅ Confirmación de transacciones

## 📋 Requisitos Previos

- Node.js (versión 16 o superior)
- npm o yarn
- MetaMask instalado en tu navegador
- Wallet con tokens en Polygon Mainnet

## 🛠️ Instalación

1. Clona o descarga este repositorio
2. Instala las dependencias:

```bash
npm install
```

## 🎯 Uso

1. Inicia el servidor de desarrollo:

```bash
npm run dev
```

2. Abre tu navegador y navega a `http://localhost:5173`
3. Conecta tu wallet MetaMask (asegúrate de estar en Polygon Mainnet)
4. Genera botones de pago ingresando:
   - Dirección del destinatario
   - Monto a pagar
   - Texto del botón
   - Color del botón
5. Usa los botones generados para realizar pagos

## 🔧 Configuración

El token configurado es:
- **Dirección**: `0x87bdfbe98Ba55104701b2F2e999982a317905637`
- **Red**: Polygon Mainnet (Chain ID: 137)

Para cambiar el token, edita la constante `TOKEN_ADDRESS` en `src/App.jsx`.

## 📦 Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la build de producción

## 🏗️ Estructura del Proyecto

```
defipago/
├── src/
│   ├── components/
│   │   ├── PaymentButton.jsx
│   │   └── PaymentButtonGenerator.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## 🔐 Seguridad

- Siempre verifica las direcciones antes de realizar transacciones
- Asegúrate de estar en la red correcta (Polygon Mainnet)
- Revisa los montos antes de confirmar
- Esta aplicación no almacena claves privadas

## 📝 Notas

- La aplicación requiere MetaMask o una wallet compatible con EIP-1193
- Las transacciones requieren gas (MATIC) en Polygon Mainnet
- Los botones generados son funcionales solo mientras la aplicación esté abierta

## 🐛 Solución de Problemas

**Error: "Por favor, instala MetaMask"**
- Asegúrate de tener MetaMask instalado y habilitado en tu navegador

**Error: "Balance insuficiente"**
- Verifica que tengas suficientes tokens y MATIC para gas

**Error al cambiar de red**
- La aplicación intentará agregar Polygon Mainnet automáticamente si no está configurada

## 📄 Licencia

Este proyecto es de código abierto y está disponible para uso libre.

