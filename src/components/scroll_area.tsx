import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { ElementType, ComponentPropsWithoutRef } from 'react';

const OS_OPTIONS = {
    scrollbars: {
        theme: 'os-theme-kataleya',
        autoHide: 'leave' as const,
        autoHideDelay: 600,
        visibility: 'auto' as const,
    },
    overflow: { x: 'scroll' as const, y: 'scroll' as const },
};

type ScrollAreaProps<T extends ElementType = 'div'> = ComponentPropsWithoutRef<T> & {
    as?: T;
};

export default function ScrollArea<T extends ElementType = 'div'>({ as, ...rest }: ScrollAreaProps<T>) {
    return (
        <OverlayScrollbarsComponent
            element={as ?? 'div'}
            options={OS_OPTIONS}
            defer
            {...rest}
        />
    );
}
