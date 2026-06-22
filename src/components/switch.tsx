type Props = {
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    'aria-label'?: string;
};

export default function Switch({ checked, onChange, disabled, ...rest }: Props) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={rest['aria-label']}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onChange(!checked);
            }}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                checked ? 'bg-slate-900' : 'bg-slate-300'
            }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    checked ? 'translate-x-4' : 'translate-x-0.5'
                }`}
            />
        </button>
    );
}
