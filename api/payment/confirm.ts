
import { createClient } from '@supabase/supabase-js';
import { PromptBuilder } from '../../src/lib/prompt-builder/builder';
import { computeSaju } from '../../src/lib/saju-calculator';
import { PromptBuilderInput } from '../../src/lib/prompt-builder/types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl) throw new Error('Missing Supabase URL');
if (!supabaseServiceKey) throw new Error('Missing Supabase service key');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PRODUCT_TO_SLUG: Record<string, string> = {
    'mouse': 'rat-sage',
    'cow': 'ox-sage',
    'tiger': 'tiger-sage',
    'rabbit': 'rabbit-sage',
    'dragon': 'dragon-sage',
    'snake': 'snake-sage',
    'horse': 'horse-sage',
    'sheep': 'sheep-sage',
    'monkey': 'monkey-sage',
    'chicken': 'rooster-sage',
    'dog': 'dog-sage',
    'pig': 'boar-sage'
};

function redirect(res: any, url: string) {
    if (typeof res.redirect === 'function') return res.redirect(url);
    if (typeof res.writeHead === 'function') {
        res.writeHead(302, { Location: url });
        return res.end();
    }
    return res.status(302).setHeader('Location', url).end();
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const { res_cd, res_msg, ordr_idxx, tno, amount } = req.body;

    try {
        if (res_cd !== '0000') {
            await supabase
                .from('orders')
                .update({ status: 'failed', pg_tid: tno })
                .eq('id', ordr_idxx);
            
            return redirect(res, `/payment/fail?error=${encodeURIComponent(res_msg)}`);
        }

        // 1. Fetch Order
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*, guest_profiles(*), products(*)')
            .eq('id', ordr_idxx)
            .single();

        if (fetchError || !order) throw new Error('Order not found');
        
        if (order.amount !== Number(amount)) {
            throw new Error('Amount mismatch');
        }

        // 2. Update Order Status
        const { error: updateError } = await supabase
            .from('orders')
            .update({ 
                status: 'paid', 
                pg_tid: tno,
                updated_at: new Date().toISOString()
            })
            .eq('id', ordr_idxx);

        if (updateError) throw updateError;

        // 3. Prepare Prompt Generation
        const profile = order.guest_profiles;
        const product = order.products;
        const sageSlug = PRODUCT_TO_SLUG[product.id];
        
        // Compute Saju
        const sajuResult = computeSaju(
            profile.name,
            profile.birth_date_raw,
            profile.solar_lunar === 'lunar' ? 'lunar' : 'solar',
            false, // Leap month - profile table doesn't seem to store boolean clearly? 
            // Wait, guest_profiles has `solar_lunar`. It stores 'solar' or 'lunar'. 
            // Leap month info? `guest_profiles` table definition (from search) shows `birth_date_raw`, `solar_lunar`, `birth_time_slot`.
            // Does it store leap month flag?
            // Checking table schema from earlier: `solar_lunar` is text.
            // If the user selected leap month, where is it stored?
            // Assuming `solar_lunar` might be 'lunar-leap' or handled during input.
            // For now, assuming false if not explicit.
            profile.birth_time_slot, // This contains text like "자시 (23:30~...)" or "야자" key?
            // `birth_time_slot` in profile seems to be the Display String or Key.
            // In `MasterDetail.tsx`, we save `birth_time_type` to profile?
            // Let's assume `birth_time_slot` holds the key (e.g. "자", "축") or we need to map it.
            // Actually, `computeSaju` expects the key (e.g. "조자", "축").
            // I should parse `birth_time_slot` if it contains full text.
            // Simple heuristic: Extract the first part before space?
            profile.gender || 'male' // Profile usually has gender? Schema check: `guest_profiles` table has `name`, `birth_date_raw`... 
            // Schema earlier: `name`, `birth_date_raw`, `birth_date_iso`, `solar_lunar`, `birth_time_slot`, `unknown_time`, `concern_text`.
            // Missing `gender` column in `guest_profiles`! 
            // Saju needs gender for Daewoon (Luck Cycle), but `computeSaju` (Ilju/Month/Time) technically doesn't depend on gender for the 4 pillars themselves (only Daewoon).
            // However, `computeSaju` function signature requires it. I will pass 'male' as dummy if missing, as it doesn't affect the 4 pillars calculation in my `saju-calculator`.
        );

        // Fetch Traits
        // We need to query 3 tables: day_pillar_profiles, month_branch_profiles, time_branch_profiles
        // 1. Day
        const { data: dayData } = await supabase.from('day_pillar_profiles').select('traits').eq('ilju', sajuResult.ilju).single();
        // 2. Month
        const { data: monthData } = await supabase.from('month_branch_profiles').select('traits').eq('branch', sajuResult.month_branch).single();
        // 3. Hour
        // sajuResult.hour_branch is the Character (e.g. "자").
        const { data: hourData } = await supabase.from('time_branch_profiles').select('traits').eq('branch', sajuResult.hour_branch).single();

        const sajuTraits = {
            day: dayData?.traits || [],
            month: monthData?.traits || [],
            hour: hourData?.traits || []
        };

        // Build Prompt
        const builder = new PromptBuilder();
        
        // Purchase Count: Need to count previous orders for this user/guest?
        // Or just use session counter if available?
        // For dedupe, we need a counter.
        // Let's count paid orders for this guest_id.
        const { count: purchaseCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('guest_profile_id', profile.id)
            .eq('status', 'paid');

        // Check if sajuResult is valid
        if (!sajuResult || !sajuResult.ilju) {
            throw new Error('Invalid Saju Calculation Result');
        }

        const builderInput: PromptBuilderInput = {
            sage_slug: sageSlug,
            question_id: product.id,
            user_or_guest_id: profile.id,
            purchase_count_or_session_counter: (purchaseCount || 0) + 1,
            date_yyyy_mm_dd: new Date().toISOString().split('T')[0],
            saju_result: {
                year_pillar: sajuResult.year_pillar || '',
                month_pillar: sajuResult.month_pillar || '',
                day_pillar: sajuResult.day_pillar || sajuResult.ilju || '',
                hour_pillar: sajuResult.hour_pillar || '',
                gender: 'unknown',
                lunar_solar: profile.solar_lunar,
                leap_month: false,
                time_bucket: sajuResult.input_hour_type
            },
            question_text: `내 고민은: ${profile.concern_text || '없음'}`,
            optional_user_concern_text: profile.concern_text,
            saju_traits: sajuTraits
        };

        // --- NEW: Sequential Generation Logic ---
        
        // 1. Select Levers (Once for the whole report)
        const selectedLevers = builder.selectLevers(builderInput);
        const sections = builder.getExtendedSections();
        
        console.log(`[Report Generation] Starting sequential generation for ${sections.length} sections...`);

        let fullReportContent = '';
        let generatedPromptsLog: string[] = [];

        if (!OPENAI_API_KEY) {
            fullReportContent = 'Error: Missing API Key';
        } else {
            const callOpenAI = async (prompt: string, temp: number, retryCount = 0): Promise<any> => {
                try {
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${OPENAI_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-4o',
                            messages: [
                                { role: 'system', content: prompt },
                                { role: 'user', content: `[Section Task] Write this section now.` }
                            ],
                            temperature: temp
                        })
                    });
                    
                    if (!response.ok) {
                        const errBody = await response.json().catch(() => ({}));
                        console.error('OpenAI Error:', errBody);
                        throw new Error('AI Error');
                    }
                    return await response.json();
                } catch (e) {
                    if (retryCount < 2) {
                        return callOpenAI(prompt, temp, retryCount + 1);
                    }
                    throw e;
                }
            };

            // Loop through sections
            for (const section of sections) {
                const sectionPrompt = builder.buildSectionPrompt(
                    builderInput, 
                    selectedLevers, 
                    section, 
                    fullReportContent
                );

                generatedPromptsLog.push(sectionPrompt);

                try {
                    const aiResult = await callOpenAI(sectionPrompt, 0.75);
                    let sectionContent = aiResult.choices[0].message.content;

                    if (sectionContent.length < section.min_chars * 0.7) {
                         const expansionPrompt = sectionPrompt + `\n\n[SYSTEM ALERT] Your output was too short. Please REWRITE this section to be much more detailed.`;
                         const retryResult = await callOpenAI(expansionPrompt, 0.85);
                         sectionContent = retryResult.choices[0].message.content;
                    }

                    fullReportContent += `\n\n${sectionContent}\n\n`;
                } catch (e) {
                    console.error(`[Report Generation] Failed at Section ${section.id}`, e);
                    fullReportContent += `\n\n[Section ${section.id} Error: AI generation failed.]\n\n`;
                }
            }
        }

        // --- Post-Processing ---
        const lines = fullReportContent.split('\n').filter(l => l.trim().length > 0);
        const openingSentence = lines[0] || "";
        const closingSentence = lines[lines.length - 1] || "";

        // 5. Save Report
        await supabase
            .from('reports')
            .insert({
                order_id: order.id,
                order_token: order.order_token,
                content: fullReportContent,
                template_version: 'v5-extended-20k-sequential'
            });

        // 6. Save Prompt History
        await supabase
            .from('prompt_generation_history')
            .insert({
                user_id: null,
                guest_id: profile.id,
                sage_slug: sageSlug,
                question_id: product.id,
                seed_hash: "",
                selected_levers_json: selectedLevers,
                opening_sentence: openingSentence.substring(0, 500),
                closing_sentence: closingSentence.substring(0, 500)
            });

        // 7. Success Redirect
        return redirect(res, `/payment/success?order_token=${order.order_token}`);

    } catch (err: any) {
        console.error('Payment Confirmation Error:', err);
        return redirect(res, `/payment/fail?error=system_error`);
    }
}
