import client from './client'
import type { Asset, AssetKind, AssetWithQuote, AssetHistoryResponse } from '../types'

export interface CreateAssetPayload {
  ticker: string
  kind: AssetKind
  quantity?: number
  avg_price?: number
  target_price?: number | null
  stop_price?: number | null
}

export interface UpdateAssetPayload extends Partial<Omit<CreateAssetPayload, 'ticker' | 'kind'>> {
  is_active?: boolean
}

export const assetsApi = {
  list: async (): Promise<AssetWithQuote[]> => {
    const res = await client.get<AssetWithQuote[]>('/assets')
    return res.data
  },

  history: async (days = 90): Promise<AssetHistoryResponse> => {
    const res = await client.get<AssetHistoryResponse>('/assets/history', { params: { days } })
    return res.data
  },

  create: async (payload: CreateAssetPayload): Promise<Asset> => {
    const res = await client.post<Asset>('/assets', payload)
    return res.data
  },

  update: async (id: string, payload: UpdateAssetPayload): Promise<Asset> => {
    const res = await client.patch<Asset>(`/assets/${id}`, payload)
    return res.data
  },

  rearm: async (id: string): Promise<Asset> => {
    const res = await client.post<Asset>(`/assets/${id}/rearm`)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/assets/${id}`)
  },
}
