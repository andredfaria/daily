'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, Mail, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import FormField from './ui/FormField'
import Input from './ui/Input'

interface AdminUserFieldsProps {
  userId: number
  currentIsAdmin: boolean
  currentSubscriptionStatus?: string
  currentTrialEndsAt?: string
  onSuccess: () => void
}

export default function AdminUserFields({
  userId,
  currentIsAdmin,
  currentSubscriptionStatus,
  currentTrialEndsAt,
  onSuccess,
}: AdminUserFieldsProps) {
  // Estados para permissões
  const [isAdmin, setIsAdmin] = useState(currentIsAdmin)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [roleMessage, setRoleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRoleConfirm, setShowRoleConfirm] = useState(false)

  // Estados para assinatura
  const [subStatus, setSubStatus] = useState<string>(currentSubscriptionStatus || 'trial')
  const [trialEnds, setTrialEnds] = useState<string>(currentTrialEndsAt ? currentTrialEndsAt.split('T')[0] : '')
  const [updatingSub, setUpdatingSub] = useState(false)
  const [subMessage, setSubMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Estados para credenciais
  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Atualizar estados quando props mudarem
  useEffect(() => {
    setIsAdmin(currentIsAdmin)
  }, [currentIsAdmin])

  const handleUpdateSubscription = async () => {
    try {
      setUpdatingSub(true)
      setSubMessage(null)

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            subscription_status: subStatus,
            trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null
          }
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubMessage({ type: 'success', text: 'Assinatura atualizada com sucesso' })
        onSuccess()
      } else {
        setSubMessage({ type: 'error', text: data.error })
      }
    } catch {
      setSubMessage({ type: 'error', text: 'Erro ao atualizar assinatura' })
    } finally {
      setUpdatingSub(false)
    }
  }

  const handleToggleAdmin = async () => {
    if (!showRoleConfirm) {
      setShowRoleConfirm(true)
      return
    }

    try {
      setUpdatingRole(true)
      setRoleMessage(null)
      const newIsAdmin = !isAdmin

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: newIsAdmin }),
      })

      const data = await response.json()

      if (response.ok) {
        setIsAdmin(newIsAdmin)
        setRoleMessage({ type: 'success', text: 'Permissões atualizadas com sucesso' })
        onSuccess()
      } else {
        setRoleMessage({ type: 'error', text: data.error })
      }
    } catch {
      setRoleMessage({ type: 'error', text: 'Erro ao atualizar permissões' })
    } finally {
      setUpdatingRole(false)
      setShowRoleConfirm(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      setEmailMessage({ type: 'error', text: 'Digite um novo email' })
      return
    }

    if (!confirm(`Tem certeza que deseja alterar o email para ${newEmail}?`)) {
      return
    }

    try {
      setUpdatingEmail(true)
      setEmailMessage(null)

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setEmailMessage({ type: 'success', text: 'Email atualizado com sucesso' })
        setNewEmail('')
        onSuccess()
      } else {
        setEmailMessage({ type: 'error', text: data.error })
      }
    } catch {
      setEmailMessage({ type: 'error', text: 'Erro ao atualizar email' })
    } finally {
      setUpdatingEmail(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      setPasswordMessage({ type: 'error', text: 'Digite uma nova senha' })
      return
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'As senhas não coincidem' })
      return
    }

    if (!confirm('Tem certeza que deseja alterar a senha deste usuário?')) {
      return
    }

    try {
      setUpdatingPassword(true)
      setPasswordMessage(null)

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        setPasswordMessage({ type: 'success', text: 'Senha atualizada com sucesso' })
        setNewPassword('')
        setConfirmPassword('')
        onSuccess()
      } else {
        setPasswordMessage({ type: 'error', text: data.error })
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Erro ao atualizar senha' })
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          Configurações Administrativas
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Esta seção é visível apenas para administradores e permite gerenciar permissões e credenciais.
        </p>
      </div>

      {/* Seção 1: Permissões */}
      <Card title="Permissões de Acesso" icon={isAdmin ? Shield : ShieldAlert}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">Status Atual:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${isAdmin
                  ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                  {isAdmin ? 'Administrador' : 'Usuário Comum'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {isAdmin
                  ? 'Este usuário tem permissão total no sistema'
                  : 'Este usuário pode visualizar e editar apenas seus próprios dados'}
              </p>
            </div>
          </div>

          {!showRoleConfirm ? (
            <Button
              variant={isAdmin ? 'danger' : 'primary'}
              onClick={handleToggleAdmin}
              disabled={updatingRole}
              icon={isAdmin ? ShieldAlert : Shield}
              className={`w-full sm:w-auto ${isAdmin ? '' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'}`}
            >
              {isAdmin ? 'Remover Permissões de Admin' : 'Promover a Administrador'}
            </Button>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-amber-400 font-medium">
                ⚠️ Tem certeza que deseja {isAdmin ? 'remover as permissões de administrador' : 'promover este usuário a administrador'}?
              </p>
              <div className="flex gap-2">
                <Button
                  variant={isAdmin ? 'danger' : 'primary'}
                  onClick={handleToggleAdmin}
                  disabled={updatingRole}
                  size="sm"
                  className={isAdmin ? '' : 'bg-emerald-600 hover:bg-emerald-700'}
                >
                  {updatingRole ? 'Processando...' : 'Sim, Confirmar'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowRoleConfirm(false)}
                  size="sm"
                  className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {roleMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${roleMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              {roleMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{roleMessage.text}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Seção 2: Credenciais */}
      <Card title="Alterar Email" icon={Mail}>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Altere o endereço de email do usuário.
          </p>
          <FormField label="Novo Email">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="novo-email@exemplo.com"
              disabled={updatingEmail}
              className="bg-slate-950/50 border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder:text-slate-600"
            />
          </FormField>
          <Button
            variant="primary"
            onClick={handleUpdateEmail}
            disabled={!newEmail.trim() || updatingEmail}
            icon={updatingEmail ? Loader2 : Mail}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
          >
            {updatingEmail ? 'Atualizando...' : 'Atualizar Email'}
          </Button>

          {emailMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${emailMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              {emailMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{emailMessage.text}</span>
            </div>
          )}
        </div>
      </Card>

      <Card title="Alterar Senha" icon={Key}>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Defina uma nova senha para este usuário. Não é necessário informar a senha atual.
          </p>
          <FormField label="Nova Senha">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              disabled={updatingPassword}
              className="bg-slate-950/50 border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder:text-slate-600"
            />
          </FormField>
          <FormField label="Confirmar Nova Senha">
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              disabled={updatingPassword}
              className="bg-slate-950/50 border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder:text-slate-600"
            />
          </FormField>
          <Button
            variant="primary"
            onClick={handleUpdatePassword}
            disabled={!newPassword.trim() || !confirmPassword.trim() || updatingPassword}
            icon={updatingPassword ? Loader2 : Key}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
          >
            {updatingPassword ? 'Atualizando...' : 'Atualizar Senha'}
          </Button>

          {passwordMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${passwordMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              {passwordMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{passwordMessage.text}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Seção 3: Assinatura */}
      <Card title="Gerenciar Assinatura" icon={CheckCircle2}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Status da Assinatura">
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
                className="w-full px-4 py-2 bg-slate-950/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-white"
              >
                <option value="trial" className="bg-slate-900">Trial (Teste Grátis)</option>
                <option value="active" className="bg-slate-900">Ativo (Pago)</option>
                <option value="expired" className="bg-slate-900">Expirado</option>
                <option value="cancelled" className="bg-slate-900">Cancelado</option>
              </select>
            </FormField>

            <FormField label="Fim do Período de Teste/Assinatura">
              <Input
                type="date"
                value={trialEnds}
                onChange={(e) => setTrialEnds(e.target.value)}
                className="bg-slate-950/50 border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder:text-slate-600 color-scheme-dark"
              />
            </FormField>
          </div>

          <Button
            variant="primary"
            onClick={handleUpdateSubscription}
            disabled={updatingSub}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
          >
            {updatingSub ? 'Atualizando...' : 'Atualizar Assinatura'}
          </Button>

          {subMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${subMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{subMessage.text}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
