import { Icon } from './Icons';
import { WindowMinimise, WindowToggleMaximise, WindowQuit } from '../../wailsjs/go/main/App';

export type SlotRole = 'writer' | 'reader' | '';

export interface TitleBarProps {
    paneCount: number;
    theme: 'dark' | 'light';
    sidebarVisible: boolean;
    slotName: string;
    slotRole: SlotRole;
    onToggleSidebar: () => void;
    onToggleTheme: () => void;
    onOpenSettings: () => void;
    onOpenLayouts: (anchor: HTMLElement) => void;
    onOpenNewWindow: () => void;
}

export function TitleBar({
    paneCount,
    theme,
    sidebarVisible,
    slotName,
    slotRole,
    onToggleSidebar,
    onToggleTheme,
    onOpenSettings,
    onOpenLayouts,
    onOpenNewWindow,
}: TitleBarProps) {
    const isReader = slotRole === 'reader';
    const themeDisabled = isReader;
    const themeTitle = isReader
        ? 'Theme can only be changed from the main window'
        : `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;

    return (
        <div className="titlebar">
            <div className="titlebar-left">
                <button
                    className={`tb-btn ${sidebarVisible ? 'is-active' : ''}`}
                    onClick={onToggleSidebar}
                    title={`${sidebarVisible ? 'Hide' : 'Show'} sidebar (Ctrl+B)`}
                >
                    <Icon.Sidebar />
                </button>
            </div>
            <div className="title-text mono">
                cc-launcher · <b>multiplex</b> · slot:{slotName}
                {slotRole && (
                    <span className={`slot-role role-${slotRole}`} title={
                        slotRole === 'writer'
                            ? 'This window owns shared state (projects, theme).'
                            : 'Read-only window — shared state is owned by the main window.'
                    }>
                        {' · '}{slotRole}
                    </span>
                )} · {paneCount} pane{paneCount === 1 ? '' : 's'}
            </div>
            <div className="titlebar-actions">
                <button
                    className="tb-btn"
                    onClick={onOpenNewWindow}
                    title="Open new window (separate slot)"
                >
                    <Icon.NewWindow />
                </button>
                <button
                    className="tb-btn"
                    onClick={(e) => onOpenLayouts(e.currentTarget)}
                    title="Layouts"
                >
                    layouts
                </button>
                <button className="tb-btn" onClick={onOpenSettings} title="Settings">
                    settings
                </button>
                <button
                    className={`tb-btn ${themeDisabled ? 'is-disabled' : ''}`}
                    onClick={themeDisabled ? undefined : onToggleTheme}
                    title={themeTitle}
                    disabled={themeDisabled}
                >
                    {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
                    {theme}
                </button>
            </div>
            <div className="win-controls">
                <button className="win-btn" onClick={() => WindowMinimise()} title="Minimise">
                    <Icon.Min />
                </button>
                <button className="win-btn" onClick={() => WindowToggleMaximise()} title="Maximise">
                    <Icon.Max />
                </button>
                <button className="win-btn close-btn" onClick={() => WindowQuit()} title="Close">
                    <Icon.X />
                </button>
            </div>
        </div>
    );
}
