
import React from 'react';
import { motion } from 'framer-motion';

interface UserInfoProps {
    name: string;
    birthDate: string; // YYYY-MM-DD
    birthTime: string;
    gender: string;
}

export default function UserInfo({ name, birthDate, birthTime, gender }: UserInfoProps) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 mb-8 border border-stone-200"
        >
            <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4 text-2xl shadow-inner">
                    {gender === 'female' ? '👩' : '👨'}
                </div>
                <h2 className="text-2xl font-bold text-stone-800 mb-1 font-serif">{name} 님</h2>
                <p className="text-stone-500 text-sm mb-4 font-sans">
                    {birthDate.split('-')[0]}년 {birthDate.split('-')[1]}월 {birthDate.split('-')[2]}일 · {birthTime}
                </p>
                <div className="h-px w-20 bg-stone-300 my-2"></div>
                <span className="text-xs text-stone-400 tracking-widest uppercase mt-1">Saju Report</span>
            </div>
        </motion.div>
    );
}
