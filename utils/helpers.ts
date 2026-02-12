
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const normalizeMacAddress = (mac: string): string => {
    if (!mac) return '';
    // Refined to also handle dot notation (e.g., 0011.2233.4455)
    return mac.replace(/[:\-.]/g, '').toUpperCase();
};
