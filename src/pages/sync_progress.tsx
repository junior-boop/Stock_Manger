import { useEffect, useRef, useState } from 'react';
import { syncClient, type SyncStatus } from '../context/sync_client';
import { useAuth } from '../auth/authProvider';
import logo from '../assets/Kataleya.png';

const TABLE_LABELS: Record<string, string> = {
  administrateurs: 'Administrateurs',
  clients: 'Clients',
  collections: 'Collections',
  sous_collections: 'Sous-collections',
  articles: 'Articles',
  devis: 'Devis',
  factures: 'Factures',
  lignes_documents: 'Lignes de documents',
  techniciens: 'Techniciens',
  projets: 'Projets',
  taches_projet: 'Tâches projet',
  boutiques: 'Boutiques',
  stocks_boutique: 'Stocks boutique',
  transferts_stock: 'Transferts de stock',
  entreprises: 'Entreprise',
};

function getProgressPercent(status: SyncStatus): number {
  if (status.total === 0) return 0;
  return Math.min(Math.round((status.progress / status.total) * 100), 100);
}

export default function SyncProgressPage({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(() => syncClient.getStatus());
  const doneRef = useRef(false);

  useEffect(() => {
    const unsub = syncClient.subscribe((s) => {
      setStatus(s);
      if (syncClient.initialSyncDone && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    });
    return unsub;
  }, [onDone]);

  useEffect(() => {
    if (doneRef.current) return;

    if (syncClient.initialSyncDone) {
      doneRef.current = true;
      onDone();
      return;
    }

    const s = syncClient.getStatus();
    if (s.running || s.phase !== 'idle') {
      return;
    }

    const role = user?.role ?? null;
    syncClient.start()
      .then(() => syncClient.bootstrapIfEmpty(role))
      .catch(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      });
  }, [user, onDone]);

  const progress = getProgressPercent(status);
  const isActive = status.running || status.phase !== 'idle';

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-36px)] w-full bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6">
        <img src={logo} alt="Kataleya" className="h-16 object-contain" />

        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Synchronisation en cours
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {status.currentOperation || 'Préparation…'}
          </p>
        </div>

        <div className="w-full space-y-1">
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                  : 'bg-gray-300'
              }`}
              style={{ width: isActive ? `${Math.max(progress, 4)}%` : '100%' }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>
              {status.currentTable
                ? TABLE_LABELS[status.currentTable] ?? status.currentTable.replace(/_/g, ' ')
                : ''}
            </span>
            {isActive && status.total > 0 && (
              <span>{Math.min(status.progress, status.total)}/{status.total}</span>
            )}
          </div>
        </div>

        {!isActive && !status.running && status.phase === 'idle' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connexion au serveur…
          </div>
        )}

        {status.lastError && (
          <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-center">
            {status.lastError}
          </div>
        )}
      </div>
    </div>
  );
}
