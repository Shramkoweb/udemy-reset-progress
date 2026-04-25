# Apple HIG Redesign — Udemy Reset Progress

**Date:** 2026-04-25
**Reference:** quizlet-list design system (Apple HIG-aligned)
**Status:** Implemented

## Design Tokens

Custom tokens defined in `assets/tailwind.css` via Tailwind 4 `@theme`:

| Token | Value | Usage |
|-------|-------|-------|
| `brand` | #6366f1 | Primary buttons, focus rings |
| `brand-hover` | #4f46e5 | Primary button hover |
| `brand-soft` | #eef2ff | Balanced speed badge |
| `surface` | #f5f5f7 | Secondary buttons, settings bg, gear icon |
| `surface-hover` | #e5e5e7 | Secondary hover, progress state |
| `ink` | #1d1d1f | Primary text |
| `ink-muted` | #86868b | Subtitles, captions, disabled text |
| `ok` | #22c55e | Success/done state |
| `bad` | #ef4444 | Error text, error icon |
| `bad-soft` | #fef2f2 | Error pill bg, error button state |

## Typography

- Font: SF Pro (system stack) with `-webkit-font-smoothing: antialiased` and `letter-spacing: -0.01em`
- Title: 15px semibold
- Button: 14px (sm) medium
- Subtitle/caption: 11px
- Error: 12px (xs) medium
- Footer: 11px

## Popup Changes

- **Width**: 288px → 320px (`w-80`)
- **Button height**: 40px → 44px (`h-11`)
- **Button radius**: 12px → 10px (`rounded-[10px]`)
- **Primary button**: black → indigo (`bg-brand text-white`)
- **Secondary button**: gray-200 → surface (`bg-surface text-ink`)
- **Done state**: emerald-500 → ok (`bg-ok`)
- **Error state**: red button → soft pill (`bg-bad-soft text-bad`)
- **Error message**: bare red text → structured pill with icon
- **Transitions**: 200ms → 150ms
- **Focus rings**: none → `focus-visible:ring-2 ring-brand/20 ring-offset-2`
- **Added**: subtitle "Manage your course progress"
- **Footer**: "Crafted with ❤️" → "shramko.dev"
- **Removed**: DaisyUI `btn` class from buttons (kept `loading` spinner)

## Options Page Changes

- **Background**: `bg-base-200/50` → `bg-surface/50`
- **Card background**: `bg-base-100` → `bg-white`
- **Text**: `text-base-content` → `text-ink` / `text-ink-muted`
- **Balanced badge**: `bg-blue-100 text-blue-700` → `bg-brand-soft text-brand`
- **Saved indicator**: `text-emerald-500` → `text-ok`
- **Borders**: `ring-base-content/5` → `ring-ink/5`
- **Help text**: increased opacity for readability

## CSS Base

Added to `@layer base`:
```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: -0.01em;
}
```

## DaisyUI Status

Kept for `loading` (spinner) and `range` (slider) components. Removed `btn` class from all buttons — pure utility styling.

## Files Changed

1. `assets/tailwind.css` — design tokens + font smoothing
2. `entrypoints/popup/app.tsx` — full restyle
3. `entrypoints/options/app.tsx` — token alignment
