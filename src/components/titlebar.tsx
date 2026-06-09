import { useEffect, useState } from 'react';
import logo from '../assets/Kataleya.png';
import { useImportExcelStore } from '../context/open_product';
import { FluentCloudArrowUp32Regular, SvgSpinners180Ring } from '../libs/icons';
import { useAuth } from '../auth/authProvider';
import { syncClient, type SyncStatus } from '../context/sync_client';
import { useAlerts } from './alerts';

const PULL_TOAST_KEY = 'sync:pulling';

function SyncIndicator() {
    const [status, setStatus] = useState<SyncStatus>(() => syncClient.getStatus());
    const { notify, dismiss } = useAlerts();

    useEffect(() => syncClient.subscribe(setStatus), []);

    useEffect(() => {
        if (status.pulling) {
            notify('Synchronisation depuis le serveur…', undefined, {
                persistent: true,
                key: PULL_TOAST_KEY,
            });
        } else {
            dismiss(PULL_TOAST_KEY);
        }
    }, [status.pulling, notify, dismiss]);

    if (!status.enabled) return null;

    const title = !status.online
        ? `Hors-ligne — ${status.pending} opération(s) en attente`
        : status.pulling
            ? 'Synchronisation depuis le serveur…'
            : status.pushing
                ? `Envoi en cours (${status.pending})`
                : status.pending > 0
                    ? `${status.pending} opération(s) en attente`
                    : status.lastSyncAt
                        ? `Synchronisé · ${new Date(status.lastSyncAt).toLocaleTimeString()}`
                        : 'Synchronisé';

    return (
        <span
            title={title}
            aria-label={title}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="ml-2 inline-flex items-center gap-1 text-[11px] text-gray-500"
        >
            {status.pulling ? (
                <SvgSpinners180Ring className="h-3.5 w-3.5 text-blue-500" />
            ) : status.pushing ? (
                <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
            ) : !status.online ? (
                <span className="h-2 w-2 rounded-full bg-gray-400" />
            ) : status.pending > 0 ? (
                <span className="h-2 w-2 rounded-full bg-amber-400" />
            ) : (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
            )}
        </span>
    );
}

export default function TitleBar() {
    const [maximized, setMaximized] = useState(false);
    const [companyName, setCompanyName] = useState('Kataleya');
    const [companyLogo, setCompanyLogo] = useState<string>('');
    const { set_import } = useImportExcelStore();
    const { user } = useAuth();

    useEffect(() => {
        window.win.isMaximized().then(setMaximized);
        const off = window.win.onMaximizedChange(setMaximized);
        return () => off();
    }, []);

    useEffect(() => {
        const load = () => {
            window.companyApi?.get().then((info) => {
                if (info.nom) setCompanyName(info.nom);
                setCompanyLogo(info.logoDataUrl || '');
                document.title = info.nom || 'Kataleya';
            }).catch(() => undefined);
        };
        load();
        const onChange = () => load();
        window.addEventListener('company:changed', onChange);
        return () => window.removeEventListener('company:changed', onChange);
    }, []);

    return (
        <div
            className="h-9 w-full relative bg-white border-b border-slate-100 flex items-center justify-between select-none z-10000"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="flex items-center gap-2 px-3">
                <img src={companyLogo || logo} alt="" className="h-5 w-5 object-contain" />
                <span className="text-xs text-gray-500">{companyName}</span>
                {user && (
                    <button
                        onClick={set_import}
                        title="Importer depuis Excel"
                        aria-label="Importer depuis Excel"
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        className="ml-2 h-7 px-2 flex items-center gap-1 rounded-md text-xs text-gray-600 hover:bg-slate-100"
                    >
                        <FluentCloudArrowUp32Regular className="h-4 w-4" />
                        <span>Import Excel</span>
                    </button>
                )}
                {user && <SyncIndicator />}
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
