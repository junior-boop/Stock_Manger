import { useEffect, useState } from 'react';
import logo from '../assets/Kataleya.png';

export default function TitleBar() {
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        window.win.isMaximized().then(setMaximized);
        const off = window.win.onMaximizedChange(setMaximized);
        return () => off();
    }, []);

    return (
        <div
            className="h-9 w-full relative bg-white border-b border-slate-100 flex items-center justify-between select-none z-10000"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="flex items-center gap-2 px-3">
                <img src={logo} alt="" className="h-5 w-5 object-contain" />
                <span className="text-xs text-gray-500">Kataleya</span>
            </div>
            <div
                className="flex items-stretch h-full"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <CtrlButton onClick={() => window.win.minimize()} label="minimiser">
                    <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
                </CtrlButton>
                <CtrlButton onClick={() => window.win.maximize()} label="agrandir">
                    {maximized ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                            <rect x="0.5" y="2.5" width="7" height="7" />
                            <path d="M2.5 2.5V0.5H9.5V7.5H7.5" />
                        </svg>
                    ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                            <rect x="0.5" y="0.5" width="9" height="9" />
                        </svg>
                    )}
                </CtrlButton>
                <CtrlButton onClick={() => window.win.close()} label="fermer" danger>
                    <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor"><path d="M0 0L10 10M10 0L0 10" /></svg>
                </CtrlButton>
            </div>
        </div>
    );
}

function CtrlButton({
    children,
    onClick,
    label,
    danger,
}: {
    children: React.ReactNode;
    onClick: () => void;
    label: string;
    danger?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={`w-12 h-full flex items-center justify-center text-gray-600 transition-colors ${danger ? 'hover:bg-red-500 hover:text-white' : 'hover:bg-slate-100'
                }`}
        >
            {children}
        </button>
    );
}
