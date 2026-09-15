import axios from 'axios'

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, '') + '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('hr_auth_token') ?? sessionStorage.getItem('hr_auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('hr_auth_token')
      localStorage.removeItem('hr_auth_user')
      sessionStorage.removeItem('hr_auth_token')
      sessionStorage.removeItem('hr_auth_user')
      window.location.href = '/'
    }
    return Promise.reject(error)
  },
)
