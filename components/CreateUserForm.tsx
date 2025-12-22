'use client'

import { useState, FormEvent } from 'react'
import { Plus, X, UserPlus, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import LoadingOverlay from './LoadingOverlay'
import SuccessMessage from './SuccessMessage'

export default function CreateUserForm() {
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [sendTime, setSendTime] = useState('')
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [checklistInput, setChecklistInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdUserId, setCreatedUserId] = useState<number | undefined>()

  const addChecklistItem = () => {
    const itemText = checklistInput.trim()
    if (itemText === '') return
    setChecklistItems([...checklistItems, itemText])
    setChecklistInput('')
  }

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index))
  }

  const handleChecklistKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addChecklistItem()
    }
  }

  const sendToWebhook = async (data: {
    title: string | null
    phone: string | null
    checklist: string | null
    sendTime: string | null
  }) => {
    try {
      const response = await fetch('https://n8n.eficienciia.com.br/webhook/user-daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        console.warn('Webhook retornou status não OK:', response.status)
      }
    } catch (error) {
      console.warn('Erro ao enviar para webhook (não bloqueia criação):', error)
    }
  }

  const resetForm = () => {
    setTitle('')
    setPhone('')
    setSendTime('')
    setChecklistItems([])
    setChecklistInput('')
    setSuccess(false)
    setError(null)
    setCreatedUserId(undefined)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const titleValue = title.trim() || null
    const phoneValue = phone.trim() || null
    const sendTimeValue = sendTime.trim() || null
    const checklistJsonString = checklistItems.length > 0 ? JSON.stringify(checklistItems) : null

    // Preparar dados para inserção no Supabase
    const userData: any = {}
    if (titleValue) userData.title = titleValue
    if (phoneValue) userData.phone = phoneValue
    
    // Preparar option com checklist e sendTime
    const optionData: any = {}
    if (checklistItems.length > 0) {
      optionData.checklist = checklistItems
    }
    if (sendTimeValue) {
      optionData.sendTime = sendTimeValue
    }
    if (Object.keys(optionData).length > 0) {
      userData.option = optionData
    }

    try {
      // Inserir usuário no banco
      const { data, error: insertError } = await supabase
        .from('daily_user')
        .insert([userData])
        .select()
        .single()

      if (insertError) throw insertError

      // Preparar dados para webhook
      const webhookData = {
        title: titleValue,
        phone: phoneValue,
        checklist: checklistJsonString,
        sendTime: sendTimeValue,
      }

      // Enviar para webhook (não bloqueia se falhar)
      await sendToWebhook(webhookData)

      // Sucesso
      setCreatedUserId(data.id)
      setSuccess(true)
      setLoading(false)
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err)
      setError(err.message || 'Ocorreu um erro ao cadastrar o usuário. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Criar Novo Usuário</h1>
        <p className="text-slate-500">Preencha os campos abaixo para cadastrar um novo usuário no sistema.</p>
      </div>

      {success && <SuccessMessage userId={createdUserId} onReset={resetForm} />}

      {error && (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <AlertCircle className="text-red-600 w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Erro ao criar usuário</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">
            Título <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            placeholder="Ex: João Silva"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
            Telefone <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            type="text"
            id="phone"
            name="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            placeholder="Ex: +55 11 99999-9999"
          />
        </div>

        <div>
          <label htmlFor="sendTime" className="block text-sm font-medium text-slate-700 mb-2">
            Hora do Envio <span className="text-slate-400">(opcional)</span>
          </label>
          <input
            type="time"
            id="sendTime"
            name="sendTime"
            value={sendTime}
            onChange={(e) => setSendTime(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Checklist <span className="text-slate-400">(opcional)</span>
          </label>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={checklistInput}
                onChange={(e) => setChecklistInput(e.target.value)}
                onKeyPress={handleChecklistKeyPress}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Digite um item do checklist"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200"
                >
                  <span className="flex-1 text-sm text-slate-700">{item}</span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(index)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Adicione itens ao checklist clicando no botão +</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Criar Usuário
          </button>
          <a
            href="/"
            className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center justify-center"
          >
            Cancelar
          </a>
        </div>
      </form>

      {loading && <LoadingOverlay message="Criando usuário..." />}
    </>
  )
}
