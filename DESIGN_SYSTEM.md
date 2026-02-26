# Design System - Daily Status

## 1. Paleta de Cores

O projeto utiliza uma paleta baseada no Tailwind Slate (tons escuros) com Emerald como cor de destaque (Primary).

### Cores Principais (Primary - Emerald)
| Nome Semântico | Hex | Uso |
| :--- | :--- | :--- |
| `primary-500` | `#10b981` | Cor principal da marca, botões primários, ícones de sucesso. |
| `primary-600` | `#059669` | Hover de botões primários. |
| `primary-400` | `#34d399` | Gradientes e destaques de texto. |

### Cores de Fundo (Background - Slate)
| Nome Semântico | Hex | Uso |
| :--- | :--- | :--- |
| `background` | `#020617` | Cor de fundo principal da aplicação (`slate-950`). |
| `background-secondary` | `#0f172a` | Cards e seções secundárias (`slate-900`). |
| `background-tertiary` | `#1e293b` | Elementos de UI profundos e bordas (`slate-800`). |

### Cores de Texto (Foreground - Slate)
| Nome Semântico | Hex | Uso |
| :--- | :--- | :--- |
| `foreground` | `#f8fafc` | Texto principal, títulos (`slate-50`). |
| `foreground-secondary` | `#cbd5e1` | Texto secundário, descrições (`slate-300`). |
| `foreground-muted` | `#64748b` | Texto desativado, placeholders (`slate-500`). |

### Status
| Categoria | Cor / Hex | Uso |
| :--- | :--- | :--- |
| `Success` | `emerald-500` | Validado, Sucesso, Ativo. |
| `Danger` | `red-500` | Erros, exclusão, cancelado. |
| `Warning` | `yellow-500` | Alertas, pendente. |
| `Info` | `blue-500` | Informações neutras. |

---

## 2. Tipografia

- **Fonte Principal:** `Inter` (Sans-serif) via Google Fonts.
- **Pesos:** 400 (Regular), 500 (Medium), 700 (Bold).

| Escala | Tamanho | Line Height | Uso |
| :--- | :--- | :--- | :--- |
| `xs` | `0.75rem` | `1rem` | Labels pequenas, badges. |
| `sm` | `0.875rem` | `1.25rem` | Texto de apoio, inputs, botões pequenos. |
| `base` | `1rem` | `1.5rem` | Texto padrão (body). |
| `lg` | `1.125rem` | `1.75rem` | Títulos secundários. |
| `xl` | `1.25rem` | `1.75rem` | Títulos de cards. |
| `2xl` | `1.5rem` | `2rem` | Títulos de seção. |
| `3xl` | `1.875rem` | `2.25rem` | Títulos de página. |

---

## 3. Espaçamentos

Baseado na escala padrão do Tailwind CSS (4px/unit).

| Token | Valor (rem/px) | Uso |
| :--- | :--- | :--- |
| `xs` | `0.5rem (8px)` | Gaps internos de componentes pequenos. |
| `sm` | `0.75rem (12px)` | Padding de inputs e botões pequenos. |
| `md` | `1rem (16px)` | Gap entre elementos de formulário, padding de cards (móvel). |
| `lg` | `1.5rem (24px)` | Padding padrão de cards e seções. |
| `xl` | `2rem (32px)` | Espaçamento entre grandes blocos de conteúdo. |

**Valores Customizados (Tailwind Config):**
- `18`: `4.5rem` (72px)
- `88`: `22rem` (352px)
- `128`: `32rem` (512px)

---

## 4. Componentes de UI

Localizados em `components/ui/`:

- **Button (`Button.tsx`):** Suporta variantes `primary`, `secondary`, `danger`, `ghost`, `outline`. Tamanhos `xs` a `lg`. Possui suporte a ícones (`LucideIcon`) e estado de `loading`.
- **Input (`Input.tsx`):** Estilizado com glassmorphism. Suporta ícones à esquerda/direita, estados de erro (`error`), validando (`validating`) e validado (`validated`).
- **Card (`Card.tsx`):** Container principal com variantes `default`, `glass` e `bordered`. Inclui header com título, ícone e `headerActions`.
- **Badge (`Badge.tsx`):** Etiquetas de status arredondadas com variantes semânticas (`success`, `warning`, etc.).
- **Skeleton (`Skeleton.tsx` / `Spinner.tsx`):** Componentes para estados de carregamento.

---

## 5. Padrões de Layout

### Estrutura de Página
- **Main Container:** `max-w-5xl mx-auto px-4 sm:px-6 lg:px-8` para dashboards e formulários.
- **Navbar:** Fixa no topo (`fixed w-full z-50`) com efeito blur (`backdrop-blur-md`).
- **Grid de Cards:** Geralmente `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`.

### Efeitos Visuais (via `globals.css`)
- **Glassmorphism:** `.glass-panel` e `.glass-card` usam `backdrop-blur` e bordas semi-transparentes.
- **Interatividade:** Classe `.interactive` adiciona escalas suaves no hover/active.
- **Gradientes:** `.text-gradient-emerald` usado em títulos de destaque.

---

## 6. Regras de Uso

- **Deverá ser feito:**
  - Usar sempre `cn()` (classe de utilidade em `lib/utils.ts`) para concatenar classes do Tailwind.
  - Utilizar a cor `emerald-500` para ações principais e feedback positivo.
  - Manter o tema escuro (`slate-950`) como fundo padrão.
  - Usar `LucideIcon` para manter a consistência visual dos ícones.

- **Não deverá ser feito:**
  - Não usar cores "hardcoded" (ex: `text-[#123456]`). Prefira a escala do tema.
  - Não remover o efeito `backdrop-blur` da Navbar, para manter a legibilidade sobre o conteúdo.
  - Não utilizar gradientes de cores que não pertençam à paleta Emerald/Slate.

---

## Inconsistências Encontradas

1. **Tokens Duplicados:** Há tokens de cores e espaçamento definidos tanto no `tailwind.config.ts` quanto no `:root` do `app/globals.css`. Recomenda-se centralizar no Tailwind Config.
2. **Sombras Customizadas:** A sombra `shadow-emerald` está no config, mas o componente `Button.tsx` às vezes usa `hover:shadow-emerald` e outras vezes não há um padrão claro de aplicação de sombras em outros componentes clicáveis.
3. **Variante de Card:** O componente `Card.tsx` possui uma variante `glass`, mas o `globals.css` define `.glass-card` separadamente, criando uma redundância na definição visual.
4. **Border Default:** No `tailwind.config.ts`, `border.DEFAULT` é `slate-800/50`, mas muitos componentes usam `border-slate-800` (sem transparência) manualmente.
