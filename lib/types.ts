// Interface para itens do checklist
export interface ChecklistItem {
  id: string
  text: string
}

// Interface para opções do usuário (JSON armazenado no campo option)
export interface UserOptions {
  checklist?: string[]
  sendTime?: string
}

// Interface para usuário do sistema Daily
export interface DailyUser {
  id: number
  created_at: string
  phone: string | null
  title: string | null
  name: string | null
  time_to_send: number | null
  option: UserOptions | null
}

// Alias para compatibilidade
export type User = DailyUser

// Interface para dados de atividade diária
export interface DailyData {
  id: number
  id_user: number
  created_at: string
  activity_date: string
  check_status: boolean
  option?: string | null  // Campo existe no schema do banco
}

// Alias para compatibilidade
export type Activity = DailyData

// Interface para dados do formulário de usuário
export interface UserFormData {
  name: string | null
  title: string | null
  phone: string | null
  sendTime: string | null
  checklist: string[]
}
