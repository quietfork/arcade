import { useState } from 'react';
import { Icon } from './Icons';
import { FileTreeNode, FileTreeContextRequest } from './FileTreeNode';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import * as store from './fileTreeStore';

export interface ExplorerFocusedRoot {
    paneId: string;
    cwd: string;
    label: string;
}

export interface ExplorerViewProps {
    focusedRoot: ExplorerFocusedRoot | null;
    onCopyPath: (path: string) => void;
    onRevealPath?: (path: string) => void;
    onLaunchInPath?: (path: string, label: string) => void;
    onOpenFile?: (path: string, name: string) => void;
}

export function ExplorerView({
    focusedRoot,
    onCopyPath,
    onRevealPath,
    onLaunchInPath,
    onOpenFile,
}: ExplorerViewProps) {
    const [menu, setMenu] = useState<FileTreeContextRequest | null>(null);
    const [reloadCounter, setReloadCounter] = useState(0);

    const reloadAll = () => {
        store.resetAll();
        setReloadCounter((n) => n + 1);
    };

    const buildMenu = (): ContextMenuItem[] => {
        if (!menu) return [];
        const items: ContextMenuItem[] = [
            {
                label: 'Copy path',
                icon: <Icon.Copy />,
                onClick: () => onCopyPath(menu.path),
            },
        ];
        if (onRevealPath) {
            items.push({
                label: 'Reveal in Explorer',
                icon: <Icon.Reveal />,
                onClick: () => onRevealPath(menu.path),
            });
        }
        if (menu.isDir && onLaunchInPath) {
            items.push({
                label: 'Launch session here',
                icon: <Icon.Folder />,
                onClick: () => onLaunchInPath(menu.path, menu.name),
                separatorBefore: true,
            });
        }
        return items;
    };

    return (
        <div className="view-section view-section-fill">
            <div className="view-head">
                <span>
                    explorer{focusedRoot ? ` · ${focusedRoot.label}` : ''}
                </span>
                <button onClick={reloadAll} title="Reload all (clear cache)">↻</button>
            </div>
            <div className="file-tree" key={reloadCounter}>
                {!focusedRoot && (
                    <div className="project-empty">
                        no focused pane.<br />
                        click a pane to see its folder here.
                    </div>
                )}
                {focusedRoot && (
                    <FileTreeNode
                        // Key by path so switching focus to a different cwd
                        // remounts a fresh root (its expanded state is still
                        // restored from the module-level store).
                        key={focusedRoot.cwd}
                        name={focusedRoot.label}
                        rootLabel={focusedRoot.label}
                        path={focusedRoot.cwd}
                        isDir
                        isRoot
                        depth={0}
                        onContext={setMenu}
                        onOpenFile={onOpenFile}
                    />
                )}
            </div>

            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    items={buildMenu()}
                    onClose={() => setMenu(null)}
                />
            )}
        </div>
    );
}
