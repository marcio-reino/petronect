'use client'

import React, { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (croppedImage: File) => void
  image: string | null
  aspectRatio?: number
  circularCrop?: boolean
  outputSize?: { width: number; height: number }
  fileName?: string
  outputFormat?: 'image/jpeg' | 'image/png'
}

export default function ImageCropModal({
  isOpen,
  onClose,
  onSave,
  image,
  aspectRatio,
  circularCrop = false,
  outputSize,
  fileName = 'image.jpg',
  outputFormat = 'image/jpeg'
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: 'px',
    width: outputSize?.width || 220,
    height: outputSize?.height || 100,
    x: 50,
    y: 50
  })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [scale, setScale] = useState(1)
  const imgRef = useRef<HTMLImageElement>(null)

  // Função para manter o tamanho fixo do crop
  const handleCropChange = (newCrop: Crop) => {
    // Manter sempre o tamanho fixo, permitindo apenas movimento
    setCrop({
      ...newCrop,
      width: outputSize?.width || 220,
      height: outputSize?.height || 100
    })
  }

  const getCroppedImg = useCallback(
    async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement('canvas')
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('No 2d context')
      }

      // Se outputSize foi definido, usar dimensões fixas de saída
      // Caso contrário, usar as dimensões do crop
      const finalWidth = outputSize ? outputSize.width : crop.width * scaleX
      const finalHeight = outputSize ? outputSize.height : crop.height * scaleY

      canvas.width = finalWidth
      canvas.height = finalHeight

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Preencher com fundo branco
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        finalWidth,
        finalHeight
      )

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas is empty'))
              return
            }
            resolve(blob)
          },
          outputFormat,
          0.95
        )
      })
    },
    [outputSize, outputFormat]
  )

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) return

    setIsProcessing(true)
    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop)
      const croppedImageFile = new File([croppedImageBlob], fileName, {
        type: outputFormat
      })

      onSave(croppedImageFile)
      onClose()
    } catch (error) {
      console.error('Erro ao processar imagem:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen || !image) return null

  return (
    <div className="modal-overlay" style={{ zIndex: 70 }}>
      <div className="modal-content" style={{ maxWidth: '48rem' }}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <i className="fas fa-crop-alt mr-2 text-teal-600"></i>
            Ajustar Imagem
          </h2>
          <button
            onClick={onClose}
            className="modal-close"
            disabled={isProcessing}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Crop Area */}
        <div className="p-6">
          {/* Zoom Controls */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-[#cccccc]">
              <i className="fas fa-search-plus mr-2"></i>
              Zoom:
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 dark:text-[#aaaaaa] w-12 text-right">
              {Math.round(scale * 100)}%
            </span>
          </div>

          <div className="mb-4 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-4 flex items-center justify-center min-h-[350px] overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={handleCropChange}
              onComplete={(c) => setCompletedCrop(c)}
              locked={false}
            >
              <img
                ref={imgRef}
                src={image}
                alt="Crop preview"
                style={{
                  width: `${scale * 100}%`,
                  height: 'auto'
                }}
              />
            </ReactCrop>
          </div>

          {/* Instructions */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-blue-500 mt-0.5 mr-2"></i>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Use o controle de zoom para ajustar o tamanho e arraste as bordas para selecionar a área da imagem.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="modal-btn-secondary"
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isProcessing || !completedCrop}
          >
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Processando...
              </>
            ) : (
              <>
                <i className="fas fa-check"></i>
                Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
