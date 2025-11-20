import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { supabase } from '../lib/supabase'

function PaymentButtonGenerator({ onGenerate, tokenAddress, provider, account, tokenSymbol, language = 'es' }) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemImage, setItemImage] = useState(null)
  const [itemImagePreview, setItemImagePreview] = useState(null)
  const [buttonText, setButtonText] = useState(language === 'es' ? 'Pagar' : 'Pay')
  const [buttonColor, setButtonColor] = useState('#6366f1')
  const [paymentType, setPaymentType] = useState('fixed') // 'fixed' o 'editable'
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
      // Subir imagen a Supabase Storage si existe
      let imageUrl = null
      if (itemImage && supabase) {
        try {
          // Generar nombre único para la imagen
          const fileExt = itemImage.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
          const filePath = `payment-items/${fileName}`

          // Validar tamaño (máximo 5MB)
          if (itemImage.size > 5 * 1024 * 1024) {
            alert(language === 'es' ? 'La imagen es demasiado grande. Máximo 5MB.' : 'Image is too large. Maximum 5MB.')
            setIsGenerating(false)
            return
          }

          // Subir a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment-item-images')
            .upload(filePath, itemImage, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error('Error subiendo imagen:', uploadError)
            alert(language === 'es' 
              ? 'Error al subir la imagen. Por favor, intenta de nuevo.' 
              : 'Error uploading image. Please try again.')
            setIsGenerating(false)
            return
          }

          // Obtener URL pública de la imagen
          const { data: urlData } = supabase.storage
            .from('payment-item-images')
            .getPublicUrl(filePath)

          imageUrl = urlData.publicUrl
        } catch (error) {
          console.error('Error procesando imagen:', error)
          alert(language === 'es' 
            ? 'Error al procesar la imagen. Por favor, intenta de nuevo.' 
            : 'Error processing image. Please try again.')
          setIsGenerating(false)
          return
        }
      } else if (itemImage && !supabase) {
        // Fallback: convertir a base64 si Supabase no está configurado
        const reader = new FileReader()
        imageUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(itemImage)
        })
      }

      const buttonData = {
        recipientAddress,
        amount,
        itemName,
        itemDescription,
        itemImage: imageUrl,
        buttonText,
        buttonColor,
        tokenAddress,
        paymentType
      }

      await onGenerate(buttonData)

      // Limpiar formulario solo si se generó correctamente
      setRecipientAddress('')
      setAmount('')
      setItemName('')
      setItemDescription('')
      setItemImage(null)
      setItemImagePreview(null)
      setButtonText(language === 'es' ? 'Pagar' : 'Pay')
      setButtonColor('#6366f1')
      setPaymentType('fixed')
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
          <label htmlFor="itemName">{language === 'es' ? 'Nombre del Artículo o Servicio:' : 'Item or Service Name:'}</label>
          <input
            type="text"
            id="itemName"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder={language === 'es' ? 'Ej: Producto XYZ, Servicio de Consultoría, etc.' : 'E.g: Product XYZ, Consulting Service, etc.'}
            required
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="itemImage">{language === 'es' ? 'Imagen del Artículo:' : 'Item Image:'}</label>
          <input
            type="file"
            id="itemImage"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0]
              if (file) {
                setItemImage(file)
                const reader = new FileReader()
                reader.onloadend = () => {
                  setItemImagePreview(reader.result)
                }
                reader.readAsDataURL(file)
              } else {
                setItemImage(null)
                setItemImagePreview(null)
              }
            }}
            className="form-input"
          />
          {itemImagePreview && (
            <div className="image-preview-container">
              <img src={itemImagePreview} alt="Preview" className="image-preview" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="itemDescription">{language === 'es' ? 'Descripción del Artículo o Servicio:' : 'Item or Service Description:'}</label>
          <textarea
            id="itemDescription"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder={language === 'es' ? 'Describe tu artículo o servicio en detalle...' : 'Describe your item or service in detail...'}
            required
            className="form-input form-textarea"
            rows="4"
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
          <label htmlFor="paymentType">{language === 'es' ? 'Tipo de Pago:' : 'Payment Type:'}</label>
          <select
            id="paymentType"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className="form-input"
            required
          >
            <option value="fixed">{language === 'es' ? 'Fijo' : 'Fixed'}</option>
            <option value="editable">{language === 'es' ? 'Variable' : 'Variable'}</option>
          </select>
          <p className="form-hint">
            {paymentType === 'fixed'
              ? (language === 'es' ? 'Solo el creador del botón puede cambiar el monto.' : 'Only the button creator can change the amount.')
              : (language === 'es' ? 'Cualquiera puede cambiar el monto en su UI.' : 'Anyone can change the amount in their UI.')
            }
          </p>
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

