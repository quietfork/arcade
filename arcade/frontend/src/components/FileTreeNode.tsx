import { useState } from 'react';
import { Icon } from './Icons';
import { main } from '../../wailsjs/go/models';
import * as store from './fileTreeStore';

export interface FileTreeContextRequest {
    x: number;
    y: number;
    path: string;
    name: string;
    isDir: boolean;
}

export interface FileTreeNodeProps {
    name: string;
    path: string;
    isDir: boolean;
    isHidden?: boolean;
    isRoot?: boolean;
    rootLabel?: string;
    depth: number;
    onContext: (req: FileTreeContextRequest) => void;
    onOpenFile?: (path: string, name: string) => void;
}

const READABLE_EXTS = ['.md', '.markdown'];

function isReadableFile(name: string): boolean {
    const lower = name.toLowerCase();
    return READABLE_EXTS.some((ext) => lower.endsWith(ext));
}

function joinPath(base: string, child: string): string {
    if (!base) return child;
    const usesBackslash = base.indexOf('\\') >= 0;
    const sep = usesBackslash ? '\\' : '/';
    const trimmed = base.endsWith(sep) ? base.slice(0, -1) : base;
    return trimmed + sep + child;
}

export function FileTreeNode({
    name,
    path,
    isDir,
    isHidden,
    isRoot,
    rootLabel,
    depth,
    onContext,
    onOpenFile,
}: FileTreeNodeProps) {
    const readable = !isDir && isReadableFile(name);
    // Hydrate from the module-level store so the tree state survives remounts
    // (e.g. user switches Activity Bar tab away and back, or switches focus
    // to a different pane and back). The root pane defaults to open on first
    // visit so the user doesn't have to click to expand it every time.
    const [open, setOpenLocal] = useState<boolean>(() => {
        if (store.hasOpenState(path)) return store.isOpen(path);
        return !!isRoot;
    });
    const [children, setChildren] = useState<main.FileEntry[] | null>(() => store.getCached(path));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ensureLoaded = async () => {
        if (children !== null || loading) return;
        const cached = store.getCached(path);
        if (cached !== null) {
            setChildren(cached);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const entries = await store.loadDir(path);
            setChildren(entries);
        } catch (err: any) {
            setError(err?.message ?? String(err));
            setChildren([]);
        } finally {
            setLoading(false);
        }
    };

    // Auto-load children if the node is open at mount time (e.g. root, or a
    // restored-from-store expanded folder).
    if (open && children === null && !loading && !error) {
        void ensureLoaded();
    }

    const onRowClick = async () => {
        if (isDir) {
            const next = !open;
            store.setOpen(path, next);
            setOpenLocal(next);
            if (next) await ensureLoaded();
            return;
        }
        if (readable && onOpenFile) {
            onOpenFile(path, name);
        }
    };

    const onRowContext = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContext({ x: e.clientX, y: e.clientY, path, name, isDir });
    };

    const indent = 6 + depth * 12;
    const displayName = isRoot && rootLabel ? rootLabel : name;

    return (
        <div className={`ft-node ${isHidden ? 'hidden' : ''}`}>
            <div
                className={`ft-row ${isDir ? 'dir' : 'file'} ${isRoot ? 'root' : ''} ${readable ? 'readable' : ''}`}
                style={{ paddingLeft: indent }}
                onClick={onRowClick}
                onContextMenu={onRowContext}
                title={path}
            >
                <span className="ft-chevron">
                    {isDir ? (open ? <Icon.ChevronDown /> : <Icon.ChevronRight />) : null}
                </span>
                <span className="ft-icon">
                    {isDir ? <Icon.Folder /> : <span className="ft-file-glyph" />}
                </span>
                <span className="ft-name">{displayName}</span>
                {isRoot && <span className="ft-root-path">{path}</span>}
            </div>
            {isDir && open && (
                <div className="ft-children">
                    {loading && <div className="ft-loading" style={{ paddingLeft: indent + 18 }}>loading…</div>}
                    {error && <div className="ft-error" style={{ paddingLeft: indent + 18 }}>{error}</div>}
                    {children && children.length === 0 && !loading && !error && (
                        <div className="ft-empty" style={{ paddingLeft: indent + 18 }}>(empty)</div>
                    )}
                    {children?.map((c) => (
                        <FileTreeNode
                            key={c.name}
                            name={c.name}
                            path={joinPath(path, c.name)}
                            isDir={c.isDir}
                            isHidden={c.isHidden}
                            depth={depth + 1}
                            onContext={onContext}
                            onOpenFile={onOpenFile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
