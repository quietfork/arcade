import { useState, RefObject } from 'react';
import { DividerSpec, Path } from '../splitTree';

export interface FlatDividerProps {
    spec: DividerSpec;
    workspaceRef: RefObject<HTMLDivElement>;
    onResize: (path: Path, ratio: number) => void;
    onResizeEnd?: () => void;
}

export function FlatDivider({ spec, workspaceRef, onResize, onResizeEnd }: FlatDividerProps) {
    const [dragging, setDragging] = useState(false);
    const isH = spec.dir === 'h';

    const startDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const wsEl = workspaceRef.current;
        if (!wsEl) return;
        const wsRect = wsEl.getBoundingClientRect();
        setDragging(true);

        const move = (ev: MouseEvent) => {
            let r: number;
            if (isH) {
                const wsX = (ev.clientX - wsRect.left) / wsRect.width;
                r = (wsX - spec.parentBox.x) / spec.parentBox.w;
            } else {
                const wsY = (ev.clientY - wsRect.top) / wsRect.height;
                r = (wsY - spec.parentBox.y) / spec.parentBox.h;
            }
            r = Math.max(0.05, Math.min(0.95, r));
            onResize(spec.path, r);
        };
        const up = () => {
            setDragging(false);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            onResizeEnd?.();
        };
        document.body.style.cursor = isH ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    // Position the divider as a thin line across the parent split.
    const px = spec.parentBox.x;
    const py = spec.parentBox.y;
    const pw = spec.parentBox.w;
    const ph = spec.parentBox.h;
    const r = spec.ratio;

    const style: React.CSSProperties = isH
        ? {
              position: 'absolute',
              left: `calc(${(px + pw * r) * 100}% - 0.5px)`,
              top: `${py * 100}%`,
              width: '1px',
              height: `${ph * 100}%`,
              cursor: 'col-resize',
          }
        : {
              position: 'absolute',
              left: `${px * 100}%`,
              top: `calc(${(py + ph * r) * 100}% - 0.5px)`,
              width: `${pw * 100}%`,
              height: '1px',
              cursor: 'row-resize',
          };

    return (
        <div
            className={`flat-divider ${spec.dir} ${dragging ? 'dragging' : ''}`}
            style={style}
            onMouseDown={startDrag}
        />
    );
}
