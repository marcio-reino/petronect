'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, isVisible, onClose, duration = 3000 }: ToastProps) {
  const [isShowing, setIsShowing] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setIsShowing(true)
      const timer = setTimeout(() => {
        setIsShowing(false)
        setTimeout(onClose, 300) // Wait for fade out animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible && !isShowing) return null

  const bgColor = type === 'success'
    ? 'bg-teal-600'
    : 'bg-red-600'

  const icon = type === 'success'
    ? 'fa-check-circle'
    : 'fa-exclamation-circle'

  return (
    <div
      className={`fixed top-4 right-4 z-[100] transition-all duration-300 ${
        isShowing ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px]`}>
        <i className={`fas ${icon} text-lg`}></i>
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={() => {
            setIsShowing(false)
            setTimeout(onClose, 300)
          }}
          className="ml-auto hover:opacity-80 transition"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  )
}
