import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { usePermissions } from '../auth/authProvider';
import { Devis, Facture, StatutDevis } from '../Databases/db.d';
import DevisForm, { DevisFormValue, computeTotaux } from '../components/devis_form';
import { fromDateInput, toDateInput, formatDate } from '../libs/format';
import { statutColor, statutLabel } from '../layouts/devis_layouts';
import { useAlerts } from '../components/alerts';
import { useAuth } from '../auth/authProvider';
import DevisSendModal from '../components/devis_send_modal';
import { buildDevisHTML } from '../libs/devis_pdf';
import { FluentMoreHorizontal32Regular } from '../libs/icons';

const STATUT_OPTIONS: StatutDevis[] = ['brouillon', 'envoyé', 'accepté', 'refusé', 'expiré', 'annulé'];

function nextFactureNumero(existing: Facture[]): string {
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;
    const yearMax = existing
        .map((f) => f.numero)
        .filter((n) => n?.startsWith(prefix))
        .map((n) => parseInt(n.slice(prefix.length), 10))
        .filter((n) => !Number.isNaN(n))
        .reduce((m, n) => Math.max(m, n), 0);
    return `${prefix}${String(yearMax + 1).padStart(4, '0')}`;
}

export default function DevisDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { devis, clients, articles, factures, updateDevis, deleteDevis, createFacture } = useDatabase();
    const { can } = usePermissions();
    const { user } = useAuth();
    const { confirm, success, error: notifyError } = useAlerts();

    const current = useMemo(() => devis.find((d) => d.id === id), [devis, id]);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState<DevisFormValue | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sendOpen, setSendOpen] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [statutMenuOpen, setStatutMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);

    useEffect(() => {
        if (current) {
            setValue({
                clientId: current.clientId,
                dateEmission: toDateInput(current.dateEmission),
                dateValidite: toDateInput(current.dateValidite),
                lignes: current.lignes,
                groupes: current.groupes ?? [],
                remiseGlobale: current.remiseGlobale ?? 0,
                notes: current.notes ?? '',
                conditionsPaiement: current.conditionsPaiement ?? '',
            });
            setEditing(false);
        }
    }, [current?.id]);

    useEffect(() => {
        if (current && searchParams.get('send') === '1') {
            setSendOpen(true);
            const next = new URLSearchParams(searchParams);
            next.delete('send');
            setSearchParams(next, { replace: true });
        }
    }, [current?.id, searchParams]);

    if (!current || !value) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">Devis introuvable.</div>
        );
    }

    const isBrouillon = current.statut === 'brouillon';
    const canEdit = can('devis:modify') || (isBrouillon && can('devis:create'));
    const canChangeStatut = can('devis:modify') || can('devis:create');

    const handleDownloadPdf = async () => {
        setPdfBusy(true);
        try {
            const client = clients.find((c) => c.id === current.clientId);
            const html = buildDevisHTML(current, client);
            const filePath = await window.pdf.generateDevis(html, current.numero);
            await window.shell.openPath(filePath);
            success('PDF généré', current.numero);
        } catch (err: any) {
            notifyError('Échec génération PDF', err?.message ?? 'Erreur.');
        } finally {
            setPdfBusy(false);
        }
    };

    const save = async () => {
        setError(null);
        if (!value.clientId) return setError('Client requis.');
        if (value.lignes.length === 0) return setError('Au moins une ligne requise.');
        const totaux = computeTotaux(value);
        const notes = value.notes.trim();
        const cp = value.conditionsPaiement.trim();
        const patch: Partial<Devis> = {
            clientId: value.clientId,
            lignes: value.lignes,
            groupes: value.groupes,
            totalHT: totaux.totalHT,
            totalTVA: totaux.totalTVA,
            totalTTC: totaux.totalTTC,
            remiseGlobale: value.remiseGlobale,
            totalApreRemise: totaux.totalApreRemise,
            dateEmission: fromDateInput(value.dateEmission),
            dateValidite: fromDateInput(value.dateValidite),
            ...(notes ? { notes } : {}),
            ...(cp ? { conditionsPaiement: cp } : {}),
        };
        setSubmitting(true);
        try {
            await updateDevis(current.id, patch);
            setEditing(false);
            success('Devis enregistré', current.numero);
        } catch (err: any) {
            const msg = err?.message ?? 'Erreur.';
            setError(msg);
            notifyError('Échec de l\'enregistrement', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const setStatut = async (statut: StatutDevis, extra: Partial<Devis> = {}) => {
        setSubmitting(true);
        try {
            await updateDevis(current.id, { statut, ...extra });
            success('Statut mis à jour', statut);
        } catch (err: any) {
            notifyError('Échec', err?.message ?? 'Erreur.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleConvertToFacture = async () => {
        if (current.factureId) return;
        const ok = await confirm({
            title: `Convertir ${current.numero} en facture ?`,
            message: 'Une nouvelle facture brouillon sera créée à partir de ce devis.',
            confirmLabel: 'Convertir',
            danger: false,
        });
        if (!ok) return;
        setSubmitting(true);
        try {
            const now = new Date();
            const echeance = new Date(now);
            echeance.setDate(echeance.getDate() + 30);
            const totalApreRemise = current.totalApreRemise ?? current.totalTTC ?? 0;
            const payload: Partial<Facture> = {
                numero: nextFactureNumero(factures),
                clientId: current.clientId,
                devisId: current.id,
                lignes: current.lignes,
                groupes: current.groupes ?? [],
                totalHT: current.totalHT,
                totalTVA: current.totalTVA,
                totalTTC: current.totalTTC,
                remiseGlobale: current.remiseGlobale ?? 0,
                totalApreRemise,
                montantPayé: 0,
                montantRestant: totalApreRemise,
                paiements: [],
                statut: 'brouillon',
                dateEmission: now.toISOString(),
                dateEcheance: echeance.toISOString(),
                createdBy: user?.id ?? '',
                ...(current.notes ? { notes: current.notes } : {}),
                ...(current.conditionsPaiement ? { conditionsPaiement: current.conditionsPaiement } : {}),
            };
            const created = await createFacture(payload);
            if (!created) throw new Error('Création de la facture impossible.');
            const patch: Partial<Devis> = { factureId: created.id };
            if (current.statut !== 'accepté') {
                patch.statut = 'accepté';
                patch.dateAcceptation = now.toISOString();
            }
            await updateDevis(current.id, patch);
            success('Facture créée', created.numero);
        } catch (err: any) {
            notifyError('Conversion impossible', err?.message ?? 'Erreur.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const ok = await confirm({
            title: `Supprimer le devis ${current.numero} ?`,
            message: 'Cette action est irréversible.',
            confirmLabel: 'Supprimer',
            danger: true,
        });
        if (!ok) return;
        try {
            await deleteDevis(current.id);
            success('Devis supprimé', current.numero);
            navigate('/devis');
        } catch (err: any) {
            notifyError('Suppression impossible', err?.message ?? 'Erreur.');
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">{current.numero}</h2>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColor(current.statut)}`}>
                            {statutLabel(current.statut)}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Émis le {formatDate(current.dateEmission)} · Valide jusqu'au {formatDate(current.dateValidite)}
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
                        {isBrouillon && (
                            <button onClick={() => setSendOpen(true)} disabled={submitting} className="h-9 px-4 rounded-full bg-blue-600 text-white text-sm">
                                Envoyer
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
                                        {can('factures:create') && !current.factureId && (
                                            <button
                                                onClick={() => {
                                                    setMoreMenuOpen(false);
                                                    handleConvertToFacture();
                                                }}
                                                disabled={submitting}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Convertir en facture
                                            </button>
                                        )}
                                        {current.factureId && (
                                            <div className="px-4 py-2 text-xs text-slate-400">
                                                Facture liée déjà créée
                                            </div>
                                        )}
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
                                                                    const extra: Partial<Devis> = s === 'accepté'
                                                                        ? { dateAcceptation: new Date().toISOString() }
                                                                        : {};
                                                                    await setStatut(s, extra);
                                                                }}
                                                                className="w-full px-2 py-1.5 text-left text-sm hover:bg-white rounded-lg flex items-center gap-2"
                                                            >
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statutColor(s)}`}>
                                                                    {statutLabel(s)}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {can('devis:delete') && (
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
                <DevisForm
                    value={value}
                    onChange={setValue}
                    clients={clients}
                    articles={articles}
                    readOnly={!editing}
                    lockClient
                />
            </div>

            {sendOpen && (
                <DevisSendModal
                    devis={current}
                    client={clients.find((c) => c.id === current.clientId)}
                    onClose={() => setSendOpen(false)}
                    onSent={async () => {
                        await updateDevis(current.id, { statut: 'envoyé' });
                    }}
                />
            )}
        </div>
    );
}
