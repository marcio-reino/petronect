'use client'

import { useState, useEffect } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { ptBR } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import api from '@/services/api'
import { APP_CONFIG } from '@/config/app.config'

registerLocale('pt-BR', ptBR)

interface SystemLog {
  log_id: number
  log_uuid: string
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

export default function LogsSystemList() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'data'>('info')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Filtros
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    action: '',
    userId: '',
  })

  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  // Carregar usuários para o select
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users')
      // Tratar diferentes formatos de resposta da API
      const usersList = response.data.users || response.data.data || response.data || []
      setUsers(usersList)
      console.log('Usuários carregados:', usersList)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      setUsers([])
    }
  }

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('dateFrom', startDate.toISOString().split('T')[0])
      if (endDate) params.append('dateTo', endDate.toISOString().split('T')[0])
      if (filters.action) params.append('action', filters.action)
      if (filters.userId) params.append('userId', filters.userId)

      console.log('Buscando logs com filtros:', {
        dateFrom: startDate?.toISOString().split('T')[0],
        dateTo: endDate?.toISOString().split('T')[0],
        action: filters.action,
        userId: filters.userId
      })

      const response = await api.get(`/logs/system?${params.toString()}`)
      console.log('Logs recebidos:', response.data.logs)
      setLogs(response.data.logs || [])
      setFilteredLogs(response.data.logs || [])
      setCurrentPage(1) // Reset para primeira página ao buscar
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
      setLogs([])
      setFilteredLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentLogs = filteredLogs.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const handleSearch = () => {
    fetchLogs()
  }

  const handleClearFilters = () => {
    setStartDate(null)
    setEndDate(null)
    setFilters({
      dateFrom: '',
      dateTo: '',
      action: '',
      userId: '',
    })
    setTimeout(() => fetchLogs(), 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'DELETE_SOFT':
      case 'DELETE_PERMANENT':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
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
      DELETE_SOFT: 'Exclusão Lógica',
      DELETE_PERMANENT: 'Exclusão Permanente',
      LOGIN: 'Login',
      LOGOUT: 'Logout',
    }
    return labels[action] || action
  }

  const showDetails = (log: SystemLog) => {
    setSelectedLog(log)
    setShowDetailsModal(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">
            Logs de Atividades do Sistema
          </h1>
          <p className="text-gray-600 dark:text-[#aaaaaa] mt-1">
            Registro de todas as ações realizadas no sistema
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-sm border border-gray-200 dark:border-[#444444] p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Data Inicial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Data Inicial
            </label>
            <div className="relative">
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Selecione a data"
                locale="pt-BR"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                calendarClassName="dark-calendar"
                wrapperClassName="w-full"
              />
              <i className="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] pointer-events-none"></i>
            </div>
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Data Final
            </label>
            <div className="relative">
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="dd/MM/yyyy"
                placeholderText="Selecione a data"
                minDate={startDate || undefined}
                locale="pt-BR"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                calendarClassName="dark-calendar"
                wrapperClassName="w-full"
              />
              <i className="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] pointer-events-none"></i>
            </div>
          </div>

          {/* Ação */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Ação
            </label>
            <div className="relative">
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full pl-10 pr-8 py-2.5 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all appearance-none cursor-pointer hover:border-gray-400 dark:hover:border-[#555555]"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1.5em 1.5em',
                }}
              >
                <option value="">Todas as ações</option>
                <option value="CREATE">Criação</option>
                <option value="UPDATE">Atualização</option>
                <option value="DELETE_SOFT">Exclusão Lógica</option>
                <option value="DELETE_PERMANENT">Exclusão Permanente</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
              <i className="fas fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] pointer-events-none"></i>
            </div>
          </div>

          {/* Usuário */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Usuário
            </label>
            <div className="relative">
              <select
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="w-full pl-10 pr-8 py-2.5 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 transition-all appearance-none cursor-pointer hover:border-gray-400 dark:hover:border-[#555555]"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.5rem center',
                  backgroundSize: '1.5em 1.5em',
                }}
              >
                <option value="">Todos os usuários</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_name}
                  </option>
                ))}
              </select>
              <i className="fas fa-users absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] pointer-events-none"></i>
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleSearch}
              className="flex-1 px-4 py-2.5 font-semibold rounded-lg transition-all duration-200 text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              <i className="fas fa-search mr-2"></i>
              Buscar
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
              title="Limpar filtros"
            >
              <i className="fas fa-eraser"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-sm border border-gray-200 dark:border-[#444444] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <i className="fas fa-spinner fa-spin text-3xl text-gray-400 dark:text-[#888888]"></i>
            <p className="text-gray-600 dark:text-[#aaaaaa] mt-2">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <i className="fas fa-inbox text-4xl text-gray-300 dark:text-[#555555] mb-3"></i>
            <p className="text-gray-600 dark:text-[#aaaaaa]">Nenhum log encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-[#1a1a1a] border-b dark:border-[#444444]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      Ação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      Módulo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      IP
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-[#444444]">
                  {currentLogs.map((log) => (
                  <tr
                    key={log.log_id}
                    className="hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-[#dddddd] whitespace-nowrap">
                      {formatDate(log.log_date_insert)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-[#dddddd]">
                      {log.user_name || 'Sistema'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getActionBadgeColor(
                          log.log_action
                        )}`}
                      >
                        {getActionLabel(log.log_action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-[#dddddd]">
                      {log.log_module}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#aaaaaa] max-w-xs truncate">
                      {log.log_description || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#aaaaaa] font-mono">
                      {log.log_ip_address || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => showDetails(log)}
                        className="w-9 h-9 inline-flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <i className="fas fa-file"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#444444] bg-white dark:bg-[#2a2a2a]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Info */}
              <div className="text-sm text-gray-600 dark:text-[#cccccc]">
                Mostrando <span className="font-semibold">{startIndex + 1}</span> a{' '}
                <span className="font-semibold">{Math.min(endIndex, filteredLogs.length)}</span> de{' '}
                <span className="font-semibold">{filteredLogs.length}</span> registros
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-4">
                {/* Items per page */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-[#cccccc] whitespace-nowrap">Itens por página:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 bg-white dark:bg-[#333333] text-gray-900 dark:text-[#eeeeee]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#444444] bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Mostrar apenas páginas próximas
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-teal-600 text-white'
                                : 'bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444]'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-2 py-2 text-gray-500 dark:text-[#888888]">...</span>
                      }
                      return null
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#444444] bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showDetailsModal && selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowDetailsModal(false)}
        >
          <div
            className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
                Detalhes do Log
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
              >
                <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b dark:border-[#444444]">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'info'
                      ? 'border-teal-600 text-teal-600 dark:border-teal-500 dark:text-teal-500'
                      : 'border-transparent text-gray-500 dark:text-[#888888] hover:text-gray-700 dark:hover:text-[#cccccc] hover:border-gray-300 dark:hover:border-[#555555]'
                  }`}
                >
                  <i className="fas fa-info-circle mr-2"></i>
                  Informações Gerais
                </button>
                <button
                  onClick={() => setActiveTab('data')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'data'
                      ? 'border-teal-600 text-teal-600 dark:border-teal-500 dark:text-teal-500'
                      : 'border-transparent text-gray-500 dark:text-[#888888] hover:text-gray-700 dark:hover:text-[#cccccc] hover:border-gray-300 dark:hover:border-[#555555]'
                  }`}
                >
                  <i className="fas fa-database mr-2"></i>
                  Dados
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              {activeTab === 'info' ? (
                <div className="space-y-4">
                  {/* Info Geral */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Data/Hora
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd]">
                        {formatDate(selectedLog.log_date_insert)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Usuário
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd]">
                        {selectedLog.user_name || 'Sistema'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Ação
                      </label>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getActionBadgeColor(
                          selectedLog.log_action
                        )}`}
                      >
                        {getActionLabel(selectedLog.log_action)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Módulo
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd]">
                        {selectedLog.log_module}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        IP
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd] font-mono">
                        {selectedLog.log_ip_address || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        UUID
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd] font-mono">
                        {selectedLog.log_uuid}
                      </p>
                    </div>
                  </div>

                  {/* Descrição */}
                  {selectedLog.log_description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Descrição
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd] bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded border dark:border-[#444444]">
                        {selectedLog.log_description}
                      </p>
                    </div>
                  )}

                  {/* User Agent */}
                  {selectedLog.log_user_agent && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        User Agent
                      </label>
                      <p className="text-sm text-gray-900 dark:text-[#dddddd] bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded border dark:border-[#444444] font-mono break-all">
                        {selectedLog.log_user_agent}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Dados Antigos */}
                  {selectedLog.log_old_data && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Dados Anteriores
                      </label>
                      <pre className="text-xs text-gray-900 dark:text-[#dddddd] bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded border dark:border-[#444444] overflow-x-auto">
                        {JSON.stringify(selectedLog.log_old_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Dados Novos */}
                  {selectedLog.log_new_data && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
                        Dados Novos
                      </label>
                      <pre className="text-xs text-gray-900 dark:text-[#dddddd] bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded border dark:border-[#444444] overflow-x-auto">
                        {JSON.stringify(selectedLog.log_new_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {!selectedLog.log_old_data && !selectedLog.log_new_data && (
                    <div className="text-center py-8">
                      <i className="fas fa-inbox text-4xl text-gray-300 dark:text-[#555555] mb-3"></i>
                      <p className="text-gray-600 dark:text-[#aaaaaa]">Nenhum dado disponível</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t dark:border-[#444444] flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-all duration-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
