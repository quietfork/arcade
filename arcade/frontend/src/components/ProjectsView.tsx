import { useEffect, useState } from 'react';
import { ListWithStatus, Delete } from '../../wailsjs/go/main/ProjectStore';
import { main } from '../../wailsjs/go/models';
import { Icon } from './Icons';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

export interface ProjectsViewProps {
    refreshKey: number;
    readOnly?: boolean;
    onLaunch: (project: main.Project) => void;
    onAddClick: () => void;
    onEditClick: (project: main.Project) => void;
    onAfterDelete: () => void;
    onCopyPath: (path: string) => void;
    onRevealPath?: (path: string) => void;
}

export function ProjectsView({
    refreshKey,
    readOnly = false,
    onLaunch,
    onAddClick,
    onEditClick,
    onAfterDelete,
    onCopyPath,
    onRevealPath,
}: ProjectsViewProps) {
    const [items, setItems] = useState<main.ProjectStatus[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number; project: main.Project; pathExists: boolean } | null>(null);

    useEffect(() => {
        let cancelled = false;
        ListWithStatus()
            .then((list) => { if (!cancelled) setItems(list); })
            .catch((err) => { if (!cancelled) setError(String(err?.message ?? err)); });
        return () => { cancelled = true; };
    }, [refreshKey]);

    const remove = async (p: main.Project) => {
        if (!confirm(`Delete project "${p.name}"?\n(The folder itself is not touched.)`)) return;
        try {
            await Delete(p.id);
            onAfterDelete();
        } catch (err: any) {
            setError(`delete failed: ${err?.message ?? String(err)}`);
        }
    };

    const openMenu = (e: React.MouseEvent, p: main.Project, pathExists: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY, project: p, pathExists });
    };

    const menuItems = (): ContextMenuItem[] => {
        if (!menu) return [];
        const p = menu.project;
        const items: ContextMenuItem[] = [
            {
                label: 'Copy path',
                icon: <Icon.Copy />,
                onClick: () => onCopyPath(p.path),
            },
        ];
        if (onRevealPath) {
            items.push({
                label: 'Reveal in Explorer',
                icon: <Icon.Reveal />,
                onClick: () => onRevealPath(p.path),
                disabled: !menu.pathExists,
            });
        }
        items.push(
            {
                label: 'Launch',
                icon: <Icon.Folder />,
                onClick: () => onLaunch(p),
                disabled: !menu.pathExists,
                separatorBefore: true,
            },
            {
                label: 'Edit…',
                icon: <Icon.Edit />,
                onClick: () => onEditClick(p),
                disabled: readOnly,
            },
            {
                label: 'Delete',
                icon: <Icon.X />,
                onClick: () => void remove(p),
                danger: true,
                disabled: readOnly,
            },
        );
        return items;
    };

    return (
        <div className="view-section">
            <div className="view-head">
                <span>projects · {items.length}</span>
                <button
                    onClick={onAddClick}
                    title={readOnly ? 'Projects can only be added from the main window' : 'Add project'}
                    disabled={readOnly}
                >+</button>
            </div>
            {error && <div className="sidebar-error">{error}</div>}
            <div className="project-list">
                {items.length === 0 && (
                    <div className="project-empty">
                        no projects yet.<br />
                        click <strong>+</strong> to add one.
                    </div>
                )}
                {items.map((it) => (
                    <div
                        key={it.project.id}
                        className={`project-item ${!it.pathExists ? 'is-missing' : ''}`}
                        title={it.project.path + (it.pathExists ? '' : '\n(path not found)')}
                        onContextMenu={(e) => openMenu(e, it.project, it.pathExists)}
                    >
                        <button
                            className="project-name"
                            onClick={() => onLaunch(it.project)}
                            disabled={!it.pathExists}
                        >
                            {!it.pathExists && <span className="warn-icon">⚠ </span>}
                            {it.project.name}
                        </button>
                        <div className="project-actions">
                            <button
                                className="icon-btn"
                                title={readOnly ? 'Edit only available in main window' : 'Edit'}
                                onClick={() => onEditClick(it.project)}
                                disabled={readOnly}
                            >
                                <Icon.Edit />
                            </button>
                            <button
                                className="icon-btn icon-danger"
                                title={readOnly ? 'Delete only available in main window' : 'Delete'}
                                onClick={() => void remove(it.project)}
                                disabled={readOnly}
                            >
                                <Icon.X />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    items={menuItems()}
                    onClose={() => setMenu(null)}
                />
            )}
        </div>
    );
}
