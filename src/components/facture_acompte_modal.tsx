import { useState } from 'react';
import { Devis, ModePaiement } from '../Databases/db.d';
import { formatFCFA } from '../libs/format';

export type AcompteResult = {
    montant: number;
    mode: ModePaiement;
    date: string;
    reference?: string;
} | null;

type Props = {
    devis: Devis;
    onClose: () => void;
    onConfirm: (acompte: AcompteResult) => Promise<void> | void;
};

const MODES: ModePaiement[] = ['espèces', 'virement', 'chèque', 'mobile_money', 'carte_bancaire', 'autre'];

function todayInput(): string {
    return new Date().toISOString().slice(0, 10);
}

export default function FactureAcompteModal({ devis, onClose, onConfirm }: Props) {
    const total = devis.totalApreRemise ?? devis.totalTTC ?? 0;
    const [withAcompte, setWithAcompte] = useState(false);
    const [montant, setMontant] = useState<number>(0);
    const [mode, setMode] = useState<ModePaiement>('virement');
    const [date, setDate] = useState<string>(todayInput());
    const [reference, setReference] = useState<string>('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async (acompte: AcompteResult) => {
        setErr(null);
        if (acompte) {
            if (!Number.isFinite(acompte.montant) || acompte.montant <= 0) {
                setErr('Le montant de l\'acompte doit être supérieur à 0.');
                return;
            }
            if (acompte.montant > total) {
                setErr(`L'acompte ne peut pas dépasser ${formatFCFA(total)}.`);
                return;
            }
        }
        setBusy(true);
        try {
            await onConfirm(acompte);
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
                    <h2 className="text-lg font-semibold">Convertir en facture</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {devis.numero} · Total {formatFCFA(total)}
                    </p>
                </div>

                <div className="p-4 space-y-3">
                    <label className="flex items-start gap-3 px-3 py-2 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                        <input
                            type="checkbox"
                            checked={withAcompte}
                            onChange={(e) => setWithAcompte(e.target.checked)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <div className="text-sm font-medium">Enregistrer un acompte</div>
                            <div className="text-xs text-gray-500">Premier paiement déjà reçu lors de l'acceptation.</div>
                        </div>
                    </label>

                    {withAcompte && (
                        <div className="space-y-3 px-1">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Montant</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={total}
                                    value={montant || ''}
                                    onChange={(e) => setMontant(parseInt(e.target.value, 10) || 0)}
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm"
                                    placeholder="0"
                                />
                                {montant > 0 && (
                                    <div className="text-[11px] text-gray-500 mt-1">
                                        Reste à payer : {formatFCFA(Math.max(0, total - montant))}
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
                                            <option key={m} value={m}>{m}</option>
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
                        </div>
                    )}

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
                        onClick={() =>
                            submit(
                                withAcompte
                                    ? {
                                        montant,
                                        mode,
                                        date,
                                        ...(reference.trim() ? { reference: reference.trim() } : {}),
                                    }
                                    : null
                            )
                        }
                        disabled={busy}
                        className="h-9 px-5 rounded-full bg-slate-900 text-white text-sm disabled:opacity-50"
                    >
                        {busy ? 'Conversion…' : 'Convertir'}
                    </button>
                </div>
            </div>
        </div>
    );
}
