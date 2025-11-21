import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { QRCodeSVG } from 'qrcode.react'
import confetti from 'canvas-confetti'

function PaymentButton({ 
  recipientAddress, 
  amount, 
  concept, // Mantener para compatibilidad con links antiguos
  itemName,
  itemDescription,
  itemImage,
  itemImage2,
  itemImage3,
  buttonText, 
  buttonColor, 
  tokenAddress,
  provider,
  account,
  ERC20_ABI,
  paymentLink,
  tokenSymbol,
  currentNetwork,
  onSwitchNetwork,
  onConnectWallet,
  isCompact = false,
  language = 'es',
  paymentType = 'fixed', // 'fixed' o 'editable'
  usageType = 'single_use', // 'single_use', 'unlimited', 'limited'
  maxUses = 1,
  currentUses = 0,
  shortId = null,
  onPaymentSuccess = null // Callback cuando el pago es exitoso
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [buttonTokenSymbol, setButtonTokenSymbol] = useState(tokenSymbol || '')
  const [balance, setBalance] = useState(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [editableAmount, setEditableAmount] = useState(amount)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [localCurrentUses, setLocalCurrentUses] = useState(currentUses) // Estado local para actualizar inmediatamente
  
  // Función para formatear wallet (resumida)
  const formatWallet = (address) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
  
  // Función para formatear balance con 6 decimales
  const formatBalance = (balance) => {
    if (!balance || balance === 'N/A') return balance
    const num = parseFloat(balance)
    if (isNaN(num)) return balance
    return num.toFixed(6)
  }
  
  // Función para formatear precio con separador de miles
  const formatPrice = (price) => {
    if (!price) return price
    const num = parseFloat(price)
    if (isNaN(num)) return price
    // Separar parte entera y decimal
    const parts = num.toString().split('.')
    const integerPart = parts[0]
    const decimalPart = parts[1] || ''
    // Agregar comas a la parte entera
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    // Combinar con decimales si existen
    return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }
  
  // Verificar si el usuario es el creador del botón (owner)
  const isOwner = account && recipientAddress && account.toLowerCase() === recipientAddress.toLowerCase()
  
  // Determinar si el monto puede ser editado
  const canEditAmount = paymentType === 'editable' || (paymentType === 'fixed' && isOwner)

  // Actualizar estado local cuando cambia currentUses desde props
  useEffect(() => {
    setLocalCurrentUses(currentUses)
  }, [currentUses])

  // Verificar si el botón puede ser usado (usar estado local)
  const canUseButton = () => {
    if (usageType === 'unlimited') return true
    if (usageType === 'single_use') return localCurrentUses === 0
    if (usageType === 'limited') return localCurrentUses < maxUses
    return false
  }

  const isButtonUsable = canUseButton()
  
  // Actualizar monto editable cuando cambia el monto original
  useEffect(() => {
    setEditableAmount(amount)
  }, [amount])

  // Cerrar modal con tecla ESC
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isImageModalOpen) {
        setIsImageModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isImageModalOpen])

  // Efecto de confetti cuando se confirma el pago
  useEffect(() => {
    const successMessage = language === 'es' ? 'Pago realizado' : 'Payment successful'
    if (status === successMessage || status === 'Pago realizado') {
      const duration = 3000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
      }, 250)
    }
  }, [status])

  // Obtener símbolo y balance del token del botón
  useEffect(() => {
    const loadButtonTokenInfo = async () => {
      if (provider && tokenAddress) {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
          
          // Obtener símbolo
          try {
            const symbol = await tokenContract.symbol()
            setButtonTokenSymbol(symbol)
          } catch (error) {
            // Si es POL (token nativo)
            if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
              setButtonTokenSymbol('POL')
            } else {
              setButtonTokenSymbol(tokenSymbol || 'TOKEN')
            }
          }
          
          // Obtener balance si hay cuenta conectada
          if (account) {
            setIsLoadingBalance(true)
            try {
              let balanceWei
              if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
                // Para POL, obtener balance nativo
                balanceWei = await provider.getBalance(account)
              } else {
                balanceWei = await tokenContract.balanceOf(account)
              }
              
              const decimals = tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010' 
                ? 18 
                : await tokenContract.decimals()
              
              const balanceFormatted = ethers.formatUnits(balanceWei, decimals)
              setBalance(parseFloat(balanceFormatted).toFixed(6))
            } catch (error) {
              console.error('Error cargando balance:', error)
              setBalance(null)
            } finally {
              setIsLoadingBalance(false)
            }
          } else {
            setBalance(null)
          }
        } catch (error) {
          console.error('Error cargando información del token:', error)
        }
      }
    }
    loadButtonTokenInfo()
  }, [provider, tokenAddress, ERC20_ABI, tokenSymbol, account])

  // Copiar link de pago
  const copyPaymentLink = async () => {
    if (paymentLink) {
      try {
        await navigator.clipboard.writeText(paymentLink)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      } catch (error) {
        console.error('Error copiando link:', error)
        // Fallback para navegadores antiguos
        const textArea = document.createElement('textarea')
        textArea.value = paymentLink
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      }
    }
  }

  const handlePayment = async () => {
    if (!account || !provider) {
      alert('Por favor, conecta tu wallet primero.')
      return
    }

    // Verificar que estemos en Polygon
    if (currentNetwork && !currentNetwork.isPolygon) {
      const shouldSwitch = confirm('Debes estar en Polygon Mainnet para realizar el pago. ¿Deseas cambiar de red ahora?')
      if (shouldSwitch && onSwitchNetwork) {
        await onSwitchNetwork()
      }
      return
    }

    // Verificar si el botón aún puede ser usado (usar estado local actualizado)
    if (!isButtonUsable) {
      const message = usageType === 'single_use'
        ? (language === 'es' ? 'Este botón ya fue usado y no puede ser usado nuevamente.' : 'This button has already been used and cannot be used again.')
        : usageType === 'limited'
          ? (language === 'es' ? `Este botón ha alcanzado su límite de usos (${localCurrentUses}/${maxUses}).` : `This button has reached its usage limit (${localCurrentUses}/${maxUses}).`)
          : (language === 'es' ? 'Este botón no está disponible.' : 'This button is not available.')
      setStatus(message)
      setTimeout(() => setStatus(''), 5000)
      return
    }

    try {
      setIsProcessing(true)
      setStatus('')
      setTxHash(null)

      // Usar el monto editable si está disponible, sino el monto original
      const paymentAmount = canEditAmount && editableAmount ? editableAmount : amount
      
      // Validar que el monto sea válido
      if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
        throw new Error(language === 'es' ? 'Monto inválido' : 'Invalid amount')
      }

      const signer = await provider.getSigner()
      
      let tokenContract, decimals, amountInWei, balanceWei
      
      if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
        // POL es nativo, usar transferencia de ETH
        decimals = 18
        amountInWei = ethers.parseEther(paymentAmount)
        balanceWei = await provider.getBalance(account)
      } else {
        tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
        decimals = await tokenContract.decimals()
        amountInWei = ethers.parseUnits(paymentAmount, decimals)
        balanceWei = await tokenContract.balanceOf(account)
      }

      // Verificar balance
      if (balanceWei < amountInWei) {
        throw new Error('Balance insuficiente')
      }

      // Realizar la transferencia (sin incluir concepto en la transacción)
      let tx
      if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
        // Para POL (nativo), enviar sin data
        tx = await signer.sendTransaction({
          to: recipientAddress,
          value: amountInWei
        })
      } else {
        // Para tokens ERC-20, usar transfer estándar
        tx = await tokenContract.transfer(recipientAddress, amountInWei)
      }
      
      // Guardar hash de la transacción
      const transactionHash = tx.hash
      setTxHash(transactionHash)
      
      // Esperar confirmación
      await tx.wait()
      
      // INMEDIATAMENTE actualizar el estado local para deshabilitar el botón
      // Esto se hace ANTES de registrar en la BD para feedback inmediato
      if (usageType === 'single_use' || usageType === 'limited') {
        setLocalCurrentUses(prev => prev + 1)
      }
      
      // Registrar el pago exitoso en la base de datos
      if (onPaymentSuccess && shortId) {
        await onPaymentSuccess(shortId, account, paymentAmount, tokenAddress, transactionHash)
      }
      
      // Actualizar balance después del pago
      if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
        const newBalance = await provider.getBalance(account)
        const balanceFormatted = ethers.formatEther(newBalance)
        setBalance(parseFloat(balanceFormatted).toFixed(6))
      } else {
        const newBalance = await tokenContract.balanceOf(account)
        const balanceFormatted = ethers.formatUnits(newBalance, decimals)
        setBalance(parseFloat(balanceFormatted).toFixed(6))
      }
      
      setStatus(language === 'es' ? 'Pago realizado' : 'Payment successful')
      
      // Limpiar el estado después de 5 segundos (más tiempo para ver el link)
      setTimeout(() => {
        setStatus('')
        setTxHash(null)
      }, 5000)

    } catch (error) {
      console.error('Error en el pago:', error)
      if (error.code === 4001) {
        setStatus('Transacción cancelada')
      } else if (error.message.includes('insuficiente')) {
        setStatus('Balance insuficiente')
      } else {
        setStatus('Error en la transacción')
      }
      
      setTimeout(() => {
        setStatus('')
      }, 3000)
    } finally {
      setIsProcessing(false)
    }
  }

  // Obtener nombre y ticker del token desde la lista de tokens disponibles
  const getTokenInfo = () => {
    const AVAILABLE_TOKENS = [
      { address: '0x87bdfbe98Ba55104701b2F2e999982a317905637', symbol: 'CNKT+', name: 'CNKT+' },
      { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', symbol: 'USDC', name: 'USDC' },
      { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', symbol: 'USDT', name: 'USDT' },
      { address: '0x0000000000000000000000000000000000001010', symbol: 'POL', name: 'POL' }
    ]
    const token = AVAILABLE_TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())
    if (token) {
      return { name: token.name, symbol: token.symbol }
    }
    return { name: buttonTokenSymbol || tokenSymbol || 'TOKEN', symbol: buttonTokenSymbol || tokenSymbol || 'TOKEN' }
  }
  
  const tokenInfo = getTokenInfo()

  // Usar itemName/itemDescription si están disponibles, sino usar concept para compatibilidad
  const displayName = itemName || concept || ''
  const displayDescription = itemDescription || ''
  
  // Crear array de imágenes disponibles (filtrar nulls)
  const displayImages = [itemImage, itemImage2, itemImage3].filter(img => img !== null && img !== undefined && img !== '')
  const displayImage = displayImages.length > 0 ? displayImages[0] : null
  
  // Resetear índice cuando se abre el modal
  useEffect(() => {
    if (isImageModalOpen) {
      setCurrentImageIndex(0)
    }
  }, [isImageModalOpen])
  
  // Navegar con teclado en el lightbox
  useEffect(() => {
    if (!isImageModalOpen || displayImages.length <= 1) return
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isImageModalOpen, displayImages.length])

  return (
    <div className={`payment-button-container ${isCompact ? 'compact' : ''}`}>
      <div className={`payment-info ${isCompact ? 'compact' : ''}`}>
        {/* Nombre del servicio/producto */}
        {displayName && (
          <div className="item-name-section">
            <h2 className="item-name">{displayName}</h2>
          </div>
        )}

        {/* Foto y descripción */}
        {isCompact ? (
          // Vista compacta (pagador): foto y descripción lado a lado
          <div className="item-media-section">
            <div className="item-image-container">
              {displayImage ? (
                <img 
                  src={displayImage} 
                  alt={displayName || 'Item'} 
                  className="item-image item-image-clickable"
                  onClick={() => displayImages.length > 0 && setIsImageModalOpen(true)}
                  title={displayImages.length > 0 ? (language === 'es' ? 'Haz clic para ampliar' : 'Click to enlarge') : ''}
                />
              ) : (
                <div className="item-image-placeholder">
                  <span className="placeholder-icon">📷</span>
                  <span className="placeholder-text">{language === 'es' ? 'Sin imagen' : 'No image'}</span>
                </div>
              )}
            </div>
            {displayDescription && (
              <div className="item-description-container">
                <p className="item-description">{displayDescription}</p>
              </div>
            )}
          </div>
        ) : (
          // Vista historial: descripción debajo de la foto
          <div className="item-media-section-history">
            <div className="item-image-container">
              {displayImage ? (
                <img 
                  src={displayImage} 
                  alt={displayName || 'Item'} 
                  className="item-image item-image-clickable"
                  onClick={() => displayImages.length > 0 && setIsImageModalOpen(true)}
                  title={displayImages.length > 0 ? (language === 'es' ? 'Haz clic para ampliar' : 'Click to enlarge') : ''}
                />
              ) : (
                <div className="item-image-placeholder">
                  <span className="placeholder-icon">📷</span>
                  <span className="placeholder-text">{language === 'es' ? 'Sin imagen' : 'No image'}</span>
                </div>
              )}
            </div>
            {displayDescription && (
              <div className="item-description-container-history">
                <p className="item-description">{displayDescription}</p>
              </div>
            )}
          </div>
        )}

        {/* Precio y tipo de pago */}
        <div className="price-section">
          <div className="amount-section">
            {canEditAmount && paymentType === 'editable' ? (
              <div className="amount-input-group-full">
                <span className="amount-label">
                  <strong>{language === 'es' ? 'Precio:' : 'Price:'}</strong>
                </span>
                <input
                  type="number"
                  id="editable-amount"
                  value={editableAmount}
                  onChange={(e) => setEditableAmount(e.target.value)}
                  step="0.000001"
                  min="0"
                  className="amount-input-full"
                  placeholder={amount}
                />
                <span className="amount-token-symbol">
                  <a 
                    href={`https://polygonscan.com/token/${tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="token-link-inline token-link-bold"
                    title="Ver token en Polygonscan"
                  >
                    <strong>{tokenInfo.name} ({tokenInfo.symbol})</strong>
                  </a>
                </span>
              </div>
            ) : (
              <div className="amount-display-full">
                <span className="amount-label">
                  <strong>{language === 'es' ? 'Precio:' : 'Price:'}</strong>
                </span>
                <span className="amount-value amount-value-bold">{formatPrice(amount)}</span>
                <span className="amount-token-symbol">
                  <a 
                    href={`https://polygonscan.com/token/${tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="token-link-inline token-link-bold"
                    title="Ver token en Polygonscan"
                  >
                    <strong>{tokenInfo.name} ({tokenInfo.symbol})</strong>
                  </a>
                </span>
              </div>
            )}
          </div>
          <div className="payment-type-recipient-section">
            <div className="payment-type-section">
              <span className="payment-type-label">
                {language === 'es' ? 'Tipo de pago:' : 'Payment type:'} 
              </span>
              <span className="payment-type-value">
                {paymentType === 'fixed' 
                  ? (language === 'es' ? 'Fijo' : 'Fixed')
                  : (language === 'es' ? 'Variable' : 'Variable')
                }
              </span>
            </div>
            <div className="recipient-section-inline">
              <span className="recipient-label-inline">
                <strong>{language === 'es' ? 'Destinatario:' : 'Recipient:'}</strong>
              </span>
              <span className="recipient-address-hover">
                <a 
                  href={`https://polygonscan.com/address/${recipientAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="recipient-address-link"
                  title={language === 'es' ? 'Ver en Polygonscan' : 'View on Polygonscan'}
                >
                  {formatWallet(recipientAddress)}
                </a>
                <div className="wallet-tooltip">
                  {recipientAddress}
                </div>
              </span>
            </div>
          </div>
        </div>

        {/* QR Code y Wallet/Balance en la misma línea */}
        <div className={`qr-wallet-section ${!isCompact ? 'qr-wallet-section-history' : ''}`}>
          {/* QR Code (50%) */}
          {paymentLink && (
            <div className="payment-link-section-inline">
              <div className="qr-code-container-inline">
                <QRCodeSVG 
                  value={paymentLink}
                  size={isCompact ? 120 : 112.5}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
          )}

          {/* Wallet y Balance (50%) */}
          <div className="wallet-balance-section">
            {!account ? (
              <div className="wallet-connect-placeholder">
                <p className="wallet-connect-hint">
                  {language === 'es' ? 'Conecta tu wallet para ver el balance' : 'Connect your wallet to see balance'}
                </p>
              </div>
            ) : (
              <>
                <div className="wallet-from-section">
                  <p className="wallet-from-label-inline">
                    <strong>{language === 'es' ? 'Enviar desde:' : 'Send from:'}</strong>
                  </p>
                  <p className="wallet-from-address-hover">
                    <a 
                      href={`https://polygonscan.com/address/${account}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="recipient-address-link"
                      title={language === 'es' ? 'Ver en Polygonscan' : 'View on Polygonscan'}
                    >
                      {formatWallet(account)}
                    </a>
                    <div className="wallet-tooltip">
                      {account}
                    </div>
                  </p>
                </div>
                {account && (
                  <div className="balance-section-inline">
                    <p className="balance-info-inline">
                      <strong>{language === 'es' ? 'Tu balance:' : 'Your balance:'}</strong>
                    </p>
                    <div className="balance-amount-token">
                      <span className="balance-amount">
                        {isLoadingBalance 
                          ? (language === 'es' ? 'Cargando...' : 'Loading...')
                          : balance !== null 
                            ? formatBalance(balance)
                            : 'N/A'
                        }
                      </span>
                      <span className="balance-token-symbol">
                        {tokenInfo.symbol}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Botón Copiar URL al 100% del ancho */}
        {paymentLink && (
          <div className="copy-url-button-section">
            <button 
              onClick={copyPaymentLink}
              className="btn-copy-link btn-copy-link-full"
              title={language === 'es' ? 'Copiar link de pago' : 'Copy payment link'}
            >
              {linkCopied ? (language === 'es' ? '✓ Copiado' : '✓ Copied') : (language === 'es' ? '📋 Copiar URL' : '📋 Copy URL')}
            </button>
          </div>
        )}

        {/* Botones al 100% del contenedor */}
        <div className="action-buttons-section">
          {!account && (
            <div className="wallet-connect-section">
              {onConnectWallet ? (
                <button
                  onClick={onConnectWallet}
                  className="btn btn-primary btn-connect-wallet"
                  disabled={isConnecting}
                >
                  {isConnecting 
                    ? (language === 'es' ? 'Conectando...' : 'Connecting...')
                    : (language === 'es' ? 'Conectar Wallet' : 'Connect Wallet')
                  }
                </button>
              ) : (
                <p className="warning-text-small">
                  {language === 'es' ? 'Conecta tu wallet para pagar' : 'Connect your wallet to pay'}
                </p>
              )}
            </div>
          )}

          {currentNetwork && !currentNetwork.isPolygon && (
            <p className="network-warning">
              ⚠️ {language === 'es' ? 'Cambia a Polygon Mainnet para pagar' : 'Switch to Polygon Mainnet to pay'}
            </p>
          )}

          {!isButtonUsable && (
            <div className="button-disabled-message" style={{ 
              padding: '1rem', 
              marginBottom: '1rem', 
              backgroundColor: '#fee2e2', 
              color: '#991b1b', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              {usageType === 'single_use'
                ? (language === 'es' ? '⚠️ Este botón ya fue usado y no puede ser usado nuevamente.' : '⚠️ This button has already been used and cannot be used again.')
                : usageType === 'limited'
                  ? (language === 'es' ? `⚠️ Este botón ha alcanzado su límite de usos (${localCurrentUses}/${maxUses}).` : `⚠️ This button has reached its usage limit (${localCurrentUses}/${maxUses}).`)
                  : (language === 'es' ? '⚠️ Este botón no está disponible.' : '⚠️ This button is not available.')
              }
            </div>
          )}
          <button
            onClick={handlePayment}
            disabled={isProcessing || !account || (currentNetwork && !currentNetwork.isPolygon) || !isButtonUsable}
            className={`payment-btn ${isCompact ? 'compact' : ''}`}
            style={{ 
              backgroundColor: buttonColor,
              opacity: (!account || isProcessing || (currentNetwork && !currentNetwork.isPolygon) || !isButtonUsable) ? 0.6 : 1,
              cursor: (!account || isProcessing || (currentNetwork && !currentNetwork.isPolygon) || !isButtonUsable) ? 'not-allowed' : 'pointer'
            }}
          >
            {isProcessing ? (language === 'es' ? 'Procesando...' : 'Processing...') : buttonText}
          </button>
        </div>
      </div>


      {status && (
        <div className={`status-message ${(status === 'Pago realizado' || status === 'Payment successful') ? 'success' : 'error'}`}>
          <p style={{ margin: 0, marginBottom: txHash ? '0.5rem' : 0 }}>
            {status}
          </p>
          {txHash && (status === 'Pago realizado' || status === 'Payment successful') && (
            <a 
              href={`https://polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              {language === 'es' ? 'Ver en Polygonscan' : 'View on Polygonscan'} ↗
            </a>
          )}
        </div>
      )}

      {/* Modal Lightbox para la imagen con slider */}
      {isImageModalOpen && displayImages.length > 0 && (
        <div className="image-lightbox-overlay" onClick={() => setIsImageModalOpen(false)}>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="image-lightbox-close"
              onClick={() => setIsImageModalOpen(false)}
              aria-label={language === 'es' ? 'Cerrar' : 'Close'}
            >
              ×
            </button>
            
            {/* Botón anterior (solo si hay más de una imagen) */}
            {displayImages.length > 1 && (
              <button 
                className="image-lightbox-nav image-lightbox-prev"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1))
                }}
                aria-label={language === 'es' ? 'Imagen anterior' : 'Previous image'}
              >
                ‹
              </button>
            )}
            
            <img 
              src={displayImages[currentImageIndex]} 
              alt={`${displayName || 'Item'} - ${currentImageIndex + 1}`} 
              className="image-lightbox-image"
            />
            
            {/* Botón siguiente (solo si hay más de una imagen) */}
            {displayImages.length > 1 && (
              <button 
                className="image-lightbox-nav image-lightbox-next"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1))
                }}
                aria-label={language === 'es' ? 'Imagen siguiente' : 'Next image'}
              >
                ›
              </button>
            )}
            
            {/* Indicadores de imágenes (dots) */}
            {displayImages.length > 1 && (
              <div className="image-lightbox-indicators">
                {displayImages.map((_, index) => (
                  <button
                    key={index}
                    className={`image-lightbox-dot ${index === currentImageIndex ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentImageIndex(index)
                    }}
                    aria-label={language === 'es' ? `Ir a imagen ${index + 1}` : `Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentButton

