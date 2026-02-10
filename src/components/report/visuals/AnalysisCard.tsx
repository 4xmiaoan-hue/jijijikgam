
import React from 'react';
import { motion } from 'framer-motion';

interface AnalysisCardProps {
    title: string;
    content: string;
    marker?: string;
    delay?: number;
}

export default function AnalysisCard({ title, content, marker, delay = 0 }: AnalysisCardProps) {
    // Process content to handle bolding or simple formatting if needed
    // Assuming content is mostly plain text from the prompt generation

    // Helper to detect if this is a "Summary" section to style differently
    const isSummary = marker === '<SECTION_0>';
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease: "easeOut" }}
            viewport={{ once: true, margin: "-100px" }}
            className={`w-full max-w-xl mx-auto mb-16 p-6 md:p-10 rounded-2xl shadow-sm border 
                ${isSummary 
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 shadow-md' 
                    : 'bg-white/80 backdrop-blur-md border-stone-100'
                }`}
        >
            <div className="flex flex-col items-center mb-6">
                <span className="w-10 h-1 bg-stone-200 rounded-full mb-4"></span>
                <h2 className={`text-2xl md:text-3xl font-bold text-center font-serif leading-tight
                    ${isSummary ? 'text-amber-900' : 'text-stone-800'}`}>
                    {title}
                </h2>
            </div>

            <div className={`prose prose-stone prose-lg md:prose-xl max-w-none font-serif leading-loose text-justify
                ${isSummary ? 'text-stone-800' : 'text-stone-700'}`}>
                {content.split('\n').map((line, i) => (
                    line.trim() ? (
                        <p key={i} className="mb-4 last:mb-0">
                            {line}
                        </p>
                    ) : <br key={i}/>
                ))}
            </div>
        </motion.div>
    );
}
