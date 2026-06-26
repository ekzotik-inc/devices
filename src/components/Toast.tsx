/** Всплывающие уведомления. */

import { useEffect, useState } from 'react';
import { CheckIcon, InfoIcon } from './icons';

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

const EXIT_MS = 240;

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toast-stack" aria-live="polite" role="status">
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
  const [leaving, setLeaving] = useState(false);

  // Сначала проигрываем мягкую анимацию ухода, затем удаляем.
  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), EXIT_MS);
  };

  useEffect(() => {
    const timer = setTimeout(dismiss, 4200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`toast ${toast.type}${leaving ? ' leaving' : ''}`}
      onClick={dismiss}
    >
      {toast.type === 'success' ? <CheckIcon /> : <InfoIcon />}
      <span>{toast.message}</span>
    </div>
  );
}
