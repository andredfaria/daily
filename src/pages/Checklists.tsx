import React, { useCallback, useEffect, useState } from 'react'
import { checklistsApi, CreateChecklistPayload, UpdateChecklistPayload } from '../api/checklists'
import type { Checklist, ChecklistDashboardData, ChecklistRecurrenceType, ChecklistStatsEntry } from '../types'
import { useToast } from '../context/ToastContext'
import { SkeletonStatCard } from '../components/ui/Skeleton'
import { ProgressBar } from '../components/checklist/ProgressBar'
import { StatCard } from '../components/checklist/StatCard'
import { ChecklistCard } from '../components/checklist/ChecklistCard'
import { RECURRENCE_LABELS, DAYS_LABELS } from '../components/checklist/constants'

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// -------- Checklist Page --------
const Checklists: React.FC = () => {
  const { success, error: showError } = useToast()

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [dashboard, setDashboard] = useState<ChecklistDashboardData | null>(null)
  const [stats, setStats] = useState<ChecklistStatsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Which checklist is being edited (null = creating new)
  const [editTarget, setEditTarget] = useState<Checklist | null | 'new'>('new')
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formItems, setFormItems] = useState<string[]>(['', ''])
  const [formSendTime, setFormSendTime] = useState(9)
  const [formTimezone] = useState('America/Sao_Paulo')
  const [formRecurrenceType, setFormRecurrenceType] = useState<ChecklistRecurrenceType>('daily')
  const [formRecurrenceDays, setFormRecurrenceDays] = useState<number[]>([])

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Checklist | null>(null)

  // Clear history confirm
  const [clearHistoryTarget, setClearHistoryTarget] = useState<Checklist | null>(null)

  // Send now
  const [sendingId, setSendingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [list, dash, statsList] = await Promise.all([
        checklistsApi.get(),
        checklistsApi.dashboard(),
        checklistsApi.stats(),
      ])
      setChecklists(list)
      setDashboard(dash)
      setStats(statsList)
    } catch {
      showError('Erro ao carregar dados dos checklists.')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // -------- Populate form when editing --------
  const openEdit = (c: Checklist) => {
    setEditTarget(c)
    setFormName(c.name)
    setFormItems(c.items.map((i) => i.text))
    setFormSendTime(c.send_time)
    setFormRecurrenceType(c.recurrence_type ?? 'daily')
    setFormRecurrenceDays(c.recurrence_days ?? [])
    setShowForm(true)
  }

  const openNew = () => {
    setEditTarget('new')
    setFormName('')
    setFormItems(['', ''])
    setFormSendTime(9)
    setFormRecurrenceType('daily')
    setFormRecurrenceDays([])
    setShowForm(true)
  }

  // -------- Item management --------
  const updateItem = (index: number, value: string) => {
    setFormItems((prev) => { const next = [...prev]; next[index] = value; return next })
  }
  const addItem = () => setFormItems((prev) => (prev.length < 12 ? [...prev, ''] : prev))
  const removeItem = (index: number) => setFormItems((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev))

  const toggleDay = (day: number) => {
    setFormRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  // -------- Save --------
  const handleSave = async () => {
    const texts = formItems.map((t) => t.trim()).filter(Boolean)
    if (texts.length < 2) { showError('Adicione pelo menos 2 itens.'); return }
    if (texts.length > 12) { showError('Máximo de 12 itens.'); return }
    if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) {
      showError('Itens duplicados não são permitidos.'); return
    }
    if (formRecurrenceType === 'custom' && formRecurrenceDays.length === 0) {
      showError('Selecione ao menos um dia para recorrência personalizada.'); return
    }

    setSaving(true)
    try {
      const payload = {
        name: formName || 'Checklist Diário',
        send_time: formSendTime,
        timezone: formTimezone,
        recurrence_type: formRecurrenceType,
        recurrence_days: formRecurrenceType === 'custom' ? formRecurrenceDays : undefined,
        items: texts.map((t) => ({ text: t })),
      }

      if (editTarget === 'new') {
        await checklistsApi.create(payload as CreateChecklistPayload)
        success('Checklist criado!')
      } else {
        await checklistsApi.update((editTarget as Checklist).id, payload as UpdateChecklistPayload)
        success('Checklist atualizado!')
      }
      setShowForm(false)
      await fetchData()
    } catch (err: any) {
      showError(err.response?.data?.error ?? 'Erro ao salvar checklist.')
    } finally {
      setSaving(false)
    }
  }

  // -------- Delete --------
  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await checklistsApi.delete(deleteTarget.id)
      success('Checklist excluído.')
      setDeleteTarget(null)
      await fetchData()
    } catch {
      showError('Erro ao excluir checklist.')
    } finally {
      setSaving(false)
    }
  }

  // -------- Clear history --------
  const handleClearHistory = async () => {
    if (!clearHistoryTarget) return
    setSaving(true)
    try {
      const { deleted } = await checklistsApi.clearHistory(clearHistoryTarget.id)
      success(deleted > 0 ? `Histórico limpo (${deleted} registros apagados).` : 'Nenhum histórico para limpar.')
      setClearHistoryTarget(null)
      await fetchData()
    } catch {
      showError('Erro ao limpar histórico.')
    } finally {
      setSaving(false)
    }
  }

  // -------- Send now --------
  const handleSendNow = async (c: Checklist, force = false) => {
    setSendingId(c.id)
    try {
      await checklistsApi.sendNow(force, c.id)
      success('Checklist enviado!')
      await fetchData()
    } catch (err: any) {
      showError(err.response?.data?.error ?? 'Erro ao enviar checklist.')
    } finally {
      setSendingId(null)
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

  const dashChecklist = dashboard?.checklist
  const today = dashboard?.today
  const history = dashboard?.history ?? []
  const statsMap = new Map(stats.map((s) => [s.checklist_id, s]))

  // -------- Today's Poll Section --------
  const renderTodaySection = () => {
    if (!dashChecklist) return null
    if (!today) {
      return (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">today</span>
          <p className="text-on-surface font-semibold mb-1">Nenhum envio hoje</p>
          <p className="text-sm text-on-surface-variant mb-4">
            O checklist <strong>{dashChecklist.name}</strong> será enviado às{' '}
            <strong>{String(dashChecklist.send_time).padStart(2, '0')}h</strong>.
          </p>
          <button
            onClick={() => handleSendNow(dashChecklist, false)}
            disabled={!!sendingId}
            className="btn-primary mx-auto"
          >
            {sendingId ? (
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
              onClick={() => handleSendNow(dashChecklist, true)}
              disabled={!!sendingId}
              title="Reenviar checklist"
              className="w-11 h-11 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
            >
              {sendingId ? (
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

  // -------- History --------
  const renderHistory = () => {
    if (!history.length) return null
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-4">Ultimos 14 Dias</h3>
        <div className="space-y-3">
          {history.map((day) => {
            const dateStr = toDateStr(day.poll_date)
            const dateLabel = dateStr
              ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(dateStr + 'T00:00:00'))
              : '—'
            return (
              <div key={dateStr} className="flex items-center gap-3">
                <span className="text-xs text-on-surface-variant w-24 flex-shrink-0">{dateLabel}</span>
                <div className="flex-1"><ProgressBar pct={day.completion_pct} size="sm" /></div>
                <span className="text-xs font-medium text-on-surface-variant w-10 text-right">{day.completion_pct}%</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // -------- Editor --------
  const renderEditor = () => {
    const texts = formItems.map((t) => t.trim()).filter(Boolean)
    const validCount = texts.length
    const hasDuplicates = new Set(texts.map((t) => t.toLowerCase())).size !== validCount
    const isEdit = editTarget !== 'new'

    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-on-surface">
            {isEdit ? 'Editar Checklist' : 'Novo Checklist'}
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
                className="w-11 h-11 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
        </div>

        {formItems.length < 12 && (
          <button onClick={addItem} className="btn-ghost text-sm mb-4">
            <span className="material-symbols-outlined text-lg">add</span>
            Adicionar Item
          </button>
        )}

        {hasDuplicates && (
          <p className="text-xs text-error mb-3">Itens duplicados nao sao permitidos.</p>
        )}

        {/* Send Time */}
        <div className="mb-4">
          <label className="label mb-1">Horario de Envio</label>
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

        {/* Recurrence */}
        <div className="mb-4">
          <label className="label mb-1">Recorrencia</label>
          <select
            className="input-field"
            value={formRecurrenceType}
            onChange={(e) => setFormRecurrenceType(e.target.value as ChecklistRecurrenceType)}
          >
            {(Object.keys(RECURRENCE_LABELS) as ChecklistRecurrenceType[]).map((key) => (
              <option key={key} value={key}>{RECURRENCE_LABELS[key]}</option>
            ))}
          </select>
        </div>

        {formRecurrenceType === 'custom' && (
          <div className="mb-4">
            <label className="label mb-2">Dias da Semana</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_LABELS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    formRecurrenceDays.includes(day)
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

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
            {isEdit ? 'Salvar Checklist' : 'Criar Checklist'}
          </button>
          <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // -------- Main --------
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-on-surface">Checklists</h2>
        {!showForm && (
          <button onClick={openNew} className="btn-primary">
            <span className="material-symbols-outlined text-lg">add</span>
            Novo Checklist
          </button>
        )}
      </div>

      {/* Form (create or edit) */}
      {showForm && renderEditor()}

      {/* Empty state */}
      {!showForm && checklists.length === 0 && (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">checklist</span>
          <p className="text-on-surface font-semibold mb-1">Nenhum checklist criado</p>
          <p className="text-sm text-on-surface-variant mb-4">
            Crie um checklist para receber no WhatsApp e acompanhar seu progresso.
          </p>
          <button onClick={openNew} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-lg">add</span>
            Criar Checklist
          </button>
        </div>
      )}

      {/* Checklists list */}
      {!showForm && checklists.length > 0 && (
        <>
          {/* Stats from most recent checklist with activity */}
          {dashChecklist && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon="checklist" label="Itens" value={dashChecklist.items.length} iconColor="text-primary" iconBg="bg-primary/15" />
              <StatCard
                icon="schedule"
                label="Horario de Envio"
                value={`${String(dashChecklist.send_time).padStart(2, '0')}h`}
                iconColor="text-yellow-400"
                iconBg="bg-yellow-400/15"
              />
              <StatCard
                icon="today"
                label="Conclusao Hoje"
                value={today ? `${today.completion_pct}%` : '—'}
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
          )}

          {/* Checklist cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {checklists.map((c) => (
              <ChecklistCard
                key={c.id}
                checklist={c}
                stats={statsMap.get(c.id)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onClearHistory={setClearHistoryTarget}
                onSendNow={(cl) => handleSendNow(cl, false)}
                sending={sendingId === c.id}
              />
            ))}
          </div>

          {/* Dashboard activity for most recent */}
          {dashChecklist && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                {renderTodaySection()}
                {renderHistory()}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-card rounded-2xl border border-outline-variant/50 p-6 max-w-sm w-full mx-4 animate-fadeIn">
            <h3 className="text-base font-semibold text-on-surface mb-2">Excluir Checklist</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Tem certeza que deseja excluir <strong>{deleteTarget.name}</strong>? Esta acao nao pode ser desfeita.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
              >
                {saving ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear history confirm modal */}
      {clearHistoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-card rounded-2xl border border-outline-variant/50 p-6 max-w-sm w-full mx-4 animate-fadeIn">
            <h3 className="text-base font-semibold text-on-surface mb-2">Limpar Histórico</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Tem certeza que deseja limpar todo o histórico de <strong>{clearHistoryTarget.name}</strong>? Os polls salvos serao apagados, mas o checklist e seus itens continuam. Esta acao nao pode ser desfeita.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearHistory}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
              >
                {saving ? 'Limpando...' : 'Sim, Limpar'}
              </button>
              <button
                onClick={() => setClearHistoryTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Checklists
