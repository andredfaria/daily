import { ehNumeroAdmin, decidirAcessoAdmin } from '../adminAccess'

describe('ehNumeroAdmin', () => {
  it('casa número igual', () => expect(ehNumeroAdmin('553591404064', '553591404064')).toBe(true))
  it('casa variante com o 9º dígito', () => expect(ehNumeroAdmin('5535991404064', '553591404064')).toBe(true))
  it('ignora formatação', () => expect(ehNumeroAdmin('+55 35 9140-4064', '553591404064')).toBe(true))
  it('recusa outro número', () => expect(ehNumeroAdmin('553591404065', '553591404064')).toBe(false))
  it('recusa quando a variável está vazia', () => {
    expect(ehNumeroAdmin('553591404064', undefined)).toBe(false)
    expect(ehNumeroAdmin('553591404064', '')).toBe(false)
  })
})

describe('decidirAcessoAdmin', () => {
  it('is_admin liga o acesso', () => expect(decidirAcessoAdmin({ is_admin: 1 })).toBe(true))
  it('is_admin 0 é recusado', () => expect(decidirAcessoAdmin({ is_admin: 0 })).toBe(false))
  it('número do admin sem is_admin não dá acesso em requisição', () => {
    // O número é editável sem verificação; só a coluna vale fora do login por OTP.
    const linha = { is_admin: 0, whatsapp_number: '5535991404064' }
    expect(ehNumeroAdmin(linha.whatsapp_number, '553591404064')).toBe(true)
    expect(decidirAcessoAdmin(linha)).toBe(false)
  })
  it('usuário inexistente é recusado', () => expect(decidirAcessoAdmin(null)).toBe(false))
})
