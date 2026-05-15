import React, { useCallback, useEffect, useState } from 'react'
import { checklistsApi, CreateChecklistPayload, UpdateChecklistPayload } from '../api/checklists'
import type { ChecklistDashboardData } from '../types'
import { useToast } from '../context/ToastContext'
import { SkeletonStatCard } from '../components/ui/Skeleton'

// -------- Progress Bar --------
const ProgressBar: React.FC<{ pct: number; size?: 'sm' | 'lg' }> = ({ pct, size = 'lg' }) => {
  const h = size === 'lg' ? 'h-3' : 'h-2'
  return (
    <div className={`w-full ${h} rounded-full bg-outline-variant/30 overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-tertiary' : 'bg-primary'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// -------- Stat Card (reused pattern from Dashboard) --------
interface StatCardProps {
  icon: string
  label: string
  value: string | number
  iconColor: string
  iconBg: string
}
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, iconColor, iconBg }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-on-surface mb-0.5">{value}</div>
    <div className="text-xs text-on-surface-variant font-medium">{label}</div>
  </div>
)

// -------- Checklist Page --------
const Checklists: React.FC = () => {
  const { success, error: showError } = useToast()

  const [dashboard, setDashboard] = useState<ChecklistDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit / Create state
  const [editing, setEditing] = useState(false)
  const [formName, setFormName] = useState('')
  const [formItems, setFormItems] = useState<string[]>(['', ''])
  const [formSendTime, setFormSendTime] = useState(9)
  const [formTimezone, setFormTimezone] = useState('America/Sao_Paulo')

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Send now
  const [sending, setSending] = useState(false)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const data = await checklistsApi.dashboard()
      setDashboard(data)
      if (data.checklist) {
        setFormName(data.checklist.name)
        setFormItems(data.checklist.items.map((i) => i.text))
        setFormSendTime(data.checklist.send_time)
        setFormTimezone(data.checklist.timezone)
      }
    } catch {
      showError('Erro ao carregar dados do checklist.')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // -------- Item management --------
  const updateItem = (index: number, value: string) => {
    setFormItems((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const addItem = () => {
    setFormItems((prev) => (prev.length < 12 ? [...prev, ''] : prev))
  }

  const removeItem = (index: number) => {
    setFormItems((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev))
  }

  // -------- Save / Create / Delete --------
  const handleSave = async () => {
    const texts = formItems.map((t) => t.trim()).filter(Boolean)
    if (texts.length < 2) {
      showError('Adicione pelo menos 2 itens.')
      return
    }
    if (texts.length > 12) {
      showError('Máximo de 12 itens.')
      return
    }
    const unique = new Set(texts.map((t) => t.toLowerCase()))
    if (unique.size !== texts.length) {
      showError('Itens duplicados não são permitidos.')
      return
    }

    setSaving(true)
    try {
      const payload = { name: formName || 'Checklist Diário', send_time: formSendTime, timezone: formTimezone, items: texts.map((t) => ({ text: t })) }

      if (dashboard?.checklist) {
        await checklistsApi.update(dashboard.checklist.id, payload as UpdateChecklistPayload)
        success('Checklist atualizado!')
      } else {
        await checklistsApi.create(payload as CreateChecklistPayload)
        success('Checklist criado!')
      }
      setEditing(false)
      await fetchDashboard()
    } catch (err: any) {
      showError(err.response?.data?.error ?? 'Erro ao salvar checklist.')
    } finally {
      setSaving(false)
    }
  }

  const handleSendNow = async (force = false) => {
    setSending(true)
    try {
      await checklistsApi.sendNow(force)
      success('Checklist enviado com sucesso!')
      await fetchDashboard()
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Erro ao enviar checklist.'
      showError(msg)
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!dashboard?.checklist) return
    setSaving(true)
    try {
      await checklistsApi.delete(dashboard.checklist.id)
      success('Checklist excluído.')
      setConfirmDelete(false)
      setDashboard(null)
      setEditing(false)
    } catch {
      showError('Erro ao excluir checklist.')
    } finally {
      setSaving(false)
    }
  }

  // -------- Loading state --------
  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <h2 className="text-lg font-bold text-on-surface">Checklists</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-6 space-y-4">
          <div className="h-6 shimmer-bg rounded w-1/3" />
          <div className="h-3 shimmer-bg rounded-full" />
          <div className="h-4 shimmer-bg rounded w-2/3" />
        </div>
      </div>
    )
  }

  const checklist = dashboard?.checklist
  const today = dashboard?.today
  const history = dashboard?.history ?? []

  // -------- Today's Poll Section --------
  const renderTodaySection = () => {
    if (!today) {
      return (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">today</span>
          <p className="text-on-surface font-semibold mb-1">Nenhum envio hoje</p>
          <p className="text-sm text-on-surface-variant mb-4">
            O checklist será enviado automaticamente às <strong>{String(checklist!.send_time).padStart(2, '0')}h</strong>.
          </p>
          <button
            onClick={() => handleSendNow(false)}
            disabled={sending}
            className="btn-primary mx-auto"
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">send</span>
            )}
            Enviar Agora
          </button>
        </div>
      )
    }

    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Progresso de Hoje</h3>
            <p className="text-xs text-on-surface-variant">
              {today.completed_count} de {today.total_count} concluídos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">{today.completion_pct}%</span>
            <button
              onClick={() => handleSendNow(true)}
              disabled={sending}
              title="Reenviar checklist (substitui envio atual)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {sending ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">refresh</span>
              )}
            </button>
          </div>
        </div>
        <ProgressBar pct={today.completion_pct} />
        {today.selected_options.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {today.selected_options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-on-surface">
                <span className="material-symbols-outlined text-tertiary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                {opt}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // -------- History Section --------
  const renderHistory = () => {
    if (!history.length) return null
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-4">Últimos 14 Dias</h3>
        <div className="space-y-3">
          {history.map((day) => (
            <div key={day.poll_date} className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant w-24 flex-shrink-0">
                {new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(day.poll_date + 'T00:00:00'))}
              </span>
              <div className="flex-1">
                <ProgressBar pct={day.completion_pct} size="sm" />
              </div>
              <span className="text-xs font-medium text-on-surface-variant w-10 text-right">
                {day.completion_pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // -------- Item Editor --------
  const renderEditor = () => {
    const texts = formItems.map((t) => t.trim()).filter(Boolean)
    const validCount = texts.length
    const hasDuplicates = new Set(texts.map((t) => t.toLowerCase())).size !== validCount

    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-on-surface">
            {checklist ? 'Editar Itens' : 'Criar Checklist'}
          </h3>
          <span className={`text-xs font-medium ${validCount > 12 ? 'text-error' : 'text-on-surface-variant'}`}>
            {validCount}/12 itens
          </span>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="label mb-1">Nome do Checklist</label>
          <input
            className="input-field"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Checklist Diário"
            maxLength={100}
          />
        </div>

        {/* Items */}
        <div className="space-y-2 mb-4">
          {formItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant w-5 text-right">{i + 1}.</span>
              <input
                className="input-field flex-1"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                placeholder="Digite a tarefa..."
                maxLength={255}
              />
              <button
                onClick={() => removeItem(i)}
                disabled={formItems.length <= 2}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
        </div>

        {/* Add Item Button */}
        {formItems.length < 12 && (
          <button onClick={addItem} className="btn-ghost text-sm mb-4">
            <span className="material-symbols-outlined text-lg">add</span>
            Adicionar Item
          </button>
        )}

        {hasDuplicates && (
          <p className="text-xs text-error mb-3">Itens duplicados não são permitidos.</p>
        )}

        {/* Send Time */}
        <div className="mb-4">
          <label className="label mb-1">Horário de Envio</label>
          <select
            className="input-field"
            value={formSendTime}
            onChange={(e) => setFormSendTime(Number(e.target.value))}
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-outline-variant/30">
          <button
            onClick={handleSave}
            disabled={saving || validCount < 2 || validCount > 12 || hasDuplicates || !formName.trim()}
            className="btn-primary"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-lg">save</span>
            )}
            {checklist ? 'Salvar' : 'Criar'}
          </button>
          {checklist && (
            <button onClick={() => setEditing(false)} className="btn-ghost text-sm">
              Cancelar
            </button>
          )}
          {checklist && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-sm text-error hover:text-error/80 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Excluir
            </button>
          )}
          {confirmDelete && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">Tem certeza?</span>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
              >
                {saving ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // -------- Main Render --------
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-on-surface">Checklists</h2>
        {checklist && !editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            <span className="material-symbols-outlined text-lg">edit</span>
            Editar Itens
          </button>
        )}
      </div>

      {/* If no checklist, show creator */}
      {!checklist && !editing && (
        <>
          <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">
              checklist
            </span>
            <p className="text-on-surface font-semibold mb-1">Nenhum checklist criado</p>
            <p className="text-sm text-on-surface-variant mb-4">
              Crie um checklist diário para receber no WhatsApp e acompanhar seu progresso.
            </p>
            <button onClick={() => setEditing(true)} className="btn-primary mx-auto">
              <span className="material-symbols-outlined text-lg">add</span>
              Criar Checklist
            </button>
          </div>
        </>
      )}

      {/* Editor mode */}
      {editing && renderEditor()}

      {/* View mode: stats + today + history */}
      {checklist && !editing && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="checklist" label="Itens" value={checklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
            <StatCard
              icon="schedule"
              label="Horário de Envio"
              value={`${String(checklist.send_time).padStart(2, '0')}h`}
              iconColor="text-yellow-400"
              iconBg="bg-yellow-400/15"
            />
            <StatCard
              icon="today"
              label="Status Hoje"
              value={today ? `${today.completion_pct}%` : '---'}
              iconColor={today && today.completion_pct >= 100 ? 'text-tertiary' : 'text-on-surface-variant'}
              iconBg={today && today.completion_pct >= 100 ? 'bg-tertiary/15' : 'bg-surface-container-high'}
            />
            <StatCard
              icon="bar_chart"
              label="Dias Registrados"
              value={history.length}
              iconColor="text-primary"
              iconBg="bg-primary/15"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderTodaySection()}
            {renderHistory()}
          </div>
        </>
      )}
    </div>
  )
}

export default Checklists
