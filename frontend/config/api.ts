/**
 * Configuração do Axios com interceptors para tratamento de erros
 * Redireciona para login quando token é inválido/expirado
 */

import axios from 'axios'
import { APP_CONFIG } from './app.config'

// Criar instância do axios com configurações padrão
const api = axios.create({
  baseURL: APP_CONFIG.api.baseUrl,
  timeout: APP_CONFIG.api.timeout,
})

// Interceptor de request - adiciona token automaticamente
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor de response - trata erros de autenticação
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    // Verificar se é erro de autenticação (401 ou 403)
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || ''

      // Token inválido ou expirado
      if (
        status === 401 ||
        status === 403 ||
        message.includes('Token inválido') ||
        message.includes('Token expirado') ||
        message.includes('invalid') ||
        message.includes('expired')
      ) {
        // Limpar tokens
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('refreshToken')
          sessionStorage.removeItem('user')

          // Exibir mensagem de sessão expirada
          console.warn('Sessão expirada. Redirecionando para login...')

          // Redirecionar para login após 1 segundo
          setTimeout(() => {
            window.location.href = '/'
          }, 1000)
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api
