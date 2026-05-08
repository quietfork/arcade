import { useEffect, useRef, useState } from 'react';
import { ListNamed, DeleteNamed } from '../../wailsjs/go/main/LayoutStore';
import { main } from '../../wailsjs/go/models';

export interface LayoutsMenuProps {
    anchor: HTMLElement;
    onApply: (snap: main.LayoutSnapshot) => void;
    onSaveAs: () => void;
    onClose: () => void;
}

export function LayoutsMenu({ anchor, onApply, onSaveAs, onClose }: LayoutsMenuProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [items, setItems] = useState<main.LayoutSnapshot[]>([]);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    useEffect(() => { void refresh(); }, []);
    const refresh = async () => {
        try {
            const list = await ListNamed();
            setItems(list);
        } catch (err) {
            console.error('list layouts failed', err);
        }
    };

    useEffect(() => {
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const top = Math.min(r.bottom + 4, window.innerHeight - 280);
        const left = Math.max(8, Math.min(r.right - 280, window.innerWidth - 290));
        setPos({ top, left });
    }, [anchor]);

    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
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

    const remove = async (name: string) => {
        if (!confirm(`Delete layout "${name}"?`)) return;
        try {
            await DeleteNamed(name);
            await refresh();
        } catch (err) {
            console.error('delete layout failed', err);
        }
    };

    return (
        <div className="popover" ref={ref} style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: 280 }}>
            <div className="popover-head">layouts</div>
            <div className="popover-list">
                {items.length === 0 && (
                    <div className="popover-empty">no saved layouts. use "save current as…" below.</div>
                )}
                {items.map((snap) => (
                    <div key={snap.id} className="layout-row">
                        <button
                            className="layout-row-name"
                            onClick={() => onApply(snap)}
                            title={`apply layout (${snap.panes?.length ?? 0} panes)`}
                        >
                            <span>{snap.name}</span>
                            <span className="layout-row-count">{snap.panes?.length ?? 0}</span>
                        </button>
                        <button
                            className="icon-btn icon-danger"
                            title="Delete layout"
                            onClick={() => void remove(snap.name)}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
            <div className="popover-foot">
                <button className="popover-foot-btn" onClick={onSaveAs}>+ save current as…</button>
            </div>
        </div>
    );
}
