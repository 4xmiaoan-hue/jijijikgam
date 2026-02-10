
import KoreanLunarCalendar from 'korean-lunar-calendar';

// -----------------------------------------
// Constants
// -----------------------------------------

export const GAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
export const ZHI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

// Base Date: 1984-02-02 (Gapja)
const BASE_DATE = new Date('1984-02-02T00:00:00.000Z'); 

// Leap Month Table (User Provided)
const USER_LEAP_MONTH_TABLE: Record<number, number> = {
  1900: 5, 1903: 2, 1906: 7, 1909: 5, 1911: 8, 1914: 6, 1917: 5, 1920: 3,
  1923: 2, 1925: 6, 1928: 4, 1931: 3, 1934: 6, 1936: 10, 1939: 8, 1942: 6,
  1944: 9, 1947: 5, 1950: 3, 1952: 8, 1955: 6, 1957: 9, 1960: 5, 1963: 3,
  1966: 2, 1968: 7, 1971: 5, 1974: 4, 1976: 8, 1979: 6, 1982: 4, 1984: 10,
  1987: 6, 1990: 4, 1993: 3, 1995: 8, 1998: 5, 2001: 4, 2004: 2, 2006: 7,
  2009: 5, 2012: 4, 2014: 9, 2017: 6, 2020: 4, 2023: 2, 2025: 6, 2028: 4,
  2031: 3, 2033: 7, 2036: 5, 2039: 4, 2041: 9, 2044: 6, 2047: 4, 2050: 2
};

// Time Branch Logic
export const TIME_SLOTS: Record<string, string> = {
    "조자": "자", "축": "축", "인": "인", "묘": "묘", "진": "진", "사": "사",
    "오": "오", "미": "미", "신": "신", "유": "유", "술": "술", "해": "해", "야자": "자"
};

// -----------------------------------------
// Helper Functions
// -----------------------------------------

export function validateLeapMonth(lunarYear: number, lunarMonth: number, isLeapMonth: boolean) {
    const leapMonth = USER_LEAP_MONTH_TABLE[lunarYear];
    const hasLeapMonthThisYear = typeof leapMonth === "number";
    const isLeapMonthCandidate = hasLeapMonthThisYear && leapMonth === lunarMonth;

    if (!hasLeapMonthThisYear && isLeapMonth) {
        throw new Error("INVALID_LEAP_MONTH: This lunar year has no leap month.");
    }

    if (hasLeapMonthThisYear && isLeapMonth && leapMonth !== lunarMonth) {
        throw new Error("INVALID_LEAP_MONTH: Leap month mismatch for this year.");
    }

    if (isLeapMonthCandidate && !isLeapMonth) {
        throw new Error("LEAP_MONTH_CONFIRM_REQUIRED: This lunar month has a leap variant. User must confirm 윤달 여부.");
    }

    return true;
}

export function calculateIlju(solarDateStr: string, isYaja: boolean) {
    // solarDateStr: YYYY-MM-DD
    const targetDate = new Date(`${solarDateStr}T00:00:00.000Z`);
    
    // Yaja adjustment: Add 1 day
    if (isYaja) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    // Use KoreanLunarCalendar for accurate Ilju calculation
    const converter = new KoreanLunarCalendar();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    
    converter.setSolarDate(year, month, day);
    // Trigger calculation
    const gapja = converter.getKoreanGapja();
    
    // Extract Ilju from "임인일" -> "임인"
    let ilju = '';
    let iljuIndex = 0;

    if (gapja && gapja.day) {
        const dayStr = gapja.day; // e.g. "임인일"
        ilju = dayStr.substring(0, 2); // "임인"
        
        // Calculate Index from Characters
        const stemChar = ilju[0];
        const branchChar = ilju[1];
        
        const stemIndex = GAN.indexOf(stemChar);
        const branchIndex = ZHI.indexOf(branchChar);
        
        if (stemIndex !== -1 && branchIndex !== -1) {
            // Formula: (6 * Stem - 5 * Branch + 60) % 60
            iljuIndex = (6 * stemIndex - 5 * branchIndex + 60) % 60;
        }
    } else {
        // Fallback (Should not happen if library works)
        throw new Error('Failed to calculate Ilju using library');
    }

    return {
        ilju: ilju,
        ilju_index: iljuIndex,
        shifted_date: targetDate.toISOString().split('T')[0]
    };
}

export interface SajuResult {
    solar_date: string;
    ilju: string;
    ilju_index: number;
    month_branch: string;
    hour_branch: string; // The branch character (자, 축...)
    input_hour_type: string; // The input type (조자, 야자...)
    is_leap_month_applied: boolean;
    day_shifted_by_yaja: boolean;
    // Extended fields
    year_pillar: string;
    month_pillar: string;
    day_pillar: string;
    hour_pillar: string;
    gender: string;
}

export function computeSaju(
    name: string, 
    birth_date: string, 
    calendar: 'solar' | 'lunar', 
    is_leap_month: boolean, 
    birth_time_type: string, 
    gender: string
): SajuResult {
    let solarDateStr = birth_date;
    let isLeapMonthApplied = false;

    // 1. Lunar -> Solar Conversion
    if (calendar === 'lunar') {
        const [yearStr, monthStr, dayStr] = birth_date.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const day = parseInt(dayStr);

        validateLeapMonth(year, month, is_leap_month);

        const calendarConverter = new KoreanLunarCalendar();
        calendarConverter.setLunarDate(year, month, day, is_leap_month);
        const solar = calendarConverter.getSolarCalendar();
        
        solarDateStr = `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
        isLeapMonthApplied = is_leap_month;
    }

    // 2. Determine Time Branch
    const hourBranch = TIME_SLOTS[birth_time_type];
    if (!hourBranch) {
        throw new Error('Invalid birth_time_type');
    }
    const isYaja = birth_time_type === '야자';

    // 3. Calculate Ilju & Full Pillars
    // We reuse calculateIlju logic but need full gapja
    // solarDateStr: YYYY-MM-DD
    const targetDate = new Date(`${solarDateStr}T00:00:00.000Z`);
    
    // Yaja adjustment: Add 1 day for Day Pillar calculation
    if (isYaja) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    const converter = new KoreanLunarCalendar();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    
    converter.setSolarDate(year, month, day);
    const gapja = converter.getKoreanGapja();
    
    // Extract Pillars
    // gapja returns format like "갑자년", "을축월", "병인일"
    // We want "갑자", "을축", "병인"
    const yearPillar = gapja.year.replace(/년$/, '');
    const monthPillar = gapja.month.replace(/월$/, '');
    const dayPillar = gapja.day.replace(/일$/, '');
    
    const ilju = dayPillar;
    let iljuIndex = 0;
    
    // Calculate Ilju Index
    const stemChar = ilju[0];
    const branchChar = ilju[1];
    const stemIndex = GAN.indexOf(stemChar);
    const branchIndex = ZHI.indexOf(branchChar);
    if (stemIndex !== -1 && branchIndex !== -1) {
        iljuIndex = (6 * stemIndex - 5 * branchIndex + 60) % 60;
    }

    const monthBranch = monthPillar[1]; // 2nd char

    // Calculate Hour Pillar
    // Hour Stem = (Day Stem Index * 2 + Hour Branch Index) % 10
    let hourPillar = "미상";
    const hourBranchIndex = ZHI.indexOf(hourBranch);
    if (stemIndex !== -1 && hourBranchIndex !== -1) {
        const hourStemIndex = ((stemIndex % 5) * 2 + hourBranchIndex) % 10;
        hourPillar = GAN[hourStemIndex] + hourBranch;
    }

    return {
        solar_date: solarDateStr,
        ilju,
        ilju_index: iljuIndex,
        month_branch: monthBranch,
        hour_branch: hourBranch,
        input_hour_type: birth_time_type,
        is_leap_month_applied: isLeapMonthApplied,
        day_shifted_by_yaja: isYaja,
        year_pillar: yearPillar,
        month_pillar: monthPillar,
        day_pillar: dayPillar,
        hour_pillar: hourPillar,
        gender: gender
    };
}
