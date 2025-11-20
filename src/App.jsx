import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import PaymentButtonGenerator from './components/PaymentButtonGenerator'
import PaymentButton from './components/PaymentButton'
import { supabase } from './lib/supabase'
import './App.css'

// Configuración de la red Polygon Mainnet
const POLYGON_MAINNET = {
  chainId: '0x89', // 137 en decimal
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18
  },
  rpcUrls: ['https://polygon-rpc.com/'],
  blockExplorerUrls: ['https://polygonscan.com/']
}

// Lista de tokens disponibles
const AVAILABLE_TOKENS = [
  {
    address: '0x87bdfbe98Ba55104701b2F2e999982a317905637',
    symbol: 'CNKT+',
    name: 'CNKT+ Token',
    default: true
  },
  {
    address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    symbol: 'USDC',
    name: 'USD Coin'
  },
  {
    address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    symbol: 'USDT',
    name: 'Tether USD'
  },
  {
    address: '0x0000000000000000000000000000000000001010',
    symbol: 'POL',
    name: 'Polygon'
  }
]


// Dirección del token por defecto
const DEFAULT_TOKEN_ADDRESS = AVAILABLE_TOKENS.find(t => t.default)?.address || AVAILABLE_TOKENS[0].address

// ABI mínimo para transferir tokens ERC-20
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
]

// Mapeo de Chain IDs a nombres de red
const NETWORK_NAMES = {
  1: 'Ethereum Mainnet',
  137: 'Polygon Mainnet',
  80001: 'Polygon Mumbai',
  56: 'BSC Mainnet',
  43114: 'Avalanche Mainnet',
  42161: 'Arbitrum One'
}

// Generar ID único de 6 caracteres alfanuméricos
const generateShortId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function App() {
  const [account, setAccount] = useState(null)
  const [provider, setProvider] = useState(null)
  const [buttons, setButtons] = useState([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentNetwork, setCurrentNetwork] = useState(null)
  const [tokenSymbol, setTokenSymbol] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [isLoadingToken, setIsLoadingToken] = useState(false)
  const [loadedFromLink, setLoadedFromLink] = useState(false)
  const [selectedTokenAddress, setSelectedTokenAddress] = useState(DEFAULT_TOKEN_ADDRESS)
  const [isPaymentLink, setIsPaymentLink] = useState(false)
  const isInitialLoad = useRef(true)
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('defipago-language')
    return saved || 'es'
  })
  const [removeStatus, setRemoveStatus] = useState({ id: null, status: null })
  const [historyTab, setHistoryTab] = useState('active') // 'active' o 'archived'
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(3) // 3, 6, 9, 18, 36 o custom
  const [customPageSize, setCustomPageSize] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [archivedButtons, setArchivedButtons] = useState([])
  const [totalActiveButtons, setTotalActiveButtons] = useState(0)
  const [totalArchivedButtons, setTotalArchivedButtons] = useState(0)
  const [editingButton, setEditingButton] = useState(null)

  // Cargar información del token
  const loadTokenInfo = async (provider, tokenAddress = selectedTokenAddress) => {
    if (!provider) return

    try {
      setIsLoadingToken(true)
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)

      // Intentar obtener symbol y name, con fallback para POL que es nativo
      let symbol, name
      try {
        [symbol, name] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.name()
        ])
      } catch (error) {
        // Si es POL (token nativo), usar valores por defecto
        if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
          symbol = 'POL'
          name = 'Polygon'
        } else {
          throw error
        }
      }

      setTokenSymbol(symbol)
      setTokenName(name)
    } catch (error) {
      console.error('Error cargando información del token:', error)
      // Buscar el token en la lista de tokens disponibles
      const tokenInfo = AVAILABLE_TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())
      if (tokenInfo) {
        setTokenSymbol(tokenInfo.symbol)
        setTokenName(tokenInfo.name)
      } else {
        setTokenSymbol('TOKEN')
        setTokenName('Token')
      }
    } finally {
      setIsLoadingToken(false)
    }
  }

  // Manejar cambio de token
  const handleTokenChange = async (newTokenAddress) => {
    setSelectedTokenAddress(newTokenAddress)
    // Limpiar botones existentes cuando se cambia el token
    setButtons([])
    // Recargar información del nuevo token si hay provider
    if (provider) {
      await loadTokenInfo(provider, newTokenAddress)
    }
  }

  // Toggle language
  const toggleLanguage = () => {
    const newLanguage = language === 'es' ? 'en' : 'es'
    setLanguage(newLanguage)
    localStorage.setItem('defipago-language', newLanguage)
  }

  // Detectar y actualizar información de red
  const updateNetworkInfo = async (provider) => {
    if (!provider) return

    try {
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)
      setCurrentNetwork({
        chainId,
        name: NETWORK_NAMES[chainId] || `Red ${chainId}`,
        isPolygon: chainId === 137
      })
    } catch (error) {
      console.error('Error obteniendo información de red:', error)
    }
  }

  // Cambiar a Polygon Mainnet
  const switchToPolygon = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask no está instalado.')
      return
    }

    try {
      // Intentar cambiar a Polygon Mainnet
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_MAINNET.chainId }],
      })

      // Actualizar información después del cambio
      if (provider) {
        await updateNetworkInfo(provider)
        await loadTokenInfo(provider, selectedTokenAddress)
      }
    } catch (switchError) {
      // Si la red no existe, agregarla
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [POLYGON_MAINNET],
          })
          if (provider) {
            await updateNetworkInfo(provider)
            await loadTokenInfo(provider, selectedTokenAddress)
          }
        } catch (addError) {
          console.error('Error agregando red:', addError)
          alert('Error al agregar Polygon Mainnet. Por favor, agrégalo manualmente en MetaMask.')
        }
      } else if (switchError.code === 4001) {
        // Usuario canceló
        return
      } else {
        console.error('Error cambiando de red:', switchError)
        alert('Error al cambiar a Polygon Mainnet.')
      }
    }
  }

  // Conectar wallet - siempre pide verificación
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setIsConnecting(true)

        // Remover listeners anteriores si existen
        if (window.ethereum) {
          window.ethereum.removeAllListeners('chainChanged')
          window.ethereum.removeAllListeners('accountsChanged')
        }

        const provider = new ethers.BrowserProvider(window.ethereum)

        // Solicitar acceso a la cuenta (siempre pide verificación)
        await provider.send("eth_requestAccounts", [])
        const signer = await provider.getSigner()
        const address = await signer.getAddress()

        // Actualizar información de red
        await updateNetworkInfo(provider)

        // Cargar información del token
        await loadTokenInfo(provider, selectedTokenAddress)

        setProvider(provider)
        setAccount(address)

        // Cargar historial de botones activos e inactivos cuando se conecta la wallet
        if (supabase && !isPaymentLink) {
          const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
          // Cargar botones activos
          await loadHistoryFromSupabase(1, actualPageSize, false)
          // Cargar botones archivados
          await loadHistoryFromSupabase(1, actualPageSize, true)
        }

        // Escuchar cambios de red
        window.ethereum.on('chainChanged', async () => {
          const newProvider = new ethers.BrowserProvider(window.ethereum)
          await updateNetworkInfo(newProvider)
          await loadTokenInfo(newProvider, selectedTokenAddress)
          setProvider(newProvider)
        })

        // Escuchar cambios de cuenta (solo si ya está conectado)
        window.ethereum.on('accountsChanged', async (accounts) => {
          if (accounts.length === 0) {
            // Usuario desconectó desde MetaMask
            disconnectWallet()
          } else {
            // Usuario cambió de cuenta en MetaMask
            const newProvider = new ethers.BrowserProvider(window.ethereum)
            const signer = await newProvider.getSigner()
            const address = await signer.getAddress()
            await updateNetworkInfo(newProvider)
            await loadTokenInfo(newProvider, selectedTokenAddress)
            setProvider(newProvider)
            setAccount(address)

            // Cargar historial de botones activos e inactivos cuando cambia la cuenta
            if (supabase && !isPaymentLink) {
              const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
              // Cargar botones activos
              await loadHistoryFromSupabase(1, actualPageSize, false)
              // Cargar botones archivados
              await loadHistoryFromSupabase(1, actualPageSize, true)
            }
          }
        })
      } catch (error) {
        console.error('Error conectando wallet:', error)
        if (error.code !== 4001) { // No mostrar error si el usuario cancela
          alert(language === 'es' ? 'Error al conectar la wallet. Por favor, asegúrate de tener MetaMask instalado.' : 'Error connecting wallet. Please make sure you have MetaMask installed.')
        }
      } finally {
        setIsConnecting(false)
      }
    } else {
      alert(language === 'es' ? 'Por favor, instala MetaMask para usar esta aplicación.' : 'Please install MetaMask to use this application.')
    }
  }

  // Desconectar wallet - olvidar completamente
  const disconnectWallet = async () => {
    setAccount(null)
    setProvider(null)
    setCurrentNetwork(null)
    setTokenSymbol('')
    setTokenName('')

    // Limpiar todos los botones del historial
    setButtons([])
    setArchivedButtons([])
    setTotalActiveButtons(0)
    setTotalArchivedButtons(0)
    setRemoveStatus({ id: null, status: null })
    setCurrentPage(1)
    setHistoryTab('active')
    setIsLoadingHistory(false)

    // Remover listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners('chainChanged')
      window.ethereum.removeAllListeners('accountsChanged')
      
      // Revocar permisos para forzar confirmación en próxima conexión
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        })
      } catch (error) {
        // Si falla la revocación, no es crítico, solo loguear
        console.log('No se pudieron revocar permisos (puede que no haya permisos activos):', error)
      }
    }

    // Limpiar cualquier dato guardado relacionado con la wallet
    // No guardamos nada en localStorage, pero si hubiera algo, se limpiaría aquí
  }

  // Cambiar de wallet en MetaMask
  const switchWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert(language === 'es' ? 'MetaMask no está instalado.' : 'MetaMask is not installed.')
      return
    }

    try {
      setIsConnecting(true)

      // Solicitar permisos nuevamente para permitir cambiar de cuenta
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      })

      // Después de cambiar, reconectar con la nueva cuenta
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send("eth_requestAccounts", [])
      const signer = await provider.getSigner()
      const address = await signer.getAddress()

      // Actualizar información
      await updateNetworkInfo(provider)
      await loadTokenInfo(provider, selectedTokenAddress)

      setProvider(provider)
      setAccount(address)
    } catch (error) {
      console.error('Error cambiando de wallet:', error)
      if (error.code !== 4001) { // No mostrar error si el usuario cancela
        alert(language === 'es' ? 'Error al cambiar de wallet.' : 'Error switching wallet.')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  // Generar link de pago corto usando Supabase
  const generatePaymentLink = async (buttonData) => {
    // Si Supabase no está configurado, usar método antiguo con localStorage
    // Nota: Si hay imagen, solo se incluye si es Base64 (URLs de Storage son muy largas para parámetros)
    if (!supabase) {
      const params = new URLSearchParams({
        recipient: buttonData.recipientAddress,
        amount: buttonData.amount,
        concept: buttonData.concept || '', // Mantener para compatibilidad
        itemName: buttonData.itemName || '',
        itemDescription: buttonData.itemDescription || '',
        // Solo incluir imágenes si son Base64 (data:image), no URLs de Storage
        itemImage: (buttonData.itemImage && buttonData.itemImage.startsWith('data:image')) 
          ? buttonData.itemImage 
          : '',
        itemImage2: (buttonData.itemImage2 && buttonData.itemImage2.startsWith('data:image')) 
          ? buttonData.itemImage2 
          : '',
        itemImage3: (buttonData.itemImage3 && buttonData.itemImage3.startsWith('data:image')) 
          ? buttonData.itemImage3 
          : '',
        text: buttonData.buttonText,
        color: buttonData.buttonColor.replace('#', ''),
        token: selectedTokenAddress
      })
      return `${window.location.origin}${window.location.pathname}?payment&${params.toString()}`
    }

    try {
      // Generar ID único de 6 caracteres
      let shortId = generateShortId()
      let attempts = 0
      const maxAttempts = 10

      // Verificar que el ID no exista (intentar hasta 10 veces)
      while (attempts < maxAttempts) {
        const { data: existing, error: checkError } = await supabase
          .from('payment_buttons')
          .select('id')
          .eq('id', shortId)
          .maybeSingle()

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 es "no rows returned", que es lo que queremos
          console.warn('Error verificando ID único:', checkError)
        }

        if (!existing) {
          break // ID único encontrado
        }
        shortId = generateShortId()
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('No se pudo generar un ID único después de varios intentos')
      }

      // Preparar datos para Supabase
      // Asegurar que las direcciones estén en minúsculas para consistencia
      const recipientLower = buttonData.recipientAddress.toLowerCase()

      // owner_address siempre es recipient_address (el receptor es el dueño del botón)
      // Si no hay wallet conectada, automáticamente usar recipient_address como owner
      const ownerAddress = recipientLower // Siempre usar recipient como owner

      const insertData = {
        id: shortId,
        recipient_address: recipientLower,
        owner_address: ownerAddress || recipientLower, // Fallback: siempre usar recipient si owner está vacío
        amount: String(buttonData.amount), // Asegurar que sea string
        concept: buttonData.concept || '', // Mantener para compatibilidad
        item_name: buttonData.itemName || '',
        item_description: buttonData.itemDescription || '',
        item_image: buttonData.itemImage || null, // Base64 o URL
        item_image2: buttonData.itemImage2 || null, // Segunda imagen
        item_image3: buttonData.itemImage3 || null, // Tercera imagen
        button_text: buttonData.buttonText || '',
        button_color: buttonData.buttonColor.replace('#', ''),
        token_address: selectedTokenAddress.toLowerCase()
      }

      console.log('Inserting button with data:', {
        item_name: insertData.item_name,
        item_description: insertData.item_description?.substring(0, 50) + '...',
        item_image: insertData.item_image ? 'URL present' : 'null',
        item_image2: insertData.item_image2 ? 'URL present' : 'null',
        item_image3: insertData.item_image3 ? 'URL present' : 'null'
      })

      // Incluir payment_type solo si está disponible en buttonData
      // Si la columna no existe en la BD, intentar insertar sin ella
      if (buttonData.paymentType) {
        insertData.payment_type = buttonData.paymentType
      } else {
        // Intentar agregar con valor por defecto, pero si falla, continuar sin él
        try {
          insertData.payment_type = 'fixed'
        } catch (e) {
          // Si hay error, no incluir payment_type
        }
      }

      // Guardar en Supabase (owner_address = recipient_address)
      const { data: insertedData, error } = await supabase
        .from('payment_buttons')
        .insert(insertData)
        .select()

      if (error) {
        console.error('Error guardando en Supabase:', error)
        console.error('Código de error:', error.code)
        console.error('Mensaje de error:', error.message)
        console.error('Detalles del error:', error.details)
        console.error('Hint del error:', error.hint)
        console.error('Datos que se intentaron guardar:', insertData)

        // Si el error es por payment_type o campos de item, intentar sin ellos
        if (error.message && (error.message.includes('payment_type') || 
            error.message.includes('item_name') || 
            error.message.includes('item_description') || 
            error.message.includes('item_image'))) {
          console.warn('Algunas columnas no existen. Intentando sin ellas...')
          delete insertData.payment_type
          delete insertData.item_name
          delete insertData.item_description
          delete insertData.item_image
          delete insertData.item_image2
          delete insertData.item_image3

          const { data: retryData, error: retryError } = await supabase
            .from('payment_buttons')
            .insert(insertData)
            .select()

          if (retryError) {
            console.error('Error en segundo intento:', retryError)
            // Continuar con el flujo de error original
          } else {
            // Éxito en el segundo intento
            console.log('Botón guardado exitosamente sin campos nuevos')
            const fullUrl = `${window.location.origin}/${retryData[0].id}`
            return fullUrl
          }
        }

        // Mostrar alerta al usuario (usar el language del componente)
        const currentLanguage = language || 'es'
        alert(currentLanguage === 'es'
          ? `Error al guardar en Supabase: ${error.message || 'Error desconocido'}. Se usará el método alternativo.`
          : `Error saving to Supabase: ${error.message || 'Unknown error'}. Using alternative method.`)

        // Fallback al método antiguo si falla Supabase
        const params = new URLSearchParams({
          recipient: buttonData.recipientAddress,
          amount: buttonData.amount,
          concept: buttonData.concept || '',
          itemName: buttonData.itemName || '',
          itemDescription: buttonData.itemDescription || '',
          // Solo incluir imágenes si son Base64 (data:image), no URLs de Storage
          itemImage: (buttonData.itemImage && buttonData.itemImage.startsWith('data:image')) 
            ? buttonData.itemImage 
            : '',
          itemImage2: (buttonData.itemImage2 && buttonData.itemImage2.startsWith('data:image')) 
            ? buttonData.itemImage2 
            : '',
          itemImage3: (buttonData.itemImage3 && buttonData.itemImage3.startsWith('data:image')) 
            ? buttonData.itemImage3 
            : '',
          text: buttonData.buttonText,
          color: buttonData.buttonColor.replace('#', ''),
          token: selectedTokenAddress
        })
        return `${window.location.origin}${window.location.pathname}?payment&${params.toString()}`
      }

      // Verificar que se insertó correctamente
      if (!insertedData || insertedData.length === 0) {
        console.warn('No se recibió confirmación de inserción desde Supabase, pero no hubo error')
      }

      // Retornar link corto
      const basePath = window.location.pathname === '/' ? '' : window.location.pathname
      return `${window.location.origin}${basePath}/${shortId}`
    } catch (error) {
      console.error('Error generando link corto:', error)
      // Fallback al método antiguo
      const params = new URLSearchParams({
        recipient: buttonData.recipientAddress,
        amount: buttonData.amount,
        concept: buttonData.concept || '', // Mantener para compatibilidad
        itemName: buttonData.itemName || '',
        itemDescription: buttonData.itemDescription || '',
        // Solo incluir imágenes si son Base64 (data:image), no URLs de Storage
        itemImage: (buttonData.itemImage && buttonData.itemImage.startsWith('data:image')) 
          ? buttonData.itemImage 
          : '',
        itemImage2: (buttonData.itemImage2 && buttonData.itemImage2.startsWith('data:image')) 
          ? buttonData.itemImage2 
          : '',
        itemImage3: (buttonData.itemImage3 && buttonData.itemImage3.startsWith('data:image')) 
          ? buttonData.itemImage3 
          : '',
        text: buttonData.buttonText,
        color: buttonData.buttonColor.replace('#', ''),
        token: selectedTokenAddress
      })
      return `${window.location.origin}${window.location.pathname}?payment&${params.toString()}`
    }
  }

  // Cargar botón desde URL (soporta links cortos de Supabase y links largos antiguos)
  const loadButtonFromURL = async () => {
    const pathname = window.location.pathname
    const urlParams = new URLSearchParams(window.location.search)

    // Verificar si es un link corto (6 caracteres alfanuméricos al final del pathname)
    const pathSegments = pathname.split('/').filter(Boolean)
    const lastSegment = pathSegments[pathSegments.length - 1]
    const isShortLink = lastSegment && /^[A-Za-z0-9]{6}$/.test(lastSegment)

    if (isShortLink && supabase) {
      // Intentar cargar desde Supabase
      try {
        const { data, error } = await supabase
          .from('payment_buttons')
          .select('*')
          .eq('id', lastSegment)
          .single()

        if (!error && data) {
          // Establecer modo de link compartido
          setIsPaymentLink(true)

          const recipientAddress = data.recipient_address
          const amount = data.amount
          const concept = data.concept || '' // Compatibilidad
          const itemName = data.item_name || ''
          const itemDescription = data.item_description || ''
          const itemImage = data.item_image || ''
          const itemImage2 = data.item_image2 || ''
          const itemImage3 = data.item_image3 || ''
          const buttonText = data.button_text || (language === 'es' ? 'Pagar' : 'Pay')
          const buttonColor = `#${data.button_color || '6366f1'}`
          const tokenAddress = data.token_address || selectedTokenAddress

          if (recipientAddress && amount && ethers.isAddress(recipientAddress)) {
            // Cambiar al token del link si es diferente
            if (tokenAddress.toLowerCase() !== selectedTokenAddress.toLowerCase()) {
              setSelectedTokenAddress(tokenAddress)
            }

            const buttonId = Date.now()
            const buttonData = {
              id: buttonId,
              recipientAddress,
              amount,
              concept, // Compatibilidad
              itemName,
              itemDescription,
              itemImage,
              itemImage2,
              itemImage3,
              buttonText,
              buttonColor,
              tokenAddress,
              paymentType: data.payment_type || 'fixed',
              paymentLink: window.location.href
            }
            setButtons([buttonData])

            // Cargar información del token si hay provider
            if (provider) {
              loadTokenInfo(provider, tokenAddress)
            }
            return
          }
        }
      } catch (error) {
        console.error('Error cargando desde Supabase:', error)
        // Continuar con el método antiguo si falla
      }
    }

    // Método antiguo: cargar desde parámetros de URL
    if (urlParams.has('payment')) {
      const recipientAddress = urlParams.get('recipient')
      const amount = urlParams.get('amount')
      const concept = urlParams.get('concept') || '' // Compatibilidad
      const itemName = urlParams.get('itemName') || ''
      const itemDescription = urlParams.get('itemDescription') || ''
      const itemImage = urlParams.get('itemImage') || ''
      const itemImage2 = urlParams.get('itemImage2') || ''
      const itemImage3 = urlParams.get('itemImage3') || ''
      const buttonText = urlParams.get('text') || 'Pagar'
      const buttonColor = `#${urlParams.get('color') || '6366f1'}`
      const tokenAddress = urlParams.get('token') || selectedTokenAddress

      if (recipientAddress && amount && ethers.isAddress(recipientAddress)) {
        // Establecer modo de link compartido
        setIsPaymentLink(true)

        // Cambiar al token del link si es diferente
        if (tokenAddress.toLowerCase() !== selectedTokenAddress.toLowerCase()) {
          setSelectedTokenAddress(tokenAddress)
        }

        const buttonId = Date.now()
        const buttonData = {
          id: buttonId,
          recipientAddress,
          amount,
          concept, // Compatibilidad
          itemName,
          itemDescription,
          itemImage,
          itemImage2,
          itemImage3,
          buttonText,
          buttonColor,
          tokenAddress,
          paymentType: urlParams.get('paymentType') || 'fixed',
          paymentLink: window.location.href
        }
        setButtons([buttonData])

        // Cargar información del token si hay provider
        if (provider) {
          loadTokenInfo(provider, tokenAddress)
        }
      }
    }
  }

  // Cargar información del token cuando se conecta la wallet desde un link compartido
  useEffect(() => {
    if (isPaymentLink && provider && buttons.length > 0) {
      const tokenAddress = buttons[0].tokenAddress || selectedTokenAddress
      loadTokenInfo(provider, tokenAddress)
    }
  }, [provider, isPaymentLink])


  // Agregar un nuevo botón de pago
  const addPaymentButton = async (buttonData) => {
    const buttonId = Date.now()
    const fullButtonData = {
      ...buttonData,
      id: buttonId,
      tokenAddress: selectedTokenAddress, // Asegurar que se guarde el token seleccionado
      paymentLink: '' // Se generará asíncronamente
    }

    // Generar link de pago (puede ser asíncrono si usa Supabase)
    const paymentLink = await generatePaymentLink({ ...buttonData, tokenAddress: selectedTokenAddress })
    fullButtonData.paymentLink = paymentLink

    // Extraer shortId del link si es un link corto
    const linkMatch = paymentLink.match(/\/([A-Za-z0-9]{6})$/)
    if (linkMatch) {
      fullButtonData.shortId = linkMatch[1]
    }

    // Recargar historial desde Supabase si hay wallet conectada
    // Los botones siempre se guardan en Supabase, vinculados por recipient_address
    if (account && supabase) {
      const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
      await loadHistoryFromSupabase(currentPage, actualPageSize, historyTab === 'archived')
    }
    // Si no hay wallet, el botón ya está guardado en Supabase y aparecerá cuando se conecte
  }

  // Actualizar un botón de pago existente
  const updatePaymentButton = async (buttonData) => {
    if (!supabase || !buttonData.shortId) {
      alert(language === 'es' ? 'Error: No se puede actualizar el botón sin Supabase.' : 'Error: Cannot update button without Supabase.')
      return
    }

    try {
      const recipientLower = buttonData.recipientAddress.toLowerCase()
      
      const updateData = {
        amount: String(buttonData.amount),
        item_name: buttonData.itemName || '',
        item_description: buttonData.itemDescription || '',
        item_image: buttonData.itemImage || null,
        item_image2: buttonData.itemImage2 || null,
        item_image3: buttonData.itemImage3 || null,
        button_text: buttonData.buttonText || '',
        button_color: buttonData.buttonColor.replace('#', ''),
        payment_type: buttonData.paymentType || 'fixed'
      }

      console.log('Updating button with data:', {
        shortId: buttonData.shortId,
        item_name: updateData.item_name,
        item_description: updateData.item_description?.substring(0, 50) + '...',
        item_image: updateData.item_image ? 'URL present' : 'null',
        item_image2: updateData.item_image2 ? 'URL present' : 'null',
        item_image3: updateData.item_image3 ? 'URL present' : 'null'
      })

      // Actualizar en Supabase
      const { error } = await supabase
        .from('payment_buttons')
        .update(updateData)
        .eq('id', buttonData.shortId)
        .eq('owner_address', recipientLower) // Solo el dueño puede actualizar

      if (error) {
        console.error('Error actualizando botón:', error)
        alert(language === 'es' ? 'Error al actualizar el botón. Por favor, intenta de nuevo.' : 'Error updating button. Please try again.')
        return
      }

      // Recargar historial
      if (account && supabase) {
        const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
        await loadHistoryFromSupabase(currentPage, actualPageSize, historyTab === 'archived')
      }

      // Salir del modo edición y resetear formulario
      setEditingButton(null)
      
      // Notificar al componente PaymentButtonGenerator para que resetee el formulario
      // Esto se hace a través de cambiar editingButton a null, que ya está hecho arriba
    } catch (error) {
      console.error('Error actualizando botón:', error)
      alert(language === 'es' ? 'Error al actualizar el botón. Por favor, intenta de nuevo.' : 'Error updating button. Please try again.')
    }
  }

  // Cancelar edición
  const cancelEdit = () => {
    setEditingButton(null)
  }

  // Función para extraer el path del archivo desde una URL de Supabase Storage
  const extractFilePathFromUrl = (url) => {
    if (!url || !url.includes('storage/v1/object/public/payment-item-images/')) {
      return null
    }
    // Extraer el path después de 'payment-item-images/'
    // La URL tiene formato: https://xxx.supabase.co/storage/v1/object/public/payment-item-images/payment-items/filename.jpg
    const match = url.match(/payment-item-images\/(.+)$/)
    return match ? match[1] : null
  }

  // Eliminar botón permanentemente (con confirmación y eliminación de imágenes)
  const deleteButton = async (id, shortId = null, buttonData = null) => {
    // Pedir confirmación
    const confirmMessage = language === 'es' 
      ? '¿Estás seguro de que deseas eliminar este botón permanentemente? Esta acción no se puede deshacer y también eliminará las imágenes asociadas.'
      : 'Are you sure you want to permanently delete this button? This action cannot be undone and will also delete associated images.'
    
    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      setRemoveStatus({ id, status: 'deleting' })

      if (shortId && supabase && account) {
        const ownerAddress = account.toLowerCase()

        // Si tenemos los datos del botón, eliminar las imágenes del bucket
        if (buttonData) {
          const imagesToDelete = [
            buttonData.itemImage,
            buttonData.itemImage2,
            buttonData.itemImage3
          ].filter(img => img && img.includes('storage/v1/object/public/payment-item-images/'))

          // Eliminar cada imagen del bucket
          for (const imageUrl of imagesToDelete) {
            const filePath = extractFilePathFromUrl(imageUrl)
            if (filePath) {
              try {
                // El filePath ya incluye 'payment-items/filename.jpg'
                const { error: deleteError } = await supabase.storage
                  .from('payment-item-images')
                  .remove([filePath])
                
                if (deleteError) {
                  console.warn('Error eliminando imagen del bucket:', deleteError)
                  // Continuar aunque falle la eliminación de una imagen
                } else {
                  console.log('Imagen eliminada del bucket:', filePath)
                }
              } catch (imgError) {
                console.warn('Error procesando eliminación de imagen:', imgError)
                // Continuar aunque falle
              }
            }
          }
        }

        // Eliminar el botón de la base de datos (hard delete)
        const { error } = await supabase
          .from('payment_buttons')
          .delete()
          .eq('id', shortId)
          .eq('owner_address', ownerAddress)

        if (error) {
          console.error('Error eliminando botón:', error)
          alert(language === 'es' ? 'Error al eliminar el botón. Por favor, intenta de nuevo.' : 'Error deleting button. Please try again.')
          setRemoveStatus({ id, status: 'fail' })
          setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
          return
        }

        // Recargar historial
        const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
        await loadHistoryFromSupabase(currentPage, actualPageSize, historyTab === 'archived')

        setRemoveStatus({ id, status: 'success' })
        setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
      } else {
        // Fallback: eliminar del estado local si no hay Supabase
        const newButtons = buttons.filter(btn => btn.id !== id)
        setButtons(newButtons)
        setRemoveStatus({ id, status: 'success' })
        setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
      }
    } catch (error) {
      console.error('Error en deleteButton:', error)
      alert(language === 'es' ? 'Error al eliminar el botón. Por favor, intenta de nuevo.' : 'Error deleting button. Please try again.')
      setRemoveStatus({ id, status: 'fail' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    }
  }

  // Cargar botón desde URL al montar el componente
  useEffect(() => {
    loadButtonFromURL()
  }, [])

  // Archivar un botón (soft delete en Supabase)
  const archiveButton = async (id, shortId = null) => {
    try {
      // Si tiene shortId, marcar como archivado en Supabase
      if (shortId && supabase && account) {
        const ownerAddress = account.toLowerCase()
        console.log('Archivando botón:', { shortId, ownerAddress })

        const { data: updateData, error } = await supabase
          .from('payment_buttons')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', shortId)
          .ilike('owner_address', ownerAddress) // Case-insensitive
          .select()

        console.log('Resultado de archivar:', { updateData, error })

        if (error) {
          console.error('Error archivando en Supabase:', error)
          console.error('Código de error:', error.code)
          console.error('Mensaje de error:', error.message)
          console.error('Detalles:', error.details)
          setRemoveStatus({ id, status: 'fail' })
          setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
          return
        } else {
          console.log('Botón archivado exitosamente')
          // Recargar historial después de archivar
          const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
          await loadHistoryFromSupabase(currentPage, actualPageSize, historyTab === 'archived')
        }
      }

      // Eliminar de estado local
      const newButtons = buttons.filter(btn => btn.id !== id)
      setButtons(newButtons)
      setRemoveStatus({ id, status: 'success' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    } catch (error) {
      console.error('Error en archiveButton:', error)
      setRemoveStatus({ id, status: 'fail' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    }
  }

  // Desarchivar un botón (restaurar desde soft delete en Supabase)
  const unarchiveButton = async (id, shortId = null) => {
    try {
      // Si tiene shortId, restaurar desde archivado en Supabase
      if (shortId && supabase && account) {
        const ownerAddress = account.toLowerCase()
        console.log('Desarchivando botón:', { shortId, ownerAddress })

        const { data: updateData, error } = await supabase
          .from('payment_buttons')
          .update({ deleted_at: null })
          .eq('id', shortId)
          .ilike('owner_address', ownerAddress) // Case-insensitive
          .select()

        console.log('Resultado de desarchivar:', { updateData, error })

        if (error) {
          console.error('Error desarchivando en Supabase:', error)
          console.error('Código de error:', error.code)
          console.error('Mensaje de error:', error.message)
          console.error('Detalles:', error.details)
          setRemoveStatus({ id, status: 'fail' })
          setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
          return
        } else {
          console.log('Botón desarchivado exitosamente')
          // Recargar historial después de desarchivar (tanto activos como archivados)
          const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
          await loadHistoryFromSupabase(currentPage, actualPageSize, false) // Cargar activos
          await loadHistoryFromSupabase(currentPage, actualPageSize, true) // Cargar archivados
        }
      }

      // Eliminar de estado local de archivados
      const newArchivedButtons = archivedButtons.filter(btn => btn.id !== id)
      setArchivedButtons(newArchivedButtons)
      setRemoveStatus({ id, status: 'success' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    } catch (error) {
      console.error('Error en unarchiveButton:', error)
      setRemoveStatus({ id, status: 'fail' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    }
  }

  // Cargar historial desde Supabase por owner
  const loadHistoryFromSupabase = async (page = 1, size = pageSize, showArchived = false) => {
    if (!supabase || !account) {
      console.log('loadHistoryFromSupabase: No supabase o account', { supabase: !!supabase, account })
      return
    }

    try {
      setIsLoadingHistory(true)
      const ownerAddress = account.toLowerCase()
      const actualSize = typeof size === 'number' ? size : 9
      const from = (page - 1) * actualSize
      const to = from + actualSize - 1

      console.log('Cargando historial desde Supabase:', {
        ownerAddress,
        page,
        size: actualSize,
        showArchived,
        from,
        to
      })

      // Usar ilike para búsqueda case-insensitive (por si hay registros antiguos sin normalizar)
      let query = supabase
        .from('payment_buttons')
        .select('*', { count: 'exact' })
        .ilike('owner_address', ownerAddress) // Case-insensitive
        .order('created_at', { ascending: false })

      if (showArchived) {
        query = query.not('deleted_at', 'is', null)
      } else {
        query = query.is('deleted_at', null)
      }

      const { data, error, count } = await query.range(from, to)

      console.log('Resultado de query Supabase:', {
        dataLength: data?.length || 0,
        count,
        error: error ? {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        } : null,
        ownerAddress
      })

      if (error) {
        console.error('Error cargando historial:', error)
        console.error('Código de error:', error.code)
        console.error('Mensaje de error:', error.message)
        console.error('Detalles:', error.details)
        return
      }

      // Convertir datos de Supabase al formato de botones
      const formattedButtons = (data || []).map(item => ({
        id: Date.now() + Math.random(), // ID temporal para React
        shortId: item.id,
        recipientAddress: item.recipient_address,
        amount: item.amount,
        concept: item.concept || '', // Compatibilidad
        itemName: item.item_name || '',
        itemDescription: item.item_description || '',
        itemImage: item.item_image || '',
        itemImage2: item.item_image2 || '',
        itemImage3: item.item_image3 || '',
        buttonText: item.button_text || (language === 'es' ? 'Pagar' : 'Pay'),
        buttonColor: `#${item.button_color || '6366f1'}`,
        tokenAddress: item.token_address,
        paymentLink: `${window.location.origin}/${item.id}`,
        paymentType: item.payment_type || 'fixed', // 'fixed' o 'editable'
        createdAt: item.created_at,
        deletedAt: item.deleted_at
      }))

      if (showArchived) {
        setArchivedButtons(formattedButtons)
        setTotalArchivedButtons(count || 0)
      } else {
        setButtons(formattedButtons)
        setTotalActiveButtons(count || 0)
      }
    } catch (error) {
      console.error('Error cargando historial:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Cargar historial cuando se conecta una wallet
  useEffect(() => {
    if (account && supabase && !isPaymentLink) {
      const actualPageSize = typeof pageSize === 'number' ? pageSize : 3
      console.log('useEffect: Cargando historial porque account cambió', { account, supabase: !!supabase, isPaymentLink })
      loadHistoryFromSupabase(currentPage, actualPageSize, historyTab === 'archived')
    }
    // Si no hay wallet, no cargar nada (los botones aparecerán cuando se conecte)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, currentPage, pageSize, historyTab, isPaymentLink])

  // Nota: Los botones se guardan explícitamente en addPaymentButton y removeButton
  // No necesitamos un useEffect que guarde automáticamente para evitar loops

  // Vista simplificada para links compartidos
  if (isPaymentLink && buttons.length > 0) {
    const paymentButton = buttons[0]
    return (
      <div className="app payment-link-view">
        <button
          onClick={toggleLanguage}
          className="btn-language-fixed"
          title={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        >
          {language === 'es' ? 'EN' : 'ES'}
        </button>

        <div className="payment-card">
          <div className="payment-card-header">
            <h2>DEFIPAGO</h2>
          </div>

          <PaymentButton
            {...paymentButton}
            tokenAddress={paymentButton.tokenAddress || selectedTokenAddress}
            provider={provider}
            account={account}
            ERC20_ABI={ERC20_ABI}
            tokenSymbol={tokenSymbol}
            currentNetwork={currentNetwork}
            onSwitchNetwork={switchToPolygon}
            onConnectWallet={connectWallet}
            isCompact={true}
            language={language}
            paymentType={paymentButton.paymentType || 'fixed'}
          />
        </div>

        <footer className="footer">
          <p className="footer-credits">
            <a
              href={window.location.origin}
              className="credits-link"
            >
              {language === 'es' ? 'Crea tu Propio Botón de Pago' : 'Create Your Own Payment Button'}
            </a>
          </p>
          <p className="footer-credits">
            {language === 'es' ? 'Hecho con ❤️ por ' : 'Made with ❤️ by '}
            <a
              href="https://polygonscan.com/name-lookup-search?id=jfscaramazza.eth"
              target="_blank"
              rel="noopener noreferrer"
              className="credits-link"
            >
              jfscaramazza.eth
            </a>
            {' | '}
            {language === 'es' ? 'Ayúdanos a mantener la plataforma con tu aporte' : 'Help us maintain the platform with your contribution'}
            {' '}
            <a
              href="http://defipago.netlify.app/bf5wU1"
              target="_blank"
              rel="noopener noreferrer"
              className="credits-link"
            >
              {language === 'es' ? 'aquí' : 'here'}
            </a>
          </p>
        </footer>
      </div>
    )
  }

  // Vista completa (generador de botones)
  return (
    <div className="app">
      <button
        onClick={toggleLanguage}
        className="btn-language-fixed"
        title={language === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      >
        {language === 'es' ? 'EN' : 'ES'}
      </button>

      <header className="header">
        <h1>DEFIPAGO</h1>
        <p className="subtitle">{language === 'es' ? 'Generador de Botones de Pago DeFi' : 'DeFi Payment Button Generator'}</p>

        <p className="credits-text">
          {language === 'es' ? 'Hecho con ❤️ por ' : 'Made with ❤️ by '}
          <a
            href="https://polygonscan.com/name-lookup-search?id=jfscaramazza.eth"
            target="_blank"
            rel="noopener noreferrer"
            className="credits-link"
          >
            jfscaramazza.eth
          </a>
          {' | '}
          {language === 'es' ? 'Ayúdanos a mantener la plataforma con tu aporte' : 'Help us maintain the platform with your contribution'}
          {' '}
          <a
            href="http://defipago.netlify.app/bf5wU1"
            target="_blank"
            rel="noopener noreferrer"
            className="credits-link"
          >
            {language === 'es' ? 'aquí' : 'here'}
          </a>
        </p>

        <div className="header-lines-wrapper">
          <div className="header-info-line">
            <div className="token-selector-inline">
              <label htmlFor="token-select" className="token-select-label-inline">
                {language === 'es' ? 'Token:' : 'Token:'}
              </label>
              <select
                id="token-select"
                value={selectedTokenAddress}
                onChange={(e) => handleTokenChange(e.target.value)}
                className="token-select token-select-inline"
                disabled={isLoadingToken}
              >
                {AVAILABLE_TOKENS.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.name} ({token.symbol})
                  </option>
                ))}
              </select>
              {tokenSymbol && (
                <a
                  href={`https://polygonscan.com/token/${selectedTokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="token-badge token-link token-badge-inline"
                  title={language === 'es' ? `Ver ${tokenName} ($${tokenSymbol}) en Polygonscan` : `View ${tokenName} ($${tokenSymbol}) on Polygonscan`}
                >
                  {language === 'es' ? `Ver ${tokenName} ($${tokenSymbol}) en Polygonscan` : `View ${tokenName} ($${tokenSymbol}) on Polygonscan`}
                </a>
              )}
            </div>
          </div>

          <div className="header-wallet-line">
            {account ? (
              <>
                {currentNetwork && (
                  <span className={`network-badge network-badge-inline ${currentNetwork.isPolygon ? 'polygon' : 'other'}`}>
                    {currentNetwork.name}
                  </span>
                )}
                <span className="wallet-address wallet-address-inline">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                {currentNetwork && !currentNetwork.isPolygon && (
                  <button
                    onClick={switchToPolygon}
                    className="btn btn-switch-network btn-inline"
                    title={language === 'es' ? 'Cambiar a Polygon Mainnet' : 'Switch to Polygon Mainnet'}
                  >
                    {language === 'es' ? 'Cambiar a Polygon' : 'Switch to Polygon'}
                  </button>
                )}
                <button
                  onClick={switchWallet}
                  className="btn btn-secondary btn-inline"
                  title={language === 'es' ? 'Cambiar de wallet en MetaMask' : 'Switch wallet in MetaMask'}
                  disabled={isConnecting}
                >
                  {language === 'es' ? 'Cambiar Wallet' : 'Switch Wallet'}
                </button>
                <button
                  onClick={disconnectWallet}
                  className="btn btn-secondary btn-inline"
                  title={language === 'es' ? 'Desconectar y olvidar wallet' : 'Disconnect and forget wallet'}
                >
                  {language === 'es' ? 'Desconectar' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button
                onClick={connectWallet}
                className="btn btn-primary btn-inline"
                disabled={isConnecting}
              >
                {isConnecting
                  ? (language === 'es' ? 'Conectando...' : 'Connecting...')
                  : (language === 'es' ? 'Conectar Wallet' : 'Connect Wallet')
                }
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <PaymentButtonGenerator
          onGenerate={addPaymentButton}
          onUpdate={updatePaymentButton}
          onCancel={cancelEdit}
          editingButton={editingButton}
          tokenAddress={selectedTokenAddress}
          provider={provider}
          account={account}
          tokenSymbol={tokenSymbol}
          language={language}
        />

        {(buttons.length > 0 || archivedButtons.length > 0 || account) && (
          <section className="buttons-section">
            <div className="buttons-section-header">
              <h2>
                {account && supabase
                  ? (language === 'es' ? 'Historial de Botones' : 'Button History')
                  : (language === 'es' ? 'Botones Generados' : 'Generated Buttons')
                }
              </h2>
              {account && supabase && (
                <div className="history-tabs">
                  <button
                    onClick={() => {
                      setHistoryTab('active')
                      setCurrentPage(1)
                    }}
                    className={`history-tab ${historyTab === 'active' ? 'active' : ''}`}
                  >
                    {language === 'es' ? 'Activos' : 'Active'} ({totalActiveButtons})
                  </button>
                  <button
                    onClick={() => {
                      setHistoryTab('archived')
                      setCurrentPage(1)
                    }}
                    className={`history-tab ${historyTab === 'archived' ? 'active' : ''}`}
                  >
                    {language === 'es' ? 'Archivados' : 'Archived'} ({totalArchivedButtons})
                  </button>
                </div>
              )}
            </div>

            {/* Selector de tamaño de página */}
            {account && supabase && (historyTab === 'active' ? buttons.length > 0 : archivedButtons.length > 0) && (
              <div className="pagination-controls-top">
                <label htmlFor="page-size-select" className="page-size-label">
                  {language === 'es' ? 'Por página:' : 'Per page:'}
                </label>
                <select
                  id="page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'custom') {
                      setPageSize('custom')
                    } else {
                      const newSize = parseInt(val)
                      if (newSize > 0) {
                        setPageSize(newSize)
                        setCurrentPage(1)
                      }
                    }
                  }}
                  className="page-size-select"
                >
                  <option value={3}>3</option>
                  <option value={6}>6</option>
                  <option value={9}>9</option>
                  <option value={18}>18</option>
                  <option value={36}>36</option>
                  <option value="custom">{language === 'es' ? 'Personalizado' : 'Custom'}</option>
                </select>
                {pageSize === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    value={customPageSize}
                    onChange={(e) => {
                      const val = e.target.value
                      setCustomPageSize(val)
                      if (val && parseInt(val) > 0) {
                        setPageSize(parseInt(val))
                        setCurrentPage(1)
                      }
                    }}
                    placeholder={language === 'es' ? 'Cantidad' : 'Amount'}
                    className="custom-page-size-input"
                  />
                )}
              </div>
            )}

            {isLoadingHistory ? (
              <div className="loading-message">
                {language === 'es' ? 'Cargando historial...' : 'Loading history...'}
              </div>
            ) : (
              <>
                <div className="buttons-grid">
                  {(historyTab === 'active' ? buttons : archivedButtons).map(button => (
                    <div key={button.id} className="button-card">
                      <PaymentButton
                        {...button}
                        tokenAddress={button.tokenAddress || selectedTokenAddress}
                        provider={provider}
                        account={account}
                        ERC20_ABI={ERC20_ABI}
                        tokenSymbol={tokenSymbol}
                        currentNetwork={currentNetwork}
                        onSwitchNetwork={switchToPolygon}
                        onConnectWallet={connectWallet}
                        language={language}
                        paymentType={button.paymentType}
                      />
                      {historyTab === 'active' && (
                        <>
                          <button
                            onClick={() => setEditingButton(button)}
                            className="btn-edit"
                            title={language === 'es' ? 'Editar botón' : 'Edit button'}
                          >
                            {language === 'es' ? '✏️ Editar' : '✏️ Edit'}
                          </button>
                          <button
                            onClick={() => archiveButton(button.id, button.shortId)}
                            className={`btn-remove ${removeStatus.id === button.id && removeStatus.status === 'success' ? 'btn-remove-success' : ''} ${removeStatus.id === button.id && removeStatus.status === 'fail' ? 'btn-remove-fail' : ''}`}
                          >
                            {removeStatus.id === button.id && removeStatus.status === 'success'
                              ? (language === 'es' ? '✓ Archivado' : '✓ Archived')
                              : removeStatus.id === button.id && removeStatus.status === 'fail'
                                ? (language === 'es' ? '✗ Error' : '✗ Error')
                                : (language === 'es' ? 'Archivar' : 'Archive')
                            }
                          </button>
                          <button
                            onClick={() => deleteButton(button.id, button.shortId, button)}
                            className={`btn-delete ${removeStatus.id === button.id && removeStatus.status === 'deleting' ? 'btn-deleting' : ''} ${removeStatus.id === button.id && removeStatus.status === 'success' ? 'btn-delete-success' : ''} ${removeStatus.id === button.id && removeStatus.status === 'fail' ? 'btn-delete-fail' : ''}`}
                            title={language === 'es' ? 'Eliminar botón permanentemente' : 'Permanently delete button'}
                          >
                            {removeStatus.id === button.id && removeStatus.status === 'deleting'
                              ? (language === 'es' ? '🗑️ Eliminando...' : '🗑️ Deleting...')
                              : removeStatus.id === button.id && removeStatus.status === 'success'
                                ? (language === 'es' ? '✓ Eliminado' : '✓ Deleted')
                                : removeStatus.id === button.id && removeStatus.status === 'fail'
                                  ? (language === 'es' ? '✗ Error' : '✗ Error')
                                  : (language === 'es' ? '🗑️ Eliminar' : '🗑️ Delete')
                            }
                          </button>
                        </>
                      )}
                      {historyTab === 'archived' && (
                        <button
                          onClick={() => unarchiveButton(button.id, button.shortId)}
                          className={`btn-remove btn-unarchive ${removeStatus.id === button.id && removeStatus.status === 'success' ? 'btn-remove-success' : ''} ${removeStatus.id === button.id && removeStatus.status === 'fail' ? 'btn-remove-fail' : ''}`}
                        >
                          {removeStatus.id === button.id && removeStatus.status === 'success'
                            ? (language === 'es' ? '✓ Desarchivado' : '✓ Unarchived')
                            : removeStatus.id === button.id && removeStatus.status === 'fail'
                              ? (language === 'es' ? '✗ Error' : '✗ Error')
                              : (language === 'es' ? 'Desarchivar' : 'Unarchive')
                          }
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Paginación */}
                {account && supabase && (
                  <div className="pagination-controls">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || isLoadingHistory}
                      className="btn-pagination"
                    >
                      {language === 'es' ? '← Anterior' : '← Previous'}
                    </button>
                    <span className="pagination-info">
                      {language === 'es' ? 'Página' : 'Page'} {currentPage} {language === 'es' ? 'de' : 'of'} {Math.ceil((historyTab === 'active' ? totalActiveButtons : totalArchivedButtons) / (typeof pageSize === 'number' ? pageSize : 3)) || 1}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage >= Math.ceil((historyTab === 'active' ? totalActiveButtons : totalArchivedButtons) / (typeof pageSize === 'number' ? pageSize : 3)) || isLoadingHistory}
                      className="btn-pagination"
                    >
                      {language === 'es' ? 'Siguiente →' : 'Next →'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p className="footer-credits">
          {language === 'es' ? 'Hecho con ❤️ por ' : 'Made with ❤️ by '}
          <a
            href="https://polygonscan.com/name-lookup-search?id=jfscaramazza.eth"
            target="_blank"
            rel="noopener noreferrer"
            className="credits-link"
          >
            jfscaramazza.eth
          </a>
          {' | '}
          {language === 'es' ? 'Ayúdanos a mantener la plataforma con tu aporte' : 'Help us maintain the platform with your contribution'}
          {' '}
          <a
            href="http://defipago.netlify.app/bf5wU1"
            target="_blank"
            rel="noopener noreferrer"
            className="credits-link"
          >
            {language === 'es' ? 'aquí' : 'here'}
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App

