import { useEffect, useMemo, useState } from 'react';
import { useAuth, usePermissions } from '../auth/authProvider';
import { useDatabase } from '../databaseProvider';
import Title from '../components/title';
import {
    FluentSearch32Filled,
    FluentArchive32Regular,
} from '../libs/icons';

type Boutique = {
    id: string;
    nom: string;
    isPrincipal: boolean;
    statut: 'actif' | 'inactif' | 'archivé';
};

type Sens = 'transfert' | 'ajout' | 'retrait';

type StockEntry = {
    id: string;
    boutiqueId: string;
    articleId: string;
    varianteId?: string | null;
    quantite: number;
};

type TransfertRow = {
    id: string;
    articleId: string;
    varianteId?: string | null;
    boutiqueSourceId?: string | null;
    boutiqueDestId?: string | null;
    quantite: number;
    sens: Sens;
    userId: string;
    note?: string | null;
    createdAt: string;
};

export default function StockTransfertsPage() {
    const { user } = useAuth();
    const { can } = usePermissions();
    const canWrite = can('boutiques:write');
    const { articles } = useDatabase();

    const [boutiques, setBoutiques] = useState<Boutique[]>([]);
    const [transferts, setTransferts] = useState<TransfertRow[]>([]);
    const [stockByArticle, setStockByArticle] = useState<Record<string, StockEntry[]>>({});
    const [stockByBoutique, setStockByBoutique] = useState<Record<string, StockEntry[]>>({});
    const [globalQuery, setGlobalQuery] = useState<string>('');

    const [sens, setSens] = useState<Sens>('transfert');
    const [sourceId, setSourceId] = useState<string>('');
    const [destId, setDestId] = useState<string>('');
    const [articleId, setArticleId] = useState<string>('');
    const [articleQuery, setArticleQuery] = useState<string>('');
    const [articleLimit, setArticleLimit] = useState<number>(20);
    const [quantite, setQuantite] = useState<number>(1);
    const [note, setNote] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const refresh = async () => {
        const [bs, ts] = await Promise.all([
            window.db.boutiques.getAll(),
            window.db.transfertsStock.getAll(),
        ]);
        setBoutiques(bs ?? []);
        setTransferts(ts ?? []);
        const actives = (bs ?? []).filter((b: Boutique) => b.statut === 'actif');
        const entries = await Promise.all(
            actives.map(async (b: Boutique) => {
                const rows: StockEntry[] = (await window.db.stocksBoutique.getByBoutique(b.id)) ?? [];
                return [b.id, rows] as const;
            }),
        );
        setStockByBoutique(Object.fromEntries(entries));
    };

    useEffect(() => {
        refresh();
    }, []);

    const boutiquesActives = useMemo(
        () =>
            boutiques
                .filter((b) => b.statut === 'actif')
                .sort((a, b) => {
                    if (a.isPrincipal !== b.isPrincipal) return a.isPrincipal ? -1 : 1;
                    return a.nom.localeCompare(b.nom);
                }),
        [boutiques],
    );

    useEffect(() => {
        if (!sourceId && boutiquesActives.length > 0) {
            const principal = boutiquesActives.find((b) => b.isPrincipal);
            setSourceId(principal?.id ?? boutiquesActives[0]!.id);
        }
    }, [boutiquesActives, sourceId]);

    const articleSelected = articles.find((a) => a.id === articleId) ?? null;
    const articlesMatching = useMemo(() => {
        const q = articleQuery.trim().toLowerCase();
        const base = articles.filter((a) => a.statut === 'actif');
        if (!q) return base;
        return base.filter((a) =>
            [a.nom, a.reference].filter(Boolean).join(' ').toLowerCase().includes(q),
        );
    }, [articles, articleQuery]);

    const articlesFiltered = useMemo(
        () => articlesMatching.slice(0, articleLimit),
        [articlesMatching, articleLimit],
    );

    useEffect(() => {
        setArticleLimit(20);
    }, [articleQuery]);

    useEffect(() => {
        if (!articleId) return;
        if (stockByArticle[articleId]) return;
        window.db.stocksBoutique.getByArticle(articleId).then((rows: StockEntry[]) => {
            setStockByArticle((prev) => ({ ...prev, [articleId]: rows ?? [] }));
        });
    }, [articleId, stockByArticle]);

    const stockSourceDispo = useMemo(() => {
        if (!articleId || !sourceId) return 0;
        const rows = stockByArticle[articleId] ?? [];
        return rows
            .filter((r) => r.boutiqueId === sourceId && !r.varianteId)
            .reduce((sum, r) => sum + (r.quantite || 0), 0);
    }, [articleId, sourceId, stockByArticle]);

    const stockParBoutique = useMemo(() => {
        if (!articleId) return [] as Array<{ boutique: Boutique; quantite: number }>;
        const rows = stockByArticle[articleId] ?? [];
        return boutiquesActives.map((b) => {
            const q = rows
                .filter((r) => r.boutiqueId === b.id && !r.varianteId)
                .reduce((sum, r) => sum + (r.quantite || 0), 0);
            return { boutique: b, quantite: q };
        });
    }, [articleId, stockByArticle, boutiquesActives]);

    const needSource = sens === 'transfert' || sens === 'retrait';
    const needDest = sens === 'transfert' || sens === 'ajout';

    const validate = (): string | null => {
        if (!articleId) return 'Sélectionne un article.';
        if (!Number.isFinite(quantite) || quantite <= 0) return 'Quantité invalide.';
        if (needSource && !sourceId) return 'Sélectionne la boutique source.';
        if (needDest && !destId) return 'Sélectionne la boutique destination.';
        if (sens === 'transfert' && sourceId === destId)
            return 'La source et la destination doivent être différentes.';
        if (needSource && quantite > stockSourceDispo)
            return `Stock insuffisant : ${stockSourceDispo} disponible.`;
        return null;
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        const v = validate();
        if (v) {
            setError(v);
            return;
        }
        if (!user) {
            setError('Session expirée.');
            return;
        }
        setSubmitting(true);
        try {
            await window.db.transfertsStock.execute({
                articleId,
                varianteId: undefined,
                boutiqueSourceId: needSource ? sourceId : undefined,
                boutiqueDestId: needDest ? destId : undefined,
                quantite,
                sens,
                userId: user.id,
                note: note.trim() || undefined,
            });
            setStockByArticle((prev) => {
                const next = { ...prev };
                delete next[articleId];
                return next;
            });
            setSuccess('Opération enregistrée.');
            setQuantite(1);
            setNote('');
            await refresh();
        } catch (e: any) {
            setError(e?.message || 'Échec de l’opération');
        } finally {
            setSubmitting(false);
        }
    };

    const boutiqueById = useMemo(() => {
        const m = new Map<string, Boutique>();
        boutiques.forEach((b) => m.set(b.id, b));
        return m;
    }, [boutiques]);

    const articleById = useMemo(() => {
        const m = new Map<string, (typeof articles)[number]>();
        articles.forEach((a) => m.set(a.id, a));
        return m;
    }, [articles]);

    const globalStockRows = useMemo(() => {
        // Map articleId -> { boutiqueId -> qty, total }
        const matrix = new Map<string, { perBoutique: Record<string, number>; total: number }>();
        for (const b of boutiquesActives) {
            const rows = stockByBoutique[b.id] ?? [];
            for (const r of rows) {
                if (!r.articleId) continue;
                const entry = matrix.get(r.articleId) ?? { perBoutique: {}, total: 0 };
                entry.perBoutique[b.id] = (entry.perBoutique[b.id] || 0) + (r.quantite || 0);
                entry.total += r.quantite || 0;
                matrix.set(r.articleId, entry);
            }
        }
        const q = globalQuery.trim().toLowerCase();
        const list = Array.from(matrix.entries()).map(([aid, val]) => {
            const art = articleById.get(aid);
            return {
                articleId: aid,
                nom: art?.nom ?? '—',
                reference: art?.reference ?? '',
                perBoutique: val.perBoutique,
                total: val.total,
            };
        });
        const filtered = q
            ? list.filter((row) =>
                [row.nom, row.reference].filter(Boolean).join(' ').toLowerCase().includes(q),
            )
            : list;
        return filtered.sort((a, b) => a.nom.localeCompare(b.nom));
    }, [boutiquesActives, stockByBoutique, articleById, globalQuery]);

    if (!canWrite) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50">
                <div className="text-sm text-gray-500">Tu n’as pas la permission de gérer les stocks.</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="px-6 pt-4 pb-3 bg-white border-b border-slate-100">
                <Title title="Répartition du stock" />
                <div className="text-xs text-gray-500 mt-1">
                    Transférer, ajouter ou retirer du stock entre les boutiques.
                </div>
            </div>

            <div data-os-scroll className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* FORM */}
                    <form
                        onSubmit={submit}
                        className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4"
                    >
                        <div className="flex bg-slate-100 rounded-full p-1 max-w-md">
                            {(['transfert', 'ajout', 'retrait'] as Sens[]).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setSens(s)}
                                    className={`flex-1 h-8 rounded-full text-xs capitalize ${sens === s ? 'bg-white shadow-sm font-medium' : 'text-gray-500'
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {needSource && (
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500">Boutique source</span>
                                    <select
                                        value={sourceId}
                                        onChange={(e) => setSourceId(e.target.value)}
                                        className="h-10 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                                    >
                                        <option value="">— Choisir —</option>
                                        {boutiquesActives.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.nom}
                                                {b.isPrincipal ? ' (principal)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            {needDest && (
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500">Boutique destination</span>
                                    <select
                                        value={destId}
                                        onChange={(e) => setDestId(e.target.value)}
                                        className="h-10 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                                    >
                                        <option value="">— Choisir —</option>
                                        {boutiquesActives
                                            .filter((b) => b.id !== sourceId)
                                            .map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.nom}
                                                    {b.isPrincipal ? ' (principal)' : ''}
                                                </option>
                                            ))}
                                    </select>
                                </label>
                            )}
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Article</span>
                            {articleSelected ? (
                                <div className="flex items-center justify-between gap-2 h-12 px-3 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{articleSelected.nom}</div>
                                        <div className="text-xs text-gray-500 truncate">
                                            {articleSelected.reference}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setArticleId('');
                                            setArticleQuery('');
                                        }}
                                        className="text-xs text-slate-600 hover:underline"
                                    >
                                        Changer
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="h-10 pl-3 pr-2 flex items-center bg-slate-100 rounded-lg">
                                        <input
                                            value={articleQuery}
                                            onChange={(e) => setArticleQuery(e.target.value)}
                                            type="text"
                                            className="focus:outline-none flex-1 bg-transparent text-sm"
                                            placeholder="Chercher un article par nom ou référence"
                                        />
                                        <FluentSearch32Filled className="h-4 w-4 text-gray-500" />
                                    </div>
                                    {(articleQuery || articlesFiltered.length > 0) && (
                                        <div className="mt-1 max-h-120 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                                            {articlesFiltered.length === 0 ? (
                                                <div className="text-xs text-gray-400 px-3 py-2">Aucun article</div>
                                            ) : (
                                                articlesFiltered.map((a) => (
                                                    <button
                                                        key={a.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setArticleId(a.id);
                                                            setArticleQuery('');
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-slate-50 grid grid-cols-5"
                                                    >
                                                        <span className="text-sm truncate col-span-3">{a.nom}</span>
                                                        <span className="text-xs text-gray-400 ml-2">
                                                            {a.reference}
                                                        </span>
                                                        <span className="text-xs text-gray-400 ml-2">{a.stockTotal}</span>
                                                    </button>
                                                ))

                                            )}
                                            {articlesMatching.length > articlesFiltered.length && (
                                                <button
                                                    type="button"
                                                    onClick={() => setArticleLimit((n) => n + 20)}
                                                    className="w-full text-center text-xs text-slate-600 hover:bg-slate-50 py-2 border-t border-slate-100"
                                                >
                                                    Charger plus de produit ({articlesMatching.length - articlesFiltered.length} restant{articlesMatching.length - articlesFiltered.length > 1 ? 's' : ''})
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {articleId && (
                            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                                <div className="text-xs text-gray-500 mb-2">Stock par boutique</div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {stockParBoutique.map((row) => (
                                        <div
                                            key={row.boutique.id}
                                            className={`px-3 py-2 rounded-lg text-xs border ${row.boutique.id === sourceId
                                                ? 'border-slate-400 bg-white'
                                                : 'border-slate-200 bg-white'
                                                }`}
                                        >
                                            <div className="truncate">{row.boutique.nom}</div>
                                            <div className="font-semibold text-slate-800">{row.quantite}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-gray-500">
                                    Quantité {needSource && articleId ? `(dispo : ${stockSourceDispo})` : ''}
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    value={quantite}
                                    onChange={(e) => setQuantite(parseInt(e.target.value, 10) || 0)}
                                    className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
                                />
                            </label>
                            <label className="flex flex-col gap-1">
                                <span className="text-xs text-gray-500">Note (optionnel)</span>
                                <input
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
                                    placeholder="Raison, référence interne…"
                                />
                            </label>
                        </div>

                        {error && <div className="text-sm text-red-600">{error}</div>}
                        {success && <div className="text-sm text-emerald-600">{success}</div>}

                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="h-10 px-5 rounded-full text-sm bg-slate-900 text-white disabled:opacity-50"
                            >
                                {submitting
                                    ? 'Enregistrement…'
                                    : sens === 'transfert'
                                        ? 'Transférer'
                                        : sens === 'ajout'
                                            ? 'Ajouter au stock'
                                            : 'Retirer du stock'}
                            </button>
                        </div>
                    </form>

                    {/* HISTORIQUE */}
                    <aside className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col min-h-0">
                        <div className="flex items-center gap-2">
                            <FluentArchive32Regular className="h-4 w-4 text-slate-600" />
                            <span className="text-sm font-medium">Historique récent</span>
                        </div>
                        <div data-os-scroll className="mt-3 flex-1 overflow-y-auto flex flex-col gap-2">
                            {transferts.length === 0 ? (
                                <div className="text-xs text-gray-400">Aucune opération.</div>
                            ) : (
                                transferts.slice(0, 50).map((t) => {
                                    const art = articleById.get(t.articleId);
                                    const src = t.boutiqueSourceId ? boutiqueById.get(t.boutiqueSourceId) : null;
                                    const dst = t.boutiqueDestId ? boutiqueById.get(t.boutiqueDestId) : null;
                                    return (
                                        <div
                                            key={t.id}
                                            className="rounded-lg border border-slate-200 p-2 text-xs flex flex-col gap-1"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${t.sens === 'transfert'
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : t.sens === 'ajout'
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-rose-50 text-rose-700'
                                                        }`}
                                                >
                                                    {t.sens}
                                                </span>
                                                <span className="text-gray-400">{formatDate(t.createdAt)}</span>
                                            </div>
                                            <div className="truncate">
                                                <span className="font-medium">{art?.nom ?? 'Article'}</span>
                                                <span className="text-gray-500"> × {t.quantite}</span>
                                            </div>
                                            <div className="text-gray-500 truncate">
                                                {src?.nom ?? '—'} → {dst?.nom ?? '—'}
                                            </div>
                                            {t.note && <div className="text-gray-400 truncate">« {t.note} »</div>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function formatDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}
