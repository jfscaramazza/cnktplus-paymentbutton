import { useState } from 'react'
import { ethers } from 'ethers'

function PaymentButtonGenerator({ onGenerate, tokenAddress, provider, account, tokenSymbol }) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [buttonText, setButtonText] = useState('Pagar')
  const [buttonColor, setButtonColor] = useState('#6366f1')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = (e) => {
    e.preventDefault()
    
    if (!account) {
      alert('Por favor, conecta tu wallet primero.')
      return
    }

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      alert('Por favor, ingresa una dirección de wallet válida.')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Por favor, ingresa un monto válido.')
      return
    }

    setIsGenerating(true)
    
    const buttonData = {
      recipientAddress,
      amount,
      buttonText,
      buttonColor,
      tokenAddress
    }

    onGenerate(buttonData)
    
    // Limpiar formulario
    setRecipientAddress('')
    setAmount('')
    setButtonText('Pagar')
    setButtonColor('#6366f1')
    setIsGenerating(false)
  }

  return (
    <section className="generator-section">
      <h2>Generar Botón de Pago</h2>
      <form onSubmit={handleGenerate} className="generator-form">
        <div className="form-group">
          <label htmlFor="recipient">Dirección del Destinatario:</label>
          <input
            type="text"
            id="recipient"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            placeholder="0x..."
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Monto a Pagar {tokenSymbol && `(${tokenSymbol})`}:</label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            step="0.000001"
            min="0"
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="buttonText">Texto del Botón:</label>
          <input
            type="text"
            id="buttonText"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder="Pagar"
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="buttonColor">Color del Botón:</label>
          <input
            type="color"
            id="buttonColor"
            value={buttonColor}
            onChange={(e) => setButtonColor(e.target.value)}
            className="form-input color-input"
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary btn-generate"
          disabled={isGenerating || !account}
        >
          {isGenerating ? 'Generando...' : 'Generar Botón'}
        </button>

        {!account && (
          <p className="warning-text">
            ⚠️ Conecta tu wallet para generar botones de pago
          </p>
        )}
      </form>
    </section>
  )
}

export default PaymentButtonGenerator

