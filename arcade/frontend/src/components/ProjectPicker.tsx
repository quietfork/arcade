import { useEffect, useRef, useState } from 'react';
import { ListWithStatus } from '../../wailsjs/go/main/ProjectStore';
import { main } from '../../wailsjs/go/models';

export interface ProjectPickerProps {
    anchor: HTMLElement;
    onPick: (project: main.Project) => void;
    onClose: () => void;
    headerLabel?: string;
}

export function ProjectPicker({ anchor, onPick, onClose, headerLabel = 'pick a project' }: ProjectPickerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [items, setItems] = useState<main.ProjectStatus[]>([]);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    useEffect(() => {
        ListWithStatus().then(setItems).catch(() => undefined);
    }, []);

    // Position the popover below the anchor button.
    useEffect(() => {
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const top = Math.min(r.bottom + 4, window.innerHeight - 240);
        const left = Math.max(8, Math.min(r.right - 240, window.innerWidth - 250));
        setPos({ top, left });
    }, [anchor]);

    // Click outside / Escape to close.
    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        // Defer 1 tick so the click that opened us doesn't immediately close.
        const t = window.setTimeout(() => {
            document.addEventListener('mousedown', onDocMouseDown);
            document.addEventListener('keydown', onKey);
        }, 0);
        return () => {
            window.clearTimeout(t);
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <div className="popover" ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left }}>
            <div className="popover-head">{headerLabel}</div>
            <div className="popover-list">
                {items.length === 0 && (
                    <div className="popover-empty">no projects yet — register one from the sidebar.</div>
                )}
                {items.map((it) => (
                    <button
                        key={it.project.id}
                        className={`popover-row ${!it.pathExists ? 'is-missing' : ''}`}
                        disabled={!it.pathExists}
                        onClick={() => onPick(it.project)}
                        title={it.project.path + (it.pathExists ? '' : '\n(path not found)')}
                    >
                        {!it.pathExists && <span className="warn-icon">⚠ </span>}
                        <span className="popover-row-name">{it.project.name}</span>
                        <span className="popover-row-path">{it.project.path}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
