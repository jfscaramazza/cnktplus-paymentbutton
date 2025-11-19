import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import PaymentButtonGenerator from './components/PaymentButtonGenerator'
import PaymentButton from './components/PaymentButton'
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

  // Conectar wallet
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setIsConnecting(true)
        const provider = new ethers.BrowserProvider(window.ethereum)
        
        // Solicitar acceso a la cuenta
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

        // Escuchar cambios de cuenta
        window.ethereum.on('accountsChanged', async (accounts) => {
          if (accounts.length === 0) {
            setAccount(null)
            setProvider(null)
          } else {
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
        alert('Error al conectar la wallet. Por favor, asegúrate de tener MetaMask instalado.')
      } finally {
        setIsConnecting(false)
      }
    } else {
      alert('Por favor, instala MetaMask para usar esta aplicación.')
    }
  }

  // Desconectar wallet
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
  }

  // Generar link de pago con datos codificados
  const generatePaymentLink = (buttonData) => {
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

  // Cargar botón desde URL
  const loadButtonFromURL = () => {
    const urlParams = new URLSearchParams(window.location.search)
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

  // Agregar un nuevo botón de pago
  const addPaymentButton = (buttonData) => {
    const buttonId = Date.now()
    const fullButtonData = {
      ...buttonData,
      id: buttonId,
      tokenAddress: selectedTokenAddress, // Asegurar que se guarde el token seleccionado
      paymentLink: generatePaymentLink({ ...buttonData, tokenAddress: selectedTokenAddress })
    }
    setButtons([...buttons, fullButtonData])
  }

  // Cargar botón desde URL al montar el componente
  useEffect(() => {
    loadButtonFromURL()
  }, [])

  // Eliminar un botón
  const removeButton = (id) => {
    setButtons(buttons.filter(btn => btn.id !== id))
  }

  // Vista simplificada para links compartidos
  if (isPaymentLink && buttons.length > 0) {
    const paymentButton = buttons[0]
    return (
      <div className="app payment-link-view">
        <div className="payment-card">
          <div className="payment-card-header">
            <h2>CNKT+ Pay</h2>
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
          />
        </div>
      </div>
    )
  }

  // Vista completa (generador de botones)
  return (
    <div className="app">
      <header className="header">
        <h1>CNKT+ Pay</h1>
        <p className="subtitle">Generador de Botones de Pago DeFi</p>
        
        <div className="token-selector-section">
          <label htmlFor="token-select" className="token-select-label">
            Seleccionar Token:
          </label>
          <select
            id="token-select"
            value={selectedTokenAddress}
            onChange={(e) => handleTokenChange(e.target.value)}
            className="token-select"
            disabled={isLoadingToken}
          >
            {AVAILABLE_TOKENS.map((token) => (
              <option key={token.address} value={token.address}>
                {token.name} ({token.symbol})
              </option>
            ))}
          </select>
          {tokenSymbol && (
            <span className="token-badge">
              {tokenName} ({tokenSymbol})
            </span>
          )}
        </div>

        {account ? (
          <div className="wallet-info">
            <div className="wallet-details">
              <span className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              {currentNetwork && (
                <div className="network-info">
                  <span className={`network-badge ${currentNetwork.isPolygon ? 'polygon' : 'other'}`}>
                    {currentNetwork.name}
                  </span>
                  {!currentNetwork.isPolygon && (
                    <button 
                      onClick={switchToPolygon} 
                      className="btn btn-switch-network"
                      title="Cambiar a Polygon Mainnet"
                    >
                      Cambiar a Polygon
                    </button>
                  )}
                </div>
              )}
            </div>
            <button onClick={disconnectWallet} className="btn btn-secondary">
              Desconectar
            </button>
          </div>
        ) : (
          <button 
            onClick={connectWallet} 
            className="btn btn-primary"
            disabled={isConnecting}
          >
            {isConnecting ? 'Conectando...' : 'Conectar Wallet'}
          </button>
        )}
      </header>

      <main className="main-content">
        <PaymentButtonGenerator 
          onGenerate={addPaymentButton}
          tokenAddress={selectedTokenAddress}
          provider={provider}
          account={account}
          tokenSymbol={tokenSymbol}
        />

        {buttons.length > 0 && (
          <section className="buttons-section">
            <h2>Botones Generados</h2>
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
                  />
                  <button 
                    onClick={() => removeButton(button.id)}
                    className="btn-remove"
                  >
                    Eliminar
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

