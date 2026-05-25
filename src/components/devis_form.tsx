import { useEffect, useMemo, useRef, useState } from 'react';
import { Article, Client, GroupeDevis, LigneDocument, SousGroupeDevis } from '../Databases/db.d';
import { formatFCFA } from '../libs/format';
import { FluentAdd32Regular, FluentDelete32Regular } from '../libs/icons';
import ClientFormModal from './client_form_modal';
import { useAlerts } from './alerts';

export type DevisFormValue = {
    clientId: string;
    dateEmission: string;
    dateValidite: string;
    lignes: LigneDocument[];
    groupes: GroupeDevis[];
    remiseGlobale: number;
    notes: string;
    conditionsPaiement: string;
};

export type Totaux = {
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    totalApreRemise: number;
};

export function computeTotaux(value: Pick<DevisFormValue, 'lignes' | 'remiseGlobale'>): Totaux {
    const totalHT = value.lignes.reduce((s, l) => s + l.montantTotalHT, 0);
    const totalTTC = value.lignes.reduce((s, l) => s + l.montantTotalTTC, 0);
    const totalTVA = totalTTC - totalHT;
    const totalApreRemise = totalTTC * (1 - (value.remiseGlobale || 0) / 100);
    return { totalHT, totalTVA, totalTTC, totalApreRemise };
}

function sumLignes(lignes: LigneDocument[]): { ht: number; ttc: number } {
    return lignes.reduce(
        (s, l) => ({ ht: s.ht + l.montantTotalHT, ttc: s.ttc + l.montantTotalTTC }),
        { ht: 0, ttc: 0 },
    );
}

export function makeLigneFromArticle(article: Article, target?: LigneTarget, quantite = 1): LigneDocument {
    const remise = 0;
    const prixUnitaireHT = article.prixHT;
    const prixUnitaireTTC = article.prixTTC;
    const factor = 1 - remise / 100;
    const base: LigneDocument = {
        id: crypto.randomUUID(),
        articleId: article.id,
        designation: article.nom,
        reference: article.reference,
        quantite,
        unite: article.unite,
        prixUnitaireHT,
        tauxTVA: article.tauxTVA,
        prixUnitaireTTC,
        montantTotalHT: prixUnitaireHT * quantite * factor,
        montantTotalTTC: prixUnitaireTTC * quantite * factor,
        remise,
    };
    if (target?.groupeId) base.groupeId = target.groupeId;
    if (target?.sousGroupeId) base.sousGroupeId = target.sousGroupeId;
    return base;
}

export function recomputeLigne(l: LigneDocument): LigneDocument {
    const factor = 1 - (l.remise || 0) / 100;
    return {
        ...l,
        montantTotalHT: l.prixUnitaireHT * l.quantite * factor,
        montantTotalTTC: l.prixUnitaireTTC * l.quantite * factor,
    };
}

type LigneTarget = { groupeId?: string; sousGroupeId?: string };

type Props = {
    value: DevisFormValue;
    onChange: (next: DevisFormValue) => void;
    clients: Client[];
    articles: Article[];
    readOnly?: boolean;
    lockClient?: boolean;
};

export default function DevisForm({ value, onChange, clients, articles, readOnly, lockClient }: Props) {
    const { confirm } = useAlerts();
    const totaux = useMemo(() => computeTotaux(value), [value]);

    const updateLigne = (id: string, patch: Partial<LigneDocument>) => {
        const next = value.lignes.map((l) => l.id === id ? recomputeLigne({ ...l, ...patch }) : l);
        onChange({ ...value, lignes: next });
    };

    const removeLigne = (id: string) => {
        onChange({ ...value, lignes: value.lignes.filter((l) => l.id !== id) });
    };

    const addLigne = (article: Article, target?: LigneTarget) => {
        onChange({ ...value, lignes: [...value.lignes, makeLigneFromArticle(article, target)] });
    };

    const addGroupe = () => {
        const groupe: GroupeDevis = {
            id: crypto.randomUUID(),
            nom: 'Nouveau groupe',
            ordre: value.groupes.length,
            sousGroupes: [],
        };
        onChange({ ...value, groupes: [...value.groupes, groupe] });
    };

    const updateGroupe = (id: string, patch: Partial<GroupeDevis>) => {
        onChange({
            ...value,
            groupes: value.groupes.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        });
    };

    const removeGroupe = async (id: string) => {
        const lignesDuGroupe = value.lignes.filter((l) => l.groupeId === id);
        let keepLines = false;
        if (lignesDuGroupe.length > 0) {
            const ans = await confirm({
                title: `Supprimer ce groupe ?`,
                message: `Le groupe contient ${lignesDuGroupe.length} ligne(s).\nConfirmer = supprimer le groupe ET ses lignes.\nAnnuler = détacher les lignes et garder uniquement.`,
                confirmLabel: 'Supprimer tout',
                cancelLabel: 'Détacher',
                danger: true,
            });
            keepLines = !ans;
        }
        const nextLignes = keepLines
            ? value.lignes.map((l) => {
                if (l.groupeId !== id) return l;
                const { groupeId: _g, sousGroupeId: _sg, ...rest } = l;
                return rest as LigneDocument;
            })
            : value.lignes.filter((l) => l.groupeId !== id);
        onChange({
            ...value,
            groupes: value.groupes.filter((g) => g.id !== id),
            lignes: nextLignes,
        });
    };

    const addSousGroupe = (groupeId: string) => {
        const groupe = value.groupes.find((g) => g.id === groupeId);
        if (!groupe) return;
        const sg: SousGroupeDevis = {
            id: crypto.randomUUID(),
            nom: 'Nouveau sous-groupe',
            ordre: groupe.sousGroupes.length,
        };
        updateGroupe(groupeId, { sousGroupes: [...groupe.sousGroupes, sg] });
    };

    const updateSousGroupe = (groupeId: string, sgId: string, patch: Partial<SousGroupeDevis>) => {
        const groupe = value.groupes.find((g) => g.id === groupeId);
        if (!groupe) return;
        updateGroupe(groupeId, {
            sousGroupes: groupe.sousGroupes.map((sg) => (sg.id === sgId ? { ...sg, ...patch } : sg)),
        });
    };

    const removeSousGroupe = async (groupeId: string, sgId: string) => {
        const groupe = value.groupes.find((g) => g.id === groupeId);
        if (!groupe) return;
        const lignesDuSG = value.lignes.filter((l) => l.sousGroupeId === sgId);
        let keepLines = false;
        if (lignesDuSG.length > 0) {
            const ans = await confirm({
                title: 'Supprimer ce sous-groupe ?',
                message: `Le sous-groupe contient ${lignesDuSG.length} ligne(s).\nConfirmer = supprimer le sous-groupe ET ses lignes.\nAnnuler = garder les lignes dans le groupe parent.`,
                confirmLabel: 'Supprimer tout',
                cancelLabel: 'Détacher',
                danger: true,
            });
            keepLines = !ans;
        }
        const nextLignes = keepLines
            ? value.lignes.map((l) => {
                if (l.sousGroupeId !== sgId) return l;
                const { sousGroupeId: _sg, ...rest } = l;
                return rest as LigneDocument;
            })
            : value.lignes.filter((l) => l.sousGroupeId !== sgId);
        onChange({
            ...value,
            groupes: value.groupes.map((g) => g.id === groupeId
                ? { ...g, sousGroupes: g.sousGroupes.filter((sg) => sg.id !== sgId) }
                : g),
            lignes: nextLignes,
        });
    };

    const orphanLignes = value.lignes.filter((l) => !l.groupeId);

    const ligneActions = { updateLigne, removeLigne, readOnly };

    return (
        <div className="space-y-6 mx-auto w-[80%]">
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="text-xs uppercase text-gray-400 font-medium">Client & dates</div>
                <div className="grid grid-cols-4 gap-3">
                    <div className="block col-span-3 md:col-span-2">
                        <span className="text-xs text-gray-500">Nom du Client *</span>
                        <ClientPicker
                            clients={clients}
                            value={value.clientId}
                            onChange={(id) => onChange({ ...value, clientId: id })}
                            disabled={readOnly || lockClient}
                        />
                    </div>
                    <label className="block">
                        <span className="text-xs text-gray-500">Date d'émission</span>
                        <input
                            disabled={readOnly}
                            type="date"
                            value={value.dateEmission}
                            onChange={(e) => onChange({ ...value, dateEmission: e.target.value })}
                            className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs text-gray-500">Date de validité</span>
                        <input
                            disabled={readOnly}
                            type="date"
                            value={value.dateValidite}
                            onChange={(e) => onChange({ ...value, dateValidite: e.target.value })}
                            className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                        />
                    </label>
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-xs uppercase text-gray-400 font-medium">Articles & groupes</div>
                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            <ArticlePicker
                                articles={articles}
                                onPick={(a) => addLigne(a)}
                                label="Ajouter une ligne"
                            />
                            <button
                                onClick={addGroupe}
                                className="h-9 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-sm flex items-center gap-1"
                            >
                                <FluentAdd32Regular className="h-4 w-4" />
                                Groupe
                            </button>
                        </div>
                    )}
                </div>

                {orphanLignes.length > 0 && (
                    <LignesBlock
                        lignes={orphanLignes}
                        actions={ligneActions}
                    />
                )}

                {value.groupes.map((g) => {
                    const lignesGroupe = value.lignes.filter((l) => l.groupeId === g.id);
                    const totalGroupe = sumLignes(lignesGroupe);
                    const lignesDirectes = lignesGroupe.filter((l) => !l.sousGroupeId);

                    return (
                        <div key={g.id} className="border border-slate-200 rounded-lg bg-slate-50/40">
                            <div className="px-4 py-3 bg-slate-100/60 flex items-center gap-2">
                                <input
                                    disabled={readOnly}
                                    value={g.nom}
                                    onChange={(e) => updateGroupe(g.id, { nom: e.target.value })}
                                    className="flex-1 bg-transparent text-sm font-semibold focus:outline-none border-b border-transparent focus:border-slate-400"
                                />
                                <span className="text-xs text-gray-500">Sous-total : <strong className="text-slate-800">{formatFCFA(totalGroupe.ttc)}</strong></span>
                                {!readOnly && (
                                    <>
                                        <ArticlePicker
                                            articles={articles}
                                            onPick={(a) => addLigne(a, { groupeId: g.id })}
                                            label="Article"
                                            compact
                                        />
                                        <button
                                            onClick={() => addSousGroupe(g.id)}
                                            className="h-7 px-2 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs"
                                        >
                                            + Sous-groupe
                                        </button>
                                        <button
                                            onClick={() => removeGroupe(g.id)}
                                            className="text-gray-400 hover:text-red-600"
                                            title="Supprimer le groupe"
                                        >
                                            <FluentDelete32Regular className="h-4 w-4" />
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="p-3 space-y-3">
                                {lignesDirectes.length > 0 && (
                                    <LignesBlock lignes={lignesDirectes} actions={ligneActions} />
                                )}

                                {g.sousGroupes.map((sg) => {
                                    const lignesSG = lignesGroupe.filter((l) => l.sousGroupeId === sg.id);
                                    const totalSG = sumLignes(lignesSG);
                                    return (
                                        <div key={sg.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden">
                                            <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center gap-2">
                                                <span className="text-xs text-gray-400">↳</span>
                                                <input
                                                    disabled={readOnly}
                                                    value={sg.nom}
                                                    onChange={(e) => updateSousGroupe(g.id, sg.id, { nom: e.target.value })}
                                                    className="flex-1 bg-transparent text-sm font-medium focus:outline-none border-b border-transparent focus:border-slate-400"
                                                />
                                                <span className="text-xs text-gray-500">{formatFCFA(totalSG.ttc)}</span>
                                                {!readOnly && (
                                                    <>
                                                        <ArticlePicker
                                                            articles={articles}
                                                            onPick={(a) => addLigne(a, { groupeId: g.id, sousGroupeId: sg.id })}
                                                            label="+ Article"
                                                            compact
                                                        />
                                                        <button
                                                            onClick={() => removeSousGroupe(g.id, sg.id)}
                                                            className="text-gray-400 hover:text-red-600"
                                                            title="Supprimer le sous-groupe"
                                                        >
                                                            <FluentDelete32Regular className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            <div className="p-2">
                                                {lignesSG.length === 0 ? (
                                                    <div className="text-xs text-gray-400 text-center py-3">Aucun article dans ce sous-groupe.</div>
                                                ) : (
                                                    <LignesBlock lignes={lignesSG} actions={ligneActions} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {value.lignes.length === 0 && value.groupes.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-6">
                        Aucun article — ajoute une ligne ou crée un groupe pour commencer.
                    </div>
                )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-2 text-sm">
                        <Row label="Total HT" value={formatFCFA(totaux.totalHT)} />
                        <Row label="Total TVA" value={formatFCFA(totaux.totalTVA)} />
                        <Row label="Total TTC" value={formatFCFA(totaux.totalTTC)} />
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-500">Remise globale</span>
                            <div className="flex items-center gap-1">
                                <input
                                    disabled={readOnly}
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={value.remiseGlobale}
                                    onChange={(e) => onChange({ ...value, remiseGlobale: Number(e.target.value) || 0 })}
                                    className="w-16 px-2 py-1 text-right rounded-full bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-400"
                                />
                                <span className="text-gray-400">%</span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex justify-between font-semibold">
                            <span>Net à payer</span>
                            <span>{formatFCFA(totaux.totalApreRemise)}</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                    <span className="text-xs text-gray-500">Notes</span>
                    <textarea
                        disabled={readOnly}
                        value={value.notes}
                        onChange={(e) => onChange({ ...value, notes: e.target.value })}
                        rows={3}
                        className="mt-1 w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-gray-500">Conditions de paiement</span>
                    <textarea
                        disabled={readOnly}
                        value={value.conditionsPaiement}
                        onChange={(e) => onChange({ ...value, conditionsPaiement: e.target.value })}
                        rows={3}
                        className="mt-1 w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                    />
                </label>
            </section>
        </div>
    );
}

type LigneActions = {
    updateLigne: (id: string, patch: Partial<LigneDocument>) => void;
    removeLigne: (id: string) => void;
    readOnly?: boolean;
};

function LignesBlock({ lignes, actions }: { lignes: LigneDocument[]; actions: LigneActions }) {
    const { updateLigne, removeLigne, readOnly } = actions;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-400">
                    <tr>
                        <th className="text-left pb-2 font-medium w-[40%]">Désignation</th>
                        <th className="text-center pb-2 font-medium w-20">Qté</th>
                        <th className="text-center pb-2 font-medium w-28">P.U. HT</th>
                        <th className="text-center pb-2 font-medium w-20">TVA %</th>
                        <th className="text-center pb-2 font-medium w-20">Remise %</th>
                        <th className="text-right pb-2 font-medium w-32">Total TTC</th>
                        {!readOnly && <th className="w-8"></th>}
                    </tr>
                </thead>
                <tbody>
                    {lignes.map((l) => (
                        <tr key={l.id} className="border-t border-slate-100">
                            <td className="py-2 pr-2">
                                <input
                                    disabled={readOnly}
                                    value={l.designation}
                                    onChange={(e) => updateLigne(l.id, { designation: e.target.value })}
                                    className="w-full py-1 bg-transparent border-b border-transparent focus:outline-none focus:border-slate-300"
                                />
                                <div className="text-[10px] text-gray-400">{l.reference} · {l.unite}</div>
                            </td>
                            <td className="py-2 text-center">
                                <NumberCell value={l.quantite} disabled={readOnly} onChange={(v) => updateLigne(l.id, { quantite: v })} />
                            </td>
                            <td className="py-2 text-center text-gray-600">{formatFCFA(l.prixUnitaireHT)}</td>
                            <td className="py-2 text-center text-gray-600">{l.tauxTVA}%</td>
                            <td className="py-2 text-center">
                                <NumberCell value={l.remise} disabled={readOnly} onChange={(v) => updateLigne(l.id, { remise: v })} />
                            </td>
                            <td className="py-2 text-right font-medium">{formatFCFA(l.montantTotalTTC)}</td>
                            {!readOnly && (
                                <td className="py-2 text-right">
                                    <button onClick={() => removeLigne(l.id)} className="text-gray-400 hover:text-red-600">
                                        <FluentDelete32Regular className="h-4 w-4" />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between">
            <span className="text-gray-500">{label}</span>
            <span>{value}</span>
        </div>
    );
}

function NumberCell({ value, onChange, disabled }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
    return (
        <input
            type="number"
            disabled={disabled}
            value={value}
            min={0}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="w-20 px-2 py-1 text-right rounded-full bg-slate-50 border border-slate-200 focus:outline-none focus:border-slate-400"
        />
    );
}

function ArticlePicker({
    articles,
    onPick,
    label = 'Ajouter un article',
    compact = false,
}: {
    articles: Article[];
    onPick: (a: Article) => void;
    label?: string;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return articles.slice(0, 20);
        const tokens = q.split(/\s+/).filter(Boolean);
        return articles.filter((a) => {
            const hay = [a.nom, a.reference, a.description].filter(Boolean).join(' ').toLowerCase();
            return tokens.every((tok) => hay.includes(tok));
        }).slice(0, 20);
    }, [articles, query]);

    const btnClass = compact
        ? 'h-7 px-2 rounded-full bg-slate-900 text-white text-xs flex items-center gap-1'
        : 'h-9 px-4 rounded-full bg-slate-900 text-white text-sm flex items-center gap-2';

    return (
        <div className="relative">
            <button onClick={() => setOpen((v) => !v)} className={btnClass}>
                <FluentAdd32Regular className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                {label}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-2 w-120 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-50">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Chercher par nom ou référence (ex. CAR0001)…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full h-9 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                        />
                        <div className="mt-2 max-h-72 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <div className="text-sm text-gray-400 text-center py-6">Aucun article.</div>
                            ) : filtered.map((a) => {
                                const outOfStock = (a.stockTotal ?? 0) <= 0;
                                return (
                                    <button
                                        key={a.id}
                                        onClick={() => { onPick(a); setOpen(false); setQuery(''); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 ${outOfStock ? 'opacity-50' : ''}`}
                                    >
                                        <div className="text-sm font-medium truncate flex items-center gap-2">
                                            <span className="truncate">{a.nom}</span>
                                            {outOfStock && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">Rupture</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500 flex justify-between">
                                            <span>{a.reference} · Qte : {a.stockTotal}</span>
                                            <span>{formatFCFA(a.prixTTC)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function displayClient(c: Client): string {
    if (c.type === 'entreprise') return c.raisonSociale || c.nom;
    return [c.prenom, c.nom].filter(Boolean).join(' ');
}

function ClientPicker({
    clients,
    value,
    onChange,
    disabled,
}: {
    clients: Client[];
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}) {
    const selected = clients.find((c) => c.id === value);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const inputValue = open ? query : (selected ? displayClient(selected) : '');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return clients.slice(0, 7);
        return clients.filter((c) =>
            [displayClient(c), c.email, c.telephone].filter(Boolean).join(' ').toLowerCase().includes(q),
        ).slice(0, 7);
    }, [clients, query]);

    const exactMatch = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return clients.some((c) => displayClient(c).toLowerCase() === q);
    }, [clients, query]);

    return (
        <div ref={wrapRef} className="relative">
            <input
                disabled={disabled}
                type="text"
                value={inputValue}
                placeholder="Rechercher un client…"
                onFocus={() => { setOpen(true); setQuery(selected ? displayClient(selected) : ''); }}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
            />
            {open && !disabled && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg p-2 z-50 max-h-72 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="text-sm text-gray-400 text-center py-4">Aucun client trouvé.</div>
                    ) : filtered.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50"
                        >
                            <div className="text-sm font-medium truncate">{displayClient(c)}</div>
                            <div className="text-xs text-gray-500 truncate">{[c.email, c.telephone].filter(Boolean).join(' · ')}</div>
                        </button>
                    ))}
                    {query.trim() && !exactMatch && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); setShowModal(true); }}
                            className="w-full text-left mt-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm flex items-center gap-2"
                        >
                            <FluentAdd32Regular className="h-4 w-4" />
                            Créer le client « {query.trim()} »
                        </button>
                    )}
                </div>
            )}
            {showModal && (
                <ClientFormModal
                    initialName={query.trim()}
                    onClose={() => setShowModal(false)}
                    onSaved={(c) => { onChange(c.id); setShowModal(false); setQuery(''); setOpen(false); }}
                />
            )}
        </div>
    );
}
