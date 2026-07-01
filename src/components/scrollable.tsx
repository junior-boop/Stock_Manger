import { useEffect, useRef, type ReactNode, type HTMLAttributes } from 'react';
import { OverlayScrollbars } from 'overlayscrollbars';

export function Scrollable({ children, className, ...props }: { children?: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const os = OverlayScrollbars(el, {
            scrollbars: {
                theme: 'os-theme-kataleya',
                autoHide: 'leave',
                autoHideDelay: 600,
                visibility: 'auto',
            },
            overflow: { x: 'scroll', y: 'scroll' },
        });
        return () => os.destroy();
    }, []);

    return <div ref={ref} className={className} {...props}>{children}</div>;
}
