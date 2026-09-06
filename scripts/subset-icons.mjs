/**
 * Reduz a fonte Material Symbols de 3,8 MB para ~320 KB.
 *
 * Por que: a fonte completa é maior que todo o resto do bundle somado (JS +
 * CSS + as fontes de texto). Num app mobile-first, é o custo de entrada da
 * primeira tela.
 *
 * O que dá peso é o eixo variável de espessura, não a quantidade de ícones.
 * Instanciar a fonte em wght=400 — o único peso que o app usa — corta ~92%.
 * O eixo FILL fica livre de propósito: o design system usa
 * `fontVariationSettings: "'FILL' 1"` no estado ativo da navegação e nos itens
 * marcados do checklist, e fixá-lo apagaria esses estados.
 *
 * Por que não subsetar pela lista de ícones usados: os ícones são ligatures
 * ("home" vira o glifo da casinha). Subsetar por texto dispara o closure do
 * GSUB e, como os nomes juntos cobrem o alfabeto inteiro, toda ligature da
 * fonte casa — o subset volta do mesmo tamanho. Desligar o closure
 * (`noLayoutClosure` no harfbuzz, `--no-layout-closure` no fonttools) poda o
 * GSUB inteiro e todos os ícones viram texto cru. Medido nos dois: não serve.
 *
 * Rodar depois de atualizar o pacote material-symbols:  npm run icons
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEM = join(raiz, 'node_modules/material-symbols/material-symbols-outlined.woff2')
const DESTINO = join(raiz, 'src/assets/material-symbols-outlined-wght400.woff2')

const original = readFileSync(ORIGEM)

// O texto define a cobertura do cmap. Entram os caracteres que formam os nomes
// dos ícones (entrada das ligatures) e os codepoints da área de uso privado
// (a saída), para a fonte continuar sendo substituta direta da original — quem
// escrever &#xe5c4; em vez do nome também funciona.
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('')
const pua = Array.from({ length: 0xF8FF - 0xE000 + 1 }, (_, i) => String.fromCodePoint(0xE000 + i)).join('')

const subset = await subsetFont(original, ascii + pua, {
  targetFormat: 'woff2',
  variationAxes: {
    wght: 400,  // único peso usado; é o que o .material-symbols-outlined aplica
    GRAD: 0,    // padrão
    opsz: 24,   // padrão
    // FILL fica de fora: o design system alterna 0 e 1 em tempo de execução.
  },
})

mkdirSync(dirname(DESTINO), { recursive: true })
writeFileSync(DESTINO, subset)

const kb = (b) => `${(b / 1024).toFixed(0)} KB`
console.log(`[icons] ${kb(original.length)} → ${kb(subset.length)} (${(100 - (subset.length / original.length) * 100).toFixed(1)}% menor)`)
console.log(`[icons] gravado em ${DESTINO.replace(raiz + '/', '')}`)
