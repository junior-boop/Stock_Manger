import { useEffect, useRef, useState } from 'react';
import { syncClient, type SyncStatus } from '../context/sync_client';
import { useAuth } from '../auth/authProvider';
import logo from '../assets/Kataleya.png';
import { SvgSpinners180RingWithBg } from '../libs/icons';

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

const PHASE_LABELS: Record<string, string> = {
  idle: 'Préparation…',
  pull: 'Récupération des données',
  push: 'Envoi des modifications',
  bootstrap: 'Téléchargement initial',
  images: 'Synchronisation des images',
};

const PHASE_STEPS = ['bootstrap', 'pull', 'push', 'images'];

function getProgressPercent(status: SyncStatus): number {
  if (status.total === 0) return 0;
  return Math.min(Math.round((status.progress / status.total) * 100), 100);
}

export default function SyncProgressPage({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(() => syncClient.getStatus());
  const [timedOut, setTimedOut] = useState(false);
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
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled && !syncClient.initialSyncDone) {
        setTimedOut(true);
      }
    }, 60000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

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
    syncClient.bootstrapIfEmpty(role)
      .then(() => syncClient.start())
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
    <div className="flex items-center justify-center min-h-[calc(100dvh-36px)] w-full bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6">
        <img src={logo} alt="Kataleya" className="h-16 object-contain" />

        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Synchronisation en cours
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {timedOut
              ? 'La synchronisation prend plus de temps que prévu…'
              : status.currentOperation || PHASE_LABELS[status.phase] || 'Préparation…'}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2">
          {PHASE_STEPS.map((phase) => {
            const phaseIdx = PHASE_STEPS.indexOf(phase);
            const currentIdx = PHASE_STEPS.indexOf(status.phase);
            const done = currentIdx > phaseIdx;
            const active = status.phase === phase;

            return (
              <div key={phase} className="flex items-center gap-3 text-sm">
                <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? '✓' : active ? '…' : phaseIdx + 1}
                </div>
                <span className={`${done ? 'text-emerald-600' : active ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {PHASE_LABELS[phase] || phase}
                </span>
                {(active || done) && status.currentTable && (
                  <span className="text-xs text-gray-400 ml-auto">
                    {TABLE_LABELS[status.currentTable] ?? status.currentTable.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            );
          })}
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

        {!isActive && !status.running && status.phase === 'idle' && !timedOut && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SvgSpinners180RingWithBg className="h-4 w-4" />
            Connexion au serveur…
          </div>
        )}

        {timedOut && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-center">
              La synchronisation est longue. Vous pouvez continuer, les données finiront de se charger en arrière-plan.
            </div>
            <button
              onClick={() => {
                doneRef.current = true;
                onDone();
              }}
              className="h-10 px-6 bg-slate-800 text-white text-sm rounded-full font-medium hover:bg-slate-700 transition"
            >
              Continuer quand même
            </button>
          </div>
        )}

        {status.lastError && !timedOut && (
          <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-center">
            {status.lastError}
          </div>
        )}
      </div>
    </div>
  );
}
