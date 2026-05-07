import { useEffect } from 'react';

export interface ToastProps {
    message: string;
    onDismiss: () => void;
    durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 1800 }: ToastProps) {
    useEffect(() => {
        const id = window.setTimeout(onDismiss, durationMs);
        return () => window.clearTimeout(id);
    }, [message, durationMs, onDismiss]);

    return (
        <div className="toast" role="status" aria-live="polite">
            {message}
        </div>
    );
}
