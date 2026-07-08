import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { usePermissions } from '../auth/authProvider';
import { Client, Devis, StatutDevis } from '../Databases/db.d';
import { FluentAdd32Regular, FluentSearch32Filled } from '../libs/icons';
import Title from '../components/title';
import { formatFCFA, formatDate } from '../libs/format';
import ScrollArea from '../components/scroll_area';

type Filter = 'tous' | StatutDevis;

const STATUTS: { id: Filter; label: string }[] = [
    { id: 'tous', label: 'Tous' },
    { id: 'brouillon', label: 'Brouillon' },
    { id: 'envoyé', label: 'Envoyés' },
    { id: 'accepté', label: 'Acceptés' },
    { id: 'refusé', label: 'Refusés' },
];

export default function DevisLayouts() {
    return (
        <div className="flex h-full w-full relative">
            <DevisAside />
            <div className="flex-1 h-full overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}

function DevisAside() {
    const { devis, clients } = useDatabase();
    const { can } = usePermissions();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('tous');

    const clientById = useMemo(() => {
        const m = new Map<string, Client>();
        clients.forEach((c) => m.set(c.id, c));
        return m;
    }, [clients]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return devis
            .filter((d) => filter === 'tous' || d.statut === filter)
            .filter((d) => {
                if (!q) return true;
                const c = clientById.get(d.clientId);
                const hay = [d.numero, c ? displayClient(c) : '', c?.email].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => (b.dateEmission ?? '').localeCompare(a.dateEmission ?? ''));
    }, [devis, query, filter, clientById]);

    return (
        <div className="w-[350px] h-full bg-white border-r border-slate-100 flex flex-col">
            <div className='px-3 pt-3 flex flex-col'>
                <div className="flex items-center justify-between">
                    <Title title="Devis" />
                    {can('devis:create') && (
                        <button
                            onClick={() => navigate('/devis/new')}
                            className="h-[36px] pl-4 pr-2 flex text-sm items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer"
                        >
                            <span>Nouveau</span>
                            <FluentAdd32Regular className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <div className="h-[56px] pl-5 pr-2 mt-2 flex items-center bg-slate-100 rounded-full">
                    <div className="flex w-full">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            type="text"
                            className="focus:outline-none flex-1 bg-transparent"
                            placeholder="N° devis ou client"
                        />
                        <button className="w-[42px] h-[42px] flex items-center justify-center">
                            <FluentSearch32Filled className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <ScrollArea className="mt-4 flex bg-slate-100 rounded-full p-1 overflow-x-auto">
                    {STATUTS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setFilter(t.id)}
                            className={`flex-1 h-8 rounded-full text-xs whitespace-nowrap px-2 ${filter === t.id ? 'bg-white shadow-sm font-medium' : 'text-gray-500'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </ScrollArea>

                <div className="mt-4 text-xs text-gray-400 px-1">
                    {filtered.length} devis
                </div>
            </div>

            <ScrollArea className="mt-2 flex-1 overflow-y-auto pr-1">
                <div className='px-3 flex flex-col gap-3'>
                    {filtered.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-8">
                            {query || filter !== 'tous' ? 'Aucun résultat.' : 'Aucun devis pour l\'instant.'}
                        </div>
                    ) : (
                        filtered.map((d) => (
                            <DevisRow key={d.id} devis={d} client={clientById.get(d.clientId)} />
                        ))
                    )}
                </div>

            </ScrollArea>
        </div>
    );
}

function DevisRow({ devis, client }: { devis: Devis; client: Client | undefined }) {
    const { id } = useParams();
    const isActive = id === devis.id;
    return (
        <NavLink
            to={`/devis/${devis.id}`}
            className={`block rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-slate-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
        >
            <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColor(devis.statut)}`}>
                    {statutLabel(devis.statut)}
                </span>
                <span className={`flex-1 truncate text-xs text-gray-500 ${isActive ? 'font-medium' : ''}`}>
                    {devis.numero}
                </span>
            </div>
            <div className="mt-1 text-sm font-medium truncate">
                {client ? displayClient(client) : 'Client introuvable'}
            </div>
            <div className="mt-1 flex justify-between text-xs">
                <span className="text-gray-500">{formatDate(devis.dateEmission)}</span>
                <span className="font-medium text-slate-800">{formatFCFA(devis.totalApreRemise ?? devis.totalTTC ?? 0)}</span>
            </div>
        </NavLink>
    );
}

function displayClient(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

export function statutLabel(s: StatutDevis): string {
    switch (s) {
        case 'brouillon': return 'Brouillon';
        case 'envoyé': return 'Envoyé';
        case 'accepté': return 'Accepté';
        case 'refusé': return 'Refusé';
        case 'expiré': return 'Expiré';
        case 'annulé': return 'Annulé';
    }
}

export function statutColor(s: StatutDevis): string {
    switch (s) {
        case 'brouillon': return 'bg-slate-100 text-slate-600';
        case 'envoyé': return 'bg-blue-50 text-blue-700';
        case 'accepté': return 'bg-emerald-50 text-emerald-700';
        case 'refusé': return 'bg-red-50 text-red-700';
        case 'expiré': return 'bg-amber-50 text-amber-700';
        case 'annulé': return 'bg-gray-100 text-gray-500';
    }
}
