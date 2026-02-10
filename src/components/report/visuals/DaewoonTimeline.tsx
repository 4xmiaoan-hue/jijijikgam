
import React from 'react';
import { motion } from 'framer-motion';

export default function DaewoonTimeline() {
    // Placeholder data for Minsu
    const milestones = [
        { age: 6, label: '초년운', desc: '학업과 성장의 시기' },
        { age: 16, label: '청년운', desc: '진로 탐색과 도전' },
        { age: 26, label: '현재', desc: '직업적 안정을 찾는 시기', current: true },
        { age: 36, label: '중년운', desc: '결실을 맺는 황금기' },
        { age: 46, label: '장년운', desc: '명예와 안정을 누림' },
    ];

    return (
        <div className="w-full max-w-lg mx-auto my-12 px-4">
            <h3 className="text-center text-stone-700 font-serif mb-8 text-xl">인생의 큰 흐름 (大運)</h3>
            <div className="relative border-l-2 border-stone-200 ml-4 md:ml-6 space-y-8">
                {milestones.map((m, i) => (
                    <motion.div 
                        key={m.age}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        viewport={{ once: true }}
                        className="relative pl-6 md:pl-8"
                    >
                        {/* Dot */}
                        <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${m.current ? 'bg-amber-500 border-amber-200 scale-125 shadow-lg' : 'bg-white border-stone-300'}`} />
                        
                        <div className={`p-4 rounded-lg ${m.current ? 'bg-amber-50 border border-amber-100 shadow-md' : 'bg-white/60 border border-stone-100'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-lg font-bold font-serif ${m.current ? 'text-amber-700' : 'text-stone-600'}`}>
                                    {m.age}세
                                </span>
                                {m.current && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">Current</span>}
                            </div>
                            <h4 className="font-medium text-stone-800 font-sans mb-1">{m.label}</h4>
                            <p className="text-sm text-stone-500 leading-relaxed font-sans">{m.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
