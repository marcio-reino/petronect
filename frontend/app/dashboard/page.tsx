'use client'

import { useEffect, useState, useRef } from 'react'
import api from '@/config/api'

interface OportunidadesStats {
  ultimas24h: number
  mesAtual: number
  mesAnterior: number
  percentualVariacao: number
  totalJaBaixadas: number
}

interface AgenteAtivo {
  id: number
  nome: string
  tipo: string
  status: 'working' | 'idle'
  opAtual: string | null
  itemAtual: number
  totalItens: number
  ultimaAcao: string
  ultimaAtualizacao: string | null
}

interface AgentesStats {
  total: number
  ativos: number
  agentes: AgenteAtivo[]
}

interface PetronectStatus {
  status: 'online' | 'offline' | 'checking'
  statusCode: number
  responseTime: number
  checkedAt: string | null
  error?: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<OportunidadesStats>({
    ultimas24h: 0,
    mesAtual: 0,
    mesAnterior: 0,
    percentualVariacao: 0,
    totalJaBaixadas: 0
  })
  const [loading, setLoading] = useState(true)

  // Estados para o card de Agentes
  const [agenteAtualIndex, setAgenteAtualIndex] = useState(0)
  const [agentesStats, setAgentesStats] = useState<AgentesStats>({
    total: 0,
    ativos: 0,
    agentes: []
  })
  const [agentesLoading, setAgentesLoading] = useState(true)
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in')
  const [progressKey, setProgressKey] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const agentesIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const oportunidadesIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Estados para o card de Status do Petronect
  const [petronectStatus, setPetronectStatus] = useState<PetronectStatus>({
    status: 'checking',
    statusCode: 0,
    responseTime: 0,
    checkedAt: null
  })
  const petronectIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchOportunidadesStats(true) // Mostrar loading apenas na primeira carga
    fetchAgentesStats(true) // Mostrar loading apenas na primeira carga
    fetchPetronectStatus() // Verificar status do Petronect

    // Atualizar dados das oportunidades automaticamente a cada 15 segundos
    oportunidadesIntervalRef.current = setInterval(() => {
      fetchOportunidadesStats() // Sem loading nas atualizações automáticas
    }, 15000)

    // Atualizar dados dos agentes automaticamente a cada 5 segundos
    agentesIntervalRef.current = setInterval(() => {
      fetchAgentesStats() // Sem loading nas atualizações automáticas
    }, 5000)

    // Verificar status do Petronect a cada 3 minutos
    petronectIntervalRef.current = setInterval(() => {
      fetchPetronectStatus()
    }, 180000)

    return () => {
      if (oportunidadesIntervalRef.current) {
        clearInterval(oportunidadesIntervalRef.current)
      }
      if (agentesIntervalRef.current) {
        clearInterval(agentesIntervalRef.current)
      }
      if (petronectIntervalRef.current) {
        clearInterval(petronectIntervalRef.current)
      }
    }
  }, [])

  // Filtrar apenas agentes em trabalho para a rotação
  const agentesEmTrabalho = agentesStats.agentes.filter(a => a.status === 'working')

  // Rotação de agentes a cada 10 segundos
  useEffect(() => {
    if (agentesEmTrabalho.length > 1) {
      intervalRef.current = setInterval(() => {
        // Fade out
        setFadeState('out')

        setTimeout(() => {
          setAgenteAtualIndex((prev) => (prev + 1) % agentesEmTrabalho.length)
          setProgressKey((prev) => prev + 1)
          // Fade in
          setFadeState('in')
        }, 300)
      }, 10000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [agentesEmTrabalho.length])

  // Resetar índice quando os agentes mudam
  useEffect(() => {
    if (agenteAtualIndex >= agentesEmTrabalho.length) {
      setAgenteAtualIndex(0)
    }
  }, [agentesEmTrabalho.length, agenteAtualIndex])

  const fetchOportunidadesStats = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await api.get('/oportunidades/stats')

      if (res.data && res.data.success) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const fetchAgentesStats = async (showLoading = false) => {
    if (showLoading) setAgentesLoading(true)
    try {
      const res = await api.get('/robos/dashboard')

      if (res.data && res.data.success) {
        setAgentesStats(res.data.data)
      }
    } catch (error) {
      console.error('Erro ao buscar dados dos agentes:', error)
    } finally {
      if (showLoading) setAgentesLoading(false)
    }
  }

  const fetchPetronectStatus = async () => {
    try {
      // Timeout maior pois a verificação com Playwright pode levar até 30 segundos
      const res = await api.get('/petronect-status', { timeout: 120000 })

      if (res.data && res.data.success) {
        setPetronectStatus(res.data.data)
      }
    } catch (error) {
      console.error('Erro ao verificar status do Petronect:', error)
      setPetronectStatus({
        status: 'offline',
        statusCode: 0,
        responseTime: 0,
        checkedAt: new Date().toISOString(),
        error: 'Erro ao verificar'
      })
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('pt-BR')
  }

  const getVariacaoColor = () => {
    if (stats.percentualVariacao > 0) return 'text-green-600 dark:text-green-400'
    if (stats.percentualVariacao < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  const getVariacaoIcon = () => {
    if (stats.percentualVariacao > 0) return 'fa-arrow-up'
    if (stats.percentualVariacao < 0) return 'fa-arrow-down'
    return 'fa-minus'
  }

  const agenteAtual = agentesEmTrabalho[agenteAtualIndex]
  const totalAgentes = agentesStats.ativos

  return (
    <div className="space-y-8">
      {/* Seção: Bem-vindo */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <i className="fas fa-home text-primary-600"></i>
            Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Bem-vindo ao {process.env.NEXT_PUBLIC_SYSTEM_NAME}
          </p>
        </div>
      </section>

      {/* Cards de Estatísticas */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card: Oportunidades */}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333333] shadow-sm overflow-hidden">
            {/* Header do Card */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-[#333333]">
              <div>
                <h3 className="font-extrabold text-gray-700 dark:text-gray-300 text-3xl">Oportunidades</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Petronect</p>
              </div>
            </div>

            {/* Corpo do Card */}
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <i className="fas fa-spinner fa-spin text-gray-400 text-2xl"></i>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Últimas 24 horas */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <i className="fas fa-clock text-gray-500 dark:text-blue-500 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Últimas 24h</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                          {formatNumber(stats.ultimas24h)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divisor */}
                  <div className="border-t border-gray-100 dark:border-[#333333]"></div>

                  {/* Este Mês */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <i className="fas fa-calendar-alt text-gray-500 dark:text-green-500 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Este Mês</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                          {formatNumber(stats.mesAtual)}
                        </p>
                      </div>
                    </div>
                    {stats.mesAnterior > 0 && (
                      <div className={`flex items-center gap-1 ${getVariacaoColor()}`}>
                        <i className={`fas ${getVariacaoIcon()} text-sm`}></i>
                        <span className="text-sm font-medium">
                          {Math.abs(stats.percentualVariacao).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Divisor */}
                  <div className="border-t border-gray-100 dark:border-[#333333]"></div>

                  {/* Total já baixadas */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                        <i className="fas fa-database text-gray-500 dark:text-purple-500 text-xl"></i>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total já baixadas</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                          {formatNumber(stats.totalJaBaixadas)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mês Anterior (referência) */}
                  {stats.mesAnterior > 0 && (
                    <div className="bg-gray-50 dark:bg-[#252525] rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Mês anterior
                        </span>
                        <span className="text-base font-medium text-gray-600 dark:text-gray-300">
                          {formatNumber(stats.mesAnterior)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Card: Agentes */}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333333] shadow-sm overflow-hidden">
            {/* Header do Card */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-[#333333]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-gray-700 dark:text-gray-300 text-3xl">Agentes</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Em trabalho</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-800 dark:text-white">
                    {agentesLoading ? '-' : totalAgentes}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    de {agentesStats.total} agentes
                  </p>
                </div>
              </div>
            </div>

            {/* Corpo do Card */}
            <div className="p-6">
              {agentesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <i className="fas fa-spinner fa-spin text-gray-400 text-2xl"></i>
                </div>
              ) : agentesEmTrabalho.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-[#252525] rounded-full flex items-center justify-center mb-3">
                    <i className="fas fa-robot text-gray-400 dark:text-gray-500 text-2xl"></i>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum agente em trabalho</p>
                </div>
              ) : (
                <div
                  className={`space-y-4 transition-opacity duration-300 ${fadeState === 'out' ? 'opacity-0' : 'opacity-100'}`}
                >
                  {/* Nome do Agente */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                      <i className="fas fa-robot text-teal-600 dark:text-teal-400"></i>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white">{agenteAtual?.nome}</p>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-green-600 dark:text-green-400">Trabalhando</span>
                      </div>
                    </div>
                  </div>

                  {/* OP Atual */}
                  <div className="bg-gray-50 dark:bg-[#252525] rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">OP em andamento</span>
                      {agenteAtual?.totalItens > 0 && (
                        <span className="text-xs text-teal-600 dark:text-teal-400">
                          Item {agenteAtual.itemAtual} de {agenteAtual.totalItens}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-sm font-medium text-gray-800 dark:text-white">
                      {agenteAtual?.opAtual || 'Aguardando OP'}
                    </p>
                    {agenteAtual?.totalItens > 0 && (
                      <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${(agenteAtual.itemAtual / agenteAtual.totalItens) * 100}%` }}
                        ></div>
                      </div>
                    )}
                  </div>

                  {/* Última Ação */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Última ação</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {agenteAtual?.ultimaAcao}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Card - só exibe se houver agentes em trabalho */}
            {agentesEmTrabalho.length > 0 && (
              <div className="px-6 py-3 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-[#333333]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {agentesEmTrabalho.map((_, index) => (
                      <span
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === agenteAtualIndex
                            ? 'bg-teal-500'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      ></span>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    <i className="fas fa-sync-alt fa-spin text-[10px]"></i>
                    Atualização automática
                  </span>
                </div>
                {/* Barra de progresso da rotação */}
                {agentesEmTrabalho.length > 1 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                    <div
                      key={progressKey}
                      className="bg-teal-500 h-1 rounded-full animate-progress-bar"
                      style={{
                        animation: 'progressBar 10s linear forwards'
                      }}
                    ></div>
                  </div>
                )}
                <style jsx>{`
                  @keyframes progressBar {
                    from { width: 0%; }
                    to { width: 100%; }
                  }
                `}</style>
              </div>
            )}
          </div>

          {/* Card: Status Petronect */}
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333333] shadow-sm overflow-hidden">
            {/* Header do Card */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-[#333333]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-gray-700 dark:text-gray-300 text-3xl">Status</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">petronect.com.br</p>
                </div>
                <div className="flex items-center gap-2">
                  {petronectStatus.status === 'checking' ? (
                    <i className="fas fa-spinner fa-spin text-gray-400 text-xl"></i>
                  ) : petronectStatus.status === 'online' ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">Online</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">Offline</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Corpo do Card */}
            <div className="p-6">
              {petronectStatus.status === 'checking' ? (
                <div className="flex items-center justify-center py-8">
                  <i className="fas fa-spinner fa-spin text-gray-400 text-2xl"></i>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Status Visual */}
                  <div className="flex items-center justify-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                      petronectStatus.status === 'online'
                        ? 'bg-green-100 dark:bg-green-900/20'
                        : 'bg-red-100 dark:bg-red-900/20'
                    }`}>
                      <i className={`fas ${
                        petronectStatus.status === 'online' ? 'fa-check-circle' : 'fa-times-circle'
                      } text-5xl ${
                        petronectStatus.status === 'online'
                          ? 'text-green-500 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}></i>
                    </div>
                  </div>

                  {/* Divisor */}
                  <div className="border-t border-gray-100 dark:border-[#333333]"></div>

                  {/* Tempo de Resposta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <i className="fas fa-tachometer-alt text-gray-500 dark:text-blue-500"></i>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tempo de resposta</p>
                        <p className="text-lg font-bold text-gray-800 dark:text-white">
                          {petronectStatus.responseTime} ms
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      petronectStatus.responseTime < 1000
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : petronectStatus.responseTime < 3000
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {petronectStatus.responseTime < 1000 ? 'Rápido' : petronectStatus.responseTime < 3000 ? 'Médio' : 'Lento'}
                    </span>
                  </div>

                  {/* Código HTTP */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                      <i className="fas fa-code text-gray-500 dark:text-purple-500"></i>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Código HTTP</p>
                      <p className="text-lg font-bold text-gray-800 dark:text-white">
                        {petronectStatus.statusCode || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Erro (se houver) */}
                  {petronectStatus.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                      <p className="text-xs text-red-600 dark:text-red-400">
                        <i className="fas fa-exclamation-triangle mr-1"></i>
                        {petronectStatus.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer do Card */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-[#333333]">
              <div className="flex items-center justify-center">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {petronectStatus.checkedAt ? (
                    <>Última verificação: {new Date(petronectStatus.checkedAt).toLocaleTimeString('pt-BR')}</>
                  ) : (
                    'Verificando...'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
