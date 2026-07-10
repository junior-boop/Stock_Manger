import { NavLink, useLocation, useParams } from "react-router-dom"
import { useDatabase } from "../databaseProvider"
import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react"
import { FluentAdd32Regular, FluentBox32Filled, FluentDelete32Regular, FluentSearch32Filled, IconGridView, IconListView, SvgSpinners180Ring } from "../libs/icons"
import { openNewProductWindow, OpenSousCollection } from "../context/open_product"
import { Article, SousCollection } from "../Databases/db.d"

export default function ProductPage() {
    const [isLoading, setLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const { collections, articles, sousCollections, createSousCollection, deleteArticle } = useDatabase()
    const { open_set } = openNewProductWindow()
    const { open_sous, set_sous } = OpenSousCollection()
    const { id } = useParams()
    const location = useLocation()
    const sousCollectionId = new URLSearchParams(location.search).get('sous_collection')

    const name = collections.filter(el => el.id === id)[0]
    const sousCollectionName = sousCollectionId
        ? sousCollections.find(sc => sc.id === sousCollectionId)?.nom
        : null
    const articlesForCollection = useMemo(() => articles.filter(el => {
        if (el.collectionId !== id) return false
        if (sousCollectionId) return el.sousCollectionId === sousCollectionId
        return true
    }), [articles, id, sousCollectionId])

    const [sousCollectionState, setSousCollectionState] = useState<Partial<SousCollection>>({
        nom: "",
        ordre: 0
    })

    const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
    const [searchQuery, setSearchQuery] = useState("")
    const [searchOpen, setSearchOpen] = useState(false)
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const searchScope = id ? articlesForCollection : articles
    const searchResults = normalizedQuery
        ? searchScope.filter(a => {
            const hay = `${a.nom ?? ""} ${a.reference ?? ""} ${a.description ?? ""}`.toLowerCase()
            return hay.includes(normalizedQuery)
        })
        : []

    useEffect(() => {
        setSelectedIds(new Set())
    }, [id, sousCollectionId])

    const toggleSelect = useCallback((articleId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(articleId)) next.delete(articleId)
            else next.add(articleId)
            return next
        })
    }, [])

    const handleDeleteSelected = useCallback(async () => {
        if (!confirm(`Supprimer ${selectedIds.size} article(s) ?`)) return
        setIsDeleting(true)
        for (const articleId of selectedIds) {
            await deleteArticle(articleId)
        }
        setSelectedIds(new Set())
        setIsDeleting(false)
    }, [selectedIds, deleteArticle])

    const handleOpenSousCollection = () => {
        set_sous()
        setLoading(true)
    }

    const saveSousCollection = async () => {
        const object: Partial<SousCollection> = {
            ...sousCollectionState,
            collectionId: id as string,
            statut: 'actif',
            image: '',
            description: '',
        }
        const value = await createSousCollection(object)
        setLoading(false)
        if (value) { set_sous() }
    }
    return (
        <>
            {searchOpen && normalizedQuery && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24" onClick={() => setSearchOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-180 max-h-[70vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                            <FluentSearch32Filled className="w-6 h-6 text-slate-500" />
                            <input
                                autoFocus
                                type="text"
                                value={searchQuery}
                                onChange={({ target }) => setSearchQuery(target.value)}
                                placeholder={`Rechercher dans ${sousCollectionName ?? name?.nom ?? "cette collection"}`}
                                className="outline-none text-base flex-1"
                            />
                            <span className="text-sm text-slate-400">{searchResults.length} résultat(s)</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {searchResults.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">Aucun produit trouvé</div>
                            ) : (
                                <ul className="flex flex-col gap-1">
                                    {searchResults.map(a => (
                                        <li key={a.id}>
                                            <NavLink
                                                to={`/produits/article/${a.id}`}
                                                onClick={() => { setSearchOpen(false); setSearchQuery("") }}
                                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100"
                                            >
                                                <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                                    <FluentBox32Filled className="w-5 h-5 text-slate-400" />
                                                </span>
                                                <span className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-sm font-semibold uppercase truncate">{a.nom}</span>
                                                    <span className="text-xs text-slate-500 truncate">Réf : {a.reference} · Stock : {a.stockTotal}</span>
                                                </span>
                                                <span className="text-sm text-slate-600 whitespace-nowrap">
                                                    {Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(a.prixTTC ?? 0)}
                                                </span>
                                            </NavLink>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <section className="flex-1 flex flex-col h-full">
                <div className="h-18"></div>
                <div className="px-10 py-3 border-b border-slate-100 w-full flex justify-between">
                    <h1 className="font-light text-4xl">
                        {name?.nom}
                        {sousCollectionName && (<span className="text-slate-400"> — {sousCollectionName}</span>)}
                    </h1>
                    <div className="flex items-center gap-2 mt-auto">
                        <div className="relative">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-200 rounded-full min-w-75">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={({ target }) => { setSearchQuery(target.value); setSearchOpen(true) }}
                                    onFocus={() => setSearchOpen(true)}
                                    placeholder={`Rechercher dans ${sousCollectionName ?? name?.nom ?? "cette collection"}`}
                                    className="outline-none text-base flex-1 bg-transparent"
                                />

                                <FluentSearch32Filled className="w-5 h-5" />
                            </div>
                        </div>
                        <button onClick={handleOpenSousCollection} className="px-4 py-2 bg-blue-800 text-white  rounded-full min-w-[175px] flex items-center justify-center" disabled={isLoading}>
                            {
                                isLoading ? <SvgSpinners180Ring className="h-6 w-6" /> : <span className="flex gap-2 items-center">Sous Collect. <FluentAdd32Regular className="h-5 w-5" /></span>
                            }
                        </button>
                        <div className="flex items-center gap-1 bg-gray-200 rounded-full p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                title="Vue grille"
                                className={`p-1.5 rounded-full flex items-center justify-center ${viewMode === "grid" ? "bg-white shadow-sm" : ""}`}
                            >
                                <IconGridView className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                title="Vue liste"
                                className={`p-1.5 rounded-full flex items-center justify-center ${viewMode === "list" ? "bg-white shadow-sm" : ""}`}
                            >
                                <IconListView className="h-5 w-5" />
                            </button>
                        </div>
                        <button onClick={open_set} className="px-4 py-2 bg-gray-200 rounded-full min-w-43.75 flex items-center justify-center gap-2" >Nouv. Prod. <FluentBox32Filled className=" h-5 w-5 text-black" /></button>
                        {/* <button className="px-4 py-2 bg-gray-200 rounded-full" >Annuler</button> */}
                    </div>
                </div>
                <div className=" text-sm text-slate-400 px-10 py-2 border-b border-slate-100 w-full select-none">
                    Produits {`>`} Collections {`>`} {name?.nom}
                </div>

                <div className="relative px-10 py-6 overflow-x-hidden flex-1 ">
                    {
                        open_sous && (<div className="absolute slide-down left-0 w-full px-10 py-4 bg-gray-50 border-b border-slate-100 shadow-xs flex gap-4 items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div><input type="text" className="px-4 py-2 rounded-lg border border-slate-200 outline-none w-[500px] bg-white" placeholder="Le nom de la sous-collection" value={sousCollectionState.nom} onChange={({ target }) => setSousCollectionState(e => ({ ...e, nom: target.value }))} /></div>
                                <div><input type="number" className="px-4 py-2 rounded-lg border border-slate-200 outline-none w-[300px] bg-white" placeholder="numéro d'Ordre" value={sousCollectionState.ordre} onChange={({ target }) => setSousCollectionState(e => ({ ...e, ordre: parseInt(target.value) }))} /></div>
                            </div>
                            <div className="flex gap-4 items-center">
                                <button onClick={() => { set_sous(); setLoading(false) }} className="px-6 py-2 bg-gray-200 rounded-full flex items-center justify-center gap-2">Annuler</button>
                                <button onClick={saveSousCollection} className="px-4 py-2 bg-blue-800 text-white  rounded-full min-w-[175px] flex items-center justify-center">Enregister</button>
                            </div>
                        </div>)
                    }

                    {viewMode === "grid" ? (
                        <div className="grid grid-cols-6 w-full gap-5">
                            {
                                articlesForCollection.map(el => <ProductItems data={el} key={el.id} selected={selectedIds.has(el.id as string)} onToggleSelect={toggleSelect} />)
                            }
                        </div>
                    ) : (
                        <div className="flex flex-col w-full gap-2">
                            {
                                articlesForCollection.map(el => <ProductListItem data={el} key={el.id} selected={selectedIds.has(el.id as string)} onToggleSelect={toggleSelect} />)
                            }
                        </div>
                    )}

                    {selectedIds.size > 0 && (
                        <div className="fixed bottom-0 right-0 w-[calc(100%-(62px+350px))] px-10 py-4 bg-gray-50 border-t border-slate-100 shadow-xs flex items-center justify-between z-20">
                            <span className="text-sm text-slate-600">{selectedIds.size} article(s) sélectionné(s)</span>
                            <div className="flex gap-4 items-center">
                                <button onClick={() => setSelectedIds(new Set())} className="px-6 py-2 bg-gray-200 rounded-full">Annuler</button>
                                <button onClick={handleDeleteSelected} disabled={isDeleting} className="px-6 py-2 bg-red-600 text-white rounded-full min-w-43.75 flex items-center justify-center gap-2">
                                    {isDeleting ? <SvgSpinners180Ring className="h-5 w-5" /> : <>Supprimer <FluentDelete32Regular className="h-4 w-4" /></>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </>
    )
}

export const ProductItems = memo(function ProductItems({ data, selected = false, onToggleSelect }: { data: Partial<Article>, selected?: boolean, onToggleSelect?: (id: string) => void }) {
    const { loadImage } = useDatabase()
    const imagesReceve = useMemo(() => JSON.parse(data.images)[0], [data.images])
    const [images, setImages] = useState<string>("")
    const Prix = useMemo(() => Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(data.prixTTC), [data.prixTTC])
    const dimensions = useMemo(() => JSON.parse(data.dimensions), [data.dimensions])

    const loadImages = useCallback(async () => {
        if (imagesReceve) {
            const img = await loadImage(imagesReceve)
            setImages(img as string)
        }
    }, [imagesReceve])

    useEffect(() => {
        loadImages()
    }, [loadImages])

    const stopClick = useCallback((e: MouseEvent<HTMLInputElement>) => {
        e.stopPropagation()
    }, [])

    const handleToggle = useCallback(() => {
        onToggleSelect?.(data.id as string)
    }, [data.id, onToggleSelect])

    return (
        <NavLink to={`/produits/article/${data.id}`} className="flex flex-col w-full gap-3">
            <span className="relative flex items-center justify-center overflow-hidden aspect-square bg-gray-100 w-full rounded-2xl">
                <img src={images as string} className="object-cover w-full h-full" />
                <input
                    type="checkbox"
                    checked={selected}
                    onClick={stopClick}
                    onChange={handleToggle}
                    className="absolute top-2 left-2 w-5 h-5 rounded cursor-pointer accent-blue-800 shadow"
                />
            </span>
            <span className="flex w-full flex-col">
                <span className="text-sm font-semibold uppercase">{data.nom}</span>
                <span className="text-xs font-semibold flex gap-2 mb-2">
                    <span>L. : {dimensions.longueur}cm</span>
                    <span>l. : {dimensions.largeur}cm</span>
                    <span>Ht. : {dimensions.hauteur}cm</span>
                </span>
                <span className="text-gray-600 text-sm">Prix : {Prix}</span>
                <span className="text-gray-600 text-sm">Ref : {data.reference}</span>
                <span className="text-gray-600 text-sm">Stock : {data.stockTotal}</span>
            </span>
        </NavLink>
    )
})

export const ProductListItem = memo(function ProductListItem({ data, selected = false, onToggleSelect }: { data: Partial<Article>, selected?: boolean, onToggleSelect?: (id: string) => void }) {
    const { loadImage } = useDatabase()
    const imagesReceve = useMemo(() => JSON.parse(data.images)[0], [data.images])
    const [images, setImages] = useState<string>("")
    const Prix = useMemo(() => Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(data.prixTTC), [data.prixTTC])
    const dimensions = useMemo(() => JSON.parse(data.dimensions), [data.dimensions])

    const loadImages = useCallback(async () => {
        if (imagesReceve) {
            const img = await loadImage(imagesReceve)
            setImages(img as string)
        }
    }, [imagesReceve])

    useEffect(() => {
        loadImages()
    }, [loadImages])

    const stopClick = useCallback((e: MouseEvent<HTMLInputElement>) => {
        e.stopPropagation()
    }, [])

    const handleToggle = useCallback(() => {
        onToggleSelect?.(data.id as string)
    }, [data.id, onToggleSelect])

    return (
        <NavLink to={`/produits/article/${data.id}`} className="flex items-center gap-4 w-full px-3 py-2 rounded-xl hover:bg-gray-100">
            <input
                type="checkbox"
                checked={selected}
                onClick={stopClick}
                onChange={handleToggle}
                className="w-4 h-4 shrink-0 rounded cursor-pointer accent-blue-800"
            />
            <span className="flex items-center justify-center overflow-hidden aspect-square bg-gray-100 w-9 h-9 rounded-lg shrink-0">
                <img src={images as string} className="object-cover w-full h-full" />
            </span>
            <span className="text-sm font-semibold uppercase flex-1 min-w-0 truncate">{data.nom}</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">L. : {dimensions.longueur}cm · l. : {dimensions.largeur}cm · Ht. : {dimensions.hauteur}cm</span>
            <span className="text-gray-600 text-sm whitespace-nowrap w-24">Réf : {data.reference}</span>
            <span className="text-gray-600 text-sm whitespace-nowrap w-24">Stock : {data.stockTotal}</span>
            <span className="text-gray-600 text-sm whitespace-nowrap w-28 text-right">{Prix}</span>
        </NavLink>
    )
})