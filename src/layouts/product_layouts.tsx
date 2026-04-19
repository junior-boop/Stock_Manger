import { Outlet, NavLink, useLocation, useParams, useNavigate } from "react-router-dom"
import { FluentAdd32Regular, FluentCheckmark32Regular, FluentChevronRight32Filled, FluentDelete32Regular, FluentEdit32Regular, FluentSearch32Filled, SvgSpinners180Ring, } from "../libs/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import Title from "../components/title";

import { useDatabase } from "../databaseProvider"

import { create } from 'zustand'
import { Collection } from "../Databases/db.d";
import { openNewProductWindow } from "../context/open_product";
import NewProduct from "../pages/new_product";

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


    useEffect(() => {
        const checkDossier = location.pathname.includes('/collection')
        if (checkDossier) setIsHome(false)
        else setIsHome(true)
    }, [location])

    const handleCreateCollection = async () => {
        if (!collection.nom) {
            alert("Le nom de la collection est requis.")
            return
        }

        if (!collection.description) {
            alert("La description de la collection est requise.")
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



    useEffect(() => {
        console.log(collection)
    }, [collection])

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
                open_state && (<div className="absolute top-0 left-0 w-full h-full opacity flex items-center justify-center z-50">
                    <NewProduct />
                </div>)
            }
        </div>
    )
}

const HomeGroupPage = () => {
    return (
        <div className="h-dvh flex-1 overflow-x-hidden overflow-y-auto">
            <div className="px-4 py-4">
                <div className="mt-8">
                    {/* <Subtitle title="Recents" /> */}
                </div>
                <div className="px-3">

                </div>
            </div>
        </div>
    )
}

export function AsideList() {
    const [groupName, setGroupName] = useState<string | null>("")
    const { set } = useOpenLayout()

    const { collections } = useDatabase()

    useEffect(() => {
        console.log(collections)
    }, [collections])
    return (
        <div className="w-[350px] h-full bg-white border-r border-slate-100 p-3">
            <div className="flex items-center justify-between">
                <Title title="Produits" />
                <button onClick={set} className="h-[36px] pl-4 pr-2 flex text-sm items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer">
                    <span>Ajout. Collect.</span>
                    <FluentAdd32Regular className="h-5 w-5" />
                </button>
            </div>
            <div className="h-[56px] pl-5 pr-2 flex items-center  bg-slate-100 rounded-full">
                <div className="flex w-full">
                    <input onChange={({ target }) => setGroupName(target.value)} type="text" className="focus:outline-none flex-1 w-[180px]" placeholder="Chercher une collection" />

                    <button className="w-[42px] h-[42px] flex items-center justify-center">
                        <FluentSearch32Filled className="h-6 w-6" />
                    </button>
                </div>
            </div>
            <div className="mt-8 flex items-center mb-2">
                <div>
                    {/* <Title title="Dossiers" /> */}
                    <div className="text-sm text-gray-200">Liste de Dossiers</div>
                </div>
            </div>
            <div className="flex flex-col gap-2" >
                {
                    collections?.map((el, key) => <GroupeItems data={el} key={key} />)
                }
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
    const { collections, deleteCollection, sousCollections, articles } = useDatabase()
    const navigate = useNavigate()
    const { id } = useParams()



    const handleDelete = () => {
        console.log()
        // navigate(`/groupes/dossier/${listedesgroupe[0]?.id}`)
        deleteCollection(data.id as string)
    }

    const sous_collection = sousCollections.filter(el => el.collectionId === data.id)

    useEffect(() => {
        setIsLocate(false)
    }, [])

    useEffect(() => {
        if (id === data.id) {
            setIsLocate(true)
        } else setIsLocate(false)
    }, [location, id])
    return (
        <div className={`border border-slate-200 relative flex flex-col rounded-xl overflow-hidden ${isLocate ? "bg-blue-50" : ""} select-none`}>
            <NavLink to={`/produits/collections/${data.id}`} state={data} className='flex flex-col items-left justify-between w-full px-4 py-3'>
                <span className={`flex-1 ${isLocate ? "font-semibold" : ""}`}>
                    {data.nom}
                </span>
                <span className="text-sm text-gray-400">Quantités : {data.quantite < 10 ? `0${data.quantite}` : data.quantite}</span>
                <span className="text-xs text-gray-400">Order : {data.ordre}</span>

                {/* {isLocate && <span className="w-[12px] h-[12px] rounded-full bg-blue-800"></span>} */}
            </NavLink>

            <div className="itemsMenu absolute top-[12px] right-0 flex gap-3 px-3 py-1">
                <button onClick={onClick}>
                    <FluentEdit32Regular className="h-4 w-4" />
                </button>
                {
                    data.quantite === 0 ? (<button onClick={handleDelete}>
                        <FluentDelete32Regular className="h-4 w-4" />
                    </button>)
                        : null
                }
            </div>

            <div>
                {
                    sous_collection.map(el => (<NavLink to={{
                        pathname: `/products/collections/${data.id}`,
                        search: `?sous_collection=${el.id}`
                    }} className="hover:bg-gray-50 px-4 py-2 flex items-center justify-between text-sm">
                        <span>{el.nom}</span> <span>
                            <FluentChevronRight32Filled className="h-4 w-4" />
                        </span>
                    </NavLink>))
                }
            </div>
        </div>
    )
}
