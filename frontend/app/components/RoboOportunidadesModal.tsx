'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface OportunidadeEspecifica {
  opesp_id: number
  opesp_numero: string
  opesp_robo_id: number
  opesp_ordem: number
  opesp_datacadastro: string
}

interface RoboOportunidadesModalProps {
  isOpen: boolean
  onClose: () => void
  robo: {
    robo_id: number
    robo_nome: string
  } | null
}

export default function RoboOportunidadesModal({ isOpen, onClose, robo }: RoboOportunidadesModalProps) {
  const [oportunidades, setOportunidades] = useState<OportunidadeEspecifica[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [novoNumero, setNovoNumero] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [draggedItem, setDraggedItem] = useState<OportunidadeEspecifica | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Modal de confirmação para oportunidade em outro robô
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [pendingNumero, setPendingNumero] = useState('')

  // Controle de fade para mensagem de erro
  const [errorFading, setErrorFading] = useState(false)

  // Modal de feedback para oportunidades não cadastradas
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{
    cadastradas: string[]
    naoPermitidas: { numero: string; motivo: string }[]
  }>({ cadastradas: [], naoPermitidas: [] })

  useEffect(() => {
    if (isOpen && robo) {
      fetchOportunidades()
      setNovoNumero('')
    }
  }, [isOpen, robo])

  // Ocultar mensagem de erro após 5 segundos com fade
  useEffect(() => {
    if (error) {
      setErrorFading(false)
      // Inicia o fade após 4 segundos
      const fadeTimer = setTimeout(() => {
        setErrorFading(true)
      }, 4000)
      // Remove o erro após 5 segundos
      const removeTimer = setTimeout(() => {
        setError(null)
        setErrorFading(false)
      }, 5000)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    }
  }, [error])

  const fetchOportunidades = async () => {
    if (!robo) return

    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.get(`${API_DOMAIN}/robos/${robo.robo_id}/oportunidades-especificas`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        setOportunidades(res.data.data)
      } else {
        setError('Falha ao buscar oportunidades')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar oportunidades')
    } finally {
      setLoading(false)
    }
  }

  // Função para separar múltiplas oportunidades do input
  const parseNumeros = (input: string): string[] => {
    // Separa por vírgula, traço, quebra de linha (\n) ou carriage return (\r)
    return input
      .split(/[,\-\n\r]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0)
  }

  const handleAddOportunidade = async (forceAdd = false) => {
    const inputValue = forceAdd ? pendingNumero : novoNumero.trim()
    if (!robo || !inputValue) return

    // Parse múltiplos números
    const numeros = parseNumeros(inputValue)
    if (numeros.length === 0) return

    setIsAdding(true)
    setError(null)

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.post(
        `${API_DOMAIN}/robos/${robo.robo_id}/oportunidades-especificas/lote`,
        { numeros },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data && res.data.success) {
        // Adiciona as oportunidades cadastradas com sucesso
        if (res.data.data.cadastradas && res.data.data.cadastradas.length > 0) {
          setOportunidades(prev => [...prev, ...res.data.data.cadastradas])
        }

        // Se houver oportunidades não cadastradas, mostra o modal de feedback
        if (res.data.data.naoPermitidas && res.data.data.naoPermitidas.length > 0) {
          setFeedbackData({
            cadastradas: res.data.data.cadastradas.map((op: OportunidadeEspecifica) => op.opesp_numero),
            naoPermitidas: res.data.data.naoPermitidas
          })
          setShowFeedbackModal(true)
        }

        setNovoNumero('')
        setPendingNumero('')
        setShowConfirmModal(false)
        inputRef.current?.focus()
      } else {
        setError(res.data?.message || 'Falha ao adicionar oportunidades')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao adicionar oportunidades')
    } finally {
      setIsAdding(false)
    }
  }

  const handleConfirmAdd = () => {
    handleAddOportunidade(true)
  }

  const handleCancelConfirm = () => {
    setShowConfirmModal(false)
    setPendingNumero('')
    setConfirmMessage('')
  }

  const handleRemoveOportunidade = async (opespId: number) => {
    if (!robo) return

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.delete(
        `${API_DOMAIN}/robos/${robo.robo_id}/oportunidades-especificas/${opespId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data && res.data.success) {
        setOportunidades(prev => prev.filter(op => op.opesp_id !== opespId))
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao remover oportunidade')
    }
  }

  const handleDragStart = (e: React.DragEvent, item: OportunidadeEspecifica) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.opesp_id.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)

    if (!draggedItem || !robo) return

    const sourceIndex = oportunidades.findIndex(op => op.opesp_id === draggedItem.opesp_id)
    if (sourceIndex === targetIndex) return

    // Reordenar localmente
    const newOportunidades = [...oportunidades]
    newOportunidades.splice(sourceIndex, 1)
    newOportunidades.splice(targetIndex, 0, draggedItem)

    // Atualizar ordem
    const reorderedItems = newOportunidades.map((op, index) => ({
      ...op,
      opesp_ordem: index + 1
    }))

    setOportunidades(reorderedItems)
    setDraggedItem(null)

    // Salvar no backend
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      await axios.put(
        `${API_DOMAIN}/robos/${robo.robo_id}/oportunidades-especificas/reorder`,
        { items: reorderedItems.map(op => ({ opesp_id: op.opesp_id, opesp_ordem: op.opesp_ordem })) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (err: any) {
      console.error('Erro ao reordenar:', err)
      // Reverter em caso de erro
      fetchOportunidades()
    }
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverIndex(null)
  }

  if (!isOpen || !robo) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#444444] flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
              Oportunidades Específicas
            </h2>
            <span className="text-sm text-gray-500 dark:text-[#aaaaaa]">
              {robo.robo_nome}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
            title="Fechar"
          >
            <i className="fas fa-times text-gray-500 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Campo para adicionar */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#444444]">
          <label className="block text-sm font-medium text-gray-600 dark:text-[#aaaaaa] mb-1">
            Adicionar Oportunidade
          </label>
          <p className="text-xs text-gray-500 dark:text-[#888888] mb-2">
            Para cadastrar mais de uma oportunidade, separe por vírgula, traço ou quebra de linha.
          </p>
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={novoNumero}
              onChange={(e) => setNovoNumero(e.target.value)}
              placeholder="Nº da oportunidade..."
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] resize-none"
            />
            <button
              onClick={() => handleAddOportunidade(false)}
              disabled={isAdding || !novoNumero.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
            >
              {isAdding ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-plus"></i>
              )}
            </button>
          </div>
          {error && (
            <p className={`mt-2 text-sm text-red-500 transition-opacity duration-1000 ${errorFading ? 'opacity-0' : 'opacity-100'}`}>
              <i className="fas fa-exclamation-circle mr-1"></i>
              {error}
            </p>
          )}
        </div>

        {/* Lista de oportunidades */}
        <div className="flex-1 overflow-auto px-6 py-4 max-h-[250px] scrollbar-teal">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <i className="fas fa-spinner fa-spin text-2xl text-teal-600"></i>
              <span className="ml-3 text-gray-600 dark:text-[#aaaaaa]">Carregando...</span>
            </div>
          ) : oportunidades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <i className="fas fa-list text-4xl mb-3"></i>
              <p>Nenhuma oportunidade cadastrada</p>
              <p className="text-sm mt-1">Adicione oportunidades no campo acima</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-[#888888] mb-3">
                <i className="fas fa-info-circle mr-1"></i>
                Arraste os itens para reordenar
              </p>
              {oportunidades.map((op, index) => (
                <div
                  key={op.opesp_id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, op)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all cursor-move ${
                    draggedItem?.opesp_id === op.opesp_id
                      ? 'opacity-50 border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : dragOverIndex === index
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                      : 'border-gray-200 dark:border-[#444444] bg-gray-50 dark:bg-[#333333] hover:border-gray-300 dark:hover:border-[#555555]'
                  }`}
                >
                  {/* Grip handle */}
                  <div className="text-gray-400 dark:text-[#666666]">
                    <i className="fas fa-grip-vertical"></i>
                  </div>

                  {/* Ordem */}
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>

                  {/* Número */}
                  <div className="flex-1">
                    <span className="font-medium text-gray-800 dark:text-[#eeeeee]">
                      {op.opesp_numero}
                    </span>
                  </div>

                  {/* Botão remover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveOportunidade(op.opesp_id)
                    }}
                    className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                    title="Remover"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-[#444444] flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-[#aaaaaa]">
            {oportunidades.length} {oportunidades.length === 1 ? 'oportunidade' : 'oportunidades'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal de Feedback - Oportunidades não cadastradas */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-xl shadow-2xl max-w-lg w-full p-6 fade-in">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <i className="fas fa-info-circle text-amber-600 dark:text-amber-400 text-xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-[#eeeeee] mb-4">
              Resultado do Cadastro
            </h3>

            {/* Cadastradas com sucesso */}
            {feedbackData.cadastradas.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-check-circle text-green-500"></i>
                  <span className="text-sm font-medium text-gray-700 dark:text-[#dddddd]">
                    Cadastradas com sucesso ({feedbackData.cadastradas.length}):
                  </span>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 max-h-24 overflow-auto">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    {feedbackData.cadastradas.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Não cadastradas */}
            {feedbackData.naoPermitidas.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-times-circle text-red-500"></i>
                  <span className="text-sm font-medium text-gray-700 dark:text-[#dddddd]">
                    Não cadastradas ({feedbackData.naoPermitidas.length}):
                  </span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 max-h-32 overflow-auto">
                  <ul className="space-y-1">
                    {feedbackData.naoPermitidas.map((item, index) => (
                      <li key={index} className="text-sm text-red-700 dark:text-red-400">
                        <strong>{item.numero}</strong>: {item.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowFeedbackModal(false)}
              className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
