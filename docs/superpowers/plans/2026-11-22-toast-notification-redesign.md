# Toast Notification Modern Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the floating notification system in `ToastContext.tsx` to float gracefully at top-center with frosted glass styling, status accent glow, refined typography, countdown progress bar, and hover-to-pause interactions.

**Architecture:** Refactor `ToastContext.tsx` to position the notification hub at top-center (`top-5 inset-x-0 mx-auto max-w-md`), introduce an individual `ToastItem` component that tracks active countdown progress and hover states, render status-specific luminous badges and progress lines, and preserve complete backward compatibility with all existing `showToast` call sites.

**Tech Stack:** React 19, Next.js 16 (App Router), Tailwind CSS v4, Lucide React icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-toast-notification-redesign-design.md`

## Global Constraints
- Preserve exact `useToast()` hook and `showToast(title, messageOrType, typeArg)` signatures.
- Must work seamlessly across dark and light modes using CSS variables (`--app-card`, `--app-fg`, `--app-border`, `--app-muted`).
- Ensure touch and mouse accessibility with `aria-live="polite"`, clean dismiss buttons, and pause-on-hover timer.
- All vitest test suites must pass cleanly.

## Review Focus
1. Rapid consecutive toasts stack cleanly without overlapping or exceeding the viewport.
2. 2-argument calls (e.g. `showToast("Title", "error")`) maintain proper type resolution without treating the type as message text.
3. Hovering with mouse pauses timer, unhover resumes dismissal cleanly.
4. Dismissing via close button immediately removes the toast from DOM without delay.
5. Mobile viewport responsiveness: fits smoothly on screens narrower than 400px with proper padding.

---

### Task 1: Refactor Toast Component in ToastContext.tsx

**Files:**
- Modify: `src/context/ToastContext.tsx`

**Interfaces:**
- Consumes: `ToastType`, `ToastFn`, `useToast`
- Produces: Enhanced `ToastProvider` and internal `ToastItem` with top-center placement, progress bar countdown, pause-on-hover, and glassmorphic card styling.

- [ ] **Step 1: Implement `ToastItem` with countdown timer and pause-on-hover in `src/context/ToastContext.tsx`**
  - Add remaining time / progress state that pauses on mouse enter and resumes on mouse leave.
  - Render status-specific icon badges (emerald CheckCircle2, rose AlertCircle, amber AlertTriangle, sky Info).
  - Apply top-center positioning container (`fixed top-5 inset-x-0 mx-auto max-w-md w-[calc(100%-2rem)] z-50 flex flex-col items-center gap-2.5 pointer-events-none`).
  - Style with frosted glass (`backdrop-blur-xl`), refined typography (`font-semibold text-xs sm:text-sm`), and animated bottom progress indicator.

- [ ] **Step 2: Verify in browser / build check**
  Run: `npm run typecheck`
  Expected: PASS with 0 errors.

- [ ] **Step 3: Commit component changes**
  ```bash
  git add src/context/ToastContext.tsx
  git commit -m "feat(ui): redesign toast notifications with top-center placement and progress bar"
  ```

---

### Task 2: Verify and Extend Tests for Toast Resolution and Timing

**Files:**
- Modify: `tests/messagesAndToasts.test.ts`

**Interfaces:**
- Consumes: `resolveToast`, `ToastType`
- Produces: Test coverage for toast duration calculations, type mappings, and progress parameters.

- [ ] **Step 1: Add unit tests for toast durations and styling configurations**
  Add test assertions validating that error and warning toasts receive extended duration (4800ms) while success and info receive 3800ms, and verifying payload shapes for all types.

- [ ] **Step 2: Run test suite**
  Run: `npx vitest run tests/messagesAndToasts.test.ts`
  Expected: PASS with all tests passing.

- [ ] **Step 3: Commit test updates**
  ```bash
  git add tests/messagesAndToasts.test.ts
  git commit -m "test(ui): add duration and styling test cases for redesigned toasts"
  ```

---

### Task 3: Full Project Verification & Regression Check

**Files:**
- All modified files

- [ ] **Step 1: Run comprehensive typecheck and test suite**
  Run: `npm run typecheck && npm run test`
  Expected: All checks and tests pass with 0 errors.

- [ ] **Step 2: Final commit if needed**
