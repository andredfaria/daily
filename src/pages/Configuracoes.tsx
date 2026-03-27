import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '../types'
import { useToast } from '../context/ToastContext'

interface NotificationSettings {
  whatsapp_alerts: boolean
  weekly_summary: boolean
  days_before: number
}

const APP_VERSION = '1.0.0'

const Configuracoes: React.FC = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileWhatsapp, setProfileWhatsapp] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    whatsapp_alerts: true,
    weekly_summary: false,
    days_before: 3,
  })

  const { success, error: showError } = useToast()

  const fetchUser = useCallback(async () => {
    try {
      setLoadingUser(true)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser!.id)
        .single()
      if (data) {
        setUser(data as User)
        setProfileName(data.name ?? '')
        setProfileWhatsapp(data.whatsapp_number)
      }
    } catch {
      // Use placeholder user
      const placeholder: User = {
        id: '1',
        name: 'Usuário',
        whatsapp_number: '+55 (11) 99999-9999',
        timezone: 'America/Sao_Paulo',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setUser(placeholder)
      setProfileName(placeholder.name ?? '')
      setProfileWhatsapp(placeholder.whatsapp_number)
    } finally {
      setLoadingUser(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return
    setSavingProfile(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      await supabase
        .from('users')
        .update({ name: profileName.trim(), whatsapp_number: profileWhatsapp.trim() })
        .eq('id', authUser!.id)
      setUser((prev) => prev ? { ...prev, name: profileName.trim(), whatsapp_number: profileWhatsapp.trim() } : prev)
      setEditingProfile(false)
      success('Perfil atualizado!')
    } catch {
      showError('Erro ao atualizar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-12 gap-6">
        {/* Left column */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Profile Card */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                <h3 className="text-base font-semibold text-on-surface">Perfil</h3>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="btn-ghost text-xs"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Editar Perfil
                </button>
              )}
            </div>

            {loadingUser ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 shimmer-bg rounded-xl" />
                ))}
              </div>
            ) : editingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="label">Nome</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input
                    type="text"
                    value={profileWhatsapp}
                    onChange={(e) => setProfileWhatsapp(e.target.value)}
                    className="input-field"
                    placeholder="+55 (11) 99999-9999"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary">
                    {savingProfile && (
                      <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                    )}
                    Salvar
                  </button>
                  <button onClick={() => setEditingProfile(false)} className="btn-ghost">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ProfileField icon="badge" label="Nome" value={user?.name ?? 'Não definido'} />
                <ProfileField icon="chat" label="WhatsApp" value={user?.whatsapp_number ?? '-'} />
                <ProfileField icon="schedule" label="Fuso Horário" value={user?.timezone ?? 'America/Sao_Paulo'} />
              </div>
            )}
          </div>

        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Notifications Card */}
          <div className="section-card">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-primary">notifications</span>
              <h3 className="text-base font-semibold text-on-surface">Notificações</h3>
            </div>

            <div className="space-y-4">
              <ToggleRow
                label="Alertas WhatsApp"
                description="Receber alertas de vencimento"
                checked={notifSettings.whatsapp_alerts}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, whatsapp_alerts: v }))}
              />
              <ToggleRow
                label="Resumo Semanal"
                description="Receber resumo toda segunda"
                checked={notifSettings.weekly_summary}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, weekly_summary: v }))}
              />

              <div className="pt-2 border-t border-outline-variant/30">
                <label className="label">Dias de antecedência</label>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setNotifSettings((p) => ({ ...p, days_before: Math.max(0, p.days_before - 1) }))}
                    className="w-8 h-8 rounded-lg bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">remove</span>
                  </button>
                  <span className="w-10 text-center text-base font-semibold text-on-surface">
                    {notifSettings.days_before}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotifSettings((p) => ({ ...p, days_before: Math.min(30, p.days_before + 1) }))}
                    className="w-8 h-8 rounded-lg bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => success('Configurações salvas!')}
                className="btn-primary w-full justify-center mt-2"
              >
                <span className="material-symbols-outlined text-lg">save</span>
                Salvar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center pt-4 border-t border-outline-variant/20">
        <p className="text-xs text-on-surface-variant">
          BillSync v{APP_VERSION} · Gestão de Pagamentos
        </p>
      </div>

    </div>
  )
}

// --- Helper Components ---
interface ProfileFieldProps {
  icon: string
  label: string
  value: string
}

const ProfileField: React.FC<ProfileFieldProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
    <span className="material-symbols-outlined text-on-surface-variant text-lg">{icon}</span>
    <div>
      <p className="text-xs text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-sm font-medium text-on-surface">{value}</p>
    </div>
  </div>
)

interface ToggleRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-on-surface">{label}</p>
      <p className="text-xs text-on-surface-variant">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`
        relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0
        ${checked ? 'bg-tertiary shadow-[0_0_6px_rgba(74,225,118,0.3)]' : 'bg-outline/30'}
      `}
    >
      <span
        className={`
          absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300
          ${checked ? 'left-5' : 'left-0.5'}
        `}
      />
    </button>
  </div>
)

export default Configuracoes
