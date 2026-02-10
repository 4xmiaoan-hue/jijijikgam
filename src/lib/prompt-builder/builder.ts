
import { PromptBuilderInput, PromptBuilderOutput, VariationRules, LeverChoice, VoiceProfile, ReportFormat } from './types';
import variationRulesData from '../../../data/seed/variation_rules.json';
import voiceProfilesData from '../../../data/seed/voice_profiles.json';
import reportFormatData from '../../../data/seed/report_format.json';
import contractData from '../../config/report_contract.json';
import { enrichSajuPayload } from '../saju-payload';
import crypto from 'crypto';

const variationRules = variationRulesData as unknown as VariationRules;
const voiceProfiles = voiceProfilesData.profiles as unknown as Record<string, VoiceProfile>;
const reportFormat = reportFormatData as unknown as ReportFormat;
const contract = contractData;

export interface ExtendedSectionDef {
    id: number;
    title: string;
    min_chars: number;
    max_chars: number;
    description: string;
    instructions: string[];
    marker?: string; // Add marker
}

// Merge logic: Use contract to override/extend sections
export const EXTENDED_REPORT_SECTIONS: ExtendedSectionDef[] = contract.sections.map(s => ({
    id: s.id,
    title: s.title,
    min_chars: s.min_chars, // Use contract min chars
    max_chars: s.min_chars + 1000, // Heuristic max
    description: s.role,
    instructions: [
        `Write Section ${s.id} using marker ${s.marker}`,
        `Minimum ${s.min_chars} characters (no spaces).`,
        s.must_include_data ? "MUST include specific Saju evidence (Han-ja + Korean) provided in the context." : ""
    ].filter(Boolean)
}));


export class PromptBuilder {
    // History fetching is removed for now as we rely on random seed variation for the MVP of this task.

    private generateSeed(input: PromptBuilderInput): string {
        // seed = hash(user_or_guest_id + '|' + sage_slug + '|' + question_id + '|' + purchase_count_or_session_counter + '|' + yyyy-mm-dd)
        const raw = `${input.user_or_guest_id}|${input.sage_slug}|${input.question_id}|${input.purchase_count_or_session_counter}|${input.date_yyyy_mm_dd}`;
        return crypto.createHash('sha256').update(raw).digest('hex');
    }

    private getRandom(seed: string, salt: string): number {
        const hash = crypto.createHash('sha256').update(seed + salt).digest('hex');
        return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    }

    private pickWeighted<T>(choices: T[], seed: string, salt: string): T {
        const rand = this.getRandom(seed, salt);
        return choices[Math.floor(rand * choices.length)];
    }

    private detectCategory(text: string): string {
        if (!text) return 'self';
        if (/연애|사랑|이별|재회|남친|여친|결혼|썸/.test(text)) return 'relationship';
        if (/직장|이직|사업|돈|취업|합격|승진|면접/.test(text)) return 'work';
        if (/방향|선택|이사|이동|진로/.test(text)) return 'direction';
        return 'self';
    }

    public getExtendedSections(): ExtendedSectionDef[] {
        return EXTENDED_REPORT_SECTIONS;
    }

    // Levers selection logic (reused for consistency across sections)
    public selectLevers(input: PromptBuilderInput): PromptBuilderOutput['selected_levers'] {
        const seed = this.generateSeed(input);
        const profile = voiceProfiles[input.sage_slug] || voiceProfiles['dragon-sage'];

        // (1) Opener Variant (1 of 3)
        const openerIndex = Math.floor(this.getRandom(seed, 'opener') * profile.opener_variants.length);
        const selectedOpener = profile.opener_variants[openerIndex];
        const openerChoice: LeverChoice = {
            key: `opener_${openerIndex + 1}`,
            label: `Opener Variant ${openerIndex + 1}`,
            instruction: `오프닝 문구로 다음을 변주하여 사용: "${selectedOpener}"`
        };

        // (2) Metaphor Palette
        const metaphorKey = profile.metaphor_palette;
        const metaphorChoice = variationRules.levers.metaphor_palette.choices.find(c => c.key === metaphorKey) 
            || variationRules.levers.metaphor_palette.choices[0];

        // (3) Emphasis Axis
        const category = this.detectCategory(input.optional_user_concern_text || input.question_text);
        const emphasisChoices = variationRules.levers.emphasis_axis.choices;
        const primaryEmphasis = emphasisChoices.find(c => c.key === category) || emphasisChoices[0];
        const otherEmphasis = emphasisChoices.filter(c => c.key !== primaryEmphasis.key);
        const secondaryEmphasis = this.pickWeighted(otherEmphasis, seed, 'emphasis_secondary');
        const emphasisSelected = [primaryEmphasis, secondaryEmphasis];

        // (4) Sentence Rhythm
        const rhythmChoice = this.pickWeighted(variationRules.levers.sentence_rhythm.choices, seed, 'rhythm');

        return {
            opener_variant: openerChoice,
            metaphor_palette: metaphorChoice,
            emphasis_axis: emphasisSelected,
            sentence_rhythm: rhythmChoice
        };
    }

    // New method for building section-specific prompts
    public buildSectionPrompt(
        input: PromptBuilderInput, 
        levers: PromptBuilderOutput['selected_levers'], 
        section: ExtendedSectionDef,
        previousContext: string = "" // The full text of previously generated sections
    ): string {
        const profile = voiceProfiles[input.sage_slug] || voiceProfiles['dragon-sage'];
        
        // Base System Meta
        const systemMeta = `
[SYSTEM_META]
Target_Persona: ${profile.display_name_kr} (${profile.internal_name})
Tone_Identity: ${profile.tone_identity}
Task_Type: Creative Writing / Roleplay (Deep Analysis)
Language: Korean (Natural, immersive, Webtoon/Essay style)
Current_Section: [${section.id}] ${section.title}
Target_Length: ${section.min_chars} ~ ${section.max_chars} characters (MUST BE LONG AND DETAILED)

[VOICE_PROFILE]
Base_Tone: ${profile.base_tone}
Speech_Rules:
- Basic Endings: ${profile.speech_rules.basic_endings.join(', ')}
- Addressing: "${profile.speech_rules.second_person}"
- Forbidden Words: ${profile.forbiddens.words.join(', ')}

[VARIATION_LEVERS]
1. Metaphor: ${levers.metaphor_palette.label} ("${levers.metaphor_palette.instruction}")
2. Emphasis: ${levers.emphasis_axis.map(e => e.label).join(' & ')}
3. Rhythm: ${levers.sentence_rhythm.label} ("${levers.sentence_rhythm.instruction}")

[SAFETY_GUIDELINES]
- No medical/legal/financial advice.
- Use hedges: ${variationRules.safety_and_claims.required_hedges.join(', ')}
`;

        // Context Data
        // Enrich the Saju data with the new payload format
        const enrichedSaju = enrichSajuPayload({
            ...input.saju_result,
            solar_date: input.date_yyyy_mm_dd,
            ilju: input.saju_result.day_pillar,
            ilju_index: 0, // Placeholder
            is_leap_month_applied: input.saju_result.leap_month,
            day_shifted_by_yaja: false, // Placeholder
        } as any);

        const contextData = `
[USER_CONTEXT]
User Question: "${input.question_text}"
User Concern: "${input.optional_user_concern_text || '없음'}"
Saju Info: ${JSON.stringify(enrichedSaju.basic, null, 2)}
Saju Analysis Summary: ${JSON.stringify(enrichedSaju.analysis, null, 2)}

[IMMUTABLE_CONTRACT]
1. OUTPUT STRUCTURE: You must output ONLY the content for the requested section.
2. LENGTH: Total report must be 20,000+ chars. This section MUST be at least ${section.min_chars} chars long.
3. FORMAT: 
   - Narrative flow (Webtoon Scroll style).
   - NO bullet points ("- ", "1."). 
   - NO numbered lists.
   - Use <br> for line breaks if needed, but prefer natural paragraph breaks.
4. TONE: 
   - Use "${profile.base_tone}". 
   - Avoid repetitive endings like "~다." or "~입니다.". Use diverse endings (~군, ~네, ~지, ~구나).
   - Max 5% of sentences should end in simple "~다."
5. MARKERS: Start the text with ${section.marker} and End with </${section.marker.replace('<', '')}.
`;

        // Previous Context (Summary of what has been written so far to maintain flow)
        // We only pass the last 2000 chars of previous context if it's too long, or summarize it?
        // Actually, for consistency, passing the full text is better if it fits. 
        // With 8 sections, the accumulated text might reach 20k chars.
        // Passing 20k chars as input is fine for modern models (128k context).
        const previousContextBlock = previousContext ? `
[PREVIOUS_SECTIONS_CONTENT (For Context Continuity)]
${previousContext}
(End of previous context. Continue naturally from here.)
` : `[START OF REPORT]`;

        // Specific Instruction for this section
        let instruction = `
[SECTION_INSTRUCTION]
You are writing Section [${section.id}] "${section.title}" of a long-form Saju report.
Goal: Write a deep, immersive analysis specifically for this section.

Specific Rules for this Section:
${section.instructions.map(r => `- ${r}`).join('\n')}
`;

        // Inject Saju Logic Instructions
        if (section.id === 2) {
            instruction += `
[SPECIAL_SAJU_INSTRUCTIONS]
- You MUST analyze the **Ten Gods (Shipseong)** found in the context (ten_god_chun, ten_god_ji). Explain what "BiGyeon", "SikSin", etc., mean for the user's life.
- Analyze the **12 Woonsung** phases (e.g., JangSaeng, JeWang) and their impact on energy levels.
- Mention **Sinsal (Special Stars)** like "Yeokma" or "Dohwa" if present in the data.
- Explain the **Five Elements Balance** (element_balance) and which element is dominant or missing.
`;
        } else if (section.id === 3) {
            instruction += `
[SPECIAL_SAJU_INSTRUCTIONS]
- You MUST analyze the **Daewoon (Great Fortune)** flow provided in 'analysis.daewoon'.
- Explain how the current Daewoon (based on user's age) interacts with the original Saju.
- Discuss the **Annual Fortune (Sewoon)** for the current year (Gapjin Year or similar) relative to the Day Master (Ilgan).
`;
        }

        instruction += `
[WRITING_RULES]
1. **Length Requirement**: You MUST write at least ${section.min_chars} characters for this section alone. Do not be brief. Expand on every point.
2. **Style**: Use the Persona's voice (Cheongryong Dosa). Do not sound like a generic AI. Be poetic, insightful, and "sage-like".
3. **Continuity**: Connect naturally with the [PREVIOUS_SECTIONS_CONTENT]. Do not repeat the same introductions.
4. **Format**: Output purely the text for this section. Do NOT output JSON. Start with the section header: [${section.id}. ${section.title}]

NOW, WRITE SECTION ${section.id} ONLY.
`;

        return systemMeta + contextData + previousContextBlock + instruction;
    }

    // Build a repair prompt based on validation errors
    public buildRepairPrompt(
        originalPrompt: string,
        errors: string[],
        previousText: string
    ): string {
        return `
[SYSTEM_REPAIR_MODE]
The previous generation failed validation checks.
ERRORS:
${errors.map(e => `- ${e}`).join('\n')}

TASK:
Regenerate the content.
1. FIX the errors listed above.
2. MAINTAIN the original Persona and Tone.
3. EXTEND the content if length was insufficient.
4. REMOVE any bullet points or numbered lists.
5. ENSURE the structure follows the contract.

[PREVIOUS_ATTEMPT (For Reference)]
${previousText.substring(0, 1000)}... (truncated)

[RE-GENERATE NOW]
`;
    }
}
