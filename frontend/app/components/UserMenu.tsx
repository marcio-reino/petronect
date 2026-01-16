'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/config/api'
import { APP_CONFIG, getGradientStyle } from '@/config/app.config'
import UserProfileModal from './UserProfileModal'
import PlanModal from './PlanModal'
import { useTheme } from '../contexts/ThemeContext'

interface UserData {
  name: string
  email: string
  role: string
  avatar?: string
  phone?: string
  createdAt?: string
  updatedAt?: string
}

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    // Buscar dados do usuário do backend
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

        if (!token) {
          console.error('Token não encontrado')
          setIsLoading(false)
          return
        }

        const response = await api.get('/users/profile')

        if (response.data.success && response.data.data) {
          const userData = response.data.data

          // Formatar datas com hora (formato do banco: 2025-12-14 13:37:14)
          const formatDateTime = (dateString: string) => {
            if (!dateString) return 'Não disponível'
            // Substituir espaço por 'T' para formato ISO se necessário
            const isoDate = dateString.includes('T') ? dateString : dateString.replace(' ', 'T')
            const date = new Date(isoDate)
            
            if (isNaN(date.getTime())) return 'Data inválida'
            
            return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }

          // Formatar telefone (00) 00000-0000
          const formatPhone = (phone: string) => {
            if (!phone) return undefined
            const cleaned = phone.replace(/\D/g, '')
            if (cleaned.length === 11) {
              return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
            }
            return phone
          }

          // Construir URL completa do avatar se existir
          const avatarUrl = userData.user_avatar
            ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${userData.user_avatar}`
            : undefined

          setUser({
            name: userData.user_name,
            email: userData.user_email,
            role: userData.role_name || 'Usuário',
            phone: formatPhone(userData.user_phone),
            avatar: avatarUrl,
            createdAt: formatDateTime(userData.user_date_insert),
            updatedAt: formatDateTime(userData.user_date_update || userData.user_date_insert)
          })
        } else {
          console.error('Erro ao buscar perfil do usuário')
          localStorage.removeItem('accessToken')
          sessionStorage.removeItem('accessToken')
          router.push('/')
        }
      } catch (error: any) {
        console.error('Erro ao buscar dados do usuário:', error)
        // Se for erro 401 (não autorizado), limpar tokens e redirecionar
        if (error?.response?.status === 401) {
          localStorage.removeItem('accessToken')
          sessionStorage.removeItem('accessToken')
          router.push('/')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserProfile()

    // Fechar menu ao clicar fora
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    localStorage.clear()
    sessionStorage.clear()
    router.push('/')
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  const handleSaveProfile = () => {
    // Recarregar dados do perfil do backend para garantir sincronização
    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/users/profile')

        if (response.data.success && response.data.data) {
          const userData = response.data.data

          const formatDateTime = (dateString: string) => {
            if (!dateString) return 'Não disponível'
            const isoDate = dateString.includes('T') ? dateString : dateString.replace(' ', 'T')
            const date = new Date(isoDate)
            if (isNaN(date.getTime())) return 'Data inválida'
            return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          }

          const formatPhone = (phone: string) => {
            if (!phone) return undefined
            const cleaned = phone.replace(/\D/g, '')
            if (cleaned.length === 11) {
              return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
            }
            return phone
          }

          const avatarUrl = userData.user_avatar
            ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${userData.user_avatar}`
            : undefined

          setUser({
            name: userData.user_name,
            email: userData.user_email,
            role: userData.role_name || 'Usuário',
            phone: formatPhone(userData.user_phone),
            avatar: avatarUrl,
            createdAt: formatDateTime(userData.user_date_insert),
            updatedAt: formatDateTime(userData.user_date_update || userData.user_date_insert)
          })
        }
      } catch (error) {
        console.error('Erro ao atualizar dados do usuário:', error)
      }
    }

    fetchUserProfile()
  }

  // Mostrar loading enquanto carrega os dados
  if (isLoading || !user) {
    return (
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
        <div className="hidden md:block">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-1"></div>
          <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Botão do Menu */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333333] transition-all duration-200"
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 flex items-center justify-center text-white font-semibold text-sm"
          style={{
            ...getGradientStyle(APP_CONFIG.dashboard.userAvatar.background),
            borderRadius: APP_CONFIG.dashboard.userAvatar.borderRadius,
            color: APP_CONFIG.dashboard.userAvatar.text,
          }}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <i className="fas fa-user text-lg"></i>
          )}
        </div>

        {/* Nome e Cargo */}
        <div className="text-left hidden md:block">
          <p className="text-sm font-semibold text-gray-800 dark:text-[#eeeeee]">{user.name}</p>
          <p className="text-xs text-gray-500 dark:text-[#aaaaaa]">{user.role}</p>
        </div>

        {/* Ícone Seta */}
        <i
          className={`fas fa-chevron-down text-gray-400 text-xs transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        ></i>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg py-2 z-50 fade-in bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#444444] shadow-lg"
        >
          {/* Header com informações do usuário */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#444444]">
            <p className="text-sm font-semibold text-gray-800 dark:text-[#eeeeee]">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-[#aaaaaa]">{user.email}</p>
          </div>

          {/* Menu Items */}
          <button
            onClick={() => {
              setIsOpen(false)
              setIsProfileModalOpen(true)
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-[#dddddd] hover:bg-gray-50 dark:hover:bg-[#333333] transition"
          >
            <i className="fas fa-user w-4"></i>
            {APP_CONFIG.messages.userMenu.profile}
          </button>

          <button
            onClick={() => {
              setIsOpen(false)
              setIsPlanModalOpen(true)
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-[#dddddd] hover:bg-gray-50 dark:hover:bg-[#333333] transition"
          >
            <i className="fas fa-file-contract w-4"></i>
            {APP_CONFIG.messages.userMenu.plan}
          </button>

          {/* Modo Escuro Switch */}
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className={`fas ${theme === 'dark' ? 'fa-moon' : 'fa-sun'} w-4 text-gray-700 dark:text-[#dddddd]`}></i>
                <span className="text-sm text-gray-700 dark:text-[#dddddd]">Modo Escuro</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleTheme()
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                  theme === 'dark' ? 'bg-teal-600' : 'bg-gray-300'
                }`}
                aria-label="Toggle dark mode"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <hr className="my-2 border-gray-200 dark:border-[#444444]" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <i className="fas fa-sign-out-alt w-4"></i>
            {APP_CONFIG.messages.userMenu.logout}
          </button>
        </div>
      )}

      {/* Modal de Perfil */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onSave={handleSaveProfile}
      />

      {/* Modal de Plano */}
      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
      />
    </div>
  )
}
