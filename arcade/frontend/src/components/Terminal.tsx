import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { StartSession, Write, Resize, Close } from '../../wailsjs/go/main/PtyManager';
import { SaveImage } from '../../wailsjs/go/main/ClipboardService';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

export type TerminalStatus = 'idle' | 'starting' | 'running' | 'exited' | 'error';

export type AppShortcut = 'close' | 'split-h' | 'split-v' | 'max-toggle';

export interface TerminalProps {
    command: string;
    args: string[];
    cwd: string;
    autoStart?: boolean;
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    scrollback?: number;
    onStatusChange?: (status: TerminalStatus, msg: string) => void;
    onShortcut?: (name: AppShortcut) => void;
}

const DEFAULT_FONT_FAMILY = 'JetBrains Mono, Cascadia Mono, Consolas, monospace';
const DEFAULT_FONT_SIZE = 13;
const DEFAULT_LINE_HEIGHT = 1.2;
const DEFAULT_SCROLLBACK = 10000;

export interface TerminalHandle {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    fit: () => void;
    isRunning: () => boolean;
}

const PASTE_DEDUPE_MS = 700;
const IDLE_THRESHOLD_MS = 3000;
const IDLE_POLL_MS = 1000;

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
    { command, args, cwd, autoStart, fontFamily, fontSize, lineHeight, scrollback, onStatusChange, onShortcut },
    ref,
) {
    const onShortcutRef = useRef(onShortcut);
    onShortcutRef.current = onShortcut;
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerm | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const statusRef = useRef<TerminalStatus>('idle');
    const lastDataAtRef = useRef<number>(0);
    const idleTimerRef = useRef<number | null>(null);
    const lastSizeRef = useRef<{ cols: number; rows: number } | null>(null);
    const resizeTimerRef = useRef<number | null>(null);
    const [, setTick] = useState(0);

    const setStatus = (status: TerminalStatus, msg: string) => {
        statusRef.current = status;
        onStatusChange?.(status, msg);
        setTick((n) => n + 1);
    };

    const startIdleTimer = () => {
        if (idleTimerRef.current !== null) return;
        idleTimerRef.current = window.setInterval(() => {
            if (statusRef.current !== 'running' && statusRef.current !== 'idle') return;
            if (!sessionIdRef.current) return;
            const since = Date.now() - lastDataAtRef.current;
            if (since >= IDLE_THRESHOLD_MS && statusRef.current !== 'idle') {
                setStatus('idle', 'idle');
            }
        }, IDLE_POLL_MS);
    };

    const stopIdleTimer = () => {
        if (idleTimerRef.current !== null) {
            window.clearInterval(idleTimerRef.current);
            idleTimerRef.current = null;
        }
    };

    const fit = () => {
        try {
            fitRef.current?.fit();
            const term = termRef.current;
            const id = sessionIdRef.current;
            if (!term || !id) return;
            const cols = term.cols;
            const rows = term.rows;
            const last = lastSizeRef.current;
            // No-op if dimensions haven't actually changed.
            if (last && last.cols === cols && last.rows === rows) return;

            // Debounce the actual SIGWINCH so a continuous window-resize drag
            // only triggers a redraw in claude after the user pauses, instead
            // of many overlapping ones that pile up artifacts in the scrollback.
            if (resizeTimerRef.current !== null) window.clearTimeout(resizeTimerRef.current);
            resizeTimerRef.current = window.setTimeout(() => {
                resizeTimerRef.current = null;
                const t = termRef.current;
                const sid = sessionIdRef.current;
                if (!t || !sid) return;
                const c = t.cols;
                const r = t.rows;
                const cur = lastSizeRef.current;
                if (cur && cur.cols === c && cur.rows === r) return;
                lastSizeRef.current = { cols: c, rows: r };
                Resize(sid, c, r);
            }, 100);
        } catch (_) {
            /* container may not be laid out yet */
        }
    };

    const stop = async () => {
        const id = sessionIdRef.current;
        if (id) {
            EventsOff(`pty:data:${id}`);
            EventsOff(`pty:exit:${id}`);
            try { await Close(id); } catch (_) { /* ignore */ }
        }
        sessionIdRef.current = null;
        lastSizeRef.current = null;
        if (resizeTimerRef.current !== null) {
            window.clearTimeout(resizeTimerRef.current);
            resizeTimerRef.current = null;
        }
        stopIdleTimer();
        setStatus('idle', 'idle');
    };

    const start = async () => {
        const term = termRef.current;
        const fitAddon = fitRef.current;
        if (!term || !fitAddon) return;
        if (sessionIdRef.current) return;

        setStatus('starting', 'starting...');
        try {
            fitAddon.fit();
            const id = await StartSession(command, args, cwd, term.cols, term.rows);
            // StrictMode (or any unmount-during-init) can dispose the term we
            // started for. If the live term is no longer the one we captured,
            // orphan-close this PTY and bail without setting sessionIdRef —
            // otherwise the new term would refuse to start due to the
            // sessionIdRef guard above and lose input.
            if (term !== termRef.current) {
                try { await Close(id); } catch (_) { /* ignore */ }
                return;
            }
            sessionIdRef.current = id;
            lastDataAtRef.current = Date.now();
            lastSizeRef.current = { cols: term.cols, rows: term.rows };
            setStatus('running', `session ${id}`);
            startIdleTimer();

            EventsOn(`pty:data:${id}`, (chunk: string) => {
                term.write(chunk);
                lastDataAtRef.current = Date.now();
                if (statusRef.current === 'idle') {
                    setStatus('running', `session ${id}`);
                }
            });
            EventsOn(`pty:exit:${id}`, (msg: string) => {
                term.write(`\r\n\x1b[33m[session exited: ${msg}]\x1b[0m\r\n`);
                stopIdleTimer();
                setStatus('exited', `exited: ${msg}`);
                sessionIdRef.current = null;
            });
        } catch (err: any) {
            if (term !== termRef.current) return;
            const msg = err?.message ?? String(err);
            setStatus('error', `failed: ${msg}`);
            try {
                term.write(`\r\n\x1b[31m[error] failed to start session\x1b[0m\r\n`);
                term.write(`\x1b[31m${msg}\x1b[0m\r\n`);
                term.write(`\x1b[2mclick the restart button (▶) on the pane header to retry.\x1b[0m\r\n`);
            } catch (_) { /* ignore */ }
        }
    };

    useImperativeHandle(ref, () => ({
        start,
        stop,
        fit,
        isRunning: () => sessionIdRef.current !== null,
    }));

    // Live-apply font / scrollback changes to the running xterm.
    useEffect(() => {
        const term = termRef.current;
        if (!term) return;
        try {
            term.options.fontFamily = fontFamily || DEFAULT_FONT_FAMILY;
            term.options.fontSize = fontSize || DEFAULT_FONT_SIZE;
            term.options.lineHeight = lineHeight || DEFAULT_LINE_HEIGHT;
            term.options.scrollback = scrollback || DEFAULT_SCROLLBACK;
            // Re-fit after font metrics change.
            fit();
        } catch (err) {
            console.error('apply font settings failed', err);
        }
    }, [fontFamily, fontSize, lineHeight, scrollback]);

    useEffect(() => {
        const containerEl = containerRef.current;
        if (!containerEl) return;

        const term = new XTerm({
            fontFamily: fontFamily || DEFAULT_FONT_FAMILY,
            fontSize: fontSize || DEFAULT_FONT_SIZE,
            lineHeight: lineHeight || DEFAULT_LINE_HEIGHT,
            scrollback: scrollback || DEFAULT_SCROLLBACK,
            cursorBlink: true,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerEl);
        fitAddon.fit();

        termRef.current = term;
        fitRef.current = fitAddon;

        // Observe THIS terminal's container for size changes — works regardless
        // of why the size changed (window resize, divider drag, maximise, ...).
        let raf = 0;
        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => fit());
        });
        ro.observe(containerEl);

        // Focus the xterm input when the user clicks anywhere on the host.
        const onClick = () => term.focus();
        containerEl.addEventListener('click', onClick);

        term.onData((data) => {
            const id = sessionIdRef.current;
            if (id) Write(id, data);
        });

        // Paste handling: Ctrl+V via attachCustomKeyEventHandler + native paste
        // event for right-click. Both can fire on Windows; dedupe by timestamp.
        let lastPasteAt = 0;
        const markPaste = () => { lastPasteAt = Date.now(); };
        const recentlyPasted = () => Date.now() - lastPasteAt < PASTE_DEDUPE_MS;

        const blobToBase64 = async (blob: Blob): Promise<string> => {
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin);
        };

        const writeImageBlob = async (blob: Blob, mime: string) => {
            const id = sessionIdRef.current;
            if (!id) return;
            const b64 = await blobToBase64(blob);
            const ext = (mime.split('/')[1] || 'png').toLowerCase();
            const path = await SaveImage(b64, ext);
            Write(id, path);
        };

        const onPaste = async (e: ClipboardEvent) => {
            if (recentlyPasted()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const cd = e.clipboardData;
            if (!cd) return;
            for (const item of Array.from(cd.items)) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation();
                    const blob = item.getAsFile();
                    if (!blob) return;
                    try {
                        markPaste();
                        await writeImageBlob(blob, item.type);
                    } catch (err) {
                        console.error('paste image failed', err);
                    }
                    return;
                }
            }
        };
        containerEl.addEventListener('paste', onPaste, true);

        const manualPaste = async () => {
            const id = sessionIdRef.current;
            if (!id) return;
            if (recentlyPasted()) return;
            markPaste();
            try {
                if (navigator.clipboard && (navigator.clipboard as any).read) {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        const imgType = item.types.find((t) => t.startsWith('image/'));
                        if (imgType) {
                            const blob = await item.getType(imgType);
                            await writeImageBlob(blob, imgType);
                            return;
                        }
                    }
                }
                const text = await navigator.clipboard.readText();
                if (text) Write(id, text);
            } catch (err) {
                console.error('manual paste failed', err);
            }
        };

        term.attachCustomKeyEventHandler((event) => {
            if (event.type !== 'keydown') return true;
            const key = event.key.toLowerCase();
            const ctrl = event.ctrlKey || event.metaKey;
            // Ctrl+V — paste (image or text) via async clipboard API.
            if (ctrl && !event.shiftKey && !event.altKey && key === 'v') {
                manualPaste();
                return false;
            }
            // Ctrl+Shift+C — copy current selection (FR-308).
            if (ctrl && event.shiftKey && key === 'c') {
                const sel = term.getSelection();
                if (sel) {
                    navigator.clipboard.writeText(sel).catch((err) => console.error('copy failed', err));
                }
                return false;
            }
            // App-level shortcuts (FR-503). Ctrl+Shift+* to avoid colliding with claude.
            if (ctrl && event.shiftKey && !event.altKey) {
                const shortcuts: Record<string, AppShortcut> = {
                    w: 'close',
                    e: 'split-h',
                    o: 'split-v',
                    m: 'max-toggle',
                };
                const action = shortcuts[key];
                if (action) {
                    onShortcutRef.current?.(action);
                    return false;
                }
            }
            return true;
        });

        if (autoStart) {
            void start();
        }

        return () => {
            containerEl.removeEventListener('paste', onPaste, true);
            containerEl.removeEventListener('click', onClick);
            cancelAnimationFrame(raf);
            ro.disconnect();
            stopIdleTimer();
            if (resizeTimerRef.current !== null) {
                window.clearTimeout(resizeTimerRef.current);
                resizeTimerRef.current = null;
            }
            const id = sessionIdRef.current;
            if (id) {
                EventsOff(`pty:data:${id}`);
                EventsOff(`pty:exit:${id}`);
                Close(id);
            }
            term.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={containerRef} className="terminal-host" />;
});
