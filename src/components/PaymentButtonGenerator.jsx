import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

function PaymentButtonGenerator({ onGenerate, tokenAddress, provider, account, tokenSymbol, language = 'es' }) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [concept, setConcept] = useState('')
  const [buttonText, setButtonText] = useState(language === 'es' ? 'Pagar' : 'Pay')
  const [buttonColor, setButtonColor] = useState('#6366f1')
  const [isGenerating, setIsGenerating] = useState(false)

  // Auto-completar con la wallet conectada solo si el campo está vacío
  useEffect(() => {
    if (account && recipientAddress === '') {
      setRecipientAddress(account)
    }
  }, [account]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async (e) => {
    e.preventDefault()

    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      alert(language === 'es' ? 'Por favor, ingresa una dirección de wallet válida.' : 'Please enter a valid wallet address.')
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert(language === 'es' ? 'Por favor, ingresa un monto válido.' : 'Please enter a valid amount.')
      return
    }

    setIsGenerating(true)

    try {
      const buttonData = {
        recipientAddress,
        amount,
        concept,
        buttonText,
        buttonColor,
        tokenAddress
      }

      await onGenerate(buttonData)

      // Limpiar formulario solo si se generó correctamente
      setRecipientAddress('')
      setAmount('')
      setConcept('')
      setButtonText(language === 'es' ? 'Pagar' : 'Pay')
      setButtonColor('#6366f1')
    } catch (error) {
      console.error('Error generando botón:', error)
      alert(language === 'es' ? 'Error al generar el botón. Por favor, intenta de nuevo.' : 'Error generating button. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <section className="generator-section">
      <h2>{language === 'es' ? 'Generar Botón de Pago' : 'Generate Payment Button'}</h2>
      <form onSubmit={handleGenerate} className="generator-form">
        <div className="form-group">
          <label htmlFor="recipient">{language === 'es' ? 'Dirección del Destinatario:' : 'Recipient Address:'}</label>
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
          <label htmlFor="amount">{language === 'es' ? 'Monto a Pagar' : 'Amount to Pay'} {tokenSymbol && `(${tokenSymbol})`}:</label>
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
          <label htmlFor="concept">{language === 'es' ? 'Concepto del Pago:' : 'Payment Concept:'}</label>
          <input
            type="text"
            id="concept"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder={language === 'es' ? 'Ej: Pago de servicios, Producto XYZ, etc.' : 'E.g: Service payment, Product XYZ, etc.'}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="buttonText">{language === 'es' ? 'Texto del Botón:' : 'Button Text:'}</label>
          <input
            type="text"
            id="buttonText"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            placeholder={language === 'es' ? 'Pagar' : 'Pay'}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="buttonColor">{language === 'es' ? 'Color del Botón:' : 'Button Color:'}</label>
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
          disabled={isGenerating}
        >
          {isGenerating
            ? (language === 'es' ? 'Generando...' : 'Generating...')
            : (language === 'es' ? 'Generar Botón' : 'Generate Button')
          }
        </button>
      </form>
    </section>
  )
}

export default PaymentButtonGenerator

