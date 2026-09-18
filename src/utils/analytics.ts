/**
 * Minimal, privacy-respecting event hooks. No third-party tracking is wired
 * up — this just gives future integrations (GA4, Segment, etc.) a single
 * choke point to attach to instead of scattering trackers through components.
 */

export type AnalyticsEvent =
  | { name: "shoe_selected"; shoeId: string }
  | { name: "try_on_started"; mode: "live" | "photo" }
  | { name: "try_on_completed"; mode: "live" | "photo"; shoeId: string }
  | { name: "photo_captured"; shoeId: string }
  | { name: "shoe_switched"; fromShoeId: string; toShoeId: string }
  | { name: "add_to_cart"; shoeId: string; size: number };

export function trackEvent(event: AnalyticsEvent): void {
  if (import.meta.env.DEV) {
    console.debug("[analytics]", event.name, event);
  }
  // Hook a real provider here later, e.g.:
  // window.gtag?.("event", event.name, event);
}
