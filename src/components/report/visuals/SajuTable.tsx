
import React from 'react';
import { motion } from 'framer-motion';

interface Pillar {
    gan: string;
    zhi: string;
    ganHanja: string;
    zhiHanja: string;
    label: string;
    color: string; // e.g., 'bg-green-100 text-green-800'
}

interface SajuTableProps {
    pillars: {
        year: Pillar;
        month: Pillar;
        day: Pillar;
        hour: Pillar;
    };
}

const PillarCard = ({ pillar, delay }: { pillar: Pillar; delay: number }) => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay }}
        viewport={{ once: true }}
        className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm border border-stone-100"
    >
        <span className="text-xs text-stone-400 mb-2 font-sans">{pillar.label}</span>
        <div className={`w-10 h-10 flex items-center justify-center rounded-full ${pillar.color} mb-1 font-serif text-lg font-bold shadow-inner`}>
            {pillar.ganHanja}
        </div>
        <div className={`w-10 h-10 flex items-center justify-center rounded-full ${pillar.color} font-serif text-lg font-bold shadow-inner`}>
            {pillar.zhiHanja}
        </div>
        <div className="mt-2 text-xs text-stone-500 font-medium">
            {pillar.gan}{pillar.zhi}
        </div>
    </motion.div>
);

export default function SajuTable({ pillars }: SajuTableProps) {
    return (
        <div className="w-full max-w-lg mx-auto my-8">
            <h3 className="text-center text-stone-600 font-serif mb-4 text-lg">사주 원국 (四柱 原局)</h3>
            <div className="grid grid-cols-4 gap-2 sm:gap-4 px-2">
                <PillarCard pillar={pillars.hour} delay={0.1} />
                <PillarCard pillar={pillars.day} delay={0.2} />
                <PillarCard pillar={pillars.month} delay={0.3} />
                <PillarCard pillar={pillars.year} delay={0.4} />
            </div>
        </div>
    );
}
