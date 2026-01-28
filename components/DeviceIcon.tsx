

import React from 'react';

interface DeviceIconProps {
    type: 'desktop' | 'laptop';
}

export const DeviceIcon: React.FC<DeviceIconProps> = ({ type }) => {
    const className = "h-5 w-5 text-slate-400 flex-shrink-0";
    const title = type.charAt(0).toUpperCase() + type.slice(1);
    
    if (type === 'laptop') {
        return (
            // FIX: Replaced invalid title attribute and redundant aria-label with a <title> element for SVG accessibility and to fix TS error.
            <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <title>{title}</title>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        );
    }

    return (
        // FIX: Replaced invalid title attribute and redundant aria-label with a <title> element for SVG accessibility and to fix TS error.
         <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <title>{title}</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M5 17h14M5 21h14M12 5v.01M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
        </svg>
    );
};