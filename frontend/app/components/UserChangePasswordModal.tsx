'use client'

import { useState } from 'react'
import api from '@/config/api'
import { APP_CONFIG } from '@/config/app.config'

interface UserChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function UserChangePasswordModal({ isOpen, onClose }: UserChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos os campos são obrigatórios')
      return
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da senha atual')
      return
    }

    setIsLoading(true)

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      await api.put(
        `/users/change-password`,
        {
          currentPassword,
          newPassword
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      setSuccess(true)
      
      // Limpar campos
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Fechar modal após 2 segundos
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)

    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao alterar senha')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setSuccess(false)
      onClose()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#444444] flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
            Alterar Senha
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#444444] flex items-center justify-center transition"
            disabled={isLoading}
          >
            <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Mensagem de Sucesso */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-3"></i>
                <p className="text-green-700 dark:text-green-400 text-sm">Senha alterada com sucesso!</p>
              </div>
            </div>
          )}

          {/* Senha Atual */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              <i className="fas fa-lock mr-2 text-gray-400"></i>
              Senha Atual *
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-[#444444] dark:bg-[#333333] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="Digite sua senha atual"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#cccccc]"
                tabIndex={-1}
              >
                <i className={`fas ${showCurrentPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Nova Senha */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              <i className="fas fa-key mr-2 text-gray-400"></i>
              Nova Senha *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-[#444444] dark:bg-[#333333] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="Digite a nova senha"
                disabled={isLoading}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#cccccc]"
                tabIndex={-1}
              >
                <i className={`fas ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#888888] mt-1">
              Mínimo de 6 caracteres
            </p>
          </div>

          {/* Repetir Nova Senha */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              <i className="fas fa-check-double mr-2 text-gray-400"></i>
              Repetir Nova Senha *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onPaste={handlePaste}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-[#444444] dark:bg-[#333333] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                placeholder="Digite a nova senha novamente"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-[#cccccc]"
                tabIndex={-1}
              >
                <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#888888] mt-1">
              <i className="fas fa-info-circle mr-1"></i>
              Colar não permitido neste campo
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-gray-200 dark:border-[#444444]">
            <button
              type="button"
              onClick={handleClose}
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
                  Alterando...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>
                  Alterar Senha
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
