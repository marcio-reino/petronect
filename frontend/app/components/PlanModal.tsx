'use client'

import { useEffect } from 'react'
import { APP_CONFIG } from '@/config/app.config'

interface PlanModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function PlanModal({ isOpen, onClose }: PlanModalProps) {
  // Dados do ENV
  const razaoSocial = process.env.NEXT_PUBLIC_RAZAO_SOCIAL || 'Empresa não configurada'
  const cnpj = process.env.NEXT_PUBLIC_CNPJ || '00.000.000/0001-00'
  const contratoFim = process.env.NEXT_PUBLIC_CONTRATO_FIM || '2026-12-31'

  // Calcular próximo vencimento (dia 10 do mês atual ou próximo mês)
  const getProximoVencimento = () => {
    const hoje = new Date()
    const diaAtual = hoje.getDate()
    let mes = hoje.getMonth()
    let ano = hoje.getFullYear()

    // Se já passou do dia 10, próximo vencimento é no mês seguinte
    if (diaAtual > 10) {
      mes += 1
      if (mes > 11) {
        mes = 0
        ano += 1
      }
    }

    const dataVencimento = new Date(ano, mes, 10)
    return dataVencimento.toLocaleDateString('pt-BR')
  }

  // Formatar data de fim do contrato
  const formatarDataContrato = (dataStr: string) => {
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
  }

  // Fechar com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto fade-in scrollbar-gray">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-[#444444] flex items-center justify-between bg-gray-50 dark:bg-[#333333]">
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
            <i className="fas fa-file-contract mr-2 text-gray-500"></i>
            Plano
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-[#444444] flex items-center justify-center transition"
          >
            <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Logo e Info do Sistema */}
        <div className="px-6 py-6 text-center border-b dark:border-[#444444]">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img
              src="/logo.svg"
              alt={APP_CONFIG.system.name}
              className="h-16 w-auto"
            />
          </div>

          {/* Slogan */}
          <p className="text-gray-500 dark:text-[#aaaaaa] text-sm mb-3">
            Agentes de Automação Petronect
          </p>

          {/* Versão */}
          <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-[#444444] rounded-full text-xs text-gray-600 dark:text-[#cccccc] font-medium">
            Versao {APP_CONFIG.system.version}
          </span>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-5">
          {/* Dados da Empresa */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-[#888888] uppercase tracking-wider mb-3">
              <i className="fas fa-building mr-2"></i>
              Dados do Contratante
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
                <span className="text-sm text-gray-600 dark:text-[#aaaaaa]">Razao Social</span>
                <span className="text-sm font-medium text-gray-800 dark:text-[#eeeeee]">{razaoSocial}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
                <span className="text-sm text-gray-600 dark:text-[#aaaaaa]">CNPJ</span>
                <span className="text-sm font-medium text-gray-800 dark:text-[#eeeeee]">{cnpj}</span>
              </div>
            </div>
          </div>

          {/* Informações do Plano */}
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-[#888888] uppercase tracking-wider mb-3">
              <i className="fas fa-calendar-alt mr-2"></i>
              Informacoes do Plano
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
                <span className="text-sm text-gray-600 dark:text-[#aaaaaa]">Proximo Vencimento</span>
                <span className="text-sm font-medium text-gray-700 dark:text-[#dddddd]">
                  <i className="fas fa-clock mr-1 text-gray-400"></i>
                  {getProximoVencimento()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
                <span className="text-sm text-gray-600 dark:text-[#aaaaaa]">Fim do Contrato</span>
                <span className="text-sm font-medium text-gray-800 dark:text-[#eeeeee]">
                  {formatarDataContrato(contratoFim)}
                </span>
              </div>
            </div>
          </div>

          {/* Licença */}
          <div className="p-4 bg-gray-100 dark:bg-[#333333] rounded-lg">
            <p className="text-[10px] text-gray-500 dark:text-[#888888] text-center leading-relaxed">
              Este software e licenciado para uso exclusivo do contratante. A reproducao, distribuicao
              ou modificacao sem autorizacao expressa e proibida. Todos os direitos reservados
              {' '}{APP_CONFIG.system.company} {APP_CONFIG.system.year}.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-[#444444] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-[#444444] text-gray-700 dark:text-[#dddddd] font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-[#555555] transition-all duration-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
