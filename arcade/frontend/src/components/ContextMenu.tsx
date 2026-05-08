import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    separatorBefore?: boolean;
}

export interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

/**
 * Lightweight floating context menu. Closes on outside click / Esc.
 * The supplied (x, y) is the desired top-left corner; the menu auto-flips
 * left/up when it would overflow the viewport.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let left = x;
        let top = y;
        if (left + rect.width > vw - 4) left = Math.max(4, vw - rect.width - 4);
        if (top + rect.height > vh - 4) top = Math.max(4, vh - rect.height - 4);
        setPos({ left, top });
    }, [x, y, items.length]);

    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Element)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const onScroll = () => onClose();
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onClose);
        return () => {
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onClose);
        };
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="context-menu"
            style={{ position: 'fixed', left: pos.left, top: pos.top }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, i) => (
                <div key={i}>
                    {item.separatorBefore && <div className="context-sep" />}
                    <button
                        className={`context-item ${item.danger ? 'danger' : ''}`}
                        disabled={item.disabled}
                        onClick={() => {
                            if (item.disabled) return;
                            item.onClick();
                            onClose();
                        }}
                    >
                        {item.icon && <span className="context-icon">{item.icon}</span>}
                        <span className="context-label">{item.label}</span>
                    </button>
                </div>
            ))}
        </div>
    );
}
