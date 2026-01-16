'use client'

import React, { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: (permanent: boolean) => Promise<void>
  roleName?: string
  isLoading?: boolean
}

export default function RoleDeleteConfirmModal({ isOpen, onClose, onConfirm, roleName, isLoading }: Props) {
  const [deleteType, setDeleteType] = useState<'soft' | 'permanent'>('soft')

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm(deleteType === 'permanent')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto fade-in scrollbar-gray">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-4">
              <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-[#eeeeee]">Excluir Cargo</h3>
              <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">Escolha o tipo de exclusão</p>
            </div>
          </div>

          {/* Role Info */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-[#333333] rounded-lg border border-gray-200 dark:border-[#444444]">
            <p className="text-sm text-gray-600 dark:text-[#cccccc]">
              Cargo: <span className="font-semibold text-gray-800 dark:text-[#eeeeee]">{roleName || 'Cargo selecionado'}</span>
            </p>
          </div>

          {/* Delete Options */}
          <div className="mb-6 space-y-3">
            {/* Soft Delete */}
            <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
              deleteType === 'soft'
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-200 dark:border-[#444444] hover:border-gray-300 dark:hover:border-[#555555]'
            }`}>
              <input
                type="radio"
                name="deleteType"
                value="soft"
                checked={deleteType === 'soft'}
                onChange={(e) => setDeleteType(e.target.value as 'soft' | 'permanent')}
                className="mt-1 mr-3"
                disabled={isLoading}
              />
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <i className="fas fa-ban text-teal-600 dark:text-teal-400 mr-2"></i>
                  <span className="font-semibold text-gray-800 dark:text-[#eeeeee]">Inativar Cargo</span>
                  <span className="ml-2 px-2 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs rounded-full font-medium">
                    Recomendado
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-[#cccccc]">
                  O cargo será desativado mas seus dados serão mantidos no sistema. Pode ser reativado posteriormente.
                </p>
              </div>
            </label>

            {/* Permanent Delete */}
            <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
              deleteType === 'permanent'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-[#444444] hover:border-gray-300 dark:hover:border-[#555555]'
            }`}>
              <input
                type="radio"
                name="deleteType"
                value="permanent"
                checked={deleteType === 'permanent'}
                onChange={(e) => setDeleteType(e.target.value as 'soft' | 'permanent')}
                className="mt-1 mr-3"
                disabled={isLoading}
              />
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <i className="fas fa-trash-alt text-red-600 dark:text-red-400 mr-2"></i>
                  <span className="font-semibold text-gray-800 dark:text-[#eeeeee]">Excluir Permanentemente</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-[#cccccc]">
                  Todos os dados do cargo serão removidos permanentemente do banco de dados.
                  <span className="text-red-600 dark:text-red-400 font-semibold"> Esta ação não pode ser desfeita!</span>
                </p>
              </div>
            </label>
          </div>

          {/* Warning */}
          {deleteType === 'permanent' && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-600 rounded">
              <div className="flex items-start">
                <i className="fas fa-exclamation-circle text-red-500 dark:text-red-400 mt-0.5 mr-2"></i>
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>Atenção:</strong> A exclusão permanente removerá todos os registros e não poderá ser recuperada.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 transition ${
                deleteType === 'permanent' ? 'bg-red-600' : 'bg-orange-500'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Processando...
                </>
              ) : (
                <>
                  {deleteType === 'soft' ? (
                    <>
                      <i className="fas fa-ban mr-2"></i>
                      Inativar
                    </>
                  ) : (
                    <>
                      <i className="fas fa-trash-alt mr-2"></i>
                      Excluir Permanentemente
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
