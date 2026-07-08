import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabase } from '../databaseProvider';
import { useAuth } from '../auth/authProvider';
import { formatFCFA } from '../libs/format';
import { db } from '../context/db_sync';
import { Devis, Facture, TacheProjet } from '../Databases/db.d';
import ScrollArea from '../components/scroll_area';
import {
    FluentReceiptMoney24Filled,
    FluentClipboardDataBar32Filled,
    FluentArchive32Filled,
    FluentArrowUp32Filled,
    FluentBox32Filled,
    FluentAlert32Filled,
    FluentNotepad32Filled,
    FluentGridKanban20Filled,
    FluentChevronRight32Filled,
    FluentPerson32Filled,
} from '../libs/icons';

type Range = { start: Date; end: Date };

function monthRange(d: Date): Range {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start, end };
}

function previousMonthRange(d: Date): Range {
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end = new Date(d.getFullYear(), d.getMonth(), 1);
    return { start, end };
}

function inRange(iso: string | undefined, r: Range): boolean {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return t >= r.start.getTime() && t < r.end.getTime();
}

function trend(current: number, previous: number): { pct: number; up: boolean } | null {
    if (previous <= 0) return null;
    const pct = ((current - previous) / previous) * 100;
    return { pct: Math.abs(pct), up: pct >= 0 };
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysBetween(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

const DEVIS_RELANCE_DAYS = 7;

export default function HomePage() {
    const { factures, articles, clients, devis, projets, administrateurs } = useDatabase();
    const { user } = useAuth();
    const navigate = useNavigate();

    const now = useMemo(() => new Date(), []);
    const monthLabel = useMemo(
        () => capitalize(now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })),
        [now],
    );

    const stats = useMemo(() => {
        const curr = monthRange(now);
        const prev = previousMonthRange(now);

        const activeFactures = factures.filter(
            (f) => f.statut !== 'brouillon' && f.statut !== 'annulée',
        );

        let caEncaisseCurr = 0;
        let caEncaissePrev = 0;
        for (const f of activeFactures) {
            for (const p of f.paiements ?? []) {
                if (inRange(p.date, curr)) caEncaisseCurr += p.montant ?? 0;
                else if (inRange(p.date, prev)) caEncaissePrev += p.montant ?? 0;
            }
        }

        let caFactureCurr = 0;
        let caFacturePrev = 0;
        for (const f of activeFactures) {
            if (inRange(f.dateEmission, curr)) caFactureCurr += f.totalApreRemise ?? 0;
            else if (inRange(f.dateEmission, prev)) caFacturePrev += f.totalApreRemise ?? 0;
        }

        const resteAEncaisser = activeFactures.reduce(
            (acc, f) => acc + Math.max(0, f.montantRestant ?? 0),
            0,
        );

        const stockTotal = articles.reduce((acc, a) => acc + (a.stockTotal ?? 0), 0);

        return {
            caEncaisseCurr,
            trendEncaisse: trend(caEncaisseCurr, caEncaissePrev),
            caFactureCurr,
            trendFacture: trend(caFactureCurr, caFacturePrev),
            resteAEncaisser,
            facturesEnAttente: activeFactures.filter((f) => (f.montantRestant ?? 0) > 0).length,
            stockTotal,
            articlesCount: articles.length,
        };
    }, [factures, articles, now]);

    const facturesEnRetard = useMemo(() => {
        const today = now.getTime();
        return factures
            .filter(
                (f) =>
                    f.statut !== 'brouillon' &&
                    f.statut !== 'annulée' &&
                    (f.montantRestant ?? 0) > 0 &&
                    f.dateEcheance &&
                    new Date(f.dateEcheance).getTime() < today,
            )
            .sort(
                (a, b) =>
                    new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime(),
            );
    }, [factures, now]);

    const devisSansReponse = useMemo(() => {
        const threshold = now.getTime() - DEVIS_RELANCE_DAYS * 86400000;
        return devis
            .filter(
                (d) =>
                    d.statut === 'envoyé' &&
                    d.dateEmission &&
                    new Date(d.dateEmission).getTime() < threshold,
            )
            .sort(
                (a, b) =>
                    new Date(a.dateEmission).getTime() - new Date(b.dateEmission).getTime(),
            );
    }, [devis, now]);

    const [tachesAFaire, setTachesAFaire] = useState<Array<TacheProjet & { projetNom: string }>>([]);

    useEffect(() => {
        let cancelled = false;
        const projetsActifs = projets.filter(
            (p) => p.statut === 'en_cours' || p.statut === 'planifié',
        );
        if (projetsActifs.length === 0) {
            setTachesAFaire([]);
            return;
        }
        Promise.all(
            projetsActifs.map((p) =>
                db.tachesProjet
                    .getByProjetId(p.id)
                    .then((list: TacheProjet[]) =>
                        (list ?? [])
                            .filter((t) => t.statut === 'à_faire')
                            .map((t) => ({ ...t, projetNom: p.nom })),
                    )
                    .catch(() => []),
            ),
        ).then((groups) => {
            if (cancelled) return;
            const flat = groups.flat();
            flat.sort((a, b) => {
                const pri = priorityRank(b.priorite) - priorityRank(a.priorite);
                if (pri !== 0) return pri;
                const ea = a.dateEcheance ? new Date(a.dateEcheance).getTime() : Infinity;
                const eb = b.dateEcheance ? new Date(b.dateEcheance).getTime() : Infinity;
                return ea - eb;
            });
            setTachesAFaire(flat);
        });
        return () => {
            cancelled = true;
        };
    }, [projets]);

    const activityEvents = useMemo(() => {
        type Ev = {
            id: string;
            date: number;
            kind: 'paiement' | 'facture' | 'devis' | 'client' | 'article';
            title: string;
            subtitle: string;
            actor?: string | undefined;
            onClick?: (() => void) | undefined;
        };
        const events: Ev[] = [];

        const adminName = (id?: string | null): string | undefined => {
            if (!id) return undefined;
            const a = administrateurs.find((x) => x.id === id);
            if (!a) return undefined;
            return [a.prenom, a.nom].filter(Boolean).join(' ') || a.email || undefined;
        };

        for (const f of factures) {
            if (f.statut === 'brouillon') continue;
            if (f.createdAt) {
                events.push({
                    id: `f-${f.id}`,
                    date: new Date(f.createdAt).getTime(),
                    kind: 'facture',
                    title: `Facture ${f.numero} émise`,
                    subtitle: clientNameOf(f.clientId),
                    onClick: () => navigate(`/factures/${f.id}`),
                });
            }
            for (const p of f.paiements ?? []) {
                events.push({
                    id: `p-${p.id}`,
                    date: new Date(p.date).getTime(),
                    kind: 'paiement',
                    title: `Paiement ${formatFCFA(p.montant ?? 0)}`,
                    subtitle: `${f.numero} · ${clientNameOf(f.clientId)}`,
                    actor: adminName(p.enregistréPar),
                    onClick: () => navigate(`/factures/${f.id}`),
                });
            }
        }
        for (const d of devis) {
            if (d.createdAt) {
                events.push({
                    id: `d-${d.id}`,
                    date: new Date(d.createdAt).getTime(),
                    kind: 'devis',
                    title: `Devis ${d.numero} créé`,
                    subtitle: clientNameOf(d.clientId),
                    onClick: () => navigate(`/devis/${d.id}`),
                });
            }
        }
        for (const c of clients) {
            if (c.createdAt) {
                events.push({
                    id: `c-${c.id}`,
                    date: new Date(c.createdAt).getTime(),
                    kind: 'client',
                    title: 'Nouveau client',
                    subtitle: clientLabel(c),
                    actor: adminName(c.createdBy),
                    onClick: () => navigate(`/clients/${c.id}`),
                });
            }
        }
        for (const a of articles) {
            if (a.createdAt) {
                events.push({
                    id: `a-${a.id}`,
                    date: new Date(a.createdAt).getTime(),
                    kind: 'article',
                    title: 'Article ajouté',
                    subtitle: a.nom,
                    onClick: () => navigate(`/produits/article/${a.id}`),
                });
            }
        }

        events.sort((a, b) => b.date - a.date);
        return events.slice(0, 10);

        function clientNameOf(id: string): string {
            const c = clients.find((x) => x.id === id);
            if (!c) return 'Client';
            return c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom;
        }
        function clientLabel(c: typeof clients[number]): string {
            return c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom;
        }
    }, [factures, devis, clients, articles, administrateurs, navigate]);

    const caMonthly = useMemo(() => {
        const months: { key: string; label: string; encaisse: number; facture: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
            months.push({
                key: `${d.getFullYear()}-${d.getMonth()}`,
                label: label.charAt(0).toUpperCase() + label.slice(1),
                encaisse: 0,
                facture: 0,
            });
        }
        const idxOf = (iso: string | undefined): number => {
            if (!iso) return -1;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return -1;
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            return months.findIndex((m) => m.key === key);
        };
        const active = factures.filter((f) => f.statut !== 'brouillon' && f.statut !== 'annulée');
        for (const f of active) {
            const i = idxOf(f.dateEmission);
            if (i >= 0) months[i]!.facture += f.totalApreRemise ?? 0;
            for (const p of f.paiements ?? []) {
                const j = idxOf(p.date);
                if (j >= 0) months[j]!.encaisse += p.montant ?? 0;
            }
        }
        return months;
    }, [factures, now]);

    const clientName = (id: string): string => {
        const c = clients.find((x) => x.id === id);
        if (!c) return 'Client';
        return c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(' ') || c.nom;
    };

    const greetingName = user?.prenom || user?.nom || '';

    return (
        <ScrollArea className="h-full w-full overflow-y-auto bg-slate-50">
            <div className="max-w-7xl mx-auto px-8 py-10">
                <header className="mb-8">
                    <div className="text-xs uppercase tracking-wider text-gray-400">{monthLabel}</div>
                    <h1 className="text-2xl font-semibold text-slate-900 mt-1">
                        {greetingName ? `Bonjour ${greetingName}` : 'Tableau de bord'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Vue d'ensemble de l'activité du mois en cours.
                    </p>
                </header>

                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        label="CA encaissé"
                        value={formatFCFA(stats.caEncaisseCurr)}
                        sub="Paiements reçus ce mois"
                        trendPct={stats.trendEncaisse}
                        icon={<FluentReceiptMoney24Filled className="h-5 w-5 text-emerald-700" />}
                        tint="bg-emerald-50"
                    />
                    <KpiCard
                        label="CA facturé"
                        value={formatFCFA(stats.caFactureCurr)}
                        sub="Factures émises ce mois"
                        trendPct={stats.trendFacture}
                        icon={<FluentClipboardDataBar32Filled className="h-5 w-5 text-sky-700" />}
                        tint="bg-sky-50"
                    />
                    <KpiCard
                        label="Reste à encaisser"
                        value={formatFCFA(stats.resteAEncaisser)}
                        sub={`${stats.facturesEnAttente} facture${stats.facturesEnAttente > 1 ? 's' : ''} en attente`}
                        icon={<FluentArchive32Filled className="h-5 w-5 text-amber-700" />}
                        tint="bg-amber-50"
                    />
                    <KpiCard
                        label="Stock total"
                        value={`${stats.stockTotal.toLocaleString('fr-FR')}`}
                        sub={`${stats.articlesCount} article${stats.articlesCount > 1 ? 's' : ''} au catalogue`}
                        icon={<FluentBox32Filled className="h-5 w-5 text-slate-700" />}
                        tint="bg-slate-100"
                    />
                </section>
                <section className="mt-6">
                    <MonthlyRevenueChart data={caMonthly} />
                </section>
                <section className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <MiniStat label="Clients" value={clients.length} />
                    <MiniStat label="Devis" value={devis.length} />
                    <MiniStat label="Factures" value={factures.length} />
                </section>

                <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <TodoCard
                        title="Factures en retard"
                        count={facturesEnRetard.length}
                        icon={<FluentAlert32Filled className="h-5 w-5 text-rose-700" />}
                        tint="bg-rose-50"
                        seeAllLabel="Voir toutes les factures"
                        onSeeAll={() => navigate('/factures')}
                        empty="Aucune facture en retard."
                    >
                        {facturesEnRetard.slice(0, 5).map((f) => (
                            <TodoRow
                                key={f.id}
                                onClick={() => navigate(`/factures/${f.id}`)}
                                title={f.numero}
                                subtitle={clientName(f.clientId)}
                                right={
                                    <div className="text-right">
                                        <div className="text-xs font-semibold text-rose-700 tabular-nums">
                                            {formatFCFA(f.montantRestant ?? 0)}
                                        </div>
                                        <div className="text-[10px] text-rose-500">
                                            {retardLabel(f, now)}
                                        </div>
                                    </div>
                                }
                            />
                        ))}
                    </TodoCard>

                    <TodoCard
                        title="Devis sans réponse"
                        count={devisSansReponse.length}
                        icon={<FluentNotepad32Filled className="h-5 w-5 text-sky-700" />}
                        tint="bg-sky-50"
                        seeAllLabel="Voir tous les devis"
                        onSeeAll={() => navigate('/devis')}
                        empty="Aucun devis en attente de réponse."
                    >
                        {devisSansReponse.slice(0, 5).map((d) => (
                            <TodoRow
                                key={d.id}
                                onClick={() => navigate(`/devis/${d.id}`)}
                                title={d.numero}
                                subtitle={clientName(d.clientId)}
                                right={
                                    <div className="text-right">
                                        <div className="text-xs font-medium text-slate-700 tabular-nums">
                                            {formatFCFA(d.totalApreRemise ?? 0)}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            envoyé {envoiLabel(d, now)}
                                        </div>
                                    </div>
                                }
                            />
                        ))}
                    </TodoCard>

                    <TodoCard
                        title="Tâches à faire"
                        count={tachesAFaire.length}
                        icon={<FluentGridKanban20Filled className="h-5 w-5 text-slate-700" />}
                        tint="bg-slate-100"
                        seeAllLabel="Voir les projets"
                        onSeeAll={() => navigate('/projets')}
                        empty="Aucune tâche en attente."
                    >
                        {tachesAFaire.slice(0, 5).map((t) => (
                            <TodoRow
                                key={t.id}
                                onClick={() => navigate(`/projets/${t.projetId}`)}
                                title={t.titre}
                                subtitle={t.projetNom}
                                right={
                                    <PrioriteBadge priorite={t.priorite} echeance={t.dateEcheance} />
                                }
                            />
                        ))}
                    </TodoCard>
                </section>

                <section className="mt-6">
                    <div className="bg-white border border-slate-100 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-sm font-medium text-slate-900">Activité récente</div>
                                <div className="text-xs text-gray-400">10 derniers événements</div>
                            </div>
                        </div>
                        {activityEvents.length === 0 ? (
                            <div className="text-xs text-gray-400 py-6 text-center">
                                Aucune activité enregistrée pour l'instant.
                            </div>
                        ) : (
                            <ul className="flex flex-col">
                                {activityEvents.map((ev) => (
                                    <ActivityRow
                                        key={ev.id}
                                        kind={ev.kind}
                                        title={ev.title}
                                        subtitle={ev.subtitle}
                                        actor={ev.actor}
                                        when={relativeTime(ev.date, now)}
                                        onClick={ev.onClick}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </section>


            </div>
        </ScrollArea>
    );
}

function priorityRank(p: TacheProjet['priorite']): number {
    switch (p) {
        case 'urgente': return 3;
        case 'haute': return 2;
        case 'normale': return 1;
        case 'basse': return 0;
    }
}

function retardLabel(f: Facture, now: Date): string {
    const d = daysBetween(new Date(f.dateEcheance), now);
    if (d <= 0) return 'aujourd\'hui';
    if (d === 1) return '1 jour de retard';
    return `${d} jours de retard`;
}

function envoiLabel(d: Devis, now: Date): string {
    const days = daysBetween(new Date(d.dateEmission), now);
    if (days <= 0) return 'aujourd\'hui';
    if (days === 1) return 'hier';
    if (days < 7) return `il y a ${days} j`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `il y a ${weeks} sem.`;
    const months = Math.floor(days / 30);
    return `il y a ${months} mois`;
}

function relativeTime(ts: number, now: Date): string {
    const diff = Math.max(0, now.getTime() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `il y a ${d} j`;
    const w = Math.floor(d / 7);
    if (w < 5) return `il y a ${w} sem.`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `il y a ${mo} mois`;
    const y = Math.floor(d / 365);
    return `il y a ${y} an${y > 1 ? 's' : ''}`;
}

type ActivityKind = 'paiement' | 'facture' | 'devis' | 'client' | 'article';

function ActivityRow({
    kind, title, subtitle, actor, when, onClick,
}: {
    kind: ActivityKind;
    title: string;
    subtitle: string;
    actor?: string | undefined;
    when: string;
    onClick?: (() => void) | undefined;
}) {
    const palette: Record<ActivityKind, { tint: string; text: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }> = {
        paiement: { tint: 'bg-emerald-50', text: 'text-emerald-700', Icon: FluentReceiptMoney24Filled },
        facture: { tint: 'bg-sky-50', text: 'text-sky-700', Icon: FluentClipboardDataBar32Filled },
        devis: { tint: 'bg-amber-50', text: 'text-amber-700', Icon: FluentNotepad32Filled },
        client: { tint: 'bg-rose-50', text: 'text-rose-700', Icon: FluentPerson32Filled },
        article: { tint: 'bg-slate-100', text: 'text-slate-700', Icon: FluentBox32Filled },
    };
    const { tint, text, Icon } = palette[kind];
    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                disabled={!onClick}
                className="group w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 transition text-left disabled:cursor-default"
            >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}>
                    <Icon className={`h-4 w-4 ${text}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
                    <div className="text-xs text-gray-500 truncate">
                        {subtitle}
                        {actor && <span className="text-gray-400"> · {actor}</span>}
                    </div>
                </div>
                <div className="text-[11px] text-gray-400 shrink-0 tabular-nums">{when}</div>
            </button>
        </li>
    );
}

function MonthlyRevenueChart({
    data,
}: {
    data: { key: string; label: string; encaisse: number; facture: number }[];
}) {
    const [hover, setHover] = useState<number | null>(null);
    const width = 1108;
    const height = 200;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 32;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const maxRaw = Math.max(
        1,
        ...data.map((d) => Math.max(d.encaisse, d.facture)),
    );
    const niceMax = niceCeil(maxRaw);
    const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
    const x = (i: number) => padL + stepX * i;
    const y = (v: number) => padT + innerH - (v / niceMax) * innerH;

    const linePath = (key: 'encaisse' | 'facture'): string =>
        data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

    const ticks = 4;
    const yTicks = Array.from({ length: ticks + 1 }, (_, k) => (niceMax / ticks) * k);

    const hasData = data.some((d) => d.encaisse > 0 || d.facture > 0);

    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-sm font-medium text-slate-900">Chiffre d'affaires</div>
                    <div className="text-xs text-gray-400">6 derniers mois</div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-0.5 bg-emerald-600 rounded" />
                        Encaissé
                    </span>
                    <span className="flex items-center gap-1.5">
                        <svg width="12" height="2"><line x1="0" y1="1" x2="12" y2="1" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
                        Facturé
                    </span>
                </div>
            </div>
            {!hasData ? (
                <div className="text-xs text-gray-400 py-10 text-center">
                    Pas de données sur les 6 derniers mois.
                </div>
            ) : (
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-60"
                    preserveAspectRatio="none"
                    onMouseLeave={() => setHover(null)}
                >
                    {yTicks.map((v, k) => (
                        <g key={k}>
                            <line
                                x1={padL} x2={width - padR}
                                y1={y(v)} y2={y(v)}
                                stroke="#f1f5f9" strokeWidth={1}
                            />
                            <text
                                x={padL - 6} y={y(v) + 3}
                                textAnchor="end"
                                className="fill-gray-400"
                                style={{ fontSize: '10px' }}
                            >
                                {compactFCFA(v)}
                            </text>
                        </g>
                    ))}

                    <path d={linePath('facture')} fill="none" stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" />
                    <path d={linePath('encaisse')} fill="none" stroke="#059669" strokeWidth={2} />

                    {data.map((d, i) => (
                        <g key={d.key}>
                            <circle cx={x(i)} cy={y(d.encaisse)} r={3} fill="#059669" />
                            <circle cx={x(i)} cy={y(d.facture)} r={2.5} fill="#fff" stroke="#0284c7" strokeWidth={1.5} />
                            <text
                                x={x(i)} y={height}
                                textAnchor="middle"
                                className="fill-gray-500"
                                style={{ fontSize: '11px' }}
                            >
                                {d.label}
                            </text>
                            <rect
                                x={x(i) - stepX / 2} y={padT}
                                width={stepX} height={innerH}
                                fill="transparent"
                                onMouseEnter={() => setHover(i)}
                            />
                            {hover === i && (
                                <line
                                    x1={x(i)} x2={x(i)}
                                    y1={padT} y2={padT + innerH}
                                    stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 2"
                                />
                            )}
                        </g>
                    ))}

                    {hover !== null && (() => {
                        const d = data[hover]!;
                        const cx = x(hover);
                        const boxW = 150;
                        const boxH = 50;
                        const bx = Math.min(width - padR - boxW, Math.max(padL, cx + 8));
                        const by = padT + 4;
                        return (
                            <g pointerEvents="none">
                                <rect x={bx} y={by} width={boxW} height={boxH} rx={8} fill="#0f172a" />
                                <text x={bx + 10} y={by + 16} className="fill-white" style={{ fontSize: '11px', fontWeight: 600 }}>
                                    {d.label}
                                </text>
                                <text x={bx + 10} y={by + 30} className="fill-emerald-300" style={{ fontSize: '10px' }}>
                                    Encaissé · {formatFCFA(d.encaisse)}
                                </text>
                                <text x={bx + 10} y={by + 43} className="fill-sky-300" style={{ fontSize: '10px' }}>
                                    Facturé · {formatFCFA(d.facture)}
                                </text>
                            </g>
                        );
                    })()}
                </svg>
            )}
        </div>
    );
}

function niceCeil(v: number): number {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * pow;
}

function compactFCFA(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)} M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)} k`;
    return v.toLocaleString('fr-FR');
}

function KpiCard({
    label, value, sub, icon, tint, trendPct,
}: {
    label: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    tint: string;
    trendPct?: { pct: number; up: boolean } | null;
}) {
    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 transition">
            <div className="flex items-start justify-between">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tint}`}>
                    {icon}
                </div>
                {trendPct && (
                    <div
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trendPct.up
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                            }`}
                    >
                        <FluentArrowUp32Filled
                            className={`h-3 w-3 ${trendPct.up ? '' : 'rotate-180'}`}
                        />
                        {trendPct.pct.toFixed(0)}%
                    </div>
                )}
            </div>
            <div className="text-xs text-gray-500 mt-4">{label}</div>
            <div className="text-xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
        </div>
    );
}

function TodoCard({
    title, count, icon, tint, children, empty, seeAllLabel, onSeeAll,
}: {
    title: string;
    count: number;
    icon: React.ReactNode;
    tint: string;
    children: React.ReactNode;
    empty: string;
    seeAllLabel: string;
    onSeeAll: () => void;
}) {
    const hasItems = Array.isArray(children)
        ? children.filter(Boolean).length > 0
        : Boolean(children);
    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tint}`}>
                        {icon}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-900">{title}</div>
                        <div className="text-xs text-gray-400">
                            {count} élément{count > 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-1 min-h-0">
                {hasItems ? (
                    children
                ) : (
                    <div className="text-xs text-gray-400 py-6 text-center">{empty}</div>
                )}
            </div>
            {count > 5 && (
                <button
                    type="button"
                    onClick={onSeeAll}
                    className="mt-3 text-xs text-slate-500 hover:text-slate-900 text-left"
                >
                    {seeAllLabel} ({count}) →
                </button>
            )}
        </div>
    );
}

function TodoRow({
    title, subtitle, right, onClick,
}: {
    title: string;
    subtitle: string;
    right: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition text-left"
        >
            <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
                <div className="text-xs text-gray-500 truncate">{subtitle}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {right}
                <FluentChevronRight32Filled className="h-3 w-3 text-gray-300 group-hover:text-slate-500" />
            </div>
        </button>
    );
}

function PrioriteBadge({
    priorite, echeance,
}: {
    priorite: TacheProjet['priorite'];
    echeance?: string | undefined;
}) {
    const styles: Record<TacheProjet['priorite'], string> = {
        urgente: 'bg-rose-50 text-rose-700',
        haute: 'bg-amber-50 text-amber-700',
        normale: 'bg-sky-50 text-sky-700',
        basse: 'bg-slate-100 text-slate-600',
    };
    return (
        <div className="text-right">
            <div className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[priorite]}`}>
                {priorite}
            </div>
            {echeance && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </div>
            )}
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-lg font-semibold text-slate-900 tabular-nums">
                {value.toLocaleString('fr-FR')}
            </div>
        </div>
    );
}
