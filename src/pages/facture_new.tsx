import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { Facture, LigneDocument, ModePaiement, Paiement, StatutFacture } from '../Databases/db.d';
import FactureForm, { FactureFormValue, computeTotaux } from '../components/facture_form';
import { formatDate, formatFCFA, fromDateInput } from '../libs/format';
import { useAlerts } from '../components/alerts';
import { v4 as uuidv4 } from 'uuid';

const MODES: { value: ModePaiement; label: string }[] = [
    { value: 'espèces', label: 'Espèces' },
    { value: 'virement', label: 'Virement' },
    { value: 'chèque', label: 'Chèque' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'carte_bancaire', label: 'Carte bancaire' },
    { value: 'autre', label: 'Autre' },
];

function nextNumero(existing: Facture[]): string {
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

function todayInput(): string {
    return new Date().toISOString().slice(0, 10);
}

function plusDaysInput(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export default function FactureNewPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const presetClientId = params.get('clientId') ?? '';
    const presetDevisId = params.get('devisId') ?? '';
    const { clients, articles, factures, devis, createFacture, updateDevis } = useDatabase();
    const { user } = useAuth();
    const { success, error: notifyError } = useAlerts();

    const [linkedDevisId, setLinkedDevisId] = useState<string>(presetDevisId);
    const [value, setValue] = useState<FactureFormValue>({
        clientId: presetClientId,
        dateEmission: todayInput(),
        dateEcheance: plusDaysInput(30),
        lignes: [],
        remiseGlobale: 0,
        notes: '',
        conditionsPaiement: '',
        afficherTVA: true,
    });

    useEffect(() => {
        window.companyApi.get().then((info) => {
            if (typeof info?.afficherTVA === 'boolean') {
                setValue((v) => ({ ...v, afficherTVA: info.afficherTVA }));
            }
        }).catch(() => {});
    }, []);

    const linkedDevis = useMemo(() => devis.find((d) => d.id === linkedDevisId), [devis, linkedDevisId]);
    const eligibleDevis = useMemo(
        () => devis
            .filter((d) => !d.factureId || d.id === linkedDevisId)
            .filter((d) => !value.clientId || d.clientId === value.clientId || d.id === linkedDevisId)
            .sort((a, b) => (b.dateEmission ?? '').localeCompare(a.dateEmission ?? '')),
        [devis, value.clientId, linkedDevisId],
    );

    useEffect(() => {
        if (!linkedDevis) return;
        const stripped: LigneDocument[] = linkedDevis.lignes.map((l) => {
            const { groupeId: _g, sousGroupeId: _sg, ...rest } = l;
            return { ...rest, id: crypto.randomUUID() };
        });
        setValue((v) => ({
            ...v,
            clientId: linkedDevis.clientId,
            lignes: stripped,
            remiseGlobale: linkedDevis.remiseGlobale ?? 0,
            notes: linkedDevis.notes ?? v.notes,
            conditionsPaiement: linkedDevis.conditionsPaiement ?? v.conditionsPaiement,
            afficherTVA: linkedDevis.afficherTVA !== false,
            afficherTVALignes: linkedDevis.afficherTVALignes !== false,
        }));
    }, [linkedDevisId]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [montantDepose, setMontantDepose] = useState<number>(0);
    const [modeDepose, setModeDepose] = useState<ModePaiement>('espèces');
    const [referenceDepose, setReferenceDepose] = useState<string>('');

    const numero = useMemo(() => nextNumero(factures), [factures]);
    const totauxPreview = useMemo(() => computeTotaux(value), [value]);
    const depose = Math.max(0, Math.min(montantDepose || 0, totauxPreview.totalApreRemise));
    const restant = Math.max(0, totauxPreview.totalApreRemise - depose);

    const handleSave = async (statut: StatutFacture) => {
        setError(null);
        if (!value.clientId) return setError('Sélectionne un client.');
        if (value.lignes.length === 0) return setError('Ajoute au moins une ligne.');

        const totaux = computeTotaux(value);
        const notes = value.notes.trim();
        const cp = value.conditionsPaiement.trim();
        const totalApreRemise = totaux.totalApreRemise;
        const acompte = Math.max(0, Math.min(montantDepose || 0, totalApreRemise));
        const paiements: Paiement[] = acompte > 0 ? [{
            id: uuidv4(),
            date: new Date().toISOString(),
            montant: acompte,
            mode: modeDepose,
            enregistréPar: user?.id ?? '',
            ...(referenceDepose.trim() ? { reference: referenceDepose.trim() } : {}),
        }] : [];
        const montantPayé = acompte;
        const montantRestant = Math.max(0, totalApreRemise - acompte);
        let finalStatut: StatutFacture = statut;
        if (statut === 'émise' && montantPayé > 0) {
            finalStatut = montantRestant === 0 ? 'payée' : 'partiellement_payée';
        }
        const payload: Partial<Facture> = {
            numero,
            clientId: value.clientId,
            ...(linkedDevisId ? { devisId: linkedDevisId } : {}),
            lignes: value.lignes,
            totalHT: totaux.totalHT,
            totalTVA: totaux.totalTVA,
            totalTTC: totaux.totalTTC,
            remiseGlobale: value.remiseGlobale,
            totalApreRemise,
            afficherTVA: value.afficherTVA,
            afficherTVALignes: value.afficherTVALignes,
            montantPayé,
            montantRestant,
            paiements,
            statut: finalStatut,
            dateEmission: fromDateInput(value.dateEmission),
            dateEcheance: fromDateInput(value.dateEcheance),
            createdBy: user?.id ?? '',
            ...(montantRestant === 0 && montantPayé > 0 ? { datePaiementComplet: new Date().toISOString() } : {}),
            ...(notes ? { notes } : {}),
            ...(cp ? { conditionsPaiement: cp } : {}),
        };

        setSubmitting(true);
        try {
            const created = await createFacture(payload);
            if (created) {
                if (linkedDevisId) {
                    try {
                        await updateDevis(linkedDevisId, {
                            factureId: created.id,
                            ...(linkedDevis && linkedDevis.statut !== 'accepté'
                                ? { statut: 'accepté', dateAcceptation: new Date().toISOString() }
                                : {}),
                        });
                    } catch { /* lien best-effort */ }
                }
                success(statut === 'émise' ? 'Facture émise' : 'Brouillon enregistré', created.numero);
                navigate(`/factures/${created.id}`);
            }
        } catch (err: any) {
            const msg = err?.message ?? 'Erreur lors de la création.';
            setError(msg);
            notifyError('Création impossible', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center gap-3">
                <div>
                    <h2 className="text-base font-semibold">Nouvelle facture</h2>
                    <div className="text-xs text-gray-500">{numero}</div>
                </div>
                <div className="flex-1" />
                <button
                    onClick={() => navigate('/factures')}
                    className="h-9 px-4 rounded-full text-sm hover:bg-slate-100"
                >
                    Annuler
                </button>
                <button
                    onClick={() => handleSave('brouillon')}
                    disabled={submitting}
                    className="h-9 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-sm disabled:opacity-50"
                >
                    {submitting ? 'Enregistrement…' : 'Enregistrer brouillon'}
                </button>
                <button
                    onClick={() => handleSave('émise')}
                    disabled={submitting}
                    className="h-9 px-5 rounded-full bg-slate-900 text-white text-sm disabled:opacity-50"
                >
                    Émettre la facture
                </button>
            </div>

            <div data-os-scroll className="flex-1 overflow-y-auto px-6 py-6">
                {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

                <div className="mx-auto max-w-270 mb-4 bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs uppercase text-gray-400 font-medium">Lier à un devis existant</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                                Les lignes du devis seront pré-remplies. Tu peux ensuite ajouter d'autres articles.
                            </div>
                        </div>
                        {linkedDevis && (
                            <button
                                type="button"
                                onClick={() => { setLinkedDevisId(''); setValue((v) => ({ ...v, lignes: [] })); }}
                                className="h-8 px-3 rounded-full text-xs bg-slate-100 hover:bg-slate-200"
                            >
                                Délier
                            </button>
                        )}
                    </div>
                    <div className="mt-3">
                        <select
                            value={linkedDevisId}
                            onChange={(e) => setLinkedDevisId(e.target.value)}
                            className="w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                        >
                            <option value="">— Aucun devis lié —</option>
                            {eligibleDevis.map((d) => {
                                const c = clients.find((cl) => cl.id === d.clientId);
                                const name = c ? (c.type === 'entreprise' ? (c.raisonSociale || c.nom) : [c.prenom, c.nom].filter(Boolean).join(' ')) : '—';
                                return (
                                    <option key={d.id} value={d.id}>
                                        {d.numero} · {name} · {formatDate(d.dateEmission)} · {formatFCFA(d.totalApreRemise ?? d.totalTTC ?? 0)}
                                    </option>
                                );
                            })}
                        </select>
                        {linkedDevis && (
                            <div className="mt-2 text-xs text-emerald-700">
                                ✓ Devis {linkedDevis.numero} — {linkedDevis.lignes.length} ligne{linkedDevis.lignes.length > 1 ? 's' : ''} importée{linkedDevis.lignes.length > 1 ? 's' : ''}. Le client est verrouillé.
                            </div>
                        )}
                    </div>
                </div>

                <FactureForm value={value} onChange={setValue} clients={clients} articles={articles} lockClient={!!linkedDevisId} />

                <div className="mx-auto max-w-270 mt-6 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs uppercase text-gray-400 font-medium">Acompte / Montant déjà versé</div>
                        <div className="text-xs text-gray-500">Net à payer : <span className="font-medium text-slate-700">{formatFCFA(totauxPreview.totalApreRemise)}</span></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="block">
                            <span className="text-xs text-gray-500">Montant déposé</span>
                            <input
                                type="number"
                                min={0}
                                max={totauxPreview.totalApreRemise}
                                value={montantDepose}
                                onChange={(e) => setMontantDepose(Number(e.target.value) || 0)}
                                className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs text-gray-500">Mode</span>
                            <select
                                value={modeDepose}
                                onChange={(e) => setModeDepose(e.target.value as ModePaiement)}
                                className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                            >
                                {MODES.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
                            <span className="text-xs text-gray-500">Référence (optionnel)</span>
                            <input
                                type="text"
                                value={referenceDepose}
                                onChange={(e) => setReferenceDepose(e.target.value)}
                                className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                            />
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Montant déposé</span>
                            <span className="font-medium text-emerald-700">{formatFCFA(depose)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Reste à payer</span>
                            <span className={`font-semibold ${restant > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{formatFCFA(restant)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
