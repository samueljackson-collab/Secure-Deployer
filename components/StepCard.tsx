
import React from 'react';

interface StepCardProps {
    step: string;
    title: string;
    description: string;
    children: React.ReactNode;
}

export const StepCard: React.FC<StepCardProps> = ({ step, title, description, children }) => {
    return (
        <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center font-bold text-white">
                {step}
            </div>
            <div className="flex-grow">
                <h3 className="font-semibold text-slate-100">{title}</h3>
                <p className="text-sm text-slate-400 mb-3">{description}</p>
                {children}
            </div>
        </div>
    );
};
