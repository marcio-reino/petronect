'use client'

import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}
 
export default function DatePicker({ value, onChange, placeholder = 'Selecione uma data', label, className = '' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atualizar mês atual quando valor muda
  useEffect(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00')
      if (!isNaN(date.getTime())) {
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
      }
    }
  }, [value])

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (number | null)[] = []

    // Dias vazios antes do primeiro dia
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    // Dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleSelectDate = (day: number) => {
    const year = currentMonth.getFullYear()
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    onChange(`${year}-${month}-${dayStr}`)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
  }

  const handleToday = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    onChange(`${year}-${month}-${day}`)
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setIsOpen(false)
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('pt-BR')
  }

  const isSelectedDate = (day: number) => {
    if (!value) return false
    const selectedDate = new Date(value + 'T00:00:00')
    return (
      selectedDate.getFullYear() === currentMonth.getFullYear() &&
      selectedDate.getMonth() === currentMonth.getMonth() &&
      selectedDate.getDate() === day
    )
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getDate() === day
    )
  }

  const days = getDaysInMonth(currentMonth)

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-1">
          {label}
        </label>
      )}

      {/* Input */}
      <div className="relative flex items-center">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg cursor-pointer flex items-center justify-between bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] hover:border-teal-500 dark:hover:border-teal-600 transition-colors"
        >
          <span className={value ? '' : 'text-gray-400 dark:text-[#888888]'}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <div className="flex items-center gap-2">
            {value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange('')
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Limpar"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            )}
            <i className={`fas fa-calendar-alt text-gray-400 dark:text-[#888888] transition-transform ${isOpen ? 'text-teal-500' : ''}`}></i>
          </div>
        </div>
      </div>

      {/* Dropdown Calendar */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#444444] rounded-lg shadow-xl p-4 w-72">
          {/* Header - Mês e Ano */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-600 dark:text-[#cccccc] transition-colors"
            >
              <i className="fas fa-chevron-left text-sm"></i>
            </button>

            <div className="font-semibold text-gray-800 dark:text-[#eeeeee]">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-600 dark:text-[#cccccc] transition-colors"
            >
              <i className="fas fa-chevron-right text-sm"></i>
            </button>
          </div>

          {/* Dias da semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 dark:text-[#888888] py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Dias do mês */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div key={index} className="aspect-square">
                {day !== null ? (
                  <button
                    type="button"
                    onClick={() => handleSelectDate(day)}
                    className={`w-full h-full flex items-center justify-center rounded-full text-sm transition-colors ${
                      isSelectedDate(day)
                        ? 'bg-teal-600 text-white font-semibold'
                        : isToday(day)
                        ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 font-semibold'
                        : 'text-gray-700 dark:text-[#dddddd] hover:bg-gray-100 dark:hover:bg-[#333333]'
                    }`}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="w-full h-full"></div>
                )}
              </div>
            ))}
          </div>

          {/* Footer - Botões */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-[#444444]">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-500 dark:text-[#aaaaaa] hover:text-gray-700 dark:hover:text-[#cccccc] transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
