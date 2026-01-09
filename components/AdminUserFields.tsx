'use client'

import { useState, useEffect } from 'react'
import { Shield, ShieldAlert, Link as LinkIcon, Unlink, Mail, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import FormField from './ui/FormField'
import Input from './ui/Input'

interface AuthUser {
  id: string
  email: string
  created_at: string
  is_linked: boolean
  email_confirmed_at: string | null
  last_sign_in_at: string | null
}

interface AdminUserFieldsProps {
  userId: number
  currentIsAdmin: boolean
  currentAuthUserId: string | null
  currentSubscriptionStatus?: string
  currentTrialEndsAt?: string
  onSuccess: () => void
}

export default function AdminUserFields({
  userId,
  currentIsAdmin,
  currentAuthUserId,
  currentSubscriptionStatus,
  currentTrialEndsAt,
  onSuccess,
}: AdminUserFieldsProps) {
  // Estados para permissões
  const [isAdmin, setIsAdmin] = useState(currentIsAdmin)
  const [updatingRole, setUpdatingRole] = useState(false)
  const [roleMessage, setRoleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRoleConfirm, setShowRoleConfirm] = useState(false)

  // Estados para vinculação auth
  const [authUserId, setAuthUserId] = useState(currentAuthUserId)

  // Estados para assinatura
  const [subStatus, setSubStatus] = useState<string>(currentSubscriptionStatus || 'trial')
  const [trialEnds, setTrialEnds] = useState<string>(currentTrialEndsAt ? currentTrialEndsAt.split('T')[0] : '')
  const [updatingSub, setUpdatingSub] = useState(false)
  const [subMessage, setSubMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])

  const handleUpdateSubscription = async () => {
    try {
      setUpdatingSub(true)
      setSubMessage(null)

      const response = await fetch(`/api/admin/users/${userId}/update-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_status: subStatus,
          trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubMessage({ type: 'success', text: data.message })
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
  const [loadingAuthUsers, setLoadingAuthUsers] = useState(false)
  const [linkingAuth, setLinkingAuth] = useState(false)
  const [linkMessage, setLinkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [selectedAuthUserId, setSelectedAuthUserId] = useState<string>('')
  const [showLinkConfirm, setShowLinkConfirm] = useState(false)

  // Estados para credenciais
  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Buscar usuários auth disponíveis quando o componente montar
  useEffect(() => {
    loadAuthUsers()
  }, [])

  // Atualizar estados quando props mudarem
  useEffect(() => {
    setIsAdmin(currentIsAdmin)
    setAuthUserId(currentAuthUserId)
  }, [currentIsAdmin, currentAuthUserId])

  const loadAuthUsers = async () => {
    try {
      setLoadingAuthUsers(true)
      const response = await fetch('/api/admin/auth-users')
      const data = await response.json()

      if (response.ok) {
        setAuthUsers(data.users)
      } else {
        console.error('Erro ao carregar usuários auth:', data.error)
      }
    } catch {
      console.error('Erro ao carregar usuários auth')
    } finally {
      setLoadingAuthUsers(false)
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

      const response = await fetch(`/api/admin/users/${userId}/update-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_admin: newIsAdmin }),
      })

      const data = await response.json()

      if (response.ok) {
        setIsAdmin(newIsAdmin)
        setRoleMessage({ type: 'success', text: data.message })
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

  const handleLinkAuth = async () => {
    if (!selectedAuthUserId) {
      setLinkMessage({ type: 'error', text: 'Selecione um usuário de autenticação' })
      return
    }

    if (!showLinkConfirm) {
      setShowLinkConfirm(true)
      return
    }

    try {
      setLinkingAuth(true)
      setLinkMessage(null)

      const response = await fetch(`/api/admin/users/${userId}/link-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: selectedAuthUserId }),
      })

      const data = await response.json()

      if (response.ok) {
        setAuthUserId(selectedAuthUserId)
        setLinkMessage({ type: 'success', text: data.message })
        setSelectedAuthUserId('')
        await loadAuthUsers() // Recarregar lista
        onSuccess()
      } else {
        setLinkMessage({ type: 'error', text: data.error })
      }
    } catch {
      setLinkMessage({ type: 'error', text: 'Erro ao vincular usuário de autenticação' })
    } finally {
      setLinkingAuth(false)
      setShowLinkConfirm(false)
    }
  }

  const handleUnlinkAuth = async () => {
    if (!confirm('Tem certeza que deseja desvincular este usuário de autenticação?')) {
      return
    }

    try {
      setLinkingAuth(true)
      setLinkMessage(null)

      const response = await fetch(`/api/admin/users/${userId}/link-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: null }),
      })

      const data = await response.json()

      if (response.ok) {
        setAuthUserId(null)
        setLinkMessage({ type: 'success', text: data.message })
        await loadAuthUsers() // Recarregar lista
        onSuccess()
      } else {
        setLinkMessage({ type: 'error', text: data.error })
      }
    } catch {
      setLinkMessage({ type: 'error', text: 'Erro ao desvincular usuário de autenticação' })
    } finally {
      setLinkingAuth(false)
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

      const response = await fetch(`/api/admin/users/${userId}/update-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setEmailMessage({ type: 'success', text: data.message })
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

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'A senha deve ter no mínimo 8 caracteres' })
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

      const response = await fetch(`/api/admin/users/${userId}/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        setPasswordMessage({ type: 'success', text: data.message })
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

  // Encontrar email do auth_user vinculado
  const linkedAuthUser = authUsers.find(u => u.id === authUserId)

  return (
    <div className="space-y-6 mt-8">
      <div className="border-t border-slate-800 pt-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          Configurações Administrativas
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Esta seção é visível apenas para administradores e permite gerenciar permissões e credenciais de autenticação.
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

      {/* Seção 2: Vinculação Auth */}
      <Card title="Vinculação com Autenticação" icon={LinkIcon}>
        <div className="space-y-4">
          {authUserId ? (
            <>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-emerald-400">Conta Vinculada</p>
                    <p className="text-sm text-emerald-600/80 mt-1">
                      Email: <span className="font-mono text-emerald-300">{linkedAuthUser?.email || authUserId}</span>
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="danger"
                onClick={handleUnlinkAuth}
                disabled={linkingAuth}
                icon={Unlink}
                size="sm"
              >
                {linkingAuth ? 'Desvinculando...' : 'Desvincular Conta'}
              </Button>
            </>
          ) : (
            <>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm text-amber-400">
                  Este usuário não possui uma conta de autenticação vinculada. Vincule uma conta existente para permitir login no sistema.
                </p>
              </div>

              <FormField label="Selecionar Usuário de Autenticação" required>
                <select
                  value={selectedAuthUserId}
                  onChange={(e) => setSelectedAuthUserId(e.target.value)}
                  disabled={loadingAuthUsers || linkingAuth}
                  className="w-full px-4 py-2 bg-slate-950/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-white"
                >
                  <option value="" className="bg-slate-900">
                    {loadingAuthUsers ? 'Carregando...' : 'Selecione um usuário'}
                  </option>
                  {authUsers
                    .filter(u => !u.is_linked)
                    .map(user => (
                      <option key={user.id} value={user.id} className="bg-slate-900">
                        {user.email}
                        {user.email_confirmed_at ? ' ✓' : ' (não confirmado)'}
                      </option>
                    ))}
                </select>
              </FormField>

              {!showLinkConfirm ? (
                <Button
                  variant="primary"
                  onClick={handleLinkAuth}
                  disabled={!selectedAuthUserId || linkingAuth}
                  icon={LinkIcon}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                >
                  Vincular Conta Selecionada
                </Button>
              ) : (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-blue-400 font-medium">
                    Confirmar vinculação com: <span className="font-mono text-blue-300">{authUsers.find(u => u.id === selectedAuthUserId)?.email}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={handleLinkAuth}
                      disabled={linkingAuth}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {linkingAuth ? 'Vinculando...' : 'Sim, Vincular'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowLinkConfirm(false)}
                      size="sm"
                      className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {linkMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${linkMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
              {linkMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm">{linkMessage.text}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Seção 3: Credenciais (só aparece se vinculado) */}
      {authUserId && (
        <>
          <Card title="Alterar Email" icon={Mail}>
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Altere o endereço de email usado para fazer login no sistema.
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
        </>
      )}
      {/* Seção 4: Assinatura */}
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
