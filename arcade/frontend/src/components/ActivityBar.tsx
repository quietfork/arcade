import { Icon } from './Icons';

export type SidebarView = 'workspace' | 'explorer';

export interface ActivityBarProps {
    activeView: SidebarView;
    sidebarVisible: boolean;
    paneCount: number;
    onSelect: (view: SidebarView) => void;
}

interface IconDef {
    id: SidebarView;
    label: string;
    title: string;
    icon: React.ReactNode;
    badgeCount?: number;
}

export function ActivityBar({ activeView, sidebarVisible, paneCount, onSelect }: ActivityBarProps) {
    const icons: IconDef[] = [
        {
            id: 'workspace',
            label: 'Workspace',
            title: 'Workspace (projects + active panes)',
            icon: <Icon.Layers />,
            badgeCount: paneCount,
        },
        {
            id: 'explorer',
            label: 'Explorer',
            title: 'Explorer (file tree)',
            icon: <Icon.Folder />,
        },
    ];
    return (
        <div className="activity-bar" role="tablist" aria-label="Sidebar views">
            {icons.map((it) => {
                const isActive = sidebarVisible && activeView === it.id;
                return (
                    <button
                        key={it.id}
                        className={`activity-icon ${isActive ? 'active' : ''}`}
                        title={it.title + (isActive ? ' (click again to hide sidebar)' : '')}
                        aria-selected={isActive}
                        role="tab"
                        onClick={() => onSelect(it.id)}
                    >
                        <span className="activity-rail" />
                        {it.icon}
                        {typeof it.badgeCount === 'number' && it.badgeCount > 0 && (
                            <span className="activity-badge">{it.badgeCount}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
