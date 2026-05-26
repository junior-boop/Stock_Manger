import { useState } from 'react';
import { ModePaiement } from '../Databases/db.d';
import { formatFCFA } from '../libs/format';

export type PaiementInput = {
    montant: number;
    mode: ModePaiement;
    date: string;
    reference?: string;
    notes?: string;
};

type Props = {
    factureNumero: string;
    montantRestant: number;
    onClose: () => void;
    onConfirm: (paiement: PaiementInput) => Promise<void> | void;
};

const MODES: { value: ModePaiement; label: string }[] = [
    { value: 'espèces', label: 'Espèces' },
    { value: 'virement', label: 'Virement' },
    { value: 'chèque', label: 'Chèque' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'carte_bancaire', label: 'Carte bancaire' },
    { value: 'autre', label: 'Autre' },
];

function todayInput(): string {
    return new Date().toISOString().slice(0, 10);
}

export default function PaiementModal({ factureNumero, montantRestant, onClose, onConfirm }: Props) {
    const [montant, setMontant] = useState<number>(montantRestant);
    const [mode, setMode] = useState<ModePaiement>('virement');
    const [date, setDate] = useState<string>(todayInput());
    const [reference, setReference] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        setErr(null);
        if (!Number.isFinite(montant) || montant <= 0) {
            setErr('Le montant doit être supérieur à 0.');
            return;
        }
        if (montant > montantRestant) {
            setErr(`Le montant ne peut pas dépasser ${formatFCFA(montantRestant)}.`);
            return;
        }
        setBusy(true);
        try {
            await onConfirm({
                montant,
                mode,
                date,
                ...(reference.trim() ? { reference: reference.trim() } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            });
        } catch (e: any) {
            setErr(e?.message ?? 'Erreur.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {factureNumero} · Reste à payer {formatFCFA(montantRestant)}
                    </p>
                </div>

                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Montant</label>
                        <input
                            type="number"
                            min={0}
                            max={montantRestant}
                            value={montant || ''}
                            onChange={(e) => setMontant(parseInt(e.target.value, 10) || 0)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                            placeholder="0"
                        />
                        {montant > 0 && montant < montantRestant && (
                            <div className="text-[11px] text-gray-500 mt-1">
                                Restera : {formatFCFA(Math.max(0, montantRestant - montant))}
                            </div>
                        )}
                        {montant > 0 && montant >= montantRestant && (
                            <div className="text-[11px] text-emerald-600 mt-1">
                                La facture sera marquée comme payée.
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Mode</label>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value as ModePaiement)}
                                className="w-full h-10 px-2 rounded-xl border border-slate-200 text-sm"
                            >
                                {MODES.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Référence (optionnel)</label>
                        <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                            placeholder="N° transaction, chèque…"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Notes (optionnel)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none"
                        />
                    </div>

                    {err && (
                        <div className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs">{err}</div>
                    )}
                </div>

                <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="h-9 px-4 rounded-full text-sm hover:bg-slate-100 disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className="h-9 px-5 rounded-full bg-slate-900 text-white text-sm disabled:opacity-50"
                    >
                        {busy ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
