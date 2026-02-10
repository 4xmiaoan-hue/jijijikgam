import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import WebtoonScrollReport from '../components/report/WebtoonScrollReport';
import { computeSaju, SajuResult } from '../lib/saju-calculator';

export default function ReportResult() {
    const { orderToken } = useParams<{ orderToken: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [reportContent, setReportContent] = useState<string>('');
    const [profile, setProfile] = useState<any>(null);
    const [sajuResult, setSajuResult] = useState<SajuResult | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderToken) {
            setError('토큰이 없습니다.');
            setLoading(false);
            return;
        }

        async function fetchData() {
            try {
                // 1. Get Report
                let report;
                try {
                    const { data, error: rError } = await supabase
                        .from('reports')
                        .select('content, order_id')
                        .eq('order_token', orderToken)
                        .single();
                    
                    if (rError) throw rError;
                    report = data;
                } catch (e: any) {
                    console.warn('[Supabase] Fetch failed, checking for mock data...', e.message);
                    // Mock data fallback for test token
                    if (orderToken === '4594a95df15793cd58609aa698d81b7eec25dda4733320fce1ab86c06aeea2ab') {
                        report = {
                            content: `<SECTION_0>민수님의 총운\n민수님은 갑자일주로 태어나셨군요. 지혜롭고 총명하며 예술적인 감각이 뛰어난 사주입니다. 올해는 직업적으로 큰 변화가 예상되며, 새로운 도전을 통해 한 단계 도약하는 시기가 될 것입니다.\n\n<SECTION_1>올해의 직업운\n직업운은 매우 긍정적입니다. 상반기에는 기존의 성과를 인정받아 승진이나 좋은 조건의 이직 제안이 있을 수 있습니다. 자신의 역량을 믿고 과감하게 추진해 보세요.\n\n<SECTION_2>이동수와 변화\n올해는 역마의 기운이 강하게 들어와 있습니다. 하반기에 주거지 이동이나 해외 파견 등 큰 이동수가 보이네요. 이러한 변화는 민수님의 운의 흐름을 더욱 좋게 만들어줄 것입니다.\n\n<SECTION_3>성격과 기질\n부드러운 카리스마를 지닌 민수님은 주변 사람들에게 신뢰를 주는 타입입니다. 다만, 때로는 너무 신중하여 기회를 놓칠 수 있으니 결단력을 키우는 것이 중요합니다.\n\n<SECTION_4>사업 및 재물운\n사업을 구상 중이시라면 동업보다는 독자적인 운영이 유리합니다. 재물운은 꾸준히 상승하는 곡선을 그리며, 특히 문서운이 좋아 계약이나 부동산 투자에 길한 해입니다.\n\n<SECTION_5>애정 및 건강운\n애정운은 평탄하며, 싱글이라면 새로운 인연을 만날 기회가 많아집니다. 건강 면에서는 위장 건강에 유의하시고 규칙적인 식습관을 유지하시길 권합니다.`,
                            order_id: 'mock-order-id'
                        };
                    } else {
                        throw new Error('리포트를 찾을 수 없습니다. (데이터베이스 연결 오류)');
                    }
                }

                setReportContent(report.content);

                // 2. Get Order -> Profile
                let profileData;
                try {
                    const { data: order, error: oError } = await supabase
                        .from('orders')
                        .select('guest_profile_id')
                        .eq('id', report.order_id)
                        .single();

                    if (oError || !order) throw new Error('주문 정보를 찾을 수 없습니다.');

                    const { data: pData, error: pError } = await supabase
                        .from('guest_profiles')
                        .select('*')
                        .eq('id', order.guest_profile_id)
                        .single();

                    if (pError || !pData) throw new Error('프로필 정보를 찾을 수 없습니다.');
                    profileData = pData;
                } catch (e) {
                    // Mock profile fallback
                    if (orderToken === '4594a95df15793cd58609aa698d81b7eec25dda4733320fce1ab86c06aeea2ab') {
                        profileData = {
                            name: '민수',
                            birth_date_iso: '1998-02-24',
                            birth_time_slot: '03:30~05:29 인시',
                            solar_lunar: 'solar',
                            gender: 'female',
                            concern_text: '올해의 직업운과 이동수'
                        };
                    } else {
                        throw e;
                    }
                }
                
                setProfile(profileData);

                // 3. Compute Saju
                try {
                    const saju = computeSaju(
                        profileData.name,
                        profileData.birth_date_iso,
                        profileData.solar_lunar === 'lunar' ? 'lunar' : 'solar',
                        false, // Leap month handling (simplified)
                        profileData.birth_time_slot.includes('야자') ? '야자' : 
                        profileData.birth_time_slot.includes('조자') ? '조자' : 
                        profileData.birth_time_slot.split(' ')[1] || '자', // Extract branch
                        profileData.gender || 'unknown'
                    );
                    setSajuResult(saju);
                } catch (e) {
                    console.error('Saju Calc Error:', e);
                }

            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [orderToken]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50">
                <div className="animate-spin w-12 h-12 border-4 border-amber-300 border-t-amber-600 rounded-full mb-4"></div>
                <p className="text-stone-500 font-serif animate-pulse">운세 리포트를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md w-full">
                    <div className="text-4xl mb-4">🙏</div>
                    <h3 className="text-xl font-bold text-stone-800 mb-2 font-serif">리포트 조회 실패</h3>
                    <p className="text-stone-500 mb-6">{error}</p>
                    <button 
                        onClick={() => navigate('/')}
                        className="w-full py-3 bg-stone-800 text-white rounded-xl hover:bg-stone-700 transition-colors font-bold"
                    >
                        홈으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <WebtoonScrollReport 
            rawText={reportContent} 
            profile={profile}
            sajuResult={sajuResult}
        />
    );
}

