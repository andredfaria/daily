import React, { useCallback, useEffect, useState } from 'react'
import client from '../api/client'
import { notificationsApi } from '../api/notifications'
import type { User } from '../types'
import { useToast } from '../context/ToastContext'

const NOTIFICATION_HOURS = [7, 8, 9, 10, 12, 18]
// B3 negocia das 10h às 17h BRT; antes da abertura a brapi devolve o fechamento
// anterior e o alerta de ação/FII nunca dispara. Limita o seletor a 11h-23h para
// que quem configurar essa hora sempre receba o alerta. Cripto não tem essa
// restrição, mas usa o mesmo horário — ver validação no backend (aceita 0-23).
const ASSET_ALERT_HOURS = Array.from({ length: 13 }, (_, i) => i + 11)

interface NotificationSettings {
  whatsapp_alerts: boolean
  weekly_summary: boolean
  days_before: number
  notification_time: number
  asset_alerts_enabled: boolean
  asset_alert_hour: number
}

interface UserResponse extends User {
  asset_alerts_enabled?: boolean
  asset_alert_hour?: number
}

interface SummaryBudgetSettings {
  summary_enabled: boolean
  summary_day_of_week: number
  monthly_budget_limit: string
  monthly_summary_enabled: boolean
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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
    notification_time: 8,
    asset_alerts_enabled: true,
    asset_alert_hour: 11,
  })
  const [savingNotif, setSavingNotif] = useState(false)

  const [summarySettings, setSummarySettings] = useState<SummaryBudgetSettings>({
    summary_enabled: false,
    summary_day_of_week: 1,
    monthly_budget_limit: '',
    monthly_summary_enabled: false,
  })
  const [savingSummary, setSavingSummary] = useState(false)

  const [wahaStatus, setWahaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [reconnecting, setReconnecting] = useState(false)

  const [wahaProfile, setWahaProfile] = useState<{
    name: string | null
    about: string | null
    profilePicUrl: string | null
  } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [testingMessage, setTestingMessage] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [dispatching, setDispatching] = useState(false)
  const [dispatchResult, setDispatchResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null)

  const [reactivatingAccount, setReactivatingAccount] = useState(false)

  const { success, error: showError } = useToast()

  const fetchUser = useCallback(async () => {
    try {
      setLoadingUser(true)
      const res = await client.get<UserResponse>('/users/me')
      const u = res.data
      setUser(u)
      setProfileName(u.name ?? '')
      setProfileWhatsapp(u.whatsapp_number)
      setNotifSettings({
        whatsapp_alerts: u.whatsapp_alerts_enabled ?? true,
        weekly_summary: u.weekly_summary_enabled ?? false,
        days_before: u.default_days_before_alert ?? 3,
        notification_time: u.notification_time ?? 8,
        asset_alerts_enabled: u.asset_alerts_enabled ?? true,
        asset_alert_hour: u.asset_alert_hour ?? 11,
      })
      setSummarySettings({
        summary_enabled: u.summary_enabled ?? false,
        summary_day_of_week: u.summary_day_of_week ?? 1,
        monthly_budget_limit: u.monthly_budget_limit != null ? String(u.monthly_budget_limit) : '',
        monthly_summary_enabled: u.monthly_summary_enabled ?? true,
      })
    } catch {
      const placeholder: User = {
        id: '1',
        name: 'Usuário',
        whatsapp_number: '+55 (11) 99999-9999',
        timezone: 'America/Sao_Paulo',
        is_active: true,
        whatsapp_alerts_enabled: true,
        weekly_summary_enabled: false,
        default_days_before_alert: 3,
        notification_time: 8,
        summary_enabled: false,
        summary_day_of_week: 1,
        monthly_summary_enabled: false,
        monthly_budget_limit: null,
        onboarding_completed: true,
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

  const fetchWahaStatus = useCallback(async () => {
    try {
      const res = await notificationsApi.getWahaStatus()
      setWahaStatus(res.connected ? 'connected' : 'disconnected')
    } catch {
      setWahaStatus('disconnected')
    }
  }, [])

  const fetchWahaProfile = useCallback(async () => {
    setLoadingProfile(true)
    setProfileError(null)
    try {
      const data = await notificationsApi.getWhatsAppProfile()
      setWahaProfile(data)
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Erro ao buscar perfil WhatsApp.'
      setProfileError(msg)
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
    fetchWahaStatus()
    fetchWahaProfile()
  }, [fetchUser, fetchWahaStatus, fetchWahaProfile])

  const handleSaveProfile = async () => {
    if (!profileName.trim()) return
    setSavingProfile(true)
    try {
      await client.patch('/users/me', {
        name: profileName.trim(),
        whatsapp_number: profileWhatsapp.trim(),
      })
      setUser((prev) =>
        prev ? { ...prev, name: profileName.trim(), whatsapp_number: profileWhatsapp.trim() } : prev
      )
      setEditingProfile(false)
      success('Perfil atualizado!')
    } catch {
      showError('Erro ao atualizar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSavingNotif(true)
    const prev = { ...notifSettings }
    try {
      await client.patch('/users/me', {
        whatsapp_alerts_enabled: notifSettings.whatsapp_alerts,
        weekly_summary_enabled: notifSettings.weekly_summary,
        default_days_before_alert: notifSettings.days_before,
        notification_time: notifSettings.notification_time,
        asset_alerts_enabled: notifSettings.asset_alerts_enabled,
        asset_alert_hour: notifSettings.asset_alert_hour,
      })
      success('Configurações salvas!')
    } catch {
      setNotifSettings(prev)
      showError('Erro ao salvar configurações.')
    } finally {
      setSavingNotif(false)
    }
  }

  const handleSaveSummaryBudget = async () => {
    setSavingSummary(true)
    const prev = { ...summarySettings }
    try {
      const budgetVal = summarySettings.monthly_budget_limit.trim()
      await client.patch('/users/me', {
        summary_enabled: summarySettings.summary_enabled,
        summary_day_of_week: summarySettings.summary_day_of_week,
        monthly_budget_limit: budgetVal === '' ? null : Number(budgetVal),
        monthly_summary_enabled: summarySettings.monthly_summary_enabled,
      })
      success('Resumo e orçamento salvos!')
    } catch {
      setSummarySettings(prev)
      showError('Erro ao salvar configurações de resumo.')
    } finally {
      setSavingSummary(false)
    }
  }

  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      await notificationsApi.reconnectWaha()
      await fetchWahaStatus()
      success('Reconexão iniciada!')
    } catch {
      showError('Erro ao reconectar WAHA.')
    } finally {
      setReconnecting(false)
    }
  }

  const handleTestMessage = async () => {
    setTestingMessage(true)
    setTestResult(null)
    try {
      const result = await notificationsApi.testMessage()
      if (result.success) {
        setTestResult({ success: true, message: `Mensagem enviada com sucesso para ${result.to}!` })
      } else {
        setTestResult({ success: false, message: result.error ?? 'Erro desconhecido.' })
      }
    } catch (err: any) {
      const detail = err.response?.data?.error ?? err.message ?? 'Erro de conexão.'
      setTestResult({ success: false, message: detail })
    } finally {
      setTestingMessage(false)
    }
  }

  const handleDispatch = async () => {
    setDispatching(true)
    setDispatchResult(null)
    try {
      const result = await notificationsApi.dispatch()
      setDispatchResult(result)
    } catch (err: any) {
      const detail = err.response?.data?.error ?? err.message ?? 'Erro de conexão.'
      setTestResult({ success: false, message: `Erro no disparo: ${detail}` })
    } finally {
      setDispatching(false)
    }
  }

  const handleReactivateAccount = async () => {
    setReactivatingAccount(true)
    try {
      await client.patch('/users/me', { is_active: true })
      setUser((prev) => (prev ? { ...prev, is_active: true } : prev))
      success('Conta reativada! Você voltará a receber lembretes por WhatsApp.')
    } catch {
      showError('Erro ao reativar conta.')
    } finally {
      setReactivatingAccount(false)
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {user && !user.is_active && (
        <div className="rounded-2xl border border-error/30 bg-error/10 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-error">pause_circle</span>
            <div>
              <p className="text-sm font-semibold text-on-surface">Seus lembretes por WhatsApp estão pausados</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Pausamos automaticamente por falta de resposta ao checklist. Reative quando quiser voltar a receber lembretes.
              </p>
            </div>
          </div>
          <button
            onClick={handleReactivateAccount}
            disabled={reactivatingAccount}
            className="btn-primary flex-shrink-0"
          >
            {reactivatingAccount ? 'Reativando...' : 'Reativar'}
          </button>
        </div>
      )}
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
                <button onClick={() => setEditingProfile(true)} className="btn-ghost text-xs">
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

          {/* WhatsApp Profile Card */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">account_circle</span>
                <h3 className="text-base font-semibold text-on-surface">Perfil WhatsApp</h3>
              </div>
              <button
                onClick={fetchWahaProfile}
                disabled={loadingProfile}
                className="btn-ghost text-xs"
              >
                <span className={`material-symbols-outlined text-base ${loadingProfile ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>

            {loadingProfile ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-10 shimmer-bg rounded-xl" />
                ))}
              </div>
            ) : profileError ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">wifi_off</span>
                <p className="text-sm text-on-surface-variant leading-relaxed">{profileError}</p>
              </div>
            ) : wahaProfile ? (
              <div className="flex items-start gap-4">
                {wahaProfile.profilePicUrl ? (
                  <img
                    src={wahaProfile.profilePicUrl}
                    alt="Foto de perfil"
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-outline-variant/30"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="material-symbols-outlined text-6xl text-on-surface-variant flex-shrink-0">
                    account_circle
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {wahaProfile.name ?? user?.whatsapp_number ?? '-'}
                  </p>
                  <p className="text-xs text-on-surface-variant">{user?.whatsapp_number}</p>
                  {wahaProfile.about && (
                    <p className="text-xs text-on-surface-variant italic leading-relaxed mt-1">
                      "{wahaProfile.about}"
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Summary & Budget Card */}
          <div className="section-card">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-primary">bar_chart</span>
              <h3 className="text-base font-semibold text-on-surface">Resumo e Orcamento</h3>
            </div>

            <div className="space-y-4">
              <ToggleRow
                label="Resumo semanal"
                description="Receber resumo via WhatsApp no dia configurado"
                checked={summarySettings.summary_enabled}
                onChange={(v) => setSummarySettings((prev) => ({ ...prev, summary_enabled: v }))}
              />

              <ToggleRow
                label="Resumo mensal no WhatsApp"
                description="Receba um fechamento do mês anterior no dia 1, com total por categoria e comparação com o orçamento."
                checked={summarySettings.monthly_summary_enabled}
                onChange={(v: boolean) => setSummarySettings((s) => ({ ...s, monthly_summary_enabled: v }))}
              />

              {summarySettings.summary_enabled && (
                <div>
                  <label className="label">Dia do resumo</label>
                  <select
                    value={summarySettings.summary_day_of_week}
                    onChange={(e) =>
                      setSummarySettings((prev) => ({ ...prev, summary_day_of_week: Number(e.target.value) }))
                    }
                    className="input-field mt-1"
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-outline-variant/30">
                <label className="label">Limite mensal (R$)</label>
                <p className="text-xs text-on-surface-variant mb-2">
                  Receba um alerta quando suas contas pendentes ultrapassarem este valor. Deixe vazio para desativar.
                </p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={summarySettings.monthly_budget_limit}
                  onChange={(e) =>
                    setSummarySettings((prev) => ({ ...prev, monthly_budget_limit: e.target.value }))
                  }
                  className="input-field"
                  placeholder="Ex: 2000.00"
                />
              </div>

              <button
                onClick={handleSaveSummaryBudget}
                disabled={savingSummary}
                className="btn-primary w-full justify-center mt-2"
              >
                {savingSummary ? (
                  <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                Salvar
              </button>
            </div>
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
              <ToggleRow
                label="Alertas de ativos"
                description="Receber aviso de preço-alvo e stop"
                checked={notifSettings.asset_alerts_enabled}
                onChange={(v) => setNotifSettings((prev) => ({ ...prev, asset_alerts_enabled: v }))}
              />

              <div className="pt-2 border-t border-outline-variant/30 space-y-3">
                <div>
                  <label className="label">Dias de antecedência</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNotifSettings((p) => ({ ...p, days_before: Math.max(0, p.days_before - 1) }))
                      }
                      className="w-11 h-11 rounded-lg bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <span className="w-10 text-center text-base font-semibold text-on-surface">
                      {notifSettings.days_before}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNotifSettings((p) => ({ ...p, days_before: Math.min(30, p.days_before + 1) }))
                      }
                      className="w-11 h-11 rounded-lg bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                </div>

                {notifSettings.whatsapp_alerts && (
                  <div>
                    <label className="label">Horário de envio</label>
                    <select
                      value={notifSettings.notification_time}
                      onChange={(e) =>
                        setNotifSettings((p) => ({ ...p, notification_time: Number(e.target.value) }))
                      }
                      className="input-field mt-1"
                    >
                      {NOTIFICATION_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {notifSettings.asset_alerts_enabled && (
                  <div>
                    <label className="label">Horário do alerta de ativos</label>
                    <select
                      value={notifSettings.asset_alert_hour}
                      onChange={(e) =>
                        setNotifSettings((p) => ({ ...p, asset_alert_hour: Number(e.target.value) }))
                      }
                      className="input-field mt-1"
                    >
                      {ASSET_ALERT_HOURS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Você recebe um aviso quando algum ativo atingir o preço-alvo ou o stop.
                      Ações e FIIs só são checados após a abertura do pregão.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveNotifications}
                disabled={savingNotif}
                className="btn-primary w-full justify-center mt-2"
              >
                {savingNotif ? (
                  <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-lg">save</span>
                )}
                Salvar
              </button>
            </div>
          </div>

          {/* Test / Dispatch Card */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">send</span>
                <h3 className="text-base font-semibold text-on-surface">WhatsApp</h3>
              </div>
              {/* Status WAHA */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wahaStatus === 'connected'
                      ? 'bg-tertiary'
                      : wahaStatus === 'disconnected'
                      ? 'bg-error'
                      : 'bg-outline animate-pulse'
                  }`}
                />
                <span className="text-xs text-on-surface-variant">
                  {wahaStatus === 'connected' ? 'Conectado' : wahaStatus === 'disconnected' ? 'Desconectado' : '...'}
                </span>
                {wahaStatus === 'disconnected' && (
                  <button
                    onClick={handleReconnect}
                    disabled={reconnecting}
                    className="btn-ghost text-xs ml-1 py-0.5 px-2"
                  >
                    {reconnecting ? (
                      <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Reconectar'
                    )}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Valide a integração enviando uma mensagem de teste, ou dispare manualmente as notificações agendadas para hoje.
            </p>

            <div className="space-y-2">
              <button
                onClick={handleTestMessage}
                disabled={testingMessage}
                className="btn-primary w-full justify-center"
              >
                {testingMessage ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">send</span>
                    Mensagem de Teste
                  </>
                )}
              </button>

              <button
                onClick={handleDispatch}
                disabled={dispatching}
                className="btn-ghost w-full justify-center"
              >
                {dispatching ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Disparando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">notifications_active</span>
                    Disparar Notificações de Hoje
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`mt-4 p-3 rounded-xl flex items-start gap-2.5 text-sm ${
                  testResult.success
                    ? 'bg-tertiary/10 border border-tertiary/30 text-tertiary'
                    : 'bg-error-container/30 border border-error/30 text-error'
                }`}
              >
                <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5">
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <p className="leading-relaxed">{testResult.message}</p>
              </div>
            )}

            {dispatchResult && (
              <div className="mt-4 p-3 rounded-xl bg-surface-container border border-outline-variant/30 text-sm">
                <p className="text-on-surface font-medium mb-2">Resultado do disparo:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className="flex items-center gap-1 text-tertiary">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {dispatchResult.sent} enviadas
                  </span>
                  <span className="flex items-center gap-1 text-error">
                    <span className="material-symbols-outlined text-sm">cancel</span>
                    {dispatchResult.failed} falhas
                  </span>
                  <span className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">skip_next</span>
                    {dispatchResult.skipped} ignoradas
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
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
      className={`relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0 ${
        checked ? 'bg-tertiary shadow-[0_0_6px_rgba(74,225,118,0.3)]' : 'bg-outline/30'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
          checked ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  </div>
)

export default Configuracoes
