import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReadFile } from '../../wailsjs/go/main/FileBrowser';
import { Icon } from './Icons';

export interface MarkdownReaderProps {
    path: string;
    onClose: () => void;
    onCopyPath: (path: string) => void;
    onRevealPath?: (path: string) => void;
}

function basename(path: string): string {
    const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return idx >= 0 ? path.slice(idx + 1) : path;
}

export function MarkdownReader({ path, onClose, onCopyPath, onRevealPath }: MarkdownReaderProps) {
    const [content, setContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setContent(null);
        ReadFile(path)
            .then((c) => { if (!cancelled) { setContent(c); setLoading(false); } })
            .catch((err: any) => {
                if (cancelled) return;
                setError(err?.message ?? String(err));
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [path]);

    return (
        <div className="md-reader">
            <header className="md-reader-head">
                <div className="md-reader-title" title={path}>
                    <span className="md-reader-name">{basename(path)}</span>
                    <span className="md-reader-path">{path}</span>
                </div>
                <div className="md-reader-actions">
                    <button
                        className="pane-btn"
                        title="Copy path"
                        onClick={() => onCopyPath(path)}
                    >
                        <Icon.Copy />
                    </button>
                    {onRevealPath && (
                        <button
                            className="pane-btn"
                            title="Reveal in Explorer"
                            onClick={() => onRevealPath(path)}
                        >
                            <Icon.Reveal />
                        </button>
                    )}
                    <button
                        className="pane-btn danger"
                        title="Close reader"
                        onClick={onClose}
                    >
                        <Icon.X />
                    </button>
                </div>
            </header>
            <div className="md-reader-body">
                {loading && <div className="md-reader-loading">loading…</div>}
                {error && <div className="md-reader-error">{error}</div>}
                {content !== null && !loading && !error && (
                    <div className="md-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}
