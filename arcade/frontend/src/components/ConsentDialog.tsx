import { SetConsent } from '../../wailsjs/go/main/SettingsStore';
import { WindowQuit } from '../../wailsjs/go/main/App';

export interface ConsentDialogProps {
    onAccept: () => void;
}

export function ConsentDialog({ onAccept }: ConsentDialogProps) {
    const accept = async () => {
        try { await SetConsent(true); } catch (err) { console.error('save consent failed', err); }
        onAccept();
    };
    const decline = () => {
        WindowQuit();
    };

    return (
        <div className="modal-backdrop">
            <div className="modal" style={{ minWidth: 520 }}>
                <h2 className="modal-title">first-run notice</h2>
                <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--fg-1)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                    Arcade launches Claude Code with{' '}
                    <strong style={{ color: 'var(--fg-0)' }}>--dangerously-skip-permissions</strong>{' '}
                    by default.
                </p>
                <p style={{ margin: '0 0 12px 0', fontSize: 12, color: 'var(--fg-1)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                    this bypasses Claude Code's per-tool confirmation prompts. only the directories you register as projects in this app will be launched with that flag.
                </p>
                <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--fg-2)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                    you can change the default args in <strong style={{ color: 'var(--fg-1)' }}>settings</strong> later, or override per project.
                </p>

                <div className="modal-actions">
                    <button onClick={decline}>quit</button>
                    <button className="primary" onClick={() => void accept()}>
                        i understand, continue
                    </button>
                </div>
            </div>
        </div>
    );
}
