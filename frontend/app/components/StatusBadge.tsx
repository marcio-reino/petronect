'use client'

interface StatusBadgeProps {
  status: number | string
  variant?: 'default' | 'compact'
}

export default function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  const isActive = status === 1 || status === 'active'

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isActive
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        }`}
      >
        {isActive ? 'Ativo' : 'Inativo'}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
        isActive
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      }`}
    >
      <i className={`fas ${isActive ? 'fa-check-circle' : 'fa-times-circle'} text-xs`}></i>
      {isActive ? 'Ativo' : 'Inativo'}
    </span>
  )
}
