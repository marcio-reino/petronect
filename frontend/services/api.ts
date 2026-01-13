import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

// Criar instância do axios
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor de requisição - adicionar token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

// Interceptor de resposta - refresh token automático
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Se erro 401 e não é retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken =
          localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')

        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        const response = await axios.post(`${API_URL}/auth/refresh-token`, {
          refreshToken,
        })

        const { accessToken } = response.data.data

        // Atualizar token
        const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage
        storage.setItem('accessToken', accessToken)

        // Atualizar header da requisição original
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }

        // Tentar novamente a requisição original
        return api(originalRequest)
      } catch (refreshError) {
        // Se refresh falhar, fazer logout
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// Serviços de autenticação
export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },

  logout: async () => {
    const response = await api.post('/auth/logout')
    return response.data
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh-token', { refreshToken })
    return response.data
  },

  register: async (userData: {
    name: string
    email: string
    username: string
    password: string
    cellphone?: string
    idgroup: number
  }) => {
    const response = await api.post('/auth/register', userData)
    return response.data
  },
}

// Serviços de usuários
export const userService = {
  getAll: async () => {
    const response = await api.get('/users')
    return response.data
  },

  getById: async (id: number) => {
    const response = await api.get(`/users/${id}`)
    return response.data
  },

  getProfile: async () => {
    const response = await api.get('/users/profile')
    return response.data
  },

  create: async (userData: {
    name: string
    email: string
    username: string
    password: string
    cellphone?: string
    phone?: string
    idgroup: number
    avatar?: string
    status?: number
  }) => {
    const response = await api.post('/users', userData)
    return response.data
  },

  update: async (
    id: number,
    userData: {
      name?: string
      email?: string
      username?: string
      password?: string
      cellphone?: string
      phone?: string
      idgroup?: number
      avatar?: string
      status?: number
    }
  ) => {
    const response = await api.put(`/users/${id}`, userData)
    return response.data
  },

  delete: async (id: number, permanent: boolean = false) => {
    const response = await api.delete(`/users/${id}${permanent ? '?permanent=true' : ''}`)
    return response.data
  },
}

export default api
