'use client'

import { useState } from 'react'
import axios from 'axios'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface RoleCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function RoleCreateModal({ isOpen, onClose, onSave }: RoleCreateModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validações básicas
      if (!formData.name || !formData.description) {
        throw new Error('Nome e descrição são obrigatórios')
      }

      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Criar cargo no backend
      const response = await axios.post(
        `${API_DOMAIN}/users/roles`,
        {
          name: formData.name,
          description: formData.description
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.data.success) {
        setSuccess(true)

        setTimeout(() => {
          setSuccess(false)
          setFormData({
            name: '',
            description: ''
          })
          onSave()
          onClose()
        }, 1500)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao criar cargo')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">Novo Cargo</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
          >
            <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Mensagem de Sucesso */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-3"></i>
                <p className="text-green-700 dark:text-green-400 text-sm">Cargo criado com sucesso!</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-4 mb-4">
            {/* Nome do Cargo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-tag mr-2 text-gray-400 dark:text-[#888888]"></i>
                Nome do Cargo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
                placeholder="Ex: Administrador, Gestor, Analista"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-align-left mr-2 text-gray-400 dark:text-[#888888]"></i>
                Descrição *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                required
                disabled={isLoading}
                rows={4}
                placeholder="Descreva as responsabilidades e funções deste cargo..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-gray-200 dark:border-[#444444]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-all duration-200"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Criando...
                </>
              ) : (
                'Criar Cargo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
