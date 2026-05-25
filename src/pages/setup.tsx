import { useState } from 'react';
import { useAuth } from '../auth/authProvider';
import logo from '../assets/Kataleya.png';

export default function SetupPage() {
    const { setup, error } = useAuth();
    const [form, setForm] = useState({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        motDePasse: '',
        confirm: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (!form.nom || !form.prenom || !form.email || !form.motDePasse) {
            setLocalError('Tous les champs marqués sont requis');
            return;
        }
        if (form.motDePasse.length < 6) {
            setLocalError('Le mot de passe doit faire au moins 6 caractères');
            return;
        }
        if (form.motDePasse !== form.confirm) {
            setLocalError('Les mots de passe ne correspondent pas');
            return;
        }

        setSubmitting(true);
        await setup({
            nom: form.nom,
            prenom: form.prenom,
            email: form.email,
            telephone: form.telephone || undefined,
            motDePasse: form.motDePasse,
        });
        setSubmitting(false);
    };

    return (
        <div className="flex items-center justify-center min-h-dvh w-full bg-slate-50 p-6">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-[520px] bg-white rounded-2xl shadow-sm p-8 flex flex-col gap-4"
            >
                <div className="flex items-center justify-center mb-2">
                    <img src={logo} alt="Kataleya" className="h-16 object-contain" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">Configuration initiale</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Créez le compte super administrateur pour démarrer Kataleya.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom *" value={form.prenom} onChange={update('prenom')} />
                    <Field label="Nom *" value={form.nom} onChange={update('nom')} />
                </div>
                <Field label="Email *" type="email" value={form.email} onChange={update('email')} />
                <Field label="Téléphone" value={form.telephone} onChange={update('telephone')} />
                <Field
                    label="Mot de passe *"
                    type="password"
                    value={form.motDePasse}
                    onChange={update('motDePasse')}
                />
                <Field
                    label="Confirmer le mot de passe *"
                    type="password"
                    value={form.confirm}
                    onChange={update('confirm')}
                />

                {(localError || error) && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {localError || error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 h-12 bg-slate-800 text-white rounded-full font-medium disabled:opacity-50"
                >
                    {submitting ? 'Création…' : 'Créer le compte'}
                </button>
            </form>
        </div>
    );
}

function Field({
    label,
    type = 'text',
    value,
    onChange,
}: {
    label: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">{label}</span>
            <input
                type={type}
                value={value}
                onChange={onChange}
                className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-slate-400"
            />
        </label>
    );
}
