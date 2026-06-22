import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { Client, Facture } from '../Databases/db.d';
import { FluentArrowUp32Filled, FluentAlert32Filled, FluentChevronRight32Filled } from '../libs/icons';
import { formatFCFA } from '../libs/format';

export default function ClientsPage() {
    const { clients, factures } = useDatabase();
    const navigate = useNavigate();

    const clientById = useMemo(() => {
        const m = new Map<string, Client>();
        for (const c of clients) m.set(c.id, c);
        return m;
    }, [clients]);

    const topClientsDuMois = useMemo(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
        const tally = new Map<string, { id: string; ca: number; count: number }>();
        for (const f of (factures as Facture[])) {
            if (f.statut === 'brouillon' || f.statut === 'annulée') continue;
            const t = f.dateEmission ? new Date(f.dateEmission).getTime() : NaN;
            if (Number.isNaN(t) || t < start || t >= end) continue;
            if (!f.clientId) continue;
            const prev = tally.get(f.clientId) ?? { id: f.clientId, ca: 0, count: 0 };
            prev.ca += f.totalApreRemise ?? f.totalTTC ?? 0;
            prev.count += 1;
            tally.set(f.clientId, prev);
        }
        return Array.from(tally.values()).sort((a, b) => b.ca - a.ca).slice(0, 5);
    }, [factures]);

    const impayes = useMemo(() => {
        const now = Date.now();
        const tally = new Map<string, { id: string; due: number; oldest: number; count: number }>();
        for (const f of (factures as Facture[])) {
            if (f.statut === 'annulée' || f.statut === 'payée') continue;
            const restant = f.montantRestant ?? 0;
            if (restant <= 0) continue;
            if (!f.clientId) continue;
            const ech = f.dateEcheance ? new Date(f.dateEcheance).getTime() : now;
            const prev = tally.get(f.clientId) ?? { id: f.clientId, due: 0, oldest: ech, count: 0 };
            prev.due += restant;
            if (ech < prev.oldest) prev.oldest = ech;
            prev.count += 1;
            tally.set(f.clientId, prev);
        }
        return Array.from(tally.values()).sort((a, b) => a.oldest - b.oldest).slice(0, 5);
    }, [factures]);

    const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return (
        <div data-os-scroll className="h-full w-full overflow-y-auto bg-slate-50">
            <div className="px-10 py-10 flex flex-col gap-8">
                <div>
                    <h1 className="text-4xl font-light">Clients</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Vue d'ensemble — sélectionne un client à gauche pour voir le détail.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <InsightCard
                        title="Top clients du mois"
                        subtitle={monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
                        icon={<FluentArrowUp32Filled className="h-5 w-5 text-emerald-700" />}
                        tint="bg-emerald-50"
                        empty="Aucune facture émise ce mois-ci."
                        items={topClientsDuMois.map((t, idx) => {
                            const c = clientById.get(t.id);
                            return {
                                key: t.id,
                                onClick: () => navigate(`/clients/${t.id}`),
                                title: `${idx + 1}. ${c ? displayName(c) : 'Client'}`,
                                subtitle: `${t.count} facture${t.count > 1 ? 's' : ''}`,
                                right: (
                                    <div className="text-xs font-semibold text-emerald-700 tabular-nums">
                                        {formatFCFA(t.ca)}
                                    </div>
                                ),
                            };
                        })}
                    />
                    <InsightCard
                        title="Clients avec impayés"
                        subtitle="Triés par ancienneté"
                        icon={<FluentAlert32Filled className="h-5 w-5 text-rose-700" />}
                        tint="bg-rose-50"
                        empty="Aucun impayé."
                        items={impayes.map((t) => {
                            const c = clientById.get(t.id);
                            const overdue = t.oldest < Date.now();
                            return {
                                key: t.id,
                                onClick: () => navigate(`/clients/${t.id}`),
                                title: c ? displayName(c) : 'Client',
                                subtitle: `${t.count} facture${t.count > 1 ? 's' : ''}${overdue ? ' · en retard' : ''}`,
                                right: (
                                    <div className={`text-xs font-semibold tabular-nums ${overdue ? 'text-rose-700' : 'text-amber-700'}`}>
                                        {formatFCFA(t.due)}
                                    </div>
                                ),
                            };
                        })}
                    />
                </div>
            </div>
        </div>
    );
}

function displayName(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

type InsightItem = {
    key: string;
    onClick: () => void;
    title: string;
    subtitle: string;
    right: React.ReactNode;
};

function InsightCard({
    title, subtitle, icon, tint, items, empty,
}: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    tint: string;
    items: InsightItem[];
    empty: string;
}) {
    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tint}`}>
                    {icon}
                </div>
                <div>
                    <div className="text-sm font-medium text-slate-900">{title}</div>
                    <div className="text-xs text-gray-400">{subtitle}</div>
                </div>
            </div>
            {items.length === 0 ? (
                <div className="text-xs text-gray-400 py-6 text-center">{empty}</div>
            ) : (
                <div className="flex flex-col gap-1">
                    {items.map((it) => (
                        <button
                            key={it.key}
                            type="button"
                            onClick={it.onClick}
                            className="group w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition text-left"
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900 truncate">{it.title}</div>
                                <div className="text-xs text-gray-500 truncate">{it.subtitle}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {it.right}
                                <FluentChevronRight32Filled className="h-3 w-3 text-gray-300 group-hover:text-slate-500" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
