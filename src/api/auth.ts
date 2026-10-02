import client from './client'

export const requestOtp = (phone: string) =>
  client.post<{ success: boolean; message: string }>('/auth/request-otp', { phone })

export const verifyOtp = (phone: string, code: string) =>
  client.post<{ token: string; user: import('../types').User }>('/auth/verify-otp', { phone, code })

export const getMe = () =>
  client.get<import('../types').User>('/auth/me')

export interface Sessao {
  id: string
  user_agent: string | null
  created_at: string
  last_used_at: string
  current: boolean
}

export const sessionsApi = {
  list: () => client.get<Sessao[]>('/auth/sessions'),
  revoke: (id: string) => client.delete(`/auth/sessions/${id}`),
  revokeOthers: () => client.delete<{ removed: number }>('/auth/sessions'),
}
