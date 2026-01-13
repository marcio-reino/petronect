'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { APP_CONFIG } from '@/config/app.config'
import UserChangePasswordModal from './UserChangePasswordModal'
import ImageCropModal from './ImageCropModal'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface UserData {
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

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserData
  onSave: (userData: UserData) => void
}

export default function UserProfileModal({ isOpen, onClose, user, onSave }: UserProfileModalProps) {
  const [formData, setFormData] = useState<UserData>(user)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFormData(user)
  }, [user])

  // Buscar roles do backend
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
        const response = await axios.get(`${API_DOMAIN}/users/roles`, {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Validações básicas
      if (!formData.name || !formData.email) {
        throw new Error('Nome e email são obrigatórios')
      }

      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Atualizar perfil no backend
      const response = await axios.put(
        `${API_DOMAIN}/users/profile`,
        {
          name: formData.name,
          email: formData.email,
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
        // Atualizar dados no storage
        const storage = localStorage.getItem('user') ? localStorage : sessionStorage
        const updatedUserData = {
          ...response.data.data,
          user_cellphone: formData.phone // Manter formatado
        }
        storage.setItem('user', JSON.stringify(updatedUserData))

        onSave(formData)
        setSuccess(true)

        setTimeout(() => {
          setSuccess(false)
          onClose()
        }, 1500)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao salvar dados')
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        setError('Por favor, selecione apenas imagens')
        return
      }

      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('A imagem deve ter no máximo 5MB')
        return
      }

      // Ler arquivo e abrir modal de crop
      const reader = new FileReader()
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string)
        setIsCropModalOpen(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveCroppedImage = async (croppedFile: File) => {
    setIsUploadingAvatar(true)
    setError('')

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Criar FormData para enviar o arquivo
      const uploadFormData = new FormData()
      uploadFormData.append('avatar', croppedFile)

      // Fazer upload
      const response = await axios.post(
        `${API_DOMAIN}/users/profile/avatar`,
        uploadFormData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      if (response.data.success) {
        // Atualizar avatar no estado
        const avatarUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${response.data.data.avatar}`
        setFormData(prev => ({ ...prev, avatar: avatarUrl }))

        // Atualizar no storage
        const storage = localStorage.getItem('user') ? localStorage : sessionStorage
        const userData = JSON.parse(storage.getItem('user') || '{}')
        userData.user_avatar = response.data.data.avatar
        storage.setItem('user', JSON.stringify(userData))

        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao fazer upload da foto')
    } finally {
      setIsUploadingAvatar(false)
      setIsCropModalOpen(false)
      setSelectedImage(null)
      // Limpar input file
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">Meu Perfil</h2>
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
                <p className="text-green-700 dark:text-green-400 text-sm">Dados salvos com sucesso!</p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {/* Avatar e Nome */}
            <div className="md:col-span-2 flex gap-6 items-start">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2 relative group cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #00BFA5, #00897B)',
                  }}
                  onClick={handleAvatarClick}
                >
                  {formData.avatar ? (
                    <img
                      src={formData.avatar}
                      alt={formData.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <i className="fas fa-user text-2xl"></i>
                  )}
                  {/* Overlay ao passar o mouse */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fas fa-camera text-white text-xl"></i>
                  </div>
                  {/* Indicador de loading */}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black bg-opacity-75 rounded-full flex items-center justify-center">
                      <i className="fas fa-spinner fa-spin text-white text-xl"></i>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="text-xs font-medium transition hover:opacity-80 text-teal-600"
                  disabled={isUploadingAvatar}
                >
                  <i className="fas fa-camera mr-1"></i>
                  {isUploadingAvatar ? 'Enviando...' : 'Alterar foto'}
                </button>
              </div>

              {/* Nome Completo */}
              <div className="flex-1">
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
                Cargo/Função
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
              >
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_name}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            {/* status moved next to Última Atualização */}

            {/* Data de Cadastro */}
            <div>
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
            {/* Status (moved beside Última Atualização) */}
            <div className="md:col-span-1">
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

          {/* Seção de Segurança */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-[#eeeeee] mb-2">
              <i className="fas fa-shield-alt mr-2"></i>
              Segurança
            </h3>
            <button
              type="button"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="text-sm font-medium transition hover:opacity-80"
              style={{ color: APP_CONFIG.widgets.colors.primary }}
            >
              <i className="fas fa-key mr-2"></i>
              Alterar senha
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-all duration-200"
              disabled={isLoading}
            >
              Fechar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white font-medium rounded-lg transition-all duration-200 hover:opacity-90 bg-teal-600 hover:bg-teal-700"
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

      {/* Modal de Alterar Senha */}
      <UserChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {/* Modal de Crop de Imagem */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false)
          setSelectedImage(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
        onSave={handleSaveCroppedImage}
        image={selectedImage}
        aspectRatio={1}
        circularCrop={true}
      />
    </div>
  )
}
