import { useEffect, useState, useRef } from 'react';
import logo from '../assets/Kataleya.png';
import { useImportExcelStore } from '../context/open_product';
import { FluentCloudArrowUp32Regular, SvgSpinners180Ring } from '../libs/icons';
import { useAuth } from '../auth/authProvider';
import { syncClient, type SyncStatus } from '../context/sync_client';
import { useAlerts } from './alerts';

function SyncIndicator() {
    const [status, setStatus] = useState<SyncStatus>(() => syncClient.getStatus());
    const [expanded, setExpanded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const { notify, dismiss } = useAlerts();

    useEffect(() => syncClient.subscribe(setStatus), []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setExpanded(false);
            }
        };
        if (expanded) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [expanded]);

    const isBusy = status.running || status.pulling || status.pushing;
    const progressLabel = status.total > 0 ? `${status.progress}/${status.total}` : '';
    const phaseLabel = status.authError
        ? 'Sync déconnecté'
        : !status.online
            ? 'Hors-ligne'
            : status.phase === 'pull'
                ? `Récupération serveur ${progressLabel}`
                : status.phase === 'push'
                    ? `Envoi serveur ${progressLabel}`
                    : status.phase === 'bootstrap'
                        ? `Initialisation ${progressLabel}`
                        : status.phase === 'images'
                            ? 'Images…'
                            : status.pending > 0
                                ? `${status.pending} en attente`
                                : status.lastSyncAt
                                    ? `Sync ${new Date(status.lastSyncAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                                    : 'Prêt';

    if (!status.enabled && !status.authError) return null;

    return (
        <div className="relative ml-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
                onClick={() => setExpanded((v) => !v)}
                title={phaseLabel}
                aria-label={phaseLabel}
                className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
            >
                {status.authError ? (
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                ) : status.phase === 'pull' ? (
                    <SvgSpinners180Ring className="h-3 w-3 text-blue-500" />
                ) : status.phase === 'push' || status.phase === 'bootstrap' ? (
                    <span className="relative inline-flex h-2 w-2">
                        <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                ) : status.phase === 'images' ? (
                    <SvgSpinners180Ring className="h-3 w-3 text-indigo-400" />
                ) : !status.online ? (
                    <span className="h-2 w-2 rounded-full bg-gray-400" />
                ) : status.pending > 0 ? (
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                )}
                <span className="hidden sm:inline">{phaseLabel}</span>
                {isBusy && status.currentOperation && (
                    <span className="max-w-[180px] truncate text-[10px] text-gray-400">
                        {status.currentOperation}
                    </span>
                )}
            </button>

            {expanded && (
                <div
                    ref={panelRef}
                    className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4"
                >
                    <div className="text-xs font-semibold text-slate-800 mb-2">
                        Synchronisation
                    </div>
                    <div className="space-y-2">
                        <StatusRow label="Statut" value={status.online ? 'Connecté' : 'Hors-ligne'} dot={status.online ? 'bg-emerald-500' : 'bg-gray-400'} />
                        {status.lastSyncAt && (
                            <StatusRow
                                label="Dernière sync"
                                value={new Date(status.lastSyncAt).toLocaleString('fr-FR')}
                            />
                        )}
                        {status.pending > 0 && (
                            <StatusRow label="En attente" value={`${status.pending} opération(s)`} dot="bg-amber-400" />
                        )}
                        {isBusy && (
                            <>
                                <StatusRow label="Phase" value={
                                    status.phase === 'pull' ? 'Récupération serveur' :
                                        status.phase === 'push' ? 'Envoi serveur' :
                                            status.phase === 'bootstrap' ? 'Initialisation' :
                                                status.phase === 'images' ? 'Images' : '—'
                                } />
                                {status.currentTable && (
                                    <StatusRow label="Table" value={status.currentTable.replace(/_/g, ' ')} />
                                )}
                                {status.currentOperation && (
                                    <StatusRow label="Opération" value={status.currentOperation} />
                                )}
                                {status.total > 0 && (
                                    <div className="pt-1">
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                            <span>Progression</span>
                                            <span>{status.progress}/{status.total}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                style={{ width: `${Math.min(100, (status.progress / status.total) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {status.authError && (
                            <div className="text-[11px] text-red-600 bg-red-50 rounded-lg p-2 mt-1 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                Token invalide — reconnectez-vous dans Paramètres &gt; Sauvegarde
                            </div>
                        )}
                        {!status.authError && status.lastError && (
                            <div className="text-[11px] text-red-600 bg-red-50 rounded-lg p-2 mt-1">
                                {status.lastError}
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 mt-2">
                            <button
                                onClick={() => { syncClient.requestSync(); setExpanded(false); }}
                                disabled={status.running}
                                className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {status.running ? (
                                    <SvgSpinners180Ring className="h-3.5 w-3.5" />
                                ) : (
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
                                    </svg>
                                )}
                                {status.running ? 'Synchronisation…' : 'Sync now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusRow({ label, value, dot }: { label: string; value: string; dot?: string }) {
    return (
        <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500 flex items-center gap-1.5">
                {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
                {label}
            </span>
            <span className="text-gray-700 font-medium truncate ml-2 max-w-40" title={value}>{value}</span>
        </div>
    );
}

export default function TitleBar() {
    const [maximized, setMaximized] = useState(false);
    const [companyName, setCompanyName] = useState('Kataleya');
    const [companyLogo, setCompanyLogo] = useState<string>('');
    const { set_import } = useImportExcelStore();
    const { user } = useAuth();
    const isMac = window.win.platform === 'darwin';

    useEffect(() => {
        window.win.isMaximized().then(setMaximized);
        const off = window.win.onMaximizedChange(setMaximized);
        return () => off();
    }, []);

    useEffect(() => {
        const load = () => {
            window.db.entreprises?.get().then((info) => {
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

    console.log('user', user);

    return (
        <div
            className="w-full h-9 relative bg-white border-b border-slate-100 flex items-center justify-between select-none z-10000"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className={`flex items-center gap-2 ${isMac ? 'pl-20' : 'pl-3'}`}>
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
            {!isMac && (
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
            )}
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
