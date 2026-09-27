# Design System — Minha Carteira

Este arquivo centraliza os padrões visuais essenciais do projeto **Minha Carteira**.

## 1. Cores

### Marca

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#012048` | Cor principal |
| `secondary` | `#015363` | Elementos secundários |
| `accent` | `#00C7C4` | Destaques |

### Interface

| Token | Hex |
|---|---|
| `background` | `#F8FAFC` |
| `surface` | `#FFFFFF` |
| `border` | `#E2E8F0` |
| `text` | `#0F172A` |
| `text-muted` | `#64748B` |

### Estados

| Token | Hex |
|---|---|
| `success` | `#16A34A` |
| `warning` | `#F59E0B` |
| `error` | `#DC2626` |
| `info` | `#0284C7` |

### Gradiente da marca

```css
linear-gradient(135deg, #015363 0%, #00C7C4 100%);
```

Usar apenas em elementos de destaque.

---

## 2. Tipografia

Fonte principal:

```text
Space Grotesk + Poppins
```

Fallback:

```css
font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
```

Pesos utilizados:

```text
400 — Regular
500 — Medium
600 — Semibold
700 — Bold
```

### Escala

| Tipo | Tamanho | Peso |
|---|---:|---:|
| H1 | 30px | 700 |
| H2 | 24px | 600 |
| H3 | 20px | 600 |
| Body | 16px | 400 |
| Small | 14px | 400 |
| Caption | 12px | 400 |

Valores monetários podem utilizar `24px–36px` e peso `600–700`.

```css
font-variant-numeric: tabular-nums;
```

---

## 3. Espaçamento

Utilizar escala baseada em múltiplos de `4px`.

```text
4px
8px
12px
16px
24px
32px
48px
64px
```

Padrões:

```text
Label → Input: 8px
Entre campos: 16px
Padding de cards: 24px
Entre seções: 32px
```

---

## 4. Border Radius

```text
sm: 6px
md: 8px
lg: 12px
xl: 16px
```

Padrões:

```text
Inputs: 8px
Buttons: 8px
Cards: 12px
Dialogs: 16px
```

---

## 5. Componentes

### Botão primário

```text
Background: #012048
Texto: #FFFFFF
```

### Botão secundário

```text
Background: #F1F5F9
Texto: #012048
```

### Botão destrutivo

```text
Background: #DC2626
Texto: #FFFFFF
```

### Cards

```text
Background: #FFFFFF
Border: #E2E8F0
Radius: 12px
Padding: 24px
```

Priorizar bordas e contraste entre superfícies em vez de sombras fortes.

---

## 6. Ícones

Biblioteca:

```text
Lucide React
```

Tamanhos:

```text
16px — pequeno
20px — padrão
24px — destaque
```

Não misturar bibliotecas de ícones.

---

## 7. Tokens CSS

```css
:root {
  --primary: #012048;
  --secondary: #015363;
  --accent: #00c7c4;

  --background: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;

  --text: #0f172a;
  --text-muted: #64748b;

  --success: #16a34a;
  --warning: #f59e0b;
  --error: #dc2626;
  --info: #0284c7;
}
```

---

## 8. Regras

- Utilizar tokens em vez de cores hardcoded.
- Evitar excesso de gradientes, sombras e cores.
- Manter componentes visualmente consistentes.
- Priorizar clareza na exibição de valores financeiros.
- Antes de criar um novo padrão visual, verificar se já existe neste arquivo.
- Sempre registrar novos padrões visuais neste arquivo