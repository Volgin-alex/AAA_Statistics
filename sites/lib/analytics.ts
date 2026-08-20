"use client";

declare global {
  interface Window {
    AppMetrica?: {
      reportEvent?: (name: string, params?: Record<string, unknown>) => void;
    };
    ym?: (counterId: string | number, method: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.AppMetrica?.reportEvent?.(name, params);

  const counterId = process.env.NEXT_PUBLIC_APPMETRICA_ID;
  if (counterId && typeof window.ym === "function") {
    window.ym(counterId, "reachGoal", name, params);
  }
}

export function trackEcommerce(action: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: { [action]: payload } });
  trackEvent(`ecommerce_${action}`, payload);
}
