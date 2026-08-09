/**
 * Thin route marker for /chat/[id].
 *
 * Real UI lives in ChatRouteHost (client). Keeping this page empty means:
 * - Instant Navigations only swap a null segment (no blocking RSC/DB work)
 * - ChatRouteHost reuses mounted panes + tRPC cache for SPA-like chat switches
 * - Session auth still streams via (app)/layout Suspense (not opted out)
 */
export default function ChatPage() {
  return null;
}
