import { useEffect, useMemo, useRef, useState } from 'react';
import { useDatabase } from '../databaseProvider';
import { useAlerts } from '../components/alerts';
import { SvgSpinners180Ring, FluentSearch32Filled, FluentCloudArrowUp32Regular, FluentAdd32Regular, FluentDelete32Regular } from '../libs/icons';
import ExcelParserWorker from '../workers/excel_parser.worker.ts?worker';

type ReapproLine = { articleId: string; quantite: number };

type WorkerOutMsg =
    | { id: number; type: 'parse'; ok: true; headers: string[]; rows: unknown[][]; detected: any }
    | { id: number; ok: false; error: string };

export default function ReapproModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { articles, refreshArticles } = useDatabase();
    const { success, error: notifyError } = useAlerts();
    const [boutiquePrincipaleId, setBoutiquePrincipaleId] = useState<string | null>(null);
    const [mode, setMode] = useState<'manual' | 'excel'>('manual');
    const [lines, setLines] = useState<ReapproLine[]>([]);
    const [search, setSearch] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (!open) return;
        window.db.boutiques.getPrincipale().then((b: any) => {
            setBoutiquePrincipaleId(b?.id ?? null);
        });
    }, [open]);

    const articleById = useMemo(() => new Map(articles.map((a) => [a.id, a] as const)), [articles]);

    const reset = () => {
        setLines([]);
        setSearch('');
        setMode('manual');
    };

    const addArticle = (articleId: string) => {
        setLines((prev) => {
            if (prev.some((l) => l.articleId === articleId)) return prev;
            return [...prev, { articleId, quantite: 1 }];
        });
    };

    const updateQte = (articleId: string, value: string) => {
        const qte = Math.max(0, Math.floor(Number(value) || 0));
        setLines((prev) => prev.map((l) => l.articleId === articleId ? { ...l, quantite: qte } : l));
    };

    const removeLine = (articleId: string) => setLines((prev) => prev.filter((l) => l.articleId !== articleId));

    const validLines = lines.filter((l) => l.quantite > 0);

    const handleApply = async () => {
        if (!boutiquePrincipaleId) {
            notifyError('Erreur', 'Boutique principale introuvable.');
            return;
        }
        if (validLines.length === 0) {
            notifyError('Rien à appliquer', 'Aucune ligne avec quantité > 0.');
            return;
        }
        if (!confirm(`Réapprovisionner ${validLines.length} article(s) sur la boutique principale ?`)) return;
        setApplying(true);
        try {
            const entries = validLines.map((l) => ({
                boutiqueId: boutiquePrincipaleId,
                articleId: l.articleId,
                delta: l.quantite,
            }));
            const res = await window.db.transfertsStock.adjustBatch(entries);
            if (res?.ok) {
                success('Réapprovisionnement appliqué', `${res.applied} article(s) mis à jour.`);
                await refreshArticles();
                reset();
                onClose();
            } else {
                notifyError('Échec', 'L\'opération a échoué.');
            }
        } catch (e) {
            console.error(e);
            notifyError('Erreur', (e as Error).message);
        } finally {
            setApplying(false);
        }
    };

    if (!open) return null;

    return (
        <div className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl w-[92%] max-w-275 h-[88%] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-light">Réapprovisionner le stock</h2>
                        <p className="text-sm text-gray-500">Boutique principale · opération additive (les quantités s'ajoutent au stock existant).</p>
                    </div>
                    <button onClick={() => { reset(); onClose(); }} className="text-slate-500 hover:text-slate-800 text-xl">✕</button>
                </div>

                <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3">
                    <button onClick={() => setMode('manual')} className={`px-4 py-2 rounded-full text-sm ${mode === 'manual' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Saisie manuelle</button>
                    <button onClick={() => setMode('excel')} className={`px-4 py-2 rounded-full text-sm ${mode === 'excel' ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>Import Excel</button>
                </div>

                {mode === 'manual' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="px-6 py-3 border-b border-slate-100">
                            <button
                                onClick={() => setPickerOpen(true)}
                                className="px-4 py-2 bg-blue-700 text-white rounded-full text-sm flex items-center gap-2"
                            >
                                <FluentAdd32Regular className="h-4 w-4" />
                                Ajouter un article
                            </button>
                        </div>
                        <div data-os-scroll className="flex-1 overflow-y-auto px-6 py-4">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-3 py-2">Article</th>
                                        <th className="text-left px-3 py-2 w-32">Réf.</th>
                                        <th className="text-right px-3 py-2 w-32">Stock actuel</th>
                                        <th className="text-right px-3 py-2 w-32">À ajouter</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((l) => {
                                        const a = articleById.get(l.articleId);
                                        return (
                                            <tr key={l.articleId} className="border-b border-slate-100">
                                                <td className="px-3 py-2">{a?.nom ?? '—'}</td>
                                                <td className="px-3 py-2 text-xs text-slate-500">{a?.reference ?? ''}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{a?.stockTotal ?? 0}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <input type="number" min={0} value={l.quantite}
                                                        onChange={(e) => updateQte(l.articleId, e.target.value)}
                                                        className="w-24 text-right px-2 py-1 border border-slate-200 rounded-lg" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button onClick={() => removeLine(l.articleId)} className="text-rose-500 hover:text-rose-700">
                                                        <FluentDelete32Regular className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {lines.length === 0 && (
                                        <tr><td colSpan={5} className="text-center py-12 text-slate-400">Aucun article. Cliquez sur « Ajouter un article » pour commencer.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {mode === 'excel' && (
                    <ExcelReappro articles={articles} onLoaded={(items) => {
                        setLines((prev) => {
                            const map = new Map(prev.map((l) => [l.articleId, l] as const));
                            for (const it of items) {
                                const cur = map.get(it.articleId);
                                map.set(it.articleId, { articleId: it.articleId, quantite: (cur?.quantite ?? 0) + it.quantite });
                            }
                            return Array.from(map.values());
                        });
                        setMode('manual');
                        success('Excel importé', `${items.length} ligne(s) ajoutée(s).`);
                    }} />
                )}

                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-sm text-slate-500">{validLines.length} ligne(s) à appliquer</div>
                    <div className="flex gap-3">
                        <button onClick={() => { reset(); onClose(); }} className="px-5 py-2 border border-slate-200 rounded-full">Annuler</button>
                        <button onClick={handleApply} disabled={applying || validLines.length === 0} className="px-6 py-2 bg-emerald-600 text-white rounded-full disabled:opacity-40 flex items-center gap-2 min-w-[200px] justify-center">
                            {applying ? <><SvgSpinners180Ring className="h-4 w-4" />Application…</> : `Réapprovisionner (${validLines.length})`}
                        </button>
                    </div>
                </div>

                {pickerOpen && (
                    <ArticlePicker
                        articles={articles}
                        excludeIds={new Set(lines.map((l) => l.articleId))}
                        search={search}
                        setSearch={setSearch}
                        onPick={(id) => { addArticle(id); }}
                        onClose={() => setPickerOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}

function ArticlePicker({
    articles, excludeIds, search, setSearch, onPick, onClose,
}: {
    articles: Array<{ id: string; nom: string; reference?: string; stockTotal?: number }>;
    excludeIds: Set<string>;
    search: string;
    setSearch: (s: string) => void;
    onPick: (id: string) => void;
    onClose: () => void;
}) {
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return articles.filter((a) => {
            if (excludeIds.has(a.id)) return false;
            if (!q) return true;
            return a.nom.toLowerCase().includes(q) || (a.reference ?? '').toLowerCase().includes(q);
        }).slice(0, 200);
    }, [articles, excludeIds, search]);

    return (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
            <div className="bg-white rounded-2xl w-[80%] max-w-175 max-h-[80%] flex flex-col overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold">Choisir un article</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-xl">✕</button>
                </div>
                <div className="px-5 py-3 border-b border-slate-100">
                    <div className="flex items-center bg-slate-100 rounded-full px-4 h-10">
                        <FluentSearch32Filled className="h-4 w-4 text-gray-400" />
                        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="flex-1 bg-transparent outline-none px-2 text-sm" />
                    </div>
                </div>
                <div data-os-scroll className="flex-1 overflow-y-auto">
                    {filtered.map((a) => (
                        <button key={a.id} onClick={() => { onPick(a.id); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <div className="text-sm">{a.nom}</div>
                                <div className="text-xs text-slate-400">{a.reference}</div>
                            </div>
                            <div className="text-xs text-slate-500">Stock : {a.stockTotal ?? 0}</div>
                        </button>
                    ))}
                    {filtered.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Aucun article.</div>}
                </div>
            </div>
        </div>
    );
}

function ExcelReappro({
    articles, onLoaded,
}: {
    articles: Array<{ id: string; nom: string; reference?: string }>;
    onLoaded: (items: Array<{ articleId: string; quantite: number }>) => void;
}) {
    const { error: notifyError } = useAlerts();
    const [parsing, setParsing] = useState(false);
    const [rows, setRows] = useState<unknown[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [colRef, setColRef] = useState(-1);
    const [colNom, setColNom] = useState(-1);
    const [colQte, setColQte] = useState(-1);
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
            const d = res.detected || {};
            setColRef(typeof d.ref === 'number' ? d.ref : -1);
            setColNom(typeof d.nom === 'number' ? d.nom : -1);
            setColQte(typeof d.stock === 'number' ? d.stock : -1);
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
        const out: Array<{ articleId: string; quantite: number }> = [];
        for (const r of rows) {
            const qte = Math.max(0, Math.floor(Number(r[colQte]) || 0));
            if (qte <= 0) continue;
            const refVal = colRef >= 0 ? String(r[colRef] ?? '').toLowerCase().trim() : '';
            const nomVal = colNom >= 0 ? String(r[colNom] ?? '').toLowerCase().trim() : '';
            const articleId = (refVal && byRef.get(refVal)) || (nomVal && byNom.get(nomVal));
            if (articleId) out.push({ articleId, quantite: qte });
        }
        return out;
    }, [rows, colRef, colNom, colQte, articles]);

    if (rows.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-10">
                <div onClick={() => fileRef.current?.click()} className="w-full max-w-[500px] border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer hover:border-slate-400">
                    {parsing ? <SvgSpinners180Ring className="h-12 w-12 mx-auto text-gray-400" /> : <FluentCloudArrowUp32Regular className="h-12 w-12 mx-auto text-gray-400" />}
                    <p className="mt-4">{parsing ? 'Lecture…' : 'Cliquez pour choisir un fichier .xlsx'}</p>
                    <p className="text-xs text-slate-400 mt-2">Le fichier doit contenir au minimum une colonne quantité et une référence (ou nom).</p>
                    <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
                </div>
            </div>
        );
    }

    return (
        <div data-os-scroll className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            <div className="text-sm text-slate-600">{rows.length} ligne(s) lues. Choisissez les colonnes.</div>
            {(['ref', 'nom', 'qte'] as const).map((k) => {
                const label = k === 'ref' ? 'Référence' : k === 'nom' ? 'Nom (fallback)' : 'Quantité à ajouter';
                const value = k === 'ref' ? colRef : k === 'nom' ? colNom : colQte;
                const setter = k === 'ref' ? setColRef : k === 'nom' ? setColNom : setColQte;
                const required = k === 'qte';
                return (
                    <div key={k} className="flex items-center justify-between gap-4 border border-slate-200 rounded-xl p-3">
                        <div className="font-medium">{label} {required && <span className="text-xs text-rose-500">obligatoire</span>}</div>
                        <select value={value} onChange={(e) => setter(parseInt(e.target.value))} className="p-2 border border-slate-200 rounded-lg min-w-[260px]">
                            <option value={-1}>— Ignorer —</option>
                            {headers.map((h, i) => (<option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>))}
                        </select>
                    </div>
                );
            })}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="text-sm">{matched.length} ligne(s) appariée(s) {rows.length - matched.length > 0 && <span className="text-amber-600 ml-2">{rows.length - matched.length} non appariée(s)</span>}</div>
                <button onClick={() => onLoaded(matched)} disabled={matched.length === 0} className="px-6 py-2 bg-blue-700 text-white rounded-full disabled:opacity-40">Charger {matched.length} ligne(s)</button>
            </div>
        </div>
    );
}
