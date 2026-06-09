/// <reference lib="webworker" />
import * as XLSX from "xlsx";

type ColumnMapping = {
    nom: number;
    ref: number;
    description: number;
    unite: number;
    prixHT: number;
    tauxTVA: number;
    prix: number;
    dimensions: number;
    stock: number;
};

type ParsedItem = {
    key: string;
    nom: string;
    reference: string;
    description: string;
    unite: string;
    prixHT: number;
    tauxTVA: number;
    prixTTC: number;
    stockTotal: number;
    longueur: number;
    largeur: number;
    hauteur: number;
    collectionId: string;
    sousCollectionId: string;
};

type InMsg =
    | { id: number; type: "parse"; buffer: ArrayBuffer }
    | { id: number; type: "build"; rows: unknown[][]; mapping: ColumnMapping; extractDims: boolean };

type OutMsg =
    | { id: number; type: "parse"; ok: true; headers: string[]; rows: unknown[][]; detected: ColumnMapping }
    | { id: number; type: "build"; ok: true; items: ParsedItem[] }
    | { id: number; ok: false; error: string };

function detectColumns(headers: string[]): ColumnMapping {
    const norm = headers.map((h) => String(h || "").toLowerCase().trim());
    const findExact = (...patterns: string[]) =>
        norm.findIndex((h) => patterns.some((p) => h === p));
    const find = (...patterns: string[]) =>
        norm.findIndex((h) => patterns.some((p) => h.includes(p)));
    const nom = findExact("nom") >= 0 ? findExact("nom") : find("nom du produit", "produit", "désignation", "designation", "nom");
    const ref = find("référence", "reference", "réf", "ref", "code");
    const description = find("description", "libellé", "libelle");
    const unite = find("unité", "unite");
    const prixHT = find("prix ht", "prixht", "ht");
    const tauxTVA = find("taux tva", "tva");
    const prixExact = findExact("prix ttc", "prix");
    const prix = prixExact >= 0 ? prixExact : find("prix ttc", "ttc", "tarif", "montant", "prix");
    const dimensions = find("dimensions", "dimension");
    const stock = find("stock", "quantité", "quantite", "qte");
    return { nom, ref, description, unite, prixHT, tauxTVA, prix, dimensions, stock };
}

function extractDimensionsFromName(name: string): { longueur: number; largeur: number; hauteur: number; cleaned: string } {
    const re = /(\d+(?:[.,]\d+)?)\s*[x×\/]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×\/]\s*(\d+(?:[.,]\d+)?))?\s*(cm|mm)/i;
    const m = name.match(re);
    if (!m) return { longueur: 0, largeur: 0, hauteur: 0, cleaned: name.trim() };
    const a = parseFloat((m[1] ?? "0").replace(",", "."));
    const b = parseFloat((m[2] ?? "0").replace(",", "."));
    const c = m[3] ? parseFloat(m[3].replace(",", ".")) : 0;
    const unit = (m[4] ?? "cm").toLowerCase();
    const factor = unit === "mm" ? 0.1 : 1;
    const cleaned = name.replace(re, "").replace(/\s{2,}/g, " ").replace(/\s*[-–—,]\s*$/, "").trim();
    return { longueur: a * factor, largeur: b * factor, hauteur: c * factor, cleaned };
}

function toNumber(v: unknown): number {
    if (typeof v === "number") return v;
    const s = String(v ?? "").replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

function looksLikeReference(v: string): boolean {
    const t = v.trim();
    if (!t || t.length > 30) return false;
    return /^[A-Z0-9_\-\s]{2,}$/.test(t);
}

self.onmessage = (e: MessageEvent<InMsg>) => {
    const msg = e.data;
    try {
        if (msg.type === "parse") {
            const wb = XLSX.read(msg.buffer, { type: "array" });
            const firstSheetName = wb.SheetNames[0];
            if (!firstSheetName) throw new Error("Aucune feuille trouvée.");
            const sheet = wb.Sheets[firstSheetName];
            if (!sheet) throw new Error("Feuille introuvable.");
            const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
            if (rows.length < 2) throw new Error("Aucune ligne détectée dans le fichier.");
            const headers = (rows[0] as unknown[]).map((c) => String(c ?? ""));
            const dataRows = rows.slice(1) as unknown[][];
            const detected = detectColumns(headers);
            const out: OutMsg = { id: msg.id, type: "parse", ok: true, headers, rows: dataRows, detected };
            (self as unknown as Worker).postMessage(out);
            return;
        }
        if (msg.type === "build") {
            const { rows, mapping, extractDims } = msg;
            const parsed: ParsedItem[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i] as unknown[];
                const rawNom = String(r[mapping.nom] ?? "").trim();
                if (!rawNom) continue;
                let nom = rawNom;
                let longueur = 0, largeur = 0, hauteur = 0;
                if (extractDims) {
                    const ext = extractDimensionsFromName(rawNom);
                    nom = ext.cleaned || rawNom;
                    longueur = ext.longueur;
                    largeur = ext.largeur;
                    hauteur = ext.hauteur;
                }
                const rawRef = mapping.ref >= 0 ? String(r[mapping.ref] ?? "").trim() : "";
                const reference = looksLikeReference(rawRef) ? rawRef : "";
                const description = mapping.description >= 0 ? String(r[mapping.description] ?? "").trim() : "";
                const unite = mapping.unite >= 0 ? String(r[mapping.unite] ?? "").trim() : "";
                const prixHT = mapping.prixHT >= 0 ? toNumber(r[mapping.prixHT]) : 0;
                const tauxTVA = mapping.tauxTVA >= 0 ? toNumber(r[mapping.tauxTVA]) : 0;
                const prixTTC = mapping.prix >= 0 ? toNumber(r[mapping.prix]) : 0;
                const stockTotal = mapping.stock >= 0 ? Math.round(toNumber(r[mapping.stock])) : 0;
                if (mapping.dimensions >= 0) {
                    const dimRaw = String(r[mapping.dimensions] ?? "").trim();
                    if (dimRaw) {
                        const ext = extractDimensionsFromName(dimRaw);
                        if (ext.longueur || ext.largeur || ext.hauteur) {
                            longueur = ext.longueur;
                            largeur = ext.largeur;
                            hauteur = ext.hauteur;
                        }
                    }
                }
                parsed.push({
                    key: `row-${i}`,
                    nom,
                    reference,
                    description,
                    unite,
                    prixHT,
                    tauxTVA,
                    prixTTC,
                    stockTotal,
                    longueur,
                    largeur,
                    hauteur,
                    collectionId: "",
                    sousCollectionId: "",
                });
            }
            const out: OutMsg = { id: msg.id, type: "build", ok: true, items: parsed };
            (self as unknown as Worker).postMessage(out);
            return;
        }
    } catch (err) {
        const out: OutMsg = { id: (msg as { id: number }).id, ok: false, error: err instanceof Error ? err.message : String(err) };
        (self as unknown as Worker).postMessage(out);
    }
};

