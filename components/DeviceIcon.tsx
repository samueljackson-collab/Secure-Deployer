/**
 * DeviceIcon.tsx
 *
 * Renders a form-factor-specific SVG icon for each Dell business device type.
 * Icons are intentionally distinct so operators can visually differentiate
 * device categories at a glance in the Device Status Table and Image Monitor.
 *
 * Supported form factors (mapped from DeviceFormFactor in types.ts):
 *   laptop-14    - Standard 14" Latitude clamshell
 *   laptop-16    - Pro 16" Latitude / Precision mobile workstation
 *   detachable   - 2-in-1 detachable tablet (Latitude 7350 Detachable)
 *   laptop       - Generic laptop fallback
 *   sff          - Standard Form Factor desktop (OptiPlex SFF)
 *   micro        - Micro Form Factor desktop (OptiPlex Micro)
 *   tower        - Tower desktop (OptiPlex Tower / Precision Tower)
 *   wyse         - Wyse Thin Client
 *   vdi          - Virtual Desktop Infrastructure endpoint
 *   desktop      - Generic desktop fallback
 */

import React from 'react';
import type { DeviceFormFactor } from '../types';

interface DeviceIconProps {
    type: DeviceFormFactor;
}

/** Human-readable label used for the SVG <title> (accessibility). */
const FORM_FACTOR_LABELS: Record<DeviceFormFactor, string> = {
    'laptop-14':  'Standard 14″ Laptop',
    'laptop-16':  'Pro 16″ Laptop',
    'detachable': 'Detachable 2-in-1',
    'laptop':     'Laptop',
    'sff':        'Small Form Factor Desktop',
    'micro':      'Micro Form Factor Desktop',
    'tower':      'Tower Desktop',
    'wyse':       'Wyse Thin Client',
    'vdi':        'Virtual Desktop (VDI)',
    'desktop':    'Desktop',
};

export const DeviceIcon: React.FC<DeviceIconProps> = ({ type }) => {
    const base = 'h-5 w-5 flex-shrink-0';
    const label = FORM_FACTOR_LABELS[type] ?? 'Device';

    switch (type) {
        // ----------------------------------------------------------------
        // Standard 14" Laptop  –  slim clamshell silhouette
        // ----------------------------------------------------------------
        case 'laptop-14':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-blue-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    <rect x="4" y="3" width="16" height="11" rx="1.5" />
                    <path strokeLinecap="round" d="M2 18h20" />
                    <path strokeLinecap="round" d="M9 20h6" />
                    <text x="12" y="10.5" textAnchor="middle" fill="currentColor" fontSize="4" fontWeight="bold" stroke="none">14</text>
                </svg>
            );

        // ----------------------------------------------------------------
        // Pro 16" Laptop  –  wider body with accent mark
        // ----------------------------------------------------------------
        case 'laptop-16':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-indigo-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    <rect x="3" y="2.5" width="18" height="12" rx="1.5" />
                    <path strokeLinecap="round" d="M1 18.5h22" />
                    <path strokeLinecap="round" d="M8.5 20.5h7" />
                    <text x="12" y="10.5" textAnchor="middle" fill="currentColor" fontSize="4" fontWeight="bold" stroke="none">16</text>
                </svg>
            );

        // ----------------------------------------------------------------
        // Detachable 2-in-1  –  tablet with detached keyboard hint
        // ----------------------------------------------------------------
        case 'detachable':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-teal-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    {/* Tablet body */}
                    <rect x="5" y="2" width="14" height="13" rx="1.5" />
                    {/* Camera dot */}
                    <circle cx="12" cy="4" r="0.5" fill="currentColor" stroke="none" />
                    {/* Detach gap */}
                    <path strokeLinecap="round" strokeDasharray="2 1.5" d="M5 17h14" />
                    {/* Keyboard base */}
                    <rect x="4" y="18" width="16" height="3" rx="1" />
                    <path strokeLinecap="round" d="M7 19.5h10" />
                </svg>
            );

        // ----------------------------------------------------------------
        // Generic Laptop fallback  –  simple clamshell
        // ----------------------------------------------------------------
        case 'laptop':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-slate-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            );

        // ----------------------------------------------------------------
        // SFF Desktop  –  short wide box with monitor on top
        // ----------------------------------------------------------------
        case 'sff':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-emerald-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    {/* Monitor */}
                    <rect x="3" y="2" width="18" height="11" rx="1" />
                    <path strokeLinecap="round" d="M10 13v2h4v-2" />
                    {/* SFF chassis below */}
                    <rect x="6" y="16" width="12" height="5" rx="0.75" />
                    <path strokeLinecap="round" d="M8.5 18.5h3" />
                    <circle cx="16" cy="18.5" r="0.6" fill="currentColor" stroke="none" />
                </svg>
            );

        // ----------------------------------------------------------------
        // Micro Form Factor  –  tiny square box, very compact
        // ----------------------------------------------------------------
        case 'micro':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-amber-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    {/* Monitor */}
                    <rect x="3" y="2" width="18" height="11" rx="1" />
                    <path strokeLinecap="round" d="M10 13v2h4v-2" />
                    {/* Micro chassis - very small box */}
                    <rect x="8" y="16.5" width="5" height="4.5" rx="0.75" />
                    <circle cx="10.5" cy="18.5" r="0.5" fill="currentColor" stroke="none" />
                    {/* VESA mount hint */}
                    <path strokeLinecap="round" strokeDasharray="1 1" d="M13.5 18.5h3" />
                </svg>
            );

        // ----------------------------------------------------------------
        // Tower  –  tall vertical chassis beside a monitor
        // ----------------------------------------------------------------
        case 'tower':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-orange-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    {/* Monitor */}
                    <rect x="1" y="3" width="14" height="10" rx="1" />
                    <path strokeLinecap="round" d="M6 13v2h4v-2" />
                    <path strokeLinecap="round" d="M4 17h8" />
                    {/* Tower chassis */}
                    <rect x="17" y="2" width="6" height="16" rx="0.75" />
                    <circle cx="20" cy="4.5" r="0.6" fill="currentColor" stroke="none" />
                    <path strokeLinecap="round" d="M18.5 7h3" />
                    <rect x="18.5" y="9" width="3" height="4" rx="0.5" />
                    {/* Feet */}
                    <path strokeLinecap="round" d="M17.5 19h5" />
                </svg>
            );

        // ----------------------------------------------------------------
        // Wyse Thin Client  –  slim vertical box with antenna hint
        // ----------------------------------------------------------------
        case 'wyse':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-cyan-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    {/* Slim vertical chassis */}
                    <rect x="7" y="4" width="10" height="14" rx="1" />
                    {/* Dell/Wyse logo area */}
                    <circle cx="12" cy="8" r="1.5" />
                    {/* Ventilation lines */}
                    <path strokeLinecap="round" d="M9.5 12h5" />
                    <path strokeLinecap="round" d="M9.5 13.5h5" />
                    <path strokeLinecap="round" d="M9.5 15h5" />
                    {/* Stand */}
                    <path strokeLinecap="round" d="M8 19h8" />
                    <path strokeLinecap="round" d="M12 18v1" />
                    {/* Status LED */}
                    <circle cx="12" cy="5.5" r="0.4" fill="currentColor" stroke="none" />
                </svg>
            );

        // ----------------------------------------------------------------
        // VDI  –  cloud/monitor hybrid icon
        // ----------------------------------------------------------------
        case 'vdi':
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-violet-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    {/* Monitor */}
                    <rect x="4" y="7" width="16" height="10" rx="1" />
                    <path strokeLinecap="round" d="M10 17v2h4v-2" />
                    <path strokeLinecap="round" d="M8 20h8" />
                    {/* Cloud icon above monitor */}
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 6a3 3 0 015-2.24A3 3 0 0118 5.5h.5A2 2 0 0118.5 9H7a2.5 2.5 0 011-3z" />
                    {/* Connection line */}
                    <path strokeLinecap="round" strokeDasharray="1.5 1" d="M12 9v3" />
                </svg>
            );

        // ----------------------------------------------------------------
        // Generic Desktop fallback  –  monitor with tower hint
        // ----------------------------------------------------------------
        case 'desktop':
        default:
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className={`${base} text-slate-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <title>{label}</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 11h14M5 17h14M5 21h14M12 5v.01M5 5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                </svg>
            );
    }
};
