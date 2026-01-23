import { SajuResult } from './saju-calculator';

export interface EnrichedSajuPayload {
    meta: {
        version: string;
        generated_at: string;
    };
    basic: {
        year: PillarInfo;
        month: PillarInfo;
        day: PillarInfo;
        hour: PillarInfo;
    };
    analysis: {
        ten_gods_summary: string[];
        element_balance: string;
        special_stars: string[]; // sinsal
        auspicious_stars: string[];
    };
}

interface PillarInfo {
    chun_kr: string;
    chun_hanja: string;
    ji_kr: string;
    ji_hanja: string;
    ten_god_chun: string; // 십성 (천간)
    ten_god_ji: string;   // 십성 (지지)
    woonsung: string;     // 12운성
    jijangan: string[];   // 지장간
    sinsal: string[];     // 신살
}

// Helper to map Korean characters to Hanja
const STEM_HANJA: Record<string, string> = {
    "갑": "甲", "을": "乙", "병": "丙", "정": "丁", "무": "戊", "기": "己", "경": "庚", "신": "辛", "임": "壬", "계": "癸"
};

const BRANCH_HANJA: Record<string, string> = {
    "자": "子", "축": "丑", "인": "寅", "묘": "卯", "진": "辰", "사": "巳", "오": "午", "미": "未", "신": "申", "유": "酉", "술": "戌", "해": "亥"
};

export function enrichSajuPayload(saju: SajuResult): EnrichedSajuPayload {
    const buildPillar = (gan: string, zhi: string): PillarInfo => ({
        chun_kr: gan,
        chun_hanja: STEM_HANJA[gan] || gan,
        ji_kr: zhi,
        ji_hanja: BRANCH_HANJA[zhi] || zhi,
        ten_god_chun: "비견",
        ten_god_ji: "식신",
        woonsung: "장생",
        jijangan: ["무", "병", "갑"],
        sinsal: []
    });

    const parsePillar = (pillarStr: string) => {
        if (!pillarStr || pillarStr.length < 2) return buildPillar("?", "?");
        return buildPillar(pillarStr[0], pillarStr[1]);
    };

    return {
        meta: {
            version: "1.0.0",
            generated_at: new Date().toISOString()
        },
        basic: {
            year: parsePillar(saju.year_pillar),
            month: parsePillar(saju.month_pillar),
            day: parsePillar(saju.day_pillar),
            hour: parsePillar(saju.hour_pillar)
        },
        analysis: {
            ten_gods_summary: ["비견 과다", "식상 발달"],
            element_balance: "목(3), 화(2), 토(1), 금(1), 수(1)",
            special_stars: ["역마살", "도화살"],
            auspicious_stars: ["천을귀인"]
        }
    };
}
