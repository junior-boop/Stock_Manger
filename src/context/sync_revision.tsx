// SyncRevisionProvider — incrémente un compteur global à chaque fois que la
// sync applique une mutation distante (pull) ou réécrit la copie locale après
// un arbitrage LWW (push → applied:"server").
//
// Usage dans une page :
//   const rev = useSyncRevision();
//   useEffect(() => { db.clients.getAll().then(setClients); }, [rev]);
//
// Le compteur change ⇒ React relance le useEffect ⇒ le fetch SQLite local
// (<5 ms) renvoie l'état frais ⇒ setState met à jour le composant. Aucun
// rechargement de page, aucune perte d'état (scroll, modals, inputs).

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const SyncRevisionContext = createContext<number>(0);

export function SyncRevisionProvider({ children }: { children: ReactNode }) {
    const [revision, setRevision] = useState(0);
    // Coalesce les bursts (un pull peut appliquer 50 entrées en rafale →
    // on ne veut qu'un seul re-render, pas 50).
    const pendingRef = useRef<number | null>(null);

    useEffect(() => {
        if (!window.syncApi?.onRemoteChange) return;
        const dispose = window.syncApi.onRemoteChange(() => {
            if (pendingRef.current !== null) return;
            pendingRef.current = window.setTimeout(() => {
                pendingRef.current = null;
                setRevision((r) => r + 1);
            }, 50);
        });
        return () => {
            if (pendingRef.current !== null) {
                window.clearTimeout(pendingRef.current);
                pendingRef.current = null;
            }
            dispose();
        };
    }, []);

    return (
        <SyncRevisionContext.Provider value={revision}>
            {children}
        </SyncRevisionContext.Provider>
    );
}

export function useSyncRevision(): number {
    return useContext(SyncRevisionContext);
}
