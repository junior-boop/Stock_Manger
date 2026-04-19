import { NavLink, useLocation, useParams } from "react-router-dom"
import { useDatabase } from "../databaseProvider"
import { useCallback, useEffect, useState } from "react"
import { FluentAdd32Regular, FluentBox32Filled, SvgSpinners180Ring } from "../libs/icons"
import { openNewProductWindow, OpenSousCollection } from "../context/open_product"
import { Article, SousCollection } from "../Databases/db.d"

export default function ProductPage() {
    const [isLoading, setLoading] = useState(false)
    const { collections, articles, createSousCollection } = useDatabase()
    const { open_set } = openNewProductWindow()
    const { open_sous, set_sous } = OpenSousCollection()
    const { id } = useParams()
    const name = collections.filter(el => el.id === id)[0]
    const articlesForCollection = articles.filter(el => el.collectionId === id)

    const [sousCollectionState, setSousCollectionState] = useState<Partial<SousCollection>>({
        nom: "",
        ordre: 0
    })
    const location = useLocation()
    console.log(location.search)


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

        if (value) { set_sous(); setLoading(false) }
    }
    return (
        <>
            <section className="flex-1 flex flex-col h-full">
                <div className="h-[72px]"></div>
                <div className="px-10 py-3 border-b border-slate-100 w-full flex justify-between">
                    <h1 className="font-light text-4xl">{name?.nom}</h1>
                    <div className="flex items-center gap-2 mt-auto">
                        <button onClick={handleOpenSousCollection} className="px-4 py-2 bg-blue-800 text-white  rounded-full min-w-[175px] flex items-center justify-center" disabled={isLoading}>
                            {
                                isLoading ? <SvgSpinners180Ring className="h-6 w-6" /> : <span className="flex gap-2 items-center">Sous Collect. <FluentAdd32Regular className="h-5 w-5" /></span>
                            }
                        </button>
                        <button onClick={open_set} className="px-4 py-2 bg-gray-200 rounded-full min-w-[175px] flex items-center justify-center gap-2" >Nouv. Prod. <FluentBox32Filled className=" h-5 w-5 text-black" /></button>
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
                    <div className="grid grid-cols-6 w-full gap-5">
                        {
                            articlesForCollection.map(el => <ProductItems data={el} key={el.id} />)
                        }
                    </div>
                </div>
            </section>
        </>
    )
}

export function ProductItems({ data }: { data: Partial<Article> }) {
    const { loadImage } = useDatabase()
    const imagesReceve = JSON.parse(data.images)[0]
    const [images, setImages] = useState<string>("")
    const Prix = Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF" }).format(data.prixTTC)
    const dimensions = JSON.parse(data.dimensions)

    const loadImages = useCallback(async () => {
        if (imagesReceve) {
            const img = await loadImage(imagesReceve)
            setImages(img as string)
        }
    }, [imagesReceve])

    useEffect(() => {
        loadImages()
    }, [loadImages])


    return (
        <NavLink to={`/produits/${data.id}`} className="flex flex-col w-full gap-3">
            <span className="flex items-center justify-center overflow-hidden aspect-square bg-gray-100 w-full rounded-2xl">
                <img src={images as string} className="object-cover w-full h-full" />
            </span>
            <span className="flex w-full flex-col">
                <span className=" font-semibold uppercase">{data.nom}</span>
                <span className="text-xs font-semibold flex gap-2 mb-2">
                    <span>L. : {dimensions.longueur}cm</span>
                    <span>l. : {dimensions.largeur}cm</span>
                    <span>Ht. : {dimensions.hauteur}cm</span>
                </span>
                <span className="text-gray-600 text-sm">Prix : {Prix}</span>
                <span className="text-gray-600 text-sm">Ref : {data.reference}</span>
            </span>
        </NavLink>
    )
}