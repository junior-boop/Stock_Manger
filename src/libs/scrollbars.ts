import { OverlayScrollbars } from 'overlayscrollbars';

const SELECTOR = '[data-os-scroll]';

const initialized = new WeakSet<Element>();

function attach(el: Element) {
    if (initialized.has(el)) return;
    if (!(el instanceof HTMLElement)) return;
    initialized.add(el);
    OverlayScrollbars(el, {
        scrollbars: {
            theme: 'os-theme-kataleya',
            autoHide: 'leave',
            autoHideDelay: 600,
            visibility: 'auto',
        },
        overflow: { x: 'scroll', y: 'scroll' },
    });
}

export function initGlobalScrollbars(): () => void {
    document.querySelectorAll(SELECTOR).forEach(attach);
    const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach((n) => {
                if (!(n instanceof Element)) return;
                if (n.matches(SELECTOR)) attach(n);
                n.querySelectorAll(SELECTOR).forEach(attach);
            });
        }
    });
    obs.observe(document.body, { subtree: true, childList: true });
    return () => obs.disconnect();
}
