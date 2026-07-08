import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { Client, Projet, StatutProjet } from '../Databases/db.d';
import { FluentAdd32Regular, FluentSearch32Filled } from '../libs/icons';
import Title from '../components/title';
import { formatDate } from '../libs/format';
import ScrollArea from '../components/scroll_area';

type Filter = 'tous' | StatutProjet;

const FILTRES: { id: Filter; label: string }[] = [
    { id: 'tous', label: 'Tous' },
    { id: 'planifié', label: 'Planifiés' },
    { id: 'en_cours', label: 'En cours' },
    { id: 'en_pause', label: 'En pause' },
    { id: 'terminé', label: 'Terminés' },
];

export default function ProjetsLayouts() {
    return (
        <div className="flex h-full w-full relative">
            <ProjetsAside />
            <div className="flex-1 h-full overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}

function ProjetsAside() {
    const { projets, clients, devis } = useDatabase();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('tous');

    const clientById = useMemo(() => {
        const m = new Map<string, Client>();
        clients.forEach(c => m.set(c.id, c));
        return m;
    }, [clients]);

    const budgetByProjet = useMemo(() => {
        const m = new Map<string, number>();
        projets.forEach(p => {
            const total = (p.devisIds ?? []).reduce((sum, did) => {
                const d = devis.find(dv => dv.id === did);
                return sum + (d?.totalApreRemise ?? d?.totalTTC ?? 0);
            }, 0);
            m.set(p.id, total);
        });
        return m;
    }, [projets, devis]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return projets
            .filter(p => filter === 'tous' || p.statut === filter)
            .filter(p => {
                if (!q) return true;
                const c = clientById.get(p.clientId);
                const hay = [p.nom, c ? displayClient(c) : ''].join(' ').toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    }, [projets, query, filter, clientById]);

    return (
        <div className="w-[350px] h-full bg-white border-r border-slate-100 flex flex-col">
            <div className="px-3 pt-3 flex flex-col">
                <div className="flex items-center justify-between">
                    <Title title="Projets" />
                    <button
                        onClick={() => navigate('/projets/new')}
                        className="h-[36px] pl-4 pr-2 flex text-sm items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer"
                    >
                        <span>Nouveau</span>
                        <FluentAdd32Regular className="h-5 w-5" />
                    </button>
                </div>

                <div className="h-[56px] pl-5 pr-2 mt-2 flex items-center bg-slate-100 rounded-full">
                    <div className="flex w-full">
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            type="text"
                            className="focus:outline-none flex-1 bg-transparent"
                            placeholder="Nom ou client"
                        />
                        <button className="w-[42px] h-[42px] flex items-center justify-center">
                            <FluentSearch32Filled className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <ScrollArea className="mt-4 flex bg-slate-100 rounded-full p-1 overflow-x-auto">
                    {FILTRES.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setFilter(t.id)}
                            className={`flex-1 h-8 rounded-full text-xs whitespace-nowrap px-2 ${filter === t.id ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </ScrollArea>

                <div className="mt-4 text-xs text-gray-400 px-1">
                    {filtered.length} projet{filtered.length > 1 ? 's' : ''}
                </div>
            </div>

            <ScrollArea className="mt-2 flex-1 overflow-y-auto">
                <div className="px-3 flex flex-col gap-3">
                    {filtered.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-8">
                            {query || filter !== 'tous' ? 'Aucun résultat.' : 'Aucun projet pour l\'instant.'}
                        </div>
                    ) : (
                        filtered.map(p => (
                            <ProjetRow key={p.id} projet={p} client={clientById.get(p.clientId)} budget={budgetByProjet.get(p.id) ?? 0} />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function ProjetRow({ projet, client, budget }: { projet: Projet; client: Client | undefined; budget: number }) {
    const { id } = useParams();
    const isActive = id === projet.id;

    return (
        <NavLink
            to={`/projets/${projet.id}`}
            className={`block rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-slate-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
        >
            <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColor(projet.statut)}`}>
                    {statutLabel(projet.statut)}
                </span>
            </div>
            <div className="mt-1 text-sm font-medium truncate">{projet.nom}</div>
            <div className="text-xs text-gray-500 truncate">{client ? displayClient(client) : 'Client introuvable'}</div>
            <div className="mt-1 flex justify-between text-xs">
                <span className="text-gray-400">{formatDate(projet.dateDebut)}</span>
                {budget > 0 && (
                    <span className="font-medium text-slate-700">
                        {Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(budget)}
                    </span>
                )}
            </div>
        </NavLink>
    );
}

function displayClient(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

export function statutLabel(s: StatutProjet): string {
    switch (s) {
        case 'planifié': return 'Planifié';
        case 'en_cours': return 'En cours';
        case 'en_pause': return 'En pause';
        case 'terminé': return 'Terminé';
        case 'annulé': return 'Annulé';
    }
}

export function statutColor(s: StatutProjet): string {
    switch (s) {
        case 'planifié': return 'bg-slate-100 text-slate-600';
        case 'en_cours': return 'bg-blue-50 text-blue-700';
        case 'en_pause': return 'bg-amber-50 text-amber-700';
        case 'terminé': return 'bg-emerald-50 text-emerald-700';
        case 'annulé': return 'bg-gray-100 text-gray-500';
    }
}
