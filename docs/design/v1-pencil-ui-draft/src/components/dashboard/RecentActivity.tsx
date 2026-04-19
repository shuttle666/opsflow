
import { History, CheckCircle, FileText, Bell } from 'lucide-react';

const activities = [
    {
        id: 1,
        title: "Job #2045 completed",
        description: "by Mike Ross",
        time: "2 mins ago",
        icon: CheckCircle,
        iconColor: "text-emerald-500",
        iconBg: "bg-emerald-50"
    },
    {
        id: 2,
        title: "New invoice sent",
        description: "to Sarah Jenkins",
        time: "15 mins ago",
        icon: FileText,
        iconColor: "text-brand-500",
        iconBg: "bg-brand-50"
    },
    {
        id: 3,
        title: "New job request",
        description: "from Alex Chen",
        time: "1h ago",
        icon: Bell,
        iconColor: "text-amber-500",
        iconBg: "bg-amber-50"
    }
];

const RecentActivity = () => {
    return (
        <div className="w-[360px] flex flex-col min-h-0 bg-white/70 backdrop-blur-md rounded-[32px] border border-white/50 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-brand-50 rounded-2xl text-brand-600">
                    <History size={20} />
                </div>
                <h2 className="font-sans font-bold text-lg text-slate-900">Recent Activity</h2>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 p-4 rounded-[20px] hover:bg-white transition-colors group border border-transparent hover:border-brand-100 cursor-pointer">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${activity.iconBg} ${activity.iconColor} shadow-sm`}>
                            <activity.icon size={18} />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-900 truncate">{activity.title}</span>
                            <span className="text-xs text-slate-500 truncate">{activity.description}</span>
                        </div>
                        <span className="text-[10px] font-mono font-medium text-slate-400 mt-1 whitespace-nowrap">{activity.time}</span>
                    </div>
                ))}
            </div>
            
            <button className="mt-auto w-full py-3 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold transition-colors">
                View All History
            </button>
        </div>
    );
};

export default RecentActivity;
