import { useState } from 'react';
import { main } from '../../wailsjs/go/models';
import { ProjectsView } from './ProjectsView';
import { Badge } from './Badge';
import { Icon } from './Icons';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { TerminalStatus } from './Terminal';

export interface ActivePaneItem {
    paneId: string;
    title: string;
    cwd: string;
    workspaceLabel?: string;
    status: TerminalStatus;
}

export interface WorkspaceViewProps {
    refreshKey: number;
    readOnly?: boolean;
    onLaunch: (project: main.Project) => void;
    onAddClick: () => void;
    onEditClick: (project: main.Project) => void;
    onAfterDelete: () => void;
    activePanes: ActivePaneItem[];
    focusedPaneId: string | null;
    onFocusPane: (paneId: string) => void;
    onClosePane: (paneId: string) => void;
    onCopyPath: (path: string) => void;
    onRevealPath?: (path: string) => void;
}

export function WorkspaceView({
    refreshKey,
    readOnly = false,
    onLaunch,
    onAddClick,
    onEditClick,
    onAfterDelete,
    activePanes,
    focusedPaneId,
    onFocusPane,
    onClosePane,
    onCopyPath,
    onRevealPath,
}: WorkspaceViewProps) {
    const [paneMenu, setPaneMenu] = useState<{ x: number; y: number; pane: ActivePaneItem } | null>(null);

    const openPaneMenu = (e: React.MouseEvent, p: ActivePaneItem) => {
        e.preventDefault();
        e.stopPropagation();
        setPaneMenu({ x: e.clientX, y: e.clientY, pane: p });
    };

    const paneMenuItems = (): ContextMenuItem[] => {
        if (!paneMenu) return [];
        const p = paneMenu.pane;
        const items: ContextMenuItem[] = [
            {
                label: 'Copy path',
                icon: <Icon.Copy />,
                onClick: () => onCopyPath(p.cwd),
                disabled: !p.cwd,
            },
        ];
        if (onRevealPath) {
            items.push({
                label: 'Reveal in Explorer',
                icon: <Icon.Reveal />,
                onClick: () => onRevealPath(p.cwd),
                disabled: !p.cwd,
            });
        }
        items.push(
            {
                label: 'Focus pane',
                icon: <Icon.Focus />,
                onClick: () => onFocusPane(p.paneId),
                separatorBefore: true,
            },
            {
                label: 'Close pane',
                icon: <Icon.X />,
                onClick: () => onClosePane(p.paneId),
                danger: true,
            },
        );
        return items;
    };

    return (
        <div className="workspace-view">
            <ProjectsView
                refreshKey={refreshKey}
                readOnly={readOnly}
                onLaunch={onLaunch}
                onAddClick={onAddClick}
                onEditClick={onEditClick}
                onAfterDelete={onAfterDelete}
                onCopyPath={onCopyPath}
                onRevealPath={onRevealPath}
            />

            <div className="view-section view-section-fill view-section-divided">
                <div className="view-head">
                    <span>active panes · {activePanes.length}</span>
                </div>
                <div className="session-list">
                    {activePanes.length === 0 && (
                        <div className="project-empty">no active panes.</div>
                    )}
                    {activePanes.map((p) => (
                        <div
                            key={p.paneId}
                            className={`sess-item ${focusedPaneId === p.paneId ? 'focused' : ''}`}
                            onClick={() => onFocusPane(p.paneId)}
                            onContextMenu={(e) => openPaneMenu(e, p)}
                        >
                            <div className="sess-item-head">
                                <span className="id">[{p.paneId.toUpperCase()}]</span>
                                <span className="name">{p.title}</span>
                                <Badge status={p.status} />
                            </div>
                            <div className="sess-item-path">
                                {p.workspaceLabel && (
                                    <span className="ws-chip" style={{ marginRight: 6 }}>
                                        <span className="ws-glyph" />
                                        {p.workspaceLabel}
                                    </span>
                                )}
                                {p.cwd}
                            </div>
                            <div className="sess-item-actions">
                                <button
                                    className="icon-btn icon-danger"
                                    title="Close pane"
                                    onClick={(e) => { e.stopPropagation(); onClosePane(p.paneId); }}
                                >
                                    <Icon.X />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {paneMenu && (
                <ContextMenu
                    x={paneMenu.x}
                    y={paneMenu.y}
                    items={paneMenuItems()}
                    onClose={() => setPaneMenu(null)}
                />
            )}
        </div>
    );
}
