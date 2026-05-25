import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { usePermissions } from '../auth/authProvider';
import { Client, Devis } from '../Databases/db.d';
import ClientFormModal from '../components/client_form_modal';
import { useAlerts } from '../components/alerts';
import { statutColor, statutLabel } from '../layouts/devis_layouts';
import { formatDate, formatFCFA } from '../libs/format';

type Tab = 'devis' | 'factures' | 'notes';

export default function ClientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { clients, devis, factures, refreshDevisByClient, refreshFacturesByClient, deleteClient } = useDatabase();
    const { can } = usePermissions();
    const { confirm, success, error: notifyError } = useAlerts();
    const [tab, setTab] = useState<Tab>('devis');
    const [editing, setEditing] = useState(false);

    const client = useMemo(() => clients.find((c) => c.id === id), [clients, id]);

    useEffect(() => {
        if (id) {
            refreshDevisByClient(id);
            refreshFacturesByClient(id);
        }
    }, [id, refreshDevisByClient, refreshFacturesByClient]);

    if (!client) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                Client introuvable.
            </div>
        );
    }

    const clientDevis = useMemo(
        () => devis
            .filter((d) => d.clientId === client.id)
            .sort((a, b) => (b.dateEmission ?? '').localeCompare(a.dateEmission ?? '')),
        [devis, client.id],
    );
    const clientFactures = factures.filter((f) => f.clientId === client.id);
    const totalDevis = clientDevis.reduce((s, d) => s + (d.totalApreRemise ?? d.totalTTC ?? 0), 0);

    const handleDelete = async () => {
        const ok = await confirm({
            title: `Supprimer ${displayName(client)} ?`,
            message: 'Cette action est irréversible.',
            confirmLabel: 'Supprimer',
            danger: true,
        });
        if (!ok) return;
        try {
            await deleteClient(client.id);
            success('Client supprimé', displayName(client));
            navigate('/clients');
        } catch (err: any) {
            notifyError('Suppression impossible', err?.message ?? 'Erreur.');
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
                <h2 className="text-base font-semibold truncate">{displayName(client)}</h2>
                <div className="flex-1" />
                {can('devis:create') && (
                    <button
                        onClick={() => navigate(`/devis/new?clientId=${client.id}`)}
                        className="h-9 px-4 rounded-full bg-slate-900 text-white text-sm"
                    >
                        Nouveau devis
                    </button>
                )}
                {can('clients:write') && (
                    <button
                        onClick={() => setEditing(true)}
                        className="h-9 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-sm"
                    >
                        Modifier
                    </button>
                )}
                {can('clients:delete') && (
                    <button
                        onClick={handleDelete}
                        className="h-9 px-4 rounded-full text-sm text-red-600 hover:bg-red-50"
                    >
                        Supprimer
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-800 text-white text-lg font-semibold flex items-center justify-center">
                            {initials(client)}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-semibold">{displayName(client)}</h1>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    client.type === 'entreprise' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                    {client.type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                                </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">{client.email} · {client.telephone}</div>
                            {client.telephone2 && <div className="text-sm text-gray-400">{client.telephone2}</div>}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
                        <InfoRow label="Adresse" value={formatAdresse(client)} />
                        <InfoRow label="Statut" value={client.statut === 'actif' ? 'Actif' : 'Inactif'} />
                    </div>

                    {client.notes && (
                        <div className="mt-6">
                            <div className="text-xs uppercase text-gray-400 mb-1">Notes</div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</div>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200">
                    <div className="border-b border-slate-100 px-4 flex">
                        <TabBtn active={tab === 'devis'} onClick={() => setTab('devis')}>
                            Devis <Count n={clientDevis.length} />
                        </TabBtn>
                        <TabBtn active={tab === 'factures'} onClick={() => setTab('factures')}>
                            Factures <Count n={clientFactures.length} />
                        </TabBtn>
                        <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')}>
                            Historique
                        </TabBtn>
                    </div>
                    <div className="p-6 min-h-[200px]">
                        {tab === 'devis' && (
                            clientDevis.length === 0
                                ? <Empty msg="Aucun devis pour ce client." />
                                : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                                            <span>{clientDevis.length} devis</span>
                                            <span>Total cumulé : <span className="font-medium text-slate-800">{formatFCFA(totalDevis)}</span></span>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {clientDevis.map((d) => (
                                                <DevisListRow key={d.id} devis={d} onOpen={() => navigate(`/devis/${d.id}`)} />
                                            ))}
                                        </div>
                                    </div>
                                )
                        )}
                        {tab === 'factures' && (
                            clientFactures.length === 0
                                ? <Empty msg="Aucune facture pour ce client." />
                                : <div className="text-sm text-gray-500">Liste des factures à venir.</div>
                        )}
                        {tab === 'notes' && (
                            <Empty msg="Le journal d'activité arrivera avec la sync." />
                        )}
                    </div>
                </div>
            </div>

            {editing && (
                <ClientFormModal
                    client={client}
                    onClose={() => setEditing(false)}
                    onSaved={() => setEditing(false)}
                />
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs uppercase text-gray-400">{label}</div>
            <div className="text-sm text-gray-700 mt-0.5">{value || '—'}</div>
        </div>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 h-12 text-sm border-b-2 -mb-px ${
                active ? 'border-slate-900 text-slate-900 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            {children}
        </button>
    );
}

function Count({ n }: { n: number }) {
    return <span className="ml-1 text-xs text-gray-400">{n}</span>;
}

function Empty({ msg }: { msg: string }) {
    return <div className="text-sm text-gray-400 text-center py-8">{msg}</div>;
}

function DevisListRow({ devis, onOpen }: { devis: Devis; onOpen: () => void }) {
    return (
        <button
            onClick={onOpen}
            className="w-full text-left rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-4 py-3 transition-colors"
        >
            <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColor(devis.statut)}`}>
                    {statutLabel(devis.statut)}
                </span>
                <span className="text-xs text-gray-500 truncate">{devis.numero}</span>
                <span className="flex-1" />
                <span className="text-xs text-gray-400">{formatDate(devis.dateEmission)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    {devis.lignes?.length ?? 0} ligne{(devis.lignes?.length ?? 0) > 1 ? 's' : ''}
                </span>
                <span className="text-sm font-medium text-slate-800">
                    {formatFCFA(devis.totalApreRemise ?? devis.totalTTC ?? 0)}
                </span>
            </div>
        </button>
    );
}

function displayName(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

function initials(c: Client): string {
    const name = displayName(c);
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

function formatAdresse(c: Client): string {
    const a = c.adresse;
    if (!a) return '';
    return [a.rue, a.quartier, a.ville, a.codePostal, a.pays].filter(Boolean).join(', ');
}
