import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams, } from 'react-router-dom';
import { FluentArchive32Filled, FluentArchive32Regular, FluentArrowDownload32Filled, FluentBox32Filled, FluentBox32Regular, FluentClipboardDataBar32Filled, FluentClipboardDataBar32Regular, FluentHome32Filled, FluentHome32Regular, FluentPeople28Filled, FluentPeople32Regular, FluentReceiptMoney24Filled, FluentReceiptMoney24Regular, FluentSettings32Filled, FluentSettings32Regular } from '../libs/icons';
import { QueryBuilder } from '../context/QueryBuilder';

import logo from '../assets/Kataleya.png'

export default function Screen() {
    const [onNote, setOnNote] = useState(false)
    const location = useLocation()

    useEffect(() => {
        setOnNote(location.pathname.includes("note"))

        if (location.pathname.includes('archives')) {
            setOnNote(true)
        }
        if (location.pathname.includes("groupes") && !location.pathname.includes("dossier")) {
            setOnNote(true)
        }
        if (location.pathname.includes("groupes") && location.pathname.includes("dossier")) {
            setOnNote(false)
        }

        if (location.pathname.includes("settings")) setOnNote(true)

        console.log(location.pathname)
    }, [location])
    return (
        <div className="flex w-full h-dvh relative ">
            <div className='w-[62px] h-full bg-white relative'>
                <div>
                    <div className='h-[72px] px-3'>
                        <img src={logo} alt="Kataleya Logo" className='h-full w-full object-contain' />
                    </div>
                    <div className='flex flex-col items-center'>
                        <NavItems icon={(actives) => actives ? <FluentHome32Filled className=" h-6 w-6 text-white" /> : <FluentHome32Regular className='h-6 w-6' />} url="/" tooltip="Accueil" />
                        <NavItems icon={(actives) => actives ? <FluentBox32Filled className=" h-6 w-6 text-white" /> : <FluentBox32Regular className='h-6 w-6' />} url="/produits" tooltip='Produits' />
                        <NavItems icon={(actives) => actives ? <FluentPeople28Filled className=" h-6 w-6 text-white" /> : <FluentPeople32Regular className='h-6 w-6' />} url="/clients" tooltip='Clients' />
                        <NavItems icon={(actives) => actives ? <FluentReceiptMoney24Filled className=" h-6 w-6 text-white" /> : <FluentReceiptMoney24Regular className='h-6 w-6' />} url="/factures" tooltip='Factures' />
                        <NavItems icon={(actives) => actives ? <FluentClipboardDataBar32Filled className=" h-6 w-6 text-white" /> : <FluentClipboardDataBar32Regular className='h-6 w-6' />} url="/devis" tooltip='Devis' />
                    </div>
                </div>
                <div className='flex flex-col items-center gap-2 absolute bottom-4 w-full'>
                    <NavItems icon={(actives) => actives ? <FluentSettings32Filled className=" h-6 w-6 text-white" /> : <FluentSettings32Regular className='h-6 w-6' />} url="/settings" tooltip='Paramètres' />
                </div>
            </div>
            <div className='flex-1 w-full h-full overflow-hidden relative'>
                <Outlet />
            </div>
        </div>
    );
}







function NavItems({ icon, url = "/", tooltip = "" }: { icon: (actived: boolean) => React.JSX.Element, url?: string, tooltip?: string }) {
    const [isActived, setIsActived] = useState(false);
    const navigation = useLocation()

    useEffect(() => {
        setIsActived(navigation.pathname === url);
    }, [navigation]);
    return (
        <div className={"tooltip tooltip-right aspect-square w-full flex justify-center items-center"} data-tip={tooltip || "hello"}>
            <NavLink to={url} className={`flex items-center p-2  ${isActived ? 'bg-slate-800' : ''} transition-colors duration-200 w-[80%] h-[80%] aspect-square rounded-full justify-center hover:bg-gray-200`} >
                {icon(isActived)}
            </NavLink>
        </div>
    )
}