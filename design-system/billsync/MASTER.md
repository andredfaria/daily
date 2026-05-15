# Design System Master File — BillSync

> **Como usar:** Antes de construir uma página específica, verifique se existe `design-system/billsync/pages/[nome-da-pagina].md`.
> Se o arquivo existir, suas regras **sobrescrevem** este Master.
> Se não existir, siga rigorosamente as regras abaixo.

---

**Projeto:** BillSync  
**Categoria:** Gerenciador de Finanças Pessoais  
**Tema:** Dark Mode OLED — Material Design 3 adaptado  
**Stack:** React + Vite + TypeScript + Tailwind CSS  
**Última atualização:** 2026-05-15

---

## Tokens de Cor (Tailwind aliases)

| Token Tailwind             | Hex       | Uso                                      |
|---------------------------|-----------|------------------------------------------|
| `background`              | `#131318` | Fundo da página                          |
| `surface`                 | `#131318` | Mesmo que background                     |
| `surface-container-lowest`| `#0e0e13` | Sidebar, bottom nav                      |
| `surface-container`       | `#1f1f25` | Cards internos, inputs                   |
| `surface-container-low`   | `#1b1b20` | Cards leves                              |
| `surface-container-high`  | `#2a292f` | Hover state, chip selecionado            |
| `surface-container-highest`| `#35343a`| Chips desativados                        |
| `surface-bright`          | `#39383e` | Elementos elevados                       |
| `surface-dim`             | `#131318` | Overlay claro sobre surface              |
| `surface-variant`         | `#35343a` | Variante de superfície                   |
| `on-surface`              | `#e4e1e9` | Texto principal                          |
| `on-surface-variant`      | `#c7c4d7` | Texto secundário, ícones inativos        |
| `primary`                 | `#c0c1ff` | Cor primária (lavender)                  |
| `primary-container`       | `#8083ff` | Container primário                       |
| `on-primary`              | `#1000a9` | Texto sobre primary                      |
| `on-primary-fixed`        | `#07006c` | Texto sobre botão primário               |
| `primary-fixed`           | `#e1e0ff` | Fixed primary                            |
| `secondary`               | `#b7c8e1` | Cor secundária                           |
| `secondary-container`     | `#3a4a5f` | Container secundário                     |
| `on-secondary`            | `#213145` | Texto sobre secondary                    |
| `on-secondary-container`  | `#a9bad3` | Texto sobre secondary container          |
| `tertiary`                | `#4ae176` | Verde sucesso (contas pagas)             |
| `tertiary-container`      | `#00a74b` | Container terciário                      |
| `on-tertiary`             | `#003915` | Texto sobre tertiary                     |
| `error`                   | `#ffb4ab` | Vermelho erro / atraso                   |
| `error-container`         | `#93000a` | Container de erro                        |
| `on-error`                | `#690005` | Texto sobre error                        |
| `on-error-container`      | `#ffdad6` | Texto sobre error container              |
| `outline`                 | `#908fa0` | Bordas sutis, texto placeholder          |
| `outline-variant`         | `#464554` | Bordas de cards e separadores            |
| `inverse-primary`         | `#494bd6` | Primary invertido (light surfaces)       |

---

## Tipografia

- **Fonte:** Inter (Google Fonts)
- **CSS Import:**
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  ```
- **Escala de tamanhos:**

| Uso                   | Classe Tailwind   | Tamanho |
|-----------------------|-------------------|---------|
| Labels / micro-texto  | `text-[10px]`     | 10px    |
| Cabeçalho de seção    | `text-[11px]`     | 11px    |
| Corpo / inputs        | `text-sm`         | 14px    |
| Títulos de card       | `text-base`       | 16px    |
| Títulos de página     | `text-lg`         | 18px    |
| Valores monetários    | `text-xl`/`2xl`   | 20–24px |
| Logo / hero           | `text-2xl`        | 24px    |

- **Peso:** `font-medium` (500) para corpo, `font-semibold` (600) para títulos, `font-bold` (700) para valores
- **Line-height:** padrão 1.5 (Tailwind default) — não sobrescrever
- **Mínimo de corpo no mobile:** 14px (`text-sm`) para evitar auto-zoom no iOS

---

## Espaçamento

Sistema 4pt/8pt (Tailwind spacing scale):

| Token     | Valor | Uso típico                        |
|-----------|-------|-----------------------------------|
| `p-1`     | 4px   | Gaps mínimos entre badges         |
| `p-2`     | 8px   | Gap entre ícone e texto           |
| `p-3`     | 12px  | Padding de chips e pills          |
| `p-4`     | 16px  | Padding padrão de cards (mobile)  |
| `p-5`     | 20px  | Padding de cards médios           |
| `p-6`     | 24px  | Padding de cards grandes (desktop)|
| `gap-3`   | 12px  | Gap entre items de lista          |
| `gap-4`   | 16px  | Gap padrão entre cards            |
| `gap-6`   | 24px  | Gap entre seções                  |
| `space-y-6`| 24px | Espaço vertical entre blocos      |

---

## Componentes Canônicos

### Classes utilitárias globais (index.css)

```css
/* Cartão com glassmorphism */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  position: relative;
  overflow: hidden;
}
.glass-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, #c0c1ff1a, #8083ff1a);
  pointer-events: none;
  z-index: 0;
}

/* Seção principal */
.section-card → .glass-card rounded-2xl border border-outline-variant/50 p-6
```

### Botões

```
.btn-primary  → bg-primary text-on-primary-fixed rounded-xl px-4 py-2.5 font-semibold text-sm
             Tamanho mínimo mobile: min-h-[44px]
             
.btn-ghost    → text-on-surface-variant hover:bg-surface-container-high rounded-xl px-4 py-2.5 text-sm
             Tamanho mínimo mobile: min-h-[44px]
             
.btn-danger   → bg-error-container text-on-error-container rounded-xl px-4 py-2.5 font-semibold text-sm
```

### Inputs

```
.input-field → bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm
             Altura mínima: 48px (py-3 = 12px * 2 + 24px line-height)
             Em mobile, sempre usar input-field padrão (nunca < 44px)
```

### Navigation

- **Desktop** (`md+`): Sidebar fixa à esquerda, `w-[220px]`, `bg-surface-container-lowest`
- **Mobile** (`< md`): Bottom nav fixa na base, `h-[56px]`, com ícone + label
- **Active state:** `text-primary` + ícone com `FILL: 1`
- Máximo de 5 itens no bottom nav (regra Material Design)

---

## Responsividade — Mobile First

### Breakpoints

| Breakpoint | Largura  | Contexto                            |
|-----------|----------|--------------------------------------|
| (base)    | 0–767px  | **Mobile — design primário**        |
| `md`      | 768px+   | Tablet e desktop compacto           |
| `lg`      | 1024px+  | Desktop padrão                      |
| `xl`      | 1280px+  | Desktop largo                       |

### Regras Mobile First obrigatórias

1. **Todos os layouts começam em coluna única** (`grid-cols-1`, `flex flex-col`)
2. **Touch targets mínimos:** `min-h-[44px] min-w-[44px]` em todos os elementos interativos
3. **Bottom nav** consome 56px + safe area na base — todo scroll content precisa de `pb-[76px] md:pb-6`
4. **Header sticky** consome 56px no topo — usar `pt-0` pois o Layout já gerencia
5. **Nunca usar `min-h-screen`** — sempre `min-h-dvh` para compatibilidade com iOS Safari
6. **Viewport:** `width=device-width, initial-scale=1` no index.html (já configurado)
7. **Sem scroll horizontal** — verificar em 375px (iPhone SE)

### Grid padrão por contexto

```
Dashboard stats:    grid-cols-2 lg:grid-cols-4
Card grid:          grid-cols-1 md:grid-cols-2
Form split:         col-span-12 lg:col-span-7 / lg:col-span-5
Config split:       col-span-12 lg:col-span-8 / lg:col-span-4
Full width layout:  xl:grid-cols-3 (2/3 + 1/3 em XL, coluna única abaixo)
```

---

## Efeitos Visuais

- **Glassmorphism:** `glass-card` + `backdrop-blur-xl` + `bg-white/5`
- **Borda:** `border border-outline-variant/50` em cards normais
- **Borda ativa:** `border-primary/30` em hover/focus de cards
- **Shimmer skeleton:** `.shimmer-bg` com `animation: shimmer 1.5s infinite linear`
- **Animações de entrada:** `animate-fadeIn` (opacidade + translateY 8px, 300ms)
- **Slide lateral:** `animate-slideIn` (opacidade + translateX 20px, 300ms)
- **Bordas coloridas por status:**
  - Pago: `border-tertiary/50` + barra `bg-tertiary`
  - Pendente: `border-yellow-400/50` + barra `bg-yellow-400`
  - Atrasado: `border-error/50` + barra `bg-error`

---

## Padrões de Status / Badges

| Status    | Fundo              | Texto                  |
|-----------|-------------------|------------------------|
| Pago      | `bg-tertiary/15`  | `text-tertiary`        |
| Pendente  | `bg-yellow-400/15`| `text-yellow-400`      |
| Atrasado  | `bg-error/15`     | `text-error`           |
| Ativo     | `bg-tertiary/15`  | `text-tertiary`        |
| Inativo   | `bg-outline/15`   | `text-outline`         |
| Mensal    | (via format.ts)   | (via format.ts)        |

---

## Sistema de Ícones

- **Biblioteca:** Material Symbols Outlined (Google)
- **Tag:** `<span className="material-symbols-outlined">`
- **Filled:** via `style={{ fontVariationSettings: "'FILL' 1" }}`
- **Tamanhos:** `text-sm` (18px), `text-lg` (20px), `text-xl` (24px), `text-[22px]` (bottom nav)
- **❌ NUNCA** usar emojis como ícones estruturais (ícones de navegação, status, ações)
- **❌ NUNCA** misturar filled/outline no mesmo nível hierárquico

---

## Anti-Patterns (PROIBIDO)

- ❌ `min-h-screen` — usar `min-h-dvh`
- ❌ Emojis como ícones estruturais (navegação, status, ação)
- ❌ Touch targets < 44×44px
- ❌ Texto body < 14px (`text-sm`) no mobile
- ❌ Scroll horizontal no mobile (verificar em 375px)
- ❌ Layout-shifting em hover (evitar `scale` que desloca outros elementos)
- ❌ Contraste de texto < 4.5:1
- ❌ Estados de foco invisíveis
- ❌ Múltiplos CTAs primários na mesma tela
- ❌ Fundo claro (`#fff` / `#F8FAFC`) — projeto é totalmente dark

---

## Checklist Pré-Entrega

- [ ] Nenhum emoji como ícone estrutural (usar Material Symbols)
- [ ] Todos os botões interativos com `min-h-[44px]`
- [ ] Verificado em 375px (iPhone SE) sem scroll horizontal
- [ ] `min-h-dvh` em vez de `min-h-screen`
- [ ] Conteúdo não escondido atrás do bottom nav (`pb-[76px] md:pb-6` no main)
- [ ] Texto body mínimo `text-sm` (14px)
- [ ] Focus states visíveis para navegação por teclado
- [ ] Tokens semânticos usados (não hex hardcoded nos componentes)
- [ ] Transições suaves (150–300ms) em todos os estados interativos
- [ ] `cursor-pointer` em todos os elementos clicáveis
