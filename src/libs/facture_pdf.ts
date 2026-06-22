import { Client, Facture, LigneDocument, Paiement } from '../Databases/db.d';
import { formatDate, formatFCFA, numberToWordsFr } from './format';

export type AdminLookup = (id?: string | null) => string | undefined;

type CustomField = {
    id: string;
    type: 'email' | 'tel' | 'url' | 'address' | 'text';
    label: string;
    value: string;
};

type CompanyPdfInfo = {
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

let COMPANY: CompanyPdfInfo = {
    nom: 'Kataleya',
    adresse: 'Douala, Cameroun',
    telephone: '+237 6XX XX XX XX',
    email: 'contact@kataleya.com',
    logoDataUrl: '',
    notesDevis: '',
    notesFacture: '',
    conditionsPaiement: '',
    customFields: [],
};

export function setFactureCompanyInfo(info: Partial<CompanyPdfInfo>) {
    COMPANY = { ...COMPANY, ...info };
}

function renderCustomFields(): string {
    if (!COMPANY.customFields?.length) return '';
    const escIt = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return COMPANY.customFields
        .filter((f) => f.value?.trim())
        .map((f) => {
            const lbl = f.label?.trim() ? `${escIt(f.label)} : ` : '';
            return `<div>${lbl}${escIt(f.value)}</div>`;
        })
        .join('');
}

export function buildFactureWhatsAppMessage(facture: Facture, client: Client | undefined): string {
    const name = client
        ? (client.type === 'entreprise' ? (client.raisonSociale || client.nom) : client.nom)
        : '';
    const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
    const restant = facture.montantRestant ?? facture.totalApreRemise;
    const lignes = [
        greeting,
        '',
        `Veuillez trouver ci-joint votre facture ${facture.numero} d'un montant de ${formatFCFA(facture.totalApreRemise)}.`,
    ];
    if (restant > 0 && restant !== facture.totalApreRemise) {
        lignes.push(`Reste à payer : ${formatFCFA(restant)}.`);
    }
    lignes.push(`Échéance : ${formatDate(facture.dateEcheance)}.`);
    lignes.push('', 'Cordialement,', COMPANY.nom);
    return lignes.join('\n');
}

function esc(s: unknown): string {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function modeLabel(m: string): string {
    switch (m) {
        case 'espèces': return 'Espèces';
        case 'virement': return 'Virement';
        case 'chèque': return 'Chèque';
        case 'mobile_money': return 'Mobile Money';
        case 'carte_bancaire': return 'Carte bancaire';
        default: return 'Autre';
    }
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

function renderLigneRow(l: LigneDocument, showTVA: boolean): string {
    return `
        <tr>
            <td>
                <div class="strong">${esc(l.designation)}</div>
                <div class="muted small">${esc(l.reference)}</div>
            </td>
            <td class="center">${l.quantite} ${esc(l.unite)}</td>
            <td class="center">${formatFCFA(l.prixUnitaireHT)}</td>
            <td class="center">${l.remise ? l.remise + '%' : '—'}</td>
            ${showTVA ? `<td class="center">${l.tauxTVA}%</td>` : ''}
            <td class="right strong">${formatFCFA(l.montantTotalTTC)}</td>
        </tr>
    `;
}

function renderLignesTable(lignes: LigneDocument[], showTVA: boolean): string {
    return `<table class="lignes">
        <thead>
            <tr>
                <th class="designation">Désignation</th>
                <th class="center" style="text-align: center;">Qté</th>
                <th class="center" style="text-align: center;">P.U. HT</th>
                <th class="center" style="text-align: center;">Remise</th>
                ${showTVA ? `<th class="center" style="text-align: center;">TVA</th>` : ''}
                <th class="right" style="text-align: right;">Total TTC</th>
            </tr>
        </thead>
        <tbody>${lignes.map((l) => renderLigneRow(l, showTVA)).join('')}</tbody>
    </table>`;
}

function renderPaiements(facture: Facture, adminLookup?: AdminLookup): string {
    const paiements = facture.paiements ?? [];
    if (paiements.length === 0) return '';
    const rows = [...paiements]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((p) => `
            <tr>
                <td>${esc(formatDate(p.date))}</td>
                <td>${esc(modeLabel(p.mode))}</td>
                <td>${esc(p.reference ?? '—')}</td>
                <td>${esc(adminLookup?.(p.enregistréPar) ?? '—')}</td>
                <td class="right strong">${formatFCFA(p.montant)}</td>
            </tr>
        `).join('');
    return `
        <div class="section-title">Paiements reçus</div>
        <table class="paiements">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Mode</th>
                    <th>Référence</th>
                    <th>Encaissé par</th>
                    <th class="right" style="text-align: right;">Montant</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

export function buildRecuPaiementHTML(
    facture: Facture,
    client: Client | undefined,
    paiement: Paiement,
    numeroRecu: string,
    adminLookup?: AdminLookup,
): string {
    const receveurName = adminLookup?.(paiement.enregistréPar);
    const emetteurName = adminLookup?.(facture.createdBy);
    const clientName = client
        ? (client.type === 'entreprise'
            ? (client.raisonSociale || client.nom)
            : `${client.nom}${client.prenom ? ' ' + client.prenom : ''}`)
        : '—';
    const a = client?.adresse;
    const addrLine = [a?.rue, a?.quartier, a?.ville, a?.pays].filter(Boolean).join(', ');
    const totalFacture = facture.totalApreRemise;
    const dejaPaye = facture.montantPayé ?? 0;
    const resteApres = Math.max(0, totalFacture - dejaPaye);
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(numeroRecu)}</title>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #0f172a;
        font-size: 11px;
        margin: 0;
        padding: 24px 28px;
        line-height: 1.5;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; }
    .company-name { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .company-info { color: #475569; font-size: 10px; line-height: 1.5; margin-top: 4px; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 700; color: #047857; }
    .doc-numero { font-size: 12px; color: #475569; margin-top: 2px; }
    .doc-dates { margin-top: 8px; font-size: 10px; color: #475569; }
    .parties { margin-top: 20px; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .block-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
    .strong { font-weight: 600; }
    .muted { color: #64748b; }
    .montant-box { margin-top: 22px; padding: 18px 20px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; text-align: center; }
    .montant-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #047857; font-weight: 600; }
    .montant-value { font-size: 26px; font-weight: 700; color: #065f46; margin-top: 4px; letter-spacing: -0.5px; }
    .montant-words { font-size: 11px; font-style: italic; color: #047857; margin-top: 6px; }
    table.recap { width: 100%; border-collapse: collapse; margin-top: 18px; }
    table.recap td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
    table.recap td.label { color: #64748b; width: 50%; }
    table.recap td.value { text-align: right; font-weight: 600; }
    .arrete { margin-top: 20px; padding: 12px 14px; background: #f8fafc; border-radius: 4px; font-size: 11px; color: #0f172a; font-style: italic; }
    .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #475569; display: flex; justify-content: space-between; }
    .sig { min-width: 200px; }
    .sig-line { margin-top: 36px; border-top: 1px solid #94a3b8; padding-top: 4px; text-align: center; font-size: 9px; color: #64748b; }
</style>
</head>
<body>
    <div class="header">
        <div style="display:flex;align-items:center;gap:14px;">
            ${COMPANY.logoDataUrl ? `<img src="${COMPANY.logoDataUrl}" style="max-height:56px;max-width:140px;object-fit:contain;" />` : ''}
            <div>
                <div class="company-name">${esc(COMPANY.nom)}</div>
                <div class="company-info">
                    ${esc(COMPANY.adresse)}<br/>
                    ${esc(COMPANY.telephone)} · ${esc(COMPANY.email)}
                    ${renderCustomFields()}
                </div>
            </div>
        </div>
        <div class="doc-meta">
            <div class="doc-title">REÇU DE PAIEMENT</div>
            <div class="doc-numero">${esc(numeroRecu)}</div>
            <div class="doc-dates">Émis le ${esc(formatDate(paiement.date))}</div>
        </div>
    </div>

    <div class="parties">
        <div class="block-title">Reçu de</div>
        <div class="strong">${esc(clientName)}</div>
        ${addrLine ? `<div>${esc(addrLine)}</div>` : ''}
        ${client?.email ? `<div>${esc(client.email)}</div>` : ''}
        ${client?.telephone ? `<div>${esc(client.telephone)}</div>` : ''}
    </div>

    <div class="montant-box">
        <div class="montant-label">Montant reçu</div>
        <div class="montant-value">${formatFCFA(paiement.montant)}</div>
        <div class="montant-words">${esc(numberToWordsFr(paiement.montant))} francs CFA</div>
    </div>

    <table class="recap">
        <tr>
            <td class="label">En règlement de la facture</td>
            <td class="value">${esc(facture.numero)}</td>
        </tr>
        <tr>
            <td class="label">Date du paiement</td>
            <td class="value">${esc(formatDate(paiement.date))}</td>
        </tr>
        <tr>
            <td class="label">Mode de paiement</td>
            <td class="value">${esc(modeLabel(paiement.mode))}</td>
        </tr>
        ${paiement.reference ? `
            <tr>
                <td class="label">Référence</td>
                <td class="value">${esc(paiement.reference)}</td>
            </tr>
        ` : ''}
        ${receveurName ? `
            <tr>
                <td class="label">Reçu par</td>
                <td class="value">${esc(receveurName)}</td>
            </tr>
        ` : ''}
        <tr>
            <td class="label">Total facture</td>
            <td class="value">${formatFCFA(totalFacture)}</td>
        </tr>
        <tr>
            <td class="label">Total déjà réglé (incluant ce paiement)</td>
            <td class="value">${formatFCFA(dejaPaye)}</td>
        </tr>
        <tr>
            <td class="label strong">Reste à payer</td>
            <td class="value" style="color: ${resteApres > 0 ? '#92400e' : '#065f46'};">${formatFCFA(resteApres)}</td>
        </tr>
    </table>

    ${paiement.notes ? `
        <div class="arrete">
            <strong>Note :</strong> ${esc(paiement.notes)}
        </div>
    ` : ''}

    <div class="footer">
        <div>
            Document généré le ${esc(formatDate(new Date().toISOString()))}
            ${emetteurName ? `<br/>Facture émise par ${esc(emetteurName)}` : ''}
        </div>
        <div class="sig">
            <div class="sig-line">${receveurName ? esc(receveurName) + ' — ' : ''}Signature / Cachet</div>
        </div>
    </div>
</body>
</html>`;
}

export function buildFactureHTML(facture: Facture, client: Client | undefined, adminLookup?: AdminLookup): string {
    const remiseAmount = facture.totalTTC - facture.totalApreRemise;
    const creatorName = adminLookup?.(facture.createdBy);
    const montantPayé = facture.montantPayé ?? 0;
    const montantRestant = facture.montantRestant ?? Math.max(0, facture.totalApreRemise - montantPayé);
    const soldee = montantRestant <= 0 && facture.totalApreRemise > 0;
    const showTVA = facture.afficherTVA !== false;
    const showTVALignes = showTVA && facture.afficherTVALignes !== false;
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(facture.numero)}</title>
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
    .doc-meta { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 700; color: #b91c1c; }
    .doc-numero { font-size: 12px; color: #475569; margin-top: 2px; }
    .doc-dates { margin-top: 8px; font-size: 10px; color: #475569; }
    .badge-soldee { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; background: #059669; color: white; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
    .parties { display: flex; gap: 16px; margin-top: 20px; margin-bottom: 16px; }
    .party { flex: 1; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .block-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
    .strong { font-weight: 600; }
    .muted { color: #64748b; }
    .small { font-size: 10px; }
    .section-title { margin-top: 18px; margin-bottom: 6px; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; }
    table.lignes, table.paiements { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    table.lignes th, table.paiements th { text-align: left; background: #f1f5f9; padding: 6px 8px; font-size: 9px; text-transform: uppercase; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    table.lignes td, table.paiements td { padding: 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .designation { text-align: left; width: 25%; }
    .right { text-align: right; }
    .center { text-align: center; }
    .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-box { min-width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 12px; }
    .totals-row.grand { background: #0f172a; color: white; font-weight: 700; font-size: 13px; padding: 10px 12px; border-radius: 4px; margin-top: 4px; }
    .totals-row.paye { color: #047857; }
    .totals-row.restant { background: #fef3c7; color: #92400e; font-weight: 700; padding: 8px 12px; border-radius: 4px; margin-top: 4px; }
    .totals-row.restant.zero { background: #d1fae5; color: #065f46; }
    .arrete { margin-top: 18px; padding: 12px 14px; background: #f8fafc; border-radius: 4px; font-size: 11px; color: #0f172a; font-style: italic; }
    .arrete .amount-words { font-weight: 700; text-transform: uppercase; font-style: normal; letter-spacing: 0.3px; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #475569; }
    .footer .label { font-weight: 600; color: #0f172a; margin-bottom: 4px; }
    .footer-section { margin-top: 10px; }
</style>
</head>
<body>
    <div class="header">
        <div style="display:flex;align-items:center;gap:14px;">
            ${COMPANY.logoDataUrl ? `<img src="${COMPANY.logoDataUrl}" style="max-height:56px;max-width:140px;object-fit:contain;" />` : ''}
            <div>
                <div class="company-name">${esc(COMPANY.nom)}</div>
                <div class="company-info">
                    ${esc(COMPANY.adresse)}<br/>
                    ${esc(COMPANY.telephone)} · ${esc(COMPANY.email)}
                    ${renderCustomFields()}
                </div>
            </div>
        </div>
        <div class="doc-meta">
            <div class="doc-title">FACTURE</div>
            <div class="doc-numero">${esc(facture.numero)}</div>
            <div class="doc-dates">
                Émise le ${esc(formatDate(facture.dateEmission))}<br/>
                Échéance ${esc(formatDate(facture.dateEcheance))}
                ${creatorName ? `<br/>Émise par ${esc(creatorName)}` : ''}
            </div>
            ${soldee ? '<div class="badge-soldee">SOLDÉE</div>' : ''}
        </div>
    </div>

    <div class="parties">
        <div class="party">
            ${renderClientBlock(client)}
        </div>
    </div>

    ${renderLignesTable(facture.lignes, showTVALignes)}

    <div class="totals">
        <div class="totals-box">
            <div class="totals-row"><span>Total HT</span><span>${formatFCFA(facture.totalHT)}</span></div>
            ${showTVA ? `<div class="totals-row"><span>TVA</span><span>${formatFCFA(facture.totalTVA)}</span></div>` : ''}
            <div class="totals-row"><span>Total TTC</span><span>${formatFCFA(facture.totalTTC)}</span></div>
            ${facture.remiseGlobale ? `
                <div class="totals-row muted"><span>Remise globale (${facture.remiseGlobale}%)</span><span>- ${formatFCFA(remiseAmount)}</span></div>
            ` : ''}
            <div class="totals-row grand"><span>Net à payer</span><span>${formatFCFA(facture.totalApreRemise)}</span></div>
            ${montantPayé > 0 ? `
                <div class="totals-row paye"><span>Déjà payé</span><span>- ${formatFCFA(montantPayé)}</span></div>
            ` : ''}
            <div class="totals-row restant ${montantRestant === 0 ? 'zero' : ''}"><span>Reste à payer</span><span>${formatFCFA(montantRestant)}</span></div>
        </div>
    </div>

    <div class="arrete">
        Arrêté la présente facture à la somme de
        <span class="amount-words">${esc(numberToWordsFr(facture.totalApreRemise))} francs CFA</span>
        (${esc(formatFCFA(facture.totalApreRemise))}) toutes taxes comprises.
    </div>

    ${renderPaiements(facture, adminLookup)}

    ${(facture.notes || COMPANY.notesFacture) || (facture.conditionsPaiement || COMPANY.conditionsPaiement) ? `
        <div class="footer">
            ${(facture.conditionsPaiement || COMPANY.conditionsPaiement) ? `
                <div class="footer-section">
                    <div class="label">Conditions de paiement</div>
                    <div>${esc(facture.conditionsPaiement || COMPANY.conditionsPaiement)}</div>
                </div>
            ` : ''}
            ${(facture.notes || COMPANY.notesFacture) ? `
                <div class="footer-section">
                    <div class="label">Notes</div>
                    <div>${esc(facture.notes || COMPANY.notesFacture)}</div>
                </div>
            ` : ''}
        </div>
    ` : ''}
</body>
</html>`;
}
