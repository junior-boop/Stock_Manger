import { useEffect, useMemo, useRef, useState } from "react";
import { useDatabase } from "../databaseProvider";
import ExcelParserWorker from "../workers/excel_parser.worker.ts?worker";
import { useImportExcelStore } from "../context/open_product";
import { Article, Collection, SousCollection } from "../Databases/db.d";
import {
    FluentAdd32Regular,
    FluentCloudArrowUp32Regular,
    FluentDelete32Regular,
    FluentSearch32Filled,
    SvgSpinners180Ring,
} from "../libs/icons";
import { useAlerts } from "./alerts";
import ScrollArea from "./scroll_area";

type ParsedItem = {
    key: string;
    nom: string;
    reference: string;
    description: string;
    unite: string;
    prixHT: number;
    tauxTVA: number;
    prixTTC: number;
    stockTotal: number;
    longueur: number;
    largeur: number;
    hauteur: number;
    collectionId: string;
    sousCollectionId: string;
};

const TVA_DEFAUT = 18;
const PAGE_SIZE = 250;

type ColumnMapping = {
    nom: number;
    ref: number;
    description: number;
    unite: number;
    prixHT: number;
    tauxTVA: number;
    prix: number;
    dimensions: number;
    stock: number;
};

type WorkerOutMsg =
    | { id: number; type: "parse"; ok: true; headers: string[]; rows: unknown[][]; detected: ColumnMapping }
    | { id: number; type: "build"; ok: true; items: ParsedItem[] }
    | { id: number; ok: false; error: string };

const FIELD_LABELS: { key: keyof ColumnMapping; label: string; hint: string; required: boolean }[] = [
    { key: "nom", label: "Nom du produit", hint: "Le libellé qui sera affiché", required: true },
    { key: "ref", label: "Référence", hint: "Code unique (sera généré si vide)", required: false },
    { key: "description", label: "Description", hint: "Description détaillée du produit", required: false },
    { key: "unite", label: "Unité", hint: "unité, lot, m², m³, ml", required: false },
    { key: "prixHT", label: "Prix HT", hint: "Prix hors taxes", required: false },
    { key: "tauxTVA", label: "Taux TVA (%)", hint: "Pourcentage de TVA (ex. 18)", required: false },
    { key: "prix", label: "Prix TTC", hint: "Prix toutes taxes comprises", required: false },
    { key: "dimensions", label: "Dimensions", hint: "Format DDxDDxDDcm — sinon extrait du nom", required: false },
    { key: "stock", label: "Stock", hint: "Quantité en stock", required: false },
];

const EMPTY_MAPPING: ColumnMapping = {
    nom: -1,
    ref: -1,
    description: -1,
    unite: -1,
    prixHT: -1,
    tauxTVA: -1,
    prix: -1,
    dimensions: -1,
    stock: -1,
};

export default function ImportExcelModal() {
    const { open_import, set_import } = useImportExcelStore();
    const { collections, sousCollections, createCollection, createSousCollection, createArticle } = useDatabase();
    const { success, error: notifyError } = useAlerts();

    const [step, setStep] = useState<"pick" | "map" | "review" | "summary">("pick");
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<unknown[][]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
    const [items, setItems] = useState<ParsedItem[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState("");
    const [bulkCollectionId, setBulkCollectionId] = useState("");
    const [bulkSousCollectionId, setBulkSousCollectionId] = useState("");
    const [newCollectionName, setNewCollectionName] = useState("");
    const [newSousCollectionName, setNewSousCollectionName] = useState("");
    const [filterCollection, setFilterCollection] = useState<string>("");
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [dragOver, setDragOver] = useState(false);
    const [extractDims, setExtractDims] = useState(true);
    const [parsing, setParsing] = useState(false);
    const [page, setPage] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const lastSelectedKeyRef = useRef<string | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const pendingRef = useRef<Map<number, (msg: WorkerOutMsg) => void>>(new Map());
    const reqIdRef = useRef(0);

    useEffect(() => {
        const w = new ExcelParserWorker();
        w.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
            const cb = pendingRef.current.get(e.data.id);
            if (cb) {
                pendingRef.current.delete(e.data.id);
                cb(e.data);
            }
        };
        workerRef.current = w;
        return () => {
            w.terminate();
            workerRef.current = null;
            pendingRef.current.clear();
        };
    }, []);

    const callWorker = <T extends WorkerOutMsg>(payload: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
            const w = workerRef.current;
            if (!w) return reject(new Error("Worker non initialisé"));
            const id = ++reqIdRef.current;
            pendingRef.current.set(id, (msg) => {
                if (!msg.ok) reject(new Error(msg.error));
                else resolve(msg as T);
            });
            w.postMessage({ id, ...payload }, transfer);
        });
    };

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((it) => {
            if (q && !it.nom.toLowerCase().includes(q) && !it.reference.toLowerCase().includes(q)) return false;
            if (filterCollection === "__none__" && it.collectionId) return false;
            if (filterCollection && filterCollection !== "__none__" && it.collectionId !== filterCollection) return false;
            return true;
        });
    }, [items, search, filterCollection]);

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageItems = useMemo(
        () => filteredItems.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
        [filteredItems, safePage]
    );

    useEffect(() => {
        setPage(0);
    }, [search, filterCollection, items.length]);

    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            let changed = false;
            const next = new Set(prev);
            for (const it of items) {
                if (it.collectionId && next.has(it.key)) {
                    next.delete(it.key);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [items]);

    const filteredSousForBulk = useMemo(
        () => sousCollections.filter((s) => s.collectionId === bulkCollectionId),
        [sousCollections, bulkCollectionId]
    );

    if (!open_import) return null;

    const resetAll = () => {
        setStep("pick");
        setRawHeaders([]);
        setRawRows([]);
        setMapping(EMPTY_MAPPING);
        setItems([]);
        setSelected(new Set());
        setSearch("");
        setBulkCollectionId("");
        setBulkSousCollectionId("");
        setNewCollectionName("");
        setNewSousCollectionName("");
        setFilterCollection("");
        setProgress({ done: 0, total: 0 });
    };

    const handleClose = () => {
        if (importing) return;
        resetAll();
        set_import();
    };

    const parseFile = async (file: File) => {
        try {
            setParsing(true);
            const buf = await file.arrayBuffer();
            const res = await callWorker<Extract<WorkerOutMsg, { type: "parse" }>>(
                { type: "parse", buffer: buf },
                [buf]
            );
            setRawHeaders(res.headers);
            setRawRows(res.rows);
            setMapping(res.detected);
            setStep("map");
        } catch (e) {
            console.error(e);
            notifyError("Erreur de lecture", e instanceof Error ? e.message : "Impossible de lire le fichier Excel.");
        } finally {
            setParsing(false);
        }
    };

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const first = files[0];
        if (!first) return;
        parseFile(first);
    };

    const buildItemsFromMapping = async () => {
        if (mapping.nom < 0) {
            notifyError("Colonne manquante", "La colonne « Nom du produit » doit être associée.");
            return;
        }
        try {
            setParsing(true);
            const res = await callWorker<Extract<WorkerOutMsg, { type: "build" }>>({
                type: "build",
                rows: rawRows,
                mapping,
                extractDims,
            });
            if (res.items.length === 0) {
                notifyError("Aucun produit", "Aucune ligne exploitable détectée avec ce mapping.");
                return;
            }
            setItems(res.items);
            setStep("review");
        } catch (e) {
            console.error(e);
            notifyError("Erreur", e instanceof Error ? e.message : "Échec du traitement.");
        } finally {
            setParsing(false);
        }
    };

    const isLocked = (key: string) => {
        const it = items.find((i) => i.key === key);
        return !!(it && it.collectionId);
    };

    const toggleSelect = (key: string, shiftKey: boolean) => {
        if (isLocked(key)) return;
        const anchor = lastSelectedKeyRef.current;
        if (shiftKey && anchor && anchor !== key) {
            const keys = filteredItems.filter((i) => !i.collectionId).map((i) => i.key);
            const a = keys.indexOf(anchor);
            const b = keys.indexOf(key);
            if (a !== -1 && b !== -1) {
                const [from, to] = a < b ? [a, b] : [b, a];
                const range = keys.slice(from, to + 1);
                const shouldSelect = !selected.has(key);
                setSelected((prev) => {
                    const next = new Set(prev);
                    range.forEach((k) => {
                        if (shouldSelect) next.add(k);
                        else next.delete(k);
                    });
                    return next;
                });
                lastSelectedKeyRef.current = key;
                return;
            }
        }
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
        lastSelectedKeyRef.current = key;
    };

    const toggleSelectAllFiltered = () => {
        const filteredKeys = filteredItems.filter((i) => !i.collectionId).map((i) => i.key);
        const allSelected = filteredKeys.length > 0 && filteredKeys.every((k) => selected.has(k));
        setSelected((prev) => {
            const next = new Set(prev);
            if (allSelected) filteredKeys.forEach((k) => next.delete(k));
            else filteredKeys.forEach((k) => next.add(k));
            return next;
        });
    };

    const updateItem = (key: string, patch: Partial<ParsedItem>) => {
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
    };

    const removeItems = (keys: Set<string>) => {
        setItems((prev) => prev.filter((it) => !keys.has(it.key)));
        setSelected(new Set());
    };

    const handleCreateNewCollection = async () => {
        const nom = newCollectionName.trim();
        if (!nom) return;
        const created = await createCollection({ nom, ordre: collections.length, description: "Importé depuis Excel" });
        if (created) {
            setBulkCollectionId(created.id);
            setBulkSousCollectionId("");
            setNewCollectionName("");
            success("Collection créée", nom);
        }
    };

    const handleCreateNewSousCollection = async () => {
        const nom = newSousCollectionName.trim();
        if (!nom || !bulkCollectionId) return;
        const created = await createSousCollection({
            nom,
            collectionId: bulkCollectionId,
            ordre: filteredSousForBulk.length,
            statut: "actif",
            image: "",
            description: "",
        } as Partial<SousCollection>);
        if (created) {
            setBulkSousCollectionId(created.id);
            setNewSousCollectionName("");
            success("Sous-collection créée", nom);
        }
    };

    const applyBulkAssign = () => {
        if (!bulkCollectionId || selected.size === 0) return;
        setItems((prev) =>
            prev.map((it) =>
                selected.has(it.key)
                    ? { ...it, collectionId: bulkCollectionId, sousCollectionId: bulkSousCollectionId }
                    : it
            )
        );
        setSelected(new Set());
        lastSelectedKeyRef.current = null;
    };

    const readyItems = items.filter((it) => it.collectionId);

    const runImport = async () => {
        if (readyItems.length === 0) {
            notifyError("Rien à importer", "Aucun produit n'a de collection assignée.");
            return;
        }
        setImporting(true);
        setProgress({ done: 0, total: readyItems.length });
        const now = new Date().toISOString();
        let done = 0;
        const ALLOWED_UNITES = new Set(["unité", "lot", "m²", "m³", "ml"]);
        for (const it of readyItems) {
            const tauxTVA = it.tauxTVA > 0 ? it.tauxTVA : TVA_DEFAUT;
            let prixHT = it.prixHT;
            let prixTTC = it.prixTTC;
            if (prixHT > 0 && prixTTC <= 0) prixTTC = Math.round(prixHT * (1 + tauxTVA / 100));
            else if (prixTTC > 0 && prixHT <= 0) prixHT = Math.round(prixTTC / (1 + tauxTVA / 100));
            const unite = ALLOWED_UNITES.has(it.unite) ? (it.unite as Article["unite"]) : "unité";
            const reference =
                it.reference || (await window.db.articles.generateReference(it.collectionId)) || `ART-${Date.now()}-${done}`;
            const article: Partial<Article> = {
                collectionId: it.collectionId,
                ...(it.sousCollectionId ? { sousCollectionId: it.sousCollectionId } : {}),
                nom: it.nom,
                reference,
                ...(it.description ? { description: it.description } : {}),
                unite,
                prixHT,
                tauxTVA,
                prixTTC,
                images: [],
                dimensions: { longueur: it.longueur, largeur: it.largeur, hauteur: it.hauteur },
                stockTotal: it.stockTotal,
                statut: "actif",
                createdAt: now,
                updatedAt: now,
                createdBy: "",
            };
            try {
                await createArticle(article);
            } catch (e) {
                console.error("Erreur import ligne", it.nom, e);
            }
            done++;
            setProgress({ done, total: readyItems.length });
        }
        setImporting(false);
        success("Import terminé", `${done} produit(s) importé(s).`);
        resetAll();
        set_import();
    };

    return (
        <div className="absolute top-0 left-0 w-full h-full bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-[92%] max-w-[1200px] h-[88%] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-light">Importer depuis Excel</h2>
                        <p className="text-sm text-gray-400">
                            {step === "pick"
                                ? "Choisissez un fichier .xls ou .xlsx contenant vos produits"
                                : step === "map"
                                ? `Associez les colonnes du fichier (${rawHeaders.length}) aux champs · ${rawRows.length} ligne(s)`
                                : step === "review"
                                ? `${items.length} produit(s) détecté(s) · ${readyItems.length} prêt(s) à importer`
                                : `Vérification finale avant import`}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={importing}
                        className="text-gray-500 hover:text-gray-800 text-xl disabled:opacity-50"
                    >
                        ✕
                    </button>
                </div>

                {step === "pick" && (
                    <div className="flex-1 p-10 flex items-center justify-center">
                        <div
                            onClick={() => fileRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                handleFiles(e.dataTransfer.files);
                            }}
                            className={`w-full max-w-[640px] border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
                                dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                            }`}
                        >
                            {parsing ? (
                                <SvgSpinners180Ring className="h-14 w-14 mx-auto text-gray-400" />
                            ) : (
                                <FluentCloudArrowUp32Regular className="h-14 w-14 mx-auto text-gray-400" />
                            )}
                            <p className="mt-4 text-lg">{parsing ? "Lecture du fichier en cours..." : "Cliquez ou glissez votre fichier ici"}</p>
                            <p className="text-sm text-gray-400 mt-2">Formats acceptés : .xls, .xlsx</p>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".xls,.xlsx"
                                className="hidden"
                                onChange={(e) => handleFiles(e.target.files)}
                            />
                        </div>
                    </div>
                )}

                {step === "map" && (
                    <>
                    <ScrollArea className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-[900px] mx-auto flex flex-col gap-6">
                            <div className="text-sm text-gray-500">
                                Pour chaque champ de la base, choisissez la colonne du fichier qui lui correspond. La colonne « Nom du produit » est obligatoire.
                            </div>
                            <div className="flex flex-col gap-4">
                                {FIELD_LABELS.map((f) => {
                                    const colIdx = mapping[f.key];
                                    const preview = colIdx >= 0
                                        ? rawRows.slice(0, 3).map((r) => String(r[colIdx] ?? "").trim()).filter(Boolean)
                                        : [];
                                    return (
                                        <div key={f.key} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="font-semibold flex items-center gap-2">
                                                        {f.label}
                                                        {f.required && <span className="text-xs text-red-500">obligatoire</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-400">{f.hint}</div>
                                                </div>
                                                <select
                                                    value={colIdx}
                                                    onChange={(e) =>
                                                        setMapping((m) => ({ ...m, [f.key]: parseInt(e.target.value) }))
                                                    }
                                                    className={`p-2 border rounded-lg bg-white min-w-[280px] ${
                                                        f.required && colIdx < 0 ? "border-amber-400 bg-amber-50" : "border-slate-200"
                                                    }`}
                                                >
                                                    <option value={-1}>— Ignorer ce champ —</option>
                                                    {rawHeaders.map((h, idx) => (
                                                        <option key={idx} value={idx}>
                                                            {h || `Colonne ${idx + 1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            {preview.length > 0 && (
                                                <div className="text-xs text-gray-500 bg-slate-50 rounded-lg px-3 py-2">
                                                    <span className="text-gray-400">Aperçu :</span>{" "}
                                                    {preview.map((p, i) => (
                                                        <span key={i}>
                                                            {i > 0 && <span className="text-gray-300"> · </span>}
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {f.key === "nom" && (
                                                <label className="flex items-start gap-2 text-xs text-gray-600 mt-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={extractDims}
                                                        onChange={(e) => setExtractDims(e.target.checked)}
                                                        className="mt-0.5"
                                                    />
                                                    <span>
                                                        Extraire les dimensions du nom (formats <span className="font-mono">DDxDDxDDcm</span>, <span className="font-mono">DD/DDxDDcm</span>, <span className="font-mono">DDxDDcm</span>) vers longueur / largeur / hauteur, et les retirer du libellé.
                                                    </span>
                                                </label>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </ScrollArea>
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={() => {
                                setStep("pick");
                                setRawHeaders([]);
                                setRawRows([]);
                            }}
                            className="px-5 py-2 border border-slate-200 rounded-full"
                        >
                            ← Changer de fichier
                        </button>
                        <button
                            onClick={buildItemsFromMapping}
                            disabled={mapping.nom < 0 || parsing}
                            className="px-6 py-2 bg-blue-800 text-white rounded-full min-w-[180px] disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            {parsing ? <><SvgSpinners180Ring className="h-4 w-4" />Traitement...</> : "Continuer →"}
                        </button>
                    </div>
                    </>
                )}

                {step === "review" && (
                    <>
                    <div className="flex-1 flex min-h-0">
                        <ScrollArea as="aside" className="w-[340px] border-r border-slate-100 flex flex-col p-4 gap-3 overflow-y-auto">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Affecter à</div>
                                <select
                                    value={bulkCollectionId}
                                    onChange={(e) => {
                                        setBulkCollectionId(e.target.value);
                                        setBulkSousCollectionId("");
                                    }}
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                                >
                                    <option value="">— Choisir une collection —</option>
                                    {collections.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nom}
                                        </option>
                                    ))}
                                </select>
                                <div className="mt-2 flex gap-2">
                                    <input
                                        type="text"
                                        value={newCollectionName}
                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                        placeholder="Nouvelle collection..."
                                        className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                    <button
                                        onClick={handleCreateNewCollection}
                                        disabled={!newCollectionName.trim()}
                                        className="px-3 bg-slate-800 text-white rounded-lg disabled:opacity-40"
                                    >
                                        <FluentAdd32Regular className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: bulkCollectionId ? undefined : "none" }}>
                                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Sous-collection</div>
                                    <select
                                        value={bulkSousCollectionId}
                                        onChange={(e) => setBulkSousCollectionId(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                                    >
                                        <option value="">— Aucune —</option>
                                        {filteredSousForBulk.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.nom}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="text"
                                            value={newSousCollectionName}
                                            onChange={(e) => setNewSousCollectionName(e.target.value)}
                                            placeholder="Nouvelle sous-collection..."
                                            className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                                        />
                                        <button
                                            onClick={handleCreateNewSousCollection}
                                            disabled={!newSousCollectionName.trim()}
                                            className="px-3 bg-slate-800 text-white rounded-lg disabled:opacity-40"
                                        >
                                            <FluentAdd32Regular className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                            <button
                                onClick={applyBulkAssign}
                                disabled={!bulkCollectionId || selected.size === 0}
                                className="mt-2 w-full py-2 bg-blue-800 text-white rounded-full disabled:opacity-40"
                            >
                                Affecter {selected.size > 0 ? `(${selected.size})` : ""}
                            </button>

                            <div className="border-t border-slate-100 pt-3 mt-2">
                                <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Filtrer la liste</div>
                                <select
                                    value={filterCollection}
                                    onChange={(e) => setFilterCollection(e.target.value)}
                                    className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                                >
                                    <option value="">Tous les produits</option>
                                    <option value="__none__">Non assignés</option>
                                    {collections.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.nom}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => selected.size > 0 && removeItems(selected)}
                                disabled={selected.size === 0}
                                className="w-full py-2 border border-red-200 text-red-600 rounded-full disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
                            >
                                <FluentDelete32Regular className="h-4 w-4" />
                                Retirer {selected.size > 0 ? `(${selected.size})` : ""}
                            </button>
                        </ScrollArea>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                                <div className="flex items-center flex-1 bg-slate-100 rounded-full px-4 h-10">
                                    <FluentSearch32Filled className="h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Rechercher un produit..."
                                        className="flex-1 bg-transparent outline-none px-2 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={toggleSelectAllFiltered}
                                    className="text-sm px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200"
                                >
                                    {filteredItems.every((i) => selected.has(i.key)) && filteredItems.length > 0
                                        ? "Tout désélectionner"
                                        : "Tout sélectionner"}
                                </button>
                            </div>

                            <ScrollArea className="flex-1 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white border-b border-slate-100 text-xs uppercase text-gray-400">
                                        <tr>
                                            <th className="px-4 py-2 w-10"></th>
                                            <th className="text-left px-2 py-2">Produit</th>
                                            <th className="text-left px-2 py-2 w-32">Réf.</th>
                                            <th className="text-right px-2 py-2 w-28">Prix TTC</th>
                                            <th className="text-right px-2 py-2 w-20">Stock</th>
                                            <th className="text-left px-2 py-2 w-56">Collection</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageItems.map((it) => (
                                            <Row
                                                key={it.key}
                                                item={it}
                                                checked={selected.has(it.key)}
                                                onToggle={(shiftKey) => toggleSelect(it.key, shiftKey)}
                                                onChange={(patch) => updateItem(it.key, patch)}
                                                collections={collections}
                                                sousCollections={sousCollections}
                                            />
                                        ))}
                                        {filteredItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-10 text-gray-400">
                                                    Aucun produit ne correspond
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </ScrollArea>
                            {filteredItems.length > PAGE_SIZE ? (
                                <div className="px-5 py-2 border-t border-slate-100 flex items-center justify-between text-sm">
                                    <div className="text-gray-500">
                                        {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredItems.length)} sur {filteredItems.length}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={safePage === 0}
                                            className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
                                        >
                                            ← Préc.
                                        </button>
                                        <span className="text-gray-500">
                                            Page {safePage + 1} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={safePage >= totalPages - 1}
                                            className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
                                        >
                                            Suiv. →
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            {readyItems.length} produit(s) affecté(s) sur {items.length}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
                                className="px-5 py-2 border border-slate-200 rounded-full"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => setStep("summary")}
                                disabled={readyItems.length === 0}
                                className="px-6 py-2 bg-blue-800 text-white rounded-full min-w-[180px] flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                Suivant →
                            </button>
                        </div>
                    </div>
                    </>
                )}

                {step === "summary" && (
                    <>
                    <ScrollArea className="flex-1 overflow-y-auto p-8">
                        <div className="max-w-[900px] mx-auto flex flex-col gap-6">
                            <div>
                                <h3 className="text-lg font-semibold">Récapitulatif de l'affectation</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Vérifiez la répartition des {readyItems.length} produit(s) avant l'import.
                                    {items.length - readyItems.length > 0 && (
                                        <> {items.length - readyItems.length} produit(s) non affecté(s) seront ignoré(s).</>
                                    )}
                                </p>
                            </div>
                            <SummaryGroups
                                items={readyItems}
                                collections={collections}
                                sousCollections={sousCollections}
                                onRemove={(key) => removeItems(new Set([key]))}
                            />
                        </div>
                    </ScrollArea>
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            {importing
                                ? `Import en cours : ${progress.done} / ${progress.total}`
                                : `${readyItems.length} produit(s) prêt(s) à importer`}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep("review")}
                                disabled={importing}
                                className="px-5 py-2 border border-slate-200 rounded-full disabled:opacity-40"
                            >
                                ← Retour
                            </button>
                            <button
                                onClick={runImport}
                                disabled={importing || readyItems.length === 0}
                                className="px-6 py-2 bg-blue-800 text-white rounded-full min-w-[180px] flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {importing ? (
                                    <>
                                        <SvgSpinners180Ring className="h-4 w-4" />
                                        Import...
                                    </>
                                ) : (
                                    `Importer ${readyItems.length}`
                                )}
                            </button>
                        </div>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}

function SummaryGroups({
    items,
    collections,
    sousCollections,
    onRemove,
}: {
    items: ParsedItem[];
    collections: Collection[];
    sousCollections: SousCollection[];
    onRemove: (key: string) => void;
}) {
    const groups = useMemo(() => {
        const map = new Map<string, Map<string, ParsedItem[]>>();
        for (const it of items) {
            if (!map.has(it.collectionId)) map.set(it.collectionId, new Map());
            const sub = map.get(it.collectionId)!;
            const subKey = it.sousCollectionId || "";
            if (!sub.has(subKey)) sub.set(subKey, []);
            sub.get(subKey)!.push(it);
        }
        return map;
    }, [items]);

    if (items.length === 0) {
        return <div className="text-sm text-gray-400 italic">Aucun produit affecté.</div>;
    }

    return (
        <div className="flex flex-col gap-4">
            {Array.from(groups.entries()).map(([colId, subs]) => {
                const col = collections.find((c) => c.id === colId);
                const total = Array.from(subs.values()).reduce((a, b) => a + b.length, 0);
                return (
                    <div key={colId} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="font-semibold">{col?.nom ?? "Collection inconnue"}</div>
                            <div className="text-sm text-gray-500">{total} produit(s)</div>
                        </div>
                        <div className="flex flex-col">
                            {Array.from(subs.entries()).map(([subId, list]) => {
                                const sub = sousCollections.find((s) => s.id === subId);
                                return (
                                    <div key={subId || "__none__"} className="px-4 py-3 border-b border-slate-100 last:border-b-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm font-medium text-gray-700">
                                                {sub?.nom ?? <span className="italic text-gray-400">Sans sous-collection</span>}
                                            </div>
                                            <div className="text-xs text-gray-500">{list.length} produit(s)</div>
                                        </div>
                                        <ul className="text-xs text-gray-600 flex flex-col gap-1">
                                            {list.map((it) => (
                                                <li key={it.key} className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-slate-50 rounded group">
                                                    <span className="truncate">• {it.nom}</span>
                                                    <button
                                                        onClick={() => onRemove(it.key)}
                                                        title="Retirer ce produit"
                                                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 shrink-0"
                                                    >
                                                        <FluentDelete32Regular className="h-4 w-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Row({
    item,
    checked,
    onToggle,
    onChange,
    collections,
    sousCollections,
}: {
    item: ParsedItem;
    checked: boolean;
    onToggle: (shiftKey: boolean) => void;
    onChange: (patch: Partial<ParsedItem>) => void;
    collections: Collection[];
    sousCollections: SousCollection[];
}) {
    const sousForCol = sousCollections.filter((s) => s.collectionId === item.collectionId);
    const locked = !!item.collectionId;
    return (
        <tr className={`border-b border-slate-50 ${locked ? "bg-slate-100 text-gray-400 pointer-events-none select-none" : "hover:bg-slate-50"} ${checked && !locked ? "bg-blue-50/50" : ""}`}>
            <td className="px-4 py-2">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={locked}
                    onChange={() => {}}
                    onClick={(e) => onToggle(e.shiftKey)}
                />
            </td>
            <td className="px-2 py-2">
                <input
                    type="text"
                    value={item.nom}
                    disabled={locked}
                    onChange={(e) => onChange({ nom: e.target.value })}
                    className="w-full bg-transparent outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 disabled:text-gray-400"
                />
            </td>
            <td className="px-2 py-2">
                <input
                    type="text"
                    value={item.reference}
                    disabled={locked}
                    onChange={(e) => onChange({ reference: e.target.value })}
                    placeholder="auto"
                    className="w-full bg-transparent outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 text-xs disabled:text-gray-400"
                />
            </td>
            <td className="px-2 py-2 text-right">
                <input
                    type="number"
                    value={item.prixTTC}
                    disabled={locked}
                    onChange={(e) => onChange({ prixTTC: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-transparent outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 text-right disabled:text-gray-400"
                />
            </td>
            <td className="px-2 py-2 text-right">
                <input
                    type="number"
                    value={item.stockTotal}
                    disabled={locked}
                    onChange={(e) => onChange({ stockTotal: parseInt(e.target.value) || 0 })}
                    className="w-full bg-transparent outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 text-right disabled:text-gray-400"
                />
            </td>
            <td className="px-2 py-2">
                <div className="flex flex-col gap-1">
                    <select
                        value={item.collectionId}
                        disabled={locked}
                        onChange={(e) => onChange({ collectionId: e.target.value, sousCollectionId: "" })}
                        className={`text-xs p-1 rounded border ${item.collectionId ? "border-slate-200" : "border-amber-300 bg-amber-50"} disabled:text-gray-500`}
                    >
                        <option value="">— Non assignée —</option>
                        {collections.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.nom}
                            </option>
                        ))}
                    </select>
                    <select
                        value={item.sousCollectionId}
                        disabled={locked}
                        onChange={(e) => onChange({ sousCollectionId: e.target.value })}
                        className="text-xs p-1 rounded border border-slate-200 disabled:text-gray-500"
                        style={{ display: item.collectionId !== "" && sousForCol.length > 0 ? undefined : "none" }}
                    >
                        <option value="">— Aucune —</option>
                        {sousForCol.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.nom}
                            </option>
                        ))}
                    </select>
                </div>
            </td>
        </tr>
    );
}
