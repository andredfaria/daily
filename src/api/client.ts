import axios from 'axios'

export const TOKEN_KEY = 'rotina_token'

// O app se chamava BillSync: move a sessão salva na chave antiga para
// ninguém precisar logar de novo depois da troca de nome.
const LEGACY_TOKEN_KEY = 'billsync_token'
const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
if (legacyToken) {
  if (!localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, legacyToken)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 10000,
})

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data)
    } else if (error.request) {
      console.error('Network Error:', error.message)
    }
    return Promise.reject(error)
  },
)

export default client
