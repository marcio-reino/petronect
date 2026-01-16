'use client'

import { useEffect, useState, useRef } from 'react'
import api from '@/config/api'

interface OportunidadesStats {
  ultimas24h: number
  mesAtual: number
  mesAnterior: number
  percentualVariacao: number
}

interface AgenteAtivo {
  nome: string
  ultimaAcao: string
  opAtual: string
  status: 'working' | 'idle'
}

// Dados simulados de agentes ativos
const agentesSimulados: AgenteAtivo[] = [
  {
    nome: 'Agente OP_01',
    ultimaAcao: 'Baixando item 45 de 120',
    opAtual: 'OP-2024-00892',
    status: 'working'
  },
  {
    nome: 'Agente OP_02',
    ultimaAcao: 'Extraindo dados do item 12',
    opAtual: 'OP-2024-00891',
    status: 'working'
  },
  {
    nome: 'Agente OP_03',
    ultimaAcao: 'Validando informações',
    opAtual: 'OP-2024-00890',
    status: 'working'
  }
]

export default function DashboardPage() {
  const [stats, setStats] = useState<OportunidadesStats>({
    ultimas24h: 0,
    mesAtual: 0,
    mesAnterior: 0,
    percentualVariacao: 0
  })
  const [loading, setLoading] = useState(true)

  // Estados para o card de Agentes
  const [agenteAtualIndex, setAgenteAtualIndex] = useState(0)
  const [agentesAtivos] = useState<AgenteAtivo[]>(agentesSimulados)
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in')
  const [progressKey, setProgressKey] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchOportunidadesStats()
  }, [])

  // Rotação de agentes a cada 10 segundos
  useEffect(() => {
    if (agentesAtivos.length > 1) {
      intervalRef.current = setInterval(() => {
        // Fade out
        setFadeState('out')

        setTimeout(() => {
          setAgenteAtualIndex((prev) => (prev + 1) % agentesAtivos.length)
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
  }, [agentesAtivos.length])

  const fetchOportunidadesStats = async () => {
    setLoading(true)
    try {
      const res = await api.get('/oportunidades/stats')

      if (res.data && res.data.success) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
      // Dados mockados para desenvolvimento
      setStats({
        ultimas24h: 0,
        mesAtual: 0,
        mesAnterior: 0,
        percentualVariacao: 0
      })
    } finally {
      setLoading(false)
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

  const agenteAtual = agentesAtivos[agenteAtualIndex]
  const totalAgentes = agentesAtivos.filter(a => a.status === 'working').length

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
                <div className="space-y-6">
                  {/* Últimas 24 horas */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <i className="fas fa-clock text-blue-500 text-xl"></i>
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
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <i className="fas fa-calendar-alt text-green-500 text-xl"></i>
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

                  {/* Mês Anterior (referência) */}
                  {stats.mesAnterior > 0 && (
                    <div className="bg-gray-50 dark:bg-[#252525] rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Mês anterior
                        </span>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {formatNumber(stats.mesAnterior)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer do Card */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-[#333333]">
              <div className="flex items-center justify-end">
                <button
                  onClick={fetchOportunidadesStats}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md transition-colors"
                >
                  <i className="fas fa-refresh mr-1"></i>
                  Atualizar
                </button>
              </div>
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
                  <p className="text-3xl font-bold text-gray-800 dark:text-white">{totalAgentes}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ativos</p>
                </div>
              </div>
            </div>

            {/* Corpo do Card */}
            <div className="p-6">
              {totalAgentes === 0 ? (
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
                    <span className="text-xs text-gray-500 dark:text-gray-400">OP em andamento</span>
                    <p className="font-mono text-sm font-medium text-gray-800 dark:text-white">
                      {agenteAtual?.opAtual}
                    </p>
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

            {/* Footer do Card */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-[#252525] border-t border-gray-100 dark:border-[#333333]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  {agentesAtivos.map((_, index) => (
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
              </div>
              {/* Barra de progresso */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                <div
                  key={progressKey}
                  className="bg-teal-500 h-1 rounded-full animate-progress-bar"
                  style={{
                    animation: 'progressBar 10s linear forwards'
                  }}
                ></div>
              </div>
              <style jsx>{`
                @keyframes progressBar {
                  from { width: 0%; }
                  to { width: 100%; }
                }
              `}</style>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
