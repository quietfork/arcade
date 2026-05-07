import { useEffect, useRef, useState } from 'react';

export interface NewWindowDialogProps {
    onClose: () => void;
    onSubmit: (slotName: string) => void;
}

const SLOT_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
const RESERVED = new Set([
    'CON', 'PRN', 'NUL', 'AUX',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5',
    'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5',
    'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

function validate(name: string): string | null {
    if (!name) return 'Slot name is required.';
    if (!SLOT_NAME_RE.test(name)) {
        return '1-32 chars, ASCII letters / digits / _ / - only.';
    }
    if (RESERVED.has(name.toUpperCase())) return 'That name is reserved by Windows.';
    return null;
}

const isDevMode = (import.meta as any)?.env?.DEV ?? false;

export function NewWindowDialog({ onClose, onSubmit }: NewWindowDialogProps) {
    const [name, setName] = useState('');
    const [touched, setTouched] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const error = touched ? validate(name) : null;

    const submit = () => {
        const err = validate(name);
        if (err) {
            setTouched(true);
            return;
        }
        onSubmit(name);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">Open new window</h3>
                <p className="form-hint" style={{ marginBottom: 12 }}>
                    Each slot has its own pane layout and sidebar state.
                    Shared state (projects, theme) lives in the main window.
                </p>
                {isDevMode && (
                    <div className="form-error" style={{ marginBottom: 12 }}>
                        Dev mode: spawned windows run the same dev binary,
                        but Vite's HMR is bound to this window. Production
                        builds work fully.
                    </div>
                )}
                <div className="form-row">
                    <label className="form-label">Slot name</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => setTouched(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submit();
                            else if (e.key === 'Escape') onClose();
                        }}
                        placeholder="e.g. second"
                        spellCheck={false}
                        autoComplete="off"
                    />
                </div>
                {error && <div className="form-error">{error}</div>}
                <div className="modal-actions">
                    <button onClick={onClose}>Cancel</button>
                    <button onClick={submit} disabled={!!error || !name}>Open</button>
                </div>
            </div>
        </div>
    );
}
