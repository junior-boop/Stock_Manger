import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { Client, Devis, StatutProjet, StatutTache, TacheProjet, Technicien } from '../Databases/db.d';
import { statutLabel, statutColor } from '../layouts/projets_layouts';
import { formatDate, formatFCFA } from '../libs/format';
import { FluentAdd32Regular } from '../libs/icons';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const COLONNES: { id: StatutTache; label: string; color: string }[] = [
    { id: 'à_faire', label: 'À faire', color: 'bg-slate-100' },
    { id: 'en_cours', label: 'En cours', color: 'bg-blue-50' },
    { id: 'bloqué', label: 'Bloqué', color: 'bg-red-50' },
    { id: 'terminé', label: 'Terminé', color: 'bg-emerald-50' },
];

const PRIORITE_COLOR: Record<string, string> = {
    basse: 'bg-slate-100 text-slate-500',
    normale: 'bg-blue-50 text-blue-600',
    haute: 'bg-amber-50 text-amber-700',
    urgente: 'bg-red-50 text-red-700',
};
const PRIORITE_COLOR_LABEL: Record<string, string> = {
    basse: 'bg-slate-500',
    normale: 'bg-blue-600',
    haute: 'bg-amber-700',
    urgente: 'bg-red-700',
};

const PRIORITE_LABEL: Record<string, string> = {
    basse: 'Basse',
    normale: 'Normale',
    haute: 'Importante',
    urgente: 'Urgente',
};

export default function ProjetDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        projets, clients, devis, techniciens, tachesProjet,
        refreshTachesProjet, updateProjet, createTacheProjet, updateTacheProjet, deleteTacheProjet,
    } = useDatabase();

    const projet = projets.find(p => p.id === id);
    const client = clients.find(c => c.id === projet?.clientId);

    useEffect(() => {
        if (id) refreshTachesProjet(id);
    }, [id]);

    const taches = tachesProjet.filter(t => t.projetId === id);

    const devisDuProjet = useMemo(() => {
        return (projet?.devisIds ?? []).map(did => devis.find(d => d.id === did)).filter(Boolean) as Devis[];
    }, [projet, devis]);

    const budget = devisDuProjet.reduce((s, d) => s + (d.totalApreRemise ?? d.totalTTC ?? 0), 0);

    const techniciensDuProjet = useMemo(() => {
        return (projet?.technicienIds ?? []).map(tid => techniciens.find(t => t.id === tid)).filter(Boolean) as Technicien[];
    }, [projet, techniciens]);

    const [showNewTache, setShowNewTache] = useState<StatutTache | null>(null);
    const [newTitre, setNewTitre] = useState('');
    const [openTacheId, setOpenTacheId] = useState<string | null>(null);
    const openTache = taches.find(t => t.id === openTacheId) ?? null;

    const handleCreateTache = async (statut: StatutTache) => {
        if (!newTitre.trim() || !id) return;
        await createTacheProjet({
            projetId: id,
            titre: newTitre.trim(),
            statut,
            priorite: 'normale',
            technicienIds: [],
            ordre: taches.filter(t => t.statut === statut).length,
            createdBy: user?.id ?? '',
        });
        setNewTitre('');
        setShowNewTache(null);
    };

    const handleMoveTask = async (tache: TacheProjet, newStatut: StatutTache) => {
        await updateTacheProjet(tache.id, { projetId: tache.projetId, statut: newStatut });
    };

    const handleDeleteTache = async (tache: TacheProjet) => {
        if (!id) return;
        await deleteTacheProjet(tache.id, id);
    };

    const handlePriorityChange = async (tache: TacheProjet, priorite: TacheProjet['priorite']) => {
        await updateTacheProjet(tache.id, { projetId: tache.projetId, priorite });
    };

    const handleAssignToggle = async (tache: TacheProjet, technicienId: string) => {
        const ids = tache.technicienIds ?? [];
        const newIds = ids.includes(technicienId)
            ? ids.filter(i => i !== technicienId)
            : [...ids, technicienId];
        await updateTacheProjet(tache.id, { projetId: tache.projetId, technicienIds: newIds });
    };

    if (!projet) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Projet introuvable.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-8 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statutColor(projet.statut)}`}>
                            {statutLabel(projet.statut)}
                        </span>
                        {client && (
                            <NavLink to={`/clients/${client.id}`} className="text-xs text-blue-600 hover:underline">
                                {displayClient(client)}
                            </NavLink>
                        )}
                    </div>
                    <h1 className="text-2xl font-semibold">{projet.nom}</h1>
                    {projet.description && <p className="text-sm text-gray-500 mt-1">{projet.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                    <span>Début : {formatDate(projet.dateDebut)}</span>
                    {projet.dateFin && <span>Fin prévue : {formatDate(projet.dateFin)}</span>}
                    {projet.dateFinReelle && <span className="text-emerald-600">Terminé : {formatDate(projet.dateFinReelle)}</span>}
                </div>
            </div>

            {/* Info bar */}
            <div className="px-8 py-3 border-b border-slate-100 flex gap-8 text-sm shrink-0">
                <div>
                    <span className="text-gray-400 mr-1">Budget total :</span>
                    <span className="font-semibold">{formatFCFA(budget)}</span>
                    <span className="text-gray-400 ml-1">({devisDuProjet.length} devis)</span>
                </div>
                <div>
                    <span className="text-gray-400 mr-1">Techniciens :</span>
                    {techniciensDuProjet.length === 0
                        ? <span className="text-gray-400">Aucun</span>
                        : techniciensDuProjet.map(t => (
                            <span key={t.id} className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full mr-1">
                                {t.prenom} {t.nom}
                            </span>
                        ))}
                </div>
                <div>
                    <span className="text-gray-400 mr-1">Tâches :</span>
                    <span>{taches.length} ({taches.filter(t => t.statut === 'terminé').length} terminées)</span>
                </div>
            </div>

            {/* Kanban */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full gap-4 px-8 py-6 min-w-max">
                    {COLONNES.map(col => {
                        const colTaches = taches.filter(t => t.statut === col.id);
                        return (
                            <div key={col.id} className="w-72 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${col.color}`}>{col.label}</span>
                                        <span className="text-xs text-gray-400">{colTaches.length}</span>
                                    </div>
                                    <button
                                        onClick={() => { setShowNewTache(col.id); setNewTitre(''); }}
                                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-gray-500"
                                    >
                                        <FluentAdd32Regular className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <div className='flex flex-col gap-2'>
                                        {colTaches
                                            .sort((a, b) => a.ordre - b.ordre)
                                            .map(tache => (
                                                <TacheCard
                                                    key={tache.id}
                                                    tache={tache}
                                                    techniciens={techniciens}
                                                    onMove={handleMoveTask}
                                                    onDelete={handleDeleteTache}
                                                    onPriorityChange={handlePriorityChange}
                                                    onAssignToggle={handleAssignToggle}
                                                    onOpen={() => setOpenTacheId(tache.id)}
                                                />
                                            ))}

                                        {showNewTache === col.id && (
                                            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                                                <input
                                                    autoFocus
                                                    value={newTitre}
                                                    onChange={e => setNewTitre(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleCreateTache(col.id);
                                                        if (e.key === 'Escape') setShowNewTache(null);
                                                    }}
                                                    className="w-full text-sm focus:outline-none border-b border-slate-200 pb-1"
                                                    placeholder="Titre de la tâche…"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleCreateTache(col.id)}
                                                        className="text-xs px-3 py-1 bg-slate-800 text-white rounded-full"
                                                    >
                                                        Ajouter
                                                    </button>
                                                    <button
                                                        onClick={() => setShowNewTache(null)}
                                                        className="text-xs px-3 py-1 bg-slate-100 rounded-full"
                                                    >
                                                        Annuler
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <TacheSlideOver
                tache={openTache}
                techniciens={techniciens}
                onClose={() => setOpenTacheId(null)}
                onUpdate={(patch: Partial<TacheProjet>) => openTache && updateTacheProjet(openTache.id, { projetId: openTache.projetId, ...patch })}
                onDelete={() => { if (openTache) { handleDeleteTache(openTache); setOpenTacheId(null); } }}
            />
        </div>
    );
}

function TacheCard({
    tache,
    techniciens,
    onMove,
    onDelete,
    onPriorityChange,
    onAssignToggle,
    onOpen,
}: {
    tache: TacheProjet;
    techniciens: Technicien[];
    onMove: (t: TacheProjet, s: StatutTache) => void;
    onDelete: (t: TacheProjet) => void;
    onPriorityChange: (t: TacheProjet, p: TacheProjet['priorite']) => void;
    onAssignToggle: (t: TacheProjet, techId: string) => void;
    onOpen: () => void;
}) {
    const assignes = (tache.technicienIds ?? [])
        .map(id => techniciens.find(t => t.id === id))
        .filter(Boolean) as Technicien[];

    const autres = COLONNES.filter(c => c.id !== tache.statut);

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div
            onClick={onOpen}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-2 group cursor-pointer hover:border-slate-300 transition-colors"
        >
            <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{tache.titre}</span>
                <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITE_COLOR[tache.priorite]}`}>
                        {PRIORITE_LABEL[tache.priorite] ?? tache.priorite}
                    </span>
                    <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setMenuOpen(o => !o)}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="8" cy="3" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="8" cy="13" r="1.5" />
                            </svg>
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-7 z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 flex flex-col">

                                {/* Priorité */}
                                <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                    Priorité
                                </div>
                                {Object.entries(PRIORITE_LABEL).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => { onPriorityChange(tache, key as TacheProjet['priorite']); setMenuOpen(false); }}
                                        className={`text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 ${tache.priorite === key ? 'font-semibold' : 'text-slate-700'}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITE_COLOR_LABEL[key].split(' ')[0]}`} />
                                        {label}
                                        {tache.priorite === key && <span className="ml-auto text-slate-400">✓</span>}
                                    </button>
                                ))}

                                <div className="my-1 border-t border-slate-100" />

                                {/* Assigner */}
                                <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                    Assigné à
                                </div>
                                {techniciens.length === 0 ? (
                                    <div className="px-3 py-1.5 text-xs text-gray-400 italic">Aucun technicien</div>
                                ) : (
                                    techniciens.map(tech => {
                                        const isAssigned = (tache.technicienIds ?? []).includes(tech.id);
                                        return (
                                            <button
                                                key={tech.id}
                                                onClick={() => onAssignToggle(tache, tech.id)}
                                                className="text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                                            >
                                                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isAssigned ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300'}`}>
                                                    {isAssigned && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
                                                </span>
                                                {tech.prenom} {tech.nom}
                                            </button>
                                        );
                                    })
                                )}

                                <div className="my-1 border-t border-slate-100" />

                                {/* Déplacer */}
                                <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                    Déplacer vers
                                </div>
                                {autres.map(col => (
                                    <button
                                        key={col.id}
                                        onClick={() => { onMove(tache, col.id); setMenuOpen(false); }}
                                        className="text-left px-3 py-1.5 text-xs hover:bg-slate-50 text-slate-700"
                                    >
                                        → {col.label}
                                    </button>
                                ))}

                                <div className="my-1 border-t border-slate-100" />

                                <button
                                    onClick={() => { onDelete(tache); setMenuOpen(false); }}
                                    className="text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                >
                                    Supprimer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {tache.description && (
                <p className="text-xs text-gray-500 line-clamp-2" dangerouslySetInnerHTML={{ __html: tache.description.length >= 100 ? `${tache.description.substring(0, 96)}...` : tache.description }}></p>
            )}

            {assignes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {assignes.map(t => (
                        <span key={t.id} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {t.prenom} {t.nom}
                        </span>
                    ))}
                </div>
            )}

            {(tache.dateDebut || tache.dateEcheance) && (
                <div className="text-[10px] text-gray-400">
                    {tache.dateDebut && formatDate(tache.dateDebut)}
                    {tache.dateDebut && tache.dateEcheance && ' → '}
                    {tache.dateEcheance && formatDate(tache.dateEcheance)}
                </div>
            )}
        </div>
    );
}

function toDateInput(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value: string): string | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

function TextareaAutosize({
    value,
    onChange,
    onBlur,
    minRows = 1,
    maxRows,
    className,
    placeholder,
}: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
    minRows?: number;
    maxRows?: number;
    className?: string;
    placeholder?: string;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);

    const resize = () => {
        const ta = ref.current;
        if (!ta) return;
        ta.style.height = 'auto';
        const styles = window.getComputedStyle(ta);
        const lineHeight = parseFloat(styles.lineHeight) || 20;
        const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        const borderY = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
        const minH = lineHeight * minRows + paddingY + borderY;
        const maxH = maxRows ? lineHeight * maxRows + paddingY + borderY : Infinity;
        const next = Math.min(Math.max(ta.scrollHeight, minH), maxH);
        ta.style.height = `${next}px`;
        ta.style.overflowY = ta.scrollHeight > maxH ? 'auto' : 'hidden';
    };

    useEffect(() => { resize(); }, [value]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={(e) => { onChange(e); resize(); }}
            onBlur={onBlur}
            rows={minRows}
            placeholder={placeholder}
            className={className}
            style={{ resize: 'none', overflow: 'hidden' }}
        />
    );
}

function TacheDescriptionEditor({
    value,
    onChange,
}: {
    value: string;
    onChange: (html: string) => void;
}) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2 h-full overflow-y-auto',
            },
        },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    }, []);

    useEffect(() => {
        if (!editor) return;
        if (editor.getHTML() !== (value || '<p></p>')) {
            editor.commands.setContent(value || '', { emitUpdate: false });
        }
    }, [editor]);

    if (!editor) {
        return <div className="mt-1 border border-slate-200 rounded-lg" style={{ height: 400 }} />;
    }

    const Btn = ({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
        <button
            type="button"
            onClick={onClick}
            title={label}
            className={`h-7 min-w-7 px-2 text-xs rounded-md flex items-center justify-center ${active ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="mt-1 border border-slate-200 rounded-lg flex flex-col overflow-hidden focus-within:border-slate-800" style={{ height: 400 }}>
            <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50 shrink-0">
                <Btn label="Gras" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
                <Btn label="Italique" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
                <Btn label="Barré" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
                <span className="w-px h-4 bg-slate-200 mx-1" />
                <Btn label="Titre 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
                <Btn label="Titre 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
                <span className="w-px h-4 bg-slate-200 mx-1" />
                <Btn label="Liste à puces" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</Btn>
                <Btn label="Liste numérotée" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</Btn>
                <Btn label="Citation" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“”</Btn>
                <Btn label="Code" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</Btn>
            </div>
            <div className="flex-1 overflow-hidden">
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div>
    );
}

function TacheSlideOver({
    tache,
    techniciens,
    onClose,
    onUpdate,
    onDelete,
}: {
    tache: TacheProjet | null;
    techniciens: Technicien[];
    onClose: () => void;
    onUpdate: (patch: Partial<TacheProjet>) => void;
    onDelete: () => void;
}) {
    const [titre, setTitre] = useState('');
    const [description, setDescription] = useState('');
    const [priorite, setPriorite] = useState<TacheProjet['priorite']>('normale');
    const [statut, setStatut] = useState<StatutTache>('à_faire');
    const [dateDebut, setDateDebut] = useState('');
    const [dateEcheance, setDateEcheance] = useState('');
    const [technicienIds, setTechnicienIds] = useState<string[]>([]);

    useEffect(() => {
        if (!tache) return;
        setTitre(tache.titre);
        setDescription(tache.description ?? '');
        setPriorite(tache.priorite);
        setStatut(tache.statut);
        setDateDebut(toDateInput(tache.dateDebut));
        setDateEcheance(toDateInput(tache.dateEcheance));
        setTechnicienIds(tache.technicienIds ?? []);
    }, [tache?.id]);

    useEffect(() => {
        if (!tache) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [tache, onClose]);

    if (!tache) return null;

    const commitField = (patch: Partial<TacheProjet>) => onUpdate(patch);

    const toggleTechnicien = (techId: string) => {
        const next = technicienIds.includes(techId)
            ? technicienIds.filter(i => i !== techId)
            : [...technicienIds, techId];
        setTechnicienIds(next);
        commitField({ technicienIds: next });
    };

    return (
        <div
            className="fixed inset-0 flex justify-end h-[calc(100vh-36px)] bottom-0 mt-[36px]"
            style={{ zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="h-full w-[500px] bg-white shadow-2xl flex flex-col animate-[slideInRight_.2s_ease-out]"
                style={{ animation: 'slideInRight 200ms ease-out' }}
            >
                <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Tâche</span>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-gray-500">
                        <svg width="14" height="14" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5"><path d="M0 0L10 10M10 0L0 10" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
                    <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Titre</label>
                        <TextareaAutosize
                            value={titre}
                            onChange={(e) => setTitre(e.target.value)}
                            onBlur={() => titre.trim() && titre !== tache.titre && commitField({ titre: titre.trim() })}
                            className="w-full mt-1 text-xl font-medium border-b border-slate-200 focus:border-slate-800 focus:outline-none pb-1"
                        />
                    </div>

                    <div className='mt-6'>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                        <TacheDescriptionEditor
                            value={tache.description ?? ''}
                            onChange={(html) => { setDescription(html); commitField({ description: html }); }}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <div>
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Début</label>
                            <input
                                type="date"
                                value={dateDebut}
                                onChange={(e) => { setDateDebut(e.target.value); commitField({ dateDebut: fromDateInput(e.target.value) ?? '' }); }}
                                className="w-full mt-1 text-sm border border-slate-200 rounded-lg p-2 focus:border-slate-800 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Échéance</label>
                            <input
                                type="date"
                                value={dateEcheance}
                                onChange={(e) => { setDateEcheance(e.target.value); commitField({ dateEcheance: fromDateInput(e.target.value) ?? '' }); }}
                                className="w-full mt-1 text-sm border border-slate-200 rounded-lg p-2 focus:border-slate-800 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className='mt-6'>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Statut</label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {COLONNES.map(col => (
                                <button
                                    key={col.id}
                                    onClick={() => { setStatut(col.id); commitField({ statut: col.id }); }}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${statut === col.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {col.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='mt-6'>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Priorité</label>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {(Object.entries(PRIORITE_LABEL) as [TacheProjet['priorite'], string][]).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => { setPriorite(key); commitField({ priorite: key }); }}
                                    className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${priorite === key ? 'border-slate-800 bg-slate-50 font-semibold' : 'border-slate-200 hover:bg-slate-50'}`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${PRIORITE_COLOR_LABEL[key]}`} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='mt-6'>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Assigné à</label>
                        <div className="mt-1 flex flex-col gap-1">
                            {techniciens.length === 0 ? (
                                <span className="text-xs text-gray-400 italic">Aucun technicien disponible</span>
                            ) : techniciens.map(tech => {
                                const checked = technicienIds.includes(tech.id);
                                return (
                                    <button
                                        key={tech.id}
                                        onClick={() => toggleTechnicien(tech.id)}
                                        className="text-left px-2 py-1.5 text-sm flex items-center gap-2 rounded-lg hover:bg-slate-50"
                                    >
                                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-slate-800 border-slate-800 text-white' : 'border-slate-300'}`}>
                                            {checked && <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1.5,5 4,7.5 8.5,2.5" /></svg>}
                                        </span>
                                        {tech.prenom} {tech.nom}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 mt-6">
                    <button
                        onClick={onDelete}
                        className="text-xs px-3 py-1.5 rounded-full text-red-600 hover:bg-red-50"
                    >
                        Supprimer la tâche
                    </button>
                    <button
                        onClick={onClose}
                        className="text-xs px-4 py-1.5 rounded-full bg-slate-800 text-white hover:bg-slate-700"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

function displayClient(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}
