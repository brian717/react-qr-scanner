/**
 * Single source of truth for the keyboard focus ring shared by every
 * `.rqs-control` button: on-off, torch, zoom (rendered inside Finder) and the
 * status-overlay retry control (rendered independently of Finder).
 *
 * Inline styles can't express `:focus-visible`, so the rule ships as a tiny
 * stylesheet rendered next to whichever control surface is mounted. Centralising
 * it here keeps the rule from diverging across components, and because CSS is
 * idempotent, rendering it from more than one place at once (e.g. Finder and the
 * status overlay together) is harmless.
 *
 * Internal only — intentionally NOT re-exported from `src/index.ts`. SSR-safe
 * (renders `<style>` in JSX, no `document`/`window`) and StrictMode-safe
 * (stateless, no effects).
 */
export const CONTROL_FOCUS_CSS =
	'.rqs-control:focus-visible{outline:2px solid #fff;outline-offset:2px;border-radius:6px;}';

export default function ControlFocusStyle() {
	return <style>{CONTROL_FOCUS_CSS}</style>;
}
