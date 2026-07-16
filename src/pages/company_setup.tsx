import { useRef, useState } from 'react';
import { useAlerts } from '../components/alerts';
import { SvgSpinners180Ring } from '../libs/icons';

export default function CompanySetupPage({ onDone }: { onDone: () => void }) {
    const { error: notifyError, success } = useAlerts();
    const [nom, setNom] = useState('');
    const [logoDataUrl, setLogoDataUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            notifyError('Logo trop volumineux', 'La taille doit être inférieure à 2 Mo.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setLogoDataUrl(String(reader.result ?? ''));
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!nom.trim()) {
            notifyError('Nom requis', 'Veuillez saisir le nom de l\'entreprise.');
            return;
        }
        setSaving(true);
        try {
            await window.db.entreprises.update({ nom: nom.trim(), logoDataUrl, setupDone: true });
            window.dispatchEvent(new Event('company:changed'));
            success('Bienvenue', `Espace ${nom.trim()} configuré.`);
            onDone();
        } catch {
            notifyError('Erreur', 'Impossible d\'enregistrer.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-dvh bg-linear-to-br from-slate-50 to-slate-100 p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-100 p-8 flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Configurez votre entreprise</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Ces informations apparaîtront sur vos devis et factures. Vous pourrez les modifier plus tard depuis les paramètres.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-600">Logo de l'entreprise</label>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-24 rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                            {logoDataUrl
                                ? <img src={logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                : <span className="text-[10px] text-slate-400">Aucun logo</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900"
                            >
                                {logoDataUrl ? 'Changer le logo' : 'Choisir un logo'}
                            </button>
                            {logoDataUrl && (
                                <button
                                    type="button"
                                    onClick={() => setLogoDataUrl('')}
                                    className="px-4 py-2 bg-white border border-slate-200 text-sm rounded-full hover:bg-slate-50"
                                >
                                    Retirer
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-600">Nom de l'entreprise *</label>
                    <input
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Ex : Kataleya SARL"
                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        autoFocus
                    />
                </div>

                <div className="flex gap-2 mt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-5 py-3 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <SvgSpinners180Ring className="h-5 w-5" /> : 'Continuer'}
                    </button>
                    <button
                        onClick={onDone}
                        disabled={saving}
                        className="px-5 py-3 bg-white border border-slate-200 text-sm rounded-full hover:bg-slate-50 disabled:opacity-50"
                    >
                        Plus tard
                    </button>
                </div>
            </div>
        </div>
    );
}
