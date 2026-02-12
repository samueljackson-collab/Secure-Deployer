
import React from 'react';
import type { DeviceFormFactor } from '../types';

interface DeviceIconProps {
    type: DeviceFormFactor;
}

export const icons: Record<DeviceFormFactor, { title: string; path: React.ReactNode; className: string; }> = {
    'laptop-14': {
        title: 'Laptop 14"',
        className: 'text-blue-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    },
    'laptop-16': {
        title: 'Laptop 16"',
        className: 'text-indigo-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    },
    'detachable': {
        title: 'Detachable Laptop',
        className: 'text-teal-400',
        path: <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 7a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h8" />
        </>
    },
    'laptop': {
        title: 'Laptop',
        className: 'text-slate-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    },
    'sff': {
        title: 'Small Form Factor',
        className: 'text-emerald-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M5 17h14M5 21h14M12 5v.01M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2-2H7a2 2 0 01-2-2V5z" />
    },
    'micro': {
        title: 'Micro Form Factor',
        className: 'text-amber-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M2 7h12v10H2zM14 7h6v10h-6zM7 2v5M17 2v5" />
    },
    'tower': {
        title: 'Tower',
        className: 'text-orange-400',
        path: <>
             <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M5 17h14M5 21h14M12 5v.01M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2-2H7a2 2 0 01-2-2V5z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6" />
        </>
    },
    'wyse': {
        title: 'Wyse Thin Client',
        className: 'text-cyan-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M2 7h12v10H2zM14 7h6v10h-6zM7 2v5M17 2v5" />
    },
    'vdi': {
        title: 'VDI Client',
        className: 'text-violet-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l-7 7 7 7" />
    },
    'desktop': {
        title: 'Desktop',
        className: 'text-slate-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M5 17h14M5 21h14M12 5v.01M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2-2H7a2 2 0 01-2-2V5z" />
    }
};

export const DeviceIcon: React.FC<DeviceIconProps> = ({ type }) => {
    const icon = icons[type] || icons.desktop;
    const baseClassName = "h-5 w-5 flex-shrink-0";
    
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={`${baseClassName} ${icon.className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <title>{icon.title}</title>
            {icon.path}
        </svg>
    );
};
