import { Client, Devis, LigneDocument } from '../Databases/db.d';
import { formatDate, formatFCFA, numberToWordsFr } from './format';

const COMPANY = {
    nom: 'Kataleya',
    adresse: 'Douala, Cameroun',
    telephone: '+237 6XX XX XX XX',
    email: 'contact@kataleya.com',
};

function esc(s: unknown): string {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderClientBlock(client: Client | undefined): string {
    if (!client) return '<div class="muted">Client introuvable</div>';
    const name = client.type === 'entreprise'
        ? (client.raisonSociale || client.nom)
        : `${client.nom}${client.prenom ? ' ' + client.prenom : ''}`;
    const a = client.adresse;
    const addrLine = [a?.rue, a?.quartier, a?.ville, a?.pays].filter(Boolean).join(', ');
    return `
        <div class="block-title">Client</div>
        <div class="strong">${esc(name)}</div>
        ${addrLine ? `<div>${esc(addrLine)}</div>` : ''}
        ${client.email ? `<div>${esc(client.email)}</div>` : ''}
        ${client.telephone ? `<div>${esc(client.telephone)}</div>` : ''}
    `;
}

function renderLigneRow(l: LigneDocument): string {
    return `
        <tr>
            <td>
                <div class="strong">${esc(l.designation)}</div>
                <div class="muted small">${esc(l.reference)}</div>
            </td>
            <td class="center">${l.quantite} ${esc(l.unite)}</td>
            <td class="center">${formatFCFA(l.prixUnitaireHT)}</td>
            <td class="center">${l.remise ? l.remise + '%' : '—'}</td>
            <td class="center">${l.tauxTVA}%</td>
            <td class="right strong">${formatFCFA(l.montantTotalTTC)}</td>
        </tr>
    `;
}

function renderLignesTable(lignes: LigneDocument[]): string {
    const head = `
        <thead>
            <tr>
                <th class="designation">Désignation</th>
                <th class="center" style = "text-align: center;">Qté</th>
                <th class="center" style = "text-align: center;">P.U. HT</th>
                <th class="center" style = "text-align: center">Remise</th>
                <th class="center" style = "text-align: center;">TVA</th>
                <th class="right" style = "text-align: right;">Total TTC</th>
            </tr>
        </thead>
    `;
    return `<table class="lignes">${head}<tbody>${lignes.map(renderLigneRow).join('')}</tbody></table>`;
}

function renderGroupedLignes(devis: Devis): string {
    const groupes = devis.groupes ?? [];
    if (groupes.length === 0) return renderLignesTable(devis.lignes);

    const assigned = new Set<string>();
    const blocks: string[] = [];

    for (const g of groupes) {
        const groupLignes = devis.lignes.filter((l) => l.groupeId === g.id && !l.sousGroupeId);
        const sousBlocks: string[] = [];
        for (const sg of g.sousGroupes ?? []) {
            const sgLignes = devis.lignes.filter((l) => l.sousGroupeId === sg.id);
            sgLignes.forEach((l) => assigned.add(l.id));
            if (sgLignes.length === 0) continue;
            sousBlocks.push(`
                <div class="sub-header">${esc(sg.nom)}</div>
                ${renderLignesTable(sgLignes)}
            `);
        }
        groupLignes.forEach((l) => assigned.add(l.id));
        if (groupLignes.length === 0 && sousBlocks.length === 0) continue;
        blocks.push(`
            <div class="group">
                <div class="group-header">${esc(g.nom)}</div>
                ${groupLignes.length ? renderLignesTable(groupLignes) : ''}
                ${sousBlocks.join('')}
            </div>
        `);
    }

    const orphans = devis.lignes.filter((l) => !assigned.has(l.id));
    if (orphans.length > 0) {
        blocks.push(`
            <div class="group">
                <div class="group-header">Autres</div>
                ${renderLignesTable(orphans)}
            </div>
        `);
    }

    return blocks.join('');
}

export function buildDevisHTML(devis: Devis, client: Client | undefined): string {
    const remiseAmount = devis.totalTTC - devis.totalApreRemise;
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(devis.numero)}</title>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0f172a;
        font-size: 11px;
        margin: 0;
        padding: 24px 28px;
        line-height: 1.45;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; }
    .company-name { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .company-info { color: #475569; font-size: 10px; line-height: 1.5; margin-top: 4px; }
    .devis-meta { text-align: right; }
    .devis-title { font-size: 18px; font-weight: 700; color: #1e40af; }
    .devis-numero { font-size: 12px; color: #475569; margin-top: 2px; }
    .devis-dates { margin-top: 8px; font-size: 10px; color: #475569; }
    .parties { display: flex; gap: 16px; margin-top: 20px; margin-bottom: 16px; }
    .party { flex: 1; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .block-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
    .strong { font-weight: 600; }
    .muted { color: #64748b; }
    .small { font-size: 10px; }
    .group { margin-top: 12px; }
    .group-header { background: #1e293b; color: white; padding: 6px 10px; font-weight: 600; font-size: 11px; border-radius: 4px 4px 0 0; }
    .sub-header { background: #e2e8f0; padding: 4px 10px; font-weight: 600; font-size: 10px; margin-top: 6px; }
    table.lignes { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    table.lignes th { text-align: left; background: #f1f5f9; padding: 6px 8px; font-size: 9px; text-transform: uppercase; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    table.lignes td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .designation { text-align: left; width: 25%; }
    .right { text-align: right; }
    .center { text-align: center; }
    .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-box { min-width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 12px; }
    .totals-row.grand { background: #0f172a; color: white; font-weight: 700; font-size: 13px; padding: 10px 12px; border-radius: 4px; margin-top: 4px; }
    .arrete { margin-top: 18px; padding: 12px 14px; background: #f8fafc; border-radius: 4px; font-size: 11px; color: #0f172a; font-style: italic; }
    .arrete .amount-words { font-weight: 700; text-transform: uppercase; font-style: normal; letter-spacing: 0.3px; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #475569; }
    .footer .label { font-weight: 600; color: #0f172a; margin-bottom: 4px; }
    .footer-section { margin-top: 10px; }
</style>
</head>
<body>
    <div class="header">
        <div>
            <div class="company-name">${esc(COMPANY.nom)}</div>
            <div class="company-info">
                ${esc(COMPANY.adresse)}<br/>
                ${esc(COMPANY.telephone)} · ${esc(COMPANY.email)}
            </div>
        </div>
        <div class="devis-meta">
            <div class="devis-title">DEVIS</div>
            <div class="devis-numero">${esc(devis.numero)}</div>
            <div class="devis-dates">
                Émis le ${esc(formatDate(devis.dateEmission))}<br/>
                Valide jusqu'au ${esc(formatDate(devis.dateValidite))}
            </div>
        </div>
    </div>

    <div class="parties">
        <div class="party">
            ${renderClientBlock(client)}
        </div>
    </div>

    ${renderGroupedLignes(devis)}

    <div class="totals">
        <div class="totals-box">
            <div class="totals-row"><span>Total HT</span><span>${formatFCFA(devis.totalHT)}</span></div>
            <div class="totals-row"><span>TVA</span><span>${formatFCFA(devis.totalTVA)}</span></div>
            <div class="totals-row"><span>Total TTC</span><span>${formatFCFA(devis.totalTTC)}</span></div>
            ${devis.remiseGlobale ? `
                <div class="totals-row muted"><span>Remise globale (${devis.remiseGlobale}%)</span><span>- ${formatFCFA(remiseAmount)}</span></div>
            ` : ''}
            <div class="totals-row grand"><span>Net à payer</span><span>${formatFCFA(devis.totalApreRemise)}</span></div>
        </div>
    </div>

    <div class="arrete">
        Arrêté le présent devis à la somme de
        <span class="amount-words">${esc(numberToWordsFr(devis.totalApreRemise))} francs CFA</span>
        (${esc(formatFCFA(devis.totalApreRemise))}) toutes taxes comprises.
    </div>

    ${devis.notes || devis.conditionsPaiement ? `
        <div class="footer">
            ${devis.conditionsPaiement ? `
                <div class="footer-section">
                    <div class="label">Conditions de paiement</div>
                    <div>${esc(devis.conditionsPaiement)}</div>
                </div>
            ` : ''}
            ${devis.notes ? `
                <div class="footer-section">
                    <div class="label">Notes</div>
                    <div>${esc(devis.notes)}</div>
                </div>
            ` : ''}
        </div>
    ` : ''}
</body>
</html>`;
}

export function buildWhatsAppMessage(devis: Devis, client: Client | undefined): string {
    const name = client
        ? (client.type === 'entreprise' ? (client.raisonSociale || client.nom) : client.nom)
        : '';
    const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
    return [
        greeting,
        '',
        `Voici votre devis ${devis.numero} d'un montant de ${formatFCFA(devis.totalApreRemise)}.`,
        `Il est valide jusqu'au ${formatDate(devis.dateValidite)}.`,
        '',
        'Cordialement,',
        COMPANY.nom,
    ].join('\n');
}

export function formatPhoneForWhatsApp(raw: string | undefined): string {
    if (!raw) return '';
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    if (hasPlus) return digits;
    if (digits.startsWith('237')) return digits;
    return '237' + digits;
}
