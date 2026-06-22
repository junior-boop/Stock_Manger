import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useParams, } from 'react-router-dom';
import { FluentArchive32Filled, FluentArchive32Regular, FluentArrowDownload32Filled, FluentBox32Filled, FluentBox32Regular, FluentBuildingShop24Filled, FluentBuildingShop24Regular, FluentClipboardDataBar32Filled, FluentClipboardDataBar32Regular, FluentFolderLink32Filled, FluentFolderLink32Regular, FluentGridKanban20Filled, FluentGridKanban20Regular, FluentHome32Filled, FluentHome32Regular, FluentPeople28Filled, FluentPeople32Filled, FluentPeople32Regular, FluentReceiptMoney24Filled, FluentReceiptMoney24Regular, FluentSettings32Filled, FluentSettings32Regular } from '../libs/icons';
import { QueryBuilder } from '../context/QueryBuilder';
import { useAuth } from '../auth/authProvider';

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
    }, [location])
    return (
        <div className="flex w-full h-[calc(100vh-36px)] relative ">
            <div className='w-[62px] h-full bg-white relative'>
                <div>
                    <div className='h-[72px] px-3'>
                        <img src={logo} alt="Kataleya Logo" className='h-full w-full object-contain' />
                    </div>
                    <div className='flex flex-col items-center'>
                        <NavItems icon={(actives) => actives ? <FluentHome32Filled className=" h-6 w-6 text-white" /> : <FluentHome32Regular className='h-6 w-6' />} url="/" tooltip="Accueil" />
                        <NavItems icon={(actives) => actives ? <FluentBox32Filled className=" h-6 w-6 text-white" /> : <FluentBox32Regular className='h-6 w-6' />} url="/produits" tooltip='Produits' />
                        <NavItems icon={(actives) => actives ? <FluentPeople32Filled className=" h-6 w-6 text-white" /> : <FluentPeople32Regular className='h-6 w-6' />} url="/clients" tooltip='Clients' />
                        <NavItems icon={(actives) => actives ? <FluentClipboardDataBar32Filled className=" h-6 w-6 text-white" /> : <FluentClipboardDataBar32Regular className='h-6 w-6' />} url="/devis" tooltip='Devis' />
                        <NavItems icon={(actives) => actives ? <FluentReceiptMoney24Filled className=" h-6 w-6 text-white" /> : <FluentReceiptMoney24Regular className='h-6 w-6' />} url="/factures" tooltip='Factures' />
                        <NavItems icon={(actives) => actives ? <FluentFolderLink32Filled className=" h-6 w-6 text-white" /> : <FluentFolderLink32Regular className='h-6 w-6' />} url="/projets" tooltip='Projets' />
                        <NavItems icon={(actives) => actives ? <FluentBuildingShop24Filled className=" h-6 w-6 text-white" /> : <FluentBuildingShop24Regular className='h-6 w-6' />} url="/boutiques" tooltip='Boutiques' />
                        <NavItems icon={(actives) => actives ? <FluentArchive32Filled className=" h-6 w-6 text-white" /> : <FluentArchive32Regular className='h-6 w-6' />} url="/stock" tooltip='Stock' />
                        {/* <NavItems icon={(actives) => actives ? <FluentGridKanban20Filled className=" h-6 w-6 text-white" /> : <FluentGridKanban20Regular className='h-6 w-6' />} url="/taches" tooltip='Tâches' /> */}
                    </div>
                </div>
                <div className='flex flex-col items-center gap-2 absolute bottom-4 w-full'>
                    <UserList />
                    <NavItems icon={(actives) => actives ? <FluentSettings32Filled className=" h-6 w-6 text-white" /> : <FluentSettings32Regular className='h-6 w-6' />} url="/settings" tooltip='Paramètres' />
                </div>
            </div>
            <div className='flex-1 w-full h-full overflow-hidden relative'>
                <Outlet />
            </div>
        </div>
    );
}







type SidebarUser = {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: 'super_admin' | 'admin' | 'gestionnaire' | 'vendeur';
    avatar?: string;
};

type Presence = 'online' | 'away' | 'offline';

function usePresence(userIds: string[]): Record<string, Presence> {
    // Placeholder : tous offline pour l'instant.
    // Branchera plus tard sur le service de sync (ex. window.sync.onPresence).
    return Object.fromEntries(userIds.map((id) => [id, 'offline' as Presence]));
}

function UserList() {
    const { user: current, logout } = useAuth();
    const [users, setUsers] = useState<SidebarUser[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);

    useEffect(() => {
        window.db.administrateurs.getAll().then((rows: SidebarUser[]) => setUsers(rows ?? []));
    }, [current?.id]);

    const presence = usePresence(users.map((u) => u.id));
    const me = current ? users.find((u) => u.id === current.id) : null;
    const others = users.filter((u) => u.id !== current?.id);

    const toggle = (id: string) => setOpenId((v) => (v === id ? null : id));

    return (
        <div className="flex flex-col items-center gap-2 w-full">
            {me && (
                <UserAvatar
                    key={me.id}
                    user={me}
                    presence={presence[me.id]}
                    isCurrent
                    open={openId === me.id}
                    onToggle={() => toggle(me.id)}
                    onLogout={logout}
                />
            )}
            {others.map((u) => (
                <UserAvatar
                    key={u.id}
                    user={u}
                    presence={presence[u.id]}
                    isCurrent={false}
                    open={openId === u.id}
                    onToggle={() => toggle(u.id)}
                    onLogout={logout}
                />
            ))}
        </div>
    );
}

function UserAvatar({
    user,
    presence,
    isCurrent,
    open,
    onToggle,
    onLogout,
}: {
    user: SidebarUser;
    presence: Presence | undefined;
    isCurrent: boolean;
    open: boolean;
    onToggle: () => void;
    onLogout: () => Promise<void> | void;
}) {
    return (
        <div className="relative w-full flex justify-center">
            <button
                onClick={onToggle}
                className={`relative w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center ${isCurrent ? 'bg-slate-900 ring-2 ring-slate-300' : 'bg-slate-700'
                    }`}
                title={`${user.prenom} ${user.nom} (${user.role})`}
            >
                {initials(user)}
                <PresenceDot status={presence} />
            </button>
            {open && (
                <div className="absolute bottom-0 left-14 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50">
                    <div className="text-sm font-semibold">{user.prenom} {user.nom}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    <div className="text-xs text-gray-400 mt-1">{user.role}</div>
                    {isCurrent && (
                        <button
                            onClick={async () => { await onLogout(); onToggle(); }}
                            className="mt-3 w-full h-9 bg-slate-100 hover:bg-slate-200 rounded-full text-sm"
                        >
                            Se déconnecter
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function PresenceDot({ status }: { status: Presence | undefined }) {
    const color =
        status === 'online' ? 'bg-emerald-500'
            : status === 'away' ? 'bg-amber-400'
                : 'bg-green-500';
    return (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5  rounded-full ring-2 ring-white ${color}`} />
    );
}

function initials(u: SidebarUser): string {
    return `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase() || '?';
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