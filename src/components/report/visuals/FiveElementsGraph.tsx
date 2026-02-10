
import React from 'react';
import { motion } from 'framer-motion';

interface FiveElementsGraphProps {
    elements: {
        wood: number;
        fire: number;
        earth: number;
        metal: number;
        water: number;
    };
}

const ELEMENT_CONFIG = {
    wood: { label: '목(木)', color: '#4ADE80', bg: 'bg-green-500' },   // Green
    fire: { label: '화(火)', color: '#F87171', bg: 'bg-red-500' },     // Red
    earth: { label: '토(土)', color: '#FBBF24', bg: 'bg-amber-400' },  // Yellow
    metal: { label: '금(金)', color: '#9CA3AF', bg: 'bg-gray-400' },   // White/Gray
    water: { label: '수(水)', color: '#60A5FA', bg: 'bg-blue-400' },   // Black/Blue
};

export default function FiveElementsGraph({ elements }: FiveElementsGraphProps) {
    const total = Object.values(elements).reduce((a, b) => a + b, 0) || 1;

    return (
        <div className="w-full max-w-md mx-auto my-10 bg-white/50 backdrop-blur-sm rounded-xl p-6 shadow-sm border border-stone-100">
            <h3 className="text-center text-stone-700 font-serif mb-6 text-lg">오행 분포 (五行)</h3>
            <div className="space-y-4">
                {(Object.keys(ELEMENT_CONFIG) as Array<keyof typeof elements>).map((key, index) => {
                    const count = elements[key];
                    const percent = (count / total) * 100;
                    const config = ELEMENT_CONFIG[key];

                    return (
                        <div key={key} className="flex items-center gap-3">
                            <span className="w-10 text-sm font-medium text-stone-600 font-serif">{config.label}</span>
                            <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${percent}%` }}
                                    transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                                    className={`h-full rounded-full ${config.bg}`}
                                />
                            </div>
                            <span className="w-6 text-xs text-stone-400 text-right">{count}</span>
                        </div>
                    );
                })}
            </div>
            <p className="text-center text-xs text-stone-400 mt-4 font-sans">
                오행의 균형을 통해 나의 기질을 파악합니다.
            </p>
        </div>
    );
}
