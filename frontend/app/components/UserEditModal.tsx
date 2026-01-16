'use client'

import { useState, useEffect, useRef } from 'react'
import api from '@/config/api'
import { APP_CONFIG } from '@/config/app.config'
import Toast from './Toast'

interface UserData {
  user_id?: number
  name: string
  email: string
  role: string
  roleId?: number
  phone?: string
  avatar?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

interface Role {
  role_id: number
  role_name: string
  role_description: string
}

interface UserEditModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserData
  userId: number
  onSave?: () => void
}

export default function UserEditModal({ isOpen, onClose, user, userId, onSave }: UserEditModalProps) {
  const [formData, setFormData] = useState<UserData>(user)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  })
  const hasLoadedRef = useRef(false)

  // Sincronizar formData apenas quando o modal abre pela primeira vez ou quando abre com um usuário diferente
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      setFormData(user)
      hasLoadedRef.current = true
    }
  }, [user, isOpen])

  // Resetar a flag quando o modal fecha
  useEffect(() => {
    if (!isOpen) {
      hasLoadedRef.current = false
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
        }
      } catch (error) {
        console.error('Erro ao buscar roles:', error)
      }
    }

    if (isOpen) {
      fetchRoles()
    }
  }, [isOpen])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Validações básicas
      if (!formData.name || !formData.email || !formData.role) {
        throw new Error('Nome, email e função são obrigatórios')
      }

      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Buscar role_id pelo nome do role
      const selectedRole = roles.find(r => r.role_name === formData.role)
      const idgroup = selectedRole?.role_id

      // Atualizar usuário no backend
      const response = await api.put(
        `/users/${userId}`,
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone?.replace(/\D/g, ''), // Remove formatação - salva em user_phone
          idgroup: idgroup,
          status: formData.status
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.data.success) {
        // Mostrar toast de sucesso
        showToast('Usuário atualizado com sucesso!', 'success')

        // Chamar callback opcional para atualizar lista
        if (onSave) {
          onSave()
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Erro ao atualizar usuário', 'error')
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
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">Editar Usuário</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
            title="Fechar"
          >
            <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
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

            {/* Data de Cadastro */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-calendar-plus mr-2 text-gray-400 dark:text-[#888888]"></i>
                Data de Cadastro
              </label>
              <input
                type="text"
                value={formData.createdAt || 'Não disponível'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-gray-50 dark:bg-[#333333] text-gray-600 dark:text-[#aaaaaa]"
                disabled
              />
            </div>

            {/* Última Atualização */}
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                <i className="fas fa-calendar-check mr-2 text-gray-400 dark:text-[#888888]"></i>
                Última Atualização
              </label>
              <input
                type="text"
                value={formData.updatedAt || 'Não disponível'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg bg-gray-50 dark:bg-[#333333] text-gray-600 dark:text-[#aaaaaa]"
                disabled
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
                  Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}
