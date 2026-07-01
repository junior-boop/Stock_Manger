import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { Devis, StatutDevis } from '../Databases/db.d';
import DevisForm, { DevisFormValue, computeTotaux } from '../components/devis_form';
import { fromDateInput } from '../libs/format';
import { useAlerts } from '../components/alerts';

function nextNumero(existing: Devis[]): string {
    const year = new Date().getFullYear();
    const prefix = `DEV-${year}-`;
    const yearMax = existing
        .map((d) => d.numero)
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

export default function DevisNewPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const presetClientId = params.get('clientId') ?? '';
    const { clients, articles, devis, createDevis } = useDatabase();
    const { user } = useAuth();
    const { success, error: notifyError } = useAlerts();

    const [value, setValue] = useState<DevisFormValue>({
        clientId: presetClientId,
        dateEmission: todayInput(),
        dateValidite: plusDaysInput(30),
        lignes: [],
        groupes: [],
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
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const numero = useMemo(() => nextNumero(devis), [devis]);

    const handleSave = async (statut: StatutDevis, openSend = false) => {
        setError(null);
        if (!value.clientId) return setError('Sélectionne un client.');
        if (value.lignes.length === 0) return setError('Ajoute au moins une ligne.');

        const totaux = computeTotaux(value);
        const notes = value.notes.trim();
        const cp = value.conditionsPaiement.trim();
        const payload: Partial<Devis> = {
            numero,
            clientId: value.clientId,
            lignes: value.lignes,
            groupes: value.groupes,
            totalHT: totaux.totalHT,
            totalTVA: totaux.totalTVA,
            totalTTC: totaux.totalTTC,
            remiseGlobale: value.remiseGlobale,
            totalApreRemise: totaux.totalApreRemise,
            afficherTVA: value.afficherTVA,
            afficherTVALignes: value.afficherTVALignes,
            statut,
            dateEmission: fromDateInput(value.dateEmission),
            dateValidite: fromDateInput(value.dateValidite),
            createdBy: user?.id ?? '',
            ...(notes ? { notes } : {}),
            ...(cp ? { conditionsPaiement: cp } : {}),
        };

        setSubmitting(true);
        try {
            const created = await createDevis(payload);
            if (created) {
                success(statut === 'envoyé' ? 'Devis envoyé' : 'Brouillon enregistré', created.numero);
                navigate(`/devis/${created.id}${openSend ? '?send=1' : ''}`);
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
                    <h2 className="text-base font-semibold">Nouveau devis</h2>
                    <div className="text-xs text-gray-500">{numero}</div>
                </div>
                <div className="flex-1" />
                <button
                    onClick={() => navigate('/devis')}
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
                    onClick={() => handleSave('brouillon', true)}
                    disabled={submitting}
                    className="h-9 px-5 rounded-full bg-slate-900 text-white text-sm disabled:opacity-50"
                >
                    Créer et envoyer
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
                {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
                <DevisForm value={value} onChange={setValue} clients={clients} articles={articles} />
            </div>
        </div>
    );
}
