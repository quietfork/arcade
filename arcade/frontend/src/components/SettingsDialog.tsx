import { useState } from 'react';
import { main } from '../../wailsjs/go/models';
import { Save as SaveSettings } from '../../wailsjs/go/main/SettingsStore';

export interface SettingsDialogProps {
    initial: main.Settings;
    onSaved: (next: main.Settings) => void;
    onCancel: () => void;
}

export function SettingsDialog({ initial, onSaved, onCancel }: SettingsDialogProps) {
    const [fontFamily, setFontFamily] = useState(initial.fontFamily ?? '');
    const [fontSize, setFontSize] = useState<string>(String(initial.fontSize || 13));
    const [lineHeight, setLineHeight] = useState<string>(String(initial.lineHeight || 1.2));
    const [defaultCommand, setDefaultCommand] = useState(initial.defaultCommand ?? 'claude');
    const [defaultArgsStr, setDefaultArgsStr] = useState((initial.defaultArgs ?? []).join(' '));
    const [scrollback, setScrollback] = useState<string>(String(initial.scrollback || 10000));
    const [proxyURL, setProxyURL] = useState(initial.proxyURL ?? '');
    const [noProxy, setNoProxy] = useState(initial.noProxy ?? '');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        setError(null);
        const sizeN = parseInt(fontSize, 10);
        const lhN = parseFloat(lineHeight);
        const sbN = parseInt(scrollback, 10);
        if (!Number.isFinite(sizeN) || sizeN < 8 || sizeN > 48) { setError('Font size must be 8–48'); return; }
        if (!Number.isFinite(lhN) || lhN < 0.8 || lhN > 3) { setError('Line height must be 0.8–3'); return; }
        if (!Number.isFinite(sbN) || sbN < 100 || sbN > 100000) { setError('Scrollback must be 100–100000'); return; }
        if (!defaultCommand.trim()) { setError('Default command is required'); return; }
        const proxyTrim = proxyURL.trim();
        if (proxyTrim && !/^https?:\/\//i.test(proxyTrim)) {
            setError('Proxy URL must start with http:// or https://');
            return;
        }

        // Spread `initial` first so slot-level state (sidebarHidden,
        // activeView) and untouched user-level fields (theme,
        // dangerousConsent) round-trip through Save unchanged.
        const next: main.Settings = {
            ...initial,
            fontFamily: fontFamily.trim(),
            fontSize: sizeN,
            lineHeight: lhN,
            defaultCommand: defaultCommand.trim(),
            defaultArgs: defaultArgsStr.trim() ? defaultArgsStr.trim().split(/\s+/) : [],
            scrollback: sbN,
            proxyURL: proxyTrim,
            noProxy: noProxy.trim(),
        };

        setSubmitting(true);
        try {
            await SaveSettings(next);
            onSaved(next);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">settings</h2>

                <label className="form-row">
                    <span className="form-label">terminal font family</span>
                    <input
                        type="text"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        placeholder="JetBrains Mono, Consolas, monospace"
                    />
                    <span className="form-hint">Empty = default</span>
                </label>

                <label className="form-row">
                    <span className="form-label">font size (px)</span>
                    <input
                        type="text"
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value)}
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">line height</span>
                    <input
                        type="text"
                        value={lineHeight}
                        onChange={(e) => setLineHeight(e.target.value)}
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">scrollback (lines)</span>
                    <input
                        type="text"
                        value={scrollback}
                        onChange={(e) => setScrollback(e.target.value)}
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">default command</span>
                    <input
                        type="text"
                        value={defaultCommand}
                        onChange={(e) => setDefaultCommand(e.target.value)}
                    />
                </label>

                <label className="form-row">
                    <span className="form-label">default args</span>
                    <input
                        type="text"
                        value={defaultArgsStr}
                        onChange={(e) => setDefaultArgsStr(e.target.value)}
                        placeholder="--dangerously-skip-permissions"
                    />
                    <span className="form-hint">Space-separated</span>
                </label>

                <label className="form-row">
                    <span className="form-label">HTTP(S) proxy</span>
                    <input
                        type="text"
                        value={proxyURL}
                        onChange={(e) => setProxyURL(e.target.value)}
                        placeholder="http://proxy.example.com:8080"
                    />
                    <span className="form-hint">Applies to new sessions. Empty = no proxy.</span>
                </label>

                <label className="form-row">
                    <span className="form-label">no-proxy bypass</span>
                    <input
                        type="text"
                        value={noProxy}
                        onChange={(e) => setNoProxy(e.target.value)}
                        placeholder="localhost,127.0.0.1,*.internal"
                    />
                    <span className="form-hint">Comma-separated hosts/patterns</span>
                </label>

                {error && <div className="form-error">{error}</div>}

                <div className="modal-actions">
                    <button onClick={onCancel} disabled={submitting}>cancel</button>
                    <button onClick={submit} disabled={submitting} className="primary">
                        save
                    </button>
                </div>
            </div>
        </div>
    );
}
