import { TerminalStatus } from './Terminal';

const STATUS_LABEL: Record<TerminalStatus, string> = {
    idle: 'idle',
    starting: 'starting',
    running: 'running',
    exited: 'exited',
    error: 'error',
};

export function Badge({ status, children }: { status: TerminalStatus; children?: React.ReactNode }) {
    return (
        <span className={`badge ${status}`}>
            <span className="b-dot" />
            {children ?? STATUS_LABEL[status]}
        </span>
    );
}
