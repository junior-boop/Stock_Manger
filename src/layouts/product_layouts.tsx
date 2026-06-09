import { Outlet, NavLink, useLocation, useParams } from "react-router-dom"
import { FluentAdd32Regular, FluentCheckmark32Regular, FluentChevronRight32Filled, FluentDelete32Regular, FluentEdit32Regular, FluentSearch32Filled, SvgSpinners180Ring, } from "../libs/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import Title from "../components/title";

import { useDatabase } from "../databaseProvider"

import { create } from 'zustand'
import { Collection } from "../Databases/db.d";
import { openNewProductWindow, useImportExcelStore } from "../context/open_product";
import NewProduct from "../pages/new_product";
import { useAlerts } from "../components/alerts";
import { FluentCloudArrowUp32Regular, FluentArrowDownload32Filled } from "../libs/icons";

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
                get && <div className="absolute top-0 left-0 w-full h-full opacity flex items-center justify-center z-50">
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
                open_state && (<div className="absolute top-0 left-0 w-full h-full opacity flex items-center justify-end z-50">
                    <NewProduct />
                </div>)
            }
        </div>
    )
}

const HomeGroupPage = () => {
    const { set_import } = useImportExcelStore()
    const { success, error: notifyError } = useAlerts()
    const [isExporting, setIsExporting] = useState(false)

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
        <div className="h-dvh flex-1 overflow-x-hidden overflow-y-auto">
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
            </div>
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
        <div className="w-[350px] h-full bg-white border-r border-slate-100 flex flex-col">
            <div className="px-3 pt-3 flex flex-col">
                <div className="flex items-center justify-between">
                    <Title title="Produits" />
                    <button onClick={set} className="h-[36px] pl-4 pr-2 flex text-sm items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer">
                        <span>Ajout. Collect.</span>
                        <FluentAdd32Regular className="h-5 w-5" />
                    </button>
                </div>
                <div className="h-[56px] pl-5 pr-2 mt-2 flex items-center bg-slate-100 rounded-full">
                    <div className="flex w-full">
                        <input value={query} onChange={({ target }) => setQuery(target.value)} type="text" className="focus:outline-none flex-1 w-[180px] bg-transparent" placeholder="Chercher une collection" />
                        <button className="w-[42px] h-[42px] flex items-center justify-center">
                            <FluentSearch32Filled className="h-6 w-6" />
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex items-center mb-2">
                    <div className="text-sm text-gray-400">Liste de Dossiers</div>
                </div>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto">
                <div className="px-3 flex flex-col gap-2">
                    {filtered.map((el, key) => <GroupeItems data={el} key={key} />)}
                </div>
            </div>
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
    const { deleteCollection, sousCollections } = useDatabase()
    const { id } = useParams()

    const handleDelete = () => {
        deleteCollection(data.id as string)
    }

    const sous_collection = sousCollections.filter(el => el.collectionId === data.id)

    useEffect(() => {
        setIsLocate(id === data.id)
    }, [id])

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
                    <NavLink
                        to={{ pathname: `/produits/collections/${data.id}`, search: `?sous_collection=${el.id}` }}
                        className="px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50"
                        key={el.id}
                    >
                        <span>{el.nom}</span>
                        <FluentChevronRight32Filled className="h-4 w-4" />
                    </NavLink>
                ))}
            </div>
        </div>
    )
}
