'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import StatusBadge from './StatusBadge'
import RoboEditModal from './RoboEditModal'
import RoboMonitorModal from './RoboMonitorModal'
import RoboOportunidadesModal from './RoboOportunidadesModal'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface RoboRow {
  robo_id: number
  robo_datacriacao: string
  robo_nome: string
  robo_dec: string
  robo_tipo: number
  robo_data: number
  robo_user: string
  robo_senha: string
  robo_tempo: number
  robo_ultimaatividade: string
  robo_velocidade: number
  robo_opresgate: string
  robo_datahoraatv: string
  robo_datainiciofim: number
  robo_ordemop: number
  robo_status: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function RoboList() {
  const [robos, setRobos] = useState<RoboRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Filtros
  const [filtroNome, setFiltroNome] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  // Modal de edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedRobo, setSelectedRobo] = useState<RoboRow | null>(null)

  // Modal de Monitor
  const [isMonitorOpen, setIsMonitorOpen] = useState(false)

  // Modal de Oportunidades Específicas
  const [isOportunidadesModalOpen, setIsOportunidadesModalOpen] = useState(false)
  const [selectedRoboForOportunidades, setSelectedRoboForOportunidades] = useState<RoboRow | null>(null)

  const fetchRobos = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      if (filtroNome) params.append('nome', filtroNome)
      if (filtroTipo !== '') params.append('tipo', filtroTipo)
      if (filtroStatus !== '') params.append('status', filtroStatus)

      const res = await axios.get(`${API_DOMAIN}/robos?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        setRobos(res.data.data)
        setPagination(res.data.pagination)
      } else {
        setError('Falha ao buscar robôs')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar robôs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRobos()
  }, [])

  const handleSearch = () => {
    fetchRobos(1)
  }

  const handleClearFilters = () => {
    setFiltroNome('')
    setFiltroTipo('')
    setFiltroStatus('')
    setTimeout(() => fetchRobos(1), 0)
  }

  const handlePageChange = (page: number) => {
    fetchRobos(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setPagination(prev => ({ ...prev, limit: value }))
    setTimeout(() => fetchRobos(1), 0)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getTipoLabel = (tipo: number) => {
    return tipo === 0 ? 'OP' : 'RT'
  }

  const getTipoColor = (tipo: number) => {
    return tipo === 0
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
  }

  const getStatusLabel = (status: number) => {
    return status === 1 ? 'Ativo' : 'Inativo'
  }

  const handleEdit = (robo: RoboRow) => {
    setSelectedRobo(robo)
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedRobo(null)
  }

  const handleSaveEdit = () => {
    fetchRobos(pagination.page)
  }

  const handleOpenOportunidades = (robo: RoboRow) => {
    setSelectedRoboForOportunidades(robo)
    setIsOportunidadesModalOpen(true)
  }

  const handleCloseOportunidadesModal = () => {
    setIsOportunidadesModalOpen(false)
    setSelectedRoboForOportunidades(null)
  }

  if (loading && robos.length === 0) {
    return (
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-xl border border-gray-100 dark:border-[#444444] overflow-hidden">
        {/* Header Skeleton */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#444444]">
          <div className="h-8 bg-gray-200 dark:bg-[#333333] rounded w-48 mb-4 animate-pulse"></div>
          <div className="flex gap-4">
            <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-64 animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-32 animate-pulse"></div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333] border-b border-gray-200 dark:border-[#444444]">
              <tr>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <th key={i} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-[#444444] rounded animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#444444]">
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  {[1, 2, 3, 4, 5, 6].map((col) => (
                    <td key={col} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-[#333333] rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">Agentes</h1>
            <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">Gerencie os agentes de automação do sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchRobos(pagination.page)}
              className="w-9 h-9 inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Atualizar lista"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
            <button
              onClick={() => {
                setSelectedRobo(null)
                setIsEditModalOpen(true)
              }}
              className="w-9 h-9 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              title="Novo agente"
            >
              <i className="fas fa-plus"></i>
            </button>
            <button
              onClick={() => setIsMonitorOpen(true)}
              className="px-4 h-9 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <i className="fas fa-desktop"></i>
              Monitor
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Nome */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Nome do Agente
            </label>
            <input
              type="text"
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por nome..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            />
          </div>

          {/* Tipo */}
          <div className="min-w-[120px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Tipo
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            >
              <option value="">Todos</option>
              <option value="0">OP</option>
              <option value="1">RT</option>
            </select>
          </div>

          {/* Status */}
          <div className="min-w-[120px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            >
              <option value="">Todos</option>
              <option value="0">Inativo</option>
              <option value="1">Ativo</option>
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
                  Nome
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Modo
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-[#444444] dark:bg-[#2a2a2a]">
              {robos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <i className="fas fa-robot text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500">Nenhum robô encontrado</p>
                  </td>
                </tr>
              ) : (
                robos.map((robo) => (
                  <tr key={robo.robo_id} className="hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800 dark:text-[#eeeeee]">
                        {robo.robo_nome}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#aaaaaa]">
                        ID: {robo.robo_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd]">
                      {robo.robo_dec || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTipoColor(robo.robo_tipo)}`}>
                        {getTipoLabel(robo.robo_tipo)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd]">
                      {robo.robo_user || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {robo.robo_opresgate ? (
                        <div className="flex flex-col">
                          <span className="text-base font-semibold text-green-600 dark:text-green-400">
                            {robo.robo_opresgate}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            resgatando
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {robo.robo_ordemop === 1 ? 'Crescente' : 'Decrescente'}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            <i className={`fas fa-sort-amount-${robo.robo_ordemop === 1 ? 'up' : 'down'} mr-1`}></i>
                            ordem
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={robo.robo_status === 1 ? 'active' : 'inactive'} variant="compact" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenOportunidades(robo)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          title="Oportunidades Específicas"
                        >
                          <i className="fas fa-list-ul"></i>
                        </button>
                        <button
                          onClick={() => handleEdit(robo)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                          title="Editar robô"
                        >
                          <i className="fas fa-edit"></i>
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

      {/* Modal de Edição */}
      <RoboEditModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        robo={selectedRobo}
        onSave={handleSaveEdit}
      />

      {/* Modal de Monitor */}
      <RoboMonitorModal
        isOpen={isMonitorOpen}
        onClose={() => setIsMonitorOpen(false)}
        onStatusChange={() => fetchRobos(pagination.page)}
      />

      {/* Modal de Oportunidades Específicas */}
      <RoboOportunidadesModal
        isOpen={isOportunidadesModalOpen}
        onClose={handleCloseOportunidadesModal}
        robo={selectedRoboForOportunidades}
      />
    </>
  )
}
