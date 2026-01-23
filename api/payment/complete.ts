
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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const { paymentId, orderId } = req.body;

    try {
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('*, guest_profiles(*), products(*)')
            .eq('id', orderId)
            .single();

        if (fetchError || !order) {
            return res.status(400).json({ error: 'Order not found' });
        }

        const expectedAmount = order.amount;
        const product = order.products;
        const sageSlug = PRODUCT_TO_SLUG[product.id];

        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                pg_tid: paymentId,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
        if (updateError) {
            return res.status(500).json({ error: 'Failed to update order' });
        }

        const profile = order.guest_profiles;

        const sajuResult = computeSaju(
            profile.name,
            profile.birth_date_raw,
            profile.solar_lunar === 'lunar' ? 'lunar' : 'solar',
            false,
            profile.birth_time_slot,
            profile.gender || 'unknown'
        );

        const { data: dayData } = await supabase.from('day_pillar_profiles').select('traits').eq('ilju', sajuResult.ilju).single();
        const { data: monthData } = await supabase.from('month_branch_profiles').select('traits').eq('branch', sajuResult.month_branch).single();
        const { data: hourData } = await supabase.from('time_branch_profiles').select('traits').eq('branch', sajuResult.hour_branch).single();

        const sajuTraits = {
            day: dayData?.traits || [],
            month: monthData?.traits || [],
            hour: hourData?.traits || []
        };

        const builder = new PromptBuilder();

        const { count: purchaseCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('guest_profile_id', profile.id)
            .eq('status', 'paid');

        const builderInput: PromptBuilderInput = {
            sage_slug: sageSlug,
            question_id: product.id,
            user_or_guest_id: profile.id,
            purchase_count_or_session_counter: (purchaseCount || 0) + 1,
            date_yyyy_mm_dd: new Date().toISOString().split('T')[0],
            saju_result: {
                year_pillar: sajuResult.year_pillar,
                month_pillar: sajuResult.month_pillar,
                day_pillar: sajuResult.day_pillar,
                hour_pillar: sajuResult.hour_pillar,
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
        console.log('--- Selected Levers ---');
        console.log(JSON.stringify(selectedLevers, null, 2));

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
                            model: 'gpt-4o', // Ensure we use the best model for length
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
                        console.log(`[AI Retry] Retrying... (${retryCount + 1})`);
                        return callOpenAI(prompt, temp, retryCount + 1);
                    }
                    throw e;
                }
            };

            // Loop through sections
            for (const section of sections) {
                console.log(`[Report Generation] Generating Section ${section.id}: ${section.title}...`);
                
                // Build prompt for this section, passing the FULL context of what has been written so far
                const sectionPrompt = builder.buildSectionPrompt(
                    builderInput, 
                    selectedLevers, 
                    section, 
                    fullReportContent
                );

                generatedPromptsLog.push(sectionPrompt); // Log for debugging

                try {
                    const aiResult = await callOpenAI(sectionPrompt, 0.75); // Slightly higher creativity
                    let sectionContent = aiResult.choices[0].message.content;

                    // Length Check & Simple expansion if needed
                    if (sectionContent.length < section.min_chars * 0.7) { // Tolerance check
                         console.log(`[Report Generation] Section ${section.id} too short (${sectionContent.length} chars). Requesting expansion.`);
                         const expansionPrompt = sectionPrompt + `\n\n[SYSTEM ALERT] Your output was too short (${sectionContent.length} chars). The required minimum is ${section.min_chars}. Please REWRITE this section to be much more detailed, adding metaphors, examples, and deep analysis.`;
                         const retryResult = await callOpenAI(expansionPrompt, 0.85);
                         sectionContent = retryResult.choices[0].message.content;
                    }

                    // Append to full report
                    fullReportContent += `\n\n${sectionContent}\n\n`;

                } catch (e) {
                    console.error(`[Report Generation] Failed at Section ${section.id}`, e);
                    fullReportContent += `\n\n[Section ${section.id} Error: AI generation failed. Please contact support.]\n\n`;
                    // Continue to next section to save partial report? 
                    // Or break? Let's continue to try to finish.
                }
            }
        }

        // --- Post-Processing ---
        const openingSentence = fullReportContent.split('\n').find(l => l.trim().length > 10) || "";
        const closingSentence = fullReportContent.trim().split('\n').pop() || "";

        await supabase
            .from('reports')
            .insert({
                order_id: order.id,
                order_token: order.order_token,
                content: fullReportContent,
                template_version: 'v5-extended-20k-sequential'
            });

        await supabase
            .from('prompt_generation_history')
            .insert({
                user_id: null,
                guest_id: profile.id,
                sage_slug: sageSlug,
                question_id: product.id,
                seed_hash: "", // Not strictly using single seed hash anymore but logic remains in builder
                selected_levers_json: selectedLevers,
                generated_prompt: JSON.stringify(generatedPromptsLog.map((p, i) => ({ section: i, prompt_length: p.length }))), // Store metadata instead of full massive prompts
                opening_sentence: openingSentence.substring(0, 500),
                closing_sentence: closingSentence.substring(0, 500)
            });

        return res.status(200).json({ status: 'PAID' });
    } catch (err: any) {
        console.error('Handler Error:', err);
        return res.status(500).json({ error: 'System error' });
    }
}
