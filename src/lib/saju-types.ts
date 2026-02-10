
import { SajuResult } from './saju-calculator';

export interface PillarInfo {
    chun_kr: string;
    chun_hanja: string;
    ji_kr: string;
    ji_hanja: string;
    ten_god_chun: string;
    ten_god_ji: string;
    woonsung: string;
    jijangan: string[];
    sinsal: string[];
}

export interface DaewoonInfo {
    age: number;
    gan: string;
    zhi: string;
    name: string;
}

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
        special_stars: string[];
        auspicious_stars: string[];
        daewoon?: DaewoonInfo[];
    };
}
