import { useEffect, useMemo, useRef, useState } from 'react';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { useAlerts } from '../components/alerts';
import { SvgSpinners180Ring, FluentSearch32Filled, FluentCloudArrowUp32Regular } from '../libs/icons';
import ExcelParserWorker from '../workers/excel_parser.worker.ts?worker';
import ScrollArea from '../components/scroll_area';

type Inventaire = {
    id: string;
    boutiqueId: string | null;
    status: 'brouillon' | 'valide' | 'annule';
    exportPath: string | null;
    lignes: LigneInventaire[];
    startedAt: string;
    validatedAt: string | null;
    createdBy: string;
};

type LigneInventaire = {
    articleId: string;
    varianteId?: string | null;
    boutiqueId: string;
    quantiteCompte: number | null;
};

type Boutique = { id: string; nom: string; isPrincipal?: boolean | number };

type StockRow = { boutiqueId: string; articleId: string; varianteId?: string | null; quantite: number };

type WorkerOutMsg =
    | { id: number; type: 'parse'; ok: true; headers: string[]; rows: unknown[][]; detected: any }
    | { id: number; ok: false; error: string };

export default function InventairePage({ inventaire, onDone }: { inventaire: Inventaire; onDone: () => void }) {
    const { articles, collections } = useDatabase();
    const { user } = useAuth();
    const { success, error: notifyError, warn } = useAlerts();
    const [boutiques, setBoutiques] = useState<Boutique[]>([]);
    const [stocks, setStocks] = useState<StockRow[]>([]);
    const [lignes, setLignes] = useState<LigneInventaire[]>(inventaire.lignes ?? []);
    const [search, setSearch] = useState('');
    const [filterCollection, setFilterCollection] = useState('');
    const [filterBoutique, setFilterBoutique] = useState('');
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [excelOpen, setExcelOpen] = useState(false);
    const saveTimerRef = useRef<number | null>(null);

    useEffect(() => {
        (async () => {
            const allB: Boutique[] = (await window.db.boutiques.getAll()) ?? [];
            setBoutiques(allB);
            const targetBs = inventaire.boutiqueId
                ? allB.filter((b) => b.id === inventaire.boutiqueId)
                : allB;
            const all: StockRow[] = [];
            for (const b of targetBs) {
                const rows = (await window.db.stocksBoutique.getByBoutique(b.id)) ?? [];
                all.push(...rows);
            }
            setStocks(all);
        })();
    }, [inventaire.boutiqueId]);

    const ligneKey = (l: { articleId: string; varianteId?: string | null; boutiqueId: string }) =>
        `${l.boutiqueId}::${l.articleId}::${l.varianteId ?? ''}`;

    const ligneMap = useMemo(() => {
        const m = new Map<string, LigneInventaire>();
        lignes.forEach((l) => m.set(ligneKey(l), l));
        return m;
    }, [lignes]);

    const targetBoutiques = useMemo(
        () => inventaire.boutiqueId ? boutiques.filter((b) => b.id === inventaire.boutiqueId) : boutiques,
        [boutiques, inventaire.boutiqueId],
    );

    type LigneVue = {
        key: string;
        articleId: string;
        varianteId: string | null;
        boutiqueId: string;
        boutiqueNom: string;
        nom: string;
        reference: string;
        collectionId: string;
        stockActuel: number;
        quantiteCompte: number | null;
    };

    const articleById = useMemo(() => {
        const m = new Map<string, any>();
        articles.forEach((a) => m.set(a.id, a));
        return m;
    }, [articles]);

    const vues: LigneVue[] = useMemo(() => {
        const out: LigneVue[] = [];
        for (const s of stocks) {
            const a = articleById.get(s.articleId);
            if (!a) continue;
            const b = boutiques.find((bb) => bb.id === s.boutiqueId);
            const key = ligneKey({ articleId: s.articleId, varianteId: s.varianteId, boutiqueId: s.boutiqueId });
            const l = ligneMap.get(key);
            out.push({
                key,
                articleId: s.articleId,
                varianteId: s.varianteId ?? null,
                boutiqueId: s.boutiqueId,
                boutiqueNom: b?.nom ?? '—',
                nom: a.nom,
                reference: a.reference ?? '',
                collectionId: a.collectionId ?? '',
                stockActuel: s.quantite,
                quantiteCompte: l?.quantiteCompte ?? null,
            });
        }
        return out;
    }, [stocks, articleById, boutiques, ligneMap]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return vues.filter((v) => {
            if (q && !v.nom.toLowerCase().includes(q) && !v.reference.toLowerCase().includes(q)) return false;
            if (filterCollection && v.collectionId !== filterCollection) return false;
            if (filterBoutique && v.boutiqueId !== filterBoutique) return false;
            return true;
        });
    }, [vues, search, filterCollection, filterBoutique]);

    const updateQuantite = (key: string, articleId: string, varianteId: string | null, boutiqueId: string, value: string) => {
        const parsed = value.trim() === '' ? null : Math.max(0, Math.floor(Number(value) || 0));
        setLignes((prev) => {
            const next = prev.filter((l) => ligneKey(l) !== key);
            next.push({ articleId, varianteId, boutiqueId, quantiteCompte: parsed });
            return next;
        });
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => persist(), 500);
    };

    const persist = async () => {
        try {
            setSaving(true);
            await window.db.inventaires.updateLignes(inventaire.id, lignesRef.current);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };
    const lignesRef = useRef(lignes);
    useEffect(() => { lignesRef.current = lignes; }, [lignes]);

    const compteCount = useMemo(() => lignes.filter((l) => l.quantiteCompte != null).length, [lignes]);

    const handleValidate = async () => {
        if (compteCount === 0) {
            notifyError('Inventaire vide', 'Aucun article n\'a été compté.');
            return;
        }
        if (!confirm(`Valider l'inventaire ?\n\n${compteCount} article(s) seront mis à jour. Les articles non comptés conservent leur valeur actuelle.`)) return;
        setValidating(true);
        try {
            await window.db.inventaires.updateLignes(inventaire.id, lignes);
            const res = await window.db.inventaires.validate(inventaire.id);
            if (res?.ok) {
                success('Inventaire validé', `${res.appliedCount} article(s) mis à jour.`);
                onDone();
            } else {
                notifyError('Échec', 'La validation a échoué.');
            }
        } catch (e) {
            console.error(e);
            notifyError('Erreur', (e as Error).message);
        } finally {
            setValidating(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Annuler cet inventaire ? Les quantités saisies seront perdues. Le backup Excel reste disponible.')) return;
        try {
            await window.db.inventaires.cancel(inventaire.id);
            warn('Inventaire annulé', 'Aucune modification de stock n\'a été appliquée.', { persistent: false });
            onDone();
        } catch (e) {
            console.error(e);
        }
    };

    const openBackup = () => {
        if (inventaire.exportPath) window.shell.showItemInFolder(inventaire.exportPath);
    };

    return (
        <div className="absolute inset-0 bg-slate-50 z-40 flex flex-col h-[calc(100dvh-36px)] top-9">
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-semibold">Inventaire en cours</h1>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Brouillon</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        {inventaire.boutiqueId
                            ? `Boutique : ${boutiques.find((b) => b.id === inventaire.boutiqueId)?.nom ?? '—'}`
                            : `Toutes les boutiques (${boutiques.length})`}
                        {' · '}
                        Démarré le {new Date(inventaire.startedAt).toLocaleString('fr-FR')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {saving && <SvgSpinners180Ring className="h-4 w-4 text-slate-400" />}
                    <span className="text-sm text-slate-500">
                        <b>{compteCount}</b> compté{compteCount > 1 ? 's' : ''} / {vues.length}
                    </span>
                </div>
            </div>

            <div className="bg-blue-50/60 border-b border-blue-100 px-8 py-3 flex items-center justify-between">
                <div className="text-sm text-blue-900">
                    📦 Un fichier de sauvegarde Excel a été créé avant l'inventaire.
                </div>
                <button
                    onClick={openBackup}
                    disabled={!inventaire.exportPath}
                    className="text-sm px-3 py-1 rounded-full bg-white border border-blue-200 hover:bg-blue-50 disabled:opacity-40"
                >
                    Ouvrir le dossier du backup
                </button>
            </div>

            <div className="px-8 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
                <div className="flex items-center flex-1 bg-slate-100 rounded-full px-4 h-10 max-w-md">
                    <FluentSearch32Filled className="h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un article..."
                        className="flex-1 bg-transparent outline-none px-2 text-sm"
                    />
                </div>
                <select
                    value={filterCollection}
                    onChange={(e) => setFilterCollection(e.target.value)}
                    className="text-sm p-2 border border-slate-200 rounded-lg bg-white"
                >
                    <option value="">Toutes collections</option>
                    {collections.map((c) => (<option key={c.id} value={c.id}>{c.nom}</option>))}
                </select>
                {!inventaire.boutiqueId && targetBoutiques.length > 1 && (
                    <select
                        value={filterBoutique}
                        onChange={(e) => setFilterBoutique(e.target.value)}
                        className="text-sm p-2 border border-slate-200 rounded-lg bg-white"
                    >
                        <option value="">Toutes boutiques</option>
                        {targetBoutiques.map((b) => (<option key={b.id} value={b.id}>{b.nom}</option>))}
                    </select>
                )}
                <button
                    onClick={() => setExcelOpen(true)}
                    className="text-sm px-4 py-2 rounded-full bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-2"
                >
                    <FluentCloudArrowUp32Regular className="h-4 w-4" />
                    Importer Excel
                </button>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto px-8 py-4">
                <table className="w-full text-sm bg-white rounded-xl border border-slate-200">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th className="text-left px-4 py-3">Article</th>
                            <th className="text-left px-4 py-3 w-32">Réf.</th>
                            {!inventaire.boutiqueId && <th className="text-left px-4 py-3 w-40">Boutique</th>}
                            <th className="text-right px-4 py-3 w-24">Actuel</th>
                            <th className="text-right px-4 py-3 w-32">Compté</th>
                            <th className="text-right px-4 py-3 w-24">Écart</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((v) => {
                            const ecart = v.quantiteCompte != null ? v.quantiteCompte - v.stockActuel : null;
                            return (
                                <tr key={v.key} className="border-t border-slate-100 hover:bg-slate-50/60">
                                    <td className="px-4 py-2">{v.nom}</td>
                                    <td className="px-4 py-2 text-xs text-slate-500">{v.reference}</td>
                                    {!inventaire.boutiqueId && <td className="px-4 py-2 text-xs">{v.boutiqueNom}</td>}
                                    <td className="px-4 py-2 text-right tabular-nums">{v.stockActuel}</td>
                                    <td className="px-4 py-2 text-right">
                                        <input
                                            type="number"
                                            min={0}
                                            value={v.quantiteCompte ?? ''}
                                            onChange={(e) => updateQuantite(v.key, v.articleId, v.varianteId, v.boutiqueId, e.target.value)}
                                            placeholder="—"
                                            className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
                                        />
                                    </td>
                                    <td className={`px-4 py-2 text-right tabular-nums ${ecart == null ? 'text-slate-300' : ecart === 0 ? 'text-slate-500' : ecart > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {ecart == null ? '—' : (ecart > 0 ? `+${ecart}` : ecart)}
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={inventaire.boutiqueId ? 5 : 6} className="text-center py-10 text-slate-400">Aucun article.</td></tr>
                        )}
                    </tbody>
                </table>
            </ScrollArea>

            <div className="bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between">
                <button
                    onClick={handleCancel}
                    disabled={validating}
                    className="px-5 py-2 border border-rose-200 text-rose-600 rounded-full hover:bg-rose-50 disabled:opacity-40"
                >
                    Annuler l'inventaire
                </button>
                <button
                    onClick={handleValidate}
                    disabled={validating || compteCount === 0}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-40 min-w-[200px] flex items-center justify-center gap-2"
                >
                    {validating ? <><SvgSpinners180Ring className="h-4 w-4" />Validation…</> : `Valider l'inventaire (${compteCount})`}
                </button>
            </div>

            {excelOpen && (
                <ExcelImportInventaire
                    onClose={() => setExcelOpen(false)}
                    onMatched={(matches) => {
                        setLignes((prev) => {
                            const map = new Map(prev.map((l) => [ligneKey(l), l] as const));
                            for (const m of matches) {
                                const targets = inventaire.boutiqueId
                                    ? [inventaire.boutiqueId]
                                    : boutiques.map((b) => b.id);
                                for (const bId of targets) {
                                    const k = ligneKey({ articleId: m.articleId, varianteId: null, boutiqueId: bId });
                                    map.set(k, { articleId: m.articleId, varianteId: null, boutiqueId: bId, quantiteCompte: m.quantite });
                                }
                            }
                            return Array.from(map.values());
                        });
                        setExcelOpen(false);
                        success('Import terminé', `${matches.length} ligne(s) importée(s).`);
                    }}
                    articles={articles}
                />
            )}
            {user && null}
        </div>
    );
}

function ExcelImportInventaire({
    onClose,
    onMatched,
    articles,
}: {
    onClose: () => void;
    onMatched: (matches: Array<{ articleId: string; quantite: number }>) => void;
    articles: Array<{ id: string; nom: string; reference?: string }>;
}) {
    const { error: notifyError } = useAlerts();
    const [parsing, setParsing] = useState(false);
    const [rows, setRows] = useState<unknown[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [colRef, setColRef] = useState<number>(-1);
    const [colNom, setColNom] = useState<number>(-1);
    const [colQte, setColQte] = useState<number>(-1);
    const [step, setStep] = useState<'pick' | 'map' | 'review'>('pick');
    const fileRef = useRef<HTMLInputElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const pendingRef = useRef<Map<number, (msg: WorkerOutMsg) => void>>(new Map());
    const reqIdRef = useRef(0);

    useEffect(() => {
        const w = new ExcelParserWorker();
        w.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
            const cb = pendingRef.current.get(e.data.id);
            if (cb) { pendingRef.current.delete(e.data.id); cb(e.data); }
        };
        workerRef.current = w;
        return () => { w.terminate(); workerRef.current = null; };
    }, []);

    const parseFile = async (file: File) => {
        try {
            setParsing(true);
            const buf = await file.arrayBuffer();
            const id = ++reqIdRef.current;
            const res = await new Promise<WorkerOutMsg>((resolve, reject) => {
                pendingRef.current.set(id, resolve);
                workerRef.current!.postMessage({ id, type: 'parse', buffer: buf }, [buf]);
                setTimeout(() => reject(new Error('timeout')), 30000);
            });
            if (!res.ok) throw new Error(res.error);
            if (res.type !== 'parse') return;
            setHeaders(res.headers);
            setRows(res.rows);
            const auto = res.detected || {};
            setColRef(typeof auto.ref === 'number' ? auto.ref : -1);
            setColNom(typeof auto.nom === 'number' ? auto.nom : -1);
            setColQte(typeof auto.stock === 'number' ? auto.stock : -1);
            setStep('map');
        } catch (e) {
            notifyError('Erreur', (e as Error).message);
        } finally {
            setParsing(false);
        }
    };

    const matched = useMemo(() => {
        if (colQte < 0) return [];
        const byRef = new Map<string, string>();
        const byNom = new Map<string, string>();
        for (const a of articles) {
            if (a.reference) byRef.set(a.reference.toLowerCase().trim(), a.id);
            byNom.set(a.nom.toLowerCase().trim(), a.id);
        }
        const out: Array<{ articleId: string; quantite: number; rowIdx: number; label: string }> = [];
        rows.forEach((r, i) => {
            const qte = Math.max(0, Math.floor(Number(r[colQte]) || 0));
            const refVal = colRef >= 0 ? String(r[colRef] ?? '').toLowerCase().trim() : '';
            const nomVal = colNom >= 0 ? String(r[colNom] ?? '').toLowerCase().trim() : '';
            const articleId = (refVal && byRef.get(refVal)) || (nomVal && byNom.get(nomVal));
            if (articleId) out.push({ articleId, quantite: qte, rowIdx: i, label: nomVal || refVal });
        });
        return out;
    }, [rows, colRef, colNom, colQte, articles]);

    const unmatched = rows.length - matched.length;

    return (
        <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl w-[90%] max-w-[900px] max-h-[85%] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Importer les quantités depuis Excel</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl">✕</button>
                </div>

                {step === 'pick' && (
                    <div className="flex-1 p-10 flex items-center justify-center">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="w-full max-w-125 border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer hover:border-slate-400"
                        >
                            {parsing ? <SvgSpinners180Ring className="h-12 w-12 mx-auto text-gray-400" /> : <FluentCloudArrowUp32Regular className="h-12 w-12 mx-auto text-gray-400" />}
                            <p className="mt-4">{parsing ? 'Lecture…' : 'Cliquez pour choisir un fichier .xlsx'}</p>
                            <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
                        </div>
                    </div>
                )}

                {step === 'map' && (
                    <ScrollArea className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                        <div className="text-sm text-slate-600">
                            {rows.length} ligne(s) lues. Associez les colonnes (référence prioritaire pour le matching).
                        </div>
                        {(['ref', 'nom', 'qte'] as const).map((k) => {
                            const label = k === 'ref' ? 'Référence' : k === 'nom' ? 'Nom (fallback)' : 'Quantité comptée';
                            const value = k === 'ref' ? colRef : k === 'nom' ? colNom : colQte;
                            const setter = k === 'ref' ? setColRef : k === 'nom' ? setColNom : setColQte;
                            const required = k === 'qte';
                            return (
                                <div key={k} className="flex items-center justify-between gap-4 border border-slate-200 rounded-xl p-3">
                                    <div>
                                        <div className="font-medium">{label} {required && <span className="text-xs text-rose-500">obligatoire</span>}</div>
                                    </div>
                                    <select value={value} onChange={(e) => setter(parseInt(e.target.value))} className="p-2 border border-slate-200 rounded-lg min-w-[260px]">
                                        <option value={-1}>— Ignorer —</option>
                                        {headers.map((h, i) => (<option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>))}
                                    </select>
                                </div>
                            );
                        })}
                        <div className="flex items-center justify-end gap-3">
                            <button onClick={() => setStep('pick')} className="px-5 py-2 border border-slate-200 rounded-full">← Retour</button>
                            <button
                                onClick={() => setStep('review')}
                                disabled={colQte < 0 || (colRef < 0 && colNom < 0)}
                                className="px-6 py-2 bg-blue-800 text-white rounded-full disabled:opacity-40"
                            >Voir les correspondances →</button>
                        </div>
                    </ScrollArea>
                )}

                {step === 'review' && (
                    <ScrollArea className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                        <div className="text-sm">
                            <b>{matched.length}</b> ligne(s) appariée(s) · {unmatched > 0 && <span className="text-amber-600">{unmatched} non appariée(s)</span>}
                        </div>
                        <ScrollArea className="border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                                    <th className="text-left px-3 py-2">Article</th>
                                    <th className="text-right px-3 py-2 w-24">Quantité</th>
                                </tr></thead>
                                <tbody>
                                    {matched.slice(0, 200).map((m, i) => {
                                        const a = articles.find((x) => x.id === m.articleId);
                                        return (
                                            <tr key={i} className="border-t border-slate-100">
                                                <td className="px-3 py-2">{a?.nom ?? m.label}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{m.quantite}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </ScrollArea>
                        <div className="flex items-center justify-between">
                            <button onClick={() => setStep('map')} className="px-5 py-2 border border-slate-200 rounded-full">← Retour</button>
                            <button
                                onClick={() => onMatched(matched.map(({ articleId, quantite }) => ({ articleId, quantite })))}
                                disabled={matched.length === 0}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-full disabled:opacity-40"
                            >Appliquer {matched.length} ligne(s)</button>
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
