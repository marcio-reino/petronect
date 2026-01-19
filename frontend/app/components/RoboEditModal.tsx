'use client'

import { useState, useEffect } from 'react'
import api from '@/config/api'
import Toast from './Toast'
import InfoBadge from './InfoBadge'

interface RoboData {
  robo_id?: number
  robo_nome?: string
  robo_dec?: string
  robo_tipo?: number
  robo_user: string
  robo_senha: string
  robo_status: number
  robo_velocidade: number
  robo_data: number
  robo_ordemop: number
  robo_datainiciofim: number
  robo_tempo?: number
}

interface RoboEditModalProps {
  isOpen: boolean
  onClose: () => void
  robo: RoboData | null
  onSave?: () => void
}

export default function RoboEditModal({ isOpen, onClose, robo, onSave }: RoboEditModalProps) {
  const isEditMode = !!robo?.robo_id

  const [formData, setFormData] = useState<RoboData>({
    robo_user: '',
    robo_senha: '',
    robo_status: 0,
    robo_velocidade: 0,
    robo_data: 1,
    robo_ordemop: 1,
    robo_datainiciofim: 0,
    robo_tempo: 10
  })

  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  })

  useEffect(() => {
    if (isOpen && robo) {
      setFormData({
        robo_id: robo.robo_id,
        robo_nome: robo.robo_nome,
        robo_dec: robo.robo_dec,
        robo_tipo: robo.robo_tipo,
        robo_user: robo.robo_user || '',
        robo_senha: robo.robo_senha || '',
        robo_status: robo.robo_status ?? 1,
        robo_velocidade: robo.robo_velocidade ?? 0,
        robo_data: robo.robo_data ?? 1,
        robo_ordemop: robo.robo_ordemop ?? 1,
        robo_datainiciofim: robo.robo_datainiciofim ?? 0,
        robo_tempo: robo.robo_tempo ?? 10
      })
    } else if (isOpen && !robo) {
      // Reset para novo agente
      setFormData({
        robo_nome: '',
        robo_dec: '',
        robo_tipo: 0,
        robo_user: '',
        robo_senha: '',
        robo_status: 0,
        robo_velocidade: 0,
        robo_data: 1,
        robo_ordemop: 1,
        robo_datainiciofim: 0,
        robo_tempo: 10
      })
    }
  }, [isOpen, robo])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      const payload = {
        nome: formData.robo_nome,
        user: formData.robo_user,
        senha: formData.robo_senha,
        status: formData.robo_status,
        velocidade: formData.robo_velocidade,
        data: formData.robo_data,
        ordemop: formData.robo_ordemop,
        datainiciofim: formData.robo_datainiciofim,
        tempo: formData.robo_tempo
      }

      let response
      if (isEditMode) {
        response = await api.put(
          `/robos/${formData.robo_id}`,
          payload,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
      } else {
        response = await api.post(
          `/robos`,
          {
            ...payload,
            nome: formData.robo_nome || 'Novo Agente',
            descricao: formData.robo_dec || '',
            tipo: formData.robo_tipo ?? 0
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
      }

      if (response.data.success) {
        showToast(isEditMode ? 'Agente atualizado com sucesso!' : 'Agente criado com sucesso!', 'success')
        if (onSave) {
          onSave()
        }
        // Fechar modal e resetar form após cadastro de novo agente
        if (!isEditMode) {
          setTimeout(() => {
            setFormData({
              robo_nome: '',
              robo_dec: '',
              robo_tipo: 0,
              robo_user: '',
              robo_senha: '',
              robo_status: 0,
              robo_velocidade: 0,
              robo_data: 1,
              robo_ordemop: 1,
              robo_datainiciofim: 0,
              robo_tempo: 10
            })
            onClose()
          }, 1500)
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || err.message || 'Erro ao salvar agente', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: keyof RoboData, value: string | number) => {
    setFormData({ ...formData, [field]: value })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in scrollbar-gray">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
            {isEditMode ? 'Editar Agente' : 'Novo Agente'}
          </h2>
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
          {/* Informações do Agente (apenas em edição) */}
          {isEditMode && (
            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center">
                  <i className="fas fa-robot text-white"></i>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-[#eeeeee]">{formData.robo_nome}</p>
                  <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">{formData.robo_dec}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  formData.robo_tipo === 0
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                }`}>
                  {formData.robo_tipo === 0 ? 'OP' : 'RT'}
                </span>
              </div>
            </div>
          )}

          {/* Campos para novo agente */}
          {!isEditMode && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Nome do Agente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                  Nome do Agente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.robo_nome || ''}
                  onChange={(e) => handleChange('robo_nome', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                  placeholder="Nome do agente"
                  required
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formData.robo_dec || ''}
                  onChange={(e) => handleChange('robo_dec', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                  placeholder="Descrição do agente"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.robo_tipo ?? 0}
                  onChange={(e) => handleChange('robo_tipo', Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                >
                  <option value={0}>OP - Oportunidades</option>
                  <option value={1}>RT - Resgate</option>
                </select>
              </div>
            </div>
          )}

          {/* Usuário e Senha na mesma linha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Usuário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                Usuário
              </label>
              <input
                type="text"
                value={formData.robo_user}
                onChange={(e) => handleChange('robo_user', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
                placeholder="PROCUREMENT"
              />
            </div>

            {/* Senha de acesso */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                Senha de acesso
              </label>
              <input
                type="text"
                value={formData.robo_senha}
                onChange={(e) => handleChange('robo_senha', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
                placeholder="********"
              />
            </div>
          </div>

          {/* Outros campos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Velocidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                Velocidade
              </label>
              <select
                value={formData.robo_velocidade}
                onChange={(e) => handleChange('robo_velocidade', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
              >
                <option value={0}>Rápido</option>
                <option value={1}>Normal</option>
                <option value={2}>Lento</option>
              </select>
            </div>

            {/* Data atuação */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                Data atuação
              </label>
              <select
                value={formData.robo_data}
                onChange={(e) => handleChange('robo_data', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
              >
                <option value={0}>Hoje</option>
                <option value={1}>Ontem</option>
                <option value={2}>2 dias atrás</option>
                <option value={3}>3 dias atrás</option>
                <option value={4}>4 dias atrás</option>
                <option value={5}>5 dias atrás</option>
                <option value={6}>6 dias atrás</option>
                <option value={7}>7 dias atrás</option>
                <option value={8}>8 dias atrás</option>
                <option value={9}>9 dias atrás</option>
                <option value={10}>10 dias atrás</option>
                <option value={11}>11 dias atrás</option>
                <option value={12}>12 dias atrás</option>
                <option value={13}>13 dias atrás</option>
                <option value={14}>14 dias atrás</option>
                <option value={15}>15 dias atrás</option>
              </select>
            </div>

            {/* Ordem OP */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                Ordem OP
                <InfoBadge
                  text="Ordem de listagem das oportunidades no Petronect. Isso evita que agentes trabalhem no mesmo dia verificando oportunidades iguais."
                  position="top"
                />
              </label>
              <select
                value={formData.robo_ordemop}
                onChange={(e) => handleChange('robo_ordemop', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
              >
                <option value={1}>Decrescente</option>
                <option value={0}>Crescente</option>
              </select>
            </div>

            {/* Tipo data de resgate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                Tipo data de resgate
              </label>
              <select
                value={formData.robo_datainiciofim}
                onChange={(e) => handleChange('robo_datainiciofim', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                disabled={isLoading}
              >
                <option value={0}>Data de início</option>
                <option value={1}>Data de fim</option>
              </select>
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
