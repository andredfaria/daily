export interface DailyUser {
  id: number
  created_at: string
  phone: string | null
  title: string | null
  option: {
    checklist?: string[]
  } | null
}

export interface DailyData {
  id: number
  id_user: number
  created_at: string
  activity_date: string
  check_status: boolean
}

export interface UserFormData {
  title: string | null
  phone: string | null
  checklist: string[]
}
