import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authProvider';
import logo from '../assets/Kataleya.png';
import { RiEyeFill, RiEyeOffFill } from '../libs/icons';

type Mode = 'choose' | 'solo' | 'link-server' | 'online-login';
type ServerReachability = 'idle' | 'checking' | 'ok' | 'fail';

export default function SetupPage({ onDone }: { onDone?: () => void }) {
    const { setup, linkDevice, setupOnline, error, clearError } = useAuth();
    const [mode, setMode] = useState<Mode>('choose');

    const goSolo = () => { clearError(); setMode('solo'); };
    const goServer = () => { clearError(); setMode('link-server'); };
    const goChoose = () => { clearError(); setMode('choose'); };
    const onLinked = () => { clearError(); setMode('online-login'); };

    if (mode === 'choose') return <ChoosePage onSolo={goSolo} onServer={goServer} />;
    if (mode === 'solo') return <SoloSetup setup={setup} error={error} onBack={goChoose} />;
    if (mode === 'link-server') return <LinkServer linkDevice={linkDevice} error={error} onBack={goChoose} onDone={onLinked} />;
    return <OnlineLogin setupOnline={setupOnline} error={error} onBack={() => setMode('link-server')} onDone={onDone} />;
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100dvh-36px)] w-full bg-slate-50 p-6">
            <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-sm p-8 flex flex-col gap-4">
                <div className="flex items-center justify-center mb-2">
                    <img src={logo} alt="Kataleya" className="h-16 object-contain" />
                </div>
                {children}
            </div>
        </div>
    );
}

function ChoosePage({ onSolo, onServer }: { onSolo: () => void; onServer: () => void }) {
    return (
        <Shell>
            <div>
                <h1 className="text-2xl font-semibold">Bienvenue sur Kataleya</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Comment souhaitez-vous démarrer ?
                </p>
            </div>
            <button
                onClick={onServer}
                className="text-left p-5 border border-slate-200 rounded-2xl hover:border-slate-400 transition"
            >
                <div className="font-medium">Connecter à un serveur</div>
                <div className="text-sm text-gray-500 mt-1">
                    Votre équipe utilise déjà Kataleya. Liez ce poste à votre serveur.
                </div>
            </button>
            <button
                onClick={onSolo}
                className="text-left p-5 border border-slate-200 rounded-2xl hover:border-slate-400 transition"
            >
                <div className="font-medium">Démarrer en local</div>
                <div className="text-sm text-gray-500 mt-1">
                    Créez un compte super administrateur sur ce poste uniquement.
                </div>
            </button>
        </Shell>
    );
}

function SoloSetup({
    setup,
    error,
    onBack,
}: {
    setup: ReturnType<typeof useAuth>['setup'];
    error: string | null;
    onBack: () => void;
}) {
    const [form, setForm] = useState({
        nom: '', prenom: '', email: '', telephone: '', motDePasse: '', confirm: '',
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
            ...(form.telephone ? { telephone: form.telephone } : {}),
            motDePasse: form.motDePasse,
        });
        setSubmitting(false);
    };

    return (
        <Shell>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Configuration locale</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Créez le compte super administrateur de ce poste.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom *" value={form.prenom} onChange={update('prenom')} />
                    <Field label="Nom *" value={form.nom} onChange={update('nom')} />
                </div>
                <Field label="Email *" type="email" value={form.email} onChange={update('email')} />
                <Field label="Téléphone" value={form.telephone} onChange={update('telephone')} />
                <Field label="Mot de passe *" type="password" value={form.motDePasse} onChange={update('motDePasse')} />
                <Field label="Confirmer le mot de passe *" type="password" value={form.confirm} onChange={update('confirm')} />
                {(localError || error) && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {localError || error}
                    </div>
                )}
                <div className="flex gap-3 mt-2">
                    <button type="button" onClick={onBack} className="flex-1 h-12 border border-slate-200 rounded-full font-medium">
                        Retour
                    </button>
                    <button type="submit" disabled={submitting} className="flex-1 h-12 bg-slate-800 text-white rounded-full font-medium disabled:opacity-50">
                        {submitting ? 'Création…' : 'Créer le compte'}
                    </button>
                </div>
            </form>
        </Shell>
    );
}

function LinkServer({
    linkDevice,
    error,
    onBack,
    onDone,
}: {
    linkDevice: ReturnType<typeof useAuth>['linkDevice'];
    error: string | null;
    onBack: () => void;
    onDone: () => void;
}) {
    const [serverUrl, setServerUrl] = useState('');
    const [email, setEmail] = useState('');
    const [motDePasse, setMotDePasse] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [reach, setReach] = useState<ServerReachability>('idle');

    useEffect(() => {
        const trimmed = serverUrl.trim().replace(/\/$/, '');
        if (!/^https?:\/\/\S+/i.test(trimmed)) {
            setReach('idle');
            return;
        }
        setReach('checking');
        const ctrl = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch(`${trimmed}/health`, { signal: ctrl.signal });
                setReach(res.ok ? 'ok' : 'fail');
            } catch {
                if (!ctrl.signal.aborted) setReach('fail');
            }
        }, 400);
        return () => {
            ctrl.abort();
            window.clearTimeout(timer);
        };
    }, [serverUrl]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        if (!serverUrl || !email || !motDePasse) {
            setLocalError('Tous les champs sont requis');
            return;
        }
        setSubmitting(true);
        const ok = await linkDevice(serverUrl, email, motDePasse);
        setSubmitting(false);
        if (ok) onDone();
    };

    return (
        <Shell>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Lier un serveur</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Le super administrateur autorise ce poste à se connecter au serveur de l'entreprise.
                    </p>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">URL du serveur *</span>
                        <ReachBadge state={reach} />
                    </div>
                    <input
                        type="text"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="https://kataleya.exemple.workers.dev"
                        className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-slate-400"
                    />
                </div>
                <Field label="Email super_admin *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Field label="Mot de passe super_admin *" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                {(localError || error) && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {localError || error}
                    </div>
                )}
                <div className="flex gap-3 mt-2">
                    <button type="button" onClick={onBack} className="flex-1 h-12 border border-slate-200 rounded-full font-medium">
                        Retour
                    </button>
                    <button type="submit" disabled={submitting || reach !== 'ok'} className="flex-1 h-12 bg-slate-800 text-white rounded-full font-medium disabled:opacity-50">
                        {submitting ? 'Liaison…' : 'Lier ce poste'}
                    </button>
                </div>
            </form>
        </Shell>
    );
}

function OnlineLogin({
    setupOnline,
    error,
    onBack,
    onDone
}: {
    setupOnline: ReturnType<typeof useAuth>['setupOnline'];
    error: string | null;
    onBack: () => void;
    onDone: () => void
}) {
    const [email, setEmail] = useState('');
    const [motDePasse, setMotDePasse] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !motDePasse) return;
        setSubmitting(true);
        const result = await setupOnline(email, motDePasse);
        if (result) onDone()
        setSubmitting(false);
    };

    return (
        <Shell>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Connexion utilisateur</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Identifiez-vous avec votre compte. Les prochaines connexions se feront hors-ligne.
                    </p>
                </div>
                <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Field label="Mot de passe" type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}
                <div className="flex gap-3 mt-2">
                    <button type="button" onClick={onBack} className="flex-1 h-12 border border-slate-200 rounded-full font-medium">
                        Retour
                    </button>
                    <button type="submit" disabled={submitting} className="flex-1 h-12 bg-slate-800 text-white rounded-full font-medium disabled:opacity-50">
                        {submitting ? 'Connexion…' : 'Se connecter'}
                    </button>
                </div>
            </form>
        </Shell>
    );
}

function ReachBadge({ state }: { state: ServerReachability }) {
    if (state === 'idle') return null;
    const cfg = {
        checking: { dot: 'bg-slate-400 animate-pulse', text: 'Vérification…', color: 'text-slate-500' },
        ok: { dot: 'bg-emerald-500', text: 'Serveur joignable', color: 'text-emerald-600' },
        fail: { dot: 'bg-red-500', text: 'Injoignable', color: 'text-red-600' },
    }[state];
    return (
        <span className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            {cfg.text}
        </span>
    );
}

function Field({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
}: {
    label: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
}) {
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';
    return (
        <label className="relative flex flex-col gap-1">
            <span className="text-sm text-gray-600">{label}</span>
            <input
                type={isPassword && visible ? 'text' : type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-slate-400"
            />
            {isPassword && (
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute bottom-1 right-1 h-9 aspect-square rounded-full hover:bg-blue-300 flex items-center justify-center"
                >
                    {visible ? <RiEyeOffFill className="h-6 w-6" /> : <RiEyeFill className="h-6 w-6" />}
                </button>
            )}
        </label>
    );
}
