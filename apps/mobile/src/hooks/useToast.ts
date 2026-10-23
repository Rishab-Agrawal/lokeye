import { useState, useRef, useCallback } from 'react';

const TOAST_DURATION_MS = 2500;

/** Shared toast state hook used across all screens. */
export function useToast() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), TOAST_DURATION_MS);
  }, []);

  return { toastMsg, showToast };
}
