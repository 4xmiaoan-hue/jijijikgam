import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import WebtoonScrollReport from '../components/report/WebtoonScrollReport';
import { computeSaju, SajuResult } from '../lib/saju-calculator';

// Supabase Init (Should be in context/lib but inline for now)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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
                const { data: report, error: rError } = await supabase
                    .from('reports')
                    .select('content, order_id')
                    .eq('order_token', orderToken)
                    .single();

                if (rError || !report) throw new Error('리포트를 찾을 수 없습니다.');
                setReportContent(report.content);

                // 2. Get Order -> Profile
                const { data: order, error: oError } = await supabase
                    .from('orders')
                    .select('guest_profile_id')
                    .eq('id', report.order_id)
                    .single();

                if (oError || !order) throw new Error('주문 정보를 찾을 수 없습니다.');

                const { data: profileData, error: pError } = await supabase
                    .from('guest_profiles')
                    .select('*')
                    .eq('id', order.guest_profile_id)
                    .single();

                if (pError || !profileData) throw new Error('프로필 정보를 찾을 수 없습니다.');
                
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

