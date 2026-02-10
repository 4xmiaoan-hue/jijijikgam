
import { SajuResult } from './saju-calculator';
import { EnrichedSajuPayload } from './saju-types';
import { 
    ELEMENTS, GAN_INFO, ZHI_TEN_GOD_POLARITY, TEN_GODS, 
    WOONSUNG, WOONSUNG_START, ZHI_ORDER, ZHI_INFO 
} from './saju-constants';

// Gan (Heavenly Stems) Order
const GAN_ORDER = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];

// Helper: Calculate Ten God
function getTenGod(dayGan: string, target: string, isTargetGan: boolean): string {
    const dayInfo = GAN_INFO[dayGan];
    if (!dayInfo) return "";

    let targetElement, targetPolarity;

    if (isTargetGan) {
        const info = GAN_INFO[target];
        if (!info) return "";
        targetElement = info.element;
        targetPolarity = info.yinYang;
    } else {
        const info = ZHI_TEN_GOD_POLARITY[target];
        if (!info) return "";
        targetElement = info.element;
        targetPolarity = info.polarity;
    }

    const samePolarity = dayInfo.yinYang === targetPolarity;

    // Logic Table
    // Day vs Target
    // Wood(0) -> Wood(0): BiGyeon/GyeopJae
    // Wood(0) -> Fire(1): SikSin/SangGwan
    // Wood(0) -> Earth(2): PyeonJae/JeongJae
    // Wood(0) -> Metal(3): PyeonGwan/JeongGwan
    // Wood(0) -> Water(4): PyeonIn/JeongIn
    
    const elements = [ELEMENTS.WOOD, ELEMENTS.FIRE, ELEMENTS.EARTH, ELEMENTS.METAL, ELEMENTS.WATER];
    const dayIdx = elements.indexOf(dayInfo.element);
    const targetIdx = elements.indexOf(targetElement);
    
    // Calculate relative distance (0 to 4)
    const diff = (targetIdx - dayIdx + 5) % 5;

    switch (diff) {
        case 0: return samePolarity ? TEN_GODS.BiGyeon : TEN_GODS.GyeopJae;
        case 1: return samePolarity ? TEN_GODS.SikSin : TEN_GODS.SangGwan;
        case 2: return samePolarity ? TEN_GODS.PyeonJae : TEN_GODS.JeongJae;
        case 3: return samePolarity ? TEN_GODS.PyeonGwan : TEN_GODS.JeongGwan;
        case 4: return samePolarity ? TEN_GODS.PyeonIn : TEN_GODS.JeongIn;
        default: return "";
    }
}

// Helper: Calculate Woonsung
function getWoonsung(dayGan: string, zhi: string): string {
    const startInfo = WOONSUNG_START[dayGan];
    if (!startInfo) return "";

    const startIdx = ZHI_ORDER.indexOf(startInfo.startZhi);
    const targetIdx = ZHI_ORDER.indexOf(zhi);
    
    if (startIdx === -1 || targetIdx === -1) return "";

    // Calculate distance
    let offset;
    if (startInfo.direction === 1) {
        offset = (targetIdx - startIdx + 12) % 12;
    } else {
        offset = (startIdx - targetIdx + 12) % 12;
    }

    return WOONSUNG[offset];
}

// Helper: Calculate Daewoon (Great Fortune)
function calculateDaewoon(yearPillar: string, monthPillar: string, gender: string) {
    const yearGan = yearPillar[0];
    const yearGanInfo = GAN_INFO[yearGan];
    const isYangYear = yearGanInfo?.yinYang === 'yang';
    
    // Direction:
    // Male (Yang) + Yang Year = Forward
    // Male (Yang) + Yin Year = Backward
    // Female (Yin) + Yang Year = Backward
    // Female (Yin) + Yin Year = Forward
    // Simply: Male == YangYear ? Fwd : Bwd. Female == YinYear ? Fwd : Bwd.
    // Or: 
    // Male(Yang): Yang=Fwd, Yin=Bwd
    // Female(Yin): Yang=Bwd, Yin=Fwd
    
    const isMale = gender === 'male';
    const isForward = isMale === isYangYear; // Simplified boolean logic matches standard Saju

    const daewoonList = [];
    const monthGan = monthPillar[0];
    const monthZhi = monthPillar[1];
    
    let currentGanIdx = GAN_ORDER.indexOf(monthGan);
    let currentZhiIdx = ZHI_ORDER.indexOf(monthZhi);

    // Generate 10 Daewoons
    for (let i = 1; i <= 8; i++) { // Usually show 8
        if (isForward) {
            currentGanIdx = (currentGanIdx + 1) % 10;
            currentZhiIdx = (currentZhiIdx + 1) % 12;
        } else {
            currentGanIdx = (currentGanIdx - 1 + 10) % 10;
            currentZhiIdx = (currentZhiIdx - 1 + 12) % 12;
        }
        
        const gan = GAN_ORDER[currentGanIdx];
        const zhi = ZHI_ORDER[currentZhiIdx];
        
        daewoonList.push({
            age: i * 10, // Simplified: 10, 20, 30... (Real calc requires Jeolgi)
            gan,
            zhi,
            name: gan + zhi
        });
    }

    return daewoonList;
}

// Helper: Simple Sinsal (just a few examples)
function getSinsal(dayZhi: string, targetZhi: string): string[] {
    const list = [];
    // Example: Yeokma (Travel) - In, Shin, Sa, Hae relationships
    // Based on Day Branch (or Year Branch)
    // Simplified lookup for MVP:
    // In/O/Sul -> Yeokma: Shin
    // Shin/Ja/Jin -> Yeokma: In
    // Sa/Yu/Chuk -> Yeokma: Hae
    // Hae/Myo/Mi -> Yeokma: Sa
    
    const yeokmaMap: Record<string, string> = {
        "인": "신", "오": "신", "술": "신",
        "신": "인", "자": "인", "진": "인",
        "사": "해", "유": "해", "축": "해",
        "해": "사", "묘": "사", "미": "사"
    };
    
    if (yeokmaMap[dayZhi] === targetZhi) list.push("역마살");

    // Dohwa (Peach Blossom)
    // In/O/Sul -> Myo
    // Shin/Ja/Jin -> Yu
    // Sa/Yu/Chuk -> O
    // Hae/Myo/Mi -> Ja
    const dohwaMap: Record<string, string> = {
        "인": "묘", "오": "묘", "술": "묘",
        "신": "유", "자": "유", "진": "유",
        "사": "오", "유": "오", "축": "오",
        "해": "자", "묘": "자", "미": "자"
    };
    if (dohwaMap[dayZhi] === targetZhi) list.push("도화살");

    return list;
}

export function analyzeSaju(saju: SajuResult, gender: string = 'female'): EnrichedSajuPayload {
    const dayGan = saju.day_pillar[0];
    const dayZhi = saju.day_pillar[1];

    const buildPillarInfo = (pillar: string) => {
        if (!pillar || pillar.length < 2) return null;
        const gan = pillar[0];
        const zhi = pillar[1];
        
        return {
            chun_kr: gan,
            chun_hanja: "", // Filled by payload helper later or we can do it here. 
            // Let's rely on saju-payload.ts to map Hanja to avoid duplicate code, 
            // OR populate it here fully. Let's populate minimal raw data and let payload formatter handle display.
            // Actually, `enrichSajuPayload` in `saju-payload.ts` does formatting. 
            // We should make THIS function the main enrichment logic.
            
            ji_kr: zhi,
            ji_hanja: "",
            ten_god_chun: getTenGod(dayGan, gan, true),
            ten_god_ji: getTenGod(dayGan, zhi, false),
            woonsung: getWoonsung(dayGan, zhi),
            jijangan: ZHI_INFO[zhi]?.hiddenStems || [],
            sinsal: getSinsal(dayZhi, zhi)
        };
    };

    const yearInfo = buildPillarInfo(saju.year_pillar);
    const monthInfo = buildPillarInfo(saju.month_pillar);
    const dayInfo = buildPillarInfo(saju.day_pillar);
    const hourInfo = buildPillarInfo(saju.hour_pillar);
    
    // Calculate Element Balance
    const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    const addCount = (char: string, isGan: boolean) => {
        let el: string = '';
        if (isGan) el = GAN_INFO[char]?.element;
        else el = ZHI_INFO[char]?.element;
        if (el) counts[el as keyof typeof counts]++;
    };

    [saju.year_pillar, saju.month_pillar, saju.day_pillar, saju.hour_pillar].forEach(p => {
        if (p && p.length >= 2) {
            addCount(p[0], true);
            addCount(p[1], false);
        }
    });

    const daewoon = calculateDaewoon(saju.year_pillar, saju.month_pillar, gender);

    // Override the basic payload structure to include advanced data
    // We will return a structure that `enrichSajuPayload` can merge or we replace `enrichSajuPayload` logic.
    // For now, let's export this analysis object.
    return {
        meta: { version: "2.0", generated_at: new Date().toISOString() },
        basic: {
            year: yearInfo as any,
            month: monthInfo as any,
            day: dayInfo as any,
            hour: hourInfo as any
        },
        analysis: {
            ten_gods_summary: [], // To be filled by LLM or simple logic
            element_balance: `목${counts.wood} 화${counts.fire} 토${counts.earth} 금${counts.metal} 수${counts.water}`,
            special_stars: [...(yearInfo?.sinsal||[]), ...(monthInfo?.sinsal||[]), ...(dayInfo?.sinsal||[]), ...(hourInfo?.sinsal||[])],
            auspicious_stars: [],
            // Extended
            daewoon: daewoon
        }
    } as any;
}
