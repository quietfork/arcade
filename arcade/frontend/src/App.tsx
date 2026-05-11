import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { TitleBar, SlotRole } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { ActivityBar, SidebarView } from './components/ActivityBar';
import { WorkspaceView, ActivePaneItem } from './components/WorkspaceView';
import { ExplorerView } from './components/ExplorerView';
import { ProjectDialog, ProjectDialogMode } from './components/ProjectDialog';
import { PaneHost, PaneHostHandle } from './components/PaneHost';
import { AppShortcut, TerminalStatus } from './components/Terminal';
import { ProjectPicker } from './components/ProjectPicker';
import { FlatDivider } from './components/FlatDivider';
import { SettingsDialog } from './components/SettingsDialog';
import { ConsentDialog } from './components/ConsentDialog';
import { LayoutsMenu } from './components/LayoutsMenu';
import { Toast } from './components/Toast';
import { MarkdownReader } from './components/MarkdownReader';
import { NewWindowDialog } from './components/NewWindowDialog';
import {
    Node, DropZone, Path,
    appendLeaf, removeLeaf, moveLeaf, updateRatioAtPath, leafIds, deserialize, serialize,
    findPath, insertAdjacent, computeBoxes, computeDividers,
} from './splitTree';
import { Add, MarkUsed, Update } from '../wailsjs/go/main/ProjectStore';
import { LoadDefault, SaveDefault, SaveNamed } from '../wailsjs/go/main/LayoutStore';
import { Load as LoadSettings, SetTheme, SetSidebarState } from '../wailsjs/go/main/SettingsStore';
import { GetSlot, GetSlotRole, OpenNewWindow, PlatformName, RevealInExplorer } from '../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import { main } from '../wailsjs/go/models';
import { modKey } from './platform';

const DEFAULT_COMMAND = 'claude';
const DEFAULT_ARGS = ['--dangerously-skip-permissions'];

type Theme = 'dark' | 'light';

export interface PaneDef {
    paneId: string;
    title: string;
    command: string;
    args: string[];
    cwd: string;
    projectId?: string;
    workspaceLabel?: string;
}

let paneCounter = 0;
const nextPaneId = () => `p${++paneCounter}`;
const projectPaneCounters = new Map<string, number>();
const nextProjectSeq = (projectId: string) => {
    const n = (projectPaneCounters.get(projectId) ?? 0) + 1;
    projectPaneCounters.set(projectId, n);
    return n;
};

function App() {
    const [panes, setPanes] = useState<Map<string, PaneDef>>(new Map());
    const [tree, setTree] = useState<Node | null>(null);
    const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
    const [dragSourcePaneId, setDragSourcePaneId] = useState<string | null>(null);
    const [paneStatus, setPaneStatus] = useState<Map<string, TerminalStatus>>(new Map());

    const [theme, setThemeState] = useState<Theme>('dark');
    const [settings, setSettings] = useState<main.Settings | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [needsConsent, setNeedsConsent] = useState(false);
    const [bootNotices, setBootNotices] = useState<string[]>([]);
    const [layoutsAnchor, setLayoutsAnchor] = useState<HTMLElement | null>(null);
    const [closeConfirm, setCloseConfirm] = useState<{ paneId: string; label: string } | null>(null);

    // Phase 5: VSCode-style sidebar
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [activeView, setActiveView] = useState<SidebarView>('workspace');
    const [toast, setToast] = useState<string | null>(null);
    const [platform, setPlatform] = useState<string>('');
    const [slotName, setSlotName] = useState<string>('main');
    const [slotRole, setSlotRole] = useState<SlotRole>('writer');
    const [newWindowOpen, setNewWindowOpen] = useState(false);
    const [readerPath, setReaderPath] = useState<string | null>(null);
    const [readerWidth, setReaderWidth] = useState<number>(520);
    const readerResizeRef = useRef<{ startX: number; startW: number } | null>(null);

    const [refreshKey, setRefreshKey] = useState(0);
    const [dialog, setDialog] = useState<{ mode: ProjectDialogMode; project?: main.Project | null } | null>(null);

    const [splitPicker, setSplitPicker] = useState<{ paneId: string; dir: 'h' | 'v'; anchor: HTMLElement } | null>(null);
    const [maximizedPaneId, setMaximizedPaneId] = useState<string | null>(null);

    const [loaded, setLoaded] = useState(false);
    const [restoreDialog, setRestoreDialog] = useState<main.LayoutSnapshot | null>(null);

    const paneRefs = useRef<Map<string, PaneHostHandle | null>>(new Map());
    const saveTimerRef = useRef<number | null>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const panesRootRef = useRef<HTMLDivElement>(null);

    // Apply theme to <html data-theme>
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        LoadSettings()
            .then((s) => {
                if (s) {
                    setSettings(s);
                    if (s.theme === 'light' || s.theme === 'dark') setThemeState(s.theme as Theme);
                    if (!s.dangerousConsent) setNeedsConsent(true);
                    // Phase 5: restore sidebar state
                    if (typeof (s as any).sidebarHidden === 'boolean') {
                        setSidebarVisible(!(s as any).sidebarHidden);
                    }
                    const av = (s as any).activeView;
                    if (av === 'workspace' || av === 'explorer') setActiveView(av);
                }
            })
            .catch((err: any) => {
                const msg = err?.message ?? String(err);
                if (/\.bak/i.test(msg)) {
                    setBootNotices((prev) => [...prev, `settings.json was reset (saved as .bak)`]);
                }
            });
        PlatformName().then(setPlatform).catch(() => undefined);
        GetSlot().then(setSlotName).catch(() => undefined);
        GetSlotRole()
            .then((r) => {
                if (r === 'writer' || r === 'reader') setSlotRole(r);
            })
            .catch(() => undefined);
    }, []);

    // Cross-slot sync: when another window writes shared state, the backend
    // emits these events. Refresh the affected UI without a manual reload.
    useEffect(() => {
        EventsOn('projects:changed', () => {
            setRefreshKey((n) => n + 1);
        });
        EventsOn('settings:changed', () => {
            LoadSettings()
                .then((s) => {
                    if (!s) return;
                    setSettings(s);
                    if (s.theme === 'light' || s.theme === 'dark') setThemeState(s.theme as Theme);
                })
                .catch(() => undefined);
        });
        // Reader slots receive this when they auto-promote (FR-NEW-20).
        EventsOn('slot:role-changed', (role: string) => {
            if (role === 'writer' || role === 'reader') {
                setSlotRole(role);
                if (role === 'writer') {
                    setToast('This window is now the writer (main window exited).');
                }
            }
        });
        return () => {
            EventsOff('projects:changed');
            EventsOff('settings:changed');
            EventsOff('slot:role-changed');
        };
    }, []);

    // Persist sidebar visibility / active view (debounced).
    const sidebarSaveTimerRef = useRef<number | null>(null);
    useEffect(() => {
        if (!settings) return;
        if (sidebarSaveTimerRef.current) window.clearTimeout(sidebarSaveTimerRef.current);
        sidebarSaveTimerRef.current = window.setTimeout(() => {
            SetSidebarState(!sidebarVisible, activeView).catch((err) =>
                console.error('save sidebar state failed', err),
            );
        }, 300);
        return () => {
            if (sidebarSaveTimerRef.current) window.clearTimeout(sidebarSaveTimerRef.current);
        };
    }, [sidebarVisible, activeView, settings]);

    // Mod+B: toggle sidebar visibility (VSCode-compatible). Cmd on Mac so
    // Ctrl+B remains free for emacs/readline cursor-backward inside terminals.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (modKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                setSidebarVisible((v) => !v);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const onSelectActivity = (view: SidebarView) => {
        if (sidebarVisible && activeView === view) {
            // Re-clicking the active icon hides the sidebar (VSCode behaviour).
            setSidebarVisible(false);
            return;
        }
        setActiveView(view);
        setSidebarVisible(true);
    };

    // Path-related actions used by ProjectsView / PanesView / PaneHost.
    const copyPath = async (path: string) => {
        if (!path) return;
        try {
            await navigator.clipboard.writeText(path);
            setToast('Path copied');
        } catch (err) {
            console.error('clipboard write failed', err);
            setToast('Copy failed');
        }
    };
    const revealPath = async (path: string) => {
        if (!path) return;
        try {
            await RevealInExplorer(path);
        } catch (err: any) {
            console.error('reveal failed', err);
            setToast(`Reveal failed: ${err?.message ?? String(err)}`);
        }
    };
    const showReveal = platform === 'windows' || platform === 'darwin' || platform === 'linux';

    // Markdown reader: open file in the right-side reader panel.
    const openInReader = (path: string) => setReaderPath(path);
    const closeReader = () => setReaderPath(null);

    const onReaderResizeStart = (e: React.MouseEvent) => {
        readerResizeRef.current = { startX: e.clientX, startW: readerWidth };
        const onMove = (ev: MouseEvent) => {
            const ref = readerResizeRef.current;
            if (!ref) return;
            const dx = ev.clientX - ref.startX;
            // Reader is on the right; dragging the divider LEFT widens it.
            const next = Math.min(900, Math.max(280, ref.startW - dx));
            setReaderWidth(next);
        };
        const onUp = () => {
            readerResizeRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            // Re-fit panes after size settles.
            paneRefs.current.forEach((h) => h?.fit());
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    // Re-fit panes when reader opens/closes/resizes (workspace area changes).
    useEffect(() => {
        const id = window.setTimeout(() => paneRefs.current.forEach((h) => h?.fit()), 60);
        return () => window.clearTimeout(id);
    }, [readerPath, readerWidth]);

    useEffect(() => {
        LoadDefault()
            .then((snap) => {
                if (snap?.tree && snap.panes && snap.panes.length > 0) {
                    setRestoreDialog(snap);
                } else {
                    setLoaded(true);
                }
            })
            .catch((err: any) => {
                const msg = err?.message ?? String(err);
                if (/\.bak/i.test(msg)) {
                    setBootNotices((prev) => [...prev, `layouts.json was reset (saved as .bak)`]);
                } else {
                    console.error('load layout failed', err);
                }
                setLoaded(true);
            });
    }, []);

    useEffect(() => {
        if (!loaded) return;
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            const paneSpecs: main.PaneSpec[] = [];
            panes.forEach((p) => {
                paneSpecs.push({
                    id: p.paneId,
                    projectId: p.projectId ?? '',
                    title: p.title,
                    command: p.command,
                    args: p.args,
                    cwd: p.cwd,
                } as main.PaneSpec);
            });
            const input: main.LayoutInput = {
                id: 'default',
                name: 'Default',
                tree: serialize(tree) as any,
                panes: paneSpecs,
            } as main.LayoutInput;
            SaveDefault(input).catch((err) => console.error('save layout failed', err));
        }, 500);
        return () => {
            if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        };
    }, [panes, tree, loaded]);

    // Refit all xterms whenever the workspace size changes (window resize, etc.).
    // Observe the always-rendered `.workspace` element so the observer is
    // available even before any pane is launched.
    useEffect(() => {
        const el = workspaceRef.current;
        if (!el) return;
        let raf = 0;
        const refit = () => paneRefs.current.forEach((h) => h?.fit());
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(refit);
        });
        ro.observe(el);
        // Also re-fit on window resize as a belt-and-suspenders fallback.
        const onWinResize = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(refit);
        };
        window.addEventListener('resize', onWinResize);
        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            window.removeEventListener('resize', onWinResize);
        };
    }, []);

    // After tree changes (split/move/close), refit. Panes are NOT remounted, only repositioned.
    useEffect(() => {
        const id = window.setTimeout(() => paneRefs.current.forEach((h) => h?.fit()), 60);
        return () => window.clearTimeout(id);
    }, [tree]);

    // Build a LayoutInput snapshot from the current panes/tree.
    const buildCurrentLayoutInput = (id: string, name: string): main.LayoutInput => {
        const paneSpecs: main.PaneSpec[] = [];
        panes.forEach((p) => {
            paneSpecs.push({
                id: p.paneId,
                projectId: p.projectId ?? '',
                title: p.title,
                command: p.command,
                args: p.args,
                cwd: p.cwd,
            } as main.PaneSpec);
        });
        return {
            id,
            name,
            tree: serialize(tree) as any,
            panes: paneSpecs,
        } as main.LayoutInput;
    };

    // Close every current pane, wait for sessions to terminate.
    const closeAllPanes = async () => {
        const ids = Array.from(panes.keys());
        for (const id of ids) {
            const handle = paneRefs.current.get(id);
            if (handle) {
                try { await handle.stop(); } catch (_) { /* ignore */ }
            }
            paneRefs.current.delete(id);
        }
        setPanes(new Map());
        setTree(null);
        setFocusedPaneId(null);
        setMaximizedPaneId(null);
        setPaneStatus(new Map());
    };

    const applyLayoutSnapshot = async (snap: main.LayoutSnapshot) => {
        const liveCount = Array.from(paneStatus.values()).filter(
            (s) => s === 'running' || s === 'starting' || s === 'idle',
        ).length;
        if (liveCount > 0) {
            if (!confirm(`Switch to layout "${snap.name}"?\nAll currently open panes (${liveCount} active) will be closed.`)) {
                return;
            }
        }
        await closeAllPanes();
        // Re-use the existing restore-from-snapshot path.
        acceptRestore(snap);
    };

    const saveCurrentLayoutAs = async () => {
        if (panes.size === 0) {
            alert('There are no panes to save.');
            return;
        }
        const name = prompt('Save current layout as:');
        if (!name || !name.trim()) return;
        try {
            const input = buildCurrentLayoutInput('', name.trim());
            await SaveNamed(input);
        } catch (err: any) {
            alert(`save failed: ${err?.message ?? String(err)}`);
        }
    };

    const acceptRestore = (snap: main.LayoutSnapshot) => {
        const restored = new Map<string, PaneDef>();
        for (const p of snap.panes ?? []) {
            const def: PaneDef = {
                paneId: p.id,
                title: p.title || `restored ${p.id}`,
                command: p.command || DEFAULT_COMMAND,
                args: p.args && p.args.length > 0 ? p.args : DEFAULT_ARGS,
                cwd: p.cwd || '',
                projectId: p.projectId || undefined,
                workspaceLabel: undefined,
            };
            restored.set(p.id, def);
            const m = /^p(\d+)$/.exec(p.id);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > paneCounter) paneCounter = n;
            }
            if (p.projectId) {
                const tm = /#(\d+)\s*$/.exec(p.title || '');
                if (tm) {
                    const seq = parseInt(tm[1], 10);
                    const cur = projectPaneCounters.get(p.projectId) ?? 0;
                    if (seq > cur) projectPaneCounters.set(p.projectId, seq);
                }
            }
        }
        const restoredTree = deserialize(snap.tree as any);
        const keep = new Set(restored.keys());
        let prunedTree = restoredTree;
        for (const id of leafIds(restoredTree)) {
            if (!keep.has(id)) prunedTree = removeLeaf(prunedTree, id);
        }
        setPanes(restored);
        setTree(prunedTree);
        const remaining = leafIds(prunedTree);
        setFocusedPaneId(remaining[0] ?? null);
        setRestoreDialog(null);
        setLoaded(true);
    };

    const discardRestore = () => {
        setRestoreDialog(null);
        setLoaded(true);
    };

    const effectiveDefaults = () => ({
        command: settings?.defaultCommand || DEFAULT_COMMAND,
        args: settings?.defaultArgs && settings.defaultArgs.length > 0 ? settings.defaultArgs : DEFAULT_ARGS,
    });

    const launchProject = (p: main.Project) => {
        const defaults = effectiveDefaults();
        const seq = nextProjectSeq(p.id);
        const id = nextPaneId();
        const def: PaneDef = {
            paneId: id,
            title: `${p.name} #${seq}`,
            command: p.command || defaults.command,
            args: p.args && p.args.length > 0 ? p.args : defaults.args,
            cwd: p.path,
            projectId: p.id,
            workspaceLabel: p.name,
        };
        setPanes((prev) => {
            const next = new Map(prev);
            next.set(id, def);
            return next;
        });
        setTree((prev) => appendLeaf(prev, id));
        setFocusedPaneId(id);
        MarkUsed(p.id).catch(() => undefined);
    };

    // Actually performs the close (no confirmation). Used by `removePane` after
    // confirmation, and by `closeAllPanes` for batch operations.
    const doRemovePane = async (paneId: string) => {
        const handle = paneRefs.current.get(paneId);
        if (handle) await handle.stop();
        paneRefs.current.delete(paneId);
        setPanes((prev) => {
            const next = new Map(prev);
            next.delete(paneId);
            return next;
        });
        setTree((prev) => removeLeaf(prev, paneId));
        setFocusedPaneId((cur) => (cur === paneId ? null : cur));
        setMaximizedPaneId((cur) => (cur === paneId ? null : cur));
        setPaneStatus((prev) => {
            const next = new Map(prev);
            next.delete(paneId);
            return next;
        });
    };

    const removePane = async (paneId: string) => {
        const status = paneStatus.get(paneId);
        const isLive = status === 'running' || status === 'starting' || status === 'idle';
        if (isLive) {
            const def = panes.get(paneId);
            const label = def ? def.title : paneId;
            setCloseConfirm({ paneId, label });
            return;
        }
        await doRemovePane(paneId);
    };

    const onResize = (path: Path, ratio: number) => {
        setTree((prev) => updateRatioAtPath(prev, path, ratio));
    };
    const onResizeEnd = () => paneRefs.current.forEach((h) => h?.fit());

    const onDropOnPane = (targetPaneId: string, zone: DropZone) => {
        const sourceId = dragSourcePaneId;
        setDragSourcePaneId(null);
        if (!sourceId) return;
        if (sourceId === targetPaneId) return;
        setTree((prev) => moveLeaf(prev, sourceId, targetPaneId, zone));
    };

    const onSplitPane = (paneId: string, dir: 'h' | 'v', anchor: HTMLElement) => {
        setSplitPicker({ paneId, dir, anchor });
    };

    const toggleMaximize = (paneId: string) => {
        setMaximizedPaneId((cur) => (cur === paneId ? null : paneId));
        // Wait two frames so the new CSS is applied + xterm sees the new dimensions.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                paneRefs.current.forEach((h) => h?.fit());
            });
        });
    };

    const handleShortcut = (paneId: string, name: AppShortcut) => {
        switch (name) {
            case 'close':
                void removePane(paneId);
                break;
            case 'split-h':
            case 'split-v': {
                // Use the workspace root as anchor for keyboard-triggered split.
                const anchor = panesRootRef.current ?? document.body;
                setSplitPicker({ paneId, dir: name === 'split-h' ? 'h' : 'v', anchor });
                break;
            }
            case 'max-toggle':
                toggleMaximize(paneId);
                break;
        }
    };

    const confirmSplit = (project: main.Project) => {
        if (!splitPicker) return;
        const defaults = effectiveDefaults();
        const { paneId: sourcePaneId, dir } = splitPicker;
        const seq = nextProjectSeq(project.id);
        const newId = nextPaneId();
        const def: PaneDef = {
            paneId: newId,
            title: `${project.name} #${seq}`,
            command: project.command || defaults.command,
            args: project.args && project.args.length > 0 ? project.args : defaults.args,
            cwd: project.path,
            projectId: project.id,
            workspaceLabel: project.name,
        };
        setPanes((prev) => {
            const next = new Map(prev);
            next.set(newId, def);
            return next;
        });
        setTree((prev) => {
            if (!prev) return { type: 'leaf', paneId: newId };
            const targetPath = findPath(prev, sourcePaneId);
            if (!targetPath) return prev;
            const side: DropZone = dir === 'h' ? 'r' : 'b';
            return insertAdjacent(prev, targetPath, side, { type: 'leaf', paneId: newId });
        });
        setFocusedPaneId(newId);
        MarkUsed(project.id).catch(() => undefined);
        setSplitPicker(null);
    };

    const handleProjectSubmit = async (input: main.ProjectInput) => {
        if (dialog?.mode === 'edit' && dialog.project) {
            await Update(dialog.project.id, input);
        } else {
            await Add(input);
        }
        setDialog(null);
        setRefreshKey((n) => n + 1);
    };

    const onPaneStatusChange = (paneId: string, status: TerminalStatus) => {
        setPaneStatus((prev) => {
            const next = new Map(prev);
            next.set(paneId, status);
            return next;
        });
    };

    const toggleTheme = async () => {
        if (slotRole === 'reader') {
            setToast('Theme can only be changed from the main window.');
            return;
        }
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setThemeState(next);
        try { await SetTheme(next); } catch (err) { console.error('save theme failed', err); }
    };

    const paneIds = leafIds(tree);
    const stats = (() => {
        let running = 0, idle = 0, exited = 0, errored = 0;
        paneStatus.forEach((s) => {
            if (s === 'running' || s === 'starting') running++;
            else if (s === 'idle') idle++;
            else if (s === 'exited') exited++;
            else if (s === 'error') errored++;
        });
        const paneCount = paneIds.length;
        idle += Math.max(0, paneCount - (running + idle + exited + errored));
        return { paneCount, running, idle, exited, errored };
    })();

    const activePanes: ActivePaneItem[] = paneIds.flatMap((id) => {
        const def = panes.get(id);
        if (!def) return [];
        return [{
            paneId: id,
            title: def.title,
            cwd: def.cwd,
            workspaceLabel: def.workspaceLabel,
            status: paneStatus.get(id) ?? 'idle',
        }];
    });

    // Launch a fresh claude session with cwd at an arbitrary folder (used by
    // Explorer's "Launch session here" menu item). Mirrors `launchProject` but
    // builds a synthetic Project so we still get a per-name pane counter.
    const launchInPath = (cwd: string, label: string) => {
        const defaults = effectiveDefaults();
        const fakeId = `path:${cwd}`;
        const seq = nextProjectSeq(fakeId);
        const id = nextPaneId();
        const def: PaneDef = {
            paneId: id,
            title: `${label} #${seq}`,
            command: defaults.command,
            args: defaults.args,
            cwd,
            projectId: undefined,
            workspaceLabel: label,
        };
        setPanes((prev) => {
            const next = new Map(prev);
            next.set(id, def);
            return next;
        });
        setTree((prev) => appendLeaf(prev, id));
        setFocusedPaneId(id);
    };

    // Compute pane boxes + dividers from the tree (fractions 0..1).
    const boxes = useMemo(() => computeBoxes(tree), [tree]);
    const dividers = useMemo(() => computeDividers(tree), [tree]);

    // Render order: stable (insertion order of panes Map). Position comes from `boxes`.
    const orderedPanes: PaneDef[] = [];
    panes.forEach((def) => orderedPanes.push(def));

    return (
        <div className="app-shell">
            <TitleBar
                paneCount={paneIds.length}
                theme={theme}
                sidebarVisible={sidebarVisible}
                slotName={slotName}
                slotRole={slotRole}
                onToggleSidebar={() => setSidebarVisible((v) => !v)}
                onToggleTheme={toggleTheme}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenLayouts={(el) => setLayoutsAnchor(el)}
                onOpenNewWindow={() => setNewWindowOpen(true)}
            />

            {bootNotices.length > 0 && (
                <div className="boot-notices">
                    {bootNotices.map((n, i) => (
                        <div key={i} className="boot-notice">
                            <span>⚠ {n}</span>
                            <button
                                className="boot-notice-close"
                                onClick={() => setBootNotices((prev) => prev.filter((_, j) => j !== i))}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className={`main-row ${sidebarVisible ? '' : 'sidebar-hidden'}`}>
                <ActivityBar
                    activeView={activeView}
                    sidebarVisible={sidebarVisible}
                    paneCount={paneIds.length}
                    onSelect={onSelectActivity}
                />
                {sidebarVisible && (
                    <aside className="side-bar">
                        {activeView === 'workspace' && (
                            <WorkspaceView
                                refreshKey={refreshKey}
                                readOnly={slotRole === 'reader'}
                                onLaunch={launchProject}
                                onAddClick={() => setDialog({ mode: 'add' })}
                                onEditClick={(p) => setDialog({ mode: 'edit', project: p })}
                                onAfterDelete={() => setRefreshKey((n) => n + 1)}
                                activePanes={activePanes}
                                focusedPaneId={focusedPaneId}
                                onFocusPane={(id) => {
                                    setFocusedPaneId(id);
                                    paneRefs.current.get(id)?.fit();
                                }}
                                onClosePane={(id) => void removePane(id)}
                                onCopyPath={copyPath}
                                onRevealPath={showReveal ? revealPath : undefined}
                            />
                        )}
                        {activeView === 'explorer' && (
                            <ExplorerView
                                focusedRoot={(() => {
                                    if (!focusedPaneId) return null;
                                    const def = panes.get(focusedPaneId);
                                    if (!def || !def.cwd) return null;
                                    return {
                                        paneId: focusedPaneId,
                                        cwd: def.cwd,
                                        label: def.workspaceLabel ?? def.title,
                                    };
                                })()}
                                onCopyPath={copyPath}
                                onRevealPath={showReveal ? revealPath : undefined}
                                onLaunchInPath={launchInPath}
                                onOpenFile={openInReader}
                            />
                        )}
                    </aside>
                )}

                <div className={`workspace-row ${readerPath ? 'with-reader' : ''}`}>
                <div ref={workspaceRef} className="workspace">
                    {loaded && paneIds.length === 0 && (
                        <div className="workspace-empty">
                            no panes open<br />
                            <span style={{ color: 'var(--fg-3)' }}>click a project in the sidebar to launch a session</span>
                            <div className="keys">
                                drag a pane header onto another pane to split
                            </div>
                        </div>
                    )}
                    {paneIds.length > 0 && (
                        <div ref={panesRootRef} className="panes-flat">
                            {orderedPanes.map((p) => {
                                const isMax = maximizedPaneId === p.paneId;
                                const isHidden = maximizedPaneId !== null && !isMax;
                                const box = boxes.get(p.paneId);
                                if (!box) return null;
                                const positionStyle: React.CSSProperties = isMax
                                    ? {
                                          left: 0, top: 0, right: 0, bottom: 0,
                                          zIndex: 50,
                                      }
                                    : {
                                          left: `${box.x * 100}%`,
                                          top: `${box.y * 100}%`,
                                          width: `${box.w * 100}%`,
                                          height: `${box.h * 100}%`,
                                          visibility: isHidden ? 'hidden' : undefined,
                                          pointerEvents: isHidden ? 'none' : undefined,
                                      };
                                return (
                                    <div
                                        key={p.paneId}
                                        className="pane-positioner"
                                        style={positionStyle}
                                    >
                                        <PaneHost
                                            ref={(h) => {
                                                if (h) paneRefs.current.set(p.paneId, h);
                                                else paneRefs.current.delete(p.paneId);
                                            }}
                                            paneId={p.paneId}
                                            title={p.title}
                                            cwdLabel={p.cwd}
                                            workspaceLabel={p.workspaceLabel}
                                            command={p.command}
                                            args={p.args}
                                            cwd={p.cwd}
                                            autoStart
                                            fontFamily={settings?.fontFamily || undefined}
                                            fontSize={settings?.fontSize || undefined}
                                            lineHeight={settings?.lineHeight || undefined}
                                            scrollback={settings?.scrollback || undefined}
                                            focused={focusedPaneId === p.paneId}
                                            dragActive={dragSourcePaneId !== null && maximizedPaneId === null}
                                            isDragSource={dragSourcePaneId === p.paneId}
                                            maximized={isMax}
                                            onFocus={() => setFocusedPaneId(p.paneId)}
                                            onClose={() => void removePane(p.paneId)}
                                            onSplit={onSplitPane}
                                            onMaximizeToggle={toggleMaximize}
                                            onDragStartHeader={setDragSourcePaneId}
                                            onDragEndHeader={() => setDragSourcePaneId(null)}
                                            onDropOnPane={onDropOnPane}
                                            onStatusChange={(s) => onPaneStatusChange(p.paneId, s)}
                                            onShortcut={(name) => handleShortcut(p.paneId, name)}
                                            onCopyPath={copyPath}
                                            onRevealPath={showReveal ? revealPath : undefined}
                                        />
                                    </div>
                                );
                            })}
                            {maximizedPaneId === null && dividers.map((d, i) => (
                                <FlatDivider
                                    key={`d-${i}-${d.path.join('')}-${d.dir}`}
                                    spec={d}
                                    workspaceRef={panesRootRef}
                                    onResize={onResize}
                                    onResizeEnd={onResizeEnd}
                                />
                            ))}
                        </div>
                    )}
                </div>
                {readerPath && (
                    <>
                        <div
                            className="reader-divider"
                            onMouseDown={onReaderResizeStart}
                            title="Drag to resize"
                        />
                        <div className="reader-pane" style={{ width: readerWidth }}>
                            <MarkdownReader
                                path={readerPath}
                                onClose={closeReader}
                                onCopyPath={copyPath}
                                onRevealPath={showReveal ? revealPath : undefined}
                            />
                        </div>
                    </>
                )}
                </div>
            </div>

            <StatusBar {...stats} theme={theme} />

            {dialog && (
                <ProjectDialog
                    mode={dialog.mode}
                    initial={dialog.project}
                    onSubmit={handleProjectSubmit}
                    onCancel={() => setDialog(null)}
                />
            )}

            {restoreDialog && (
                <div className="modal-backdrop" onClick={discardRestore}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">restore previous session?</h2>
                        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--fg-1)', fontFamily: "'JetBrains Mono', monospace" }}>
                            found a saved layout with <strong style={{ color: 'var(--fg-0)' }}>{restoreDialog.panes?.length ?? 0}</strong> pane(s).
                        </p>
                        <div className="modal-actions">
                            <button onClick={discardRestore}>start fresh</button>
                            <button className="primary" onClick={() => acceptRestore(restoreDialog)}>
                                restore
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {splitPicker && (
                <ProjectPicker
                    anchor={splitPicker.anchor}
                    onPick={confirmSplit}
                    onClose={() => setSplitPicker(null)}
                    headerLabel={`split ${splitPicker.dir === 'h' ? 'right' : 'down'} — pick a project`}
                />
            )}

            {settingsOpen && settings && (
                <SettingsDialog
                    initial={settings}
                    onSaved={(next) => {
                        setSettings(next);
                        setSettingsOpen(false);
                    }}
                    onCancel={() => setSettingsOpen(false)}
                />
            )}

            {needsConsent && (
                <ConsentDialog
                    onAccept={() => {
                        setNeedsConsent(false);
                        setSettings((s) => s ? { ...s, dangerousConsent: true } : s);
                    }}
                />
            )}

            {newWindowOpen && (
                <NewWindowDialog
                    onClose={() => setNewWindowOpen(false)}
                    onSubmit={async (name) => {
                        setNewWindowOpen(false);
                        try {
                            await OpenNewWindow(name);
                            setToast(`Opening window for slot "${name}"…`);
                        } catch (err: any) {
                            setToast(`Failed to open window: ${err?.message ?? String(err)}`);
                        }
                    }}
                />
            )}

            {layoutsAnchor && (
                <LayoutsMenu
                    anchor={layoutsAnchor}
                    onApply={(snap) => {
                        setLayoutsAnchor(null);
                        void applyLayoutSnapshot(snap);
                    }}
                    onSaveAs={() => {
                        setLayoutsAnchor(null);
                        void saveCurrentLayoutAs();
                    }}
                    onClose={() => setLayoutsAnchor(null)}
                />
            )}

            {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

            {closeConfirm && (
                <div className="modal-backdrop" onClick={() => setCloseConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">close pane?</h2>
                        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--fg-1)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                            close <strong style={{ color: 'var(--fg-0)' }}>{closeConfirm.label}</strong>?<br />
                            the Claude Code session will be terminated.
                        </p>
                        <div className="modal-actions">
                            <button onClick={() => setCloseConfirm(null)}>cancel</button>
                            <button
                                className="primary"
                                onClick={async () => {
                                    const id = closeConfirm.paneId;
                                    setCloseConfirm(null);
                                    await doRemovePane(id);
                                }}
                            >
                                close pane
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
