import { useEffect, useMemo, useState } from 'react';
import Title from '../components/title';
import Switch from '../components/switch';
import { usePermissions } from '../auth/authProvider';
import { useDatabase } from '../databaseProvider';
import {
    FluentAdd32Regular,
    FluentSearch32Filled,
    FluentEdit32Regular,
    FluentDelete32Regular,
    FluentBuildingShop24Filled,
} from '../libs/icons';

type StockEntry = {
    id: string;
    boutiqueId: string;
    articleId: string;
    varianteId?: string | null;
    quantite: number;
};

type Boutique = {
    id: string;
    nom: string;
    adresse?: string;
    userId?: string;
    isPrincipal: boolean;
    statut: 'actif' | 'inactif' | 'archivé';
    createdAt: string;
    updatedAt: string;
};

type AdminLite = {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: string;
};

export default function BoutiquesPage() {
    const { can } = usePermissions();
    const canWrite = can('boutiques:write');
    const canDelete = can('boutiques:delete');

    const { articles, collections } = useDatabase();

    const [boutiques, setBoutiques] = useState<Boutique[]>([]);
    const [admins, setAdmins] = useState<AdminLite[]>([]);
    const [stockByBoutique, setStockByBoutique] = useState<Record<string, StockEntry[]>>({});
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<Boutique | null>(null);
    const [creating, setCreating] = useState(false);
    const [viewing, setViewing] = useState<Boutique | null>(null);

    const refresh = async () => {
        const list: Boutique[] = (await window.db.boutiques.getAll()) ?? [];
        setBoutiques(list);
        const entries = await Promise.all(
            list.map(async (b) => {
                const rows: StockEntry[] = (await window.db.stocksBoutique.getByBoutique(b.id)) ?? [];
                return [b.id, rows] as const;
            }),
        );
        setStockByBoutique(Object.fromEntries(entries));
    };

    useEffect(() => {
        refresh();
        window.db.administrateurs.getAll().then((rows: AdminLite[]) => setAdmins(rows ?? []));
    }, []);

    const adminById = useMemo(() => {
        const m = new Map<string, AdminLite>();
        admins.forEach((a) => m.set(a.id, a));
        return m;
    }, [admins]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return boutiques
            .filter((b) => {
                if (!q) return true;
                const hay = [b.nom, b.adresse].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            })
            .sort((a, b) => {
                if (a.isPrincipal !== b.isPrincipal) return a.isPrincipal ? -1 : 1;
                return a.nom.localeCompare(b.nom);
            });
    }, [boutiques, query]);

    const handleDelete = async (b: Boutique) => {
        if (b.isPrincipal) return;
        if (!confirm(`Supprimer la boutique "${b.nom}" ?`)) return;
        try {
            await window.db.boutiques.delete(b.id);
            await refresh();
        } catch (e: any) {
            alert(e?.message || 'Suppression impossible');
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-slate-50">
            <div className="px-6 pt-4 pb-3 bg-white border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <Title title="Boutiques" />
                    {canWrite && (
                        <button
                            onClick={() => setCreating(true)}
                            className="h-[36px] pl-4 pr-2 flex text-sm items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer"
                        >
                            <span>Nouvelle</span>
                            <FluentAdd32Regular className="h-5 w-5" />
                        </button>
                    )}
                </div>

                <div className="mt-3 h-[48px] pl-5 pr-2 flex items-center bg-slate-100 rounded-full max-w-md">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        type="text"
                        className="focus:outline-none flex-1 bg-transparent text-sm"
                        placeholder="Chercher une boutique"
                    />
                    <button className="w-[36px] h-[36px] flex items-center justify-center">
                        <FluentSearch32Filled className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-3 text-xs text-gray-400">
                    {filtered.length} boutique{filtered.length > 1 ? 's' : ''}
                </div>
            </div>

            <div data-os-scroll className="flex-1 overflow-y-auto px-6 py-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400">
                        {query ? 'Aucun résultat.' : 'Aucune boutique.'}
                    </div>
                ) : (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((b) => {
                            const resp = b.userId ? adminById.get(b.userId) : null;
                            return (
                                <div
                                    key={b.id}
                                    onClick={() => setViewing(b)}
                                    className="rounded-2xl bg-white border border-slate-200 p-4 flex flex-col gap-2 cursor-pointer hover:border-slate-300 hover:shadow-sm transition"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                            <FluentBuildingShop24Filled className="h-5 w-5 text-slate-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm truncate">{b.nom}</span>
                                                {b.isPrincipal && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                                        Principal
                                                    </span>
                                                )}
                                                {b.statut !== 'actif' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                        {b.statut}
                                                    </span>
                                                )}
                                            </div>
                                            {b.adresse && (
                                                <div className="text-xs text-gray-500 mt-0.5 truncate">{b.adresse}</div>
                                            )}
                                            <div className="text-xs text-gray-500 mt-1">
                                                {resp
                                                    ? `Responsable : ${resp.prenom} ${resp.nom}`
                                                    : 'Aucun responsable assigné'}
                                            </div>
                                            {(() => {
                                                const rows = stockByBoutique[b.id] ?? [];
                                                const refs = rows.filter((r) => (r.quantite || 0) > 0).length;
                                                const total = rows.reduce((s, r) => s + (r.quantite || 0), 0);
                                                return (
                                                    <div className="text-xs text-slate-600 mt-2 flex items-center gap-3">
                                                        <span><b>{refs}</b> référence{refs > 1 ? 's' : ''}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span><b>{total}</b> en stock</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {(canWrite || canDelete) && (
                                        <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                                            {canWrite && (
                                                <button
                                                    onClick={() => setEditing(b)}
                                                    className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                                                    title="Modifier"
                                                >
                                                    <FluentEdit32Regular className="h-4 w-4" />
                                                </button>
                                            )}
                                            {canDelete && !b.isPrincipal && (
                                                <button
                                                    onClick={() => handleDelete(b)}
                                                    className="h-8 w-8 rounded-full hover:bg-red-50 text-red-600 flex items-center justify-center"
                                                    title="Supprimer"
                                                >
                                                    <FluentDelete32Regular className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {viewing && (
                <BoutiqueStockModal
                    boutique={viewing}
                    articles={articles}
                    collections={collections}
                    rows={stockByBoutique[viewing.id] ?? []}
                    onClose={() => setViewing(null)}
                />
            )}

            {(creating || editing) && (
                <BoutiqueFormModal
                    boutique={editing}
                    admins={admins}
                    onClose={() => {
                        setCreating(false);
                        setEditing(null);
                    }}
                    onSaved={async () => {
                        setCreating(false);
                        setEditing(null);
                        await refresh();
                    }}
                />
            )}
        </div>
    );
}

function BoutiqueFormModal({
    boutique,
    admins,
    onClose,
    onSaved,
}: {
    boutique: Boutique | null;
    admins: AdminLite[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const isEdit = !!boutique;
    const [nom, setNom] = useState(boutique?.nom ?? '');
    const [adresse, setAdresse] = useState(boutique?.adresse ?? '');
    const [userId, setUserId] = useState<string>(boutique?.userId ?? '');
    const [actif, setActif] = useState<boolean>((boutique?.statut ?? 'actif') === 'actif');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nom.trim()) {
            setError('Le nom est requis.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const payload = {
                nom: nom.trim(),
                adresse: adresse.trim() || undefined,
                userId: userId || undefined,
                statut: actif ? 'actif' : 'inactif',
            };
            if (isEdit && boutique) {
                await window.db.boutiques.update(boutique.id, payload);
            } else {
                await window.db.boutiques.create({ ...payload, isPrincipal: false });
            }
            onSaved();
        } catch (e: any) {
            setError(e?.message || 'Échec de l’enregistrement');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <form
                onSubmit={submit}
                className="bg-white rounded-2xl w-[min(480px,92vw)] p-6 flex flex-col gap-4"
            >
                <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">
                        {isEdit ? 'Modifier la boutique' : 'Nouvelle boutique'}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 rounded-full hover:bg-slate-100"
                    >
                        ×
                    </button>
                </div>

                <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Nom *</span>
                    <input
                        autoFocus
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-sm"
                        placeholder="Ex. Boutique Centre-ville"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Adresse</span>
                    <input
                        value={adresse}
                        onChange={(e) => setAdresse(e.target.value)}
                        className="h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-sm"
                        placeholder="Adresse de la boutique"
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500">Responsable</span>
                    <select
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="h-10 px-2 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-400 text-sm bg-white"
                    >
                        <option value="">— Aucun —</option>
                        {admins.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.prenom} {a.nom} ({a.role})
                            </option>
                        ))}
                    </select>
                </label>

                <div className="flex items-center justify-between px-1">
                    <span className="text-sm">Actif</span>
                    <Switch checked={actif} onChange={setActif} aria-label="Statut actif" />
                </div>

                {boutique?.isPrincipal && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        Cette boutique est marquée comme <b>Stock principal</b> et ne peut pas être supprimée.
                    </div>
                )}

                {error && <div className="text-sm text-red-600">{error}</div>}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="h-10 px-4 rounded-full text-sm hover:bg-slate-100"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="h-10 px-5 rounded-full text-sm bg-slate-900 text-white disabled:opacity-50"
                    >
                        {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function BoutiqueStockModal({
    boutique,
    articles,
    collections,
    rows,
    onClose,
}: {
    boutique: Boutique;
    articles: Array<{ id: string; nom: string; reference?: string; unite?: string; collectionId?: string }>;
    collections: Array<{ id: string; nom: string }>;
    rows: StockEntry[];
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [openCollections, setOpenCollections] = useState<Record<string, boolean>>({});

    const articleById = useMemo(() => {
        const m = new Map<string, { id: string; nom: string; reference?: string; unite?: string; collectionId?: string }>();
        articles.forEach((a) => m.set(a.id, a));
        return m;
    }, [articles]);

    const collectionById = useMemo(() => {
        const m = new Map<string, { id: string; nom: string }>();
        collections.forEach((c) => m.set(c.id, c));
        return m;
    }, [collections]);

    type Ligne = { articleId: string; nom: string; reference: string; unite: string; quantite: number };
    type Groupe = { collectionId: string; collectionNom: string; lignes: Ligne[]; total: number; refs: number };

    const groupes: Groupe[] = useMemo(() => {
        const byArticle = new Map<string, number>();
        rows.forEach((r) => {
            const prev = byArticle.get(r.articleId) ?? 0;
            byArticle.set(r.articleId, prev + (r.quantite || 0));
        });
        const lignes: Ligne[] = Array.from(byArticle.entries()).map(([articleId, quantite]) => {
            const art = articleById.get(articleId);
            return {
                articleId,
                nom: art?.nom ?? '(article supprimé)',
                reference: art?.reference ?? '',
                unite: art?.unite ?? '',
                quantite,
            };
        });

        const q = query.trim().toLowerCase();
        const lignesFiltrees = q
            ? lignes.filter((l) => `${l.nom} ${l.reference}`.toLowerCase().includes(q))
            : lignes;

        const byCol = new Map<string, Ligne[]>();
        lignesFiltrees.forEach((l) => {
            const art = articleById.get(l.articleId);
            const cid = art?.collectionId ?? '__sans__';
            const list = byCol.get(cid) ?? [];
            list.push(l);
            byCol.set(cid, list);
        });

        return Array.from(byCol.entries())
            .map(([cid, list]) => {
                list.sort((a, b) => a.nom.localeCompare(b.nom));
                const total = list.reduce((s, l) => s + l.quantite, 0);
                const refs = list.filter((l) => l.quantite > 0).length;
                const nom = cid === '__sans__' ? 'Sans collection' : collectionById.get(cid)?.nom ?? 'Collection inconnue';
                return { collectionId: cid, collectionNom: nom, lignes: list, total, refs };
            })
            .sort((a, b) => {
                if (a.collectionId === '__sans__') return 1;
                if (b.collectionId === '__sans__') return -1;
                return a.collectionNom.localeCompare(b.collectionNom);
            });
    }, [rows, articleById, collectionById, query]);

    const totalUnites = groupes.reduce((s, g) => s + g.total, 0);
    const refsEnStock = groupes.reduce((s, g) => s + g.refs, 0);

    const isOpen = (cid: string) => openCollections[cid] ?? !!query.trim();
    const toggle = (cid: string) =>
        setOpenCollections((prev) => ({ ...prev, [cid]: !(prev[cid] ?? !!query.trim()) }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-[min(720px,94vw)] max-h-[86vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 pt-5 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-lg font-semibold truncate">État du stock — {boutique.nom}</div>
                            {boutique.adresse && (
                                <div className="text-xs text-gray-500 mt-0.5 truncate">{boutique.adresse}</div>
                            )}
                            <div className="text-xs text-slate-600 mt-2 flex items-center gap-3">
                                <span><b>{refsEnStock}</b> référence{refsEnStock > 1 ? 's' : ''}</span>
                                <span className="text-slate-300">•</span>
                                <span><b>{totalUnites}</b> unité{totalUnites > 1 ? 's' : ''} au total</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 rounded-full hover:bg-slate-100 text-lg"
                        >
                            ×
                        </button>
                    </div>

                    <div className="mt-3 h-[40px] pl-4 pr-2 flex items-center bg-slate-100 rounded-full">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            type="text"
                            className="focus:outline-none flex-1 bg-transparent text-sm"
                            placeholder="Chercher un article"
                        />
                        <FluentSearch32Filled className="h-4 w-4 mr-2 text-slate-500" />
                    </div>
                </div>

                <div data-os-scroll className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
                    {groupes.length === 0 ? (
                        <div className="text-center py-12 text-sm text-gray-400">
                            {query ? 'Aucun résultat.' : 'Aucun article en stock dans cette boutique.'}
                        </div>
                    ) : (
                        groupes.map((g) => {
                            const open = isOpen(g.collectionId);
                            return (
                                <div key={g.collectionId} className="rounded-xl border border-slate-200 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggle(g.collectionId)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`inline-block transition-transform text-slate-500 ${open ? 'rotate-90' : ''}`}>›</span>
                                            <span className="font-medium text-sm truncate">{g.collectionNom}</span>
                                            <span className="text-xs text-slate-500 ml-1">({g.refs})</span>
                                        </div>
                                        <span className="text-xs text-slate-600 tabular-nums">{g.total} unité{g.total > 1 ? 's' : ''}</span>
                                    </button>
                                    {open && (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs text-gray-500 border-b border-slate-100">
                                                    <th className="py-2 px-3 font-medium">Article</th>
                                                    <th className="py-2 px-3 font-medium">Référence</th>
                                                    <th className="py-2 px-3 font-medium text-right">Quantité</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {g.lignes.map((l) => (
                                                    <tr key={l.articleId} className="border-b border-slate-50 last:border-b-0">
                                                        <td className="py-2 px-3">{l.nom}</td>
                                                        <td className="py-2 px-3 text-gray-500">{l.reference || '—'}</td>
                                                        <td className={`py-2 px-3 text-right tabular-nums ${l.quantite <= 0 ? 'text-red-600' : ''}`}>
                                                            {l.quantite}{l.unite ? ` ${l.unite}` : ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
