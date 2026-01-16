'use client'

import { useEffect, useState } from 'react'
import api from '@/config/api'
import StatusBadge from './StatusBadge'
import UserEditModal from './UserEditModal'
import UserCreateModal from './UserCreateModal'
import UserDeleteConfirmModal from './UserDeleteConfirmModal'

interface UserRow {
  user_id: number
  user_key: string
  user_name: string
  user_email: string
  user_phone?: string
  user_avatar?: string
  role_name?: string
  user_status?: string
  user_date_insert?: string
  user_date_update?: string
  user_role_id?: number
}

interface UserData {
  name: string
  email: string
  role: string
  avatar?: string
  phone?: string
  status?: string
  createdAt?: string
  updatedAt?: string
}

export default function UserList() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Paginação e filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/users')
      if (res.data && res.data.success) {
        setUsers(res.data.data)
        setFilteredUsers(res.data.data)
      } else {
        setError('Falha ao buscar usuários')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao buscar usuários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Listener para atualizar lista quando modal universal salvar
  useEffect(() => {
    const handleRefresh = () => {
      fetchUsers()
    }
    
    window.addEventListener('refreshUserList', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshUserList', handleRefresh)
    }
  }, [])

  // Verificar se há modal para restaurar após redirecionamento
  useEffect(() => {
    const modalToRestore = sessionStorage.getItem('modalToRestore')
    if (modalToRestore && modalToRestore.startsWith('user-edit-')) {
      // Extrair ID do usuário do ID do modal
      const userId = parseInt(modalToRestore.replace('user-edit-', ''))

      // Buscar dados do usuário e abrir o modal
      const loadAndOpenModal = async () => {
        try {
          const res = await api.get(`/users/${userId}`)
          if (res.data && res.data.success) {
            const userData = res.data.data
            setSelectedUser({
              name: userData.user_name,
              email: userData.user_email,
              role: userData.role_name || '',
              phone: userData.user_cellphone || '',
              avatar: userData.user_avatar || '',
              status: userData.user_status,
              createdAt: userData.user_dateinsert,
              updatedAt: userData.user_dateupdate
            })
            setSelectedUserId(userId)
            setIsEditModalOpen(true)
            // Limpar flag do sessionStorage
            sessionStorage.removeItem('modalToRestore')
          }
        } catch (err) {
          console.error('Erro ao restaurar modal:', err)
          sessionStorage.removeItem('modalToRestore')
        }
      }

      // Aguardar um pouco para garantir que a lista foi carregada
      setTimeout(loadAndOpenModal, 100)
    }
  }, [])

  // Filtrar usuários com base na pesquisa
  useEffect(() => {
    const filtered = users.filter(user =>
      user.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.role_name && user.role_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    setFilteredUsers(filtered)
    setCurrentPage(1)
  }, [searchTerm, users])

  // Cálculos de paginação
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const handleNew = () => {
    setIsCreateModalOpen(true)
  }

  const handleEdit = (user: UserRow) => {
    // Formatar telefone
    const formatPhone = (phone: string) => {
      if (!phone) return undefined
      const cleaned = phone.replace(/\D/g, '')
      if (cleaned.length === 11) {
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
      }
      return phone
    }

    // Formatar data e hora
    const formatDateTime = (dateString: string) => {
      if (!dateString) return 'Não disponível'
      const isoDate = dateString.includes('T') ? dateString : dateString.replace(' ', 'T')
      const date = new Date(isoDate)
      if (isNaN(date.getTime())) return 'Data inválida'
      return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    // Construir URL completa do avatar
    const avatarUrl = user.user_avatar
      ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${user.user_avatar}`
      : undefined

    setSelectedUser({
      name: user.user_name,
      email: user.user_email,
      role: user.role_name || 'Sem cargo',
      phone: formatPhone(user.user_phone || ''),
      avatar: avatarUrl,
      status: user.user_status || 'active',
      createdAt: formatDateTime(user.user_date_insert || ''),
      updatedAt: formatDateTime(user.user_date_update || user.user_date_insert || '')
    })
    setSelectedUserId(user.user_id)
    setIsEditModalOpen(true)
  }

  const [needsRefresh, setNeedsRefresh] = useState(false)

  const handleSaveEdit = () => {
    // Marcar que precisa atualizar a lista quando fechar o modal
    setNeedsRefresh(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedUser(null)
    setSelectedUserId(null)

    // Recarregar lista apenas ao fechar o modal se houve alteração
    if (needsRefresh) {
      fetchUsers()
      setNeedsRefresh(false)
    }
  }

  const handleSaveNewUser = () => {
    // Recarregar lista após criar
    fetchUsers()
    setIsCreateModalOpen(false)
  }

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
  }

  const handleConfirmDelete = async (permanent: boolean) => {
    if (!userToDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      const url = permanent
        ? `/users/${userToDelete.user_id}?permanent=true`
        : `/users/${userToDelete.user_id}`

      const res = await api.delete(url)

      if (res.data && res.data.success) {
        // Recarregar lista completa para refletir mudanças
        await fetchUsers()
        setIsDeleteModalOpen(false)
        setUserToDelete(null)
      } else {
        setError(permanent ? 'Falha ao excluir usuário permanentemente' : 'Falha ao inativar usuário')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || (permanent ? 'Erro ao excluir usuário permanentemente' : 'Erro ao inativar usuário'))
    } finally {
      setIsDeleting(false)
    }
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
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <th key={i} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-[#444444] rounded animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#444444]">
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row}>
                  {[1, 2, 3, 4, 5, 6].map((col) => (
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
          <i className="fas fa-exclamation-circle text-red-500 text-2xl mr-3"></i>
          <div>
            <h3 className="font-semibold text-red-800">Erro ao carregar</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-[#eeeeee]">Usuários</h1>
            <p className="text-sm text-gray-500 dark:text-[#aaaaaa]">Gerencie os usuários e suas permissões de acesso</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
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
            placeholder="Pesquisar por nome, email ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 focus:border-transparent bg-white dark:bg-[#2a2a2a] text-gray-700 dark:text-[#eeeeee]"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden dark:bg-[#2a2a2a] dark:border-[#444444]">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white dark:bg-[#333333] border-b border-gray-200 dark:border-[#444444]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-[#cccccc] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-[#444444] dark:bg-[#2a2a2a]">
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <i className="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500">Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                currentUsers.map((user) => {
                  // Construir URL completa do avatar
                  const avatarUrl = user.user_avatar
                    ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}${user.user_avatar}`
                    : null

                  return (
                    <tr key={user.user_id} className="hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={user.user_name}
                              className="w-10 h-10 rounded-full object-cover mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold mr-3">
                              {user.user_name
                                ? user.user_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                                : 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-800 dark:text-[#eeeeee]">{user.user_name}</div>
                            <div className="text-xs text-gray-500 dark:text-[#aaaaaa]">ID: {user.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd]">
                      {user.user_email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#dddddd]">
                      {user.role_name || 'Sem cargo'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={user.user_status || 'active'} variant="compact" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="w-9 h-9 inline-flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                          title="Editar usuário"
                        >
                          <i className="fas fa-edit"></i>
                        </button>

                        <button
                          onClick={() => { setUserToDelete(user); setIsDeleteModalOpen(true) }}
                          className="w-9 h-9 inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                          title="Excluir usuário"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-white dark:border-[#444444] dark:bg-[#2a2a2a]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Info */}
              <div className="text-sm text-gray-600 dark:text-[#cccccc]">
                Mostrando <span className="font-semibold">{startIndex + 1}</span> a{' '}
                <span className="font-semibold">{Math.min(endIndex, filteredUsers.length)}</span> de{' '}
                <span className="font-semibold">{filteredUsers.length}</span> registros
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-4">
                {/* Items per page */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-[#cccccc] whitespace-nowrap">Itens por página:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-600 bg-white dark:bg-[#333333] text-gray-700 dark:text-[#eeeeee]"
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
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white dark:bg-[#333333] dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>

                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-[#333333] dark:border-[#444444] dark:text-[#eeeeee] dark:hover:bg-[#444444]'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span key={page} className="px-2 py-2 text-gray-500">
                            ...
                          </span>
                        )
                      }
                      return null
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg border border-gray-300 bg-white dark:bg-[#333333] dark:border-[#444444] text-gray-700 dark:text-[#eeeeee] hover:bg-gray-50 dark:hover:bg-[#444444] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      {selectedUser && selectedUserId && (
        <UserEditModal
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          user={selectedUser}
          userId={selectedUserId}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal de Criação */}
      <UserCreateModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSave={handleSaveNewUser}
      />

      {/* Modal de confirmação de exclusão */}
      <UserDeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setUserToDelete(null) }}
        onConfirm={handleConfirmDelete}
        userName={userToDelete?.user_name}
        isLoading={isDeleting}
      />
    </>
  )
}
