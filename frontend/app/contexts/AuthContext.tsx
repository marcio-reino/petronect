'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  user_id: number
  user_key: string
  user_name: string
  user_email: string
  user_username: string
  user_avatar?: string
  role_name: string
  role_permissions: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const isAuthenticated = !!user

  useEffect(() => {
    // Verificar se há um usuário logado ao carregar a página
    const checkAuth = () => {
      const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
      const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      if (storedUser && accessToken) {
        setUser(JSON.parse(storedUser))
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao fazer login')
    }

    const storage = rememberMe ? localStorage : sessionStorage

    storage.setItem('accessToken', data.data.accessToken)
    storage.setItem('refreshToken', data.data.refreshToken)
    storage.setItem('user', JSON.stringify(data.data.user))

    setUser(data.data.user)
  }

  const logout = async () => {
    try {
      const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      if (accessToken) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        })
      }
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    } finally {
      // Limpar dados locais
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      sessionStorage.removeItem('accessToken')
      sessionStorage.removeItem('refreshToken')
      sessionStorage.removeItem('user')

      setUser(null)
      router.push('/')
    }
  }

  const refreshToken = async () => {
    const refresh = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')

    if (!refresh) {
      throw new Error('No refresh token available')
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: refresh }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage
    storage.setItem('accessToken', data.data.accessToken)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
