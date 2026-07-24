# Pixel Design System

This is the agent-facing spec for adopting and maintaining the **pixel** design language. It is framework-agnostic but assumes a Tailwind v4 token setup (`--color-*` from CSS vars) and, optionally, SSR.

When this file is present, it **overrides** any conflicting design rules in `AGENTS.md`. Add a one-line reference to `AGENTS.md` so the agent loads it:

```markdown
@DESIGN-SYSTEM.md
```

## 1. Philosophy

Surfaces are **flat, sharp, rectangular, and pixel-forward**. Visual weight comes from borders, surface stepping, and subtle shadows — never from gradients, glass, glow, or rounded chrome.

- Monochrome. No accented hue. Accent/brand/ring are hueless grays.
- Status is expressed through existing component variants, not colored pills.
- Icons live on neutral `bg-muted` tiles, never accent-tinted.
- Fonts are unsmoothed; images render pixelated.

## 2. Hard rules (never)

- **Never set `font-size` manually.** Use semantic hierarchy (`h1`–`h3`, `strong`, `em`, `small`).
- **Never set `font-family` manually.** Use `--font-sans` / `--font-mono` / `--font-heading` / `--font-small`.
- **Never add `border-radius` to surfaces or controls.** `--radius` is `0`. The only allowed `rounded-*` is `rounded-full`, and only for functional indicators (avatars, switch knob, live status dots). Everything else stays square.
- **Never use** `backdrop-blur`, translucent `bg-*/NN` scrims (a plain opaque `bg-black/40` page overlay is acceptable), gradients, glow, multi-layer colored shadows, or grid/texture overlay decoration.
- **Never hardcode colors** (`text-cyan-*`, `border-white/*`). Always use theme tokens so light/dark stay coherent.
- **Never introduce per-component pixel-font copies.** Fonts are declared once at the root.

## 3. Color tokens

Dark is the default mode; `.light` activates light. Surface steps `bg-a`→`bg-d` go darkest-to-lightest in dark, reversed in light.

### Dark (default)

| Token            | Value                       |
| ---------------- | --------------------------- |
| `--background`   | `#151515`                   |
| `--foreground`   | `#d2d2d2`                   |
| `--card`         | `#1a1a1a`                   |
| `--popover`      | `#2d2d2d`                   |
| `--primary`      | `#1e1e1e`                   |
| `--primary-foreground` | `#d2d2d2`             |
| `--secondary`    | `#232323`                   |
| `--secondary-foreground` | `#d2d2d2`             |
| `--muted`        | `#232323`                   |
| `--muted-foreground` | `#777`                   |
| `--accent`       | `#232323`                   |
| `--accent-foreground` | `#d2d2d2`              |
| `--destructive`  | `#f87171`                   |
| `--destructive-foreground` | `#151515`           |
| `--border`       | `rgba(255,255,255,0.14)`    |
| `--input`        | `rgba(255,255,255,0.18)`    |
| `--ring`         | `#949494`                   |
| `--brand`        | `#949494`                   |
| `--brand-foreground` | `#151515`                |
| `--radius`       | `0rem`                      |

### Light (`.light`)

| Token            | Value                       |
| ---------------- | --------------------------- |
| `--background`   | `#e6e6e6`                   |
| `--foreground`   | `#151515`                   |
| `--card`         | `#fdfdfd`                   |
| `--popover`      | `#d5d5d5`                   |
| `--primary`      | `#212121`                   |
| `--primary-foreground` | `#d2d2d2`             |
| `--secondary`    | `#e5e5e5`                   |
| `--muted`        | `#e5e5e5`                   |
| `--muted-foreground` | `#9c9c9c`               |
| `--accent`       | `#d5d5d5`                   |
| `--accent-foreground` | `#151515`              |
| `--destructive`  | `#b91c1c`                   |
| `--border`       | `rgba(0,0,0,0.18)`          |
| `--input`        | `rgba(0,0,0,0.22)`          |
| `--ring`         | `#575757`                   |
| `--brand`        | `#575757`                   |
| `--brand-foreground` | `#fdfdfd`              |

### Chart palette (hueless ramp)

Dark: `--chart-1` `#d2d2d2`, `--chart-2` `#949494`, `--chart-3` `#777`, `--chart-4` `#5a5a5a`, `--chart-5` `#3a3a3a`
Light: `--chart-1` `#151515`, `--chart-2` `#575757`, `--chart-3` `#949494`, `--chart-4` `#c2c2c2`, `--chart-5` `#d5d5d5`

Index 1 is the most prominent series; higher indexes are recessive. Resolve the palette from CSS vars at runtime (see SSR notes). Do not hardcode hex in chart components.

## 4. Typography

Fonts are bundled as `woff2` and served from `/fonts/`. Declare `@font-face` once in the global stylesheet.

| Token            | Family stack                                                                 | Role                  |
| ---------------- | ---------------------------------------------------------------------------- | --------------------- |
| `--font-sans`    | `"Mix", "Pretendard Variable", Pretendard, ui-sans-serif, system-ui, sans-serif` | body, UI labels |
| `--font-mono`    | `"Gohu", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | code, IDs, kickers |
| `--font-heading` | `"Pixellari", "Mix", "Pretendard Variable", sans-serif`                      | `h1` only             |
| `--font-small`   | `"Simple", "Mix", "Pretendard Variable", sans-serif`                        | `small`, compact meta  |

Rules:

- Latin glyphs render in the pixel font; Korean falls back to Pretendard Variable. Do **not** force a pixel font onto CJK — it has no glyphs and will tofu.
- `h1` → `var(--font-heading)`, `font-weight: 400`, `line-height: 1`.
- `h2` / `h3` → `var(--font-sans)`, `font-weight: 400`.
- Body `font-size` is `16px` with `line-height: 1.25`.
- `-webkit-font-smoothing: none`; `-moz-osx-font-smoothing: grayscale`; `font-synthesis: none`.
- `img`, `canvas`, `svg` → `image-rendering: pixelated`.
- `.kicker` (section overlines) uses `--font-mono`, weight `400`, letter-spacing `0.08em`, uppercase.
- Never use `mono`/`font-mono` as a decorative label styling — only for literal text (code, paths, IDs).

## 5. Geometry

- `--radius`, `--radius-sm/md/lg/xl` are all `0rem`. Square corners everywhere.
- Borders are `1px` (`1px` reads sharper at small control sizes — pick one width project-wide and stay consistent).
- `--border` is a low-alpha neutral; never a bright outline.
- Shadows are flat: one subtle inset + one soft drop. No colored glow, no layered colored shadows. Reference: `inset 0 1px 0 rgba(0,0,0,0.24), 0 10px 30px rgba(0,0,0,0.28)` (dark).
- Transitions are fast (`80ms`–`160ms`) on `background-color`, `color`, `border-color` only.
- Scrollbar thumbs are square (`border-radius: 0`), neutral alpha-mixed.

## 6. Conflict handling (existing markup)

When adopting this system in a project that already has shadcn/ui or similar, audit for hard-coded geometry that fights the `0` radius token and fix only those:

| Pattern                                | Action                                                       |
| -------------------------------------- | ------------------------------------------------------------ |
| `rounded-2xl`, `rounded-3xl`, `rounded-4xl` on surfaces/cards | Replace with `rounded-lg` (now resolves to `0`). |
| `rounded-full` on badges/pills         | Replace with `rounded-sm` (square). Badges must be rectangular. |
| `rounded-lg` / `rounded-xl` on cards   | Leave as-is; the `0` token flattens them automatically.      |
| `rounded-full` on avatars, switch knob, live status dots | Keep — these are functional indicators. |
| Any `backdrop-blur-*`                  | Remove; replace with an opaque `--card`/`--muted` surface.   |
| Any gradient / glow utility            | Remove; use a flat surface step instead.                     |

Do not mass-rewrite components. Only the hard-coded radius/blur/gradient values above conflict with the pixel token layer.

## 7. SSR notes

- Style via **CSS variables only**. No runtime class normalization, no JS-driven theming, no client-only runtime theme initializers.
- The theme class (`.dark` / `.light`) is applied to `<html>` on the server (cookie or default) to avoid a flash.
- A chart-theme helper reads `getComputedStyle` in `useEffect`; provide a static `emptyTheme` fallback with the **same hueless values** (used during SSR and before hydration):

  ```ts
  const emptyTheme = {
      palette: [],
      fallback: "#777",
      grid: "rgba(255,255,255,0.14)",
      ticks: "#777",
      border: "rgba(255,255,255,0.14)",
      brand: "#949494",
      foreground: "#d2d2d2",
      muted: "#232323",
  };
  ```

  Keep the fallback in sync with the dark tokens in section 3.

## 8. Adoption procedure

Run this when bringing a project onto this system:

1. **Rewrite the global stylesheet's token block** (`:root` + `.dark` + `@theme inline`) to the values in section 3. Declare the four `@font-face` blocks and the `--font-*` stacks in `@theme inline`.
2. **Set base rendering:** `body` → `font-family: var(--font-sans)`, `font-size: 16px`, `line-height: 1.25`, `-webkit-font-smoothing: none`, `font-synthesis: none`. Add `image-rendering: pixelated` on `img, canvas, svg`. Style `h1`/`h2`/`h3` from `--font-heading`/`--font-sans`. Make `.kicker` use `--font-mono`. Square the scrollbar thumb.
3. **Align `code` / `.prose pre`** to square corners (`border-radius: 0`) on `--card`/`--muted`.
4. **Update the chart-theme SSR fallback** to the hueless values in section 7.
5. **Audit and fix conflicts** per section 6.
6. **Verify:** run the project's `lint`, `fmt`, and `build` commands. Visually confirm Latin text renders in `Mix`, code/IDs in `Gohu`, headings in `Pixellari`, and Korean in Pretendard, with square corners and no gradients.

## 9. Ongoing rules (when adding new UI)

- Reach for the project's existing primitives and `border` + a `bg-*` class before writing custom chrome.
- New badges are rectangular; never `rounded-full` on a status badge.
- New icons sit on a neutral `bg-muted` tile — do not tint with `--brand`.
- Reserve `--brand` / `--ring` for interactive/active states, focus rings, links, and data highlights (chart bars). Nothing else gets the accent.
- Keep `rounded-full` exclusive to avatars, the switch knob, and live status dots.
- Numeric metrics and table cells use `tabular-nums`.
- If a screen feels visually wrong, fix surface stepping, spacing, or wording before touching typography.
