/** Всплывающие уведомления. */

import { useEffect } from 'react';
import { CheckIcon, InfoIcon } from './icons';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast ${toast.type}`} onClick={() => onDismiss(toast.id)}>
      {toast.type === 'success' ? <CheckIcon /> : <InfoIcon />}
      <span>{toast.message}</span>
    </div>
  );
}
