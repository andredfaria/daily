/**
 * Dígitos de um celular brasileiro (DDD + número, até 11), a partir do que o
 * usuário digitou ou colou.
 *
 * O campo já mostra o "+55" fixo, mas o número copiado do WhatsApp ou da
 * agenda vem com ele ("+55 11 99999-9999"). Sem tirar o país, o 55 virava
 * DDD e o último dígito do número era cortado. O 0 de discagem interurbana
 * ("011 ...") cai pelo mesmo motivo.
 */
export const digitosTelefoneBR = (texto: string): string => {
  let d = String(texto ?? '').replace(/\D/g, '')
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  if (d.length > 10 && d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 11)
}

/** Máscara progressiva "(11) 99999-9999", que não briga com quem está digitando. */
export const formatarTelefoneBR = (texto: string): string => {
  const d = digitosTelefoneBR(texto)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/**
 * WhatsApp do perfil no formato que o login grava e procura: "55" + DDD +
 * número, só dígitos. O login casa por igualdade, então um "+55 (11) ..."
 * colado em Configurações deixava a conta inalcançável no próximo acesso.
 * LID ("…@lid") não é telefone e passa intacto.
 */
export const whatsappParaGravar = (texto: string): string => {
  const bruto = String(texto ?? '').trim()
  if (bruto.includes('@')) return bruto
  const d = bruto.replace(/\D/g, '')
  return d.length === 10 || d.length === 11 ? `55${d}` : d
}
