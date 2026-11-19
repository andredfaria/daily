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
  it('is_admin liga o acesso', () => expect(decidirAcessoAdmin({ is_admin: 1, whatsapp_number: 'x' }, undefined)).toBe(true))
  it('número da variável liga o acesso', () =>
    expect(decidirAcessoAdmin({ is_admin: 0, whatsapp_number: '553591404064' }, '553591404064')).toBe(true))
  it('outro número é recusado', () =>
    expect(decidirAcessoAdmin({ is_admin: 0, whatsapp_number: '5511999999999' }, '553591404064')).toBe(false))
  it('usuário inexistente é recusado', () => expect(decidirAcessoAdmin(null, '553591404064')).toBe(false))
})
