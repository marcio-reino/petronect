'use client'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  itemName?: string
}

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, title, message, itemName }: ConfirmDeleteModalProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-md w-full fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-[#444444]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-500 text-xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">
              {title}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-[#cccccc] mb-2">
            {message}
          </p>
          {itemName && (
            <div className="mt-3 p-3 bg-gray-100 dark:bg-[#333333] rounded-lg overflow-hidden">
              <p className="font-semibold text-gray-800 dark:text-[#eeeeee] truncate" title={itemName}>
                {itemName}
              </p>
            </div>
          )}
          <p className="text-sm text-red-600 dark:text-red-400 mt-4">
            Esta ação não pode ser desfeita.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-[#444444] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-[#444444] rounded-lg hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors text-gray-700 dark:text-[#cccccc]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <i className="fas fa-trash"></i>
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}
