// Trata string vazia ou só espaço como ausente: o WAHA devolve "" para campos
// que ele não conseguiu resolver, e "" não é um nome.
function limpar(valor: string | null | undefined): string | null {
  const texto = (valor ?? '').trim()
  return texto.length > 0 ? texto : null
}

// Precedência do nome mostrado: o que o próprio usuário definiu no WhatsApp
// (pushName) vence o apelido que a conta do BillSync tem salvo na agenda
// (savedName) — é assim que ele se apresenta ao mundo.
export function nomeExibicao(
  pushName: string | null,
  savedName: string | null,
  numero: string | null,
): string {
  return limpar(pushName) ?? limpar(savedName) ?? limpar(numero) ?? '—'
}

// O nome salvo só acrescenta informação quando difere do que já está na tela;
// repetir o mesmo texto em duas linhas é ruído.
export function mostrarNomeSalvo(
  exibido: string,
  savedName: string | null,
): string | null {
  const salvo = limpar(savedName)
  if (salvo === null) return null
  return salvo.toLowerCase() === exibido.trim().toLowerCase() ? null : salvo
}
