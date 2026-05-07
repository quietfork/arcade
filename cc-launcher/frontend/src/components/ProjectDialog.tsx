import { useEffect, useState } from 'react';
import { PickDirectory } from '../../wailsjs/go/main/ProjectStore';
import { main } from '../../wailsjs/go/models';

export type ProjectDialogMode = 'add' | 'edit';

export interface ProjectDialogProps {
    mode: ProjectDialogMode;
    initial?: main.Project | null;
    onSubmit: (input: main.ProjectInput) => Promise<void>;
    onCancel: () => void;
}

const DEFAULT_COMMAND = 'claude';
const DEFAULT_ARGS_STR = '--dangerously-skip-permissions';

export function ProjectDialog({ mode, initial, onSubmit, onCancel }: ProjectDialogProps) {
    const [name, setName] = useState(initial?.name ?? '');
    const [path, setPath] = useState(initial?.path ?? '');
    const [command, setCommand] = useState(initial?.command ?? '');
    const [argsStr, setArgsStr] = useState((initial?.args ?? []).join(' '));
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Auto-fill name from folder basename when path is set and name empty
        if (!name && path) {
            const base = path.split(/[\\/]/).filter(Boolean).pop();
            if (base) setName(base);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    const browse = async () => {
        try {
            const picked = await PickDirectory(path || '');
            if (picked) setPath(picked);
        } catch (err: any) {
            setError(`folder picker failed: ${err?.message ?? String(err)}`);
        }
    };

    const submit = async () => {
        setError(null);
        if (!name.trim()) { setError('Name is required'); return; }
        if (!path.trim()) { setError('Path is required'); return; }
        const args = argsStr.trim() ? argsStr.trim().split(/\s+/) : undefined;
        const input: main.ProjectInput = {
            name: name.trim(),
            path: path.trim(),
            command: command.trim() || undefined as any,
            args,
        } as main.ProjectInput;
        setSubmitting(true);
        try {
            await onSubmit(input);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">{mode === 'add' ? 'Add Project' : 'Edit Project'}</h2>

                <label className="form-row">
                    <span className="form-label">Name</span>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Display name"
                        autoFocus
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">Path</span>
                    <div className="form-input-row">
                        <input
                            type="text"
                            value={path}
                            onChange={(e) => setPath(e.target.value)}
                            placeholder="C:\path\to\project"
                            style={{ flex: 1 }}
                        />
                        <button type="button" onClick={browse}>Browse...</button>
                    </div>
                </label>

                <label className="form-row">
                    <span className="form-label">Command</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder={DEFAULT_COMMAND}
                    />
                    <span className="form-hint">Empty = use default ({DEFAULT_COMMAND})</span>
                </label>

                <label className="form-row">
                    <span className="form-label">Args</span>
                    <input
                        type="text"
                        value={argsStr}
                        onChange={(e) => setArgsStr(e.target.value)}
                        placeholder={DEFAULT_ARGS_STR}
                    />
                    <span className="form-hint">Space-separated. Empty = use default.</span>
                </label>

                {error && <div className="form-error">{error}</div>}

                <div className="modal-actions">
                    <button onClick={onCancel} disabled={submitting}>Cancel</button>
                    <button onClick={submit} disabled={submitting} className="primary">
                        {mode === 'add' ? 'Add' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
