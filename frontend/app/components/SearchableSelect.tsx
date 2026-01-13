'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface SearchableSelectOption {
  id: string | number
  name: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhum item encontrado',
  className = '',
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<{ left: number; top: number; width: number } | null>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const insideContainer = containerRef.current && containerRef.current.contains(target)
      const insideDropdown = dropdownRef.current && dropdownRef.current.contains(target)
      if (!insideContainer && !insideDropdown) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedOption = options.find(option => option.id.toString() === value)

  const handleSelect = (optionId: string | number) => {
    onChange(optionId.toString())
    setIsOpen(false)
    setSearchTerm('')
  }

  // Calcular posição do dropdown para renderizar como fixed na raiz (portal)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownStyle({ left: rect.left, top: rect.bottom, width: rect.width })
    } else {
      setDropdownStyle(null)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Campo que parece select */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-lg flex items-center justify-between ${
          disabled
            ? 'border-gray-300 dark:border-[#444444] bg-gray-100 dark:bg-[#333333] text-gray-600 dark:text-[#999999] cursor-not-allowed'
            : 'border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500'
        }`}
      >
        <span className={value && !disabled ? '' : 'text-gray-400 dark:text-[#888888]'}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-gray-400 dark:text-[#888888]`}></i>
      </div>

      {/* Dropdown customizado */}
      {isOpen && !disabled && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width, zIndex: 99999 }}
          className="fixed mt-0 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-lg shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input de pesquisa dentro do dropdown */}
          <div className="p-2 border-b border-gray-300 dark:border-[#444444]">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-[#444444] dark:bg-[#1a1a1a] dark:text-[#eeeeee] rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                onClick={(e) => e.stopPropagation()}
              />
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888] text-sm pointer-events-none"></i>
            </div>
          </div>

          {/* Lista de opções filtradas */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.map((option) => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] transition-colors ${
                  value === option.id.toString()
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                    : 'text-gray-700 dark:text-[#eeeeee]'
                }`}
              >
                {option.name}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-gray-500 dark:text-[#888888] text-sm">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
