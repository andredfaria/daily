import client from './client'

export const requestOtp = (phone: string) =>
  client.post<{ success: boolean; message: string }>('/auth/request-otp', { phone })

export const verifyOtp = (phone: string, code: string) =>
  client.post<{ token: string; user: import('../types').User }>('/auth/verify-otp', { phone, code })

export const getMe = () =>
  client.get<import('../types').User>('/auth/me')
