
// ------------------------------------------------------------------
// Five Elements (Ohaeng)
// ------------------------------------------------------------------
export const ELEMENTS = {
    WOOD: 'wood',
    FIRE: 'fire',
    EARTH: 'earth',
    METAL: 'metal',
    WATER: 'water'
} as const;

export type ElementType = typeof ELEMENTS[keyof typeof ELEMENTS];

export const GAN_INFO: Record<string, { element: ElementType; yinYang: 'yin' | 'yang' }> = {
    "갑": { element: ELEMENTS.WOOD, yinYang: 'yang' },
    "을": { element: ELEMENTS.WOOD, yinYang: 'yin' },
    "병": { element: ELEMENTS.FIRE, yinYang: 'yang' },
    "정": { element: ELEMENTS.FIRE, yinYang: 'yin' },
    "무": { element: ELEMENTS.EARTH, yinYang: 'yang' },
    "기": { element: ELEMENTS.EARTH, yinYang: 'yin' },
    "경": { element: ELEMENTS.METAL, yinYang: 'yang' },
    "신": { element: ELEMENTS.METAL, yinYang: 'yin' },
    "임": { element: ELEMENTS.WATER, yinYang: 'yang' },
    "계": { element: ELEMENTS.WATER, yinYang: 'yin' }
};

export const ZHI_INFO: Record<string, { element: ElementType; yinYang: 'yin' | 'yang'; hiddenStems: string[] }> = {
    "자": { element: ELEMENTS.WATER, yinYang: 'yang', hiddenStems: ["임", "계"] }, // Body is Yin, Function is Yang (in some schools). Standard Saju treats Zi as Yang water for Ten Gods usually, but body is Yin. *Correction*: Ja is Yin Water in body, Yang in usage. For Ten Gods, usually treated as Water. Let's stick to standard Ten God mapping.
    // Actually, simple mapping:
    "축": { element: ELEMENTS.EARTH, yinYang: 'yin', hiddenStems: ["계", "신", "기"] },
    "인": { element: ELEMENTS.WOOD, yinYang: 'yang', hiddenStems: ["무", "병", "갑"] },
    "묘": { element: ELEMENTS.WOOD, yinYang: 'yin', hiddenStems: ["갑", "을"] },
    "진": { element: ELEMENTS.EARTH, yinYang: 'yang', hiddenStems: ["을", "계", "무"] },
    "사": { element: ELEMENTS.FIRE, yinYang: 'yin', hiddenStems: ["무", "경", "병"] }, // Body Yin, Usage Yang (Snake is 6th, Yin position, but contains Yang Fire Bing). 
    "오": { element: ELEMENTS.FIRE, yinYang: 'yang', hiddenStems: ["병", "기", "정"] }, // Body Yang, Usage Yin. 
    "미": { element: ELEMENTS.EARTH, yinYang: 'yin', hiddenStems: ["정", "을", "기"] },
    "신": { element: ELEMENTS.METAL, yinYang: 'yang', hiddenStems: ["무", "임", "경"] }, // Shin (Monkey)
    "유": { element: ELEMENTS.METAL, yinYang: 'yin', hiddenStems: ["경", "신"] },
    "술": { element: ELEMENTS.EARTH, yinYang: 'yang', hiddenStems: ["신", "정", "무"] },
    "해": { element: ELEMENTS.WATER, yinYang: 'yin', hiddenStems: ["무", "갑", "임"] }  // Body Yin, Usage Yang? Hai is last.
};

// Refined Yin/Yang for Ten Gods (Standard approach)
// Ja (Rat): Yang Water
// Chuk (Ox): Yin Earth
// In (Tiger): Yang Wood
// Myo (Rabbit): Yin Wood
// Jin (Dragon): Yang Earth
// Sa (Snake): Yang Fire (Functionally) / Yin (Body). Usually treated as Yang Fire for Ten Gods.
// O (Horse): Yin Fire (Functionally) / Yang (Body). Usually treated as Yin Fire for Ten Gods.
// Mi (Sheep): Yin Earth
// Shin (Monkey): Yang Metal
// Yu (Rooster): Yin Metal
// Sul (Dog): Yang Earth
// Hae (Pig): Yang Water (Functionally) / Yin (Body). Usually treated as Yang Water for Ten Gods.

// Let's use a explicit Ten God polarity map for branches
export const ZHI_TEN_GOD_POLARITY: Record<string, { element: ElementType; polarity: 'yin' | 'yang' }> = {
    "자": { element: ELEMENTS.WATER, polarity: 'yang' }, // Rat: Yang Water
    "축": { element: ELEMENTS.EARTH, polarity: 'yin' },
    "인": { element: ELEMENTS.WOOD, polarity: 'yang' },
    "묘": { element: ELEMENTS.WOOD, polarity: 'yin' },
    "진": { element: ELEMENTS.EARTH, polarity: 'yang' },
    "사": { element: ELEMENTS.FIRE, polarity: 'yang' }, // Snake: Yang Fire
    "오": { element: ELEMENTS.FIRE, polarity: 'yin' },  // Horse: Yin Fire
    "미": { element: ELEMENTS.EARTH, polarity: 'yin' },
    "신": { element: ELEMENTS.METAL, polarity: 'yang' },
    "유": { element: ELEMENTS.METAL, polarity: 'yin' },
    "술": { element: ELEMENTS.EARTH, polarity: 'yang' },
    "해": { element: ELEMENTS.WATER, polarity: 'yang' } // Pig: Yang Water
};

// ------------------------------------------------------------------
// Ten Gods (Shipseong) Logic
// ------------------------------------------------------------------
export const TEN_GODS = {
    BiGyeon: '비견', // Same Element, Same Polarity
    GyeopJae: '겁재', // Same Element, Diff Polarity
    SikSin: '식신',   // Output, Same Polarity
    SangGwan: '상관', // Output, Diff Polarity
    PyeonJae: '편재', // Controlled, Same Polarity
    JeongJae: '정재', // Controlled, Diff Polarity
    PyeonGwan: '편관', // Controller, Same Polarity
    JeongGwan: '정관', // Controller, Diff Polarity
    PyeonIn: '편인',   // Input, Same Polarity
    JeongIn: '정인'    // Input, Diff Polarity
};

// ------------------------------------------------------------------
// 12 Woonsung (12 Phases)
// ------------------------------------------------------------------
// Order: JangSaeng, MokYok, GwanDae, GeonRok, JeWang, Soe, Byeong, Sa, Myo, Jeol, Tae, Yang
export const WOONSUNG = [
    "장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"
];

// Lookup table based on Day Stem (Gan)
// Key: Day Stem, Value: Starting Branch (Zhi) for 'JangSaeng' (or full map)
// Easier: Map each Stem to the ZHI that corresponds to JangSaeng, then count forward/backward?
// Actually, Yang Stems count forward, Yin Stems count backward.
// Yang Stems:
// 甲 (Wood+): JangSaeng at Hae (Pig)
// 丙 (Fire+): JangSaeng at In (Tiger)
// 戊 (Earth+): JangSaeng at In (Tiger) (Fire/Earth same cycle)
// 庚 (Metal+): JangSaeng at Sa (Snake)
// 壬 (Water+): JangSaeng at Shin (Monkey)

// Yin Stems:
// 乙 (Wood-): JangSaeng at O (Horse) - counts backward
// 丁 (Fire-): JangSaeng at Yu (Rooster) - counts backward
// 己 (Earth-): JangSaeng at Yu (Rooster)
// 辛 (Metal-): JangSaeng at Ja (Rat)
// 癸 (Water-): JangSaeng at Myo (Rabbit)

export const WOONSUNG_START: Record<string, { startZhi: string; direction: 1 | -1 }> = {
    "갑": { startZhi: "해", direction: 1 },
    "을": { startZhi: "오", direction: -1 },
    "병": { startZhi: "인", direction: 1 },
    "정": { startZhi: "유", direction: -1 },
    "무": { startZhi: "인", direction: 1 },
    "기": { startZhi: "유", direction: -1 },
    "경": { startZhi: "사", direction: 1 },
    "신": { startZhi: "자", direction: -1 },
    "임": { startZhi: "신", direction: 1 },
    "계": { startZhi: "묘", direction: -1 }
};

export const ZHI_ORDER = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

