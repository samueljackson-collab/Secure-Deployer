
import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const positionClasses: Record<NonNullable<TooltipProps['position']>, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses: Record<NonNullable<TooltipProps['position']>, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-700',
};

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
    const [visible, setVisible] = useState(false);

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            onFocus={() => setVisible(true)}
            onBlur={() => setVisible(false)}
        >
            {children}
            {visible && (
                <div
                    role="tooltip"
                    className={`absolute z-50 pointer-events-none ${positionClasses[position]}`}
                >
                    <div className="bg-gray-950 border border-gray-700 rounded-md shadow-xl px-3 py-2 text-xs text-gray-200 whitespace-nowrap max-w-xs text-center leading-relaxed">
                        {content}
                    </div>
                    <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
                </div>
            )}
        </div>
    );
};

export const InfoIcon: React.FC<{ tooltip: string; position?: TooltipProps['position'] }> = ({ tooltip, position = 'top' }) => (
    <Tooltip content={tooltip} position={position}>
        <span
            className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-gray-500 hover:text-gray-300 cursor-help rounded-full border border-gray-600 hover:border-gray-400 transition-colors select-none"
            aria-label={`Info: ${tooltip}`}
        >
            i
        </span>
    </Tooltip>
);
