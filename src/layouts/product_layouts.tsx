import { Outlet, NavLink, useLocation, useNavigate, useParams } from "react-router-dom"
import { FluentAdd32Regular, FluentAlert32Filled, FluentArrowUp32Filled, FluentCheckmark32Regular, FluentChevronRight32Filled, FluentDelete32Regular, FluentEdit32Regular, FluentFolderLink32Regular, FluentSearch32Filled, SvgSpinners180Ring, } from "../libs/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Title from "../components/title";

import { useDatabase } from "../databaseProvider"

import { create } from 'zustand'
import { Article, Collection, Facture, SousCollection } from "../Databases/db.d";
import { openNewProductWindow, useImportExcelStore } from "../context/open_product";
import NewProduct from "../pages/new_product";
import { useAlerts } from "../components/alerts";
import { FluentCloudArrowUp32Regular, FluentArrowDownload32Filled } from "../libs/icons";
import { formatFCFA } from "../libs/format";
import ScrollArea from "../components/scroll_area";

type OpenLayout = {
    get: boolean
    set: () => void
}

const useOpenLayout = create<OpenLayout>()((set) => ({
    get: false,
    set: () => set((state) => ({ get: !state.get })),
}))


export default function ProductLayouts() {
    const [isHome, setIsHome] = useState(false)
    const location = useLocation()
    const { get, set } = useOpenLayout()
    const [isLoading, setLoading] = useState(false)
    const { open_state, open_set } = openNewProductWindow()
    const [collection, setCollection] = useState<{
        nom: string | null;
        order: number;
        description: string | null;
    }>({
        nom: null,
        order: 0,
        description: null
    })

    const { createCollection } = useDatabase()
    const { error: notifyError, success } = useAlerts()


    useEffect(() => {
        const path = location.pathname;
        const checkCollection = path.includes('/collection');
        const checkArticle = path.includes('/article');
        if (checkCollection || checkArticle) setIsHome(false)
        else setIsHome(true)
    }, [location])

    const handleCreateCollection = async () => {
        if (!collection.nom) {
            notifyError("Nom requis", "Le nom de la collection est requis.")
            return
        }

        if (!collection.description) {
            notifyError("Description requise", "La description de la collection est requise.")
            return
        }

        if (collection.nom && collection.description) {
            setLoading(true)
            await createCollection({
                nom: collection.nom as string,
                ordre: collection.order,
                description: collection.description as string
            })

            setTimeout(() => {
                setLoading(false)
                success("Collection créée", collection.nom as string)
                setCollection({
                    nom: null,
                    order: 0,
                    description: null
                })
                set()
            }, 2000)
        }

        else set()
    }



    return (
        <div className="flex h-full w-full relative">
            <AsideList />
            {
                isHome
                    ? <HomeGroupPage />
                    : <Outlet />
            }

            {
                get && <div className="absolute top-0 left-0 w-full h-full opacity flex items-center justify-center z-60">
                    <div className="absolute top-[16px] left-[350px] w-[500px] h-[400px] bg-white rounded-xl flex flex-col gap-3 px-6 pb-4">
                        <Title title="Ajouter une collection" />
                        <div >
                            <input onChange={({ target }) => setCollection(e => ({ ...e, nom: target.value }))} type="text" className="w-full focus:outline-none border-slate-200 border-b py-2 px-4 bg-slate-50 rounded-full" placeholder="Nom de la collection" />
                        </div>
                        <div>
                            <input onChange={({ target }) => setCollection(e => ({ ...e, order: parseInt(target.value) || 0 }))} type="number" className="w-full focus:outline-none border-slate-200 border-b py-2 px-4 bg-slate-50 rounded-full" placeholder="Numero d'ordre" />
                        </div>
                        <div>
                            <textarea onChange={({ target }) => setCollection(e => ({ ...e, description: target.value }))} className="w-full focus:outline-none border-slate-200 border-b py-2 px-4 h-[150px] resize-none bg-slate-50 rounded-2xl" placeholder="Description de la collection" />
                        </div>
                        <div className="flex items-center gap-2 mt-auto">
                            <button onClick={handleCreateCollection} className="px-4 py-2 bg-blue-800 text-white rounded-full min-w-[175px] flex items-center justify-center">
                                {
                                    isLoading ? <SvgSpinners180Ring className="h-6 w-6" /> : "Ajouter la collection"
                                }
                            </button>
                            <button className="px-4 py-2 bg-gray-200 rounded-full" onClick={set}>Annuler</button>
                        </div>
                    </div>
                </div>
            }
            {
                open_state && (<div className="absolute top-0 left-0 w-full h-full opacity flex items-center justify-end z-60">
                    <NewProduct />
                </div>)
            }
        </div>
    )
}

const HomeGroupPage = () => {
    const { set_import } = useImportExcelStore()
    const { success, error: notifyError } = useAlerts()
    const { articles, factures } = useDatabase()
    const navigate = useNavigate()
    const [isExporting, setIsExporting] = useState(false)

    const topArticlesDuMois = useMemo(() => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
        const tally = new Map<string, { id: string; nom: string; qte: number; ca: number }>()
        for (const f of (factures as Facture[])) {
            if (f.statut === 'brouillon' || f.statut === 'annulée') continue
            const t = f.dateEmission ? new Date(f.dateEmission).getTime() : NaN
            if (Number.isNaN(t) || t < start || t >= end) continue
            for (const l of f.lignes ?? []) {
                if (!l.articleId) continue
                const prev = tally.get(l.articleId) ?? { id: l.articleId, nom: l.designation || 'Article', qte: 0, ca: 0 }
                prev.qte += l.quantite ?? 0
                prev.ca += l.montantTotalTTC ?? 0
                tally.set(l.articleId, prev)
            }
        }
        return Array.from(tally.values()).sort((a, b) => b.ca - a.ca).slice(0, 5)
    }, [factures])

    const stockFaible = useMemo(() => {
        return (articles as Article[])
            .filter((a) => a.statut !== 'inactif' && (a.stockTotal ?? 0) <= 3)
            .sort((a, b) => (a.stockTotal ?? 0) - (b.stockTotal ?? 0))
            .slice(0, 5)
    }, [articles])

    const handleExport = async () => {
        if (isExporting) return
        setIsExporting(true)
        try {
            const res = await window.exportApi.articlesExcel()
            if (res.canceled) return
            success("Export terminé", `${res.count ?? 0} article(s) exporté(s) vers ${res.filePath}`)
        } catch (e) {
            console.error(e)
            notifyError("Export échoué", "Impossible d'exporter les articles en Excel.")
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <ScrollArea className="h-dvh flex-1 overflow-x-hidden overflow-y-auto">
            <div className="px-10 py-10 flex flex-col gap-8">
                <div>
                    <h1 className="text-4xl font-light">Produits</h1>
                    <p className="text-sm text-gray-400 mt-1">Sélectionnez une collection à gauche ou importez vos produits depuis un fichier Excel.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={set_import}
                        className="flex items-center gap-3 px-5 py-3 bg-slate-800 text-white rounded-full hover:bg-slate-900"
                    >
                        <FluentCloudArrowUp32Regular className="h-5 w-5" />
                        <span>Importer depuis Excel</span>
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-200 text-slate-800 rounded-full hover:bg-slate-50 disabled:opacity-60"
                    >
                        {isExporting
                            ? <SvgSpinners180Ring className="h-5 w-5" />
                            : <FluentArrowDownload32Filled className="h-5 w-5" />}
                        <span>{isExporting ? "Export en cours…" : "Exporter en Excel"}</span>
                    </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <InsightCard
                        title="Top articles vendus"
                        subtitle="Ce mois-ci"
                        icon={<FluentArrowUp32Filled className="h-5 w-5 text-emerald-700" />}
                        tint="bg-emerald-50"
                        empty="Aucune vente ce mois-ci."
                        items={topArticlesDuMois.map((a, idx) => ({
                            key: a.id,
                            onClick: () => navigate(`/produits/article/${a.id}`),
                            title: `${idx + 1}. ${a.nom}`,
                            subtitle: `${a.qte.toLocaleString('fr-FR')} vendu${a.qte > 1 ? 's' : ''}`,
                            right: (
                                <div className="text-xs font-semibold text-emerald-700 tabular-nums">
                                    {formatFCFA(a.ca)}
                                </div>
                            ),
                        }))}
                    />
                    <InsightCard
                        title="Stock faible"
                        subtitle="≤ 3 unités"
                        icon={<FluentAlert32Filled className="h-5 w-5 text-rose-700" />}
                        tint="bg-rose-50"
                        empty="Aucun article en stock faible."
                        items={stockFaible.map((a) => ({
                            key: a.id as string,
                            onClick: () => navigate(`/produits/article/${a.id}`),
                            title: a.nom as string,
                            subtitle: a.reference || '—',
                            right: (
                                <div className={`text-xs font-semibold tabular-nums ${(a.stockTotal ?? 0) <= 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                                    {(a.stockTotal ?? 0) <= 0 ? 'Rupture' : `${a.stockTotal} en stock`}
                                </div>
                            ),
                        }))}
                    />
                </div>
            </div>
        </ScrollArea>
    )
}

type InsightItem = {
    key: string
    onClick: () => void
    title: string
    subtitle: string
    right: React.ReactNode
}

function InsightCard({
    title, subtitle, icon, tint, items, empty,
}: {
    title: string
    subtitle: string
    icon: React.ReactNode
    tint: string
    items: InsightItem[]
    empty: string
}) {
    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tint}`}>
                    {icon}
                </div>
                <div>
                    <div className="text-sm font-medium text-slate-900">{title}</div>
                    <div className="text-xs text-gray-400">{subtitle}</div>
                </div>
            </div>
            {items.length === 0 ? (
                <div className="text-xs text-gray-400 py-6 text-center">{empty}</div>
            ) : (
                <div className="flex flex-col gap-1">
                    {items.map((it) => (
                        <button
                            key={it.key}
                            type="button"
                            onClick={it.onClick}
                            className="group w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition text-left"
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900 truncate">{it.title}</div>
                                <div className="text-xs text-gray-500 truncate">{it.subtitle}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {it.right}
                                <FluentChevronRight32Filled className="h-3 w-3 text-gray-300 group-hover:text-slate-500" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export function AsideList() {
    const [query, setQuery] = useState("")
    const { set } = useOpenLayout()

    const { collections } = useDatabase()

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return collections ?? []
        return (collections ?? []).filter(c => c.nom?.toLowerCase().includes(q))
    }, [collections, query])

    return (
        <div className="w-87.5 relative z-50 h-full bg-white border-r border-slate-100 flex flex-col">
            <div className="px-3 pt-3 flex flex-col">
                <div className="flex items-center justify-between">
                    <Title title="Produits" />
                    <button onClick={set} className="h-9 pl-4 pr-2 flex text-sm items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer">
                        <span>Ajout. Collect.</span>
                        <FluentAdd32Regular className="h-5 w-5" />
                    </button>
                </div>
                <div className="h-14 pl-5 pr-2 mt-2 flex items-center bg-slate-100 rounded-full">
                    <div className="flex w-full">
                        <input value={query} onChange={({ target }) => setQuery(target.value)} type="text" className="focus:outline-none flex-1 w-[180px] bg-transparent" placeholder="Chercher une collection" />
                        <button className="w-10.5 h-10.5 flex items-center justify-center">
                            <FluentSearch32Filled className="h-6 w-6" />
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex items-center mb-2">
                    <div className="text-sm text-gray-400">Liste de Dossiers</div>
                </div>
            </div>

            <ScrollArea className="mt-2 flex-1 overflow-y-auto">
                <div className="px-3 flex flex-col gap-2">
                    {filtered.map((el, key) => <GroupeItems data={el} key={key} />)}
                </div>
            </ScrollArea>
        </div>
    )
}

const GroupeItems = ({ data }: { data: Partial<Collection> }) => {
    const [isEdit, setIsEdit] = useState(false)

    return (
        <>{!isEdit ? <Items data={data} onClick={() => setIsEdit(true)} /> : <GroupeUpdate data={data} onClick={() => setIsEdit(false)} />}</>

    )
}

const GroupeUpdate = ({ data, onClick }: { onClick: () => void, data: Partial<Collection> }) => {
    const [change, setChange] = useState(data.nom)
    const { updateCollection } = useDatabase()

    const handleUpdate = () => {
        updateCollection(data.id as string, { nom: change as string })

        onClick()
    }

    return (
        <div className="px-4 py-4 hover:bg-blue-100 flex items-center rounded-xl">
            <input multiple value={change} onChange={({ target }) => setChange(target.value)} className="focus:outline-none border-b py-2" />
            <button onClick={handleUpdate}>
                <FluentCheckmark32Regular className="h-4 w-4" />
            </button>
        </div>
    )
}

const Items = ({ data, onClick }: { onClick: () => void, data: Partial<Collection> }) => {
    const [isLocate, setIsLocate] = useState(false)
    const { deleteCollection, collections, sousCollections, updateSousCollection, deleteSousCollection } = useDatabase()
    const { id } = useParams()
    const { openFor } = openNewProductWindow()

    const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [moveSubmenuPos, setMoveSubmenuPos] = useState<{ x: number; y: number } | null>(null)
    const moveButtonRef = useRef<HTMLButtonElement>(null)

    const handleDelete = () => {
        deleteCollection(data.id as string)
    }

    const sous_collection = sousCollections.filter(el => el.collectionId === data.id)

    useEffect(() => {
        setIsLocate(id === data.id)
    }, [id])

    const openContextMenu = (e: React.MouseEvent, sousCollectionId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setMoveSubmenuPos(null)
        setCtxMenu({ id: sousCollectionId, x: e.clientX, y: e.clientY })
    }

    const closeContextMenu = () => {
        setCtxMenu(null)
        setMoveSubmenuPos(null)
    }

    const toggleMoveSubmenu = () => {
        if (moveSubmenuPos) {
            setMoveSubmenuPos(null)
            return
        }
        const rect = moveButtonRef.current?.getBoundingClientRect()
        if (!rect) return
        setMoveSubmenuPos({ x: rect.right + 4, y: rect.top })
    }

    const startRename = (el: Partial<SousCollection>) => {
        setRenamingId(el.id as string)
        setRenameValue(el.nom ?? "")
        closeContextMenu()
    }

    const commitRename = async (sousCollectionId: string) => {
        const value = renameValue.trim()
        setRenamingId(null)
        if (!value) return
        await updateSousCollection(sousCollectionId, { nom: value })
    }

    const handleDeleteSousCollection = async (el: Partial<SousCollection>) => {
        closeContextMenu()
        if (!confirm(`Supprimer la sous-collection "${el.nom}" ?`)) return
        await deleteSousCollection(el.id as string)
    }

    const handleAddArticle = (el: Partial<SousCollection>) => {
        closeContextMenu()
        openFor(data.id as string, el.id as string)
    }

    const handleMoveSousCollection = async (el: Partial<SousCollection>, targetCollectionId: string) => {
        closeContextMenu()
        await updateSousCollection(el.id as string, { collectionId: targetCollectionId })
    }

    return (
        <div className={`border border-slate-200 relative flex flex-col rounded-xl overflow-hidden ${isLocate ? "bg-blue-50" : ""} select-none`}>
            <NavLink to={`/produits/collections/${data.id}`} state={data} className='flex flex-col items-left justify-between w-full px-4 py-3'>
                <span className={`flex-1 ${isLocate ? "font-semibold" : ""}`}>
                    {data.nom}
                </span>
                <span className="text-sm text-gray-400">Quantités : {String(data.quantite ?? 0).padStart(2, '0')}</span>
                <span className="text-xs text-gray-400">Order : {data.ordre}</span>
            </NavLink>

            <div className="itemsMenu absolute top-[12px] right-0 flex gap-3 px-3 py-1">
                <button onClick={onClick}>
                    <FluentEdit32Regular className="h-4 w-4" />
                </button>
                {data.quantite === 0 && (
                    <button onClick={handleDelete}>
                        <FluentDelete32Regular className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div>
                {sous_collection.map(el => (
                    renamingId === el.id ? (
                        <div key={el.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                            <input
                                autoFocus
                                value={renameValue}
                                onChange={({ target }) => setRenameValue(target.value)}
                                onBlur={() => commitRename(el.id as string)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); commitRename(el.id as string) }
                                    if (e.key === 'Escape') setRenamingId(null)
                                }}
                                className="flex-1 focus:outline-none border-b border-slate-300 py-1 bg-transparent"
                            />
                        </div>
                    ) : (
                        <NavLink
                            to={{ pathname: `/produits/collections/${data.id}`, search: `?sous_collection=${el.id}` }}
                            className="px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50"
                            key={el.id}
                            onContextMenu={(e) => openContextMenu(e, el.id as string)}
                        >
                            <span>{el.nom}</span>
                            <FluentChevronRight32Filled className="h-4 w-4" />
                        </NavLink>
                    )
                ))}
            </div>

            {ctxMenu && (() => {
                const target = sous_collection.find(el => el.id === ctxMenu.id)
                if (!target) return null
                const otherCollections = collections.filter(c => c.id !== data.id)
                return (
                    <>
                        <div className="fixed inset-0 z-59" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu() }} />
                        <div
                            className="fixed w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-60 overflow-hidden py-1 text-left"
                            style={{ top: ctxMenu.y, left: ctxMenu.x }}
                        >
                            <button
                                type="button"
                                onClick={() => handleAddArticle(target)}
                                className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                            >
                                <FluentAdd32Regular className="h-4 w-4" /> Ajouter un article
                            </button>
                            <button
                                ref={moveButtonRef}
                                type="button"
                                disabled={otherCollections.length === 0}
                                onClick={toggleMoveSubmenu}
                                className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                            >
                                <span className="flex items-center gap-2">
                                    <FluentFolderLink32Regular className="h-4 w-4" /> Déplacer vers
                                </span>
                                <FluentChevronRight32Filled className="h-3 w-3" />
                            </button>
                            <div className="my-1 border-t border-slate-100" />
                            <button
                                type="button"
                                onClick={() => startRename(target)}
                                className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                            >
                                <FluentEdit32Regular className="h-4 w-4" /> Renommer
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteSousCollection(target)}
                                className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                                <FluentDelete32Regular className="h-4 w-4" /> Supprimer
                            </button>
                        </div>
                        {moveSubmenuPos && otherCollections.length > 0 && (
                            <div
                                className="fixed w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-60 overflow-hidden py-1 text-left max-h-64 overflow-y-auto"
                                style={{ top: moveSubmenuPos.y, left: moveSubmenuPos.x }}
                            >
                                {otherCollections.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => handleMoveSousCollection(target, c.id as string)}
                                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 truncate"
                                    >
                                        {c.nom}
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )
            })()}
        </div>
    )
}
