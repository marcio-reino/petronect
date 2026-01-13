'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { APP_CONFIG } from '@/config/app.config'

const API_DOMAIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface RoleData {
  role_id: number
  role_key: string
  role_name: string
  role_description: string
  role_permissions: string
  role_status: number
}

interface UserRolePermissionsModalProps {
  isOpen: boolean
  onClose: () => void
  role: RoleData
  onSave: () => void
}

interface Permissions {
  [key: string]: any
}

export default function UserRolePermissionsModal({ isOpen, onClose, role, onSave }: UserRolePermissionsModalProps) {
  const [permissions, setPermissions] = useState<Permissions>({})
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [activeTab, setActiveTab] = useState<'description' | 'permissions'>('description')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (role && isOpen) {
      console.log('=== CARREGANDO ROLE ===')
      console.log('Role completa:', JSON.stringify(role, null, 2))
      console.log('role_permissions:', role.role_permissions)
      console.log('Tipo:', typeof role.role_permissions)
      
      setRoleName(role.role_name)
      setRoleDescription(role.role_description)
      
      if (role.role_permissions) {
        try {
          const parsed = typeof role.role_permissions === 'string' 
            ? JSON.parse(role.role_permissions) 
            : role.role_permissions
          console.log('Permissões parseadas:', parsed)
          setPermissions(parsed)
        } catch (e) {
          console.error('ERRO ao parsear:', e)
          setPermissions({})
        }
      } else {
        console.log('SEM PERMISSÕES - definindo vazio')
        setPermissions({})
      }
    }
  }, [role, isOpen])

  useEffect(() => {
    console.log('>>> Estado permissions atualizado:', permissions)
  }, [permissions])

  const handleTogglePermission = (module: string, action: string) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action]
      }
    }))
  }

  const handlePermissionChange = async (module: string, action: string, value: boolean) => {
    // Atualizar estado local
    const updatedPermissions = {
      ...permissions,
      [module]: {
        ...permissions[module],
        [action]: value
      }
    }
    
    setPermissions(updatedPermissions)

    // Salvar instantaneamente no banco
    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      await axios.put(
        `${API_DOMAIN}/users/roles/${role.role_id}`,
        {
          name: roleName,
          description: roleDescription,
          permissions: JSON.stringify(updatedPermissions)
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      // Mostrar feedback visual breve
      setSuccess(true)
      setTimeout(() => setSuccess(false), 1000)

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao salvar permissão')
      // Reverter a mudança em caso de erro
      setPermissions(permissions)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

      await axios.put(
        `${API_DOMAIN}/users/roles/${role.role_id}`,
        {
          name: roleName,
          description: roleDescription,
          permissions: JSON.stringify(permissions)
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      setSuccess(true)
      
      setTimeout(() => {
        setSuccess(false)
        onSave()
      }, 1500)

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao salvar dados')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setError('')
      setSuccess(false)
      onClose()
    }
  }

  if (!isOpen) return null

  // Módulos disponíveis
  const modules = [
    { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
    { key: 'users', label: 'Usuários', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'clients', label: 'Clientes', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { key: 'budgets', label: 'Orçamentos', actions: ['view', 'create', 'edit', 'delete', 'approve', 'cancel', 'send'] },
    { key: 'services', label: 'Serviços', actions: ['view', 'create', 'edit', 'delete'] },
    { key: 'certificates', label: 'Certificados', actions: ['view', 'create', 'edit', 'delete', 'generate'] },
    { key: 'finance', label: 'Financeiro', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { key: 'reports', label: 'Relatórios', actions: ['view', 'export'] },
    { key: 'settings', label: 'Configurações', actions: ['view', 'edit'] },
  ]

  const actionLabels: { [key: string]: string } = {
    view: 'Visualizar',
    create: 'Criar',
    edit: 'Editar',
    delete: 'Excluir',
    export: 'Exportar',
    approve: 'Aprovar',
    cancel: 'Cancelar',
    send: 'Enviar',
    generate: 'Gerar'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto fade-in">
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-200 dark:border-[#444444] flex items-center justify-between sticky top-0 bg-white dark:bg-[#2a2a2a] z-10"
        >
          <h2 className="text-xl font-bold text-gray-800 dark:text-[#eeeeee]">Editar Cargo</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333333] flex items-center justify-center transition"
            disabled={isLoading}
          >
            <i className="fas fa-times text-gray-400 dark:text-[#aaaaaa]"></i>
          </button>
        </div>

        {/* Nav Tabs */}
        <div className="border-b border-gray-200 dark:border-[#444444] sticky top-[73px] bg-white dark:bg-[#2a2a2a] z-10">
          <nav className="flex px-6">
            <button
              type="button"
              onClick={() => setActiveTab('description')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'description'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 dark:text-[#aaaaaa] hover:text-gray-700 dark:hover:text-[#cccccc]'
              }`}
            >
              <i className="fas fa-info-circle mr-2"></i>
              Descrição
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'permissions'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 dark:text-[#aaaaaa] hover:text-gray-700 dark:hover:text-[#cccccc]'
              }`}
            >
              <i className="fas fa-shield-alt mr-2"></i>
              Permissões
            </button>
          </nav>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-circle text-red-500 mr-3"></i>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Mensagem de Sucesso */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg fade-in">
              <div className="flex items-center">
                <i className="fas fa-check-circle text-green-500 mr-3"></i>
                <p className="text-green-700 text-sm">Dados atualizados com sucesso!</p>
              </div>
            </div>
          )}

          {/* Tab Content - Descrição */}
          {activeTab === 'description' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
                  <i className="fas fa-tag mr-2 text-gray-400 dark:text-[#888888]"></i>
                  Nome do Cargo *
                </label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#cccccc] mb-2">
                  <i className="fas fa-align-left mr-2 text-gray-400 dark:text-[#888888]"></i>
                  Descrição *
                </label>
                <textarea
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#444444] dark:bg-[#2a2a2a] dark:text-[#eeeeee] rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Tab Content - Permissões */}
          {activeTab === 'permissions' && (
            <div className="space-y-3">
              {modules.map((module) => (
                <div
                  key={module.key}
                  className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-[#333333] dark:to-[#2a2a2a] border border-gray-200 dark:border-[#444444] rounded-xl"
                >
                  <div className="flex items-center mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-white text-sm font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${APP_CONFIG.widgets.colors.primary} 0%, ${APP_CONFIG.widgets.colors.secondary} 100%)`,
                      }}
                    >
                      {module.label.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-sm font-bold text-gray-700 dark:text-[#eeeeee]">{module.label}</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {module.actions.map((action) => {
                      const isChecked = permissions[module.key]?.[action] === true
                      console.log(`Switch ${module.key}.${action}:`, {
                        permissions,
                        modulePermissions: permissions[module.key],
                        actionValue: permissions[module.key]?.[action],
                        isChecked
                      })
                      
                      return (
                        <label
                          key={`${module.key}-${action}`}
                          className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#444444] rounded-lg cursor-pointer hover:border-teal-400 transition group"
                        >
                          <span className="text-xs text-gray-600 dark:text-[#cccccc] group-hover:text-gray-800 dark:group-hover:text-[#eeeeee]">
                            {actionLabels[action]}
                          </span>
                          <button
                            type="button"
                            onClick={() => handlePermissionChange(module.key, action, !isChecked)}
                            disabled={isLoading}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              isChecked
                                ? 'bg-teal-600'
                                : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                isChecked
                                  ? 'translate-x-5'
                                  : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-gray-200 dark:border-[#444444]">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-[#dddddd] text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-[#444444] transition-all duration-200"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
