'use client'

import { useState } from 'react'

interface InfoBadgeProps {
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function InfoBadge({ text, position = 'top' }: InfoBadgeProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800 dark:border-t-[#444444]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800 dark:border-b-[#444444]',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800 dark:border-l-[#444444]',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800 dark:border-r-[#444444]'
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors cursor-help uppercase"
      >
        Info
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} animate-fadeIn`}
        >
          <div className="bg-gray-800 dark:bg-[#444444] text-white text-xs rounded-lg py-2 px-3 max-w-xs shadow-lg whitespace-normal">
            {text}
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
          />
        </div>
      )}
    </div>
  )
}
