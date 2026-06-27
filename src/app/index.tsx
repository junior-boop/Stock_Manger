import Screen from '../layouts/screen';
import { HashRouter, Route, Routes } from 'react-router-dom';
import ProductLayouts from '../layouts/product_layouts';
import ProductPage from '../pages/produits';
import ArticleDetail from '../pages/article_detail';
import SetupPage from '../pages/setup';
import LoginPage from '../pages/login';
import CompanySetupPage from '../pages/company_setup';
import ClientsPage from '../pages/clients';
import ClientDetailPage from '../pages/client_detail';
import ClientLayouts from '../layouts/client_layouts';
import DevisLayouts from '../layouts/devis_layouts';
import DevisPage from '../pages/devis';
import DevisNewPage from '../pages/devis_new';
import DevisDetailPage from '../pages/devis_detail';
import FacturesLayouts from '../layouts/factures_layouts';
import FacturesPage from '../pages/factures';
import FactureNewPage from '../pages/facture_new';
import FactureDetailPage from '../pages/facture_detail';
import ProjetsLayouts from '../layouts/projets_layouts';
import ProjetsPage from '../pages/projets';
import ProjetNewPage from '../pages/projet_new';
import ProjetDetailPage from '../pages/projet_detail';
import SettingsPage from '../pages/settings';
import HomePage from '../pages/home';
import BoutiquesPage from '../pages/boutiques';
import StockTransfertsPage from '../pages/stock_transferts';
import InventairePage from '../pages/inventaire';
import SyncProgressPage from '../pages/sync_progress';
import { syncClient } from '../context/sync_client';
import { AuthProvider, useAuth } from '../auth/authProvider';
import TitleBar from '../components/titlebar';
import ImportExcelModal from '../components/import_excel_modal';
import { AlertsProvider, useAlerts } from '../components/alerts';
import { SyncRevisionProvider } from '../context/sync_revision';
import { useDatabase } from '../databaseProvider';
import { useEffect, useRef, useState } from 'react';
import { initGlobalScrollbars } from '../libs/scrollbars';
import { setDevisCompanyInfo } from '../libs/devis_pdf';
import { setFactureCompanyInfo } from '../libs/facture_pdf';
import { SvgSpinners180RingWithBg } from '../libs/icons';

const Router = () => {
    const { user, isSetupDone, isLoading } = useAuth();
    const [companyCheck, setCompanyCheck] = useState<'pending' | 'needed' | 'done'>('pending');
    const [inventaireBrouillon, setInventaireBrouillon] = useState<any | null | 'pending'>('pending');
    const [syncProgress, setSyncProgress] = useState<'checking' | 'needed' | 'done'>('checking');

    useEffect(() => {
        if (!user) {
            setCompanyCheck('pending');
            setInventaireBrouillon('pending');
            setSyncProgress('checking');
            return;
        }
        window.companyApi.get()
            .then((info) => setCompanyCheck(info.setupDone ? 'done' : 'needed'))
            .catch(() => setCompanyCheck('done'));
        window.db.inventaires.getBrouillon()
            .then((inv: any) => setInventaireBrouillon(inv ?? null))
            .catch(() => setInventaireBrouillon(null));
    }, [user]);

    useEffect(() => {
        if (!user) {
            setSyncProgress('checking');
            return;
        }

        let cancelled = false;
        (async () => {
            const cfg = await window.syncApi.getConfig().catch(() => null);
            if (!cfg?.enabled || !cfg?.serverUrl || !cfg?.token) {
                if (!cancelled) setSyncProgress('done');
                return;
            }
            if (syncClient.initialSyncDone) {
                if (!cancelled) setSyncProgress('done');
                return;
            }
            const status = syncClient.getStatus();
            if (status.phase === 'bootstrap' || status.running || status.phase !== 'idle') {
                if (!cancelled) setSyncProgress('needed');
                return;
            }
            const empty = await window.syncApi.syncState.isEmpty().catch(() => false);
            if (!cancelled) setSyncProgress(empty ? 'needed' : 'done');
        })();
        return () => { cancelled = true; };
    }, [user]);

    useEffect(() => {
        if (!user || syncProgress !== 'done') return;
        window.companyApi.get()
            .then((info) => setCompanyCheck(info.setupDone ? 'done' : 'needed'))
            .catch(() => setCompanyCheck('done'));
        window.db.inventaires.getBrouillon()
            .then((inv: any) => setInventaireBrouillon(inv ?? null))
            .catch(() => setInventaireBrouillon(null));
    }, [user, syncProgress]);

    if (isLoading || isSetupDone === null) {
        return (
            <div className="flex items-center justify-center h-dvh bg-gray-50">
                <div className="text-center">
                    <SvgSpinners180RingWithBg className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Chargement…</p>
                </div>
            </div>
        );
    }

    if (!isSetupDone) {
        return <SetupPage />;
    }

    if (!user) {
        return <LoginPage onDone={() => { console.log('je suis dans la place'); setSyncProgress('needed') }} />;
    }

    if (syncProgress === 'checking' || companyCheck === 'pending' || inventaireBrouillon === 'pending') {
        return (
            <div className="flex items-center justify-center h-dvh bg-gray-50">
                <SvgSpinners180RingWithBg className="h-12 w-12 text-blue-600" />
            </div>
        );
    }

    if (syncProgress === 'needed') {
        return <SyncProgressPage onDone={() => setSyncProgress('done')} />;
    }

    // if (companyCheck === 'needed') {
    //     return <CompanySetupPage onDone={() => setCompanyCheck('done')} />;
    // }

    if (inventaireBrouillon) {
        return <InventairePage inventaire={inventaireBrouillon} onDone={() => setInventaireBrouillon(null)} />;
    }

    return (
        <>
            <InventoryWatcher />
            <ImportExcelModal />
            <Routes>
                <Route element={<Screen />}>
                    <Route path="/" element={<HomePage />} />
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
                    <Route path="/factures" element={<FacturesLayouts />}>
                        <Route index element={<FacturesPage />} />
                        <Route path="new" element={<FactureNewPage />} />
                        <Route path=":id" element={<FactureDetailPage />} />
                    </Route>
                    <Route path="/projets" element={<ProjetsLayouts />}>
                        <Route index element={<ProjetsPage />} />
                        <Route path="new" element={<ProjetNewPage />} />
                        <Route path=":id" element={<ProjetDetailPage />} />
                    </Route>
                    {/* <Route path="/taches" element={<div className="p-6">Tâches (à venir)</div>} /> */}
                    <Route path="/boutiques" element={<BoutiquesPage />} />
                    <Route path="/stock" element={<StockTransfertsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
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
    useEffect(() => {
        let dispose: (() => void) | null = null;
        const timer = window.setTimeout(() => {
            dispose = initGlobalScrollbars();
        }, 300);
        window.companyApi?.get().then((info) => {
            setDevisCompanyInfo(info);
            setFactureCompanyInfo(info);
        }).catch(() => { /* defaults kept */ });
        return () => {
            window.clearTimeout(timer);
            dispose?.();
        };
    }, []);
    return (
        <AlertsProvider>
            <AuthProvider>
                <SyncRevisionProvider>
                    <TitleBar />
                    <div className="flex flex-col h-[calc(100vh-36px)] w-full">
                        <div className="flex-1 min-h-0">
                            <HashRouter basename="/">
                                <Router />
                            </HashRouter>
                        </div>
                    </div>
                </SyncRevisionProvider>
            </AuthProvider>
        </AlertsProvider>
    );
}
