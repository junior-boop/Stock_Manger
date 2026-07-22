import { useEffect, useRef, useState } from 'react';
import { useDatabase } from '../databaseProvider';
import { Administrateur, RoleAdmin, Technicien } from '../Databases/db.d';
import type { UpdateStatus } from '../auto-update';
import { useAuth, usePermissions } from '../auth/authProvider';
import { syncClient } from '../context/sync_client';
import { useAlerts } from '../components/alerts';
import ReapproModal from '../components/reappro_modal';
import ScrollArea from '../components/scroll_area';
import { SvgSpinners180Ring, RiEyeFill, RiEyeOffFill } from '../libs/icons';

type Section = 'entreprise' | 'numerotation' | 'sauvegarde' | 'permissions' | 'journal' | 'utilisateurs' | 'techniciens' | 'stock';

const SECTION_PERMISSIONS: Record<Section, string> = {
    entreprise: 'parametres:edit',
    numerotation: 'parametres:edit',
    utilisateurs: 'admins:manage',
    techniciens: 'parametres:edit',
    permissions: 'admins:manage',
    stock: 'articles:write',
    sauvegarde: 'parametres:edit',
    journal: 'journal:read',
};

const SECTIONS: { id: Section; label: string; description: string }[] = [
    {
        id: 'entreprise',
        label: 'Entreprise',
        description: "Nom, logo, coordonnées et notes par défaut affichées sur vos devis et factures, plus champs d'info personnalisés.",
    },
    {
        id: 'numerotation',
        label: 'Numérotation & documents',
        description: "Préfixes et format des numéros de devis et factures, TVA par défaut et devise affichée sur les documents.",
    },
    {
        id: 'utilisateurs',
        label: 'Utilisateurs',
        description: "Comptes administrateurs, rôles, mots de passe et activation des accès à l'application.",
    },
    {
        id: 'techniciens',
        label: 'Techniciens',
        description: "Liste des techniciens de terrain : coordonnées, spécialités et statut pour les assigner aux projets.",
    },
    {
        id: 'permissions',
        label: 'Permissions',
        description: "Matrice des droits par rôle : qui peut consulter, créer, modifier ou supprimer chaque type de donnée.",
    },
    {
        id: 'stock',
        label: 'Stock & inventaire',
        description: "Réapprovisionner le stock courant ou lancer un inventaire complet (par boutique ou global).",
    },
    {
        id: 'sauvegarde',
        label: 'Sauvegarde & synchronisation',
        description: "État de la synchronisation cloud, export et import de la base locale, dernière sauvegarde réussie.",
    },
    {
        id: 'journal',
        label: "Journal d'activité",
        description: "Historique des actions effectuées dans l'application : créations, modifications et suppressions.",
    },
];

export default function SettingsPage() {
    const { can } = usePermissions();
    const visibleSections = SECTIONS.filter(s => can(SECTION_PERMISSIONS[s.id]));
    const [section, setSection] = useState<Section>(visibleSections[0]?.id ?? 'entreprise');

    if (visibleSections.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-slate-50">
                <div className="text-center max-w-md px-6">
                    <div className="text-base font-medium text-gray-700">Accès restreint</div>
                    <div className="text-sm text-gray-400 mt-1">
                        Vous n'avez pas les droits nécessaires pour consulter les paramètres. Contactez un administrateur.
                    </div>
                </div>
            </div>
        );
    }

    const allowed = can(SECTION_PERMISSIONS[section]);

    return (
        <div className="flex h-full w-full">
            <aside className="w-[350px] h-full bg-white border-r border-slate-100 flex flex-col pt-6 px-3 gap-1 shrink-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Paramètres</p>
                {visibleSections.map(s => {
                    const active = section === s.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => setSection(s.id)}
                            className={`text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-1 ${active ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                        >
                            <span className={`text-sm ${active ? 'font-semibold text-slate-900' : 'font-medium text-gray-700'}`}>{s.label}</span>
                            <span className={`text-[11px] leading-snug ${active ? 'text-slate-600' : 'text-gray-500'}`}>{s.description}</span>
                        </button>
                    );
                })}
            </aside>
            <ScrollArea key={section} className="flex-1 h-full overflow-y-auto">
                {!allowed ? (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="text-center max-w-md px-6">
                            <div className="text-base font-medium text-gray-700">Section non autorisée</div>
                            <div className="text-sm text-gray-400 mt-1">Votre rôle ne permet pas d'accéder à cette section.</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {section === 'entreprise' && <EntrepriseSection />}
                        {section === 'numerotation' && <NumerotationSection />}
                        {section === 'utilisateurs' && <UtilisateursSection />}
                        {section === 'techniciens' && <TechniciensSection />}
                        {section === 'permissions' && <PermissionsSection />}
                        {section === 'stock' && <StockSection />}
                        {section === 'sauvegarde' && <SauvegardeSection />}
                        {section === 'journal' && <JournalSection />}
                    </>
                )}
            </ScrollArea>
        </div>
    );
}

const ROLES: { value: RoleAdmin; label: string }[] = [
    { value: 'super_admin', label: 'Super admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'gestionnaire', label: 'Gestionnaire' },
    { value: 'vendeur', label: 'Vendeur' },
    { value: 'demo', label: 'Démo' },
];

type UserFormState = {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    role: RoleAdmin;
    motDePasse: string;
    statut: 'actif' | 'inactif' | 'archivé';
};

const EMPTY_USER_FORM: UserFormState = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    role: 'vendeur',
    motDePasse: '',
    statut: 'actif',
};

function UtilisateursSection() {
    const { administrateurs, refreshAdministrateurs } = useDatabase();
    const { user: currentUser } = useAuth();
    const [editId, setEditId] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof UserFormState, string>>>({});
    const [serverError, setServerError] = useState<string | null>(null);

    const validate = () => {
        const e: Partial<Record<keyof UserFormState, string>> = {};
        if (!form.nom.trim()) e.nom = 'Requis';
        if (!form.prenom.trim()) e.prenom = 'Requis';
        if (!form.email.trim()) e.email = 'Requis';
        if (!editId && form.motDePasse.length < 6) e.motDePasse = 'Min. 6 caractères';
        if (editId && form.motDePasse && form.motDePasse.length < 6) e.motDePasse = 'Min. 6 caractères';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const openAdd = () => {
        setForm(EMPTY_USER_FORM);
        setErrors({});
        setServerError(null);
        setEditId(null);
        setShowAdd(true);
    };

    const openEdit = (a: Administrateur) => {
        setForm({
            nom: a.nom,
            prenom: a.prenom,
            email: a.email,
            telephone: a.telephone ?? '',
            role: a.role,
            motDePasse: '',
            statut: a.statut,
        });
        setErrors({});
        setServerError(null);
        setEditId(a.id);
        setShowAdd(true);
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        setServerError(null);
        try {
            if (editId) {
                await window.db.administrateurs.update(editId, {
                    nom: form.nom.trim(),
                    prenom: form.prenom.trim(),
                    email: form.email.trim(),
                    telephone: form.telephone.trim() || undefined,
                    role: form.role,
                    statut: form.statut,
                });
                if (form.motDePasse) {
                    const res = await window.auth.updateUserPassword(editId, form.motDePasse);
                    if (!res.ok) {
                        setServerError(res.error ?? 'Erreur mot de passe');
                        return;
                    }
                }
            } else {
                const res = await window.auth.createUser({
                    nom: form.nom.trim(),
                    prenom: form.prenom.trim(),
                    email: form.email.trim(),
                    telephone: form.telephone.trim() || undefined,
                    role: form.role,
                    motDePasse: form.motDePasse,
                    statut: form.statut,
                });
                if (!res.ok) {
                    setServerError(res.error ?? 'Erreur lors de la création');
                    return;
                }
            }
            await refreshAdministrateurs();
            setShowAdd(false);
            setEditId(null);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await window.db.administrateurs.delete(id);
        await refreshAdministrateurs();
    };

    const me = currentUser ? administrateurs.find(a => a.id === currentUser.id) : null;
    const others = administrateurs.filter(a => a.id !== currentUser?.id);
    const actifs = others.filter(a => a.statut === 'actif');
    const inactifs = others.filter(a => a.statut !== 'actif');

    return (
        <div className="px-8 py-6 max-w-3xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Utilisateurs</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Gérez les comptes et leurs rôles.</p>
                </div>
                <button
                    onClick={openAdd}
                    className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900"
                >
                    + Ajouter
                </button>
            </div>

            {showAdd && (
                <div className="border border-slate-200 rounded-2xl bg-slate-50 p-5 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold">{editId ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Prénom *" error={errors.prenom}>
                            <input autoFocus value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} className={inputCls(!!errors.prenom)} />
                        </Field>
                        <Field label="Nom *" error={errors.nom}>
                            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className={inputCls(!!errors.nom)} />
                        </Field>
                        <Field label="Email *" error={errors.email}>
                            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls(!!errors.email)} />
                        </Field>
                        <Field label="Téléphone">
                            <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} className={inputCls(false)} />
                        </Field>
                        <Field label="Rôle *">
                            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as RoleAdmin }))} className={inputCls(false)}>
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Statut">
                            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as UserFormState['statut'] }))} className={inputCls(false)}>
                                <option value="actif">Actif</option>
                                <option value="inactif">Inactif</option>
                                <option value="archivé">Archivé</option>
                            </select>
                        </Field>
                        <Field label={editId ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'} error={errors.motDePasse}>
                            <input type="password" value={form.motDePasse} onChange={e => setForm(f => ({ ...f, motDePasse: e.target.value }))} className={inputCls(!!errors.motDePasse)} placeholder="Min. 6 caractères" />
                        </Field>
                    </div>
                    {serverError && <p className="text-red-500 text-xs">{serverError}</p>}
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50">
                            {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Ajouter'}
                        </button>
                        <button onClick={() => { setShowAdd(false); setEditId(null); }} className="px-5 py-2 bg-white border border-slate-200 text-sm rounded-full hover:bg-slate-50">
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {administrateurs.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-12">Aucun utilisateur.</div>
            ) : (
                <div className="flex flex-col gap-2">
                    {me && (
                        <div className="contents">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Session active</p>
                            <UserRow key={me.id} admin={me} onEdit={openEdit} onDelete={handleDelete} isCurrent />
                        </div>
                    )}
                    {actifs.length > 0 && (
                        <div className="contents">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4">Autres utilisateurs actifs</p>
                            {actifs.map(a => <UserRow key={a.id} admin={a} onEdit={openEdit} onDelete={handleDelete} />)}
                        </div>
                    )}
                    {inactifs.length > 0 && (
                        <div className="contents">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4">Inactifs / Archivés</p>
                            {inactifs.map(a => <UserRow key={a.id} admin={a} onEdit={openEdit} onDelete={handleDelete} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function UserRow({ admin, onEdit, onDelete, isCurrent }: { admin: Administrateur; onEdit: (a: Administrateur) => void; onDelete: (id: string) => void; isCurrent?: boolean }) {
    const roleLabel = ROLES.find(r => r.value === admin.role)?.label ?? admin.role;
    return (
        <div className={`flex items-center gap-4 px-4 py-3 bg-white border rounded-xl group ${isCurrent ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}`}>
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center shrink-0">
                {(admin.prenom[0] ?? '').toUpperCase()}{(admin.nom[0] ?? '').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                    {admin.prenom} {admin.nom}
                    {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">vous</span>}
                </div>
                <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                    <span>{admin.email}</span>
                    {admin.telephone && <span>{admin.telephone}</span>}
                </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-blue-50 text-blue-700">{roleLabel}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${admin.statut === 'actif' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {admin.statut}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => onEdit(admin)} className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full">Modifier</button>
                <button onClick={() => onDelete(admin.id)} className="text-xs px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full">Supprimer</button>
            </div>
        </div>
    );
}

type FormState = {
    nom: string;
    prenom: string;
    telephone: string;
    email: string;
    specialite: string;
    statut: 'actif' | 'inactif' | 'archivé';
};

const EMPTY_FORM: FormState = {
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    specialite: '',
    statut: 'actif',
};

function TechniciensSection() {
    const { techniciens, createTechnicien, updateTechnicien, deleteTechnicien } = useDatabase();

    const [editId, setEditId] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Partial<FormState>>({});

    const validate = () => {
        const e: Partial<FormState> = {};
        if (!form.nom.trim()) e.nom = 'Requis';
        if (!form.prenom.trim()) e.prenom = 'Requis';
        if (!form.telephone.trim()) e.telephone = 'Requis';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setErrors({});
        setEditId(null);
        setShowAdd(true);
    };

    const openEdit = (t: Technicien) => {
        setForm({
            nom: t.nom,
            prenom: t.prenom,
            telephone: t.telephone,
            email: t.email ?? '',
            specialite: t.specialite ?? '',
            statut: t.statut,
        });
        setErrors({});
        setEditId(t.id);
        setShowAdd(true);
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const data = {
                nom: form.nom.trim(),
                prenom: form.prenom.trim(),
                telephone: form.telephone.trim(),
                email: form.email.trim() || undefined,
                specialite: form.specialite.trim() || undefined,
                statut: form.statut,
            };
            if (editId) {
                await updateTechnicien(editId, data);
            } else {
                await createTechnicien(data);
            }
            setShowAdd(false);
            setEditId(null);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        await deleteTechnicien(id);
    };

    const actifs = techniciens.filter(t => t.statut === 'actif');
    const inactifs = techniciens.filter(t => t.statut !== 'actif');

    return (
        <div className="px-8 py-6 max-w-3xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Techniciens</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Gérez les techniciens de l'entreprise.</p>
                </div>
                <button
                    onClick={openAdd}
                    className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900"
                >
                    + Ajouter
                </button>
            </div>

            {/* Form inline */}
            {showAdd && (
                <div className="border border-slate-200 rounded-2xl bg-slate-50 p-5 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold">{editId ? 'Modifier le technicien' : 'Nouveau technicien'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Prénom *" error={errors.prenom}>
                            <input
                                autoFocus
                                value={form.prenom}
                                onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                                className={inputCls(!!errors.prenom)}
                                placeholder="Jean"
                            />
                        </Field>
                        <Field label="Nom *" error={errors.nom}>
                            <input
                                value={form.nom}
                                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                                className={inputCls(!!errors.nom)}
                                placeholder="Dupont"
                            />
                        </Field>
                        <Field label="Téléphone *" error={errors.telephone}>
                            <input
                                value={form.telephone}
                                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                                className={inputCls(!!errors.telephone)}
                                placeholder="+237 6XX XXX XXX"
                            />
                        </Field>
                        <Field label="Email">
                            <input
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className={inputCls(false)}
                                placeholder="jean@exemple.com"
                            />
                        </Field>
                        <Field label="Spécialité">
                            <input
                                value={form.specialite}
                                onChange={e => setForm(f => ({ ...f, specialite: e.target.value }))}
                                className={inputCls(false)}
                                placeholder="Électricité, Plomberie…"
                            />
                        </Field>
                        <Field label="Statut">
                            <select
                                value={form.statut}
                                onChange={e => setForm(f => ({ ...f, statut: e.target.value as FormState['statut'] }))}
                                className={inputCls(false)}
                            >
                                <option value="actif">Actif</option>
                                <option value="inactif">Inactif</option>
                                <option value="archivé">Archivé</option>
                            </select>
                        </Field>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50"
                        >
                            {saving ? 'Enregistrement…' : editId ? 'Modifier' : 'Ajouter'}
                        </button>
                        <button
                            onClick={() => { setShowAdd(false); setEditId(null); }}
                            className="px-5 py-2 bg-white border border-slate-200 text-sm rounded-full hover:bg-slate-50"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {techniciens.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-12">
                    Aucun technicien. Cliquez sur "+ Ajouter" pour commencer.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {actifs.length > 0 && (
                        <div className="contents">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Actifs</p>
                            {actifs.map(t => <TechnicienRow key={t.id} tech={t} onEdit={openEdit} onDelete={handleDelete} />)}
                        </div>
                    )}
                    {inactifs.length > 0 && (
                        <div className="contents">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4">Inactifs / Archivés</p>
                            {inactifs.map(t => <TechnicienRow key={t.id} tech={t} onEdit={openEdit} onDelete={handleDelete} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TechnicienRow({
    tech,
    onEdit,
    onDelete,
}: {
    tech: Technicien;
    onEdit: (t: Technicien) => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div className="flex items-center gap-4 px-4 py-3 bg-white border border-slate-200 rounded-xl group">
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center shrink-0">
                {(tech.prenom[0] ?? '').toUpperCase()}{(tech.nom[0] ?? '').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{tech.prenom} {tech.nom}</div>
                <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                    <span>{tech.telephone}</span>
                    {tech.email && <span>{tech.email}</span>}
                    {tech.specialite && <span className="italic">{tech.specialite}</span>}
                </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${tech.statut === 'actif' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {tech.statut}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                    onClick={() => onEdit(tech)}
                    className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full"
                >
                    Modifier
                </button>
                <button
                    onClick={() => onDelete(tech.id)}
                    className="text-xs px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-full"
                >
                    Supprimer
                </button>
            </div>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{label}</label>
            {children}
            {error && <p className="text-red-500 text-[10px]">{error}</p>}
        </div>
    );
}

function inputCls(hasError: boolean) {
    return `w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white ${hasError ? 'border-red-400' : 'border-slate-200'}`;
}

type CustomField = {
    id: string;
    type: 'email' | 'tel' | 'url' | 'address' | 'text';
    label: string;
    value: string;
};

type EntrepriseForm = {
    matricule: string;
    nom: string;
    adresse: string;
    telephone: string;
    email: string;
    logoDataUrl: string;
    notesDevis: string;
    notesFacture: string;
    conditionsPaiement: string;
    customFields: CustomField[];
};

const EMPTY_ENTREPRISE: EntrepriseForm = {
    matricule: '', nom: '', adresse: '', telephone: '', email: '',
    logoDataUrl: '', notesDevis: '', notesFacture: '', conditionsPaiement: '',
    customFields: [],
};

const FIELD_TYPES: { value: CustomField['type']; label: string; placeholder: string }[] = [
    { value: 'email', label: 'Email', placeholder: 'contact@exemple.com' },
    { value: 'tel', label: 'Téléphone', placeholder: '+237 6XX XX XX XX' },
    { value: 'url', label: 'Site web', placeholder: 'https://exemple.com' },
    { value: 'address', label: 'Adresse', placeholder: 'Rue, ville, pays' },
    { value: 'text', label: 'Texte / Description', placeholder: 'Texte libre' },
];

function genId() { return Math.random().toString(36).slice(2, 10); }

function EntrepriseSection() {
    const { success, error: notifyError } = useAlerts();
    const [form, setForm] = useState<EntrepriseForm>(EMPTY_ENTREPRISE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        window.db.entreprises.getById().then((info) => {
            console.log('Entreprise info loaded:', info);
            setForm({ ...EMPTY_ENTREPRISE, ...info });
        }).catch(() => undefined).finally(() => setLoading(false));
    }, []);

    const handleLogoPick = () => fileRef.current?.click();

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            notifyError('Logo trop volumineux', 'La taille du logo doit être inférieure à 2 Mo.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            console.log(String(reader.result))
            setForm((f) => ({ ...f, logoDataUrl: String(reader.result ?? '') }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const setupDone = !!form.nom.trim();
            await window.db.entreprises.update({ ...form, setupDone });
            setForm((f) => ({ ...f, setupDone }));
            window.dispatchEvent(new Event('company:changed'));
            success('Informations enregistrées', 'Les informations de l\'entreprise ont été mises à jour.');
        } catch (e) {
            notifyError('Erreur', 'Impossible d\'enregistrer les informations.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="px-8 py-6 text-sm text-gray-500">Chargement…</div>;
    }

    return (
        <div className="px-8 py-6 max-w-3xl flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-semibold">Entreprise</h2>
                <p className="text-sm text-gray-500 mt-0.5">Informations affichées sur les devis et factures.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-5">
                <div>
                    <label className="text-xs font-medium text-gray-600 block mb-2">Logo</label>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-24 rounded-xl bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                            {form.logoDataUrl
                                ? <img src={form.logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                : <span className="text-[10px] text-gray-400">Aucun logo</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                            <button onClick={handleLogoPick} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900">
                                {form.logoDataUrl ? 'Changer le logo' : 'Ajouter un logo'}
                            </button>
                            {form.logoDataUrl && (
                                <button onClick={() => setForm((f) => ({ ...f, logoDataUrl: '' }))} className="px-4 py-2 bg-white border border-slate-200 text-sm rounded-full hover:bg-slate-50">
                                    Retirer
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Nom de l'entreprise</label>
                        <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={inputCls(false)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Email</label>
                        <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls(false)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Téléphone</label>
                        <input value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={inputCls(false)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Adresse</label>
                        <input value={form.adresse} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} className={inputCls(false)} />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-xs font-medium text-gray-600">Matricule de l'entreprise</label>
                        <input value={form.matricule} onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))} className={inputCls(false)} />
                    </div>
                </div>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-5">
                <h3 className="text-sm font-semibold">Notes par défaut</h3>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Notes des devis</label>
                    <textarea
                        value={form.notesDevis}
                        onChange={(e) => setForm((f) => ({ ...f, notesDevis: e.target.value }))}
                        rows={3}
                        className={inputCls(false) + ' resize-none'}
                        placeholder="Texte affiché par défaut en bas des devis (si le devis n'a pas de note spécifique)"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Notes des factures</label>
                    <textarea
                        value={form.notesFacture}
                        onChange={(e) => setForm((f) => ({ ...f, notesFacture: e.target.value }))}
                        rows={3}
                        className={inputCls(false) + ' resize-none'}
                        placeholder="Texte affiché par défaut en bas des factures"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Conditions de paiement</label>
                    <textarea
                        value={form.conditionsPaiement}
                        onChange={(e) => setForm((f) => ({ ...f, conditionsPaiement: e.target.value }))}
                        rows={3}
                        className={inputCls(false) + ' resize-none'}
                        placeholder="Ex : Paiement à 30 jours, par virement bancaire sur le compte XXXX…"
                    />
                </div>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">Informations supplémentaires</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Ajoutez d'autres emails, téléphones, sites web, adresses ou descriptions.</p>
                    </div>
                    <button
                        onClick={() => setForm((f) => ({
                            ...f,
                            customFields: [...f.customFields, { id: genId(), type: 'email', label: '', value: '' }],
                        }))}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-sm rounded-full"
                    >
                        + Ajouter un champ
                    </button>
                </div>

                {form.customFields.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun champ supplémentaire.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {form.customFields.map((field) => {
                            const fieldType = FIELD_TYPES.find((t) => t.value === field.type);
                            const updateField = (patch: Partial<CustomField>) => {
                                setForm((f) => ({
                                    ...f,
                                    customFields: f.customFields.map((c) => c.id === field.id ? { ...c, ...patch } : c),
                                }));
                            };
                            const removeField = () => {
                                setForm((f) => ({
                                    ...f,
                                    customFields: f.customFields.filter((c) => c.id !== field.id),
                                }));
                            };
                            return (
                                <div key={field.id} className="grid grid-cols-[140px_180px_1fr_auto] gap-2 items-start">
                                    <select
                                        value={field.type}
                                        onChange={(e) => updateField({ type: e.target.value as CustomField['type'] })}
                                        className={inputCls(false)}
                                    >
                                        {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                    <input
                                        value={field.label}
                                        onChange={(e) => updateField({ label: e.target.value })}
                                        className={inputCls(false)}
                                        placeholder="Libellé (ex : Atelier)"
                                    />
                                    {field.type === 'address' || field.type === 'text' ? (
                                        <textarea
                                            value={field.value}
                                            onChange={(e) => updateField({ value: e.target.value })}
                                            className={inputCls(false) + ' resize-none'}
                                            rows={2}
                                            placeholder={fieldType?.placeholder}
                                        />
                                    ) : (
                                        <input
                                            type={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                            value={field.value}
                                            onChange={(e) => updateField({ value: e.target.value })}
                                            className={inputCls(false)}
                                            placeholder={fieldType?.placeholder}
                                        />
                                    )}
                                    <button
                                        onClick={removeField}
                                        className="h-9 px-3 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-full"
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
            </div>
        </div>
    );
}

// ======================== NUMEROTATION & DOCUMENTS ========================

type NumerotationForm = {
    devisPrefix: string;
    facturePrefix: string;
    numeroFormat: string;
    tvaDefault: number;
    devise: string;
    afficherTVA: boolean;
};

const EMPTY_NUMEROTATION: NumerotationForm = {
    devisPrefix: 'DEV',
    facturePrefix: 'FAC',
    numeroFormat: 'PREFIX-YYYY-NNNN',
    tvaDefault: 19.25,
    devise: 'FCFA',
    afficherTVA: true,
};

const FORMAT_OPTIONS = [
    { value: 'PREFIX-YYYY-NNNN', label: 'PREFIX-YYYY-NNNN (ex : DEV-2026-0001)' },
    { value: 'PREFIX-YY-NNNN', label: 'PREFIX-YY-NNNN (ex : DEV-26-0001)' },
    { value: 'PREFIX-YYYYMM-NNNN', label: 'PREFIX-YYYYMM-NNNN (ex : DEV-202606-0001)' },
    { value: 'PREFIX-NNNN', label: 'PREFIX-NNNN (ex : DEV-0001)' },
];

function previewNumero(format: string, prefix: string): string {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const yy = yyyy.slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return format
        .replace('PREFIX', prefix || 'PREFIX')
        .replace('YYYYMM', yyyy + mm)
        .replace('YYYY', yyyy)
        .replace('YY', yy)
        .replace('NNNN', '0001');
}

function NumerotationSection() {
    const { success, error: notifyError } = useAlerts();
    const [form, setForm] = useState<NumerotationForm>(EMPTY_NUMEROTATION);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        window.db.entreprises.getById().then((info) => {
            if (info) {
                setForm({
                    devisPrefix: info.devisPrefix || EMPTY_NUMEROTATION.devisPrefix,
                    facturePrefix: info.facturePrefix || EMPTY_NUMEROTATION.facturePrefix,
                    numeroFormat: info.numeroFormat || EMPTY_NUMEROTATION.numeroFormat,
                    tvaDefault: typeof info.tvaDefault === 'number' ? info.tvaDefault : EMPTY_NUMEROTATION.tvaDefault,
                    devise: info.devise || EMPTY_NUMEROTATION.devise,
                    afficherTVA: typeof info.afficherTVA === 'boolean' ? info.afficherTVA : EMPTY_NUMEROTATION.afficherTVA,
                });
            }
        }).catch(() => undefined).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await window.db.entreprises.update(form);
            window.dispatchEvent(new Event('company:changed'));
            success('Numérotation enregistrée', 'Les paramètres de numérotation ont été mis à jour.');
        } catch {
            notifyError('Erreur', "Impossible d'enregistrer les paramètres.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="px-8 py-6 text-sm text-gray-500">Chargement…</div>;

    return (
        <div className="px-8 py-6 max-w-3xl flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-semibold">Numérotation & documents</h2>
                <p className="text-sm text-gray-500 mt-0.5">Format des numéros, TVA par défaut et devise des documents.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-5">
                <h3 className="text-sm font-semibold">Préfixes</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Préfixe devis</label>
                        <input value={form.devisPrefix} onChange={(e) => setForm((f) => ({ ...f, devisPrefix: e.target.value.toUpperCase() }))} className={inputCls(false)} placeholder="DEV" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Préfixe facture</label>
                        <input value={form.facturePrefix} onChange={(e) => setForm((f) => ({ ...f, facturePrefix: e.target.value.toUpperCase() }))} className={inputCls(false)} placeholder="FAC" />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Format du numéro</label>
                    <select value={form.numeroFormat} onChange={(e) => setForm((f) => ({ ...f, numeroFormat: e.target.value }))} className={inputCls(false)}>
                        {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-1">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Aperçu</p>
                    <div className="flex gap-6 text-sm">
                        <div><span className="text-gray-500">Devis : </span><span className="font-mono font-medium">{previewNumero(form.numeroFormat, form.devisPrefix)}</span></div>
                        <div><span className="text-gray-500">Facture : </span><span className="font-mono font-medium">{previewNumero(form.numeroFormat, form.facturePrefix)}</span></div>
                    </div>
                </div>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-5">
                <h3 className="text-sm font-semibold">Valeurs par défaut</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">TVA par défaut (%)</label>
                        <input type="number" step="0.01" min="0" value={form.tvaDefault} onChange={(e) => setForm((f) => ({ ...f, tvaDefault: parseFloat(e.target.value) || 0 }))} className={inputCls(false)} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">Devise</label>
                        <input value={form.devise} onChange={(e) => setForm((f) => ({ ...f, devise: e.target.value }))} className={inputCls(false)} placeholder="FCFA" />
                    </div>
                </div>

                <div className="flex items-start justify-between gap-4 pt-2 border-t border-slate-100">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-800">Afficher la TVA sur les documents</span>
                        <span className="text-xs text-gray-500">Valeur par défaut pour les nouveaux devis et factures. Modifiable au cas par cas.</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, afficherTVA: !f.afficherTVA }))}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.afficherTVA ? 'bg-emerald-600' : 'bg-slate-300'}`}
                        aria-pressed={form.afficherTVA}
                    >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.afficherTVA ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
            </div>
        </div>
    );
}

// ======================== PERMISSIONS ========================

const PERMISSION_GROUPS: { group: string; actions: { key: string; label: string; roles: Record<RoleAdmin, boolean> }[] }[] = [
    {
        group: 'Articles & catalogue',
        actions: [
            { key: 'articles.read', label: 'Consulter', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: true, demo: true } },
            { key: 'articles.create', label: 'Créer', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: false, demo: true } },
            { key: 'articles.update', label: 'Modifier', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: false, demo: true } },
            { key: 'articles.delete', label: 'Supprimer', roles: { super_admin: true, admin: true, gestionnaire: false, vendeur: false, demo: true } },
        ],
    },
    {
        group: 'Clients',
        actions: [
            { key: 'clients.read', label: 'Consulter', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: true, demo: true } },
            { key: 'clients.create', label: 'Créer', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: true, demo: true } },
            { key: 'clients.update', label: 'Modifier', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: true, demo: true } },
            { key: 'clients.delete', label: 'Supprimer', roles: { super_admin: true, admin: true, gestionnaire: false, vendeur: false, demo: true } },
        ],
    },
    {
        group: 'Devis & factures',
        actions: [
            { key: 'documents.read', label: 'Consulter', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: true, demo: true } },
            { key: 'documents.create', label: 'Créer (max. 5 devis + 5 factures)', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: true, demo: true } },
            { key: 'documents.update', label: 'Modifier', roles: { super_admin: true, admin: true, gestionnaire: true, vendeur: false, demo: true } },
            { key: 'documents.delete', label: 'Supprimer', roles: { super_admin: true, admin: true, gestionnaire: false, vendeur: false, demo: true } },
        ],
    },
    {
        group: 'Utilisateurs & paramètres',
        actions: [
            { key: 'users.manage', label: 'Gérer les comptes', roles: { super_admin: true, admin: true, gestionnaire: false, vendeur: false, demo: false } },
            { key: 'settings.write', label: 'Modifier les paramètres', roles: { super_admin: true, admin: true, gestionnaire: false, vendeur: false, demo: true } },
            { key: 'audit.read', label: "Consulter le journal d'activité", roles: { super_admin: true, admin: true, gestionnaire: false, vendeur: false, demo: true } },
        ],
    },
];

function PermissionsSection() {
    const { administrateurs, refreshAdministrateurs } = useDatabase();
    const { user: currentUser } = useAuth();
    const { success, error: notifyError } = useAlerts();
    const [savingId, setSavingId] = useState<string | null>(null);

    const handleRoleChange = async (admin: Administrateur, newRole: RoleAdmin) => {
        if (admin.role === newRole) return;
        setSavingId(admin.id);
        try {
            await window.db.administrateurs.update(admin.id, { role: newRole });
            await refreshAdministrateurs();
            success('Rôle mis à jour', `${admin.prenom} ${admin.nom} est maintenant ${ROLES.find(r => r.value === newRole)?.label ?? newRole}.`);
        } catch {
            notifyError('Erreur', 'Impossible de changer le rôle.');
        } finally {
            setSavingId(null);
        }
    };

    const me = currentUser ? administrateurs.find(a => a.id === currentUser.id) : null;
    const others = administrateurs.filter(a => a.id !== currentUser?.id);

    return (
        <div className="px-8 py-6 max-w-4xl flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-semibold">Permissions</h2>
                <p className="text-sm text-gray-500 mt-0.5">Matrice des droits par rôle et attribution des rôles aux utilisateurs.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-4">
                <div>
                    <h3 className="text-sm font-semibold">Utilisateurs & rôles</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Modifiez le rôle d'un utilisateur pour ajuster ses permissions.</p>
                </div>

                {administrateurs.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Aucun utilisateur.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {me && (
                            <>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Session active</p>
                                <PermissionUserRow admin={me} isCurrent savingId={savingId} onRoleChange={handleRoleChange} />
                            </>
                        )}
                        {others.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-3">Autres utilisateurs</p>
                                {others.map(a => (
                                    <PermissionUserRow key={a.id} admin={a} savingId={savingId} onRoleChange={handleRoleChange} />
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-sm font-semibold mb-2">Matrice des droits par rôle</h3>
                <p className="text-xs text-gray-500 mb-3">Lecture seule. Chaque rôle ouvre les actions cochées ci-dessous.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                            {ROLES.map((r) => (
                                <th key={r.value} className="px-3 py-3 font-medium text-gray-600 text-center w-28">{r.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {PERMISSION_GROUPS.flatMap((group) => [
                            <tr key={`group-${group.group}`} className="bg-slate-50/50">
                                <td colSpan={ROLES.length + 1} className="px-4 py-2 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{group.group}</td>
                            </tr>,
                            ...group.actions.map((action) => (
                                <tr key={action.key} className="border-t border-slate-100">
                                    <td className="px-4 py-2.5 text-gray-700">{action.label}</td>
                                    {ROLES.map((r) => (
                                        <td key={r.value} className="px-3 py-2.5 text-center">
                                            {action.roles[r.value] ? (
                                                <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs leading-5">✓</span>
                                            ) : (
                                                <span className="inline-block w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-xs leading-5">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            )),
                        ])}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-gray-400">L'édition de la matrice sera disponible dans une prochaine version.</p>
        </div>
    );
}

function PermissionUserRow({
    admin,
    isCurrent,
    savingId,
    onRoleChange,
}: {
    admin: Administrateur;
    isCurrent?: boolean;
    savingId: string | null;
    onRoleChange: (admin: Administrateur, role: RoleAdmin) => void;
}) {
    const saving = savingId === admin.id;
    return (
        <div className={`flex items-center gap-4 px-4 py-3 bg-white border rounded-xl ${isCurrent ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}`}>
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center shrink-0">
                {(admin.prenom[0] ?? '').toUpperCase()}{(admin.nom[0] ?? '').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                    {admin.prenom} {admin.nom}
                    {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">vous</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{admin.email}</div>
            </div>
            <select
                value={admin.role}
                onChange={(e) => onRoleChange(admin, e.target.value as RoleAdmin)}
                disabled={saving || isCurrent}
                title={isCurrent ? 'Vous ne pouvez pas modifier votre propre rôle' : ''}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-full bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {saving && <span className="text-[10px] text-gray-400">…</span>}
        </div>
    );
}

// ======================== STOCK & INVENTAIRE ========================

function StockSection() {
    const { user } = useAuth();
    const { success, error: notifyError } = useAlerts();
    const [reapproOpen, setReapproOpen] = useState(false);
    const [boutiques, setBoutiques] = useState<Array<{ id: string; nom: string; isPrincipal?: boolean | number }>>([]);
    const [scope, setScope] = useState<string>('');
    const [starting, setStarting] = useState(false);
    const [history, setHistory] = useState<any[]>([]);

    const reloadHistory = async () => {
        const all = await window.db.inventaires.getAll();
        setHistory(all ?? []);
    };

    useEffect(() => {
        window.db.boutiques.getAll().then((bs: any[]) => {
            setBoutiques(bs ?? []);
            const principal = (bs ?? []).find((b: any) => b.isPrincipal);
            setScope(principal?.id ?? '');
        });
        reloadHistory();
    }, []);

    const startInventaire = async () => {
        if (!user) { notifyError('Erreur', 'Utilisateur non connecté.'); return; }
        const label = scope === '__all__'
            ? `inventaire complet (${boutiques.length} boutique(s))`
            : `inventaire de ${boutiques.find((b) => b.id === scope)?.nom ?? '—'}`;
        if (!confirm(`Démarrer un ${label} ?\n\nUn fichier Excel de sauvegarde sera créé. L'application restera sur la page d'inventaire jusqu'à validation ou annulation (même après redémarrage).`)) return;
        setStarting(true);
        try {
            const backup = await window.db.inventaires.exportCurrentBackup();
            if (!backup?.ok) {
                notifyError('Échec du backup', 'Impossible de créer le fichier de sauvegarde. Inventaire non démarré.');
                return;
            }
            const inv = await window.db.inventaires.create({
                boutiqueId: scope === '__all__' ? null : scope,
                exportPath: backup.filePath,
                createdBy: user.id,
            });
            if (!inv) {
                notifyError('Échec', 'Impossible de créer l\'inventaire.');
                return;
            }
            success('Inventaire démarré', 'Vous allez être redirigé.');
            window.location.reload();
        } catch (e) {
            console.error(e);
            notifyError('Erreur', (e as Error).message);
        } finally {
            setStarting(false);
        }
    };

    return (
        <div className="px-8 py-6 max-w-4xl flex flex-col gap-8">
            <div>
                <h2 className="text-xl font-semibold">Stock & inventaire</h2>
                <p className="text-sm text-gray-500 mt-0.5">Deux opérations distinctes : réapprovisionner ajoute au stock existant; l'inventaire remplace les quantités après comptage physique.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <h3 className="font-semibold">Réapprovisionnement</h3>
                        <p className="text-sm text-slate-500 mt-1">Ajoute des quantités au stock de la <b>boutique principale</b>. Opération additive, sans risque pour l'historique. Saisie manuelle ou import Excel.</p>
                    </div>
                    <button
                        onClick={() => setReapproOpen(true)}
                        className="px-5 py-2 bg-blue-700 text-white rounded-full text-sm whitespace-nowrap"
                    >Réapprovisionner</button>
                </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
                <div>
                    <h3 className="font-semibold">Nouvel inventaire</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Recompte physique. Un Excel de sauvegarde est créé avant tout. À la validation, les quantités saisies <b>remplacent</b> celles en base. Les articles non comptés gardent leur valeur actuelle.
                    </p>
                    <p className="text-xs text-amber-700 mt-2">⚠ Tant qu'un inventaire est en cours, l'application reste sur la page d'inventaire à chaque ouverture.</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-600">Portée :</label>
                    <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        className="text-sm p-2 border border-slate-200 rounded-lg bg-white"
                    >
                        <option value="__all__">Toutes les boutiques</option>
                        {boutiques.map((b) => (
                            <option key={b.id} value={b.id}>{b.nom} {b.isPrincipal ? '(principale)' : ''}</option>
                        ))}
                    </select>
                    <button
                        onClick={startInventaire}
                        disabled={starting || !scope}
                        className="px-5 py-2 bg-emerald-600 text-white rounded-full text-sm disabled:opacity-40"
                    >{starting ? 'Démarrage…' : 'Démarrer l\'inventaire'}</button>
                </div>
            </div>

            <div className="border border-slate-200 rounded-2xl p-6 flex flex-col gap-3">
                <h3 className="font-semibold">Historique des inventaires</h3>
                {history.length === 0 && <p className="text-sm text-slate-400">Aucun inventaire enregistré.</p>}
                {history.length > 0 && (
                    <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="text-left py-2">Date</th>
                                <th className="text-left py-2">Portée</th>
                                <th className="text-left py-2">Statut</th>
                                <th className="text-left py-2">Backup</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h) => (
                                <tr key={h.id} className="border-b border-slate-50">
                                    <td className="py-2 text-xs">{new Date(h.startedAt).toLocaleString('fr-FR')}</td>
                                    <td className="py-2 text-xs">{h.boutiqueId ? boutiques.find((b) => b.id === h.boutiqueId)?.nom ?? '—' : 'Toutes'}</td>
                                    <td className="py-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${h.status === 'valide' ? 'bg-emerald-100 text-emerald-700' : h.status === 'brouillon' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {h.status}
                                        </span>
                                    </td>
                                    <td className="py-2 text-xs">
                                        {h.exportPath ? (
                                            <button onClick={() => window.shell.showItemInFolder(h.exportPath)} className="text-blue-600 hover:underline">Ouvrir</button>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ReapproModal open={reapproOpen} onClose={() => setReapproOpen(false)} />
        </div>
    );
}

// ======================== SAUVEGARDE & SYNCHRONISATION ========================

function SauvegardeSection() {
    const { success: notifySuccess, error: notifyError } = useAlerts();
    const [cfg, setCfg] = useState<{ serverUrl: string; token: string; clientId: string; enabled: boolean; syncInterval: number; lastSyncAt: string | null } | null>(null);
    const [serverUrl, setServerUrl] = useState('');
    const [email, setEmail] = useState('');
    const [motDePasse, setMotDePasse] = useState('');
    const [pwVisible, setPwVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);

    useEffect(() => {
        window.syncApi.getConfig().then((c) => {
            setCfg(c);
            setServerUrl(c.serverUrl);
        });
    }, []);

    useEffect(() => {
        const unsub = window.updateApi.onStatus(setUpdateStatus);
        return unsub;
    }, []);

    const wasCheckingRef = useRef(false);
    useEffect(() => {
        if (wasCheckingRef.current && !updateStatus?.checking) {
            if (updateStatus?.error) {
                notifyError('Mise à jour', updateStatus.error);
            } else if (updateStatus?.available) {
                notifySuccess('Mise à jour', `Nouvelle version disponible : ${updateStatus.version}`);
            } else {
                notifySuccess('Mise à jour', 'Vous utilisez déjà la dernière version.');
            }
        }
        wasCheckingRef.current = !!updateStatus?.checking;
    }, [updateStatus?.checking]);

    const handleCheckUpdate = async () => {
        try {
            await window.updateApi.check();
        } catch {
            notifyError('Mise à jour', 'Impossible de vérifier les mises à jour.');
        }
    };

    const handleDownloadUpdate = async () => {
        try {
            await window.updateApi.download();
        } catch {
            notifyError('Mise à jour', 'Échec du téléchargement de la mise à jour.');
        }
    };

    const handleInstallUpdate = async () => {
        try {
            await window.updateApi.install();
        } catch {
            notifyError('Mise à jour', "Échec de l'installation de la mise à jour.");
        }
    };

    const saveUrl = async () => {
        setBusy(true);
        const next = await window.syncApi.setConfig({ serverUrl: serverUrl.trim() });
        setCfg(next);
        setBusy(false);
        notifySuccess('Sync', 'URL serveur enregistrée.');
    };

    const testConn = async () => {
        setBusy(true);
        const res = await window.syncApi.testConnection();
        setBusy(false);
        if (res.ok) notifySuccess('Sync', 'Connexion serveur OK.');
        else notifyError('Sync', res.error || 'Échec connexion');
    };

    const doLogin = async () => {
        setBusy(true);
        const res = await window.syncApi.login(email, motDePasse);
        setBusy(false);
        if (res.ok) {
            const next = await window.syncApi.getConfig();
            setCfg(next);
            setEmail(''); setMotDePasse('');
            notifySuccess('Sync', `Connecté en tant que ${res.user?.email}`);
            const role = res.user?.role ?? null;
            void syncClient
                .start()
                .then(() => syncClient.bootstrapIfEmpty(role))
                .catch(() => undefined);
        } else {
            notifyError('Sync', res.error || 'Identifiants invalides');
        }
    };

    const doLogout = async () => {
        await window.syncApi.logout();
        const next = await window.syncApi.getConfig();
        setCfg(next);
        notifySuccess('Sync', 'Déconnecté du serveur.');
    };

    const doInit = async () => {
        setBusy(true);
        const res = await window.syncApi.initServer();
        setBusy(false);
        if (res.ok) notifySuccess('Sync', 'Tables serveur initialisées.');
        else notifyError('Sync', res.error || 'Échec init');
    };

    const connected = !!cfg?.token;

    return (
        <div className="px-8 py-6 max-w-3xl flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-semibold">Sauvegarde & synchronisation</h2>
                <p className="text-sm text-gray-500 mt-0.5">État de la sync cloud et gestion locale de la base de données.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">Synchronisation cloud</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Base répliquée vers Cloudflare D1 via Workers.</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {connected ? 'Connecté' : 'Non connecté'}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Client ID</p>
                        <p className="mt-1 font-mono text-[11px] text-gray-700 truncate">{cfg?.clientId || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Dernière sync</p>
                        <p className="mt-1 font-medium text-gray-700">{cfg?.lastSyncAt ? new Date(cfg.lastSyncAt).toLocaleString('fr-FR') : 'Jamais'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-gray-600">URL du serveur</label>
                    <div className="flex gap-2">
                        <input
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="https://kataleya-server.workers.dev"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <button onClick={saveUrl} disabled={busy} className="px-3 py-2 bg-slate-800 text-white text-sm rounded-lg disabled:opacity-50">Enregistrer</button>
                        <button onClick={testConn} disabled={busy || !cfg?.serverUrl} className="px-3 py-2 bg-white border border-slate-200 text-sm rounded-lg disabled:opacity-50">Tester</button>
                    </div>
                </div>

                {!connected ? (
                    <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                        <label className="text-xs font-semibold text-gray-600">Connexion au serveur</label>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@kataleya.com"
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <div className="relative">
                            <input
                                type={pwVisible ? 'text' : 'password'}
                                value={motDePasse}
                                onChange={(e) => setMotDePasse(e.target.value)}
                                placeholder="Mot de passe"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setPwVisible((v) => !v)}
                                className="absolute inset-y-0 right-1 flex items-center justify-center w-8 rounded-lg hover:bg-slate-100"
                            >
                                {pwVisible ? <RiEyeOffFill className="h-5 w-5" /> : <RiEyeFill className="h-5 w-5" />}
                            </button>
                        </div>
                        <button onClick={doLogin} disabled={busy || !cfg?.serverUrl} className="self-start px-4 py-2 bg-emerald-600 text-white text-sm rounded-full disabled:opacity-50">
                            Se connecter
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2 border-t border-slate-100 pt-4">
                        <button onClick={doInit} disabled={busy} className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full disabled:opacity-50">Initialiser les tables D1</button>
                        <button onClick={doLogout} className="px-4 py-2 bg-white border border-slate-200 text-sm rounded-full">Se déconnecter</button>
                    </div>
                )}
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-4">
                <div>
                    <h3 className="text-sm font-semibold">Sauvegarde locale</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Exporter ou restaurer la base SQLite locale.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => notifySuccess('Export', 'Fonctionnalité bientôt disponible.')}
                        className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900"
                    >
                        Exporter la base
                    </button>
                    <button
                        onClick={() => notifySuccess('Import', 'Fonctionnalité bientôt disponible.')}
                        className="px-4 py-2 bg-white border border-slate-200 text-sm rounded-full hover:bg-slate-50"
                    >
                        Importer une sauvegarde
                    </button>
                </div>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold">Mises à jour</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Vérifiez et installez la dernière version publiée sur GitHub.</p>
                    </div>
                    {updateStatus?.available && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                            Nouvelle version disponible
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Version actuelle</p>
                        <p className="mt-1 font-mono text-[11px] text-gray-700">{updateStatus?.currentVersion || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Dernière version GitHub</p>
                        <p className="mt-1 font-mono text-[11px] text-gray-700">{updateStatus?.version || updateStatus?.currentVersion || '—'}</p>
                    </div>
                </div>

                <p className="text-[11px] text-gray-400">
                    {updateStatus?.checking
                        ? 'Vérification en cours…'
                        : updateStatus?.lastChecked
                            ? `Dernière vérification : ${new Date(updateStatus.lastChecked).toLocaleString('fr-FR')}`
                            : 'Aucune vérification effectuée pour le moment.'}
                </p>

                {updateStatus?.downloading && (
                    <div className="flex flex-col gap-1">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-slate-800 transition-all"
                                style={{ width: `${updateStatus.progress}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-gray-500">Téléchargement… {updateStatus.progress}%</p>
                    </div>
                )}

                {updateStatus?.error && (
                    <p className="text-xs text-red-600">{updateStatus.error}</p>
                )}

                <div className="flex gap-2">
                    {updateStatus?.downloaded ? (
                        <button
                            onClick={handleInstallUpdate}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-full hover:bg-emerald-700"
                        >
                            Installer et redémarrer
                        </button>
                    ) : updateStatus?.available ? (
                        <button
                            onClick={handleDownloadUpdate}
                            disabled={updateStatus?.downloading}
                            className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
                        >
                            {updateStatus?.downloading ? <SvgSpinners180Ring className="h-4 w-4" /> : null}
                            Télécharger la mise à jour {updateStatus.version}
                        </button>
                    ) : (
                        <button
                            onClick={handleCheckUpdate}
                            disabled={updateStatus?.checking}
                            className="px-4 py-2 bg-slate-800 text-white text-sm rounded-full hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
                        >
                            {updateStatus?.checking ? <SvgSpinners180Ring className="h-4 w-4" /> : null}
                            Vérifier les mises à jour
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ======================== JOURNAL D'ACTIVITE ========================

function JournalSection() {
    return (
        <div className="px-8 py-6 max-w-4xl flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-semibold">Journal d'activité</h2>
                <p className="text-sm text-gray-500 mt-0.5">Historique des actions des utilisateurs sur les données.</p>
            </div>

            <div className="border border-slate-200 rounded-2xl bg-white p-12 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                </div>
                <h3 className="text-sm font-semibold">Aucune activité enregistrée</h3>
                <p className="text-xs text-gray-500 max-w-md">Le journal d'audit sera alimenté automatiquement à mesure que les utilisateurs créent, modifient ou suppriment des données.</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 mt-2">Bientôt disponible</span>
            </div>
        </div>
    );
}
