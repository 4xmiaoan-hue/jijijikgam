import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { Button } from '../components/ui/button';
import { FileText, Share2, Download, ArrowLeft, Star, Quote } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ReactMarkdown from 'react-markdown';
import ModernLoading from '../components/ModernLoading';
import WebtoonScrollReport from '../components/report/WebtoonScrollReport';
import { computeSaju, SajuResult } from '../lib/saju-calculator';

export default function OrderReport() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [reportData, setReportData] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [sajuResult, setSajuResult] = useState<SajuResult | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [productName, setProductName] = useState<string>("");
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;
        let pollInterval: NodeJS.Timeout;

        const fetchReport = async () => {
            if (!token || isCancelled) return;

            try {
                // 1. Try to fetch existing report
                // Join guest_profiles via orders
                const { data: report, error: reportError } = await supabase
                    .from('reports')
                    .select(`
                        *, 
                        orders (
                            *, 
                            products (*),
                            guest_profiles (*)
                        )
                    `)
                    .eq('order_token', token)
                    .single();

                if (report && !reportError) {
                    setReportData(report);
                    if (report?.orders?.products?.name) {
                        setProductName(report.orders.products.name);
                    }
                    
                    const p = report.orders.guest_profiles;
                    if (p) {
                        setProfile(p);
                        try {
                             const saju = computeSaju(
                                p.name,
                                p.birth_date_iso,
                                p.solar_lunar === 'lunar' ? 'lunar' : 'solar',
                                false,
                                p.birth_time_slot.includes('야자') ? '야자' : 
                                p.birth_time_slot.includes('조자') ? '조자' : 
                                p.birth_time_slot.split(' ')[1] || '자', 
                                p.gender || 'unknown'
                            );
                            setSajuResult(saju);
                        } catch (e) {
                            console.error("Saju Calc Error", e);
                        }
                    }

                    setLoading(false);
                    return;
                }

                // 2. Check order status if report not found
                const { data: order, error: orderError } = await supabase
                    .from('orders')
                    .select('*, products(*)')
                    .eq('order_token', token)
                    .single();

                if (orderError || !order) {
                    setError("주문 정보를 찾을 수 없습니다.");
                    setLoading(false);
                    return;
                }

                setProductName(order.products.name);

                if (order.status === 'failed') {
                    setError("리포트 생성 중 오류가 발생했습니다. 고객센터로 문의해주세요.");
                    setLoading(false);
                    return;
                }

                // If generating or paid (but report record not yet created), keep polling
                // Increment progress for UX
                setProgress(prev => Math.min(prev + 10, 95));
                
                pollInterval = setTimeout(fetchReport, 2000);
            } catch (err) {
                console.error('Polling error:', err);
                pollInterval = setTimeout(fetchReport, 5000);
            }
        };

        fetchReport();

        return () => {
            isCancelled = true;
            if (pollInterval) clearTimeout(pollInterval);
        };
    }, [token, navigate]);

    const handleCancel = async () => {
        if (window.confirm("리포트 생성을 중단하고 홈으로 돌아가시겠습니까?")) {
            try {
                // Update status to cancelled in DB to stop background worker
                await supabase.from('orders').update({ status: 'cancelled' }).eq('order_token', token);
            } catch (e) {
                console.error('Failed to update cancel status:', e);
            }
            navigate('/');
        }
    };

    const handleRetry = () => {
        setError(null);
        setLoading(true);
        setProgress(0);
        // Polling will restart due to loading state change and useEffect dependencies
    };

    if (error) return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-5">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileText size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">문제가 발생했습니다</h2>
                <p className="text-gray-600 mb-8">{error}</p>
                <div className="flex flex-col gap-3">
                    <Button onClick={handleRetry} className="w-full rounded-full h-14 text-lg font-bold bg-stone-900 text-white">
                        다시 시도하기
                    </Button>
                    <Button onClick={() => navigate('/')} variant="outline" className="w-full rounded-full h-14 text-lg font-bold">
                        홈으로 돌아가기
                    </Button>
                </div>
            </div>
        </div>
    );

    if (loading) return (
        <ModernLoading 
            sageName={productName || "운명"} 
            progress={progress} 
            onCancel={handleCancel}
        />
    );

    const product = reportData.orders.products;

    // Check if the content contains section markers for Webtoon Scroll UI
    const isWebtoonFormat = reportData.content.includes('<SECTION_0>');

    if (isWebtoonFormat) {
        return <WebtoonScrollReport rawText={reportData.content} profile={profile} sajuResult={sajuResult} />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />
            
            <main className="flex-1 w-full max-w-[800px] mx-auto px-5 py-10 pt-[100px]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <button 
                            onClick={() => navigate('/')}
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                        >
                            <ArrowLeft size={16} />
                            <span className="text-xs font-bold">홈으로</span>
                        </button>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 flex items-center gap-3">
                            <span className="text-primary">{product.name}</span> 리포트
                        </h1>
                    </div>
                    
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button 
                            variant="outline"
                            size="sm"
                            className="flex-1 md:flex-none rounded-xl border-gray-200 text-xs font-bold gap-1.5"
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                alert('링크가 복사되었습니다.');
                            }}
                        >
                            <Share2 size={14} />
                            공유하기
                        </Button>
                        <Button 
                            variant="outline"
                            size="sm"
                            className="flex-1 md:flex-none rounded-xl border-gray-200 text-xs font-bold gap-1.5"
                            onClick={() => window.print()}
                        >
                            <Download size={14} />
                            PDF 저장
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden mb-10">
                    {/* Report Hero */}
                    <div className="relative h-48 md:h-64 bg-gray-900 overflow-hidden">
                        <div 
                            className="absolute inset-0 opacity-40 bg-center bg-cover"
                            style={{ backgroundImage: `url(${product.image || ''})` }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
                        <div className="absolute bottom-8 left-8 right-8">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex text-yellow-400">
                                    {[1,2,3,4,5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                                </div>
                                <span className="text-white/60 text-xs font-medium">Premium AI Analysis</span>
                            </div>
                            <div className="text-white text-xl md:text-2xl font-bold">
                                {reportData.orders.phone_number.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3')} 님의 운명 분석
                            </div>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="p-8 md:p-12 prose prose-gray max-w-none">
                        <div className="mb-10 p-6 bg-gray-50 rounded-2xl border border-gray-100 flex gap-4 italic text-gray-600 relative">
                            <Quote size={24} className="text-primary/20 shrink-0" />
                            <p className="text-sm md:text-base leading-relaxed">
                                본 리포트는 지지직감의 고유 알고리즘과 거대언어모델(LLM)을 결합하여 생성된 맞춤형 분석 결과입니다.
                            </p>
                        </div>

                        <div className="markdown-content">
                            <ReactMarkdown>{reportData.content}</ReactMarkdown>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-8 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-400 font-medium mb-6">
                            리포트 내용에 대해 더 궁금한 점이 있으신가요?
                        </p>
                        <Button 
                            className="rounded-full px-8 font-bold shadow-md"
                            onClick={() => alert('실시간 상담 기능은 준비 중입니다.')}
                        >
                            도사님과 실시간 대화하기 (Beta)
                        </Button>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
