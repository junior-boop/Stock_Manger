import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authProvider';
import logo from '../assets/Kataleya.png';
import { RiEyeFill, RiEyeOffFill } from '../libs/icons';

export default function LoginPage({ onDone }: { onDone: () => void }) {
    const { login, error, clearError } = useAuth();
    const [email, setEmail] = useState('');
    const [motDePasse, setMotDePasse] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isVisible, setIsVisible] = useState(false)




    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        if (!email || !motDePasse) return;
        setSubmitting(true);
        const result = await login(email, motDePasse);
        if (result) onDone()
        setSubmitting(false);
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-36px)] w-full bg-slate-50 p-6">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-105 bg-white rounded-2xl shadow-sm p-8 flex flex-col gap-4"
            >
                <div className="flex items-center justify-center mb-2">
                    <img src={logo} alt="Kataleya" className="h-16 object-contain" />
                </div>
                <h1 className="text-2xl font-semibold text-center">Connexion</h1>

                <label className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Email</span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-slate-400"
                    />
                </label>

                <label className="relative flex flex-col gap-1">
                    <span className="text-sm text-gray-600">Mot de passe</span>
                    <input
                        type={!isVisible ? "password" : "text"}
                        value={motDePasse}
                        onChange={(e) => setMotDePasse(e.target.value)}
                        className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-slate-400"
                    />
                    <button
                        type="button"
                        onClick={() => setIsVisible(!isVisible)}
                        className='absolute bottom-1 right-1 h-9 aspect-square rounded-full hover:bg-blue-300 flex items-center justify-center'>
                        {
                            !isVisible ? <RiEyeFill className='h-6 w-6' /> : <RiEyeOffFill className='h-6 w-6' />
                        }
                    </button>
                </label>

                {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 h-12 bg-slate-800 text-white rounded-full font-medium disabled:opacity-50"
                >
                    {submitting ? 'Connexion…' : 'Se connecter'}
                </button>
            </form>
        </div>
    );
}
