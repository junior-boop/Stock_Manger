import { useState } from 'react';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { Client, TypeClient } from '../Databases/db.d';
import { useAlerts } from './alerts';

type Props = {
    client?: Client;
    initialName?: string;
    onClose: () => void;
    onSaved: (c: Client) => void;
};

export default function ClientFormModal({ client, initialName, onClose, onSaved }: Props) {
    const { createClient, updateClient } = useDatabase();
    const { user } = useAuth();
    const { success } = useAlerts();
    const [type, setType] = useState<TypeClient>(client?.type ?? 'particulier');
    const [nom, setNom] = useState(client?.nom ?? (initialName ?? ''));
    const [prenom, setPrenom] = useState(client?.prenom ?? '');
    const [raisonSociale, setRaisonSociale] = useState(client?.raisonSociale ?? '');
    const [email, setEmail] = useState(client?.email ?? '');
    const [telephone, setTelephone] = useState(client?.telephone ?? '');
    const [telephone2, setTelephone2] = useState(client?.telephone2 ?? '');
    const [rue, setRue] = useState(client?.adresse?.rue ?? '');
    const [ville, setVille] = useState(client?.adresse?.ville ?? '');
    const [quartier, setQuartier] = useState(client?.adresse?.quartier ?? '');
    const [pays, setPays] = useState(client?.adresse?.pays ?? 'Cameroun');
    const [codePostal, setCodePostal] = useState(client?.adresse?.codePostal ?? '');
    const [notes, setNotes] = useState(client?.notes ?? '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEdit = !!client;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (type === 'particulier' && !nom.trim()) return setError('Le nom est obligatoire.');
        if (type === 'entreprise' && !raisonSociale.trim() && !nom.trim()) return setError('La raison sociale est obligatoire.');
        if (!email.trim()) return setError('L\'email est obligatoire.');
        if (!telephone.trim()) return setError('Le téléphone est obligatoire.');

        const payload: Partial<Client> = {
            type,
            nom: nom.trim() || raisonSociale.trim(),
            prenom: prenom.trim() || undefined,
            raisonSociale: type === 'entreprise' ? raisonSociale.trim() || undefined : undefined,
            email: email.trim(),
            telephone: telephone.trim(),
            telephone2: telephone2.trim() || undefined,
            adresse: {
                rue: rue.trim(),
                ville: ville.trim(),
                quartier: quartier.trim() || undefined,
                pays: pays.trim(),
                codePostal: codePostal.trim() || undefined,
            },
            notes: notes.trim() || undefined,
            statut: client?.statut ?? 'actif',
            createdBy: client?.createdBy ?? user?.id ?? '',
        };

        setSubmitting(true);
        try {
            if (isEdit && client) {
                await updateClient(client.id, payload);
                success('Client mis à jour', payload.nom);
                onSaved({ ...client, ...payload } as Client);
            } else {
                const created = await createClient(payload);
                if (created) {
                    success('Client créé', created.nom);
                    onSaved(created);
                }
            }
        } catch (err: any) {
            setError(err?.message ?? 'Erreur lors de l\'enregistrement.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{isEdit ? 'Modifier le client' : 'Nouveau client'}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex bg-slate-100 rounded-full p-1 w-fit">
                        {(['particulier', 'entreprise'] as TypeClient[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`px-4 h-8 rounded-full text-sm ${type === t ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
                            >
                                {t === 'particulier' ? 'Particulier' : 'Entreprise'}
                            </button>
                        ))}
                    </div>

                    {type === 'entreprise' && (
                        <Field label="Raison sociale *" value={raisonSociale} onChange={setRaisonSociale} />
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Field label={type === 'entreprise' ? 'Nom contact' : 'Nom *'} value={nom} onChange={setNom} />
                        <Field label="Prénom" value={prenom} onChange={setPrenom} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Email *" type="email" value={email} onChange={setEmail} />
                        <Field label="Téléphone *" value={telephone} onChange={setTelephone} />
                    </div>

                    <Field label="Téléphone 2" value={telephone2} onChange={setTelephone2} />

                    <div className="pt-2 border-t border-slate-100" />
                    <div className="text-xs uppercase text-gray-400 font-medium">Adresse</div>

                    <Field label="Rue" value={rue} onChange={setRue} />
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Ville" value={ville} onChange={setVille} />
                        <Field label="Quartier" value={quartier} onChange={setQuartier} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Pays" value={pays} onChange={setPays} />
                        <Field label="Code postal" value={codePostal} onChange={setCodePostal} />
                    </div>

                    <div className="pt-2 border-t border-slate-100" />
                    <label className="block">
                        <span className="text-xs text-gray-500">Notes</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="mt-1 w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                        />
                    </label>

                    {error && <div className="text-sm text-red-600">{error}</div>}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-9 px-4 rounded-full text-sm hover:bg-slate-100">
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="h-9 px-5 rounded-full bg-slate-900 text-white text-sm disabled:opacity-50"
                    >
                        {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function Field({
    label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <label className="block">
            <span className="text-xs text-gray-500">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
            />
        </label>
    );
}
