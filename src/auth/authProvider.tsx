import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

export type SessionUser = {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    role: 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur';
    avatar?: string;
    statut: 'actif' | 'inactif';
    createdAt: string;
    updatedAt: string;
    derniereConnexion?: string;
};

type AuthContextType = {
    user: SessionUser | null;
    isSetupDone: boolean | null;
    isLoading: boolean;
    error: string | null;
    setup: (data: {
        nom: string;
        prenom: string;
        email: string;
        telephone?: string;
        motDePasse: string;
    }) => Promise<boolean>;
    login: (email: string, motDePasse: string) => Promise<boolean>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [isSetupDone, setIsSetupDone] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const clearError = useCallback(() => setError(null), []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const done = await window.auth.isSetupDone();
            setIsSetupDone(done);
            if (done) {
                const me = await window.auth.me();
                setUser(me);
            } else {
                setUser(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const setup = useCallback(
        async (data: {
            nom: string;
            prenom: string;
            email: string;
            telephone?: string;
            motDePasse: string;
        }) => {
            setError(null);
            const res = await window.auth.setup(data);
            if (!res.ok) {
                setError(res.error ?? 'Erreur lors de la configuration');
                return false;
            }
            setUser(res.user ?? null);
            setIsSetupDone(true);
            return true;
        },
        [],
    );

    const login = useCallback(async (email: string, motDePasse: string) => {
        setError(null);
        const res = await window.auth.login(email, motDePasse);
        if (!res.ok) {
            setError(res.error ?? 'Identifiants invalides');
            return false;
        }
        setUser(res.user ?? null);
        return true;
    }, []);

    const logout = useCallback(async () => {
        await window.auth.logout();
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, isSetupDone, isLoading, error, setup, login, logout, refresh, clearError }),
        [user, isSetupDone, isLoading, error, setup, login, logout, refresh, clearError],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

const ROLE_MATRIX: Record<string, Array<SessionUser['role']>> = {
    'admins:manage': ['super_admin'],
    'parametres:edit': ['super_admin', 'admin'],
    'articles:write': ['super_admin', 'admin', 'gestionnaire'],
    'articles:delete': ['super_admin', 'admin'],
    'collections:write': ['super_admin', 'admin', 'gestionnaire'],
    'collections:delete': ['super_admin', 'admin'],
    'clients:write': ['super_admin', 'admin', 'gestionnaire', 'vendeur'],
    'clients:delete': ['super_admin', 'admin'],
    'devis:create': ['super_admin', 'admin', 'gestionnaire', 'vendeur'],
    'devis:modify': ['super_admin', 'admin'],
    'devis:delete': ['super_admin', 'admin'],
    'factures:create': ['super_admin', 'admin', 'gestionnaire'],
    'factures:modify': ['super_admin', 'admin'],
    'factures:delete': ['super_admin', 'admin'],
    'paiements:write': ['super_admin', 'admin', 'gestionnaire'],
    'journal:read': ['super_admin', 'admin'],
    'demandes:create': ['gestionnaire', 'vendeur'],
    'demandes:validate': ['super_admin', 'admin'],
};

export function usePermissions() {
    const { user } = useAuth();
    const can = useCallback(
        (action: string) => {
            if (!user) return false;
            const allowed = ROLE_MATRIX[action];
            return !!allowed && allowed.includes(user.role);
        },
        [user],
    );
    return { can, role: user?.role ?? null };
}
