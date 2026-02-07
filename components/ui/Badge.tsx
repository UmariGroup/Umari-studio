import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'blue' | 'violet' | 'indigo' | 'slate';
}

export function Badge({ children, className, variant = 'blue' }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                {
                    'bg-blue-50 text-blue-700 border border-blue-200': variant === 'blue',
                    'bg-violet-50 text-violet-700 border border-violet-200': variant === 'violet',
                    'bg-indigo-50 text-indigo-700 border border-indigo-200': variant === 'indigo',
                    'bg-slate-100 text-slate-700 border border-slate-200': variant === 'slate',
                },
                className
            )}
        >
            {children}
        </span>
    );
}
