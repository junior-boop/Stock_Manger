import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { Client, StatutProjet } from '../Databases/db.d';
import { formatDate } from '../libs/format';
import ScrollArea from '../components/scroll_area';

function displayClient(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

export default function ProjetNewPage() {
    const navigate = useNavigate();
    const { clients, createProjet } = useDatabase();
    const { user } = useAuth();

    const [form, setForm] = useState({
        nom: '',
        description: '',
        clientId: '',
        statut: 'planifié' as StatutProjet,
        dateDebut: new Date().toISOString().slice(0, 10),
        dateFin: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.nom.trim()) e.nom = 'Nom requis';
        if (!form.clientId) e.clientId = 'Client requis';
        if (!form.dateDebut) e.dateDebut = 'Date de début requise';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const result = await createProjet({
                nom: form.nom,
                description: form.description || undefined,
                clientId: form.clientId,
                statut: form.statut,
                dateDebut: new Date(form.dateDebut).toISOString(),
                dateFin: form.dateFin ? new Date(form.dateFin).toISOString() : undefined,
                notes: form.notes || undefined,
                devisIds: [],
                technicienIds: [],
                createdBy: user?.id ?? '',
            });
            if (result) navigate(`/projets/${result.id}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollArea className="flex-1 flex flex-col h-full overflow-y-auto">
            <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Nouveau projet</h1>
            </div>

            <form onSubmit={handleSubmit} className="px-10 py-6 max-w-2xl flex flex-col gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Nom du projet *</label>
                    <input
                        type="text"
                        value={form.nom}
                        onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                        className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.nom ? 'border-red-400' : 'border-gray-300'}`}
                        placeholder="Ex : Chantier Villa Dupont"
                    />
                    {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Client *</label>
                    <select
                        value={form.clientId}
                        onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
                        className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.clientId ? 'border-red-400' : 'border-gray-300'}`}
                    >
                        <option value="">Sélectionner un client</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{displayClient(c)}</option>
                        ))}
                    </select>
                    {errors.clientId && <p className="text-red-500 text-xs mt-1">{errors.clientId}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        placeholder="Description du chantier…"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Date de début *</label>
                        <input
                            type="date"
                            value={form.dateDebut}
                            onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
                            className={`w-full p-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.dateDebut ? 'border-red-400' : 'border-gray-300'}`}
                        />
                        {errors.dateDebut && <p className="text-red-500 text-xs mt-1">{errors.dateDebut}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Date de fin prévue</label>
                        <input
                            type="date"
                            value={form.dateFin}
                            onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Statut</label>
                    <select
                        value={form.statut}
                        onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutProjet }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="planifié">Planifié</option>
                        <option value="en_cours">En cours</option>
                        <option value="en_pause">En pause</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/projets')}
                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
                    >
                        {saving ? 'Enregistrement…' : 'Créer le projet'}
                    </button>
                </div>
            </form>
        </ScrollArea>
    );
}
