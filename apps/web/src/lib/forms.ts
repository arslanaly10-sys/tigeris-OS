"use client";
import { useEffect } from "react";

/**
 * Form helpers for the Web Interface Guidelines: buttons stay enabled; a missing field is explained
 * next to it and receives focus. Returns the message to show, or null when the value is long enough.
 */
export function requireText(value: string, min: number, fieldId: string, what: string): string | null {
  if (value.trim().length >= min) return null;
  const el = document.getElementById(fieldId);
  el?.focus();
  el?.setAttribute("aria-invalid", "true");
  return `${what} needs at least ${min} characters. Add it and try again.`;
}

export function clearInvalid(fieldId: string) {
  document.getElementById(fieldId)?.removeAttribute("aria-invalid");
}

/** Warns before leaving the page while edits are unsaved. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);
}
