'use client'

import { useState, useEffect } from 'react'
import api from '@/config/api'

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
  optitem_dataedicao: string
  optitem_iduser: number
}

interface OportunidadeItensModalProps {
  isOpen: boolean
  onClose: () => void
  oportunidade: {
    opt_id: number
    opt_numero: string
    opt_descricao: string
    opt_datainicio: string
    opt_datafim: string
    opt_status: number
  } | null
}

export default function OportunidadeItensModal({ isOpen, onClose, oportunidade }: OportunidadeItensModalProps) {
  const [itens, setItens] = useState<OportunidadeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado para modal de comentário
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<OportunidadeItem | null>(null)
  const [comentario, setComentario] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen && oportunidade) {
      fetchItens()
    }
  }, [isOpen, oportunidade])

  const fetchItens = async () => {
    if (!oportunidade) return

    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await api.get(`/oportunidades/${oportunidade.opt_id}/itens`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        setItens(res.data.data)
      } else {
        setError('Falha ao buscar itens')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar itens')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const getStatusLabel = (status: number) => {
    return status === 1 ? 'Completa' : 'Baixando'
  }

  const handleOpenCommentModal = (item: OportunidadeItem) => {
    setSelectedItem(item)
    setComentario(item.optitem_obs || '')
    setIsCommentModalOpen(true)
  }

  const handleCloseCommentModal = () => {
    setIsCommentModalOpen(false)
    setSelectedItem(null)
    setComentario('')
  }

  const handleSaveComment = async () => {
    if (!selectedItem) return

    setIsSaving(true)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await api.put(
        `/oportunidades/itens/${selectedItem.optitem_id}`,
        { optitem_obs: comentario },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data && res.data.success) {
        // Atualiza o item na lista local
        setItens(prev => prev.map(item =>
          item.optitem_id === selectedItem.optitem_id
            ? { ...item, optitem_obs: comentario }
            : item
        ))
        handleCloseCommentModal()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao salvar comentário')
    } finally {
      setIsSaving(false)
    }
  }

  // Navegação entre itens
  const getCurrentItemIndex = () => {
    if (!selectedItem) return -1
    return itens.findIndex(item => item.optitem_id === selectedItem.optitem_id)
  }

  const handlePreviousItem = () => {
    const currentIndex = getCurrentItemIndex()
    if (currentIndex > 0) {
      const prevItem = itens[currentIndex - 1]
      setSelectedItem(prevItem)
      setComentario(prevItem.optitem_obs || '')
    }
  }

  const handleNextItem = () => {
    const currentIndex = getCurrentItemIndex()
    if (currentIndex < itens.length - 1) {
      const nextItem = itens[currentIndex + 1]
      setSelectedItem(nextItem)
      setComentario(nextItem.optitem_obs || '')
    }
  }

  if (!isOpen || !oportunidade) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col fade-in">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-[#444444] flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
                Oportunidade
              </h2>
              <span className="text-sm text-gray-500 dark:text-[#aaaaaa]">
                Nº {oportunidade.opt_numero}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchItens}
                disabled={loading}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition disabled:opacity-50"
                title="Atualizar lista"
              >
                <i className={`fas fa-sync-alt text-gray-500 dark:text-[#aaaaaa] ${loading ? 'fa-spin' : ''}`}></i>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
                title="Fechar"
              >
                <i className="fas fa-times text-gray-500 dark:text-[#aaaaaa]"></i>
              </button>
            </div>
          </div>

          {/* Info da Oportunidade */}
          <div className="px-6 py-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Descrição */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                  Descrição
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee] truncate" title={oportunidade.opt_descricao}>
                  {oportunidade.opt_descricao || '-'}
                </div>
              </div>

              {/* Data Início */}
              <div className="w-[120px]">
                <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                  Data Início
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                  {formatDate(oportunidade.opt_datainicio)}
                </div>
              </div>

              {/* Data Fim */}
              <div className="w-[120px]">
                <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                  Data Fim
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                  {formatDate(oportunidade.opt_datafim)}
                </div>
              </div>

              {/* Status */}
              <div className="w-[100px]">
                <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                  Status
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                  {getStatusLabel(oportunidade.opt_status)}
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="h-[320px] overflow-auto px-6 py-4 scrollbar-gray">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="fas fa-spinner fa-spin text-2xl text-teal-600"></i>
                <span className="ml-3 text-gray-600 dark:text-[#aaaaaa]">Carregando itens...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-500">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </div>
            ) : itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <i className="fas fa-inbox text-4xl mb-3"></i>
                <p>Nenhum item encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#444444]">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-[#cccccc]">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-[#cccccc]">
                      Descrição produto
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-[#cccccc]">
                      Família
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-[#cccccc]">
                      Qtd
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-[#cccccc]">
                      Un
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-[#cccccc]">

                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#444444]">
                  {itens.map((item) => (
                    <tr key={item.optitem_id} className="hover:bg-gray-50 dark:hover:bg-[#333333]">
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#dddddd]">
                        {item.optitem_item}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#dddddd]">
                        {item.optitem_descricao}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#dddddd]">
                        {item.optitem_produto_familia || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#dddddd]">
                        {item.optitem_quantidade}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-[#dddddd]">
                        {item.optitem_unidade}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenCommentModal(item)}
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                            item.optitem_obs
                              ? 'bg-teal-600 hover:bg-teal-700 text-white'
                              : 'bg-gray-200 hover:bg-gray-300 dark:bg-[#444444] dark:hover:bg-[#555555] text-gray-600 dark:text-[#cccccc]'
                          }`}
                          title={item.optitem_obs ? 'Editar comentário' : 'Adicionar comentário'}
                        >
                          <i className="fas fa-comment"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#444444] flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-[#aaaaaa]">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Comentário */}
      {isCommentModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden fade-in">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#444444] flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-[#eeeeee]">
                  Comentário do Item
                </h3>
                <span className="text-sm text-gray-500 dark:text-[#aaaaaa]">
                  Item {selectedItem.optitem_item}
                </span>
              </div>
              <button
                onClick={handleCloseCommentModal}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
                title="Fechar"
              >
                <i className="fas fa-times text-gray-500 dark:text-[#aaaaaa]"></i>
              </button>
            </div>

            {/* Info do Item */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Robô de Resgate */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                    Robô de Resgate
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                    {selectedItem.optitem_robo || '-'}
                  </div>
                </div>

                {/* Data Hora Resgate */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                    Data Hora Resgate
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee]">
                    {formatDateTime(selectedItem.optitem_dataresgate)}
                  </div>
                </div>
              </div>
            </div>

            {/* Descrição Completa */}
            {selectedItem.optitem_descricao_completa && (
              <div className="px-6 pt-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                  Descrição Completa
                </label>
                <div className="px-3 py-2 bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444444] rounded-lg text-sm text-gray-700 dark:text-[#eeeeee] max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                  {selectedItem.optitem_descricao_completa}
                </div>
              </div>
            )}

            {/* Comentário */}
            <div className="px-6 pt-4 pb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
                Comentário
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Digite seu comentário sobre este item..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] resize-none"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-[#444444] flex justify-between items-center">
              {/* Navegação entre itens */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousItem}
                  disabled={isSaving || getCurrentItemIndex() <= 0}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Item anterior"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <span className="text-sm text-gray-500 dark:text-[#aaaaaa] min-w-[60px] text-center">
                  {getCurrentItemIndex() + 1} / {itens.length}
                </span>
                <button
                  onClick={handleNextItem}
                  disabled={isSaving || getCurrentItemIndex() >= itens.length - 1}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Próximo item"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>

              {/* Botões de ação */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseCommentModal}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveComment}
                  disabled={isSaving}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i>
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
