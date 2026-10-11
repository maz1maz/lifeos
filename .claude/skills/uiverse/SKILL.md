---
name: uiverse
description: Find, pick and port ready-made UI elements from Uiverse.io (buttons, loaders, toggles, checkboxes, radios, inputs, forms, cards, tooltips, notifications, patterns — ~3800, MIT) into any project (React, Vue, Svelte, plain HTML, Tailwind). Use when the user mentions Uiverse, asks for a nicer/animated button, loader, spinner, switch, checkbox, card, input or tooltip, or says "یه دکمه/لودر/سوییچ قشنگ", "از uiverse بیار", "طراحی‌اش را قشنگ‌تر کن".
---

# Uiverse → any project

Source of truth: `github.com/uiverse-io/galaxy` (MIT). The website itself
blocks bots (403), so **always use the repo via the helper script**.
Each element is one `.html` file = markup + `<style>` with a header comment
`From Uiverse.io by <author> - Tags: …`.

## 1. Find candidates
```bash
S=.claude/skills/uiverse/scripts/uiverse.sh   # or wherever this skill lives
$S cats                                  # categories + counts
$S search loaders dots                   # match ALL words in tags/author/name
$S search Toggle-switches light\&dark
$S random Buttons 5
$S show Checkboxes/<file>.html           # read full code
```
Categories: `Buttons Cards Checkboxes Forms Inputs Notifications Patterns Radio-buttons Toggle-switches Tooltips loaders`.

Pick **2–3 candidates**, render each (step 4) and let the user choose,
unless they already named one. Prefer elements that: have `light&dark` or
easily themable colors, are pure CSS, are small (<150 lines CSS), and
don't rely on fixed English text or huge fixed sizes.

## 2. Port it (rules for every project)
1. **Detect the stack** (package.json / file types) and convert:
   - React/Preact: `class`→`className`, `for`→`htmlFor`, inline `style="a:b"`→object, self-close void tags, inputs controlled (`checked`+`onChange`). One component file + one CSS file (or CSS module).
   - Vue/Svelte: SFC with scoped `<style>`.
   - Plain HTML: keep as is, CSS in the project stylesheet.
   - Tailwind elements: keep classes only if the project uses Tailwind; otherwise translate to CSS.
2. **Namespace everything**: prefix classes and `@keyframes` (e.g. `uv-loader-…`) so they can't clash with existing CSS. Remove global selectors (`body`, `*`, `html`) from the snippet.
3. **Theme tokens**: replace hard-coded colors with the project's CSS variables (look for `:root{--…}`, theme files, Tailwind config). Expose size/color as props or custom properties (`--uv-size`, `--uv-color`).
4. **Dark/light**: follow the project's mechanism (class, `data-theme`, or `prefers-color-scheme`).
5. **RTL** (Persian/Arabic projects, `dir="rtl"`): flip `left/right`, `translateX` directions, `margin-left`→`margin-inline-start`, slide-in toggles must move toward the inline-end. Replace English text with the project's language; keep fonts from the project, not the snippet.
6. **Accessibility**: real `<button>`/`<input>` elements, `aria-label` for icon-only, `role="status"` + hidden text for loaders, visible `:focus-visible`, and
   `@media (prefers-reduced-motion: reduce){ animation:none }`.
7. **Security/CSP**: no inline event handlers (`onclick=`), no inline `<script>`; remove external font/image URLs or self-host them (a strict CSP will block them).
8. **Attribution**: keep one comment line `/* Based on Uiverse.io by <author> (MIT) */`.
9. **Reuse**: put it in the project's shared UI folder and replace old usages only where the user asked.

## 3. Project notes
- **LifeOS / «هسته»** (`maz1maz/lifeos`): React 19 in `src/today/src/`; put components as flat files in `src/today/src/` (e.g. `loader.jsx` + `loader.css` = shared `<Loader />`) with their CSS imported **before** `mobile.css` in `main.jsx`; colors from `shared-theme.css` (gold accent); theme = `lifeos-mode`; Persian text, `dir=rtl`; strict CSP (no inline handlers). Check with `npm run build:today && npm test` and a Playwright screenshot.
- Other projects: read their CLAUDE.md / README first and add a line here.

## 4. Preview
Render the ported element (and candidates) in the real app or a scratch page
with Playwright, screenshot light + dark, and show the user before wiring it
everywhere.
