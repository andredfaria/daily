// Nome curto do aparelho a partir do User-Agent, para a lista de sessões.
// A ordem importa: Edge, Opera e Samsung Internet também dizem "Chrome", e o
// Chrome também diz "Safari".
const NAVEGADORES: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

const SISTEMAS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/CrOS/, 'Chromebook'],
  [/Linux/, 'Linux'],
]

export interface Dispositivo {
  nome: string
  icone: 'smartphone' | 'tablet' | 'computer' | 'devices'
}

export function descreverDispositivo(ua: string | null | undefined): Dispositivo {
  if (!ua) return { nome: 'Dispositivo desconhecido', icone: 'devices' }

  const navegador = NAVEGADORES.find(([re]) => re.test(ua))?.[1]
  const sistema = SISTEMAS.find(([re]) => re.test(ua))?.[1]

  const nome = navegador && sistema
    ? `${navegador} no ${sistema}`
    : navegador || sistema || 'Dispositivo desconhecido'

  const icone = sistema === 'iPad'
    ? 'tablet'
    : sistema === 'iPhone' || (sistema === 'Android' && /Mobile/.test(ua))
      ? 'smartphone'
      : sistema === 'Android'
        ? 'tablet'
        : sistema
          ? 'computer'
          : 'devices'

  return { nome, icone }
}
