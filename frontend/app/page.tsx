'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { APP_CONFIG, getGradientStyle } from '@/config/app.config'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    // Forçar modo escuro no login
    document.documentElement.classList.add('dark')

    // Carregar preferência de "Continuar logado" do localStorage
    const savedRememberMe = localStorage.getItem('rememberMe')
    if (savedRememberMe === 'true') {
      setFormData(prev => ({ ...prev, rememberMe: true }))
    }
  }, [])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao fazer login')
      }

      // Armazenar tokens
      if (formData.rememberMe) {
        localStorage.setItem('accessToken', data.data.accessToken)
        localStorage.setItem('refreshToken', data.data.refreshToken)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        localStorage.setItem('userId', data.data.user.user_id.toString())
      } else {
        sessionStorage.setItem('accessToken', data.data.accessToken)
        sessionStorage.setItem('refreshToken', data.data.refreshToken)
        sessionStorage.setItem('user', JSON.stringify(data.data.user))
        sessionStorage.setItem('userId', data.data.user.user_id.toString())
      }

      // Redirecionar para dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.')
      // Adicionar shake animation ao formulário
      const form = document.getElementById('loginForm')
      form?.classList.add('shake')
      setTimeout(() => form?.classList.remove('shake'), 500)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Simulação - implementar endpoint real no backend
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setResetSuccess(true)
      setTimeout(() => {
        setShowForgotPassword(false)
        setResetSuccess(false)
        setResetEmail('')
      }, 3000)
    } catch (err) {
      setError('Erro ao enviar email de recuperação')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#00BFA5] to-[#00897B] dark:from-[#1a1a1a] dark:to-[#2a2a2a]"
    >
      <div className="w-full max-w-md fade-in">
        {/* Card de Login */}
        <div
          className="p-8 rounded-2xl shadow-2xl bg-white/95 dark:bg-[#2a2a2a] backdrop-blur-lg"
        >
          {/* Logo e Título */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              {APP_CONFIG.branding.loginLogo.type === 'icon' ? (
                <i className={`fas ${APP_CONFIG.branding.loginLogo.icon} text-5xl`} style={{ color: APP_CONFIG.login.logoIcon.color }}></i>
              ) : (
                <img src={APP_CONFIG.branding.loginLogo.image} alt="Logo" className="w-72 h-auto" />
              )}
            </div>
            <p className="text-gray-600 dark:text-[#aaaaaa]">Agentes de Automação Petronect</p>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Formulário */}
          <form id="loginForm" onSubmit={handleSubmit} className="space-y-6">
            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="seu@email.com"
                  className="input-field"
                  disabled={isLoading}
                />
                <i className="fas fa-user absolute left-4 top-4 text-gray-400 dark:text-[#888888]"></i>
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="••••••••"
                  className="input-field pr-11"
                  disabled={isLoading}
                />
                <i className="fas fa-lock absolute left-4 top-4 text-gray-400 dark:text-[#888888]"></i>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-gray-400 dark:text-[#888888] hover:text-gray-600 dark:hover:text-[#cccccc] transition"
                  disabled={isLoading}
                >
                  <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
                </button>
              </div>
            </div>

            {/* Opções */}
            <div className="flex items-center justify-between">
              {/* Lembrar-me - Toggle Switch */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const newValue = !formData.rememberMe
                    setFormData({ ...formData, rememberMe: newValue })
                    localStorage.setItem('rememberMe', newValue.toString())
                  }}
                  disabled={isLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                    formData.rememberMe
                      ? 'bg-teal-600'
                      : 'bg-gray-300 dark:bg-[#555555]'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      formData.rememberMe ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700 dark:text-[#cccccc]">
                  Continuar logado
                </span>
              </div>

              {/* Esqueci a senha */}
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm font-medium transition text-teal-600 hover:text-teal-700"
                disabled={isLoading}
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Botão de Login */}
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Entrando...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-2"></i>
                  Entrar
                </>
              )}
            </button>
          </form>

          {/* Aviso sobre automação */}
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-[#888888]">
            Este sistema é uma automação de acesso por contas devidamente registradas no Portal Petronect
          </p>

        </div>

        {/* Copyright */}
        <div className="text-center mt-6">
          <p className="text-white text-sm opacity-80">
            <i className="fas fa-copyright mr-1"></i>
            2026 {process.env.NEXT_PUBLIC_SYSTEM_NAME}. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Modal de Recuperação de Senha */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl p-8 max-w-md w-full fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee] mb-2">Recuperar Senha</h2>
              <p className="text-gray-600 dark:text-[#aaaaaa] text-sm">
                Digite seu email para receber instruções de recuperação
              </p>
            </div>

            {/* Mensagem de Sucesso */}
            {resetSuccess && (
              <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg fade-in">
                <div className="flex items-center">
                  <i className="fas fa-check-circle text-green-500 mr-3"></i>
                  <p className="text-green-700 text-sm">Email de recuperação enviado com sucesso!</p>
                </div>
              </div>
            )}

            <form onSubmit={handleForgotPassword}>
              <div className="mb-6">
                <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
                  <i className="fas fa-envelope mr-2 text-gray-400 dark:text-[#888888]"></i>
                  Email
                </label>
                <input
                  type="email"
                  id="resetEmail"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="input-field"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setResetEmail('')
                    setResetSuccess(false)
                  }}
                  className="btn-secondary flex-1"
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane mr-2"></i>
                      Enviar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
