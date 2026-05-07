export interface StatusBarStats {
    paneCount: number;
    running: number;
    idle: number;
    exited: number;
    errored: number;
    theme: 'dark' | 'light';
}

export function StatusBar({ paneCount, running, idle, exited, errored, theme }: StatusBarStats) {
    return (
        <div className="statusbar mono">
            <div className="seg"><span>cc-launcher</span></div>
            <div className="seg"><span>panes</span><b>{paneCount}</b></div>
            <div className="seg"><span>running</span><b>{running}</b></div>
            <div className="seg"><span>idle</span><b>{idle}</b></div>
            <div className="seg"><span>exited</span><b>{exited}</b></div>
            <div className="seg"><span>errors</span><b>{errored}</b></div>
            <div className="sp" />
            <div className="seg"><span>layout</span><b>split</b></div>
            <div className="seg"><span>theme</span><b>{theme}</b></div>
        </div>
    );
}
