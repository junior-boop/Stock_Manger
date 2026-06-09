import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';

type ConfirmOptions = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
};

type ToastKind = 'success' | 'info' | 'error' | 'warning';

type ToastOptions = { persistent?: boolean; key?: string; link?: string; linkLabel?: string };

type Toast = {
    id: number;
    kind: ToastKind;
    title: string;
    message?: string;
    persistent?: boolean;
    key?: string;
    link?: string;
    linkLabel?: string;
};

type AlertContextValue = {
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
    notify: (title: string, message?: string, opts?: ToastOptions) => void;
    success: (title: string, message?: string, opts?: ToastOptions) => void;
    error: (title: string, message?: string, opts?: ToastOptions) => void;
    warn: (title: string, message?: string, opts?: ToastOptions) => void;
    dismiss: (key: string) => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function useAlerts() {
    const ctx = useContext(AlertContext);
    if (!ctx) throw new Error('useAlerts must be used within <AlertsProvider>');
    return ctx;
}

type ConfirmState = ConfirmOptions & { resolve: (v: boolean) => void };

export function AlertsProvider({ children }: { children: ReactNode }) {
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);

    const push = useCallback((kind: ToastKind, title: string, message?: string, opts?: ToastOptions) => {
        const id = ++idRef.current;
        const toast: Toast = {
            id,
            kind,
            title,
            ...(message !== undefined ? { message } : {}),
            ...(opts?.persistent ? { persistent: true } : {}),
            ...(opts?.key ? { key: opts.key } : {}),
            ...(opts?.link ? { link: opts.link } : {}),
            ...(opts?.linkLabel ? { linkLabel: opts.linkLabel } : {}),
        };
        setToasts((t) => {
            if (toast.key && t.some((x) => x.key === toast.key)) {
                return t.map((x) => (x.key === toast.key ? toast : x));
            }
            return [...t, toast];
        });
        if (!opts?.persistent) {
            setTimeout(() => {
                setToasts((t) => t.filter((x) => x.id !== id));
            }, kind === 'error' ? 6000 : 3500);
        }
    }, []);

    const dismiss = useCallback((key: string) => {
        setToasts((t) => t.filter((x) => x.key !== key));
    }, []);

    const value = useMemo<AlertContextValue>(() => ({
        confirm: (opts) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
        notify: (title, message, opts) => push('info', title, message, opts),
        success: (title, message, opts) => push('success', title, message, opts),
        error: (title, message, opts) => push('error', title, message, opts),
        warn: (title, message, opts) => push('warning', title, message, opts),
        dismiss,
    }), [push, dismiss]);

    const closeConfirm = (result: boolean) => {
        if (!confirmState) return;
        confirmState.resolve(result);
        setConfirmState(null);
    };

    useEffect(() => {
        if (!confirmState) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeConfirm(false);
            if (e.key === 'Enter') closeConfirm(true);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [confirmState]);

    return (
        <AlertContext.Provider value={value}>
            {children}
            {confirmState && (
                <ConfirmModal state={confirmState} onClose={closeConfirm} />
            )}
            <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
        </AlertContext.Provider>
    );
}

function ConfirmModal({ state, onClose }: { state: ConfirmState; onClose: (v: boolean) => void }) {
    const danger = state.danger ?? true;
    return (
        <div
            className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
            onClick={() => onClose(false)}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
            >
                <div className="p-6 flex gap-4">
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 9v4" /><path d="M12 17h.01" />
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">{state.title}</h3>
                        {state.message && (
                            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{state.message}</p>
                        )}
                    </div>
                </div>
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => onClose(false)}
                        className="h-9 px-4 rounded-full text-sm text-slate-700 hover:bg-slate-200"
                    >
                        {state.cancelLabel ?? 'Annuler'}
                    </button>
                    <button
                        type="button"
                        autoFocus
                        onClick={() => onClose(true)}
                        className={`h-9 px-5 rounded-full text-sm text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                    >
                        {state.confirmLabel ?? 'Confirmer'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 items-end pointer-events-none">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const styles = {
        success: { bar: 'bg-emerald-500', icon: 'text-emerald-600 bg-emerald-50' },
        info: { bar: 'bg-slate-500', icon: 'text-slate-600 bg-slate-100' },
        error: { bar: 'bg-red-500', icon: 'text-red-600 bg-red-50' },
        warning: { bar: 'bg-amber-500', icon: 'text-amber-600 bg-amber-50' },
    }[toast.kind];

    const goToLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!toast.link) return;
        const target = toast.link.startsWith('#') ? toast.link : `#${toast.link.startsWith('/') ? '' : '/'}${toast.link}`;
        window.location.hash = target;
        onDismiss();
    };

    return (
        <div
            onClick={() => setExpanded((v) => !v)}
            className="pointer-events-auto w-120 bg-gray-800 rounded-lg shadow-lg border border-slate-200 overflow-hidden animate-[slideIn_.2s_ease-out] cursor-pointer"
        >
            <div className="flex">
                <div className={`w-1 ${styles.bar}`} />
                <div className="flex-1 p-3 flex gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${styles.icon}`}>
                        {toast.kind === 'success' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        )}
                        {toast.kind === 'info' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                        )}
                        {toast.kind === 'error' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
                        )}
                        {toast.kind === 'warning' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium text-slate-50 ${expanded ? 'whitespace-pre-line wrap-break-word' : 'truncate'}`}>{toast.title}</div>
                        {toast.message && (
                            <div className={`text-xs text-slate-400 mt-0.5 ${expanded ? 'whitespace-pre-line wrap-break-word' : 'line-clamp-2'}`}>{toast.message}</div>
                        )}
                        {expanded && toast.link && (
                            <button
                                onClick={goToLink}
                                className="mt-2 inline-flex items-center gap-1 h-7 px-3 rounded-full bg-white/10 hover:bg-white/20 text-slate-50 text-xs"
                            >
                                {toast.linkLabel ?? 'Ouvrir'}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                        className="shrink-0 text-slate-400 hover:text-slate-600 text-lg leading-none"
                        aria-label="Fermer"
                    >
                        ×
                    </button>
                </div>
            </div>
        </div>
    );
}
