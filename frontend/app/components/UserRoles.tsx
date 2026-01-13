'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { APP_CONFIG } from '@/config/app.config'
import UserRolePermissionsModal from './UserRolePermissionsModal'
import RoleCreateModal from './RoleCreateModal'
import RoleDeleteConfirmModal from './RoleDeleteConfirmModal'
import StatusBadge from './StatusBadge'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface RoleRow {
  role_id: number
  role_uuid: string
  role_name: string
  role_description: string
  role_permissions: string
  role_status: number
}

export default function UserRoles() {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [filteredRoles, setFilteredRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [roleToDelete, setRoleToDelete] = useState<RoleRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Paginação e filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const fetchRoles = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const res = await axios.get(`${API_DOMAIN}/users/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data && res.data.success) {
        console.log('Roles recebidas do backend:', res.data.data)
        setRoles(res.data.data)
        setFilteredRoles(res.data.data)
      } else {
        setError('Falha ao buscar cargos')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar cargos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  // Filtrar roles com base na pesquisa
  useEffect(() => {
    const filtered = roles.filter(role =>
      role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.role_description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredRoles(filtered)
    setCurrentPage(1) // Reset para primeira página ao pesquisar
  }, [searchTerm, roles])

  const handleNew = () => {
    setIsCreateModalOpen(true)
  }

  const handleEdit = (role: RoleRow) => {
    setSelectedRole(role)
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedRole(null)
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
  }

  const handleSaveEdit = () => {
    fetchRoles()
    setIsEditModalOpen(false)
    setSelectedRole(null)
  }

  const handleSaveNewRole = () => {
    fetchRoles()
    setIsCreateModalOpen(false)
  }

  const handleDeleteClick = (role: RoleRow) => {
    setRoleToDelete(role)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = async (permanent: boolean) => {
    if (!roleToDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      const url = permanent
        ? `${API_DOMAIN}/users/roles/${roleToDelete.role_id}?permanent=true`
        : `${API_DOMAIN}/users/roles/${roleToDelete.role_id}`

      const res = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data && res.data.success) {
        await fetchRoles()
        setIsDeleteModalOpen(false)
        setRoleToDelete(null)
      } else {
        setError(permanent ? 'Falha ao excluir cargo permanentemente' : 'Falha ao inativar cargo')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || (permanent ? 'Erro ao excluir cargo permanentemente' : 'Erro ao inativar cargo'))
    } finally {
      setIsDeleting(false)
    }
  }

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredRoles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentRoles = filteredRoles.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-xl border border-gray-100 dark:border-[#444444] overflow-hidden">
        {/* Header Skeleton */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#444444]">
          <div className="h-8 bg-gray-200 dark:bg-[#333333] rounded w-48 mb-4 animate-pulse"></div>
          <div className="flex gap-4">
            <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-64 animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-32 animate-pulse"></div>
          </div>
        </div>
        
        {/* Table Skeleton */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333] border-b border-gray-200 dark:border-[#444444]">
              <tr>
                {[1, 2, 3, 4, 5].map((i) => (
                  <th key={i} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-[#444444] rounded animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#444444]">
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  {[1, 2, 3, 4, 5].map((col) => (
                    <td key={col} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-[#333333] rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Skeleton */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#444444] flex justify-between items-center">
          <div className="h-4 bg-gray-200 dark:bg-[#333333] rounded w-32 animate-pulse"></div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-24 animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-[#333333] rounded w-24 animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-l-4 border-red-500 rounded-lg">
        <div className="flex items-center">
          <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">Cargos e Permissões</h1>
            <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">Gerencie os cargos e suas permissões de acesso</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRoles}
              className="w-9 h-9 inline-flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              title="Atualizar lista"
            >
              <i className="fas fa-sync-alt"></i>
            </button>
            <button
              onClick={handleNew}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              Novo
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888888]"></i>
          <input
            type="text"
            placeholder="Pesquisar por cargo ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-[#eeeeee] placeholder-gray-400 dark:placeholder-[#888888]"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-sm border border-gray-200 dark:border-[#444444]">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-[#333333] border-b border-gray-200 dark:border-[#444444]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#444444] bg-white dark:bg-[#2a2a2a]">
              {currentRoles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <i className="fas fa-inbox text-4xl text-gray-300 dark:text-[#555555] mb-3"></i>
                    <p className="text-gray-500 dark:text-[#aaaaaa]">Nenhum cargo encontrado</p>
                  </td>
                </tr>
              ) : (
                currentRoles.map((role) => (
                  <tr key={role.role_id} className="hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-[#eeeeee]">{role.role_name}</div>
                        <div className="text-xs text-gray-500 dark:text-[#aaaaaa]">ID: {role.role_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-[#dddddd]">{role.role_description}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={role.role_status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(role)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                          title="Editar permissões"
                        >
                          <i className="fas fa-edit"></i>
                        </button>

                        <button
                          onClick={() => handleDeleteClick(role)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Excluir cargo"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredRoles.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-[#444444] bg-white dark:bg-[#2a2a2a]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Info */}
              <div className="text-sm text-gray-600 dark:text-[#cccccc]">
                Mostrando <span className="font-semibold">{startIndex + 1}</span> a{' '}
                <span className="font-semibold">{Math.min(endIndex, filteredRoles.length)}</span> de{' '}
                <span className="font-semibold">{filteredRoles.length}</span> registros
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-4">
                {/* Items per page */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-[#cccccc] whitespace-nowrap">Itens por página:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 bg-white dark:bg-[#333333] text-gray-900 dark:text-[#eeeeee]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#444444] bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      // Mostrar apenas páginas próximas
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              currentPage === page
                                ? 'bg-teal-600 text-white'
                                : 'bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444]'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="px-2 py-2 text-gray-500 dark:text-[#888888]">...</span>
                      }
                      return null
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#444444] bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {selectedRole && (
        <UserRolePermissionsModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          role={selectedRole}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal de Criação */}
      <RoleCreateModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSave={handleSaveNewRole}
      />

      {/* Modal de confirmação de exclusão */}
      <RoleDeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setRoleToDelete(null) }}
        onConfirm={handleConfirmDelete}
        roleName={roleToDelete?.role_name}
        isLoading={isDeleting}
      />
    </>
  )
}
