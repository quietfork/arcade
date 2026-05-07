import { Icon } from './Icons';
import { WindowMinimise, WindowToggleMaximise, WindowQuit } from '../../wailsjs/go/main/App';

export interface TitleBarProps {
    paneCount: number;
    theme: 'dark' | 'light';
    sidebarVisible: boolean;
    onToggleSidebar: () => void;
    onToggleTheme: () => void;
    onOpenSettings: () => void;
    onOpenLayouts: (anchor: HTMLElement) => void;
}

export function TitleBar({
    paneCount,
    theme,
    sidebarVisible,
    onToggleSidebar,
    onToggleTheme,
    onOpenSettings,
    onOpenLayouts,
}: TitleBarProps) {
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
                cc-launcher · <b>multiplex</b> · {paneCount} pane{paneCount === 1 ? '' : 's'}
            </div>
            <div className="titlebar-actions">
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
                    className="tb-btn"
                    onClick={onToggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
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
