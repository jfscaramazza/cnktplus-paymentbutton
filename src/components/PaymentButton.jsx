import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

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
  isCompact = false
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [buttonTokenSymbol, setButtonTokenSymbol] = useState(tokenSymbol || '')
  const [balance, setBalance] = useState(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

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

      const signer = await provider.getSigner()
      
      let tokenContract, decimals, amountInWei, balanceWei
      
      if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
        // POL es nativo, usar transferencia de ETH
        decimals = 18
        amountInWei = ethers.parseEther(amount)
        balanceWei = await provider.getBalance(account)
      } else {
        tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
        decimals = await tokenContract.decimals()
        amountInWei = ethers.parseUnits(amount, decimals)
        balanceWei = await tokenContract.balanceOf(account)
      }

      // Verificar balance
      if (balanceWei < amountInWei) {
        throw new Error('Balance insuficiente')
      }

      // Realizar la transferencia
      let tx
      if (tokenAddress.toLowerCase() === '0x0000000000000000000000000000000000001010') {
        tx = await signer.sendTransaction({
          to: recipientAddress,
          value: amountInWei
        })
      } else {
        tx = await tokenContract.transfer(recipientAddress, amountInWei)
      }
      
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
      
      setStatus('Pago realizado')
      
      // Limpiar el estado después de 3 segundos
      setTimeout(() => {
        setStatus('')
      }, 3000)

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

  return (
    <div className={`payment-button-container ${isCompact ? 'compact' : ''}`}>
      <div className={`payment-info ${isCompact ? 'compact' : ''}`}>
        {concept && (
          <div className="concept-section">
            <h3 className="concept-title">Concepto</h3>
            <p className="concept-text">{concept}</p>
          </div>
        )}
        <p><strong>Destinatario:</strong> {recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}</p>
        <p><strong>Monto:</strong> {amount} {buttonTokenSymbol || tokenSymbol || 'tokens'}</p>
        {account && (
          <p className="balance-info">
            <strong>Tu balance:</strong> {
              isLoadingBalance 
                ? 'Cargando...' 
                : balance !== null 
                  ? `${balance} ${buttonTokenSymbol || tokenSymbol || 'tokens'}` 
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

      {paymentLink && !isCompact && (
        <div className="payment-link-section">
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
              title="Copiar link de pago"
            >
              {linkCopied ? '✓ Copiado' : '📋 Copiar Link'}
            </button>
          </div>
          <p className="link-hint">
            Comparte este link en redes sociales para que otros puedan pagar
          </p>
        </div>
      )}

      {status && (
        <p className={`status-message ${status === 'Pago realizado' ? 'success' : 'error'}`}>
          {status}
        </p>
      )}

      {!account && (
        <p className="warning-text-small">
          Conecta tu wallet para pagar
        </p>
      )}
    </div>
  )
}

export default PaymentButton

