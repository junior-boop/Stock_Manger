import { useEffect, useMemo, useRef, useState } from 'react';
import { Article, Client, LigneDocument } from '../Databases/db.d';
import { formatFCFA } from '../libs/format';
import { FluentAdd32Regular, FluentDelete32Regular, FluentMoreHorizontal32Regular, RiCloseLine } from '../libs/icons';
import ClientFormModal from './client_form_modal';
import Switch from './switch';

const TVA_RATES: { label: string; value: number }[] = [
    { label: 'Hors champ', value: 0 },
    { label: 'Exonéré', value: 0 },
    { label: 'TPS', value: 5 },
    { label: 'TVQ QC', value: 9.975 },
    { label: 'TVA', value: 19.25 },
];

function tvaLabel(value: number): string {
    const match = TVA_RATES.find((r) => Math.abs(r.value - value) < 0.0001);
    return match ? `${match.label} (${value}%)` : `${value}%`;
}

export type FactureFormValue = {
    clientId: string;
    dateEmission: string;
    dateEcheance: string;
    lignes: LigneDocument[];
    remiseGlobale: number;
    notes: string;
    conditionsPaiement: string;
    afficherTVA: boolean;
    afficherTVALignes?: boolean;
};

export type Totaux = {
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    totalApreRemise: number;
};

export function computeTotaux(value: Pick<FactureFormValue, 'lignes' | 'remiseGlobale'>): Totaux {
    const totalHT = value.lignes.reduce((s, l) => s + l.montantTotalHT, 0);
    const totalTTC = value.lignes.reduce((s, l) => s + l.montantTotalTTC, 0);
    const totalTVA = totalTTC - totalHT;
    const totalApreRemise = totalTTC * (1 - (value.remiseGlobale || 0) / 100);
    return { totalHT, totalTVA, totalTTC, totalApreRemise };
}

export function makeLigneFromArticle(article: Article, quantite = 1): LigneDocument {
    const remise = 0;
    const factor = 1 - remise / 100;
    return {
        id: crypto.randomUUID(),
        articleId: article.id,
        designation: article.nom,
        reference: article.reference,
        quantite,
        unite: article.unite,
        prixUnitaireHT: article.prixHT,
        tauxTVA: article.tauxTVA,
        prixUnitaireTTC: article.prixTTC,
        montantTotalHT: article.prixHT * quantite * factor,
        montantTotalTTC: article.prixTTC * quantite * factor,
        remise,
    };
}

export function recomputeLigne(l: LigneDocument): LigneDocument {
    const factor = 1 - (l.remise || 0) / 100;
    return {
        ...l,
        montantTotalHT: l.prixUnitaireHT * l.quantite * factor,
        montantTotalTTC: l.prixUnitaireTTC * l.quantite * factor,
    };
}

export function flattenLignes(lignes: LigneDocument[]): LigneDocument[] {
    return lignes.map((l) => {
        const { groupeId: _g, sousGroupeId: _sg, ...rest } = l;
        return rest as LigneDocument;
    });
}

type Props = {
    value: FactureFormValue;
    onChange: (next: FactureFormValue) => void;
    clients: Client[];
    articles: Article[];
    readOnly?: boolean;
    lockClient?: boolean;
};

export default function FactureForm({ value, onChange, clients, articles, readOnly, lockClient }: Props) {
    const totaux = useMemo(() => computeTotaux(value), [value]);

    const updateLigne = (id: string, patch: Partial<LigneDocument>) => {
        const next = value.lignes.map((l) => l.id === id ? recomputeLigne({ ...l, ...patch }) : l);
        onChange({ ...value, lignes: next });
    };

    const removeLigne = (id: string) => {
        onChange({ ...value, lignes: value.lignes.filter((l) => l.id !== id) });
    };

    const addLigne = (article: Article) => {
        onChange({ ...value, lignes: [...value.lignes, makeLigneFromArticle(article)] });
    };

    const insertEmptyAt = (index: number) => {
        const emptyLigne: LigneDocument = {
            id: crypto.randomUUID(),
            articleId: '',
            designation: '',
            reference: '',
            quantite: 1,
            unite: 'pièce' as any,
            prixUnitaireHT: 0,
            tauxTVA: 0,
            prixUnitaireTTC: 0,
            montantTotalHT: 0,
            montantTotalTTC: 0,
            remise: 0,
        };
        const next = [...value.lignes];
        next.splice(index, 0, emptyLigne);
        onChange({ ...value, lignes: next });
    };

    const duplicateLigne = (id: string) => {
        const idx = value.lignes.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const copy: LigneDocument = { ...value.lignes[idx], id: crypto.randomUUID() };
        const next = [...value.lignes];
        next.splice(idx + 1, 0, copy);
        onChange({ ...value, lignes: next });
    };

    const moveLigne = (id: string, direction: -1 | 1) => {
        const idx = value.lignes.findIndex((l) => l.id === id);
        const target = idx + direction;
        if (idx < 0 || target < 0 || target >= value.lignes.length) return;
        const next = [...value.lignes];
        [next[idx], next[target]] = [next[target], next[idx]];
        onChange({ ...value, lignes: next });
    };

    const reorderLigne = (fromId: string, toId: string) => {
        if (fromId === toId) return;
        const from = value.lignes.findIndex((l) => l.id === fromId);
        const to = value.lignes.findIndex((l) => l.id === toId);
        if (from < 0 || to < 0) return;
        const next = [...value.lignes];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange({ ...value, lignes: next });
    };

    const afficherTVA = value.afficherTVA !== false;
    const afficherTVALignes = afficherTVA && value.afficherTVALignes !== false;
    const ligneActions = { updateLigne, removeLigne, insertEmptyAt, duplicateLigne, moveLigne, reorderLigne, readOnly, afficherTVA: afficherTVALignes };
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

    const toggleAfficherTVA = () => {
        onChange({ ...value, afficherTVA: !afficherTVA });
    };

    const toggleAfficherTVALignes = () => {
        onChange({ ...value, afficherTVALignes: !(value.afficherTVALignes !== false) });
    };

    const sansTVA = useMemo(() => {
        if (value.lignes.length === 0) return false;
        const allZero = value.lignes.every((l) => l.tauxTVA === 0);
        if (!allZero) return false;
        return value.lignes.some((l) => {
            const a = articles.find((x) => x.id === l.articleId);
            return !!a && a.tauxTVA > 0;
        });
    }, [value.lignes, articles]);

    const toggleSansTVA = () => {
        const nextLignes = value.lignes.map((l) => {
            if (sansTVA) {
                const a = articles.find((x) => x.id === l.articleId);
                const tauxTVA = a ? a.tauxTVA : 0;
                const prixUnitaireTTC = l.prixUnitaireHT * (1 + tauxTVA / 100);
                return recomputeLigne({ ...l, tauxTVA, prixUnitaireTTC });
            }
            return recomputeLigne({ ...l, tauxTVA: 0, prixUnitaireTTC: l.prixUnitaireHT });
        });
        onChange({ ...value, lignes: nextLignes });
    };

    return (
        <div className="space-y-6 mx-auto max-w-270">
            {!readOnly && (
                <div className="flex justify-end">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOptionsMenuOpen((v) => !v)}
                            className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                            aria-label="Options de la facture"
                        >
                            <FluentMoreHorizontal32Regular className="w-4 h-4" />
                        </button>
                        {optionsMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setOptionsMenuOpen(false)} />
                                <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden py-1">
                                    <div
                                        onClick={() => toggleAfficherTVA()}
                                        className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50 cursor-pointer"
                                    >
                                        <span>Afficher la TVA</span>
                                        <Switch
                                            checked={afficherTVA}
                                            onChange={() => toggleAfficherTVA()}
                                            aria-label="Afficher la TVA"
                                        />
                                    </div>
                                    <div
                                        onClick={() => { if (afficherTVA) toggleAfficherTVALignes(); }}
                                        className={`w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50 cursor-pointer ${!afficherTVA ? 'opacity-40 pointer-events-none' : ''}`}
                                        title="Si désactivé, la TVA reste visible uniquement dans les totaux"
                                    >
                                        <span>Afficher la TVA dans les lignes</span>
                                        <Switch
                                            checked={afficherTVALignes}
                                            onChange={() => toggleAfficherTVALignes()}
                                            aria-label="Afficher la TVA dans les lignes"
                                        />
                                    </div>
                                    <div
                                        onClick={() => toggleSansTVA()}
                                        className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50 cursor-pointer"
                                    >
                                        <span>Retirer la TVA des calculs</span>
                                        <Switch
                                            checked={sansTVA}
                                            onChange={() => toggleSansTVA()}
                                            aria-label="Retirer la TVA des calculs"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
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
                        <span className="text-xs text-gray-500">Date d'échéance</span>
                        <input
                            disabled={readOnly}
                            type="date"
                            value={value.dateEcheance}
                            onChange={(e) => onChange({ ...value, dateEcheance: e.target.value })}
                            className="mt-1 w-full h-10 px-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
                        />
                    </label>
                </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-xs uppercase text-gray-400 font-medium">Articles</div>
                    {!readOnly && (
                        <ArticlePicker
                            articles={articles}
                            onPick={(a) => addLigne(a)}
                            label="Ajouter une ligne"
                        />
                    )}
                </div>

                {value.lignes.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-6">
                        Aucun article — ajoute une ligne pour commencer.
                    </div>
                ) : (
                    <LignesBlock lignes={value.lignes} actions={ligneActions} />
                )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-2 text-sm">
                        <Row label="Total HT" value={formatFCFA(totaux.totalHT)} />
                        {afficherTVA && <Row label="Total TVA" value={formatFCFA(totaux.totalTVA)} />}
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

            {/* <section className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </section> */}
        </div>
    );
}

type LigneActions = {
    updateLigne: (id: string, patch: Partial<LigneDocument>) => void;
    removeLigne: (id: string) => void;
    insertEmptyAt: (index: number) => void;
    duplicateLigne: (id: string) => void;
    moveLigne: (id: string, direction: -1 | 1) => void;
    reorderLigne: (fromId: string, toId: string) => void;
    readOnly?: boolean;
    afficherTVA?: boolean;
};

function LignesBlock({ lignes, actions }: { lignes: LigneDocument[]; actions: LigneActions }) {
    const { readOnly, afficherTVA = true, reorderLigne, insertEmptyAt } = actions;
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    return (
        <div>
            <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-400">
                    <tr>
                        <th className="text-left pb-2 font-medium w-[40%]">Désignation</th>
                        <th className="text-center pb-2 font-medium w-20">Qté</th>
                        <th className="text-center pb-2 font-medium w-28">P.U. HT</th>
                        {afficherTVA && <th className="text-center pb-2 font-medium w-44">TVA</th>}
                        <th className="text-center pb-2 font-medium w-20">Remise %</th>
                        <th className="text-right pb-2 font-medium w-32">Total TTC</th>
                    </tr>
                </thead>
                <tbody>
                    {lignes.map((l, idx) => (
                        <LigneRow
                            key={l.id}
                            ligne={l}
                            index={idx}
                            total={lignes.length}
                            actions={actions}
                            isDragging={draggingId === l.id}
                            isOver={overId === l.id && draggingId !== null && draggingId !== l.id}
                            onDragStart={() => setDraggingId(l.id)}
                            onDragEnd={() => { setDraggingId(null); setOverId(null); }}
                            onDragOver={() => setOverId(l.id)}
                            onDropOn={() => {
                                if (draggingId) reorderLigne(draggingId, l.id);
                                setDraggingId(null); setOverId(null);
                            }}
                        />
                    ))}
                </tbody>
            </table>
            {!readOnly && lignes.length > 0 && (
                <button
                    type="button"
                    onClick={() => insertEmptyAt(lignes.length)}
                    className="mt-2 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                    <FluentAdd32Regular className="h-3 w-3" />
                    Insérer une ligne vide
                </button>
            )}
        </div>
    );
}

function LigneRow({
    ligne: l,
    index,
    total,
    actions,
    isDragging,
    isOver,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDropOn,
}: {
    ligne: LigneDocument;
    index: number;
    total: number;
    actions: LigneActions;
    isDragging: boolean;
    isOver: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOver: () => void;
    onDropOn: () => void;
}) {
    const { updateLigne, removeLigne, insertEmptyAt, duplicateLigne, moveLigne, readOnly, afficherTVA = true } = actions;
    const [menuOpen, setMenuOpen] = useState(false);
    const [tvaOpen, setTvaOpen] = useState(false);

    const onTvaPick = (rate: number) => {
        const prixUnitaireTTC = l.prixUnitaireHT * (1 + rate / 100);
        updateLigne(l.id, { tauxTVA: rate, prixUnitaireTTC });
        setTvaOpen(false);
    };

    return (
        <tr
            className={`group relative row border-t border-slate-100 transition-all duration-150 ${isDragging ? 'opacity-40' : ''} ${isOver ? 'bg-blue-50/50 border-t-2 border-t-blue-400' : ''}`}
            onDragOver={(e) => { if (!readOnly) { e.preventDefault(); onDragOver(); } }}
            onDrop={(e) => { if (!readOnly) { e.preventDefault(); onDropOn(); } }}
            style={{ borderSpacing: "5px 0" }}
        >
            <td className="py-2 pr-2 relative">
                {!readOnly && (
                    <button
                        type="button"
                        className="absolute bg-slate-700 hover:bg-slate-900 text-white shadow-2xs top-1/2 -translate-y-1/2 -left-9 w-8 h-8 rounded-full flex items-center justify-center  cursor-grab active:cursor-grabbing select-none opacity-0 group-hover:opacity-100 transition-opacity"
                        draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
                        onDragEnd={onDragEnd}
                        title="Glisser pour réordonner"
                    >
                        ⋮⋮
                    </button>
                )}
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
            {afficherTVA && (
                <td className="py-2 text-center">
                    {readOnly ? (
                        <span className="text-gray-600">{tvaLabel(l.tauxTVA)}</span>
                    ) : (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setTvaOpen((v) => !v)}
                                className="w-[95%] px-3 py-1 text-sm rounded-full bg-slate-50 border border-slate-200 hover:border-slate-400 focus:outline-none flex items-center justify-between gap-1"
                            >
                                <span className="truncate">{tvaLabel(l.tauxTVA)}</span>
                                <span className="text-gray-400">▾</span>
                            </button>
                            {tvaOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setTvaOpen(false)} />
                                    <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-40 overflow-hidden py-1 text-left">
                                        {TVA_RATES.map((r) => {
                                            const selected = Math.abs(r.value - l.tauxTVA) < 0.0001;
                                            return (
                                                <button
                                                    key={`${r.label}-${r.value}`}
                                                    type="button"
                                                    onClick={() => onTvaPick(r.value)}
                                                    className="w-full px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                                                >
                                                    <span className="w-4 text-blue-600">{selected ? '✓' : ''}</span>
                                                    <span className="flex-1 text-left">{r.label}</span>
                                                    <span className="text-gray-400 text-xs">({r.value}%)</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </td>
            )}
            <td className="py-2 text-center">
                <NumberCell value={l.remise} disabled={readOnly} onChange={(v) => updateLigne(l.id, { remise: v })} />
            </td>
            <td className="py-2 text-right font-medium relative">
                {formatFCFA(l.montantTotalTTC)}
                {!readOnly && (
                    <div className={`absolute z-30 top-1/2 -translate-y-1/2 -right-10 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                            type="button"
                            onClick={() => setMenuOpen((v) => !v)}
                            className="h-8 w-8 rounded-full bg-slate-700 shadow-2xs hover:bg-slate-900 text-white inline-flex items-center justify-center transition-colors"
                            aria-label="Options de la ligne"
                        >

                            {
                                menuOpen ? <RiCloseLine className="h-5 w-5 text-white" /> : <FluentMoreHorizontal32Regular className="h-4 w-4 text-white" />
                            }
                        </button>
                        {menuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-40 overflow-hidden py-1 text-left">
                                    <MenuItem onClick={() => { insertEmptyAt(index); setMenuOpen(false); }}>
                                        Insérer une ligne au-dessus
                                    </MenuItem>
                                    <MenuItem onClick={() => { insertEmptyAt(index + 1); setMenuOpen(false); }}>
                                        Insérer une ligne en-dessous
                                    </MenuItem>
                                    <MenuItem onClick={() => { duplicateLigne(l.id); setMenuOpen(false); }}>
                                        Dupliquer
                                    </MenuItem>
                                    <div className="my-1 border-t border-slate-100" />
                                    <MenuItem onClick={() => { moveLigne(l.id, -1); setMenuOpen(false); }} disabled={index === 0}>
                                        Monter
                                    </MenuItem>
                                    <MenuItem onClick={() => { moveLigne(l.id, 1); setMenuOpen(false); }} disabled={index === total - 1}>
                                        Descendre
                                    </MenuItem>
                                    <div className="my-1 border-t border-slate-100" />
                                    <MenuItem onClick={() => { removeLigne(l.id); setMenuOpen(false); }} danger>
                                        <span className="inline-flex items-center gap-2">
                                            <FluentDelete32Regular className="h-4 w-4" />
                                            Supprimer
                                        </span>
                                    </MenuItem>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </td>
        </tr>
    );
}

function MenuItem({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full px-4 py-2 text-sm text-left hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed ${danger ? 'text-red-600 hover:bg-red-50' : ''}`}
        >
            {children}
        </button>
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
}: {
    articles: Article[];
    onPick: (a: Article) => void;
    label?: string;
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

    return (
        <div className="relative">
            <button onClick={() => setOpen((v) => !v)} className="h-9 px-4 rounded-full bg-slate-900 text-white text-sm flex items-center gap-2">
                <FluentAdd32Regular className="h-4 w-4" />
                {label}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-2 w-120 bg-white border border-slate-200 rounded-2xl shadow-lg p-3 z-50">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Chercher par nom ou référence…"
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
