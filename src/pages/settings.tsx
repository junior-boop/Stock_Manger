import { useState } from 'react';
import { useDatabase } from '../databaseProvider';
import { Technicien } from '../Databases/db.d';

type Section = 'techniciens';

const SECTIONS: { id: Section; label: string }[] = [
    { id: 'techniciens', label: 'Techniciens' },
];

export default function SettingsPage() {
    const [section, setSection] = useState<Section>('techniciens');

    return (
        <div className="flex h-full w-full">
            <aside className="w-52 h-full bg-white border-r border-slate-100 flex flex-col pt-6 px-3 gap-1 shrink-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Paramètres</p>
                {SECTIONS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setSection(s.id)}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${section === s.id ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50 text-gray-600'}`}
                    >
                        {s.label}
                    </button>
                ))}
            </aside>
            <div className="flex-1 h-full overflow-y-auto">
                {section === 'techniciens' && <TechniciensSection />}
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
                        <>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Actifs</p>
                            {actifs.map(t => <TechnicienRow key={t.id} tech={t} onEdit={openEdit} onDelete={handleDelete} />)}
                        </>
                    )}
                    {inactifs.length > 0 && (
                        <>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mt-4">Inactifs / Archivés</p>
                            {inactifs.map(t => <TechnicienRow key={t.id} tech={t} onEdit={openEdit} onDelete={handleDelete} />)}
                        </>
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
