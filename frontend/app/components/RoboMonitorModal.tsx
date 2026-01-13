'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import axios from 'axios'
import { APP_CONFIG } from '../../config/app.config'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface Agente {
  robo_id: number
  robo_nome: string
  robo_tipo: number
  robo_status: number
  robo_user: string
}

interface HistoricoItem {
  hist_id: number
  hist_mensagem: string
  hist_datacriacao: string
}

interface ProcessoInfo {
  proc_id: number
  proc_op_numero: string | null
  proc_item_atual: number
  proc_total_itens: number
  proc_status: 'idle' | 'running' | 'error' | 'completed'
  proc_ultima_atualizacao: string
}

interface VerificationStatus {
  needsCode: boolean
  status: 'none' | 'waiting' | 'submitted'
  requestedAt: string | null
}

interface RoboMonitorModalProps {
  isOpen: boolean
  onClose: () => void
  onStatusChange?: () => void
}

export default function RoboMonitorModal({ isOpen, onClose, onStatusChange }: RoboMonitorModalProps) {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [selectedAgente, setSelectedAgente] = useState<Agente | null>(null)
  const [loading, setLoading] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [historicoLimit, setHistoricoLimit] = useState(25)
  const [processo, setProcesso] = useState<ProcessoInfo | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Estados para verificação de código
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationTimer, setVerificationTimer] = useState(40)
  const [verificationDismissed, setVerificationDismissed] = useState(false)

  // Refs para intervalos
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const historicoIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processoIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const screenshotDelayRef = useRef<NodeJS.Timeout | null>(null)
  const agentesIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastHistoricoIdRef = useRef<number>(0)
  const showVerificationModalRef = useRef<boolean>(false)
  const verificationDismissedRef = useRef<boolean>(false)
  const currentPollingAgenteIdRef = useRef<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const historicoContainerRef = useRef<HTMLDivElement | null>(null)

  // Buscar todos os agentes
  const fetchAgentes = async (isPolling = false) => {
    // Só mostrar loading na primeira carga
    if (!isPolling) {
      setLoading(true)
    }
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.get(`${API_DOMAIN}/robos?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        setAgentes(res.data.data)

        // Só seleciona automaticamente se não tem nenhum selecionado
        if (!isPolling && res.data.data.length > 0 && !selectedAgente) {
          setSelectedAgente(res.data.data[0])
        }
      }
    } catch (error) {
      console.error('Erro ao buscar agentes:', error)
    } finally {
      if (!isPolling) {
        setLoading(false)
      }
    }
  }

  // Buscar screenshot do agente (converte para base64 para incluir autenticação)
  const fetchScreenshot = async (agenteId: number) => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const timestamp = new Date().getTime()
      const url = `${API_DOMAIN}/robos/${agenteId}/screenshot?t=${timestamp}`

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        // Converter para blob e depois para data URL
        const blob = await response.blob()
        const reader = new FileReader()
        reader.onloadend = () => {
          setScreenshotUrl(reader.result as string)
          setScreenshotError(false)
        }
        reader.readAsDataURL(blob)
      } else {
        setScreenshotUrl(null)
        setScreenshotError(true)
      }
    } catch (error) {
      setScreenshotUrl(null)
      setScreenshotError(true)
    }
  }

  // Buscar historico do agente (apenas se houver novos registros)
  const fetchHistorico = async (agenteId: number, forceUpdate = false) => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      // Primeiro, verificar se há novos registros
      const checkRes = await axios.get(`${API_DOMAIN}/robos/${agenteId}/historico?limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (checkRes.data && checkRes.data.success && checkRes.data.data.length > 0) {
        const latestId = checkRes.data.data[0].hist_id

        // Só buscar lista completa se houver novos registros ou for forceUpdate
        if (forceUpdate || latestId !== lastHistoricoIdRef.current) {
          const res = await axios.get(`${API_DOMAIN}/robos/${agenteId}/historico?limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          })

          if (res.data && res.data.success) {
            setHistorico(res.data.data)
            lastHistoricoIdRef.current = latestId
          }
        }
      } else if (forceUpdate) {
        // Se não há registros e é forceUpdate, limpar a lista
        setHistorico([])
        lastHistoricoIdRef.current = 0
      }
    } catch (error) {
      console.error('Erro ao buscar historico:', error)
    }
  }

  // Buscar processo do agente
  const fetchProcesso = async (agenteId: number) => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.get(`${API_DOMAIN}/robos/${agenteId}/processo`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        setProcesso(res.data.data)
      }
    } catch (error) {
      console.error('Erro ao buscar processo:', error)
    }
  }

  // Verificar se agente precisa de código de verificação
  const checkVerificationStatus = async (agenteId: number) => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.get(`${API_DOMAIN}/robos/${agenteId}/verification-status`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      console.log('[Monitor] Verificação status:', res.data, 'modalRef:', showVerificationModalRef.current, 'dismissedRef:', verificationDismissedRef.current)

      if (res.data && res.data.success && res.data.needsCode) {
        // Só abre o modal se ainda não estiver aberto e não foi fechado pelo usuário
        // Usa refs para evitar closure stale
        if (!showVerificationModalRef.current && !verificationDismissedRef.current) {
          console.log('[Monitor] Código de verificação solicitado - abrindo modal')
          setShowVerificationModal(true)
          showVerificationModalRef.current = true
        }
      } else {
        // Se não precisa mais de código, resetar o dismissed
        if (verificationDismissedRef.current) {
          setVerificationDismissed(false)
          verificationDismissedRef.current = false
        }
      }
    } catch (error) {
      console.error('[Monitor] Erro ao verificar status:', error)
    }
  }

  // Cancelar solicitação de código no backend
  const cancelVerificationRequest = async (agenteId: number) => {
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      await axios.post(
        `${API_DOMAIN}/robos/${agenteId}/cancel-verification`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (error) {
      // Silencioso
    }
  }

  // Fechar modal de verificação (quando usuário cancela)
  const closeVerificationModal = () => {
    setShowVerificationModal(false)
    showVerificationModalRef.current = false
    setVerificationCode('')
    setVerificationDismissed(true)
    verificationDismissedRef.current = true
    if (selectedAgente) {
      cancelVerificationRequest(selectedAgente.robo_id)
    }
  }

  // Enviar código de verificação
  const submitVerificationCode = async () => {
    if (!selectedAgente || !verificationCode.trim()) return

    setVerificationLoading(true)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.post(
        `${API_DOMAIN}/robos/${selectedAgente.robo_id}/verification-code`,
        { code: verificationCode.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data && res.data.success) {
        setShowVerificationModal(false)
        showVerificationModalRef.current = false
        setVerificationCode('')
      } else {
        alert(res.data?.message || 'Erro ao enviar código')
      }
    } catch (error: any) {
      console.error('Erro ao enviar código:', error)
      alert(error.response?.data?.message || 'Erro ao enviar código')
    } finally {
      setVerificationLoading(false)
    }
  }

  // Conectar ao SSE para receber notificações em tempo real
  const connectToSSE = (agenteId: number) => {
    // Fechar conexão anterior se existir
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // SSE é rota pública (EventSource não suporta headers customizados)
    const sseUrl = `${API_DOMAIN}/robos/${agenteId}/events`

    console.log(`[Monitor] Conectando ao SSE para agente ${agenteId}`)

    const eventSource = new EventSource(sseUrl)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log(`[Monitor] SSE conectado para agente ${agenteId}`)
    }

    eventSource.onerror = (error) => {
      console.error(`[Monitor] Erro SSE:`, error)
      // Tentar reconectar após 5 segundos
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          console.log(`[Monitor] Tentando reconectar SSE...`)
          connectToSSE(agenteId)
        }
      }, 5000)
    }

    // Evento de conexão estabelecida
    eventSource.addEventListener('connected', (event) => {
      console.log(`[Monitor] SSE evento connected:`, event.data)
    })

    // Evento de heartbeat (manter conexão viva)
    eventSource.addEventListener('heartbeat', () => {
      // Silencioso - apenas para manter conexão
    })

    // EVENTO PRINCIPAL: Verificação necessária
    eventSource.addEventListener('verification-needed', (event) => {
      console.log(`[Monitor] SSE evento verification-needed:`, event.data)

      // Só abre o modal se ainda não estiver aberto e não foi fechado pelo usuário
      if (!showVerificationModalRef.current && !verificationDismissedRef.current) {
        console.log('[Monitor] Código de verificação solicitado via SSE - abrindo modal')
        setShowVerificationModal(true)
        showVerificationModalRef.current = true
      }
    })
  }

  // Iniciar polling de screenshot (só quando agente está rodando)
  const startScreenshotPolling = (agenteId: number, delay: number = 0) => {
    // Limpar polling anterior
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current)
      screenshotIntervalRef.current = null
    }
    if (screenshotDelayRef.current) {
      clearTimeout(screenshotDelayRef.current)
      screenshotDelayRef.current = null
    }

    // Aplicar delay antes de começar a buscar screenshots
    screenshotDelayRef.current = setTimeout(() => {
      fetchScreenshot(agenteId)
      screenshotIntervalRef.current = setInterval(() => fetchScreenshot(agenteId), 5000)
    }, delay)
  }

  // Parar polling de screenshot
  const stopScreenshotPolling = () => {
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current)
      screenshotIntervalRef.current = null
    }
    if (screenshotDelayRef.current) {
      clearTimeout(screenshotDelayRef.current)
      screenshotDelayRef.current = null
    }
    // Limpar imagem quando parar
    setScreenshotUrl(null)
    setScreenshotError(false)
  }

  // Limpar apenas os intervalos (sem resetar o ref do agente)
  const stopPollingIntervals = () => {
    console.log('[Monitor] stopPollingIntervals chamado')

    // Fechar conexão SSE
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current)
      screenshotIntervalRef.current = null
    }
    if (screenshotDelayRef.current) {
      clearTimeout(screenshotDelayRef.current)
      screenshotDelayRef.current = null
    }
    if (historicoIntervalRef.current) {
      clearInterval(historicoIntervalRef.current)
      historicoIntervalRef.current = null
    }
    if (processoIntervalRef.current) {
      clearInterval(processoIntervalRef.current)
      processoIntervalRef.current = null
    }
  }

  // Iniciar polling quando agente selecionado
  const startPolling = (agenteId: number, agenteRunning: boolean) => {
    console.log(`[Monitor] startPolling chamado para agente ${agenteId}, running: ${agenteRunning}`)

    // Sempre limpar intervalos anteriores primeiro
    stopPollingIntervals()

    // Marcar qual agente está sendo monitorado
    currentPollingAgenteIdRef.current = agenteId

    // Resetar último ID do histórico
    lastHistoricoIdRef.current = 0

    // Conectar ao SSE para notificações em tempo real (verificação de código)
    connectToSSE(agenteId)

    // Buscar histórico e processo imediatamente
    fetchHistorico(agenteId, true)
    fetchProcesso(agenteId)

    // Se estiver rodando, inicia polling de screenshot
    if (agenteRunning) {
      console.log(`[Monitor] Agente ${agenteId} está rodando, iniciando screenshot polling`)
      startScreenshotPolling(agenteId, 0)
    } else {
      // Se não estiver rodando, limpa screenshot
      console.log(`[Monitor] Agente ${agenteId} não está rodando, sem screenshot`)
      setScreenshotUrl(null)
      setScreenshotError(false)
    }

    // Iniciar polling para histórico e processo
    historicoIntervalRef.current = setInterval(() => fetchHistorico(agenteId), 2000)
    processoIntervalRef.current = setInterval(() => fetchProcesso(agenteId), 2000)

    console.log(`[Monitor] Polling iniciado com sucesso para agente ${agenteId}`)
  }

  // Parar polling completamente (reseta o ref do agente)
  const stopPolling = () => {
    console.log('[Monitor] stopPolling chamado')
    currentPollingAgenteIdRef.current = null
    stopPollingIntervals()
  }

  // Fechar com ESC
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      fetchAgentes()

      // Polling para atualizar lista de agentes (detectar mudanças de status)
      agentesIntervalRef.current = setInterval(() => fetchAgentes(true), 3000)
    } else {
      // Resetar ref do agente quando modal fecha
      currentPollingAgenteIdRef.current = null
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
      stopPolling() // Reset completo ao fechar modal
      if (agentesIntervalRef.current) {
        clearInterval(agentesIntervalRef.current)
        agentesIntervalRef.current = null
      }
    }
  }, [isOpen, handleKeyDown])

  // Quando agente selecionado muda (usa robo_id como dependência para garantir re-render)
  useEffect(() => {
    const agenteId = selectedAgente?.robo_id
    console.log('[Monitor] useEffect selectedAgente.robo_id:', agenteId)

    if (agenteId && selectedAgente) {
      const agenteRunning = selectedAgente.robo_status === 1
      setIsRunning(agenteRunning)

      // Resetar verificação ao trocar de agente
      console.log('[Monitor] Iniciando para agente', agenteId, 'running:', agenteRunning)
      setVerificationDismissed(false)
      verificationDismissedRef.current = false
      setShowVerificationModal(false)
      showVerificationModalRef.current = false
      setVerificationCode('')
      setHistoricoLimit(25)

      // Scroll para o topo do histórico
      if (historicoContainerRef.current) {
        historicoContainerRef.current.scrollTop = 0
      }

      // Sempre reiniciar polling ao mudar de agente
      startPolling(agenteId, agenteRunning)
    } else {
      console.log('[Monitor] Nenhum agente selecionado, parando polling')
      stopPolling()
      setHistorico([])
      setHistoricoLimit(25)
      setProcesso(null)
      setScreenshotUrl(null)
    }
  }, [selectedAgente?.robo_id])

  // Timer para fechar o modal de verificação após 40 segundos
  useEffect(() => {
    if (showVerificationModal) {
      setVerificationTimer(60)
      verificationTimerRef.current = setInterval(() => {
        setVerificationTimer((prev) => {
          if (prev <= 1) {
            clearInterval(verificationTimerRef.current!)
            // Fechar e cancelar ao expirar
            setShowVerificationModal(false)
            showVerificationModalRef.current = false
            setVerificationCode('')
            setVerificationDismissed(true)
            verificationDismissedRef.current = true
            if (selectedAgente) {
              cancelVerificationRequest(selectedAgente.robo_id)
            }
            return 60
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current)
      }
      setVerificationTimer(60)
    }

    return () => {
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current)
      }
    }
  }, [showVerificationModal])

  // Iniciar bot
  const startBot = async () => {
    if (!selectedAgente || actionLoading) return

    setActionLoading(true)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.post(
        `${API_DOMAIN}/robos/${selectedAgente.robo_id}/start`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data && res.data.success) {
        onStatusChange?.()

        // Força restart do polling após 1 segundo
        const currentAgente = selectedAgente
        setTimeout(() => {
          setIsRunning(true)
          startPolling(currentAgente.robo_id, true)
        }, 1000)
      } else {
        alert(res.data?.message || 'Erro ao iniciar bot')
      }
    } catch (error: any) {
      console.error('Erro ao iniciar bot:', error)
      alert(error.response?.data?.message || 'Erro ao iniciar bot')
    } finally {
      setActionLoading(false)
    }
  }

  // Parar bot
  const stopBot = async () => {
    if (!selectedAgente || actionLoading) return

    setActionLoading(true)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.post(
        `${API_DOMAIN}/robos/${selectedAgente.robo_id}/stop`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (res.data && res.data.success) {
        setIsRunning(false)
        await fetchAgentes(true)
        onStatusChange?.()
      } else {
        alert(res.data?.message || 'Erro ao parar bot')
      }
    } catch (error: any) {
      console.error('Erro ao parar bot:', error)
      alert(error.response?.data?.message || 'Erro ao parar bot')
    } finally {
      setActionLoading(false)
    }
  }

  // Formatar data/hora do historico
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const dia = date.getDate().toString().padStart(2, '0')
    const mes = (date.getMonth() + 1).toString().padStart(2, '0')
    const ano = date.getFullYear()
    const hora = date.getHours().toString().padStart(2, '0')
    const min = date.getMinutes().toString().padStart(2, '0')
    const seg = date.getSeconds().toString().padStart(2, '0')
    return {
      data: `${dia}/${mes}/${ano}`,
      hora: `${hora}:${min}:${seg}`
    }
  }

  // Calcular progresso
  const getProgressPercent = () => {
    if (!processo || processo.proc_total_itens === 0) return 0
    return Math.round((processo.proc_item_atual / processo.proc_total_itens) * 100)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex flex-col">
      {/* Estilos customizados para scrollbar */}
      <style jsx>{`
        .teal-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .teal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          border-radius: 4px;
        }
        .teal-scrollbar::-webkit-scrollbar-thumb {
          background: #0d9488;
          border-radius: 4px;
        }
        .teal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #0f766e;
        }
        .dark .teal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-[#333333]">
        <div className="flex items-center gap-3">
          {APP_CONFIG.branding.sidebarLogo.type === 'icon' ? (
            <i className={`fas ${APP_CONFIG.branding.sidebarLogo.icon} text-2xl text-teal-600 dark:text-teal-400`}></i>
          ) : (
            <img
              src={APP_CONFIG.branding.sidebarLogo.image}
              alt="Logo"
              className="w-8 h-8"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Monitor de Agentes</h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Pressione <kbd className="px-2 py-1 bg-gray-100 dark:bg-[#333333] rounded text-gray-600 dark:text-gray-300 text-xs font-mono">ESC</kbd> para fechar
          </span>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition-colors"
            title="Fechar"
          >
            <i className="fas fa-times text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-lg"></i>
          </button>
        </div>
      </div>

      {/* Botoes dos Agentes */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-[#222222] border-b border-gray-200 dark:border-[#333333]">
        <div className="flex items-center gap-2 flex-wrap">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <i className="fas fa-spinner fa-spin"></i>
              <span className="text-sm">Carregando agentes...</span>
            </div>
          ) : agentes.length === 0 ? (
            <span className="text-sm text-gray-400 dark:text-gray-500">Nenhum agente cadastrado</span>
          ) : (
            agentes.map((agente) => (
              <button
                key={agente.robo_id}
                onClick={() => setSelectedAgente(agente)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedAgente?.robo_id === agente.robo_id
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#444444]'
                }`}
              >
                <i className="fas fa-robot text-xs"></i>
                <div className="flex flex-col items-start">
                  <span>{agente.robo_nome}</span>
                  {agente.robo_user && (
                    <span className="text-[10px] opacity-70">
                      {agente.robo_user.length > 11 ? `${agente.robo_user.substring(0, 11)}...` : agente.robo_user}
                    </span>
                  )}
                </div>
                {agente.robo_status === 1 && (
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-100 dark:bg-transparent">
        <div className="max-w-7xl mx-auto">
          {selectedAgente ? (
            <div className="flex gap-6">
              {/* Area da Imagem - 60% do tamanho original (1400x900 -> 840x540) */}
              <div className="flex-shrink-0">
                <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-[#333333] overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-gray-50 dark:bg-[#222222] border-b border-gray-200 dark:border-[#333333] flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <i className="fas fa-broadcast-tower mr-2"></i>
                      Real Time
                      {isRunning && <span className="ml-2 text-green-500 animate-pulse">LIVE</span>}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">1400 x 900 px</span>
                  </div>
                  {screenshotUrl && !screenshotError ? (
                    <img
                      src={screenshotUrl}
                      alt="Screenshot do agente"
                      className="w-[840px] h-[540px] object-cover"
                      onError={() => setScreenshotError(true)}
                    />
                  ) : (
                    <div className="w-[840px] h-[540px] bg-gray-100 dark:bg-[#252525] flex flex-col items-center justify-center">
                      <i className="fas fa-image text-gray-300 dark:text-gray-600 text-6xl mb-4"></i>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">Aguardando captura de tela...</p>
                      <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Agente: {selectedAgente.robo_nome}</p>
                    </div>
                  )}
                </div>

                {/* Barra de Progresso */}
                {processo && processo.proc_status === 'running' && processo.proc_total_itens > 0 && (
                  <div className="mt-3 bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-[#333333] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        <i className="fas fa-tasks mr-2"></i>
                        {processo.proc_op_numero ? `OP ${processo.proc_op_numero}` : 'Processando'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {processo.proc_item_atual} / {processo.proc_total_itens} itens ({getProgressPercent()}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-[#333333] rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${getProgressPercent()}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Historico de Acoes */}
              <div className="flex-1 flex flex-col min-w-[350px]">
                <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-[#333333] flex flex-col shadow-sm flex-1">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-[#333333] flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      <i className="fas fa-history mr-2"></i>
                      Historico de Acoes
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {Math.min(historicoLimit, historico.length)} de {historico.length} registros
                    </span>
                  </div>
                  <div ref={historicoContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[480px] teal-scrollbar">
                    {historico.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <i className="fas fa-inbox text-gray-300 dark:text-gray-600 text-3xl mb-2"></i>
                        <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma acao registrada</p>
                      </div>
                    ) : (
                      <>
                        {historico.slice(0, historicoLimit).map((item) => {
                          const { data, hora } = formatDateTime(item.hist_datacriacao)
                          return (
                            <div
                              key={item.hist_id}
                              className="bg-gray-50 dark:bg-[#252525] rounded-lg p-3 border border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444] transition-colors"
                            >
                              <div className="flex items-center gap-2 text-xs text-teal-600 dark:text-teal-500 mb-1">
                                <span>{data}</span>
                                <span>{hora}</span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{item.hist_mensagem}</p>
                            </div>
                          )
                        })}
                        {historico.length > historicoLimit && (
                          <button
                            onClick={() => setHistoricoLimit(prev => prev + 25)}
                            className="w-full py-2 text-sm text-teal-600 dark:text-teal-400 hover:bg-gray-100 dark:hover:bg-[#333333] rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <i className="fas fa-chevron-down text-xs"></i>
                            Ver mais ({Math.min(25, historico.length - historicoLimit)} registros)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Botoes de Controle do Agente */}
                <div className="flex gap-2 mt-3 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isRunning ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {isRunning ? 'Ligado' : 'Desligado'}
                    </span>
                    {processo && processo.proc_status === 'running' && (
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        ({processo.proc_op_numero ? `OP ${processo.proc_op_numero}` : 'Modo data'})
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isRunning ? (
                      <button
                        onClick={stopBot}
                        disabled={actionLoading}
                        className="w-9 h-9 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center"
                        title="Parar agente"
                      >
                        {actionLoading ? (
                          <i className="fas fa-spinner fa-spin text-sm"></i>
                        ) : (
                          <i className="fas fa-stop text-sm"></i>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={startBot}
                        disabled={actionLoading}
                        className="w-9 h-9 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center"
                        title="Iniciar agente"
                      >
                        {actionLoading ? (
                          <i className="fas fa-spinner fa-spin text-sm"></i>
                        ) : (
                          <i className="fas fa-play text-sm"></i>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center mt-20 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-[#333333] flex items-center justify-center mb-4">
                <i className="fas fa-chart-line text-gray-400 dark:text-gray-500 text-3xl"></i>
              </div>
              <p className="text-gray-500 max-w-md">
                Selecione um agente para acompanhar em tempo real sua atividade.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Verificação de Código */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-sm w-full fade-in">
            {/* Header */}
            <div className="px-6 py-4 border-b dark:border-[#444444]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-[#eeeeee]">
                  Código de Verificação
                </h2>
                <span className="text-sm text-green-600 dark:text-green-400 font-mono font-bold">
                  {verificationTimer}s
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Digite o código enviado por e-mail:
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && verificationCode.trim()) {
                    submitVerificationCode()
                  }
                }}
                placeholder="000000"
                className="w-full px-4 py-4 text-center text-2xl font-bold font-mono tracking-widest border-2 border-teal-500 dark:border-teal-600 rounded-lg bg-white dark:bg-[#333333] text-teal-600 dark:text-teal-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                autoFocus
                maxLength={10}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t dark:border-[#444444] flex justify-end gap-3">
              <button
                onClick={closeVerificationModal}
                className="px-5 py-2 border border-gray-300 dark:border-[#444444] rounded-lg hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors text-gray-700 dark:text-[#cccccc]"
              >
                Cancelar
              </button>
              <button
                onClick={submitVerificationCode}
                disabled={!verificationCode.trim() || verificationLoading}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {verificationLoading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <i className="fas fa-check"></i>
                )}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
