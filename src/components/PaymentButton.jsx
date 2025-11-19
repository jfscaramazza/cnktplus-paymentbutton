import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function PaymentButton({ 
  recipientAddress, 
  amount, 
  buttonText, 
  buttonColor, 
  tokenAddress,
  provider,
  account,
  ERC20_ABI,
  paymentLink,
  tokenSymbol,
  currentNetwork,
  onSwitchNetwork
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [buttonTokenSymbol, setButtonTokenSymbol] = useState(tokenSymbol || '')

  // Obtener símbolo del token del botón si es diferente
  useEffect(() => {
    const loadButtonTokenSymbol = async () => {
      if (provider && tokenAddress) {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
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
      }
    }
    loadButtonTokenSymbol()
  }, [provider, tokenAddress, ERC20_ABI, tokenSymbol])

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
      setStatus('Iniciando transacción...')

      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer)

      // Obtener decimales del token
      const decimals = await tokenContract.decimals()
      const amountInWei = ethers.parseUnits(amount, decimals)

      // Verificar balance
      const balance = await tokenContract.balanceOf(account)
      if (balance < amountInWei) {
        throw new Error('Balance insuficiente')
      }

      setStatus('Confirmando transacción en tu wallet...')

      // Realizar la transferencia
      const tx = await tokenContract.transfer(recipientAddress, amountInWei)
      
      setStatus('Esperando confirmación...')
      
      // Esperar confirmación
      await tx.wait()
      
      setStatus('✅ Pago realizado exitosamente!')
      
      // Limpiar el estado después de 5 segundos
      setTimeout(() => {
        setStatus('')
      }, 5000)

    } catch (error) {
      console.error('Error en el pago:', error)
      if (error.code === 4001) {
        setStatus('❌ Transacción cancelada por el usuario')
      } else if (error.message.includes('insuficiente')) {
        setStatus('❌ Balance insuficiente')
      } else {
        setStatus('❌ Error: ' + error.message)
      }
      
      setTimeout(() => {
        setStatus('')
      }, 5000)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="payment-button-container">
      <div className="payment-info">
        <p><strong>Destinatario:</strong> {recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}</p>
        <p><strong>Monto:</strong> {amount} {buttonTokenSymbol || tokenSymbol || 'tokens'}</p>
        {currentNetwork && !currentNetwork.isPolygon && (
          <p className="network-warning">
            ⚠️ Cambia a Polygon Mainnet para pagar
          </p>
        )}
      </div>
      
      <button
        onClick={handlePayment}
        disabled={isProcessing || !account || (currentNetwork && !currentNetwork.isPolygon)}
        className="payment-btn"
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
        <p className={`status-message ${status.includes('✅') ? 'success' : 'error'}`}>
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

