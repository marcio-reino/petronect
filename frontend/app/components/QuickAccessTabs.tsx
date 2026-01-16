'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { APP_CONFIG } from '@/config/app.config'

interface Tab {
  path: string
  label: string
  icon: string
}

const MAX_VISIBLE_TABS = 5

export default function QuickAccessTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Carregar abas do localStorage ao montar o componente
  useEffect(() => {
    const savedTabs = localStorage.getItem('quickAccessTabs')
    if (savedTabs) {
      try {
        setTabs(JSON.parse(savedTabs))
      } catch (error) {
        console.error('Erro ao carregar abas:', error)
        setTabs([])
      }
    }
    setIsInitialized(true)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Adicionar aba atual se ainda não existir
  useEffect(() => {
    if (!isInitialized) return
    if (!pathname || pathname === '/dashboard') return

    // Buscar a configuração da página atual (incluindo submenus)
    let currentPageConfig: { label: string; href: string; icon?: string } | undefined = APP_CONFIG.menu.items.find(item => item.href === pathname)

    // Se não encontrou, procurar nos submenus
    if (!currentPageConfig) {
      for (const item of APP_CONFIG.menu.items) {
        const itemAny = item as any
        if (itemAny.submenu && Array.isArray(itemAny.submenu)) {
          const submenuItem = itemAny.submenu.find((subitem: { href: string; label: string }) => subitem.href === pathname)
          if (submenuItem) {
            currentPageConfig = { ...submenuItem, icon: item.icon }
            break
          }
        }
      }
    }

    if (!currentPageConfig) return

    setTabs(currentTabs => {
      const tabExists = currentTabs.some(tab => tab.path === pathname)

      if (!tabExists) {
        const newTab: Tab = {
          path: pathname,
          label: currentPageConfig.label,
          icon: currentPageConfig.icon || 'fa-circle'
        }

        const updatedTabs = [...currentTabs, newTab]
        localStorage.setItem('quickAccessTabs', JSON.stringify(updatedTabs))
        return updatedTabs
      }

      return currentTabs
    })
  }, [pathname, isInitialized])

  // Navegar para uma aba
  const handleTabClick = (path: string) => {
    router.push(path)
    setShowDropdown(false)
  }

  // Fechar uma aba
  const handleCloseTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const updatedTabs = tabs.filter(tab => tab.path !== path)
    setTabs(updatedTabs)
    localStorage.setItem('quickAccessTabs', JSON.stringify(updatedTabs))

    // Se a aba fechada era a aba ativa, redirecionar para o dashboard
    if (pathname === path) {
      router.push('/dashboard')
    }
  }

  // Se não houver abas, não renderizar nada
  if (tabs.length === 0) return null

  // Separar abas visíveis e ocultas
  const visibleTabs = tabs.slice(0, MAX_VISIBLE_TABS)
  const hiddenTabs = tabs.slice(MAX_VISIBLE_TABS)

  return (
    <div className="flex items-center gap-2 pb-2 px-2">
      {/* Abas visíveis */}
      {visibleTabs.map((tab) => {
        const isActive = pathname === tab.path

        return (
          <button
            key={tab.path}
            onClick={() => handleTabClick(tab.path)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap
              transition-all duration-200 group min-w-fit
              ${isActive
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-500 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-gray-500'
              }
            `}
          >
            {tab.icon && <i className={`fas ${tab.icon} text-xs`}></i>}
            <span>{tab.label}</span>
            <button
              onClick={(e) => handleCloseTab(tab.path, e)}
              className={`
                ml-1 w-4 h-4 rounded-full flex items-center justify-center
                transition-all duration-200
                ${isActive
                  ? 'hover:bg-teal-700 text-white'
                  : 'hover:bg-red-100 text-gray-400 hover:text-red-600'
                }
              `}
              title="Fechar aba"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </button>
        )
      })}

      {/* Dropdown para abas extras */}
      {hiddenTabs.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
              transition-all duration-200
              bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200
              border border-gray-200 dark:border-gray-500
              hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-gray-500
              ${showDropdown ? 'border-teal-400 bg-teal-50 dark:bg-gray-500' : ''}
            `}
            title={`Mais ${hiddenTabs.length} aba(s)`}
          >
            <span className="bg-gray-200 dark:bg-gray-500 text-gray-700 dark:text-gray-200 text-xs font-bold px-1.5 py-0.5 rounded">
              +{hiddenTabs.length}
            </span>
            <i className={`fas fa-chevron-${showDropdown ? 'up' : 'down'} text-xs`}></i>
          </button>

          {/* Dropdown menu */}
          {showDropdown && (
            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#444444] rounded-lg shadow-xl z-50 min-w-[220px] py-1 fade-in">
              {hiddenTabs.map((tab) => {
                const isActive = pathname === tab.path

                return (
                  <div
                    key={tab.path}
                    onClick={() => handleTabClick(tab.path)}
                    className={`
                      flex items-center justify-between px-4 py-2.5 cursor-pointer
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333333]'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      {tab.icon && <i className={`fas ${tab.icon} text-sm`}></i>}
                      <span className="text-sm font-medium">{tab.label}</span>
                    </div>
                    <button
                      onClick={(e) => handleCloseTab(tab.path, e)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Fechar aba"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
