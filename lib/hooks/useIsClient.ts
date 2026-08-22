"use client";

import { useSyncExternalStore } from "react";
import { ensureSeedData } from "@/lib/data/seed";

/**
 * Every page that needs browser data imports this module (for the hook
 * below), so this top-level call is guaranteed to run exactly once, before
 * any of those pages' first client render — the client-side equivalent of
 * the demo's top-level `rbSeedIfEmpty()` script call. ensureSeedData() is a
 * no-op on the server and idempotent after the first real run, so this is
 * safe even under React Strict Mode's double-invoke-in-dev behavior.
 */
if (typeof window !== "undefined") {
  ensureSeedData();
}

function subscribeNever(): () => void {
  return () => {};
}

/**
 * True once hydrated on the client, false during SSR and the initial
 * hydration render. This is the useSyncExternalStore pattern for gating
 * reads of browser-only state (localStorage, here) without an Effect: the
 * server-rendered markup and the client's first-paint markup both use the
 * "false" branch, so there's no hydration mismatch, and no setState call
 * inside an Effect is needed to flip into the "real" client render.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
