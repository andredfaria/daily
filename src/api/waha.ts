import client from './client'

export const wahaApi = {
  // Status da sessão WAHA. Considera conectado quando status === 'WORKING'.
  getStatus: async (): Promise<{ connected: boolean; status?: string }> => {
    const res = await client.get<{ connected?: boolean; status?: string }>('/waha/status')
    return { connected: res.data?.connected ?? false, status: res.data?.status }
  },
  // Envia uma mensagem de teste para o número do usuário autenticado.
  sendTest: async (): Promise<{ ok: boolean; error?: string }> => {
    const res = await client.post<{ success: boolean; error?: string }>('/waha/test-message', {})
    return { ok: res.data?.success ?? false, error: res.data?.error }
  },
}

export default wahaApi
