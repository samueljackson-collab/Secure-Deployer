
import React from 'react';

interface StepCardProps {
    step: string;
    title: string;
    description: string;
    children: React.ReactNode;
}

export const StepCard: React.FC<StepCardProps> = React.memo(({ step, title, description, children }) => {
    return (
        <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-[#39FF14] rounded-full flex items-center justify-center font-bold text-black">
                {step}
            </div>
            <div className="flex-grow">
                <h3 className="font-semibold text-gray-100">{title}</h3>
                <p className="text-sm text-gray-400 font-bold mb-3">{description}</p>
                {children}
            </div>
        </div>
    );
});
