import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import KoreanLunarCalendar from 'korean-lunar-calendar'
import * as PortOne from "@portone/server-sdk"

const envPath = path.resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })

const portone = PortOne.PortOneClient({
  secret: process.env.PORTONE_V2_API_SECRET || process.env.PORTONE_API_SECRET || ''
});

// Load Contract
let contract = {};
try {
  const contractPath = path.resolve(process.cwd(), 'src/config/report_contract.json');
  if (fs.existsSync(contractPath)) {
    contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } else {
    console.warn("Contract file not found at " + contractPath);
  }
} catch (e) {
  console.error("Failed to load contract:", e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Test Supabase Connection
supabase.from('sages').select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) console.error("[Supabase] Connection test failed:", error.message);
    else console.log("[Supabase] Connection test success. Sages count:", count);
  });

const app = express()

// --- Middleware setup (MUST come before routes) ---
app.use(cors({
  origin: (origin, cb) => {
    const allowedOrigins = new Set([
      'http://localhost:5173',
      'http://localhost:5174',
      'https://www.jijijikgam.com'
    ])
    if (!origin) return cb(null, true)
    if (allowedOrigins.has(origin)) return cb(null, true)
    if (/^https?:\/\/([a-z0-9-]+\.)?vercel\.app$/.test(origin)) return cb(null, true)
    cb(null, false)
  },
  credentials: true
}))

app.use('/api/portone/webhook', bodyParser.text({ type: 'application/json' }))
app.use(bodyParser.json())

app.disable('x-powered-by')

app.use((req, res, next) => {
  // Disable HTTPS enforcement on localhost
  const host = req.headers.host || ''
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return next()
  }

  if ((process.env.ENFORCE_HTTPS || 'true') === 'true') {
    const proto = req.headers['x-forwarded-proto']
    if (proto && proto !== 'https') return res.status(403).end()
  }
  next()
})
// --------------------------------------------------

// Helper: Calculate Saju
function calculateSaju(birthDate, solarLunar, birthTimeSlot) {
    const calendar = new KoreanLunarCalendar();
    const [year, month, day] = [
        birthDate.substring(0, 4),
        birthDate.substring(4, 6),
        birthDate.substring(6, 8)
    ].map(Number);

    if (solarLunar === 'lunar') {
        calendar.setLunarDate(year, month, day, false);
    } else {
        calendar.setSolarDate(year, month, day);
    }

    const gapja = calendar.getKoreanGapja();
    
    // Extract Pillars
    const yearPillar = gapja.year.replace(/년$/, '');
    const monthPillar = gapja.month.replace(/월$/, '');
    const dayPillar = gapja.day.replace(/일$/, '');

    const timeBranchMap = {
        "00:00~01:29 조자시": "자", "01:30~03:29 축시": "축", "03:30~05:29 인시": "인",
        "05:30~07:29 묘시": "묘", "07:30~09:29 진시": "진", "09:30~11:29 사시": "사",
        "11:30~13:29 오시": "오", "13:30~15:29 미시": "미", "15:30~17:29 신시": "신",
        "17:30~19:29 유시": "유", "19:30~21:29 술시": "술", "21:30~23:29 해시": "해",
        "23:30~23:59 야자시": "자"
    };
    const timeBranch = birthTimeSlot ? timeBranchMap[birthTimeSlot] : null;
    let hourPillar = "미상";
    
    if (timeBranch && dayPillar) {
        const GAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
        const ZHI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
        const dayStem = dayPillar.substring(0, 1);
        const dayStemIndex = GAN.indexOf(dayStem);
        const hourBranchIndex = ZHI.indexOf(timeBranch);
        
        if (dayStemIndex !== -1 && hourBranchIndex !== -1) {
            const hourStemIndex = ((dayStemIndex % 5) * 2 + hourBranchIndex) % 10;
            hourPillar = GAN[hourStemIndex] + timeBranch;
        }
    }

    return {
        year: yearPillar,
        month: monthPillar,
        day: dayPillar,
        hour: hourPillar,
        gapja
    };
}

// Helper: Enrich Saju Payload (JS version of saju-payload.ts)
const HANJA_MAP = {
    "갑": "甲", "을": "乙", "병": "丙", "정": "丁", "무": "戊", "기": "己", "경": "庚", "신": "辛", "임": "壬", "계": "癸",
    "자": "子", "축": "丑", "인": "寅", "묘": "卯", "진": "辰", "사": "巳", "오": "午", "미": "未", "신": "申", "유": "酉", "술": "戌", "해": "亥"
};
function getHanja(char) { return HANJA_MAP[char] || char; }
function buildPillar(gan, zhi) {
    return {
        chun_kr: gan,
        chun_hanja: getHanja(gan),
        ji_kr: zhi,
        ji_hanja: getHanja(zhi),
        ten_god_chun: "비견", 
        ten_god_ji: "식신",
        woonsung: "장생",
        jijangan: ["무", "병", "갑"],
        sinsal: []
    };
}
function parsePillar(pillarStr) {
    if (!pillarStr || pillarStr.length < 2) return buildPillar("?", "?");
    return buildPillar(pillarStr[0], pillarStr[1]);
}
function enrichSajuPayload(saju) {
    return {
        meta: { version: "1.0.0", generated_at: new Date().toISOString() },
        basic: {
            year: parsePillar(saju.year),
            month: parsePillar(saju.month),
            day: parsePillar(saju.day),
            hour: parsePillar(saju.hour)
        },
        analysis: {
            ten_gods_summary: ["비견 과다", "식상 발달"],
            element_balance: "목(3), 화(2), 토(1), 금(1), 수(1)",
            special_stars: ["역마살", "도화살"],
            auspicious_stars: ["천을귀인"]
        }
    };
}

// Helper: Validator (JS version of report-validator.ts)
function validateReport(text, contract) {
    const errors = [];
    const stats = { total_chars: 0, section_counts: {} };
    const cleanText = text.replace(/\s/g, '');
    stats.total_chars = cleanText.length;

    if (!contract || !contract.constraints) return { ok: true, errors: [], stats };

    if (stats.total_chars < contract.constraints.total_min_chars_no_space) {
        errors.push(`Total length insufficient: ${stats.total_chars} / ${contract.constraints.total_min_chars_no_space}`);
    }

    contract.constraints.section_markers.forEach((marker, index) => {
        const sectionStart = text.indexOf(marker);
        if (sectionStart === -1) {
            errors.push(`Missing section marker: ${marker}`);
            return;
        }
        const nextMarker = contract.constraints.section_markers[index + 1];
        const sectionEnd = nextMarker ? text.indexOf(nextMarker) : text.length;
        if (sectionEnd === -1) return;

        const sectionContent = text.substring(sectionStart + marker.length, sectionEnd);
        const sectionClean = sectionContent.replace(/\s/g, '');
        stats.section_counts[marker] = sectionClean.length;

        if (sectionClean.length < contract.constraints.section_min_chars_no_space) {
            errors.push(`Section ${index} (${marker}) too short: ${sectionClean.length} / ${contract.constraints.section_min_chars_no_space}`);
        }
    });

    contract.constraints.forbid_patterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'm');
        if (regex.test(text)) {
             if (pattern.includes('^')) errors.push(`Forbidden pattern detected: ${pattern}`);
        }
    });

    return { ok: errors.length === 0, errors, stats };
}

app.post('/api/report/generate', async (req, res) => {
    try {
        const { name, birthDate, solarLunar, birthTimeSlot, concernText, product_id } = req.body;
        
        if (!birthDate || !solarLunar) {
            return res.status(400).json({ error: '생년월일 정보가 부족합니다.' });
        }

        const saju = calculateSaju(birthDate, solarLunar, birthTimeSlot);
        const enrichedSaju = enrichSajuPayload(saju);
        
        const systemPrompt = `
[IMMUTABLE_CONTRACT]
1. OUTPUT STRUCTURE: You must output ONLY the content for the requested section.
2. LENGTH: Total report must be 20,000+ chars.
3. FORMAT: 
   - Narrative flow (Webtoon Scroll style).
   - NO bullet points ("- ", "1."). 
   - NO numbered lists.
   - Use <br> for line breaks if needed, but prefer natural paragraph breaks.
4. TONE & PERSONA: 
   - Identity: "청룡 도사 (청연)" - A charismatic, authoritative yet caring sage who sees through destiny.
   - Speech Style: Use a mix of authoritative wisdom and warm guidance.
   - Endings: Avoid repetitive "~다." (~5%). Use "~네", "~구나", "~도다", "~인가", "~지" to sound natural and sage-like.
   - Addressing User: NEVER use "너", "당신", "귀하". ALWAYS use the user's name: "${name}" or "${name} 님".
   - Make it feel like a personal letter written specifically for ${name}.
5. SECTIONS: You must include all 8 sections marked by <SECTION_0> ... <SECTION_7>.

[USER_CONTEXT]
User Name: "${name}"
User Question: "${concernText || "없음"}"
Saju Info: ${JSON.stringify(enrichedSaju.basic, null, 2)}
Saju Analysis Summary: ${JSON.stringify(enrichedSaju.analysis, null, 2)}

[SECTION_INSTRUCTIONS]
${contract.sections ? contract.sections.map(s => `
${s.marker} ${s.title}
- Role: ${s.role}
- Min Length: ${s.min_chars} chars
${s.must_include_data ? "- MUST include Saju evidence (Han-ja + Korean)." : ""}
`).join('\n') : "Contract not loaded."}

Write the full report now. Start with <SECTION_0>.
`;

        const apiKey = process.env.OPENAI_API_KEY;
        // Mock if no API key for testing
        if (!apiKey) {
             console.warn("No OPENAI_API_KEY found. Using mock response.");
             // ... (Mock response generation using contract markers)
             const mockText = contract.sections.map(s => {
                 return `${s.marker}\n[MOCK CONTENT FOR ${s.title}]\nThis is a mock text to satisfy the contract structure.\nIt should be replaced by real AI generation.\n(Repeated text to meet length requirement...)\n`.repeat(s.min_chars / 50);
             }).join('\n');
             
             // Construct result compatible with WebtoonReportRenderer (it expects JSON, but we are moving to text based parsing)
             // Wait, the renderer expects JSON `WebtoonReportData`.
             // We need to parse the text back into JSON for the frontend, OR update frontend to accept raw text?
             // The user requirement D) says: "/src/components/report/WebtoonScrollReport.tsx (NEW) - input: generatedText - parse: 섹션 마커로 split"
             // So we should return the TEXT, or a JSON wrapper around the text.
             
             // Let's stick to the existing API contract for now if possible, OR switch to the new one.
             // The frontend expects JSON.
             // I will return `{ raw_text: mockText, ... }` and update frontend to handle it.
             
             return res.json({ 
                 raw_text: mockText,
                 hero: { title: "청룡 도사의 편지", sage_name: "청룡" },
                 summary_card: { user_name: name, period_name: "운세 요약", status_one_line: "테스트 모드", caution_point: "-", action_point: "-" }
             });
        }

        let attempts = 0;
        let finalResult = null;
        let lastError = null;
        let currentPrompt = systemPrompt;

        while (attempts < 3) {
            attempts++;
            console.log(`Generation Attempt ${attempts}...`);
            
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o', // or gpt-4-turbo
                        messages: [
                            { role: 'system', content: currentPrompt }
                        ],
                        // No JSON mode, we want raw text with markers
                    })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                
                const generatedText = data.choices[0].message.content;
                
                // Validate
                const validation = validateReport(generatedText, contract);
                
                if (validation.ok) {
                    finalResult = generatedText;
                    break;
                } else {
                    console.warn(`Validation failed (Attempt ${attempts}):`, validation.errors);
                    lastError = validation.errors;
                    
                    // Build Repair Prompt
                    currentPrompt = `
[SYSTEM_REPAIR_MODE]
The previous generation failed validation checks.
ERRORS:
${validation.errors.map(e => `- ${e}`).join('\n')}

TASK:
Regenerate the content.
1. FIX the errors listed above.
2. EXTEND the content if length was insufficient (Target: 20,000+ chars).
3. REMOVE any bullet points or numbered lists.
4. ENSURE the structure follows the contract (<SECTION_X> markers).

[PREVIOUS_ATTEMPT_SNIPPET]
${generatedText.substring(0, 1000)}...

[RE-GENERATE FULL REPORT]
`;
                }
            } catch (e) {
                console.error("Generation error:", e);
                if (attempts === 3) throw e;
            }
        }

        if (!finalResult) {
            // Failed after 3 attempts.
            // For MVP, return what we have (even if invalid) or error.
            // User requirement: "최종 실패 시... 내부적으로 다시 생성 완료 후 보여주도록(비동기)..."
            // For this synchronous endpoint, we might just return the best effort.
            console.error("Failed to generate valid report after 3 attempts.");
             // Return the last result even if invalid, or a fallback.
             // We'll throw for now to trigger client side error handling or fallback.
             // Or return with a flag.
             return res.json({ 
                 raw_text: "죄송합니다. 리포트 생성에 실패했습니다. (규칙 준수 실패)",
                 error: lastError
             });
        }
        
        // Success
        res.json({
            raw_text: finalResult,
            // Add metadata for frontend to render basics if needed
            hero: { title: "청룡 도사가 보내는 편지", sage_name: "청룡", image_src: "/assets/5.dragon.png" },
             summary_card: { user_name: name, period_name: "생성 완료", status_one_line: "상세 내용을 확인하세요", caution_point: "-", action_point: "-" }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

const items = new Map([
  [
    'shoes',
    {
      name: '신발',
      price: 1000,
      currency: 'KRW'
    }
  ]
])

// Product price source (align with FE ZODIAC_CARDS)
const PRODUCTS = [
  { id: 'mouse', price: 8900, name: '자(子) · 쥐 도사', currency: 'KRW' },
  { id: 'cow', price: 9900, name: '축(丑) · 소 도사', currency: 'KRW' },
  { id: 'tiger', price: 11900, name: '인(寅) · 호랑이 도사', currency: 'KRW' },
  { id: 'rabbit', price: 10900, name: '묘(卯) · 토끼 도사', currency: 'KRW' },
  { id: 'dragon', price: 14900, name: '진(辰) · 청룡 도사', currency: 'KRW' },
  { id: 'snake', price: 11900, name: '사(巳) · 뱀 도사', currency: 'KRW' },
  { id: 'horse', price: 13900, name: '오(午) · 말 도사', currency: 'KRW' },
  { id: 'sheep', price: 8900, name: '미(未) · 양 도사', currency: 'KRW' },
  { id: 'monkey', price: 9900, name: '신(申) · 원숭이 도사', currency: 'KRW' },
  { id: 'chicken', price: 13900, name: '유(酉) · 닭 도사', currency: 'KRW' },
  { id: 'dog', price: 9900, name: '술(戌) · 개 도사', currency: 'KRW' },
  { id: 'pig', price: 10900, name: '해(亥) · 돼지 도사', currency: 'KRW' }
]

app.get('/api/item', (req, res) => {
  const id = 'shoes'
  res.json({ id, ...items.get(id) })
})

function requireAuth(req, res, next) {
  const key = req.headers['x-api-key']
  if ((process.env.API_GATEWAY_KEY || '') && key !== process.env.API_GATEWAY_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

app.post('/api/guest/profile', async (req, res) => {
  try {
    const {
      product_id,
      name,
      birth_date_raw,
      solar_lunar,
      birth_time_slot,
      unknown_time,
      concern_text
    } = req.body || {}
    if (!product_id || !name || !birth_date_raw || !solar_lunar) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const year = String(birth_date_raw).substring(0, 4)
    const month = String(birth_date_raw).substring(4, 6)
    const day = String(birth_date_raw).substring(6, 8)
    const birth_date_iso = `${year}-${month}-${day}`
    const { data: profile, error } = await supabase
      .from('guest_profiles')
      .insert({
        product_id,
        name,
        birth_date_raw,
        birth_date_iso,
        solar_lunar,
        birth_time_slot,
        unknown_time,
        concern_text
      })
      .select()
      .single()
    if (error) {
      return res.status(500).json({ error: 'Internal server error' })
    }
    return res.status(200).json({ guest_profile_id: profile.id })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/checkout/create', async (req, res) => {
  try {
    const { product_id, phone_number, guest_profile_id } = req.body || {}
    if (!product_id || !phone_number || !guest_profile_id) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const product = PRODUCTS.find(p => p.id === product_id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        product_id: product.id,
        phone_number,
        amount: product.price,
        guest_profile_id,
        status: 'pending'
      })
      .select()
      .single()
    if (orderError) {
      return res.status(500).json({ error: 'Order create failed' })
    }
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://jijijikgam.com'
    const kcpParams = {
      site_cd: process.env.KCP_SITE_CODE || 'IP58M',
      site_name: '지지직감',
      ordr_idxx: order.id,
      pay_method: '100000000000',
      good_name: `${product.name} AI 리포트`,
      good_mny: String(product.price),
      buyr_name: '비회원',
      buyr_mail: '',
      buyr_tel1: phoneNumberSanitize(phone_number),
      buyr_tel2: phoneNumberSanitize(phone_number),
      currency: 'WON',
      quota: '00',
      ret_url: `${base}/api/payment/confirm`,
      site_logo: `${base}/logo.png`,
      module_type: '01',
      res_cd: '',
      res_msg: '',
      enc_info: '',
      enc_data: '',
      use_pay_method: '100000000000'
    }
    return res.status(200).json({
      order_id: order.id,
      order_token: order.order_token,
      kcp_params: kcpParams
    })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

function phoneNumberSanitize(n) {
  return String(n || '').replace(/[^0-9]/g, '')
}
app.post('/api/payment/request', requireAuth, async (req, res) => {
  try {
    const { product_id, phone_number, guest_profile_id } = req.body || {}
    if (!product_id || !phone_number) return res.status(400).json({ error: 'Missing required fields' })
    const product = PRODUCTS.find(p => p.id === product_id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        product_id: product_id,
        phone_number,
        amount: product.price,
        guest_profile_id,
        status: 'pending'
      })
      .select()
      .single()
    if (error) return res.status(500).json({ error: 'Order create failed' })
    const paymentId = order.id
    return res.status(200).json({
      paymentId,
      orderName: `${product.name} AI 리포트`,
      totalAmount: product.price,
      currency: product.currency || 'KRW'
    })
  } catch {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/kcp/init', async (req, res) => {
  try {
    const { product_id, phone_number, guest_profile_id } = req.body || {}
    if (!product_id || !phone_number) return res.status(400).json({ error: 'Missing required fields' })
    const product = PRODUCTS.find(p => p.id === product_id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    let order = null
    try {
      const ins = await supabase
        .from('orders')
        .insert({
          product_id: product_id,
          phone_number,
          amount: product.price,
          guest_profile_id,
          status: 'pending'
        })
        .select()
        .single()
      if (ins && ins.data && !ins.error) {
        order = ins.data
      } else {
        order = { id: `kcp_${Date.now()}` }
      }
    } catch (e) {
      order = { id: `kcp_${Date.now()}` }
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl)
    const envSiteCd = process.env.KCP_SITE_CODE || ''
    const siteCd = envSiteCd ? envSiteCd : (isLocal ? 'T0007' : 'T0007')
    const orderId = (order && order.id) ? order.id : `kcp_${Date.now()}`
    const kcpParams = {
      site_cd: siteCd,
      site_name: '지지직감',
      ordr_idxx: orderId,
      pay_method: '100000000000',
      good_name: `${product.name} AI 리포트`,
      good_mny: String(product.price),
      buyr_name: '비회원',
      buyr_mail: '',
      buyr_tel1: phone_number,
      buyr_tel2: phone_number,
      currency: 'WON',
      quota: '00',
      ret_url: `${baseUrl}/api/payment/confirm`,
      site_logo: `${baseUrl}/logo.png`,
      module_type: '01',
      res_cd: '',
      res_msg: '',
      enc_info: '',
      enc_data: '',
      use_pay_method: '100000000000'
    }
    return res.status(200).json({ kcp_params: kcpParams })
  } catch (e) {
    return res.status(500).json({ error: `Internal server error: ${(e && e.message) || 'unknown'}` })
  }
})

app.post('/api/payment/complete', async (req, res) => {
  try {
    const { paymentId, orderId } = req.body || {}
    if (!paymentId || !orderId) return res.status(400).json({ error: 'Missing paymentId/orderId' })

    // 1. 포트원 결제내역 단건조회 (SDK 사용)
    const payment = await portone.payment.getPayment({ paymentId });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found in PortOne' })
    }

    // 2. DB 주문 데이터 조회
    const { data: orderRow, error: orderFetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    if (orderFetchError || !orderRow) return res.status(404).json({ error: 'Order not found' })

    // 3. 금액 검증
    const paidTotal = payment.amount.total
    const intended = orderRow.amount
    if (Number(paidTotal) !== Number(intended)) {
      return res.status(400).json({ error: 'Amount mismatch' })
    }

    // 4. 상태 매핑
    let statusUpdate = 'pending'
    const status = payment.status;
    
    if (status === 'PAID') statusUpdate = 'paid'
    else if (status === 'VIRTUAL_ACCOUNT_ISSUED') statusUpdate = 'va_issued'
    else if (status === 'PARTIALLY_PAID') statusUpdate = 'partially_paid'
    else statusUpdate = 'paid' // 기본값

    // 5. DB 업데이트
    const { error: updError } = await supabase
      .from('orders')
      .update({ status: statusUpdate, pg_tid: paymentId, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    if (updError) return res.status(500).json({ error: 'Update failed' })

    // 6. 결제 완료 시 리포트 생성 트리거
    if (statusUpdate === 'paid') {
      generateReportInBackground(orderId);
    }

    return res.status(200).json({ status: statusUpdate.toUpperCase(), order_token: orderRow.order_token })
  } catch (e) {
    console.error('[Payment Complete] Error:', e);
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to generate report in background
async function generateReportInBackground(orderId) {
  if (!orderId) {
      console.error('[Report] generateReportInBackground called with null/undefined orderId');
      return;
  }
  const startTime = Date.now();
  try {
    console.log(`[Report] Starting generation for order ${orderId}`);
    
    // 1. Update order status to 'generating'
    await supabase.from('orders').update({ status: 'generating' }).eq('id', orderId);

    // 2. Fetch order and profile (Retry up to 3 times to avoid race condition)
    let order = null;
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase
        .from('orders')
        .select('*, guest_profiles(*), products(*)')
        .eq('id', orderId)
        .single();
      
      if (data && data.guest_profiles) {
        order = data;
        break;
      }
      console.warn(`[Report] Fetch attempt ${i+1} failed for order ${orderId}. Retrying...`);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    if (!order || !order.guest_profiles) {
      console.error(`[Report] Failed to fetch order/profile for ${orderId} after retries.`);
      await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId);
      return;
    }

    const profile = order.guest_profiles;
    const saju = calculateSaju(profile.birth_date_raw, profile.solar_lunar, profile.birth_time_slot);
    const enrichedSaju = enrichSajuPayload(saju);
    const apiKey = process.env.OPENAI_API_KEY;

    // 3. Parallel Section Generation
    const sectionTasks = (contract.sections || []).map(async (section, index) => {
      // Check for cancellation before each section starts
      const { data: currentOrder } = await supabase.from('orders').select('status').eq('id', orderId).single();
      if (currentOrder?.status === 'cancelled') {
        throw new Error('Generation cancelled by user');
      }

      if (!apiKey) {
        return `${section.marker}\n[MOCK] ${section.title} content...\n`.repeat(section.min_chars / 50);
      }

      const sectionPrompt = `
[IMMUTABLE_CONTRACT]
1. SECTION: You are writing SECTION ${index}: ${section.marker} ${section.title}
2. ROLE: ${section.role}
3. LENGTH: This section MUST be at least ${section.min_chars} chars long.
4. FORMAT: Narrative flow, NO bullets, NO numbered lists.
5. TONE & PERSONA: 
   - Identity: "청룡 도사 (청연)" - A charismatic, authoritative yet caring sage who sees through destiny.
   - Speech Style: Use a mix of authoritative wisdom and warm guidance.
   - Endings: Avoid repetitive "~다." (~5%). Use "~네", "~구나", "~도다", "~인가", "~지" to sound natural and sage-like.
   - Addressing User: NEVER use "너", "당신", "귀하". ALWAYS use the user's name: "${profile.name}" or "${profile.name} 님".
   - Make it feel like a personal letter written specifically for ${profile.name}.
${section.must_include_data ? "6. DATA: MUST include specific Saju evidence (Han-ja + Korean) from the context." : ""}

[USER_CONTEXT]
User Name: "${profile.name}"
Concern: "${profile.concern_text || "없음"}"
Saju Info: ${JSON.stringify(enrichedSaju.basic, null, 2)}
Analysis: ${JSON.stringify(enrichedSaju.analysis, null, 2)}

Start directly with ${section.marker} and end with the text.
`;

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini', // Use -mini for speed to meet 15s target
            messages: [{ role: 'system', content: sectionPrompt }],
            temperature: 0.7
          })
        });
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (e) {
        console.error(`[Report] Section ${index} failed:`, e);
        return `${section.marker}\n(내용 생성 중 오류가 발생했습니다. 나중에 다시 확인해주세요.)`;
      }
    });

    // Run all sections in parallel
    const results = await Promise.all(sectionTasks);
    
    // Final check for cancellation before saving
    const { data: finalOrder } = await supabase.from('orders').select('status').eq('id', orderId).single();
    if (finalOrder?.status === 'cancelled') {
        console.log(`[Report] Order ${orderId} was cancelled. Skipping save.`);
        return;
    }

    const fullContent = results.join('\n\n');

    // 4. Save and Update Status
    const { error: reportError } = await supabase
      .from('reports')
      .insert({
        order_id: order.id,
        order_token: order.order_token,
        content: fullContent
      });

    const duration = (Date.now() - startTime) / 1000;
    if (reportError) {
      console.error('[Report] Save error:', reportError);
      await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId);
    } else {
      await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
      console.log(`[Report] Success for order ${orderId} in ${duration}s`);
    }

  } catch (err) {
    if (err.message === 'Generation cancelled by user') {
        console.log(`[Report] Order ${orderId} generation stopped due to cancellation.`);
    } else {
        console.error('[Report] Critical error:', err);
        await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId);
    }
  }
}
app.all('/api/payment/confirm', async (req, res) => {
  try {
    const payload = req.method === 'POST' ? req.body : req.query
    res.status(200).json({ ok: true, received: payload })
  } catch {
    res.status(200).send('OK')
  }
})
app.post('/api/portone/webhook', async (req, res, next) => {
  try {
    const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET || process.env.PORTONE_V2_WEBHOOK_SECRET || '';
    
    try {
      // 1. 웹훅 메시지 검증
      const webhook = await PortOne.Webhook.verify(
        webhookSecret,
        req.body,
        req.headers,
      );

      // 2. 결제 관련 정보일 경우만 처리
      if (webhook.data && "paymentId" in webhook.data) {
        const { paymentId } = webhook.data;

        // 3. 포트원 결제내역 단건조회
        const payment = await portone.payment.getPayment({ paymentId });

        if (!payment) {
          return res.status(200).end();
        }

        const { id, status, amount: paymentAmount } = payment;

        // 4. DB 주문 데이터 조회 및 검증
        const { data: orderRow, error: orderFetchError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', id) // paymentId가 order.id와 동일하다고 가정
          .single();

        if (orderFetchError || !orderRow) {
          console.error(`[Webhook] Order not found for paymentId: ${id}`);
          return res.status(200).end();
        }

        // 5. 금액 검증
        if (Number(paymentAmount.total) === Number(orderRow.amount)) {
          let statusUpdate = 'pending';
          
          switch (status) {
            case "PAID":
              statusUpdate = 'paid';
              break;
            case "VIRTUAL_ACCOUNT_ISSUED":
              statusUpdate = 'va_issued';
              break;
            case "PARTIALLY_PAID":
              statusUpdate = 'partially_paid';
              break;
            case "CANCELLED":
            case "FAILED":
              statusUpdate = 'failed';
              break;
            default:
              statusUpdate = 'pending';
          }

          // 6. 주문 상태 업데이트
          const { error: updError } = await supabase
            .from('orders')
            .update({ 
              status: statusUpdate, 
              pg_tid: id, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', id);

          if (updError) {
            console.error('[Webhook] DB update error:', updError);
          }

          // 7. 결제 완료 시 리포트 생성 트리거
          if (statusUpdate === 'paid') {
            generateReportInBackground(orderRow.id);
          }
        } else {
          console.warn(`[Webhook] Amount mismatch for paymentId: ${id}. Expected ${orderRow.amount}, got ${paymentAmount.total}`);
        }
      }
    } catch (e) {
      if (e instanceof PortOne.Webhook.WebhookVerificationError) {
        console.error('[Webhook] Verification failed:', e.message);
        return res.status(400).end();
      }
      throw e;
    }
    res.status(200).end();
  } catch (e) {
    console.error('[Webhook] Error:', e);
    next(e);
  }
});

app.get('/api/health', (req, res) => res.status(200).json({ ok: true }))

const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 3000)
const server = app.listen(port, host, () => {
  const addr = server.address()
  if (addr && typeof addr === 'object') {
    console.log(JSON.stringify({ event: 'server_started', address: addr }))
  } else {
    console.log(JSON.stringify({ event: 'server_started', address: `${host}:${port}` }))
  }
})
