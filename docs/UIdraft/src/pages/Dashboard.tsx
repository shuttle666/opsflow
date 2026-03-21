
import Header from '../components/layout/Header';
import StatsCard from '../components/common/StatsCard';
import JobsSchedule from '../components/dashboard/JobsSchedule';
import RecentActivity from '../components/dashboard/RecentActivity';
import { Briefcase, CreditCard, Users, History } from 'lucide-react';

const Dashboard = () => {
    return (
        <div className="flex flex-col gap-8 h-full">
            <Header title="Dashboard" />
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard 
                    title="Revenue" 
                    value="$48,200" 
                    icon={<CreditCard size={18} />} 
                    trend={12} 
                    trendLabel="+12% from last month"
                />
                <StatsCard 
                    title="Active Jobs" 
                    value="24" 
                    icon={<Briefcase size={18} />} 
                    iconBg="bg-brand-50"
                    iconColor="text-brand-600"
                    trend={8} 
                    trendLabel="+3 new today"
                />
                <StatsCard 
                    title="Avg. Time" 
                    value="2h 15m" 
                    icon={<History size={18} />} 
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    trend={-5} 
                    trendLabel="-5% faster"
                />
                <StatsCard 
                    title="Team Active" 
                    value="12/15" 
                    icon={<Users size={18} />} 
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                    trend={0} 
                    trendLabel="All systems normal"
                />
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
                <JobsSchedule />
                <RecentActivity />
            </div>
        </div>
    );
};

export default Dashboard;
