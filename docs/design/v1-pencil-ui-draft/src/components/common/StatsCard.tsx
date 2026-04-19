
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatsCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend?: number;
    trendLabel?: string;
    iconBg?: string;
    iconColor?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, trendLabel, iconBg = 'bg-brand-50', iconColor = 'text-accent' }) => {
    return (
        <div className="flex flex-col gap-3 p-5 bg-white/70 backdrop-blur-md rounded-[32px] border border-white/50 shadow-sm hover:shadow-cyan-500/10 transition-shadow">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${iconBg} ${iconColor}`}>
                    {icon}
                </div>
                <span className="font-sans text-sm font-medium text-slate-500">{title}</span>
            </div>
            
            <div className="flex flex-col items-start gap-1">
                <span className="font-mono text-3xl font-bold tracking-tight text-slate-900">{value}</span>
                {trend !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1">
                        {trend > 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        ) : trend < 0 ? (
                            <TrendingDown className="w-4 h-4 text-rose-500" />
                        ) : (
                            <Minus className="w-4 h-4 text-slate-400" />
                        )}
                        <span className={`text-xs font-semibold ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{trendLabel}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
