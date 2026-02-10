import { SajuResult } from './saju-calculator';
import { EnrichedSajuPayload } from './saju-types';
import { analyzeSaju } from './saju-analyzer';

// Helper to map Korean characters to Hanja
const STEM_HANJA: Record<string, string> = {
    "갑": "甲", "을": "乙", "병": "丙", "정": "丁", "무": "戊", "기": "己", "경": "庚", "신": "辛", "임": "壬", "계": "癸"
};

const BRANCH_HANJA: Record<string, string> = {
    "자": "子", "축": "丑", "인": "寅", "묘": "卯", "진": "辰", "사": "巳", "오": "午", "미": "未", "신": "申", "유": "酉", "술": "戌", "해": "亥"
};

export function enrichSajuPayload(saju: SajuResult): EnrichedSajuPayload {
    // 1. Perform detailed analysis
    const enriched = analyzeSaju(saju, saju.gender || 'female');

    // 2. Add formatting (Hanja mapping)
    const mapHanja = (pillar: any) => {
        if (!pillar) return pillar;
        pillar.chun_hanja = STEM_HANJA[pillar.chun_kr] || pillar.chun_kr;
        pillar.ji_hanja = BRANCH_HANJA[pillar.ji_kr] || pillar.ji_kr;
        return pillar;
    };

    enriched.basic.year = mapHanja(enriched.basic.year);
    enriched.basic.month = mapHanja(enriched.basic.month);
    enriched.basic.day = mapHanja(enriched.basic.day);
    enriched.basic.hour = mapHanja(enriched.basic.hour);

    return enriched;
}
