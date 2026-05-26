import { useState } from 'react';
import { Client, Facture } from '../Databases/db.d';
import { buildFactureHTML, buildFactureWhatsAppMessage } from '../libs/facture_pdf';
import { formatPhoneForWhatsApp } from '../libs/devis_pdf';
import { useAlerts } from './alerts';

type Props = {
    facture: Facture;
    client: Client | undefined;
    onClose: () => void;
    onMarkEmise?: (() => Promise<void> | void) | undefined;
};

type Mode = null | 'pdf' | 'whatsapp' | 'mark';

export default function FactureSendModal({ facture, client, onClose, onMarkEmise }: Props) {
    const { success, error: notifyError } = useAlerts();
    const [busy, setBusy] = useState<Mode>(null);

    const generatePdf = async (): Promise<string> => {
        const html = buildFactureHTML(facture, client);
        return await window.pdf.generateFacture(html, facture.numero);
    };

    const handlePdf = async () => {
        setBusy('pdf');
        try {
            const filePath = await generatePdf();
            await window.shell.openPath(filePath);
            success('PDF généré', facture.numero);
            onClose();
        } catch (err: any) {
            notifyError('Échec génération PDF', err?.message ?? 'Erreur.');
        } finally {
            setBusy(null);
        }
    };

    const handleWhatsApp = async () => {
        const phone = formatPhoneForWhatsApp(client?.telephone);
        if (!phone) {
            notifyError('Téléphone manquant', 'Le client n\'a pas de numéro de téléphone.');
            return;
        }
        setBusy('whatsapp');
        try {
            const filePath = await generatePdf();
            await window.shell.showItemInFolder(filePath);
            const msg = encodeURIComponent(buildFactureWhatsAppMessage(facture, client));
            await window.shell.openExternal(`https://wa.me/${phone}?text=${msg}`);
            success('WhatsApp ouvert', 'Attache le PDF depuis le dossier ouvert.');
            onClose();
        } catch (err: any) {
            notifyError('Échec partage WhatsApp', err?.message ?? 'Erreur.');
        } finally {
            setBusy(null);
        }
    };

    const handleMark = async () => {
        if (!onMarkEmise) return;
        setBusy('mark');
        try {
            await onMarkEmise();
            success('Facture émise', facture.numero);
            onClose();
        } catch (err: any) {
            notifyError('Échec', err?.message ?? 'Erreur.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
            >
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-semibold">Envoyer la facture</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{facture.numero} · {client?.nom ?? 'Client'}</p>
                </div>

                <div className="p-4 space-y-2">
                    <SendOption
                        title="Télécharger le PDF"
                        subtitle="Génère et ouvre le PDF de la facture"
                        onClick={handlePdf}
                        loading={busy === 'pdf'}
                        disabled={busy !== null}
                    />
                    <SendOption
                        title="Partager via WhatsApp"
                        subtitle="Génère le PDF + ouvre WhatsApp avec message pré-rempli"
                        onClick={handleWhatsApp}
                        loading={busy === 'whatsapp'}
                        disabled={busy !== null}
                        accent
                    />
                    {onMarkEmise && (
                        <SendOption
                            title="Juste marquer émise"
                            subtitle="Passe le brouillon en facture émise sans rien générer"
                            onClick={handleMark}
                            loading={busy === 'mark'}
                            disabled={busy !== null}
                            muted
                        />
                    )}
                </div>

                <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy !== null}
                        className="h-9 px-4 rounded-full text-sm hover:bg-slate-100 disabled:opacity-50"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
}

function SendOption({
    title, subtitle, onClick, loading, disabled, accent, muted,
}: {
    title: string;
    subtitle: string;
    onClick: () => void;
    loading: boolean;
    disabled: boolean;
    accent?: boolean;
    muted?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full text-left px-4 py-3 rounded-xl border transition disabled:opacity-50 ${
                accent
                    ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                    : muted
                        ? 'border-slate-200 bg-white hover:bg-slate-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{title}</div>
                {loading && <div className="text-xs text-gray-500">…</div>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
        </button>
    );
}
