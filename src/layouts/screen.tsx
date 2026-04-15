import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams, } from 'react-router-dom';
import { FluentArchive32Filled, FluentArchive32Regular, FluentArrowDownload32Filled, FluentBox32Filled, FluentBox32Regular, FluentHome32Filled, FluentHome32Regular, FluentPeople28Filled, FluentPeople32Regular, FluentReceiptMoney24Filled, FluentReceiptMoney24Regular, FluentSettings32Filled, FluentSettings32Regular } from '../libs/icons';
import { QueryBuilder } from '../context/QueryBuilder';

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
                    <div className='h-[72px]'></div>
                    <div className='flex flex-col items-center gap-2'>
                        <NavItems icon={(actives) => actives ? <FluentHome32Filled className=" h-6 w-6 text-slate-800" /> : <FluentHome32Regular className='h-6 w-6' />} url="/" />
                        <NavItems icon={(actives) => actives ? <FluentBox32Filled className=" h-6 w-6 text-slate-800" /> : <FluentBox32Regular className='h-6 w-6' />} url="/todos" />
                        <NavItems icon={(actives) => actives ? <FluentPeople28Filled className=" h-6 w-6 text-slate-800" /> : <FluentPeople32Regular className='h-6 w-6' />} url="/groupes" />
                        <NavItems icon={(actives) => actives ? <FluentReceiptMoney24Filled className=" h-6 w-6 text-slate-800" /> : <FluentReceiptMoney24Regular className='h-6 w-6' />} url="/archives" />
                        <NavItems icon={(actives) => actives ? <FluentArrowDownload32Filled className=" h-6 w-6 text-slate-800" /> : <FluentArrowDownload32Filled className='h-6 w-6' />} url="/telechargements" />
                    </div>
                </div>
                <div className='flex flex-col items-center gap-2 absolute bottom-4 w-full'>
                    <NavItems icon={(actives) => actives ? <FluentSettings32Filled className=" h-6 w-6 text-slate-800" /> : <FluentSettings32Regular className='h-6 w-6' />} url="/settings" />

                </div>
            </div>
            <div className='flex-1 w-full h-full overflow-hidden relative'>
                <Outlet />
            </div>
        </div>
    );
}







function NavItems({ icon, url = "/" }: { icon: (actived: boolean) => React.JSX.Element, url?: string }) {
    const [isActived, setIsActived] = useState(false);
    const navigation = useLocation()

    useEffect(() => {
        setIsActived(navigation.pathname === url);
    }, [navigation]);
    return (
        <NavLink to={url} className={`flex items-center gap-2 p-2  ${isActived ? 'bg-gray-200' : ''} transition-colors duration-200 w-[80%] aspect-square rounded-full justify-center hover:bg-gray-200`}>
            {icon(isActived)}
        </NavLink>
    )
}