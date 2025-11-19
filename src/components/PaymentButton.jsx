import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { QRCodeSVG } from 'qrcode.react'
import confetti from 'canvas-confetti'

function PaymentButton({ 
  recipientAddress, 
  amount, 
  concept,
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
  isCompact = false,
  language = 'es',
  paymentType = 'fixed' // 'fixed' o 'editable'
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [buttonTokenSymbol, setButtonTokenSymbol] = useState(tokenSymbol || '')
  const [balance, setBalance] = useState(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [editableAmount, setEditableAmount] = useState(amount)
  
  // Verificar si el usuario es el creador del botón (owner)
  const isOwner = account && recipientAddress && account.toLowerCase() === recipientAddress.toLowerCase()
  
  // Determinar si el monto puede ser editado
  const canEditAmount = paymentType === 'editable' || (paymentType === 'fixed' && isOwner)
  
  // Actualizar monto editable cuando cambia el monto original
  useEffect(() => {
    setEditableAmount(amount)
  }, [amount])

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

  return (
    <div className={`payment-button-container ${isCompact ? 'compact' : ''}`}>
      <div className={`payment-info ${isCompact ? 'compact' : ''}`}>
        {concept && (
          <div className="concept-section">
            <h3 className="concept-title">{language === 'es' ? 'Concepto' : 'Concept'}</h3>
            <p className="concept-text">{concept}</p>
          </div>
        )}
        <div className="recipient-section">
          <p className="recipient-label">
            <strong>{language === 'es' ? 'Destinatario:' : 'Recipient:'}</strong>
          </p>
          <p className="recipient-address">
            <a 
              href={`https://polygonscan.com/address/${recipientAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="recipient-address-link"
              title={language === 'es' ? 'Ver en Polygonscan' : 'View on Polygonscan'}
            >
              {recipientAddress}
            </a>
          </p>
        </div>
        <div className="amount-section">
          {canEditAmount ? (
            <div className="amount-input-group-full">
              <span className="amount-label">
                <strong>{language === 'es' ? 'Monto:' : 'Amount:'}</strong>
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
                  className="token-link-inline"
                  title="Ver token en Polygonscan"
                >
                  {tokenInfo.name} ({tokenInfo.symbol})
                </a>
              </span>
              {paymentType === 'fixed' && isOwner && (
                <p className="amount-hint">
                  {language === 'es' ? 'Solo tú puedes cambiar este monto (Fijo)' : 'Only you can change this amount (Fixed)'}
                </p>
              )}
              {paymentType === 'editable' && (
                <p className="amount-hint">
                  {language === 'es' ? 'Puedes cambiar el monto (Variable)' : 'You can change the amount (Variable)'}
                </p>
              )}
            </div>
          ) : (
            <div className="amount-display-full">
              <span className="amount-label">
                <strong>{language === 'es' ? 'Monto:' : 'Amount:'}</strong>
              </span>
              <span className="amount-value">{amount}</span>
              <span className="amount-token-symbol">
                <a 
                  href={`https://polygonscan.com/token/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="token-link-inline"
                  title="Ver token en Polygonscan"
                >
                  {tokenInfo.name} ({tokenInfo.symbol})
                </a>
              </span>
            </div>
          )}
        </div>
        {account && (
          <p className="balance-info">
            <strong>{language === 'es' ? 'Tu balance:' : 'Your balance:'}</strong> {
              isLoadingBalance 
                ? (language === 'es' ? 'Cargando...' : 'Loading...')
                : balance !== null 
                  ? (
                    <>
                      {balance}{' '}
                      <a 
                        href={`https://polygonscan.com/token/${tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="token-link-inline"
                        title="Ver token en Polygonscan"
                      >
                        {tokenInfo.name} ({tokenInfo.symbol})
                      </a>
                    </>
                  )
                  : 'N/A'
            }
          </p>
        )}
        {currentNetwork && !currentNetwork.isPolygon && (
          <p className="network-warning">
            ⚠️ Cambia a Polygon Mainnet para pagar
          </p>
        )}
      </div>
      
      <button
        onClick={handlePayment}
        disabled={isProcessing || !account || (currentNetwork && !currentNetwork.isPolygon)}
        className={`payment-btn ${isCompact ? 'compact' : ''}`}
        style={{ 
          backgroundColor: buttonColor,
          opacity: (!account || isProcessing || (currentNetwork && !currentNetwork.isPolygon)) ? 0.6 : 1,
          cursor: (!account || isProcessing || (currentNetwork && !currentNetwork.isPolygon)) ? 'not-allowed' : 'pointer'
        }}
      >
        {isProcessing ? 'Procesando...' : buttonText}
      </button>

      {paymentLink && (
        <div className="payment-link-section">
          <div className="qr-code-container">
            <QRCodeSVG 
              value={paymentLink}
              size={isCompact ? 150 : 200}
              level="H"
              includeMargin={true}
            />
          </div>
          {!isCompact && (
            <div className="link-container">
              <input 
                type="text" 
                value={paymentLink} 
                readOnly 
                className="link-input"
                onClick={(e) => e.target.select()}
              />
              <button 
                onClick={copyPaymentLink}
                className="btn-copy-link"
                title={language === 'es' ? 'Copiar link de pago' : 'Copy payment link'}
              >
                {linkCopied ? (language === 'es' ? '✓ Copiado' : '✓ Copied') : (language === 'es' ? '📋 Copiar Link' : '📋 Copy Link')}
              </button>
            </div>
          )}
          {isCompact && (
            <button 
              onClick={copyPaymentLink}
              className="btn-copy-link btn-copy-link-compact"
              title={language === 'es' ? 'Copiar link de pago' : 'Copy payment link'}
            >
              {linkCopied ? (language === 'es' ? '✓ Copiado' : '✓ Copied') : (language === 'es' ? '📋 Copiar URL' : '📋 Copy URL')}
            </button>
          )}
          {!isCompact && (
            <p className="link-hint">
              {language === 'es' ? 'Comparte este link o escanea el QR en redes sociales para que otros puedan pagar' : 'Share this link or scan the QR code on social media so others can pay'}
            </p>
          )}
        </div>
      )}

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

      {!account && (
        <p className="warning-text-small">
          {language === 'es' ? 'Conecta tu wallet para pagar' : 'Connect your wallet to pay'}
        </p>
      )}
    </div>
  )
}

export default PaymentButton

