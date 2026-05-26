import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { usePermissions } from '../auth/authProvider';
import { Client, Facture, StatutFacture } from '../Databases/db.d';
import { FluentAdd32Regular, FluentSearch32Filled } from '../libs/icons';
import Title from '../components/title';
import { formatFCFA, formatDate } from '../libs/format';

type Filter = 'tous' | 'en_cours' | 'payées' | 'en_retard' | 'brouillons';

const STATUTS: { id: Filter; label: string }[] = [
    { id: 'tous', label: 'Tous' },
    { id: 'brouillons', label: 'Brouillons' },
    { id: 'en_cours', label: 'En cours' },
    { id: 'payées', label: 'Payées' },
    { id: 'en_retard', label: 'Retard' },
];

function matchFilter(f: Facture, filter: Filter): boolean {
    switch (filter) {
        case 'tous': return true;
        case 'brouillons': return f.statut === 'brouillon';
        case 'en_cours': return f.statut === 'émise' || f.statut === 'partiellement_payée';
        case 'payées': return f.statut === 'payée';
        case 'en_retard': return f.statut === 'en_retard';
    }
}

export default function FacturesLayouts() {
    return (
        <div className="flex h-full w-full relative">
            <FacturesAside />
            <div className="flex-1 h-full overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}

function FacturesAside() {
    const { factures, clients } = useDatabase();
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
        return factures
            .filter((f) => matchFilter(f, filter))
            .filter((f) => {
                if (!q) return true;
                const c = clientById.get(f.clientId);
                const hay = [f.numero, c ? displayClient(c) : '', c?.email].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => (b.dateEmission ?? '').localeCompare(a.dateEmission ?? ''));
    }, [factures, query, filter, clientById]);

    return (
        <div className="w-[350px] h-full bg-white border-r border-slate-100 flex flex-col">
            <div className="px-3 pt-3 flex flex-col">
                <div className="flex items-center justify-between">
                    <Title title="Factures" />
                    {can('factures:create') && (
                        <button
                            onClick={() => navigate('/factures/new')}
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
                            placeholder="N° facture ou client"
                        />
                        <button className="w-[42px] h-[42px] flex items-center justify-center">
                            <FluentSearch32Filled className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex bg-slate-100 rounded-full p-1 overflow-x-auto">
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
                </div>

                <div className="mt-4 text-xs text-gray-400 px-1">
                    {filtered.length} facture{filtered.length > 1 ? 's' : ''}
                </div>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto pr-1">
                <div className="px-3 flex flex-col gap-3">
                    {filtered.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-8">
                            {query || filter !== 'tous' ? 'Aucun résultat.' : 'Aucune facture pour l\'instant.'}
                        </div>
                    ) : (
                        filtered.map((f) => (
                            <FactureRow key={f.id} facture={f} client={clientById.get(f.clientId)} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function FactureRow({ facture, client }: { facture: Facture; client: Client | undefined }) {
    const { id } = useParams();
    const isActive = id === facture.id;
    const total = facture.totalApreRemise ?? facture.totalTTC ?? 0;
    const restant = facture.montantRestant ?? Math.max(0, total - (facture.montantPayé ?? 0));
    return (
        <NavLink
            to={`/factures/${facture.id}`}
            className={`block rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-slate-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
        >
            <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColorFacture(facture.statut)}`}>
                    {statutLabelFacture(facture.statut)}
                </span>
                <span className={`flex-1 truncate text-xs text-gray-500 ${isActive ? 'font-medium' : ''}`}>
                    {facture.numero}
                </span>
            </div>
            <div className="mt-1 text-sm font-medium truncate">
                {client ? displayClient(client) : 'Client introuvable'}
            </div>
            <div className="mt-1 flex justify-between text-xs">
                <span className="text-gray-500">{formatDate(facture.dateEmission)}</span>
                <span className="font-medium text-slate-800">{formatFCFA(total)}</span>
            </div>
            {restant > 0 && facture.statut !== 'brouillon' && facture.statut !== 'annulée' && (
                <div className="mt-1 text-[11px] text-amber-600">
                    Reste {formatFCFA(restant)}
                </div>
            )}
        </NavLink>
    );
}

function displayClient(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

export function statutLabelFacture(s: StatutFacture): string {
    switch (s) {
        case 'brouillon': return 'Brouillon';
        case 'émise': return 'Émise';
        case 'partiellement_payée': return 'Partielle';
        case 'payée': return 'Payée';
        case 'en_retard': return 'En retard';
        case 'annulée': return 'Annulée';
        case 'avoir': return 'Avoir';
    }
}

export function statutColorFacture(s: StatutFacture): string {
    switch (s) {
        case 'brouillon': return 'bg-slate-100 text-slate-600';
        case 'émise': return 'bg-blue-50 text-blue-700';
        case 'partiellement_payée': return 'bg-amber-50 text-amber-700';
        case 'payée': return 'bg-emerald-50 text-emerald-700';
        case 'en_retard': return 'bg-red-50 text-red-700';
        case 'annulée': return 'bg-gray-100 text-gray-500';
        case 'avoir': return 'bg-purple-50 text-purple-700';
    }
}
