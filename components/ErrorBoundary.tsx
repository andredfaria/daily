'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Card from './ui/Card'
import Button from './ui/Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary para capturar erros React e exibir fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="max-w-2xl mx-auto mt-8">
          <div className="text-center py-8">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Algo deu errado
            </h2>
            <p className="text-slate-600 mb-4">
              Ocorreu um erro inesperado. Por favor, tente novamente.
            </p>
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details className="mb-4 text-left bg-slate-50 p-4 rounded-lg">
                <summary className="cursor-pointer font-medium text-slate-700 mb-2">
                  Detalhes do erro (modo desenvolvimento)
                </summary>
                <pre className="text-xs text-slate-600 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset}>Tentar Novamente</Button>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Recarregar Página
              </Button>
            </div>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}
