'use client'

import { useState, useEffect } from 'react'
import api from '@/config/api'

interface Company {
  company_id: number
  company_name: string
  company_cnpj?: string
}

interface UserCompaniesModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  userName: string
}

export default function UserCompaniesModal({ isOpen, onClose, userId, userName }: UserCompaniesModalProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [userCompanies, setUserCompanies] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, userId])

  const fetchData = async () => {
    setIsLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Buscar todas as empresas
      const companiesRes = await api.get(`/companies`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Buscar empresas do usuário
      const userCompaniesRes = await api.get(`/users/${userId}/companies`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (companiesRes.data.success) {
        setCompanies(companiesRes.data.data || [])
      }

      if (userCompaniesRes.data.success) {
        const ids = (userCompaniesRes.data.data || []).map((c: Company) => c.company_id)
        setUserCompanies(ids)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar dados')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleCompany = (companyId: number) => {
    setUserCompanies(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      await api.put(
        `/users/${userId}/companies`,
        { companyIds: userCompanies },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar empresas')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">Empresas do Usuário</h2>
            <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
            title="Fechar"
          >
            <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] scrollbar-gray">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-3"></i>
                <p className="text-green-700 text-sm">Empresas atualizadas com sucesso!</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-gray-200 dark:bg-[#333333] rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-[#aaaaaa]">
              <i className="fas fa-building text-4xl mb-3 opacity-50"></i>
              <p>Nenhuma empresa cadastrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companies.map(company => (
                <label
                  key={company.company_id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-[#444444] hover:bg-gray-50 dark:hover:bg-[#333333] cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={userCompanies.includes(company.company_id)}
                    onChange={() => handleToggleCompany(company.company_id)}
                    className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-[#eeeeee]">{company.company_name}</p>
                    {company.company_cnpj && (
                      <p className="text-xs text-gray-500 dark:text-[#aaaaaa]">{company.company_cnpj}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-[#444444] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition"
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
            disabled={isSaving || isLoading}
          >
            {isSaving ? (
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
      </div>
    </div>
  )
}
