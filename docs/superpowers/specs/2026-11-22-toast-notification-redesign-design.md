# Toast Notification Redesign Spec

**Date:** 2026-11-22  
**Status:** Approved  

## 1. Intent & Why
The current notification popups in arthaX appear at the bottom-right corner (`bottom-5 right-5`) with a boxy, dark card and cramped typography. Users find the placement awkward and distracting, obscuring bottom action buttons (forms, submission triggers, pagination) and feeling visually detached from user actions.

This spec details a modern, sleek notification system repositioned to **Top-Center** floating dynamic pill style with refined typography, luminous status badges, progress timer bars, and hover-to-pause interactions.

## 2. Goals & Non-Goals
### Goals
- **Optimal Ergonomic Placement:** Position notifications at top-center (`top-5 inset-x-0 mx-auto max-w-md`), floating naturally in the user's line of sight below the navigation header without blocking action buttons.
- **FinTech Glassmorphic Aesthetics:** Match the arthaX design system with frosted glass backdrop blur, luminous status accents (emerald, rose, amber, sky), and subtle ambient glow.
- **Refined Typography & Hierarchy:** High-legibility `Plus Jakarta Sans` for headings and `Inter` for body copy, with crisp weights and contrast in both dark and light modes.
- **Auto-Dismiss Progress Bar:** Visual countdown indicator line along the bottom of the toast card with pause-on-hover capability.
- **Backward Compatibility:** Maintain 100% compatibility with the existing `useToast().showToast(...)` function signatures and vitest suites.

### Non-Goals
- Replacing the lightweight context system with heavy third-party npm packages (e.g. Sonner, React-Toastify) that introduce external dependencies and potential React 19 incompatibilities.

## 3. Approaches Considered & Trade-offs
1. **Top-Center Floating Dynamic Pill (Chosen):**
   - *Pros:* Ideal visibility right after action completion, perfectly responsive across mobile and desktop, never overlaps bottom buttons or sidebars.
   - *Cons:* Needs careful z-index (`z-50`) to sit above page content and headers.
2. **Top-Right Notification Stack:**
   - *Pros:* Standard desktop web application pattern.
   - *Cons:* Off-center on mobile devices; gets crowded near profile and setting menus.
3. **Bottom-Center Floating Banner:**
   - *Pros:* Clean top viewport.
   - *Cons:* Conflicts with bottom action sheets, mobile keyboards, and footer buttons.

## 4. Design & Component Specifications
- **Container:** `fixed top-5 inset-x-0 mx-auto max-w-md w-[calc(100%-2rem)] z-50 flex flex-col items-center gap-2.5 pointer-events-none`
- **Toast Card:**
  - Glassmorphic container with `backdrop-blur-xl bg-[var(--app-card)]/90 border border-[var(--app-border)] shadow-2xl rounded-2xl`
  - Subtle radial glow and left accent border reflecting status type (`emerald`, `rose`, `amber`, `sky`)
  - Icons: `CheckCircle2` (success), `AlertCircle` (error), `AlertTriangle` (warning), `Info` (info) inside `w-7 h-7 rounded-xl` badges
  - Typography: Title (`text-xs sm:text-sm font-semibold tracking-tight text-[var(--app-fg)]`), Message (`text-[11px] sm:text-xs text-[var(--app-muted)] leading-relaxed`)
  - Auto-dismiss countdown progress bar at bottom of card (`h-0.5 w-full bg-[status-color]/70`)
  - Hover-to-pause: Hovering over the toast pauses the dismiss timer; moving cursor away resumes it.
