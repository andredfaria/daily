import React, { useCallback, useEffect, useRef, useState } from 'react'
import { checklistsApi, CreateChecklistPayload, UpdateChecklistPayload } from '../../api/checklists'
import type { Checklist, ChecklistDashboardData, ChecklistRecurrenceType, ChecklistStatsEntry } from '../../types'
import { useToast } from '../../context/ToastContext'
import { SkeletonCard } from '../../components/ui/Skeleton'
import Modal from '../../components/ui/Modal'
import { ProgressBar } from '../../components/checklist/ProgressBar'
import { ChecklistCard } from '../../components/checklist/ChecklistCard'
import { LinhaItemHoje } from '../../components/checklist/LinhaItemHoje'
import { RECURRENCE_LABELS, DAYS_LABELS } from '../../components/checklist/constants'

// -------- Checklist Page --------
const ChecklistsLista: React.FC = () => {
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

  const editorRef = useRef<HTMLDivElement>(null)

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

  // Editar a partir de um card lá embaixo leva o editor para a vista, como na Carteira.
  useEffect(() => {
    if (!showForm || !editorRef.current) return
    const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    editorRef.current.scrollIntoView({ behavior: semAnimacao ? 'auto' : 'smooth', block: 'start' })
  }, [showForm, editTarget])

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

  // -------- Reactivate --------
  const handleReactivateChecklist = async (c: Checklist) => {
    try {
      await checklistsApi.update(c.id, { is_active: true })
      success('Checklist reativado!')
      await fetchData()
    } catch {
      showError('Erro ao reativar checklist.')
    }
  }

  // -------- Loading state --------
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const dashChecklist = dashboard?.checklist
  const today = dashboard?.today
  const statsMap = new Map(stats.map((s) => [s.checklist_id, s]))
  // itemStats vem indexado por texto porque é assim que o backend casa item e
  // resposta (computeItemStats usa options.includes(text)). Renomear um item o
  // desliga do próprio histórico — mesma limitação que já existe no ranking.
  const statsPorTexto = new Map((dashboard?.itemStats ?? []).map((s) => [s.text, s]))

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
              {dashChecklist.name} · {today.completed_count} de {today.total_count} concluídos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">{today.completion_pct}%</span>
            <button
              onClick={() => handleSendNow(dashChecklist, true)}
              disabled={!!sendingId}
              title="Reenviar checklist"
              aria-label="Reenviar checklist"
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
        {dashChecklist.items.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {dashChecklist.items.map((item) => (
              <LinhaItemHoje
                key={item.id}
                texto={item.text}
                marcado={today.selected_options.includes(item.text)}
                stat={statsPorTexto.get(item.text)}
              />
            ))}
          </div>
        )}
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
      <div
        ref={editorRef}
        // scroll-mt compensa o header sticky, senão o topo do editor fica escondido
        className="scroll-mt-20 md:scroll-mt-24 glass-card rounded-2xl border border-outline-variant/50 p-6 animate-fadeIn"
      >
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
          <label htmlFor="checklist-nome" className="label mb-1">Nome do Checklist</label>
          <input
            id="checklist-nome"
            className="input-field"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Checklist Diário"
            maxLength={100}
          />
        </div>

        {/* Items */}
        <p className="label mb-1">Itens</p>
        <div className="space-y-2 mb-4">
          {formItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant w-5 text-right">{i + 1}.</span>
              <input
                className="input-field flex-1"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                placeholder="Digite a tarefa..."
                aria-label={`Item ${i + 1}`}
                maxLength={255}
              />
              <button
                onClick={() => removeItem(i)}
                disabled={formItems.length <= 2}
                aria-label={`Remover item ${i + 1}`}
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
          <p role="alert" className="text-xs text-error mb-3">Itens duplicados não são permitidos.</p>
        )}

        {/* Send Time */}
        <div className="mb-4">
          <label htmlFor="checklist-horario" className="label mb-1">Horário de Envio</label>
          <select
            id="checklist-horario"
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
          <label htmlFor="checklist-recorrencia" className="label mb-1">Recorrência</label>
          <select
            id="checklist-recorrencia"
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
            <p className="label mb-2">Dias da Semana</p>
            <div className="flex flex-wrap gap-2">
              {DAYS_LABELS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={formRecurrenceDays.includes(day)}
                  className={`px-3 min-h-[44px] min-w-[44px] rounded-lg text-xs font-semibold border transition-colors ${
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
  const ativos = checklists.filter((c) => c.is_active).length

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho no padrão de Contas e Carteira: resumo à esquerda, ação à direita */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold self-start tabular-nums">
          {ativos} {ativos === 1 ? 'ATIVO' : 'ATIVOS'}
          {checklists.length > ativos && ` · ${checklists.length - ativos} PAUSADO${checklists.length - ativos === 1 ? '' : 'S'}`}
        </span>
        <button
          onClick={() => (showForm ? setShowForm(false) : openNew())}
          className="btn-primary justify-center w-full md:w-auto min-h-[44px]"
        >
          <span className="material-symbols-outlined text-lg">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancelar' : 'Novo Checklist'}
        </button>
      </div>

      {/* Editor (criar ou editar) */}
      {showForm && renderEditor()}

      {/* Estado vazio */}
      {!showForm && checklists.length === 0 && (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">checklist</span>
          <h3 className="text-base font-semibold text-on-surface mb-2">Nenhum checklist criado</h3>
          <p className="text-sm text-on-surface-variant mb-6">
            Crie um checklist para receber no WhatsApp e acompanhar seu progresso.
          </p>
          <button onClick={openNew} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-lg">add</span>
            Criar Primeiro Checklist
          </button>
        </div>
      )}

      {checklists.length > 0 && (
        <>
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
                onReactivate={handleReactivateChecklist}
                sending={sendingId === c.id}
              />
            ))}
          </div>

          {/* Progresso de hoje do checklist mais recente */}
          {!showForm && dashChecklist && renderTodaySection()}
        </>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Checklist"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={saving}
      />

      <Modal
        isOpen={!!clearHistoryTarget}
        onClose={() => setClearHistoryTarget(null)}
        onConfirm={handleClearHistory}
        title="Limpar Histórico"
        description={`Tem certeza que deseja limpar todo o histórico de "${clearHistoryTarget?.name}"? Os envios salvos serão apagados, mas o checklist e seus itens continuam. Esta ação não pode ser desfeita.`}
        confirmLabel="Limpar"
        variant="danger"
        loading={saving}
      />
    </div>
  )
}

export default ChecklistsLista
