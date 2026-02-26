'use client'

import { Check, ArrowRight, Sparkles } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/components/ToastProvider'

const BASIC_PLAN = {
  name: 'Básico',
  price: 'R$ 97',
  period: '/mês',
  description: 'Perfeito para começar',
  features: [
    'Acesso completo ao dashboard',
    'Envio ilimitado de enquetes WhatsApp',
    'Histórico completo de atividades',
    'Suporte por email',
    'Atualizações de funcionalidades',
  ],
}

export default function SubscriptionPlans() {
  const { dailyUser } = useAuth()
  const toast = useToast()

  const handleSubscribe = async () => {
    if (!dailyUser) {
      toast.error('Erro ao processar assinatura. Faça login novamente.')
      return
    }

    try {
      // Chamar API para criar checkout session do Stripe
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar checkout')
      }

      const { url } = await response.json()

      if (!url) {
        throw new Error('URL de checkout não retornada')
      }

      // Redirecionar para checkout do Stripe
      window.location.href = url
    } catch (error) {
      console.error('Erro ao gerar checkout:', error)
      toast.error('Erro ao processar assinatura. Tente novamente.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" />
          Plano Recorrente Mensal
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Escolha o melhor plano para você
        </h2>
        <p className="text-slate-400">
          Cancele quando quiser. Sem compromisso.
        </p>
      </div>

      <div className="grid md:grid-cols-1 gap-6">
        {/* Basic Plan - Featured */}
        <Card
          className="relative border-2 border-emerald-500/50 bg-gradient-to-br from-slate-900 to-slate-950"
          variant="glass"
        >
          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg rounded-tr-lg">
            Mais Popular
          </div>

          <div className="p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">
                {BASIC_PLAN.name}
              </h3>
              <p className="text-slate-400 mb-4">{BASIC_PLAN.description}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">
                  {BASIC_PLAN.price}
                </span>
                <span className="text-slate-400">{BASIC_PLAN.period}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {BASIC_PLAN.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={handleSubscribe}
              className="w-full"
              size="lg"
              icon={ArrowRight}
            >
              Assinar Agora
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-8 text-center text-sm text-slate-500">
        <p>
          Todos os planos incluem 7 dias de teste gratuito.
          <br />
          Pagamento seguro processado pelo Stripe.
        </p>
      </div>
    </div>
  )
}
