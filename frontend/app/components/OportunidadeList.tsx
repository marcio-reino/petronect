'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import StatusBadge from './StatusBadge'
import DatePicker from './DatePicker'
import OportunidadeItensModal from './OportunidadeItensModal'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface OportunidadeRow {
  opt_id: number
  opt_numero: string
  opt_datainicio: string
  opt_datafim: string
  opt_descricao: string
  opt_totalitens: number
  opt_totalempresas: number
  opt_status: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function OportunidadeList() {
  const [oportunidades, setOportunidades] = useState<OportunidadeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })

  // Filtros
  const [filtroNumero, setFiltroNumero] = useState('')
  const [filtroDescricao, setFiltroDescricao] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  // Estados para edição e exclusão
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedOportunidade, setSelectedOportunidade] = useState<OportunidadeRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchOportunidades = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      if (filtroNumero) params.append('numero', filtroNumero)
      if (filtroDescricao) params.append('descricao', filtroDescricao)
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroStatus !== '') params.append('status', filtroStatus)

      const res = await axios.get(`${API_DOMAIN}/oportunidades?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        setOportunidades(res.data.data)
        setPagination(res.data.pagination)
      } else {
        setError('Falha ao buscar oportunidades')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar oportunidades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOportunidades()
  }, [])

  const handleSearch = () => {
    fetchOportunidades(1)
  }

  const handleClearFilters = () => {
    setFiltroNumero('')
    setFiltroDescricao('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroStatus('')
    setTimeout(() => fetchOportunidades(1), 0)
  }

  const handlePageChange = (page: number) => {
    fetchOportunidades(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setPagination(prev => ({ ...prev, limit: value }))
    setTimeout(() => fetchOportunidades(1), 0)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  }

  const getStatusLabel = (status: number) => {
    return status === 1 ? 'Completa' : 'Baixando'
  }

  const getStatusColor = (status: number) => {
    return status === 1 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
  }

  const handleViewItens = (op: OportunidadeRow) => {
    setSelectedOportunidade(op)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (op: OportunidadeRow) => {
    setSelectedOportunidade(op)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedOportunidade) return

    setIsDeleting(true)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.delete(`${API_DOMAIN}/oportunidades/${selectedOportunidade.opt_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        fetchOportunidades(pagination.page)
        setIsDeleteModalOpen(false)
        setSelectedOportunidade(null)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao excluir oportunidade')
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading && oportunidades.length === 0) {
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">Oportunidades</h1>
            <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">Gerencie as oportunidades de licitação</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchOportunidades(pagination.page)}
              className="w-9 h-9 inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Atualizar lista"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Nº Oportunidade */}
          <div className="w-[170px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Nº Oportunidade
            </label>
            <input
              type="text"
              value={filtroNumero}
              onChange={(e) => setFiltroNumero(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: 7004552111"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            />
          </div>

          {/* Descrição */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
              Descrição
            </label>
            <input
              type="text"
              value={filtroDescricao}
              onChange={(e) => setFiltroDescricao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar na descrição..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
            />
          </div>

          {/* Data Início */}
          <div className="w-[180px]">
            <DatePicker
              label="Data Início"
              value={filtroDataInicio}
              onChange={setFiltroDataInicio}
              placeholder="Selecione..."
            />
          </div>

          {/* Data Fim */}
          <div className="w-[180px]">
            <DatePicker
              label="Data Fim"
              value={filtroDataFim}
              onChange={setFiltroDataFim}
              placeholder="Selecione..."
            />
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
              <option value="0">Baixando</option>
              <option value="1">Completa</option>
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
                  Nº Oportunidade
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Data Início
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Data Fim
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Itens
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
              {oportunidades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <i className="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500">Nenhuma oportunidade encontrada</p>
                  </td>
                </tr>
              ) : (
                oportunidades.map((op) => (
                  <tr key={op.opt_id} className="hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800 dark:text-[#eeeeee]">
                        {op.opt_numero}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#aaaaaa]">
                        ID: {op.opt_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd]">
                      <div className="max-w-md truncate" title={op.opt_descricao}>
                        {op.opt_descricao || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd] text-center">
                      {formatDate(op.opt_datainicio)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd] text-center">
                      {formatDate(op.opt_datafim)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd] text-center">
                      {op.opt_totalitens || 0}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(op.opt_status)}`}>
                        {getStatusLabel(op.opt_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewItens(op)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                          title="Itens da Proposta"
                        >
                          <i className="fas fa-list-ul"></i>
                        </button>

                        <button
                          onClick={() => handleDeleteClick(op)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Excluir oportunidade"
                        >
                          <i className="fas fa-trash"></i>
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

      {/* Modal de Itens da Oportunidade */}
      <OportunidadeItensModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedOportunidade(null)
        }}
        oportunidade={selectedOportunidade}
      />

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteModalOpen && selectedOportunidade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-xl shadow-2xl max-w-md w-full p-6 fade-in">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30">
              <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-[#eeeeee] mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-sm text-center text-gray-600 dark:text-[#aaaaaa] mb-6">
              Tem certeza que deseja excluir a oportunidade <strong>Nº {selectedOportunidade.opt_numero}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setSelectedOportunidade(null)
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash"></i>
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
