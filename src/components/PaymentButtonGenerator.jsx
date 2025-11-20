import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { supabase } from '../lib/supabase'

function PaymentButtonGenerator({ 
  onGenerate, 
  onUpdate, 
  onCancel,
  editingButton = null, // Datos del botón a editar
  tokenAddress, 
  provider, 
  account, 
  tokenSymbol, 
  language = 'es' 
}) {
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemImage, setItemImage] = useState(null) // File object o URL string
  const [itemImage2, setItemImage2] = useState(null)
  const [itemImage3, setItemImage3] = useState(null)
  const [itemImagePreview, setItemImagePreview] = useState(null)
  const [itemImagePreview2, setItemImagePreview2] = useState(null)
  const [itemImagePreview3, setItemImagePreview3] = useState(null)
  const [itemImageUrl, setItemImageUrl] = useState(null) // URLs guardadas (para edición)
  const [itemImageUrl2, setItemImageUrl2] = useState(null)
  const [itemImageUrl3, setItemImageUrl3] = useState(null)
  const [buttonText, setButtonText] = useState(language === 'es' ? 'Pagar' : 'Pay')
  const [buttonColor, setButtonColor] = useState('#6366f1')
  const [paymentType, setPaymentType] = useState('fixed')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  
  // Refs para drag and drop
  const dropZone1Ref = useRef(null)
  const dropZone2Ref = useRef(null)
  const dropZone3Ref = useRef(null)
  const [dragOver, setDragOver] = useState({ 1: false, 2: false, 3: false })

  const isEditing = !!editingButton
  const prevEditingButtonRef = useRef(editingButton)

  // Función para limpiar formulario
  const clearForm = () => {
    setRecipientAddress(account || '')
    setAmount('')
    setItemName('')
    setItemDescription('')
    setItemImage(null)
    setItemImage2(null)
    setItemImage3(null)
    setItemImagePreview(null)
    setItemImagePreview2(null)
    setItemImagePreview3(null)
    setItemImageUrl(null)
    setItemImageUrl2(null)
    setItemImageUrl3(null)
    setButtonText(language === 'es' ? 'Pagar' : 'Pay')
    setButtonColor('#6366f1')
    setPaymentType('fixed')
  }

  // Limpiar formulario cuando se sale del modo edición
  useEffect(() => {
    // Si había un botón en edición y ahora no hay, limpiar formulario
    if (prevEditingButtonRef.current && !editingButton) {
      clearForm()
    }
    prevEditingButtonRef.current = editingButton
  }, [editingButton, account, language]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar datos iniciales cuando está en modo edición
  useEffect(() => {
    if (editingButton) {
      console.log('Loading editing button data:', {
        recipientAddress: editingButton.recipientAddress,
        amount: editingButton.amount,
        itemName: editingButton.itemName,
        itemDescription: editingButton.itemDescription?.substring(0, 50) + '...',
        itemImage: editingButton.itemImage ? 'URL present' : 'null',
        itemImage2: editingButton.itemImage2 ? 'URL present' : 'null',
        itemImage3: editingButton.itemImage3 ? 'URL present' : 'null',
        buttonText: editingButton.buttonText,
        buttonColor: editingButton.buttonColor,
        paymentType: editingButton.paymentType
      })
      
      // Cargar todos los campos del formulario
      setRecipientAddress(editingButton.recipientAddress || '')
      setAmount(editingButton.amount || '')
      setItemName(editingButton.itemName || '')
      setItemDescription(editingButton.itemDescription || '')
      setButtonText(editingButton.buttonText || (language === 'es' ? 'Pagar' : 'Pay'))
      setButtonColor(editingButton.buttonColor || '#6366f1')
      setPaymentType(editingButton.paymentType || 'fixed')
      
      // Cargar URLs de imágenes existentes (limpiar primero)
      setItemImageUrl(null)
      setItemImage(null)
      setItemImagePreview(null)
      setItemImageUrl2(null)
      setItemImage2(null)
      setItemImagePreview2(null)
      setItemImageUrl3(null)
      setItemImage3(null)
      setItemImagePreview3(null)
      
      // Luego cargar las imágenes que existen
      if (editingButton.itemImage) {
        setItemImageUrl(editingButton.itemImage)
        setItemImage(editingButton.itemImage) // También establecer como string
        setItemImagePreview(editingButton.itemImage)
      }
      if (editingButton.itemImage2) {
        setItemImageUrl2(editingButton.itemImage2)
        setItemImage2(editingButton.itemImage2) // También establecer como string
        setItemImagePreview2(editingButton.itemImage2)
      }
      if (editingButton.itemImage3) {
        setItemImageUrl3(editingButton.itemImage3)
        setItemImage3(editingButton.itemImage3) // También establecer como string
        setItemImagePreview3(editingButton.itemImage3)
      }
    }
  }, [editingButton, language]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-completar con la wallet conectada solo si el campo está vacío y hay cuenta (solo en modo creación)
  useEffect(() => {
    if (account && recipientAddress === '' && !isEditing) {
      setRecipientAddress(account)
    }
  }, [account, isEditing, recipientAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Función para subir imagen automáticamente
  const uploadImage = async (imageFile) => {
    if (!imageFile) return null
    
    if (supabase) {
      try {
        // Generar nombre único para la imagen
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `payment-items/${fileName}`

        // Validar tamaño (máximo 5MB)
        if (imageFile.size > 5 * 1024 * 1024) {
          throw new Error(language === 'es' ? 'La imagen es demasiado grande. Máximo 5MB.' : 'Image is too large. Maximum 5MB.')
        }

        // Subir a Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-item-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          throw new Error(language === 'es' 
            ? 'Error al subir la imagen. Por favor, intenta de nuevo.' 
            : 'Error uploading image. Please try again.')
        }

        // Obtener URL pública de la imagen
        const { data: urlData } = supabase.storage
          .from('payment-item-images')
          .getPublicUrl(filePath)

        return urlData.publicUrl
      } catch (error) {
        console.error('Error procesando imagen:', error)
        throw error
      }
    } else {
      // Fallback: convertir a base64 si Supabase no está configurado
      const reader = new FileReader()
      return await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })
    }
  }

  // Manejar archivo (subir automáticamente si es File, usar URL si es string)
  const handleImageFile = async (file, imageIndex) => {
    if (!file) return

    // Mostrar preview inmediatamente
    const reader = new FileReader()
    reader.onloadend = () => {
      if (imageIndex === 1) {
        setItemImagePreview(reader.result)
        setItemImage(file)
      } else if (imageIndex === 2) {
        setItemImagePreview2(reader.result)
        setItemImage2(file)
      } else if (imageIndex === 3) {
        setItemImagePreview3(reader.result)
        setItemImage3(file)
      }
    }
    reader.readAsDataURL(file)

    // Subir automáticamente
    setIsUploading(true)
    try {
      const imageUrl = await uploadImage(file)
      if (imageIndex === 1) {
        setItemImageUrl(imageUrl)
        setItemImage(imageUrl) // Guardar URL en lugar de File
      } else if (imageIndex === 2) {
        setItemImageUrl2(imageUrl)
        setItemImage2(imageUrl)
      } else if (imageIndex === 3) {
        setItemImageUrl3(imageUrl)
        setItemImage3(imageUrl)
      }
    } catch (error) {
      alert(error.message || (language === 'es' ? 'Error al subir la imagen' : 'Error uploading image'))
      // Limpiar preview si falla
      if (imageIndex === 1) {
        setItemImagePreview(null)
        setItemImage(null)
      } else if (imageIndex === 2) {
        setItemImagePreview2(null)
        setItemImage2(null)
      } else if (imageIndex === 3) {
        setItemImagePreview3(null)
        setItemImage3(null)
      }
    } finally {
      setIsUploading(false)
    }
  }

  // Manejar múltiples archivos (drag and drop de varias imágenes)
  const handleMultipleFiles = async (files) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    setIsUploading(true)
    try {
      for (let i = 0; i < Math.min(imageFiles.length, 3); i++) {
        await handleImageFile(imageFiles[i], i + 1)
      }
    } finally {
      setIsUploading(false)
    }
  }

  // Handlers para drag and drop
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => ({ ...prev, [index]: true }))
  }

  const handleDragLeave = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => ({ ...prev, [index]: false }))
  }

  const handleDrop = async (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(prev => ({ ...prev, [index]: false }))

    const files = e.dataTransfer.files
    if (files.length > 0) {
      if (files.length === 1) {
        await handleImageFile(files[0], index)
      } else {
        // Múltiples archivos: distribuir en las 3 zonas
        await handleMultipleFiles(files)
      }
    }
  }

  // Eliminar imagen
  const removeImage = (index) => {
    if (index === 1) {
      setItemImage(null)
      setItemImagePreview(null)
      setItemImageUrl(null)
    } else if (index === 2) {
      setItemImage2(null)
      setItemImagePreview2(null)
      setItemImageUrl2(null)
    } else if (index === 3) {
      setItemImage3(null)
      setItemImagePreview3(null)
      setItemImageUrl3(null)
    }
  }

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

    if (itemDescription && itemDescription.length > 350) {
      alert(language === 'es' ? 'La descripción no puede tener más de 350 caracteres.' : 'Description cannot exceed 350 characters.')
      return
    }

    setIsGenerating(true)

    try {
      // Obtener URLs finales de las imágenes
      // Prioridad: itemImageUrl (ya subida) > itemImage (string URL) > itemImage (File, necesita subir)
      let finalImageUrl = null
      let finalImageUrl2 = null
      let finalImageUrl3 = null

      // Imagen 1
      if (itemImageUrl) {
        finalImageUrl = itemImageUrl
      } else if (typeof itemImage === 'string' && itemImage) {
        finalImageUrl = itemImage
      } else if (itemImage instanceof File) {
        finalImageUrl = await uploadImage(itemImage)
        setItemImageUrl(finalImageUrl)
        setItemImage(finalImageUrl)
      }

      // Imagen 2
      if (itemImageUrl2) {
        finalImageUrl2 = itemImageUrl2
      } else if (typeof itemImage2 === 'string' && itemImage2) {
        finalImageUrl2 = itemImage2
      } else if (itemImage2 instanceof File) {
        finalImageUrl2 = await uploadImage(itemImage2)
        setItemImageUrl2(finalImageUrl2)
        setItemImage2(finalImageUrl2)
      }

      // Imagen 3
      if (itemImageUrl3) {
        finalImageUrl3 = itemImageUrl3
      } else if (typeof itemImage3 === 'string' && itemImage3) {
        finalImageUrl3 = itemImage3
      } else if (itemImage3 instanceof File) {
        finalImageUrl3 = await uploadImage(itemImage3)
        setItemImageUrl3(finalImageUrl3)
        setItemImage3(finalImageUrl3)
      }

      const buttonData = {
        recipientAddress,
        amount,
        itemName,
        itemDescription,
        itemImage: finalImageUrl,
        itemImage2: finalImageUrl2,
        itemImage3: finalImageUrl3,
        buttonText,
        buttonColor,
        tokenAddress,
        paymentType
      }

      console.log('Button data to save:', {
        itemName,
        itemDescription: itemDescription.substring(0, 50) + '...',
        itemImage: finalImageUrl ? 'URL present' : 'null',
        itemImage2: finalImageUrl2 ? 'URL present' : 'null',
        itemImage3: finalImageUrl3 ? 'URL present' : 'null'
      })

      if (isEditing && onUpdate) {
        await onUpdate({ ...buttonData, shortId: editingButton.shortId })
      } else {
        await onGenerate(buttonData)
      }

      // Limpiar formulario solo si se generó correctamente y NO está en modo edición
      if (!isEditing) {
        clearForm()
      }
    } catch (error) {
      console.error('Error generando botón:', error)
      alert(language === 'es' ? 'Error al generar el botón. Por favor, intenta de nuevo.' : 'Error generating button. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Componente para zona de drop de imagen
  const ImageDropZone = ({ index, preview, url, onFileSelect, onRemove }) => {
    const dropZoneRef = index === 1 ? dropZone1Ref : index === 2 ? dropZone2Ref : dropZone3Ref
    const isDragging = dragOver[index]

    return (
      <div 
        ref={dropZoneRef}
        className={`image-drop-zone ${isDragging ? 'drag-over' : ''} ${preview ? 'has-image' : ''}`}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={(e) => handleDragLeave(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onClick={() => {
          if (!preview) {
            const input = document.getElementById(`itemImage${index === 1 ? '' : index}`)
            input?.click()
          }
        }}
      >
        <input
          type="file"
          id={`itemImage${index === 1 ? '' : index}`}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files[0]
            if (file) {
              handleImageFile(file, index)
            }
          }}
        />
        {preview ? (
          <div className="image-preview-wrapper">
            <img src={preview} alt={`Preview ${index}`} className="image-preview" />
            {isEditing && (
              <button
                type="button"
                className="image-remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(index)
                }}
                title={language === 'es' ? 'Eliminar imagen' : 'Remove image'}
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <div className="image-drop-placeholder">
            <span className="drop-icon">📷</span>
            <span className="drop-text">
              {language === 'es' 
                ? `Arrastra una imagen aquí o haz clic (${index === 1 ? 'Opcional' : 'Opcional'})`
                : `Drag an image here or click (${index === 1 ? 'Optional' : 'Optional'})`
              }
            </span>
          </div>
        )}
        {isUploading && !preview && (
          <div className="upload-indicator">
            {language === 'es' ? 'Subiendo...' : 'Uploading...'}
          </div>
        )}
      </div>
    )
  }

  // Manejar cancelación de edición
  const handleCancel = () => {
    clearForm()
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <section className="generator-section">
      <h2>
        {isEditing 
          ? (language === 'es' ? 'Editar Botón de Pago' : 'Edit Payment Button')
          : (language === 'es' ? 'Generar Botón de Pago' : 'Generate Payment Button')
        }
      </h2>
      {isEditing && onCancel && (
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-secondary"
          style={{ marginBottom: '1rem' }}
        >
          {language === 'es' ? 'Cancelar Edición' : 'Cancel Edit'}
        </button>
      )}
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
            disabled={isEditing} // No permitir editar destinatario
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
          <label>{language === 'es' ? 'Imágenes del Artículo (Opcional):' : 'Item Images (Optional):'}</label>
          <div className="images-grid">
            <ImageDropZone
              index={1}
              preview={itemImagePreview}
              url={itemImageUrl}
              onFileSelect={(file) => handleImageFile(file, 1)}
              onRemove={removeImage}
            />
            <ImageDropZone
              index={2}
              preview={itemImagePreview2}
              url={itemImageUrl2}
              onFileSelect={(file) => handleImageFile(file, 2)}
              onRemove={removeImage}
            />
            <ImageDropZone
              index={3}
              preview={itemImagePreview3}
              url={itemImageUrl3}
              onFileSelect={(file) => handleImageFile(file, 3)}
              onRemove={removeImage}
            />
          </div>
          <p className="form-hint">
            {language === 'es' 
              ? 'Arrastra una o varias imágenes aquí, o haz clic para seleccionar. Puedes eliminar imágenes en modo edición.'
              : 'Drag one or multiple images here, or click to select. You can remove images in edit mode.'
            }
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="itemDescription">
            {language === 'es' ? 'Descripción del Artículo o Servicio:' : 'Item or Service Description:'}
            <span className="character-count"> ({itemDescription.length}/350)</span>
          </label>
          <textarea
            id="itemDescription"
            value={itemDescription}
            onChange={(e) => {
              const value = e.target.value
              if (value.length <= 350) {
                setItemDescription(value)
              }
            }}
            placeholder={language === 'es' ? 'Describe tu artículo o servicio en detalle (máximo 350 caracteres)...' : 'Describe your item or service in detail (max 350 characters)...'}
            required
            className="form-input form-textarea"
            rows="4"
            maxLength={350}
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
          disabled={isGenerating || isUploading}
        >
          {isGenerating
            ? (isEditing 
                ? (language === 'es' ? 'Actualizando...' : 'Updating...')
                : (language === 'es' ? 'Generando...' : 'Generating...')
              )
            : (isEditing
                ? (language === 'es' ? 'Actualizar Botón' : 'Update Button')
                : (language === 'es' ? 'Generar Botón' : 'Generate Button')
              )
          }
        </button>
      </form>
    </section>
  )
}

export default PaymentButtonGenerator
