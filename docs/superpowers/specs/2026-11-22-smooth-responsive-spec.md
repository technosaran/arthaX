# Smooth Dynamic & Responsive Redesign Spec

## Vision
Transform arthaX into an institutional-grade, ultra-smooth, dynamic, and mobile-first responsive sovereign financial intelligence platform.

## Key Pain Points Addressed
1. **Lack of Viewport Ergonomics on Mobile**:
   - Navigation on mobile relied solely on a hidden desktop sidebar drawer that was clunky for one-handed operation.
   - The Public Landing page lacked a mobile menu drawer entirely, preventing mobile visitors from navigating to features or compliance sections.
2. **Abrupt State & Tab Switches**:
   - Tab switching in `HomeClient.tsx` used abrupt CSS `hidden`/`block` toggles with 0 visual continuity or enter animations.
3. **Static Marketing Presentation**:
   - The public landing page was text-heavy and lacked dynamic interactive elements showcasing the sovereign multi-asset capabilities.
4. **Touch & Modal Micro-interactions**:
   - Modals and stat cards snapped without fluid scale-in or tactile tap feedback.

## Requirements & Scope
- **Motion System**: Add hardware-accelerated CSS animations (`tabEnter`, `sheetSlideUp`, `pulseGlow`) with `prefers-reduced-motion` compliance.
- **Mobile Navigation**: Introduce a thumb-friendly `MobileBottomNav` with primary docks (Dashboard, Portfolio, Cashflow, More) and a smooth slide-up drawer for secondary modules.
- **Tab Continuity**: Wrap active tab content in smooth transition containers for fluid, non-jarring switching.
- **Interactive Landing Preview**: Provide an interactive live simulated ledger preview card on the landing page with interactive asset switching and simulated live P&L data.
- **Responsive Clamping**: Auto-scale typography and prevent horizontal overflow on screens down to 320px.
