
import React, { useState, useEffect, useMemo } from 'react';
import { getFoodPopularityStats } from '../../services/mockApi';
import type { MenuItem } from '../../types';

const StarDisplay: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
            <svg key={i} xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-600'}`} viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588 1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        ))}
        <span className="text-xs text-gray-400 ml-2 font-bold">{rating.toFixed(1)}</span>
    </div>
);

const SentimentBadge: React.FC<{ rating: number }> = ({ rating }) => {
    if (rating >= 4.5) return <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded font-black uppercase">Loved by all</span>;
    if (rating >= 3.5) return <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-black uppercase">Recommended</span>;
    if (rating > 0) return <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded font-black uppercase">Developing</span>;
    return <span className="bg-gray-500/10 text-gray-500 text-[10px] px-2 py-0.5 rounded font-black uppercase">No feedback</span>;
}

const FoodPopularityPage: React.FC = () => {
    const [stats, setStats] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getFoodPopularityStats();
                // Sort by composite score (Rating * weight + Favorites * weight)
                data.sort((a, b) => {
                    const scoreA = (a.averageRating || 0) * 10 + (a.favoriteCount || 0);
                    const scoreB = (b.averageRating || 0) * 10 + (b.favoriteCount || 0);
                    return scoreB - scoreA;
                });
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch food popularity stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const maxFavorites = useMemo(() => Math.max(...stats.map(s => s.favoriteCount || 1), 1), [stats]);

    if (loading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-12 bg-gray-800 rounded-3xl w-1/3"></div>
                <div className="bg-gray-800 p-8 rounded-[2.5rem] shadow-xl border border-gray-700 h-96"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">Insights & <span className="text-indigo-400">Popularity</span></h1>
            <p className="text-gray-400 mb-8 font-medium">Real-time data aggregated from customer favorites and feedback.</p>

            {stats.length > 0 ? (
                <div className="bg-gray-800/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 border-b border-white/5">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Rank</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Food Item</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Performance</th>
                                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Fans</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {stats.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-all group">
                                        <td className="px-6 py-6">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/30 font-black text-xs">
                                                {index === 0 ? '🏆' : index + 1}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-xl shadow-inner">
                                                    {item.emoji}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white group-hover:text-indigo-400 transition-colors">{item.name}</p>
                                                    <SentimentBadge rating={item.averageRating || 0} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="space-y-1.5">
                                                <StarDisplay rating={item.averageRating || 0} />
                                                <div className="w-32 h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000"
                                                        style={{ width: `${(item.averageRating || 0) * 20}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xl font-black text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]">
                                                    {item.favoriteCount || 0}
                                                </span>
                                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Favorites</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-24 bg-gray-800/20 border-2 border-dashed border-white/5 rounded-[3rem]">
                    <span className="text-6xl block mb-6 grayscale opacity-30">📉</span>
                    <h3 className="text-2xl font-black text-gray-400 uppercase">Insufficient Data</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">
                        Collect more orders and feedbacks to unlock popularity analytics.
                    </p>
                </div>
            )}
            
            <div className="mt-8 p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl">
                <div className="flex gap-4 items-start">
                    <span className="text-2xl">💡</span>
                    <div>
                        <p className="text-indigo-200 font-bold">Pro Tip</p>
                        <p className="text-indigo-300/70 text-sm">Items with low favorites but high ratings are "Hidden Gems". Consider running an offer to boost their visibility!</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FoodPopularityPage;
