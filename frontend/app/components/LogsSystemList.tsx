'use client'

import { useState, useEffect } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { ptBR } from 'date-fns/locale/pt-BR'
import 'react-datepicker/dist/react-datepicker.css'
import api from '@/config/api'

registerLocale('pt-BR', ptBR)

interface SystemLog {
  log_id: number
  log_user_id: number | null
  log_action: string
  log_module: string
  log_entity_type: string | null
  log_entity_id: number | null
  log_description: string | null
  log_old_data: any
  log_new_data: any
  log_ip_address: string | null
  log_user_agent: string | null
  log_date_insert: string
  user_name?: string
}

interface User {
  user_id: number
  user_name: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function LogsSystemList() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Filtros
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')

  // Modal de detalhes
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'data'>('info')

  // Carregar usuários para o select
  useEffect(() => {
    fetchUsers()
    fetchLogs()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users')
      const usersList = response.data.users || response.data.data || response.data || []
      setUsers(usersList)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      setUsers([])
    }
  }

  const fetchLogs = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      if (startDate) params.append('dateFrom', startDate.toISOString().split('T')[0])
      if (endDate) params.append('dateTo', endDate.toISOString().split('T')[0])
      if (filtroAcao) params.append('action', filtroAcao)
      if (filtroUsuario) params.append('userId', filtroUsuario)

      const response = await api.get(`/logs/system?${params.toString()}`)

      if (response.data) {
        setLogs(response.data.logs || [])
        // Se a API retornar paginação, usar; senão calcular
        if (response.data.pagination) {
          setPagination(response.data.pagination)
        } else {
          const total = response.data.logs?.length || 0
          setPagination(prev => ({
            ...prev,
            page,
            total,
            totalPages: Math.ceil(total / prev.limit)
          }))
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchLogs(1)
  }

  const handleClearFilters = () => {
    setStartDate(null)
    setEndDate(null)
    setFiltroAcao('')
    setFiltroUsuario('')
    setTimeout(() => fetchLogs(1), 0)
  }

  const handlePageChange = (page: number) => {
    fetchLogs(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setPagination(prev => ({ ...prev, limit: value }))
    setTimeout(() => fetchLogs(1), 0)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'DELETE':
      case 'DELETE_SOFT':
      case 'DELETE_PERMANENT':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'LOGOUT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      CREATE: 'Criação',
      UPDATE: 'Atualização',
      DELETE: 'Exclusão',
      DELETE_SOFT: 'Exclusão Lógica',
      DELETE_PERMANENT: 'Exclusão Permanente',
      LOGIN: 'Login',
      LOGOUT: 'Logout',
    }
    return labels[action] || action
  }

  const showDetails = (log: SystemLog) => {
    setSelectedLog(log)
    setActiveTab('info')
    setShowDetailsModal(true)
  }

  if (loading && logs.length === 0) {
    return (
      <>
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-200 dark:bg-[#333333] rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-[#333333] rounded w-96 animate-pulse"></div>
        </div>

        {/* Filters Skeleton */}
        <div className="mb-6 flex gap-3">
          <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-40 animate-pulse"></div>
          <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-40 animate-pulse"></div>
          <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-32 animate-pulse"></div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#444444] overflow-hidden">
          <table className="w-full">
            <thead className="bg-white dark:bg-[#333333] border-b border-gray-200 dark:border-[#444444]">
              <tr>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <th key={i} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-[#444444] rounded animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#444444]">
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                    <td key={col} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-[#333333] rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-lg">
        <div className="flex items-center">
          <i className="fas fa-exclamation-circle text-red-500 text-2xl mr-3"></i>
          <div>
            <h3 className="font-semibold text-red-800">Erro ao carregar</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">Logs do Sistema</h1>
            <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">Registro de todas as atividades do sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(pagination.page)}
              className="w-9 h-9 inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Atualizar lista"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Data Inicial */}
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <DatePicker
                selected={startDate}
                onChange={(date: Date | null) => setStartDate(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Selecione..."
                locale="pt-BR"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
                wrapperClassName="w-full"
              />
              <i className="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] pointer-events-none"></i>
            </div>
          </div>

          {/* Data Final */}
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Data Final
            </label>
            <div className="relative">
              <DatePicker
                selected={endDate}
                onChange={(date: Date | null) => setEndDate(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Selecione..."
                minDate={startDate || undefined}
                locale="pt-BR"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
                wrapperClassName="w-full"
              />
              <i className="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] pointer-events-none"></i>
            </div>
          </div>

          {/* Ação */}
          <div className="min-w-[140px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Ação
            </label>
            <select
              value={filtroAcao}
              onChange={(e) => setFiltroAcao(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            >
              <option value="">Todas</option>
              <option value="CREATE">Criação</option>
              <option value="UPDATE">Atualização</option>
              <option value="DELETE">Exclusão</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
            </select>
          </div>

          {/* Usuário */}
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Usuário
            </label>
            <select
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.user_id} value={user.user_id}>
                  {user.user_name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Pesquisar */}
          <button
            onClick={handleSearch}
            className="w-10 h-10 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            title="Pesquisar"
          >
            <i className="fas fa-search"></i>
          </button>

          {/* Botão Limpar */}
          <button
            onClick={handleClearFilters}
            className="w-10 h-10 inline-flex items-center justify-center bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] hover:bg-gray-300 dark:hover:bg-[#444444] rounded-lg transition-colors"
            title="Limpar filtros"
          >
            <i className="fas fa-eraser"></i>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden dark:bg-[#2a2a2a] dark:border-[#444444]">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-[#333333] border-b border-gray-200 dark:border-[#444444]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Ação
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Módulo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  IP
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-[#444444] dark:bg-[#2a2a2a]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <i className="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500">Nenhum log encontrado</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-800 dark:text-[#eeeeee]">
                        {formatDate(log.log_date_insert)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800 dark:text-[#eeeeee]">
                        {log.user_name || 'Sistema'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeColor(log.log_action)}`}>
                        {getActionLabel(log.log_action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd]">
                      {log.log_module || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#aaaaaa] max-w-xs truncate" title={log.log_description || ''}>
                      {log.log_description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-[#aaaaaa] font-mono">
                      {log.log_ip_address || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => showDetails(log)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                          title="Ver detalhes"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-white dark:border-[#444444] dark:bg-[#2a2a2a]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Info */}
              <div className="text-sm text-gray-600 dark:text-[#cccccc]">
                Mostrando <span className="font-semibold">{((pagination.page - 1) * pagination.limit) + 1}</span> a{' '}
                <span className="font-semibold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de{' '}
                <span className="font-semibold">{pagination.total}</span> registros
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-4">
                {/* Items per page */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-[#cccccc] whitespace-nowrap">Itens por página:</label>
                  <select
                    value={pagination.limit}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white dark:bg-[#333333] dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= pagination.page - 1 && page <= pagination.page + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              pagination.page === page
                                ? 'bg-teal-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-[#333333] dark:border-[#444444] dark:text-[#eeeeee] dark:hover:bg-[#444444]'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      } else if (page === pagination.page - 2 || page === pagination.page + 2) {
                        return (
                          <span key={page} className="px-2 py-2 text-gray-500">
                            ...
                          </span>
                        )
                      }
                      return null
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white dark:bg-[#333333] dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showDetailsModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col fade-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#444444] flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-[#eeeeee]">
                  Detalhes do Log
                </h3>
                <span className="text-sm text-gray-500 dark:text-[#aaaaaa]">
                  {formatDate(selectedLog.log_date_insert)}
                </span>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
                title="Fechar"
              >
                <i className="fas fa-times text-gray-500 dark:text-[#aaaaaa]"></i>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-[#444444]">
              <nav className="flex -mb-px px-6">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-[#888888] dark:hover:text-[#cccccc]'
                  }`}
                >
                  <i className="fas fa-info-circle mr-2"></i>
                  Informações
                </button>
                <button
                  onClick={() => setActiveTab('data')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'data'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-[#888888] dark:hover:text-[#cccccc]'
                  }`}
                >
                  <i className="fas fa-database mr-2"></i>
                  Dados
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'info' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        Usuário
                      </label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                        {selectedLog.user_name || 'Sistema'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        Ação
                      </label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeColor(selectedLog.log_action)}`}>
                          {getActionLabel(selectedLog.log_action)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        Módulo
                      </label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                        {selectedLog.log_module || '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        IP
                      </label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee] font-mono">
                        {selectedLog.log_ip_address || '-'}
                      </div>
                    </div>
                  </div>

                  {selectedLog.log_description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        Descrição
                      </label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                        {selectedLog.log_description}
                      </div>
                    </div>
                  )}

                  {selectedLog.log_user_agent && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        User Agent
                      </label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-xs text-gray-700 dark:text-[#eeeeee] font-mono break-all">
                        {selectedLog.log_user_agent}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedLog.log_old_data && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        Dados Anteriores
                      </label>
                      <pre className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-xs text-gray-700 dark:text-[#eeeeee] overflow-x-auto">
                        {JSON.stringify(selectedLog.log_old_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.log_new_data && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                        Dados Novos
                      </label>
                      <pre className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-xs text-gray-700 dark:text-[#eeeeee] overflow-x-auto">
                        {JSON.stringify(selectedLog.log_new_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!selectedLog.log_old_data && !selectedLog.log_new_data && (
                    <div className="text-center py-8">
                      <i className="fas fa-inbox text-4xl text-gray-300 dark:text-[#555555] mb-3"></i>
                      <p className="text-gray-500 dark:text-[#aaaaaa]">Nenhum dado disponível</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#444444] flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
