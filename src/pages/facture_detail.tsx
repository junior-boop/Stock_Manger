import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { usePermissions, useAuth } from '../auth/authProvider';
import { Client, Facture, Paiement, StatutFacture } from '../Databases/db.d';
import FactureForm, { FactureFormValue, computeTotaux } from '../components/facture_form';
import PaiementModal, { PaiementInput } from '../components/paiement_modal';
import FactureSendModal from '../components/facture_send_modal';
import { fromDateInput, toDateInput, formatDate, formatFCFA } from '../libs/format';
import { statutColorFacture, statutLabelFacture } from '../layouts/factures_layouts';
import { useAlerts } from '../components/alerts';
import { FluentMoreHorizontal32Regular } from '../libs/icons';
import { buildFactureHTML, buildRecuPaiementHTML } from '../libs/facture_pdf';
import { v4 as uuidv4 } from 'uuid';

declare global {
    interface Window {
        pdf: {
            generateDevis: (html: string, filename: string) => Promise<string>;
            generateFacture: (html: string, filename: string) => Promise<string>;
        };
        shell: {
            openPath: (p: string) => Promise<string>;
            openExternal: (url: string) => Promise<void>;
            showItemInFolder: (p: string) => Promise<void>;
        };
    }
}

const STATUT_OPTIONS: StatutFacture[] = [
    'brouillon', 'émise', 'partiellement_payée', 'payée', 'en_retard', 'annulée', 'avoir',
];

function modeLabel(m: string): string {
    switch (m) {
        case 'espèces': return 'Espèces';
        case 'virement': return 'Virement';
        case 'chèque': return 'Chèque';
        case 'mobile_money': return 'Mobile Money';
        case 'carte_bancaire': return 'Carte bancaire';
        default: return 'Autre';
    }
}

export default function FactureDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { factures, devis, clients, articles, administrateurs, updateFacture, deleteFacture } = useDatabase();
    const { can } = usePermissions();
    const { user } = useAuth();
    const { confirm, success, error: notifyError } = useAlerts();

    const current = useMemo(() => factures.find((f) => f.id === id), [factures, id]);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState<FactureFormValue | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statutMenuOpen, setStatutMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [paiementOpen, setPaiementOpen] = useState(false);
    const [sendOpen, setSendOpen] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);

    useEffect(() => {
        if (current) {
            setValue({
                clientId: current.clientId,
                dateEmission: toDateInput(current.dateEmission),
                dateEcheance: toDateInput(current.dateEcheance),
                lignes: current.lignes,
                remiseGlobale: current.remiseGlobale ?? 0,
                notes: current.notes ?? '',
                conditionsPaiement: current.conditionsPaiement ?? '',
            });
            setEditing(false);
        }
    }, [current?.id]);

    useEffect(() => {
        if (!current) return;
        if (current.statut !== 'émise') return;
        if ((current.montantRestant ?? 0) <= 0) return;
        const ech = new Date(current.dateEcheance).getTime();
        if (Number.isNaN(ech)) return;
        if (ech < Date.now()) {
            updateFacture(current.id, { statut: 'en_retard' }).catch(() => { });
        }
    }, [current?.id, current?.statut, current?.dateEcheance, current?.montantRestant]);

    if (!current || !value) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">Facture introuvable.</div>
        );
    }

    const isBrouillon = current.statut === 'brouillon';
    const canEdit = can('factures:modify') || (isBrouillon && can('factures:create'));
    const canChangeStatut = can('factures:modify') || can('factures:create');
    const canPay = can('paiements:write') && current.montantRestant > 0
        && current.statut !== 'brouillon' && current.statut !== 'annulée';
    const canSend = current.statut !== 'annulée';

    const client: Client | undefined = clients.find((c) => c.id === current.clientId);
    const sourceDevis = current.devisId ? devis.find((d) => d.id === current.devisId) : undefined;
    const creator = administrateurs.find((a) => a.id === current.createdBy);
    const creatorName = creator
        ? ([creator.prenom, creator.nom].filter(Boolean).join(' ') || creator.email)
        : '';

    const echeanceMs = new Date(current.dateEcheance).getTime();
    const joursRetard = !Number.isNaN(echeanceMs) && current.montantRestant > 0
        ? Math.floor((Date.now() - echeanceMs) / 86400000)
        : 0;
    const enRetard = joursRetard > 0
        && (current.statut === 'émise' || current.statut === 'partiellement_payée' || current.statut === 'en_retard');

    const save = async () => {
        setError(null);
        if (!value.clientId) return setError('Client requis.');
        if (value.lignes.length === 0) return setError('Au moins une ligne requise.');
        const totaux = computeTotaux(value);
        const notes = value.notes.trim();
        const cp = value.conditionsPaiement.trim();
        const totalApreRemise = totaux.totalApreRemise;
        const montantPayé = current.montantPayé ?? 0;
        const montantRestant = Math.max(0, totalApreRemise - montantPayé);
        const patch: Partial<Facture> = {
            clientId: value.clientId,
            lignes: value.lignes,
            totalHT: totaux.totalHT,
            totalTVA: totaux.totalTVA,
            totalTTC: totaux.totalTTC,
            remiseGlobale: value.remiseGlobale,
            totalApreRemise,
            montantRestant,
            dateEmission: fromDateInput(value.dateEmission),
            dateEcheance: fromDateInput(value.dateEcheance),
            ...(notes ? { notes } : {}),
            ...(cp ? { conditionsPaiement: cp } : {}),
        };
        setSubmitting(true);
        try {
            await updateFacture(current.id, patch);
            setEditing(false);
            success('Facture enregistrée', current.numero);
        } catch (err: any) {
            const msg = err?.message ?? 'Erreur.';
            setError(msg);
            notifyError('Échec de l\'enregistrement', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadRecu = async (paiement: Paiement) => {
        try {
            const client = clients.find((c) => c.id === current.clientId);
            const sortedAsc = [...(current.paiements ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1));
            const idx = sortedAsc.findIndex((p) => p.id === paiement.id);
            const seq = String(idx >= 0 ? idx + 1 : sortedAsc.length).padStart(2, '0');
            const numeroRecu = `RECU-${current.numero}-${seq}`;
            const cumul = sortedAsc.slice(0, idx + 1).reduce((s, p) => s + (p.montant || 0), 0);
            const factureSnapshot: Facture = { ...current, montantPayé: cumul };
            const html = buildRecuPaiementHTML(factureSnapshot, client, paiement, numeroRecu);
            const filePath = await window.pdf.generateFacture(html, numeroRecu);
            await window.shell.openPath(filePath);
            success('Reçu généré', numeroRecu);
        } catch (err: any) {
            notifyError('Échec génération reçu', err?.message ?? 'Erreur.');
        }
    };

    const handleDownloadPdf = async () => {
        setPdfBusy(true);
        try {
            const client = clients.find((c) => c.id === current.clientId);
            const html = buildFactureHTML(current, client);
            const filePath = await window.pdf.generateFacture(html, current.numero);
            await window.shell.openPath(filePath);
            success('PDF généré', current.numero);
        } catch (err: any) {
            notifyError('Échec génération PDF', err?.message ?? 'Erreur.');
        } finally {
            setPdfBusy(false);
        }
    };

    const setStatut = async (statut: StatutFacture) => {
        setSubmitting(true);
        try {
            await updateFacture(current.id, { statut });
            success('Statut mis à jour', statutLabelFacture(statut));
        } catch (err: any) {
            notifyError('Échec', err?.message ?? 'Erreur.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegisterPaiement = async (input: PaiementInput) => {
        const paiement: Paiement = {
            id: uuidv4(),
            date: fromDateInput(input.date),
            montant: input.montant,
            mode: input.mode,
            enregistréPar: user?.id ?? '',
            ...(input.reference ? { reference: input.reference } : {}),
            ...(input.notes ? { notes: input.notes } : {}),
        };
        const paiements = [...(current.paiements ?? []), paiement];
        const total = current.totalApreRemise ?? current.totalTTC ?? 0;
        const montantPayé = paiements.reduce((s, p) => s + (p.montant || 0), 0);
        const montantRestant = Math.max(0, total - montantPayé);
        let statut: StatutFacture = current.statut;
        if (montantRestant === 0 && total > 0) statut = 'payée';
        else if (montantPayé > 0) statut = 'partiellement_payée';
        const patch: Partial<Facture> = {
            paiements,
            montantPayé,
            montantRestant,
            statut,
            ...(montantRestant === 0 ? { datePaiementComplet: new Date().toISOString() } : {}),
        };
        try {
            await updateFacture(current.id, patch);
            setPaiementOpen(false);
            success('Paiement enregistré', formatFCFA(input.montant));
        } catch (err: any) {
            notifyError('Échec du paiement', err?.message ?? 'Erreur.');
        }
    };

    const handleDelete = async () => {
        const ok = await confirm({
            title: `Supprimer la facture ${current.numero} ?`,
            message: 'Cette action est irréversible.',
            confirmLabel: 'Supprimer',
            danger: true,
        });
        if (!ok) return;
        try {
            await deleteFacture(current.id);
            success('Facture supprimée', current.numero);
            navigate('/factures');
        } catch (err: any) {
            notifyError('Suppression impossible', err?.message ?? 'Erreur.');
        }
    };

    const total = current.totalApreRemise ?? current.totalTTC ?? 0;
    const paiements = current.paiements ?? [];

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">{current.numero}</h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColorFacture(current.statut)}`}>
                            {statutLabelFacture(current.statut)}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Émise le {formatDate(current.dateEmission)} · Échéance {formatDate(current.dateEcheance)}
                        {current.datePaiementComplet && (
                            <> · <span className="text-emerald-700">Payée le {formatDate(current.datePaiementComplet)}</span></>
                        )}
                        {creatorName && <> · <span className="text-slate-600">Créée par {creatorName}</span></>}
                    </div>
                </div>
                <div className="flex-1" />

                {editing ? (
                    <>
                        <button onClick={() => setEditing(false)} disabled={submitting} className="h-9 px-4 rounded-full text-sm hover:bg-slate-100">
                            Annuler
                        </button>
                        <button onClick={save} disabled={submitting} className="h-9 px-5 rounded-full bg-slate-900 text-white text-sm disabled:opacity-50">
                            {submitting ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                    </>
                ) : (
                    <>
                        {canEdit && (
                            <button onClick={() => setEditing(true)} className="h-9 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-sm">
                                Modifier
                            </button>
                        )}
                        {canSend && (
                            <button onClick={() => setSendOpen(true)} disabled={submitting} className="h-9 px-4 rounded-full bg-slate-900 text-white text-sm">
                                Envoyer
                            </button>
                        )}
                        {canPay && (
                            <button onClick={() => setPaiementOpen(true)} disabled={submitting} className="h-9 px-4 rounded-full bg-emerald-600 text-white text-sm">
                                Enregistrer paiement
                            </button>
                        )}
                        <div className="relative">
                            <button
                                onClick={() => setMoreMenuOpen((v) => !v)}
                                disabled={submitting}
                                className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-50"
                                aria-label="Plus d'actions"
                            >
                                <FluentMoreHorizontal32Regular className="w-4 h-4" />
                            </button>
                            {moreMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => {
                                            setMoreMenuOpen(false);
                                            setStatutMenuOpen(false);
                                        }}
                                    />
                                    <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden py-1">
                                        <button
                                            onClick={() => {
                                                setMoreMenuOpen(false);
                                                handleDownloadPdf();
                                            }}
                                            disabled={pdfBusy}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            {pdfBusy ? 'Génération…' : 'Télécharger PDF'}
                                        </button>
                                        {canChangeStatut && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setStatutMenuOpen((v) => !v)}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                                                >
                                                    <span>Changer de statut</span>
                                                    <span className="text-xs text-slate-400">›</span>
                                                </button>
                                                {statutMenuOpen && (
                                                    <div className="px-2 pb-2 space-y-1 bg-slate-50/60 border-t border-slate-100">
                                                        {STATUT_OPTIONS.filter((s) => s !== current.statut).map((s) => (
                                                            <button
                                                                key={s}
                                                                onClick={async () => {
                                                                    setStatutMenuOpen(false);
                                                                    setMoreMenuOpen(false);
                                                                    await setStatut(s);
                                                                }}
                                                                className="w-full px-2 py-1.5 text-left text-sm hover:bg-white rounded-lg flex items-center gap-2"
                                                            >
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColorFacture(s)}`}>
                                                                    {statutLabelFacture(s)}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {can('factures:delete') && (
                                            <>
                                                <div className="my-1 h-px bg-slate-100" />
                                                <button
                                                    onClick={() => {
                                                        setMoreMenuOpen(false);
                                                        handleDelete();
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    Supprimer
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
                {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

                {enRetard && (
                    <div className="mb-4 w-[80%] mx-auto px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">!</div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-amber-900">
                                Échéance dépassée de {joursRetard} jour{joursRetard > 1 ? 's' : ''}
                            </div>
                            <div className="text-xs text-amber-700">
                                Reste à payer : <span className="font-medium">{formatFCFA(current.montantRestant ?? 0)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {!editing && (
                    <div className="mb-4 max-w-270 mx-auto bg-white rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Client</div>
                                {client ? (
                                    <>
                                        <div className="mt-1 flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/clients/${client.id}`)}
                                                className="text-sm font-semibold text-slate-900 hover:underline truncate"
                                            >
                                                {client.type === 'entreprise'
                                                    ? (client.raisonSociale || client.nom)
                                                    : `${client.nom}${client.prenom ? ' ' + client.prenom : ''}`}
                                            </button>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                {client.type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                                            {client.telephone && <span> {client.telephone}</span>}
                                            {client.email && <span>{client.email}</span>}
                                            {(client.adresse?.ville || client.adresse?.quartier) && (
                                                <span>📍 {[client.adresse?.quartier, client.adresse?.ville].filter(Boolean).join(', ')}</span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="mt-1 text-sm text-gray-400">Client introuvable</div>
                                )}
                            </div>
                            {sourceDevis && (
                                <button
                                    onClick={() => navigate(`/devis/${sourceDevis.id}`)}
                                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap"
                                >
                                    ← Issu du devis {sourceDevis.numero}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="mb-4 grid grid-cols-3 gap-3 max-w-270 mx-auto">
                    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="text-xs text-gray-500">Total</div>
                        <div className="text-base font-semibold mt-0.5">{formatFCFA(total)}</div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="text-xs text-gray-500">Payé</div>
                        <div className="text-base font-semibold mt-0.5 text-emerald-700">
                            {formatFCFA(current.montantPayé ?? 0)}
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                        <div className="text-xs text-gray-500">Restant</div>
                        <div className={`text-base font-semibold mt-0.5 ${current.montantRestant > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {formatFCFA(current.montantRestant ?? 0)}
                        </div>
                    </div>
                </div>

                {!editing && (current.notes || current.conditionsPaiement) && (
                    <div className="mb-4 max-w-270 mx-auto bg-white rounded-2xl border border-slate-200 p-5">
                        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-3">Informations</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {current.conditionsPaiement && (
                                <div>
                                    <div className="text-xs font-semibold text-slate-700 mb-1">Conditions de paiement</div>
                                    <div className="text-sm text-slate-600 whitespace-pre-wrap">{current.conditionsPaiement}</div>
                                </div>
                            )}
                            {current.notes && (
                                <div>
                                    <div className="text-xs font-semibold text-slate-700 mb-1">Notes</div>
                                    <div className="text-sm text-slate-600 whitespace-pre-wrap">{current.notes}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <FactureForm
                    value={value}
                    onChange={setValue}
                    clients={clients}
                    articles={articles}
                    readOnly={!editing}
                    lockClient
                />

                {!editing && paiements.length > 0 && (() => {
                    const sortedAsc = [...paiements].sort((a, b) => (a.date < b.date ? -1 : 1));
                    let running = 0;
                    const withBalance = sortedAsc.map((p) => {
                        running += p.montant || 0;
                        return { p, soldeApres: Math.max(0, total - running) };
                    }).reverse();
                    const adminName = (uid: string) => {
                        const u = administrateurs.find((a) => a.id === uid);
                        if (!u) return uid ? '—' : '';
                        return [u.prenom, u.nom].filter(Boolean).join(' ') || u.email || '—';
                    };
                    return (
                        <div className="mt-6 bg-white rounded-2xl border border-slate-200 overflow-hidden max-w-270 mx-auto">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div className="text-sm font-semibold">Historique des paiements ({paiements.length})</div>
                                <div className="text-xs text-gray-500">
                                    Total versé : <span className="font-medium text-emerald-700">{formatFCFA(current.montantPayé ?? 0)}</span>
                                    <span className="mx-2 text-slate-300">·</span>
                                    Reste : <span className={`font-medium ${current.montantRestant > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatFCFA(current.montantRestant ?? 0)}</span>
                                </div>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {withBalance.map(({ p, soldeApres }, idx) => (
                                    <li key={p.id} className="px-4 py-3 text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold">
                                                {withBalance.length - idx}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                {modeLabel(p.mode)}
                                            </span>
                                            <span className="text-gray-600">{formatDate(p.date)}</span>
                                            {p.reference && (
                                                <span className="text-xs text-gray-400 truncate">Réf. {p.reference}</span>
                                            )}
                                            <span className="flex-1" />
                                            <span className="font-medium text-emerald-700">
                                                + {formatFCFA(p.montant)}
                                            </span>
                                            <button
                                                onClick={() => handleDownloadRecu(p)}
                                                className="text-[10px] px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"
                                                title="Télécharger le reçu de paiement"
                                            >
                                                Reçu PDF
                                            </button>
                                        </div>
                                        <div className="mt-1 ml-9 flex items-center gap-3 text-xs text-gray-500">
                                            {p.enregistréPar && (
                                                <span>Par <span className="text-slate-700">{adminName(p.enregistréPar)}</span></span>
                                            )}
                                            <span className="flex-1" />
                                            <span>
                                                Solde après : <span className={`font-medium ${soldeApres > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatFCFA(soldeApres)}</span>
                                            </span>
                                        </div>
                                        {p.notes && (
                                            <div className="mt-1 ml-9 text-xs text-gray-600 italic">{p.notes}</div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })()}
            </div>

            {paiementOpen && (
                <PaiementModal
                    factureNumero={current.numero}
                    montantRestant={current.montantRestant ?? 0}
                    onClose={() => setPaiementOpen(false)}
                    onConfirm={handleRegisterPaiement}
                />
            )}

            {sendOpen && (
                <FactureSendModal
                    facture={current}
                    client={client}
                    onClose={() => setSendOpen(false)}
                    onMarkEmise={isBrouillon ? async () => { await setStatut('émise'); } : undefined}
                />
            )}
        </div>
    );
}
