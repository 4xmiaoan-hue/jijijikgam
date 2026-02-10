import React, { useMemo } from 'react';
import ScrollPanel from './ScrollPanel';
import tokens from '../../config/report_style_tokens.json';
import UserInfo from './visuals/UserInfo';
import SajuTable from './visuals/SajuTable';
import FiveElementsGraph from './visuals/FiveElementsGraph';
import DaewoonTimeline from './visuals/DaewoonTimeline';
import AnalysisCard from './visuals/AnalysisCard';
import { SajuResult } from '../../lib/saju-calculator';
import { enrichSajuPayload } from '../../lib/saju-payload';

interface WebtoonScrollReportProps {
    rawText: string;
    profile?: any;
    sajuResult?: SajuResult;
}

// Element Mapping
const ELEMENT_MAP: Record<string, 'wood' | 'fire' | 'earth' | 'metal' | 'water'> = {
    '갑': 'wood', '을': 'wood', '인': 'wood', '묘': 'wood',
    '병': 'fire', '정': 'fire', '사': 'fire', '오': 'fire',
    '무': 'earth', '기': 'earth', '진': 'earth', '술': 'earth', '축': 'earth', '미': 'earth',
    '경': 'metal', '신': 'metal', '신(申)': 'metal', '유': 'metal', // 신 is ambiguous (辛 vs 申), but usually defined by context. Here simplified.
    '임': 'water', '계': 'water', '해': 'water', '자': 'water'
};
// Handling 申 vs 辛: In pillars, we usually get "경신", "신유". 
// SajuResult pillars are like "갑자". 0=Stem, 1=Branch.
// Stem: 辛(Metal). Branch: 申(Metal). Both are Metal. So "신" is Metal anyway.

function calculateElements(saju?: SajuResult) {
    const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    if (!saju) return counts;

    const pillars = [saju.year_pillar, saju.month_pillar, saju.day_pillar, saju.hour_pillar];
    pillars.forEach(p => {
        if (!p || p.length < 2) return;
        [0, 1].forEach(i => {
            const char = p[i];
            const elem = ELEMENT_MAP[char];
            if (elem) counts[elem]++;
        });
    });
    return counts;
}

function getPillarColor(char: string) {
    const elem = ELEMENT_MAP[char];
    switch (elem) {
        case 'wood': return 'bg-green-100 text-green-800';
        case 'fire': return 'bg-red-100 text-red-800';
        case 'earth': return 'bg-amber-100 text-amber-800';
        case 'metal': return 'bg-gray-100 text-gray-800';
        case 'water': return 'bg-blue-100 text-blue-800';
        default: return 'bg-stone-100 text-stone-800';
    }
}

export default function WebtoonScrollReport({ rawText, profile, sajuResult }: WebtoonScrollReportProps) {
    // 1. Split Sections
    const sections = useMemo(() => {
        if (!rawText) return [];
        // Regex to match <SECTION_X>Title...
        const parts = rawText.split(/<SECTION_(\d+)>/g);
        // parts[0] is usually empty or pre-text
        // parts[1] is ID, parts[2] is Content, parts[3] is ID...
        const result = [];
        for (let i = 1; i < parts.length; i += 2) {
            const id = parseInt(parts[i]);
            const content = parts[i + 1];
            // Extract Title (usually first line or just after marker)
            // Assuming the AI follows "Marker Title\n" format somewhat, or we just take the block.
            // Actually the marker is removed by split.
            // Let's assume the first line might be the title if it's short.
            const lines = content.trim().split('\n');
            let title = "";
            let body = content;
            
            // Heuristic: If first line is short and looks like a title
            if (lines[0].length < 30) {
                title = lines[0];
                body = lines.slice(1).join('\n');
            } else {
                title = `Section ${id}`; // Fallback
            }

            result.push({ id, title, content: body.trim(), marker: `<SECTION_${id}>` });
        }
        return result;
    }, [rawText]);

    const enrichedSaju = useMemo(() => sajuResult ? enrichSajuPayload(sajuResult) : null, [sajuResult]);
    const elementCounts = useMemo(() => calculateElements(sajuResult), [sajuResult]);

    if (!sections.length) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center min-h-screen bg-stone-50">
                <p className="text-xl font-bold mb-4 text-stone-600 font-serif">리포트를 불러오는 중입니다...</p>
                <div className="animate-pulse w-16 h-16 rounded-full bg-stone-200"></div>
            </div>
        );
    }

    const mapPillar = (p: any, label: string) => ({
        gan: p.chun_kr,
        zhi: p.ji_kr,
        ganHanja: p.chun_hanja,
        zhiHanja: p.ji_hanja,
        label,
        color: getPillarColor(p.chun_kr) // Using stem color for simplicity or split? SajuTable handles styling?
        // Actually SajuTable expects one color per char? No, checking SajuTable:
        // It applies `pillar.color` to both circles. 
        // We might want distinct colors for Gan/Zhi in future, but for now apply Gan color or neutral.
    });

    return (
        <div className="w-full bg-stone-50 min-h-screen pb-20">
            {/* 1. Intro Panel with User Info */}
            <ScrollPanel className="bg-gradient-to-b from-amber-50 to-stone-50">
                {profile && (
                    <UserInfo 
                        name={profile.name}
                        birthDate={profile.birth_date_iso}
                        birthTime={profile.birth_time_slot || "시간 모름"}
                        gender={profile.gender || "unknown"}
                    />
                )}
                <div className="text-center mt-10 animate-bounce text-stone-400 text-sm">
                    아래로 스크롤하여 운세를 확인하세요
                    <br/>↓
                </div>
            </ScrollPanel>

            {/* 2. Sections Loop */}
            {sections.map((section) => (
                <ScrollPanel key={section.id}>
                    {/* Inject Visuals based on Section ID */}
                    
                    {/* Section 0: Summary */}
                    {section.id === 0 && (
                        <div className="mb-10">
                            {/* Summary Card is the AnalysisCard itself for Section 0 */}
                        </div>
                    )}

                    {/* Section 2: Structure (Saju Table + Elements) */}
                    {section.id === 2 && enrichedSaju && (
                        <div className="mb-12">
                            <SajuTable pillars={{
                                year: mapPillar(enrichedSaju.basic.year, "년주"),
                                month: mapPillar(enrichedSaju.basic.month, "월주"),
                                day: mapPillar(enrichedSaju.basic.day, "일주"),
                                hour: mapPillar(enrichedSaju.basic.hour, "시주"),
                            }} />
                            <FiveElementsGraph elements={elementCounts} />
                        </div>
                    )}

                    {/* Section 3: Timeline */}
                    {section.id === 3 && (
                        <div className="mb-12">
                            <DaewoonTimeline />
                        </div>
                    )}

                    {/* Text Content */}
                    <AnalysisCard 
                        title={section.title} 
                        content={section.content} 
                        marker={section.marker}
                        delay={0.2}
                    />
                </ScrollPanel>
            ))}

            {/* Footer */}
            <div className="text-center py-10 text-stone-400 text-xs font-sans">
                <p>지지직감 | AI Saju Report</p>
                <p className="mt-2">본 리포트는 AI 생성 결과로, 재미로만 봐주세요.</p>
            </div>
        </div>
    );
}
