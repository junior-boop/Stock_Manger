import { useMemo, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { usePermissions } from '../auth/authProvider';
import { Client, TypeClient, Devis, Facture } from '../Databases/db.d';
import { FluentAdd32Regular, FluentSearch32Filled } from '../libs/icons';
import ClientFormModal from '../components/client_form_modal';
import Title from '../components/title';
import { useNavigate } from 'react-router-dom';

type Filter = 'tous' | TypeClient;

const DEVIS_EN_COURS: Devis['statut'][] = ['brouillon', 'envoyé'];
const FACTURES_EN_COURS: Facture['statut'][] = ['brouillon', 'émise', 'partiellement_payée', 'en_retard'];

export default function ClientLayouts() {
    return (
        <div className="flex h-full w-full relative">
            <ClientAside />
            <div className="flex-1 h-full overflow-hidden">
                <Outlet />
            </div>
        </div>
    );
}

function ClientAside() {
    const { clients, devis, factures } = useDatabase();
    const { can } = usePermissions();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('tous');
    const [modalOpen, setModalOpen] = useState(false);
    const navigate = useNavigate();

    const countsByClient = useMemo(() => {
        const map = new Map<string, { devis: number; factures: number }>();
        for (const d of devis) {
            if (!DEVIS_EN_COURS.includes(d.statut)) continue;
            const e = map.get(d.clientId) ?? { devis: 0, factures: 0 };
            e.devis += 1;
            map.set(d.clientId, e);
        }
        for (const f of factures) {
            if (!FACTURES_EN_COURS.includes(f.statut)) continue;
            const e = map.get(f.clientId) ?? { devis: 0, factures: 0 };
            e.factures += 1;
            map.set(f.clientId, e);
        }
        return map;
    }, [devis, factures]);

    const lastDevisAtByClient = useMemo(() => {
        const map = new Map<string, string>();
        for (const d of devis) {
            const ts = d.updatedAt ?? d.dateEmission ?? '';
            const prev = map.get(d.clientId);
            if (!prev || ts > prev) map.set(d.clientId, ts);
        }
        return map;
    }, [devis]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return clients
            .filter((c) => filter === 'tous' || c.type === filter)
            .filter((c) => {
                if (!q) return true;
                const hay = [c.nom, c.prenom, c.raisonSociale, c.email, c.telephone]
                    .filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => {
                const ta = lastDevisAtByClient.get(a.id) ?? '';
                const tb = lastDevisAtByClient.get(b.id) ?? '';
                if (ta !== tb) return tb.localeCompare(ta);
                return displayName(a).localeCompare(displayName(b));
            });
    }, [clients, query, filter, lastDevisAtByClient]);

    return (
        <div className="w-87.5 h-full bg-white border-r border-slate-100  flex flex-col">
            <div className="px-3 pt-3 flex flex-col">
                <div className="flex items-center justify-between">
                    <Title title="Clients" />
                    {can('clients:write') && (
                        <button
                            onClick={() => setModalOpen(true)}
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
                            placeholder="Chercher un client"
                        />
                        <button className="w-[42px] h-[42px] flex items-center justify-center">
                            <FluentSearch32Filled className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex bg-slate-100 rounded-full p-1">
                    {(['tous', 'particulier', 'entreprise'] as Filter[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            className={`flex-1 h-8 rounded-full text-xs ${filter === t ? 'bg-white shadow-sm font-medium' : 'text-gray-500'
                                }`}
                        >
                            {t === 'tous' ? 'Tous' : t === 'particulier' ? 'Particuliers' : 'Entreprises'}
                        </button>
                    ))}
                </div>

                <div className="mt-4 text-xs text-gray-400 px-1">
                    {filtered.length} client{filtered.length > 1 ? 's' : ''}
                </div>
            </div>
            <div data-os-scroll className="mt-2 flex-1 overflow-y-auto pr-1">
                <div className='flex flex-col gap-3 px-3'>
                    {filtered.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-8">
                            {query || filter !== 'tous' ? 'Aucun résultat.' : 'Aucun client.'}
                        </div>
                    ) : (
                        filtered.map((c) => (
                            <ClientRow
                                key={c.id}
                                client={c}
                                counts={countsByClient.get(c.id) ?? { devis: 0, factures: 0 }}
                            />
                        ))
                    )}
                </div>

            </div>

            {modalOpen && (
                <ClientFormModal
                    onClose={() => setModalOpen(false)}
                    onSaved={(c) => { setModalOpen(false); navigate(`/clients/${c.id}`); }}
                />
            )}
        </div>
    );
}

function ClientRow({ client, counts }: { client: Client; counts: { devis: number; factures: number } }) {
    const { id } = useParams();
    const isActive = id === client.id;
    return (
        <NavLink
            to={`/clients/${client.id}`}
            className={`block rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-slate-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
        >
            <div className="flex items-center gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${client.type === 'entreprise' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                    {client.type === 'entreprise' ? 'Ent.' : 'Part.'}
                </span>
                <span className={`flex-1 truncate text-sm ${isActive ? 'font-semibold' : ''}`}>
                    {displayName(client)}
                </span>
            </div>
            <div className="mt-1 text-xs text-gray-500 truncate">{client.email}</div>
            <div className="mt-2 flex gap-3 text-xs">
                <span className="text-gray-600">
                    <span className="font-medium text-slate-800">{counts.devis}</span> devis
                </span>
                <span className="text-gray-300">·</span>
                <span className="text-gray-600">
                    <span className="font-medium text-slate-800">{counts.factures}</span> factures
                </span>
                <span className="ml-auto text-[10px] text-gray-400">en cours</span>
            </div>
        </NavLink>
    );
}

function displayName(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}
