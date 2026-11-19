import client from './client'
import type { FiltrosAtividade, PaginaAtividade, UsuarioAdmin, UsuarioAdminDetalhe, VisaoGeralAdmin } from '../types'

export const getVisaoGeral = async (horas = 24): Promise<VisaoGeralAdmin> =>
  (await client.get<VisaoGeralAdmin>('/admin/overview', { params: { horas } })).data

export const getUsuariosAdmin = async (): Promise<UsuarioAdmin[]> =>
  (await client.get<UsuarioAdmin[]>('/admin/users')).data

export const getUsuarioAdmin = async (id: string): Promise<UsuarioAdminDetalhe> =>
  (await client.get<UsuarioAdminDetalhe>(`/admin/users/${encodeURIComponent(id)}`)).data

export const getAtividade = async (filtros: FiltrosAtividade = {}): Promise<PaginaAtividade> =>
  (await client.get<PaginaAtividade>('/admin/activity', { params: { limite: 50, ...filtros } })).data
