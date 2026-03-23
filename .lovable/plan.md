

# Design System Autoral — Refinamento Completo

## Diagnóstico Atual

O sistema já usa Outfit e paleta Indigo+Amber, mas ainda apresenta características de template:
- Border radius excessivo (`rounded-[20px]` nos cards, `rounded-[14px]` nos botões)
- Sombras com tint de cor (indigo-tinted) que parecem artificiais
- Gradientes decorativos no hero e sidebar que gritam "builder"
- Glassmorphism genérico (`backdrop-blur-xl`, `bg-card/90`)
- Cores lavanda nos neutros (cinzas com hue 230-235) — muito "template moderno"

## Mudanças Propostas

### 1. TIPOGRAFIA — Hierarquia mais forte

Manter Outfit mas ajustar pesos e tracking:
- `h1`: `text-3xl font-black tracking-[-0.03em]` (mais imponente)
- `h2`: `text-xl font-bold tracking-[-0.02em]`
- `h3`: `text-base font-semibold`
- Labels de seção: `text-[11px] font-semibold uppercase tracking-[0.08em]` (menos espaçado, mais legível)
- Texto secundário: `text-muted-foreground font-normal` (mais leve)

**Arquivo:** `src/index.css` (regras base de tipografia)

### 2. RAIO DE BORDA — Sofisticado, não infantil

```text
Antes                    →  Depois
Cards: rounded-[20px]    →  rounded-xl (12px)
Botões: rounded-[14px]   →  rounded-lg (8px)
Inputs: rounded-[14px]   →  rounded-lg (8px)
Badges: rounded-full     →  rounded-md (6px)
--radius: 1rem           →  0.75rem
```

**Arquivos:** `src/index.css` (--radius), `card.tsx`, `button.tsx`, `badge.tsx`, `input.tsx`

### 3. BOTÕES — Sólidos, sem gradiente

- Primary: cor sólida `bg-primary`, sem `shadow-button` pesado
- Hover: `brightness-105` + `shadow-md` sutil (sem glow)
- Pressed: `scale-[0.97]` mantido
- Remover classes `shadow-button`, `shadow-elevated` do hover

**Arquivo:** `src/components/ui/button.tsx`

### 4. SOMBRAS — Neutras e elegantes

Substituir sombras indigo-tinted por sombras neutras:

```text
--shadow-card:       0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)
--shadow-card-hover: 0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)
--shadow-elevated:   0 10px 30px -8px rgb(0 0 0 / 0.12)
--shadow-glow:       removido (sem glow artificial)
--shadow-button:     0 1px 2px 0 rgb(0 0 0 / 0.05)
```

**Arquivo:** `src/index.css`

### 5. PALETA DE CORES — Azul petróleo + neutros verdadeiros

```text
Antes (lavanda)              →  Depois (neutro real)

Background: 230 25% 96%      →  220 14% 96%   (cinza mais neutro)
Foreground: 235 45% 8%       →  220 30% 10%   (preto menos azulado)
Card: 240 20% 99%            →  0 0% 100%     (branco puro)
Muted: 230 15% 92%           →  220 10% 93%   (cinza limpo)
Muted-fg: 230 12% 44%        →  220 8% 46%    (cinza médio neutro)
Border: 230 18% 88%          →  220 10% 90%   (borda neutra)

Primary: 245 85% 60%         →  215 80% 48%   (azul petróleo forte)
Accent: 38 95% 56%           →  38 90% 50%    (amber mais sóbrio)
Success: 160 70% 42%         →  152 55% 40%   (verde mais sóbrio)
Destructive: 4 80% 58%       →  0 65% 50%     (vermelho mais sofisticado)

Sidebar BG: 240 40% 5%       →  220 25% 8%    (escuro neutro, menos roxo)
Sidebar Primary: 245 90% 68% →  215 85% 55%   (azul petróleo claro)
```

Dark mode ajustado de forma equivalente.

**Arquivo:** `src/index.css`

### 6. CARDS — Limpos, sem glassmorphism

Remover:
- `backdrop-blur-xl` (glassmorphism desnecessário)
- `bg-card/90` → `bg-card` (opacidade total)
- `hover:-translate-y-0.5` → remover (movimento excessivo)
- `hover:border-primary/15` → `hover:border-border` (sutil)

Card fica: `rounded-xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover`

**Arquivo:** `src/components/ui/card.tsx`

### 7. SIDEBAR — Mais contraste, menos decoração

- Remover gradiente do header (`bg-gradient-to-r from-sidebar-accent/30`)
- Remover `sidebar-active-indicator` com pseudo-element e glow
- Active state: `bg-sidebar-primary/12 text-sidebar-primary font-semibold` + borda esquerda sólida de 2px
- Section labels: remover a linha decorativa (`span h-px w-3`), manter só texto
- Ícone no active: remover `drop-shadow`

**Arquivos:** `src/components/layout/Sidebar.tsx`, `src/index.css` (remover `.sidebar-active-indicator`)

### 8. EXECUTIVE HERO BLOCK — Menos decorativo

- Remover blob decorativo (`absolute -top-20 -right-20 w-40 h-40 rounded-full`)
- Remover gradiente de fundo hero (`bg-[image:var(--gradient-hero)]`)
- Remover barra gradient no topo (`h-1 w-full bg-gradient-to-r`)
- Manter estrutura, apenas limpar decorações

**Arquivo:** `src/components/dashboard/ExecutiveHeroBlock.tsx`

### 9. MICROINTERAÇÕES — Refinadas

- Manter `entrance-stagger` mas reduzir delay (40ms em vez de 60ms)
- Manter `animate-fade-in` mas com duração menor (300ms)
- Remover `animate-glow-pulse` (glow artificial)
- Remover `text-glow` do balance
- Remover shimmer da barra de progresso
- Hover em cards: apenas `shadow-card-hover`, sem translate

**Arquivo:** `src/index.css`, `src/components/dashboard/ExecutiveHeroBlock.tsx`

### 10. MOBILE NAV — Consistência

- Ajustar border-radius dos itens para `rounded-lg`
- Remover gradientes nos estados ativos
- Bottom nav com fundo sólido e borda top sutil

**Arquivo:** `src/components/layout/MobileNav.tsx`

### 11. STAT CARDS — Mais limpos

- Remover `accent-bar-left` com pseudo-element gradient
- Remover `backdrop-blur-sm`
- Border radius: `rounded-xl`
- Ícone: fundo sólido `bg-primary/8` sem gradiente circular

**Arquivo:** `src/components/dashboard/StatCard.tsx`

---

## Resumo de Arquivos

| Arquivo | Tipo de mudança |
|---------|----------------|
| `src/index.css` | Paleta de cores, sombras, remover utilities decorativas, tipografia |
| `tailwind.config.ts` | Ajustar --radius, remover animações de glow |
| `src/components/ui/card.tsx` | Simplificar, remover glassmorphism |
| `src/components/ui/button.tsx` | Cor sólida, sem gradiente/glow |
| `src/components/ui/badge.tsx` | Border radius menor |
| `src/components/ui/input.tsx` | Border radius menor, focus simples |
| `src/components/layout/Sidebar.tsx` | Remover decorações, active state limpo |
| `src/components/layout/MobileNav.tsx` | Consistência de radius e estados |
| `src/components/layout/AppLayout.tsx` | Remover gradient-hero do fundo |
| `src/components/layout/TopPlatformSwitcher.tsx` | Simplificar |
| `src/components/dashboard/StatCard.tsx` | Remover accent-bar, simplificar |
| `src/components/dashboard/ExecutiveHeroBlock.tsx` | Remover decorações, manter dados |
| `src/components/dashboard/CurrentSituationBlock.tsx` | Ajustar radius |

## Resultado

Interface que transmite autoridade e controle. Sem gradientes decorativos, sem glow artificial, sem glassmorphism genérico. Cores mais neutras com azul petróleo como âncora. Tipografia forte com hierarquia clara. Border radius consistente e profissional.

