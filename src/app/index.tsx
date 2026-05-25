import Screen from '../layouts/screen';
import { HashRouter, Route, Routes } from 'react-router-dom';
import ProductLayouts from '../layouts/product_layouts';
import ProductPage from '../pages/produits';
import ArticleDetail from '../pages/article_detail';
import SetupPage from '../pages/setup';
import LoginPage from '../pages/login';
import ClientsPage from '../pages/clients';
import ClientDetailPage from '../pages/client_detail';
import ClientLayouts from '../layouts/client_layouts';
import DevisLayouts from '../layouts/devis_layouts';
import DevisPage from '../pages/devis';
import DevisNewPage from '../pages/devis_new';
import DevisDetailPage from '../pages/devis_detail';
import { AuthProvider, useAuth } from '../auth/authProvider';
import TitleBar from '../components/titlebar';
import { AlertsProvider, useAlerts } from '../components/alerts';
import { useDatabase } from '../databaseProvider';
import { useEffect, useRef } from 'react';

const Router = () => {
    const { user, isSetupDone, isLoading } = useAuth();

    if (isLoading || isSetupDone === null) {
        return (
            <div className="flex items-center justify-center h-dvh bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement…</p>
                </div>
            </div>
        );
    }

    if (!isSetupDone) {
        return <SetupPage />;
    }

    if (!user) {
        return <LoginPage />;
    }

    return (
        <>
            <InventoryWatcher />
            <Routes>
            <Route element={<Screen />}>
                <Route path="/" element={<div className="p-6">Accueil</div>} />
                <Route path="/produits" element={<ProductLayouts />}>
                    <Route path="/produits/collections/:id" element={<ProductPage />}>
                        <Route path="/produits/collections/:id?sous_collection=:sousId" element={<ProductPage />} />
                    </Route>
                    <Route path="/produits/article/:productId" element={<ArticleDetail />} />
                    <Route path="/produits/*" element={<ProductPage />} />
                </Route>
                <Route path="/clients" element={<ClientLayouts />}>
                    <Route index element={<ClientsPage />} />
                    <Route path=":id" element={<ClientDetailPage />} />
                </Route>
                <Route path="/devis" element={<DevisLayouts />}>
                    <Route index element={<DevisPage />} />
                    <Route path="new" element={<DevisNewPage />} />
                    <Route path=":id" element={<DevisDetailPage />} />
                </Route>
                <Route path="/factures" element={<div className="p-6">Factures (à venir)</div>} />
                <Route path="/projets" element={<div className="p-6">Projets (à venir)</div>} />
                <Route path="/taches" element={<div className="p-6">Tâches (à venir)</div>} />
                <Route path="/settings" element={<div className="p-6">Paramètres (à venir)</div>} />
            </Route>
        </Routes>
        </>
    );
};

function InventoryWatcher() {
    const { articles } = useDatabase();
    const { warn } = useAlerts();
    const lastSigRef = useRef<string | null>(null);

    useEffect(() => {
        if (!articles) return;
        const ruptures = articles.filter((a) => (a.stockTotal ?? 0) <= 0);
        const sig = ruptures.map((a) => a.id).sort().join('|');
        if (sig === lastSigRef.current) return;
        lastSigRef.current = sig;
        if (ruptures.length === 0) return;
        const names = ruptures.slice(0, 5).map((a) => a.nom).join(', ');
        const more = ruptures.length > 5 ? ` et ${ruptures.length - 5} autre${ruptures.length - 5 > 1 ? 's' : ''}` : '';
        warn(
            `Inventaire : ${ruptures.length} article${ruptures.length > 1 ? 's' : ''} en rupture`,
            `${names}${more}.`,
            { persistent: true, key: 'inventory-ruptures' },
        );
    }, [articles, warn]);

    return null;
}

export default function App() {
    return (
        <AlertsProvider>
            <AuthProvider>
                <TitleBar />
                <div className="flex flex-col h-[calc(100vh-36px)] w-full">
                    <div className="flex-1 min-h-0">
                        <HashRouter basename="/">
                            <Router />
                        </HashRouter>
                    </div>
                </div>
            </AuthProvider>
        </AlertsProvider>
    );
}
