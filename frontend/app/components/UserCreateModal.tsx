'use client'

import { useState, useEffect } from 'react'
import api from '@/config/api'
import { APP_CONFIG } from '@/config/app.config'

interface UserData {
  name: string
  email: string
  role: string
  roleId?: number
  phone?: string
  avatar?: string
  status?: string
}

interface Role {
  role_id: number
  role_name: string
  role_description: string
}

interface UserCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userData: UserData) => void
}

export default function UserCreateModal({ isOpen, onClose, onSave }: UserCreateModalProps) {
  const [formData, setFormData] = useState<UserData>({
    name: '',
    email: '',
    role: '',
    phone: undefined,
    avatar: undefined,
    status: 'active'
  })
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        email: '',
        role: '',
        phone: undefined,
        avatar: undefined,
        status: 'active'
      })
      setError('')
      setSuccess(false)
    }
  }, [isOpen])

  // Buscar roles do backend
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
        const response = await api.get(`/users/roles`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.data.success) {
          setRoles(response.data.data)
          // Define o primeiro role como padrão se existir
          if (response.data.data.length > 0 && !formData.role) {
            setFormData(prev => ({ ...prev, role: response.data.data[0].role_name }))
          }
        }
      } catch (error) {
        console.error('Erro ao buscar roles:', error)
      }
    }

    if (isOpen) {
      fetchRoles()
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validações básicas
      if (!formData.name || !formData.email || !formData.role) {
        throw new Error('Nome, email e função são obrigatórios')
      }

      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Criar usuário no backend
      const response = await api.post(
        `/users`,
        {
          name: formData.name,
          email: formData.email,
          password: '123456', // Senha padrão definida no backend
          cellphone: formData.phone?.replace(/\D/g, ''), // Remove formatação
          role: formData.role,
          status: formData.status
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.data.success) {
        onSave(formData)
        setSuccess(true)

        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 1500)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao criar usuário')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: keyof UserData, value: string | number) => {
    setFormData({ ...formData, [field]: value })
  }

  const formatPhone = (value: string) => {
    // Remove tudo que não é número
    const cleaned = value.replace(/\D/g, '')

    // Aplica a máscara (00) 00000-0000
    if (cleaned.length <= 2) {
      return cleaned
    } else if (cleaned.length <= 7) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`
    } else if (cleaned.length <= 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`
    }
    // Limita a 11 dígitos
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value)
    handleChange('phone', formatted)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in scrollbar-gray">
        {/* Header */}
        <div
          className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between"
        >
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">Novo Usuário</h2>
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
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Mensagem de Sucesso */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-3"></i>
                <p className="text-green-700 text-sm">Usuário criado com sucesso!</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Nome Completo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-user mr-2 text-gray-400 dark:text-[#888888]"></i>
                Nome Completo *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
                placeholder="Digite o nome completo"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-envelope mr-2 text-gray-400 dark:text-[#888888]"></i>
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                required
                disabled={isLoading}
                placeholder="exemplo@email.com"
              />
            </div>

            {/* Celular */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-mobile-alt mr-2 text-gray-400 dark:text-[#888888]"></i>
                Celular
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="(00) 00000-0000"
                maxLength={15}
                disabled={isLoading}
              />
            </div>

            {/* Cargo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-briefcase mr-2 text-gray-400 dark:text-[#888888]"></i>
                Cargo/Função *
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
                required
              >
                <option value="">Selecione um cargo</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_name}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-toggle-on mr-2 text-gray-400 dark:text-[#888888]"></i>
                Status
              </label>
              <select
                value={formData.status ?? 'active'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          {/* Informação sobre senha padrão */}
          <div className="mb-4 p-3 bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-500 rounded-lg">
            <div className="flex items-start">
              <i className="fas fa-info-circle text-teal-500 mt-0.5 mr-3"></i>
              <div>
                <p className="text-sm text-teal-700 dark:text-teal-400 font-medium">Senha Padrão</p>
                <p className="text-xs text-teal-600 dark:text-teal-300 mt-1">
                  O usuário será criado com a senha padrão: <span className="font-mono font-semibold">123456</span>
                </p>
              </div>
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
                'Criar Usuário'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
