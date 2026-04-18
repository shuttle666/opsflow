
import { Calendar } from 'lucide-react';

const jobs = [
    {
        id: 1,
        customerName: "Sarah Jenkins",
        address: "12 Ridge Rd, Austin",
        type: "HVAC Maintenance",
        status: "SCHEDULED",
        time: "10:00 AM",
        avatar: "SJ",
        avatarColor: "bg-sky-100 text-sky-700",
        badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-100"
    },
    {
        id: 2,
        customerName: "Mike Ross",
        address: "8805 Bee Caves Rd",
        type: "Plumbing Check",
        status: "IN_PROGRESS",
        time: "11:30 AM",
        avatar: "MR",
        avatarColor: "bg-slate-100 text-slate-600",
        badgeColor: "bg-amber-50 text-amber-600 border-amber-100"
    }
];

const JobsSchedule = () => {
    return (
        <div className="flex-1 flex flex-col min-w-0 bg-white/70 backdrop-blur-md rounded-[32px] border border-white/50 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-50 rounded-2xl text-brand-600">
                        <Calendar size={20} />
                    </div>
                    <h2 className="font-sans font-bold text-lg text-slate-900">Today's Schedule</h2>
                </div>
                <button className="text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors">View All</button>
            </div>

            <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                        <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            <th className="px-4 pb-2 w-1/3 min-w-[200px]">Customer</th>
                            <th className="px-4 pb-2 w-1/3 min-w-[180px]">Job Type</th>
                            <th className="px-4 pb-2 w-32">Status</th>
                            <th className="px-4 pb-2 w-24 text-right">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((job) => (
                            <tr key={job.id} className="group bg-white hover:bg-slate-50 transition-colors rounded-2xl shadow-sm hover:shadow-md cursor-pointer border border-transparent hover:border-brand-100 transform hover:-translate-y-0.5 duration-200">
                                <td className="p-4 first:rounded-l-2xl last:rounded-r-2xl border-l border-t border-b border-white hover:border-brand-100 first:border-l-transparent">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${job.avatarColor}`}>
                                            {job.avatar}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900">{job.customerName}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{job.address}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 border-t border-b border-white hover:border-brand-100">
                                    <span className="font-medium text-slate-700">{job.type}</span>
                                </td>
                                <td className="p-4 border-t border-b border-white hover:border-brand-100">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-mono font-bold border ${job.badgeColor}`}>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="p-4 last:rounded-r-2xl border-t border-b border-r border-white hover:border-brand-100 text-right">
                                    <div className="font-mono text-sm font-medium text-slate-600">{job.time}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default JobsSchedule;
