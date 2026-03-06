import { useEffect } from 'react';

/**
 * Calls `callback` when the user presses the Escape key.
 *
 * Usage: call this inside any modal component so it closes on Escape.
 * The event listener is automatically cleaned up when the component unmounts.
 *
 * @param callback - Function to call on Escape keydown (typically the modal's onClose handler).
 * @param enabled  - When false the listener is not registered (e.g. when the modal is closed).
 *                   Defaults to true.
 */
export const useEscapeKey = (callback: () => void, enabled = true): void => {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                callback();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [callback, enabled]);
};
