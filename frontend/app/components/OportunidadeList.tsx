'use client' 

import { useEffect, useState, useRef } from 'react'
import api from '@/config/api'
import { APP_CONFIG } from '@/config/app.config'
import StatusBadge from './StatusBadge'
import DatePicker from './DatePicker'
import OportunidadeItensModal from './OportunidadeItensModal'
import JSZip from 'jszip'

interface OportunidadeRow {
  opt_id: number
  opt_numero: string
  opt_datainicio: string
  opt_horainicio: string
  opt_datafim: string
  opt_horafim: string
  opt_descricao: string
  opt_totalitens: number
  opt_totalempresas: number
  opt_status: number
}

interface OportunidadeItem {
  optitem_id: number
  optitem_idop: number
  optitem_item: string
  optitem_descricao: string
  optitem_descricao_completa: string
  optitem_quantidade: string
  optitem_unidade: string
  optitem_produto_id: string
  optitem_produto_familia: string
  optitem_obs: string
  optitem_dataresgate: string
  optitem_robo: string
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
  const [pagination, setPagination] = useState<Pagination>(() => {
    if (typeof window !== 'undefined') {
      const savedLimit = localStorage.getItem('oportunidades_items_per_page')
      return {
        page: 1,
        limit: savedLimit ? parseInt(savedLimit, 10) : 10,
        total: 0,
        totalPages: 0
      }
    }
    return {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    }
  })
  const [showScrollTop, setShowScrollTop] = useState(false)

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

  // Estados para download em lote
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasFiltered, setHasFiltered] = useState(false)
  const downloadCancelledRef = useRef(false)

  const fetchOportunidades = async (page = 1, customLimit?: number) => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('limit', (customLimit ?? pagination.limit).toString())

      if (filtroNumero) params.append('numero', filtroNumero)
      if (filtroDescricao) params.append('descricao', filtroDescricao)
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio)
      if (filtroDataFim) params.append('dataFim', filtroDataFim)
      if (filtroStatus !== '') params.append('status', filtroStatus)

      const res = await api.get(`/oportunidades?${params.toString()}`)

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

  // Detectar scroll para mostrar/ocultar botão de voltar ao topo
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = () => {
    fetchOportunidades(1)
    setHasFiltered(true)
  }

  const handleClearFilters = () => {
    setFiltroNumero('')
    setFiltroDescricao('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroStatus('')
    setHasFiltered(false)
    setTimeout(() => fetchOportunidades(1), 0)
  }

  const handlePageChange = (page: number) => {
    fetchOportunidades(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    localStorage.setItem('oportunidades_items_per_page', value.toString())
    setPagination(prev => ({ ...prev, limit: value }))
    fetchOportunidades(1, value)
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    // Usar split para evitar problemas de timezone
    // dateString vem como "2026-01-19" ou "2026-01-19T00:00:00.000Z"
    const dateOnly = dateString.split('T')[0]
    const [year, month, day] = dateOnly.split('-')
    return `${day}/${month}/${year}`
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
      const res = await api.delete(`/oportunidades/${selectedOportunidade.opt_id}`)

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

  // Formatar data para o padrão DD.MM.YYYY HH:MM:SS
  const formatDateTxt = (dateString: string) => {
    if (!dateString) return '-'
    // Evitar problemas de timezone usando split
    // dateString pode vir como "2026-01-19" ou "2026-01-19T10:30:00.000Z"
    const hasTime = dateString.includes('T')
    const [datePart, timePart] = dateString.split('T')
    const [year, month, day] = datePart.split('-')

    let hours = '00', minutes = '00', seconds = '00'
    if (hasTime && timePart) {
      const timeOnly = timePart.split('.')[0] // Remove milliseconds
      const [h, m, s] = timeOnly.split(':')
      hours = h || '00'
      minutes = m || '00'
      seconds = s || '00'
    }

    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
  }

  // Formatar quantidade com vírgula (ex: 1.000 -> 1,000)
  const formatQuantidade = (qtd: string) => {
    if (!qtd) return '0'
    const num = parseFloat(qtd)
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  }

  // Download TXT da proposta
  const handleDownloadTxt = async (op: OportunidadeRow) => {
    try {
      // Buscar itens da oportunidade
      const res = await api.get(`/oportunidades/${op.opt_id}/itens`)

      if (!res.data || !res.data.success) {
        setError('Falha ao buscar itens para exportação')
        return
      }

      const itens: OportunidadeItem[] = res.data.data
      const now = new Date()
      const processadoEm = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} - ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

      // Montar conteúdo do TXT
      let txt = ''
      txt += '#####################################################################################\n'
      txt += `OPORTUNIDADE N:    ${op.opt_numero}\n`
      txt += `DESCRICAO:         ${op.opt_descricao || '-'}\n`
      txt += `DATA INICIO:       ${formatDateTxt(op.opt_datainicio)} ${op.opt_horainicio || '00:00:00'}\n`
      txt += `DATA FIM:          ${formatDateTxt(op.opt_datafim)} ${op.opt_horafim || '00:00:00'}\n`
      txt += `OPPORTUNITY TYPE:  Dispensa Item\n`
      txt += '#####################################################################################\n'
      txt += '---------------------------------------------------------------\n'
      txt += `LISTA DE ITENS - TOTAL: ${itens.length}\n`
      txt += '---------------------------------------------------------------\n'

      itens.forEach((item) => {
        txt += `ITEM:            ${item.optitem_item.padStart(4, '0')}\n`
        txt += `DESCRICAO:       ${item.optitem_descricao || '-'}\n`
        txt += `TEXTO ITEM:      ${item.optitem_descricao_completa || item.optitem_descricao || '-'}\n`
        txt += `QUANTIDADE:      ${formatQuantidade(item.optitem_quantidade)}\n`
        txt += `UNIDADE:         ${item.optitem_unidade || '-'}\n`
        txt += `ID PRODUTO:      ${item.optitem_produto_id || '-'}\n`
        txt += `FAMILIA:         ${item.optitem_produto_familia || '-'}\n`
        txt += '=============================\n'
      })

      // Pegar robô do primeiro item (se existir)
      const robo = itens.length > 0 && itens[0].optitem_robo ? itens[0].optitem_robo : 'SISTEMA'
      txt += `PROCESSADO EM:   ${processadoEm} - ${robo}\n`
      txt += `Mach-9 Tecnologia - agentepetronect.com - versão: ${APP_CONFIG.system.version}\n`
      txt += '######################################## FIM ########################################\n'

      // Criar e baixar arquivo
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${op.opt_numero}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao gerar arquivo TXT')
    }
  }

  // Gerar conteúdo TXT para uma oportunidade (reutilizável)
  const generateTxtContent = async (op: OportunidadeRow): Promise<string> => {
    const res = await api.get(`/oportunidades/${op.opt_id}/itens`)

    if (!res.data || !res.data.success) {
      throw new Error('Falha ao buscar itens')
    }

    const itens: OportunidadeItem[] = res.data.data
    const now = new Date()
    const processadoEm = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} - ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    let txt = ''
    txt += '#####################################################################################\n'
    txt += `OPORTUNIDADE N:    ${op.opt_numero}\n`
    txt += `DESCRICAO:         ${op.opt_descricao || '-'}\n`
    txt += `DATA INICIO:       ${formatDateTxt(op.opt_datainicio)} ${op.opt_horainicio || '00:00:00'}\n`
    txt += `DATA FIM:          ${formatDateTxt(op.opt_datafim)} ${op.opt_horafim || '00:00:00'}\n`
    txt += `OPPORTUNITY TYPE:  Dispensa Item\n`
    txt += '#####################################################################################\n'
    txt += '---------------------------------------------------------------\n'
    txt += `LISTA DE ITENS - TOTAL: ${itens.length}\n`
    txt += '---------------------------------------------------------------\n'

    itens.forEach((item) => {
      txt += `ITEM:            ${item.optitem_item.padStart(4, '0')}\n`
      txt += `DESCRICAO:       ${item.optitem_descricao || '-'}\n`
      txt += `TEXTO ITEM:      ${item.optitem_descricao_completa || item.optitem_descricao || '-'}\n`
      txt += `QUANTIDADE:      ${formatQuantidade(item.optitem_quantidade)}\n`
      txt += `UNIDADE:         ${item.optitem_unidade || '-'}\n`
      txt += `ID PRODUTO:      ${item.optitem_produto_id || '-'}\n`
      txt += `FAMILIA:         ${item.optitem_produto_familia || '-'}\n`
      txt += '=============================\n'
    })

    const robo = itens.length > 0 && itens[0].optitem_robo ? itens[0].optitem_robo : 'SISTEMA'
    txt += `PROCESSADO EM:   ${processadoEm} - ${robo}\n`
    txt += `Mach-9 Tecnologia - agentepetronect.com - versão: ${APP_CONFIG.system.version}\n`
    txt += '######################################## FIM ########################################\n'

    return txt
  }

  // Download em lote (ZIP)
  const handleDownloadAll = async () => {
    setIsDownloadModalOpen(true)
    setIsDownloading(true)
    downloadCancelledRef.current = false

    try {
      const zip = new JSZip()

      // Processar cada oportunidade
      for (const op of oportunidades) {
        if (downloadCancelledRef.current) {
          break
        }

        try {
          const txtContent = await generateTxtContent(op)
          zip.file(`${op.opt_numero}.txt`, txtContent)
        } catch (err) {
          console.error(`Erro ao processar OP ${op.opt_numero}:`, err)
        }
      }

      if (!downloadCancelledRef.current) {
        // Gerar o ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' })

        // Nome do arquivo com data e hora
        const now = new Date()
        const dataHora = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

        // Baixar arquivo
        const url = window.URL.createObjectURL(zipBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `OPORTUNIDADES_${dataHora}.ZIP`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }

    } catch (err: any) {
      if (!downloadCancelledRef.current) {
        setError(err.message || 'Erro ao gerar arquivo ZIP')
      }
    } finally {
      setIsDownloading(false)
      // Fechar modal após 2 segundos
      setTimeout(() => {
        setIsDownloadModalOpen(false)
      }, 2000)
    }
  }

  const handleCancelDownload = () => {
    downloadCancelledRef.current = true
    setIsDownloading(false)
    setIsDownloadModalOpen(false)
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
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
            <button
              onClick={handleDownloadAll}
              disabled={!hasFiltered || oportunidades.length === 0}
              className="h-9 px-3 inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
              title={!hasFiltered ? 'Aplique um filtro para habilitar' : 'Baixar todas as oportunidades filtradas'}
            >
              <i className="fas fa-download"></i>
              <span className="hidden md:inline">Baixar</span>
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
                      <div>{formatDate(op.opt_datainicio)}</div>
                      <div className="text-xs text-gray-400 dark:text-[#888888]">{op.opt_horainicio || '00:00:00'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd] text-center">
                      <div>{formatDate(op.opt_datafim)}</div>
                      <div className="text-xs text-gray-400 dark:text-[#888888]">{op.opt_horafim || '00:00:00'}</div>
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
                          onClick={() => handleDownloadTxt(op)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                          title="Download TXT"
                        >
                          <i className="fas fa-file-alt"></i>
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
          <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-200 bg-white dark:border-[#444444] dark:bg-[#2a2a2a]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
              {/* Info - compacto no mobile */}
              <div className="text-sm md:text-sm text-gray-600 dark:text-[#cccccc]">
                <span className="font-semibold">{((pagination.page - 1) * pagination.limit) + 1}</span>-<span className="font-semibold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> de{' '}
                <span className="font-semibold">{pagination.total}</span>
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-3 md:gap-4">
                {/* Items per page - oculto no mobile */}
                <div className="hidden md:flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-[#cccccc] whitespace-nowrap">Itens por página:</label>
                  <select
                    value={pagination.limit}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
                  >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 md:px-3 md:py-2 rounded-lg border border-gray-300 bg-white dark:bg-[#333333] dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-left text-sm"></i>
                  </button>

                  {/* Page numbers - simplificado no mobile */}
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
                            className={`px-3 py-2 md:px-4 md:py-2 rounded-lg text-sm font-medium transition-colors ${
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
                          <span key={page} className="px-1.5 md:px-2 py-2 text-gray-500 text-sm">
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
                    className="px-3 py-2 md:px-3 md:py-2 rounded-lg border border-gray-300 bg-white dark:bg-[#333333] dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-right text-sm"></i>
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

      {/* Modal de Download em Lote */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-xl shadow-2xl max-w-md w-full p-6 fade-in">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-teal-100 dark:bg-teal-900/30">
              <i className="fas fa-download text-teal-600 dark:text-teal-400 text-2xl animate-bounce"></i>
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-[#eeeeee] mb-2">
              Baixando Oportunidades
            </h3>
            <p className="text-sm text-center text-gray-600 dark:text-[#aaaaaa] mb-6">
              Aguarde enquanto preparamos o lote de oportunidades para ser baixado.
            </p>
            <div className="flex justify-center mb-4">
              <i className="fas fa-spinner fa-spin text-3xl text-teal-600"></i>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleCancelDownload}
                className="px-6 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão Voltar ao Topo */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          title="Voltar ao topo"
        >
          <i className="fas fa-arrow-up"></i>
        </button>
      )}
    </>
  )
}
