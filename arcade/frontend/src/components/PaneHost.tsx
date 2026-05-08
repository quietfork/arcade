import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { AppShortcut, Terminal, TerminalHandle, TerminalProps, TerminalStatus } from './Terminal';
import { Badge } from './Badge';
import { Icon } from './Icons';
import { DropZone } from '../splitTree';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

export interface PaneHostProps extends TerminalProps {
    paneId: string;
    title: string;
    cwdLabel?: string;
    workspaceLabel?: string;
    focused?: boolean;
    dragActive?: boolean;
    isDragSource?: boolean;
    onFocus?: () => void;
    onClose?: () => void;
    onSplit?: (paneId: string, dir: 'h' | 'v', anchor: HTMLElement) => void;
    onMaximizeToggle?: (paneId: string) => void;
    maximized?: boolean;
    onDragStartHeader?: (paneId: string) => void;
    onDragEndHeader?: () => void;
    onDropOnPane?: (targetPaneId: string, zone: DropZone) => void;
    onStatusChange?: (status: TerminalStatus) => void;
    onCopyPath?: (path: string) => void;
    onRevealPath?: (path: string) => void;
}

export interface PaneHostHandle {
    fit: () => void;
    stop: () => Promise<void>;
    restart: () => Promise<void>;
}

export const PaneHost = forwardRef<PaneHostHandle, PaneHostProps>(function PaneHost(props, ref) {
    const {
        paneId,
        title,
        cwdLabel,
        workspaceLabel,
        focused,
        dragActive,
        isDragSource,
        maximized,
        onFocus,
        onClose,
        onSplit,
        onMaximizeToggle,
        onDragStartHeader,
        onDragEndHeader,
        onDropOnPane,
        onStatusChange,
        onCopyPath,
        onRevealPath,
        ...termProps
    } = props;

    const termRef = useRef<TerminalHandle>(null);
    const [status, setStatus] = useState<TerminalStatus>('idle');
    const [over, setOver] = useState<DropZone | null>(null);
    const [cwdMenu, setCwdMenu] = useState<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
        fit: () => termRef.current?.fit(),
        stop: async () => { await termRef.current?.stop(); },
        restart: async () => {
            await termRef.current?.stop();
            await termRef.current?.start();
        },
    }));

    const handleHeaderDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/x-pane-id', paneId);
        onDragStartHeader?.(paneId);
    };
    const handleHeaderDragEnd = () => onDragEndHeader?.();

    const allowDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const onZoneEnter = (z: DropZone) => () => setOver(z);
    const onZoneLeave = () => setOver(null);
    const onZoneDrop = (z: DropZone) => (e: React.DragEvent) => {
        e.preventDefault();
        setOver(null);
        onDropOnPane?.(paneId, z);
    };

    return (
        <div
            className={`pane ${focused ? 'focused' : ''} ${isDragSource ? 'drag-source' : ''}`}
            onMouseDown={onFocus}
        >
            <header
                className={`pane-header ${isDragSource ? 'dragging' : ''}`}
                draggable
                onDragStart={handleHeaderDragStart}
                onDragEnd={handleHeaderDragEnd}
            >
                <div className="pane-title">
                    <span className="pane-id">[{paneId.toUpperCase()}]</span>
                    <span>{title}</span>
                    <Badge status={status} />
                    {workspaceLabel && (
                        <span className="ws-chip">
                            <span className="ws-glyph" />
                            {workspaceLabel}
                        </span>
                    )}
                </div>
                <div
                    className="pane-cwd mono"
                    title={cwdLabel ? `${cwdLabel}\n(right-click to copy)` : ''}
                    onContextMenu={(e) => {
                        if (!cwdLabel) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setCwdMenu({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {cwdLabel ?? ''}
                </div>
                <div className="pane-actions">
                    {(status === 'exited' || status === 'error') && (
                        <button
                            className="pane-btn"
                            title="Restart"
                            onClick={(e) => { e.stopPropagation(); void termRef.current?.start(); }}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <Icon.Restart />
                        </button>
                    )}
                    <button
                        className="pane-btn"
                        title="Split right"
                        onClick={(e) => { e.stopPropagation(); onSplit?.(paneId, 'h', e.currentTarget); }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Icon.SplitH />
                    </button>
                    <button
                        className="pane-btn"
                        title="Split down"
                        onClick={(e) => { e.stopPropagation(); onSplit?.(paneId, 'v', e.currentTarget); }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Icon.SplitV />
                    </button>
                    <button
                        className="pane-btn"
                        title={maximized ? 'Restore' : 'Maximize'}
                        onClick={(e) => { e.stopPropagation(); onMaximizeToggle?.(paneId); }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {maximized ? <Icon.Restore /> : <Icon.Max />}
                    </button>
                    <button
                        className="pane-btn danger"
                        title="Close pane"
                        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Icon.X />
                    </button>
                </div>
            </header>

            <div className="pane-body">
                <Terminal
                    ref={termRef}
                    {...termProps}
                    onStatusChange={(s) => {
                        setStatus(s);
                        onStatusChange?.(s);
                    }}
                />
            </div>

            {dragActive && !isDragSource && (
                <div className="pane-droplayer active">
                    {(['l', 't', 'c', 'b', 'r'] as const).map((z) => (
                        <div
                            key={z}
                            className={`drop-zone dz-${z} ${over === z ? 'over' : ''}`}
                            onDragEnter={onZoneEnter(z as DropZone)}
                            onDragOver={allowDrop}
                            onDragLeave={onZoneLeave}
                            onDrop={z === 'c' ? (e) => { e.preventDefault(); setOver(null); } : onZoneDrop(z as DropZone)}
                        />
                    ))}
                </div>
            )}

            {cwdMenu && cwdLabel && (
                <ContextMenu
                    x={cwdMenu.x}
                    y={cwdMenu.y}
                    items={cwdMenuItems(cwdLabel, onCopyPath, onRevealPath)}
                    onClose={() => setCwdMenu(null)}
                />
            )}
        </div>
    );
});

function cwdMenuItems(
    path: string,
    onCopyPath?: (p: string) => void,
    onRevealPath?: (p: string) => void,
): ContextMenuItem[] {
    const items: ContextMenuItem[] = [
        {
            label: 'Copy path',
            icon: <Icon.Copy />,
            onClick: () => onCopyPath?.(path),
            disabled: !onCopyPath,
        },
    ];
    if (onRevealPath) {
        items.push({
            label: 'Reveal in Explorer',
            icon: <Icon.Reveal />,
            onClick: () => onRevealPath(path),
        });
    }
    return items;
}
