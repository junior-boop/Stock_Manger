import { Outlet, NavLink, useLocation, useParams, useNavigate } from "react-router-dom"
import { FluentAdd32Regular, FluentCheckmark32Regular, FluentDelete32Regular, FluentEdit32Regular, FluentSearch32Filled, } from "../libs/icons";
import { useEffect, useState } from "react";
import Title from "../components/title";

import { create } from 'zustand'

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

    useEffect(() => {
        const checkDossier = location.pathname.includes('/dossier')
        if (checkDossier) setIsHome(false)
        else setIsHome(true)
    }, [location])




    return (
        <div className="flex h-full w-full relative">
            <AsideList />
            {
                isHome
                    ? <HomeGroupPage />
                    : <Outlet />
            }

            {
                get && <div className="absolute top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-50">
                    <div className="absolute top-[16px] left-[350px] w-[500px] h-[400px] bg-white rounded-xl flex flex-col gap-2 px-6 pb-4">
                        <Title title="Ajouter une collection" />
                        <div >
                            <input type="text" className="w-full focus:outline-none border-b py-2 px-2 bg-slate-50" placeholder="Nom de la collection" />
                        </div>
                        <div>
                            <input type="number" className="w-full focus:outline-none border-b py-2 px-2 bg-slate-50" placeholder="Numero d'ordre" />
                        </div>
                        <div>
                            <textarea className="w-full focus:outline-none border-b py-2 px-2 h-[150px] resize-none bg-slate-50" placeholder="Description de la collection" />
                        </div>
                        <div className="flex items-center gap-3 mt-auto">
                            <button className="px-4 py-2 bg-gray-200 rounded-full" onClick={set}>Annuler</button>
                            <button className="px-4 py-2 bg-blue-800 text-white rounded-full">Ajouter la collection</button>
                        </div>
                    </div>
                </div>
            }
        </div>
    )
}

const HomeGroupPage = () => {
    // const { notesQuery } = useDatabase()
    // const data = notesQuery?.where(note => note.grouped !== null).filter(note => note.modified)
    return (
        <div className="h-dvh w-full overflow-x-hidden overflow-y-auto">
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
    return (
        <div className="w-[450px] h-full bg-white border-r border-slate-100 p-3">
            <div className="flex items-center justify-between">
                <Title title="Produits" />
                <button onClick={set} className="h-[36px] pl-4 pr-2 flex items-center justify-center gap-2 bg-slate-800 text-white rounded-full cursor-pointer">
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
            <div className="h-[92px] flex items-center">
                <div>
                    {/* <Title title="Dossiers" /> */}
                    <div className=" text-sm text-gray-200">Liste de Dossiers</div>
                </div>
            </div>
            <div >
                {/* {
                    handleGroupeList?.map((el, key) => <GroupeItems data={el} key={key} />)
                } */}
            </div>
        </div>
    )
}


const GroupeItems = ({ data }) => {
    const [isEdit, setIsEdit] = useState(false)

    return (
        // <GroupeUpdate data={data} />
        <>{!isEdit ? <Items data={data} onClick={() => setIsEdit(true)} /> : <GroupeUpdate data={data} onClick={() => setIsEdit(false)} />}</>

    )
}

const GroupeUpdate = ({ data, onClick }: { onClick: () => void }) => {
    const [change, setChange] = useState(data.name)
    const { updatedGroup } = useDatabase()

    const handleUpdateGroup = () => {
        updatedGroup({
            id: data.id,
            name: change as string,
        })

        onClick()
    }

    return (
        <div className="px-4 py-4 hover:bg-blue-200 flex items-center rounded-xl">
            <input multiple value={change} onChange={({ target }) => setChange(target.value)} className="focus:outline-none border-b" />
            <button onClick={handleUpdateGroup}>
                <FluentCheckmark32Regular className="h-5 w-5" />
            </button>
        </div>
    )
}

const Items = ({ data, onClick }: { onClick: () => void }) => {
    const [isLocate, setIsLocate] = useState(false)
    const { deletedGroup, notesQuery, groupedQuery } = useDatabase()
    const navigate = useNavigate()

    const { id } = useParams()
    const location = useLocation()
    const handleDelete = () => {
        const listedesgroupe = groupedQuery?.where(group => group.id !== data.id)
        console.log(listedesgroupe[0]?.id)
        navigate(`/groupes/dossier/${listedesgroupe[0]?.id}`)
        deletedGroup(data.id)
    }

    const listedenotes = notesQuery?.where(note => note.grouped === data.id)

    useEffect(() => {
        setIsLocate(false)
    }, [])

    useEffect(() => {
        if (id === data.id) {
            setIsLocate(true)
        } else setIsLocate(false)
    }, [location, id])
    return (
        <div className={`dossierItem px-4 py-3 hover:bg-blue-100 relative flex items-center rounded-xl ${isLocate ? "bg-blue-100" : ""}`}>
            <NavLink to={`/groupes/dossier/${data.id}`} state={data} className='flex items-center gap-2 justify-between w-full'>
                <span className={`flex-1 ${isLocate ? "font-bold" : ""}`}>
                    {data.name}
                </span>

                {isLocate && <span className="w-[12px] h-[12px] rounded-full bg-blue-800"></span>}

            </NavLink>

            <div className="itemsMenu absolute right-0 flex gap-3 px-3 py-2 bg-blue-100">
                <button onClick={onClick}>
                    <FluentEdit32Regular className="h-5 w-5" />
                </button>
                {
                    listedenotes?.length === 0 ? (<button onClick={handleDelete}>
                        <FluentDelete32Regular className="h-5 w-5" />
                    </button>)
                        : null
                }
            </div>
        </div>
    )
}
