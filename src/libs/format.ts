export function formatFCFA(n: number): string {
    return `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
}

export function formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function toDateInput(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export function fromDateInput(value: string): string {
    return new Date(value + 'T00:00:00.000Z').toISOString();
}

const UNITS: string[] = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS: string[] = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

const u = (n: number): string => UNITS[n] ?? '';
const t = (n: number): string => TENS[n] ?? '';

function under100(n: number): string {
    if (n < 20) return u(n);
    const ti = Math.floor(n / 10);
    const ui = n % 10;
    if (ti === 7 || ti === 9) {
        const rest = 10 + ui;
        const sep = ti === 7 && rest === 11 ? '-et-' : '-';
        return `${t(ti)}${sep}${u(rest)}`;
    }
    if (ui === 0) return ti === 8 ? 'quatre-vingts' : t(ti);
    if (ui === 1 && ti !== 8) return `${t(ti)} et un`;
    return `${t(ti)}-${u(ui)}`;
}

function under1000(n: number): string {
    if (n === 0) return '';
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h > 0) {
        if (h === 1) parts.push('cent');
        else parts.push(`${u(h)} cent${r === 0 ? 's' : ''}`);
    }
    if (r > 0) parts.push(under100(r));
    return parts.join(' ');
}

export function numberToWordsFr(n: number): string {
    const x = Math.abs(Math.round(n));
    if (x === 0) return 'zéro';
    const millions = Math.floor(x / 1_000_000);
    const thousands = Math.floor((x % 1_000_000) / 1000);
    const rest = x % 1000;
    const parts: string[] = [];
    if (millions > 0) {
        parts.push(millions === 1 ? 'un million' : `${under1000(millions)} millions`);
    }
    if (thousands > 0) {
        parts.push(thousands === 1 ? 'mille' : `${under1000(thousands)} mille`);
    }
    if (rest > 0) parts.push(under1000(rest));
    return parts.join(' ');
}
