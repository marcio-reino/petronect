'use client'

export default function DashboardPage() {
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
    </div>
  )
}
