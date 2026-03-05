import React, { useEffect, useRef } from 'react';
import type { Device } from '../types';

interface DeviceContextMenuProps {
    device: Device;
    position: { x: number; y: number };
    onClose: () => void;
}

export const DeviceContextMenu: React.FC<DeviceContextMenuProps> = ({ device, position, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleCopy = (text: string | undefined) => {
        if (text) {
            navigator.clipboard.writeText(text);
        }
        onClose();
    };

    const menuItems = [
        { label: 'Hostname', value: device.hostname },
        { label: 'MAC Address', value: device.mac },
        { label: 'IP Address', value: device.ipAddress },
        { label: 'Serial #', value: device.serialNumber },
        { label: 'Asset Tag', value: device.assetTag },
        { label: 'Model', value: device.model },
    ];

    return (
        <div
            ref={menuRef}
            className="absolute z-50 w-64 bg-gray-950 rounded-lg shadow-2xl border border-gray-800 text-sm"
            style={{ top: position.y, left: position.x }}
        >
            <div className="p-2 border-b border-gray-800">
                <p className="font-bold text-gray-200">{device.hostname}</p>
                <p className="text-xs text-gray-500">Device Info (Click to copy)</p>
            </div>
            <ul className="py-1">
                {menuItems.map(item => (
                    item.value ? (
                        <li
                            key={item.label}
                            onClick={() => handleCopy(item.value)}
                            className="px-3 py-2 flex justify-between items-center text-gray-300 hover:bg-gray-800 cursor-pointer"
                        >
                            <span className="font-semibold">{item.label}</span>
                            <span className="font-mono text-gray-400">{item.value}</span>
                        </li>
                    ) : null
                ))}
            </ul>
        </div>
    );
};
