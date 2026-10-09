/**
 * Utilitários puros dos campos numéricos do app.
 *
 * Regra de ouro: o estado de um campo numérico é sempre uma STRING.
 * Guardar número obriga a converter "" em 0 no onChange — e era isso que
 * fazia o campo grudar um zero na frente do que o usuário digitava
 * ("0" + "5" = "05") e impedia apagar o conteúdo por completo.
 *
 * Formato de digitação: pt-BR sem separador de milhar. Agrupar enquanto
 * o usuário digita bagunça a posição do cursor; o agrupamento aparece só
 * na leitura (eco abaixo do campo, listas, gráficos).
 */

export type NumericMode = 'integer' | 'decimal' | 'currency'

/** Casas decimais padrão por modo. `decimal` cobre cripto (até 8 casas). */
export const DEFAULT_DECIMALS: Record<NumericMode, number> = {
  integer: 0,
  decimal: 8,
  currency: 2,
}

export interface NumericInputOptions {
  /** Casas decimais aceitas. 0 = campo inteiro. */
  decimals?: number
  /** Aceita sinal negativo à esquerda. */
  allowNegative?: boolean
  /** Teto de dígitos na parte inteira, para barrar valores absurdos. */
  maxIntegerDigits?: number
}

export interface NormalizeOptions extends NumericInputOptions {
  min?: number
  max?: number
  /** Completa as casas decimais ("12" → "12,00"). Usado em dinheiro. */
  padDecimals?: boolean
}

/**
 * Remove o separador de milhar de um valor colado ("1.234.567,89").
 * Só age quando a string inteira tem o formato agrupado — assim "1.5"
 * continua sendo lido como um decimal com ponto, não como 15.
 */
export const stripGrouping = (raw: string): string =>
  /^\s*-?\d{1,3}(\.\d{3})+(,\d*)?\s*$/.test(raw) ? raw.replace(/\./g, '') : raw

/**
 * Interpreta um número colado de qualquer lugar — extrato, planilha,
 * calculadora, site em inglês — e devolve no formato do campo ("1234,56").
 *
 * A digitação não passa por aqui: tecla a tecla, "1,2." é alguém corrigindo
 * o separador, não um "1.2" americano. Já o texto colado chega inteiro, então
 * dá para decidir pelo conjunto:
 * - moeda, letras e espaços (inclusive o NBSP do Excel) caem fora antes de
 *   olhar os separadores — era o "R$ " que fazia "R$ 1.234,56" virar 1,23;
 * - com ponto e vírgula juntos, o que vem por último é o decimal;
 * - um separador repetido em grupos de 3 é milhar ("1.234.567", "1,234,567");
 * - ponto único seguido de exatamente 3 dígitos é milhar ("1.234"), como o
 *   `stripGrouping` já tratava; vírgula única é sempre decimal.
 *
 * Retorna null quando não há dígito nenhum no texto.
 */
export const interpretarNumeroColado = (texto: string): string | null => {
  const bruto = String(texto ?? '')
  const primeiroDigito = bruto.search(/\d/)
  if (primeiroDigito < 0) return null

  // Sinal: hífen ou "−" antes do primeiro dígito, ou contábil "(50,00)".
  const antes = bruto.slice(0, primeiroDigito)
  const negativo = /[-−]/.test(antes) || (antes.includes('(') && bruto.includes(')'))

  const numero = bruto.slice(primeiroDigito).replace(/[^\d.,]/g, '').replace(/[.,]+$/, '')
  const ultimoPonto = numero.lastIndexOf('.')
  const ultimaVirgula = numero.lastIndexOf(',')

  let inteiro = numero
  let casas = ''
  const separarEm = (pos: number) => {
    inteiro = numero.slice(0, pos).replace(/[.,]/g, '')
    casas = numero.slice(pos + 1).replace(/[.,]/g, '')
  }

  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    separarEm(Math.max(ultimoPonto, ultimaVirgula))
  } else if (ultimoPonto >= 0 || ultimaVirgula >= 0) {
    const sep = ultimoPonto >= 0 ? '.' : ','
    const partes = numero.split(sep)
    const agrupado = /^\d{1,3}$/.test(partes[0]) && partes.slice(1).every((p) => p.length === 3)
    const milhar = agrupado && (partes.length > 2 || (sep === '.' && partes[0] !== '0'))
    if (milhar) inteiro = partes.join('')
    else separarEm(numero.lastIndexOf(sep))
  }

  const corpo = casas ? `${inteiro || '0'},${casas}` : inteiro
  return negativo ? `-${corpo}` : corpo
}

/**
 * Higieniza o que o usuário digitou, preservando a string vazia.
 * Descarta letras e símbolos, aceita vírgula ou ponto como separador
 * decimal (normalizando para vírgula) e corta casas decimais em excesso.
 */
export const sanitizeNumericInput = (
  raw: string,
  { decimals = 2, allowNegative = false, maxIntegerDigits = 12 }: NumericInputOptions = {},
): string => {
  const bruto = stripGrouping(String(raw ?? ''))
  const negativo = allowNegative && bruto.trimStart().startsWith('-')

  // Só dígitos e separadores; o ponto do teclado numérico vira vírgula.
  const [inteiroBruto, ...casas] = bruto
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, ',')
    .split(',')

  // Zero à esquerda cai fora ("05" → "5"), mas o zero sozinho e o "0," ficam.
  const inteiro = inteiroBruto.replace(/^0+(?=\d)/, '').slice(0, maxIntegerDigits)

  // Campo inteiro: a vírgula encerra o número em vez de virar dígito.
  const texto =
    decimals > 0 && casas.length > 0
      ? `${inteiro === '' ? '0' : inteiro},${casas.join('').slice(0, decimals)}`
      : inteiro

  return negativo && texto !== '' ? `-${texto}` : texto
}

/** Converte o texto do campo em número. Retorna null se ainda não há número. */
export const parseNumericInput = (text: string): number | null => {
  const texto = stripGrouping(String(text ?? '')).trim().replace(/\./g, ',')
  if (!/^-?\d*(,\d*)?$/.test(texto) || !/\d/.test(texto)) return null
  const valor = Number(texto.replace(',', '.'))
  return Number.isFinite(valor) ? valor : null
}

export const clampNumber = (value: number, min?: number, max?: number): number => {
  let resultado = value
  if (typeof min === 'number' && resultado < min) resultado = min
  if (typeof max === 'number' && resultado > max) resultado = max
  return resultado
}

/** Número → texto de campo (vírgula, sem separador de milhar). */
export const formatNumericInput = (
  value: number,
  decimals = 2,
  { padDecimals = false }: { padDecimals?: boolean } = {},
): string => {
  if (!Number.isFinite(value)) return ''
  const casas = Math.max(0, Math.min(decimals, 20))
  const texto = padDecimals ? value.toFixed(casas) : String(Number(value.toFixed(casas)))
  return texto.replace('.', ',')
}

/**
 * Fecha o valor quando o campo perde o foco: corta a vírgula solta,
 * aplica min/max e completa as casas decimais quando for dinheiro.
 * Campo vazio continua vazio — apagar tudo é uma resposta válida.
 */
export const normalizeNumericInput = (
  text: string,
  { decimals = 2, min, max, padDecimals = false }: NormalizeOptions = {},
): string => {
  const valor = parseNumericInput(text)
  if (valor === null) return ''
  return formatNumericInput(clampNumber(valor, min, max), decimals, { padDecimals })
}

/**
 * Passo das setas ↑/↓ no teclado — devolve o incremento que o spinner
 * nativo do `type="number"` daria, sem herdar seus defeitos (roda do mouse
 * alterando o valor sem querer e teclado errado no celular).
 */
export const stepNumericInput = (
  text: string,
  delta: number,
  { decimals = 2, min, max, padDecimals = false }: NormalizeOptions = {},
): string => {
  const atual = parseNumericInput(text) ?? clampNumber(0, min, max)
  const proximo = clampNumber(Number((atual + delta).toFixed(decimals)), min, max)
  return formatNumericInput(proximo, decimals, { padDecimals })
}
