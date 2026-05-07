// Tiny stroke-line icons (12x12). Use currentColor so CSS controls hue.

const svgProps = {
    viewBox: '0 0 12 12',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.2,
};

export const Icon = {
    Plus: () => (
        <svg {...svgProps}><path d="M6 2v8M2 6h8" /></svg>
    ),
    X: () => (
        <svg {...svgProps}><path d="M3 3l6 6M9 3l-6 6" /></svg>
    ),
    Min: () => (
        <svg {...svgProps}><path d="M3 6h6" /></svg>
    ),
    Max: () => (
        <svg {...svgProps}><rect x="3" y="3" width="6" height="6" /></svg>
    ),
    SplitH: () => (
        <svg {...svgProps} strokeWidth={1}>
            <rect x="1.5" y="1.5" width="9" height="9" />
            <path d="M6 1.5v9" />
        </svg>
    ),
    SplitV: () => (
        <svg {...svgProps} strokeWidth={1}>
            <rect x="1.5" y="1.5" width="9" height="9" />
            <path d="M1.5 6h9" />
        </svg>
    ),
    Close: () => (
        <svg {...svgProps} strokeWidth={1}>
            <rect x="1.5" y="1.5" width="9" height="9" />
            <path d="M4 4l4 4M8 4l-4 4" />
        </svg>
    ),
    Restart: () => (
        <svg {...svgProps} strokeWidth={1}>
            <path d="M3 6a3 3 0 106-3" />
            <path d="M3 3v3h3" />
        </svg>
    ),
    Sun: () => (
        <svg {...svgProps} strokeWidth={1}>
            <circle cx="6" cy="6" r="2" />
            <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1" />
        </svg>
    ),
    Moon: () => (
        <svg {...svgProps} strokeWidth={1}>
            <path d="M9.5 7A3.5 3.5 0 015 2.5 4 4 0 109.5 7z" />
        </svg>
    ),
    Edit: () => (
        <svg {...svgProps}>
            <path d="M2 10l1-3 5-5 2 2-5 5-3 1z" />
        </svg>
    ),
    Folder: () => (
        <svg {...svgProps}>
            <path d="M1.5 3.5h3l1 1h5v5h-9z" />
        </svg>
    ),
    Layers: () => (
        <svg {...svgProps}>
            <path d="M2 4l4-2 4 2-4 2-4-2zM2 6l4 2 4-2M2 8l4 2 4-2" />
        </svg>
    ),
    ChevronRight: () => (
        <svg {...svgProps}><path d="M4.5 3l3 3-3 3" /></svg>
    ),
    ChevronDown: () => (
        <svg {...svgProps}><path d="M3 4.5l3 3 3-3" /></svg>
    ),
    Copy: () => (
        <svg {...svgProps}>
            <rect x="2" y="2" width="6" height="6" />
            <path d="M4 8v2h6V4H8" />
        </svg>
    ),
    Reveal: () => (
        <svg {...svgProps}>
            <path d="M1.5 3.5h3l1 1h5v5h-9z" />
            <path d="M5 6.5l1 1 2-2" />
        </svg>
    ),
    Sidebar: () => (
        <svg {...svgProps}>
            <rect x="1.5" y="2" width="9" height="8" />
            <path d="M4.5 2v8" />
        </svg>
    ),
    Focus: () => (
        <svg {...svgProps}>
            <circle cx="6" cy="6" r="2" />
            <path d="M1.5 6h1.5M9 6h1.5M6 1.5V3M6 9v1.5" />
        </svg>
    ),
};
