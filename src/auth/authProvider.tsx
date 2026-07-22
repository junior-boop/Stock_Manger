import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { syncClient } from '../context/sync_client';

export type SessionUser = {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string;
    role: 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur' | 'demo';
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
    setupDemo: (data: { nom: string; prenom: string; motDePasse: string }) => Promise<boolean>;
    linkDevice: (serverUrl: string, email: string, motDePasse: string) => Promise<boolean>;
    setupOnline: (email: string, motDePasse: string) => Promise<boolean>;
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

    const setupDemo = useCallback(
        async (data: { nom: string; prenom: string; motDePasse: string }) => {
            setError(null);
            const res = await window.auth.setupDemo(data);
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

    const linkDevice = useCallback(
        async (serverUrl: string, email: string, motDePasse: string) => {
            setError(null);
            const res = await window.syncApi.linkDevice(serverUrl, email, motDePasse);
            if (!res.ok) {
                setError(res.error ?? 'Échec de liaison serveur');
                return false;
            }
            return true;
        },
        [],
    );

    const setupOnline = useCallback(async (email: string, motDePasse: string) => {
        setError(null);
        const res = await window.auth.setupOnline(email, motDePasse);
        if (!res.ok) {
            setError(res.error ?? 'Échec de connexion');
            return false;
        }
        setUser(res.user ?? null);
        setIsSetupDone(true);
        return true;
    }, []);

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
        syncClient.stop();
        await window.auth.logout();
        setUser(null);
    }, []);

    useEffect(() => {
        if (!user) {
            syncClient.stop();
        }
    }, [user]);

    const value = useMemo(
        () => ({ user, isSetupDone, isLoading, error, setup, setupDemo, linkDevice, setupOnline, login, logout, refresh, clearError }),
        [user, isSetupDone, isLoading, error, setup, setupDemo, linkDevice, setupOnline, login, logout, refresh, clearError],
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
    'parametres:edit': ['super_admin', 'admin', 'demo'],
    'articles:write': ['super_admin', 'admin', 'gestionnaire', 'demo'],
    'articles:delete': ['super_admin', 'admin', 'demo'],
    'collections:write': ['super_admin', 'admin', 'gestionnaire', 'demo'],
    'collections:delete': ['super_admin', 'admin', 'demo'],
    'clients:write': ['super_admin', 'admin', 'gestionnaire', 'vendeur', 'demo'],
    'clients:delete': ['super_admin', 'admin', 'demo'],
    'devis:create': ['super_admin', 'admin', 'gestionnaire', 'vendeur', 'demo'],
    'devis:modify': ['super_admin', 'admin', 'demo'],
    'devis:delete': ['super_admin', 'admin', 'demo'],
    'factures:create': ['super_admin', 'admin', 'gestionnaire', 'demo'],
    'factures:modify': ['super_admin', 'admin', 'demo'],
    'factures:delete': ['super_admin', 'admin', 'demo'],
    'boutiques:write': ['super_admin', 'admin', 'demo'],
    'boutiques:delete': ['super_admin', 'admin', 'demo'],
    'paiements:write': ['super_admin', 'admin', 'gestionnaire', 'demo'],
    'journal:read': ['super_admin', 'admin', 'demo'],
    'demandes:create': ['gestionnaire', 'vendeur'],
    'demandes:validate': ['super_admin', 'admin', 'demo'],
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
