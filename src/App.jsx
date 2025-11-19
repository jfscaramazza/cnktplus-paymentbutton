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
  const [clearStorageStatus, setClearStorageStatus] = useState(null)

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
  const disconnectWallet = () => {
    setAccount(null)
    setProvider(null)
    setCurrentNetwork(null)
    setTokenSymbol('')
    setTokenName('')

    // Remover listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners('chainChanged')
      window.ethereum.removeAllListeners('accountsChanged')
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
    if (!supabase) {
      const params = new URLSearchParams({
        recipient: buttonData.recipientAddress,
        amount: buttonData.amount,
        concept: buttonData.concept || '',
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
        const { data: existing } = await supabase
          .from('payment_buttons')
          .select('id')
          .eq('id', shortId)
          .single()

        if (!existing) {
          break // ID único encontrado
        }
        shortId = generateShortId()
        attempts++
      }

      if (attempts >= maxAttempts) {
        throw new Error('No se pudo generar un ID único después de varios intentos')
      }

      // Guardar en Supabase
      const { error } = await supabase
        .from('payment_buttons')
        .insert({
          id: shortId,
          recipient_address: buttonData.recipientAddress,
          amount: buttonData.amount,
          concept: buttonData.concept || '',
          button_text: buttonData.buttonText,
          button_color: buttonData.buttonColor.replace('#', ''),
          token_address: selectedTokenAddress
        })

      if (error) {
        console.error('Error guardando en Supabase:', error)
        // Fallback al método antiguo si falla Supabase
        const params = new URLSearchParams({
          recipient: buttonData.recipientAddress,
          amount: buttonData.amount,
          concept: buttonData.concept || '',
          text: buttonData.buttonText,
          color: buttonData.buttonColor.replace('#', ''),
          token: selectedTokenAddress
        })
        return `${window.location.origin}${window.location.pathname}?payment&${params.toString()}`
      }

      // Retornar link corto (asegurar que tenga / antes del ID)
      const basePath = window.location.pathname.endsWith('/')
        ? window.location.pathname
        : window.location.pathname + '/'
      return `${window.location.origin}${basePath}${shortId}`
    } catch (error) {
      console.error('Error generando link corto:', error)
      // Fallback al método antiguo
      const params = new URLSearchParams({
        recipient: buttonData.recipientAddress,
        amount: buttonData.amount,
        concept: buttonData.concept || '',
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
          const concept = data.concept || ''
          const buttonText = data.button_text || 'Pagar'
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
              concept,
              buttonText,
              buttonColor,
              tokenAddress,
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
      const concept = urlParams.get('concept') || ''
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
          concept,
          buttonText,
          buttonColor,
          tokenAddress,
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

  // Guardar botones en localStorage
  const saveButtonsToStorage = (buttonsToSave) => {
    try {
      localStorage.setItem('defipago-buttons', JSON.stringify(buttonsToSave))
    } catch (error) {
      console.error('Error guardando botones en localStorage:', error)
    }
  }

  // Cargar botones desde localStorage
  const loadButtonsFromStorage = () => {
    try {
      const savedButtons = localStorage.getItem('defipago-buttons')
      if (savedButtons) {
        const parsedButtons = JSON.parse(savedButtons)
        setButtons(parsedButtons)
      }
    } catch (error) {
      console.error('Error cargando botones desde localStorage:', error)
    }
  }

  // Borrar memoria
  const clearStorage = () => {
    try {
      if (window.confirm(language === 'es' ? '¿Estás seguro de que deseas borrar todos los botones guardados?' : 'Are you sure you want to clear all saved buttons?')) {
        localStorage.removeItem('defipago-buttons')
        setButtons([])
        setClearStorageStatus('success')
        setTimeout(() => setClearStorageStatus(null), 2000)
      }
    } catch (error) {
      setClearStorageStatus('fail')
      setTimeout(() => setClearStorageStatus(null), 2000)
    }
  }

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

    const newButtons = [...buttons, fullButtonData]
    setButtons(newButtons)
    saveButtonsToStorage(newButtons)
  }

  // Cargar botón desde URL al montar el componente
  useEffect(() => {
    loadButtonFromURL()
  }, [])

  // Eliminar un botón
  const removeButton = (id) => {
    try {
      const newButtons = buttons.filter(btn => btn.id !== id)
      setButtons(newButtons)
      saveButtonsToStorage(newButtons)
      setRemoveStatus({ id, status: 'success' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    } catch (error) {
      setRemoveStatus({ id, status: 'fail' })
      setTimeout(() => setRemoveStatus({ id: null, status: null }), 2000)
    }
  }

  // Cargar botones al iniciar (solo si no es un link compartido)
  useEffect(() => {
    if (!isPaymentLink) {
      loadButtonsFromStorage()
      isInitialLoad.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            {account ? (
              <div className="payment-card-wallet">
                <span className="wallet-address-small">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                {currentNetwork && !currentNetwork.isPolygon && (
                  <button
                    onClick={switchToPolygon}
                    className="btn btn-switch-network-small"
                  >
                    Cambiar a Polygon
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="btn btn-primary btn-small"
                disabled={isConnecting}
              >
                {isConnecting ? 'Conectando...' : 'Conectar Wallet'}
              </button>
            )}
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
            isCompact={true}
            language={language}
          />
        </div>
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
                title="Ver en Polygonscan"
              >
                {tokenName} ({tokenSymbol})
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
      </header>

      <main className="main-content">
        <PaymentButtonGenerator
          onGenerate={addPaymentButton}
          tokenAddress={selectedTokenAddress}
          provider={provider}
          account={account}
          tokenSymbol={tokenSymbol}
          language={language}
        />

        {buttons.length > 0 && (
          <section className="buttons-section">
            <div className="buttons-section-header">
              <h2>{language === 'es' ? 'Botones Generados' : 'Generated Buttons'}</h2>
              <button
                onClick={clearStorage}
                className={`btn btn-clear-storage ${clearStorageStatus === 'success' ? 'btn-clear-storage-success' : ''} ${clearStorageStatus === 'fail' ? 'btn-clear-storage-fail' : ''}`}
                title={language === 'es' ? 'Borrar todos los botones guardados' : 'Clear all saved buttons'}
              >
                {clearStorageStatus === 'success'
                  ? 'Success'
                  : clearStorageStatus === 'fail'
                    ? 'Fail'
                    : `🗑️ ${language === 'es' ? 'Borrar Memoria' : 'Clear Memory'}`
                }
              </button>
            </div>
            <div className="buttons-grid">
              {buttons.map(button => (
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
                    language={language}
                  />
                  <button
                    onClick={() => removeButton(button.id)}
                    className={`btn-remove ${removeStatus.id === button.id && removeStatus.status === 'success' ? 'btn-remove-success' : ''} ${removeStatus.id === button.id && removeStatus.status === 'fail' ? 'btn-remove-fail' : ''}`}
                  >
                    {removeStatus.id === button.id && removeStatus.status === 'success'
                      ? 'Success'
                      : removeStatus.id === button.id && removeStatus.status === 'fail'
                        ? 'Fail'
                        : (language === 'es' ? 'Eliminar' : 'Remove')
                    }
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Token Seleccionado: {selectedTokenAddress}</p>
        <p>Red Requerida: Polygon Mainnet</p>
        {tokenSymbol && <p>Símbolo: {tokenSymbol}</p>}
      </footer>
    </div>
  )
}

export default App

