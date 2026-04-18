
import { Home, Users, Briefcase, UserPlus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    return (
        <aside className="w-[260px] h-full flex flex-col gap-8 p-6 bg-white/60 backdrop-blur-md rounded-[32px] border border-white/40 shadow-lg shadow-cyan-500/5">
            {/* Logo */}
            <div className="flex items-center gap-3 h-10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-500 to-accent-DEFAULT" />
                <span className="font-sans font-bold text-xl text-slate-900">OpsFlow</span>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-2 flex-1">
                <NavLink 
                    to="/" 
                    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-full transition-colors ${
                        isActive 
                        ? 'bg-accent-light text-accent-DEFAULT' 
                        : 'hover:bg-white/40 text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Home size={20} />
                    <span className="font-sans font-medium text-sm">Dashboard</span>
                </NavLink>

                <NavLink 
                    to="/customers" 
                    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-full transition-colors ${
                        isActive 
                        ? 'bg-accent-light text-accent-DEFAULT' 
                        : 'hover:bg-white/40 text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Users size={20} />
                    <span className="font-sans font-medium text-sm">Customers</span>
                </NavLink>

                <NavLink 
                    to="/jobs" 
                    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-full transition-colors ${
                        isActive 
                        ? 'bg-accent-light text-accent-DEFAULT' 
                        : 'hover:bg-white/40 text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Briefcase size={20} />
                    <span className="font-sans font-medium text-sm">Jobs</span>
                </NavLink>

                <NavLink 
                    to="/team" 
                    className={({ isActive }) => `flex items-center gap-3 p-3 rounded-full transition-colors ${
                        isActive 
                        ? 'bg-accent-light text-accent-DEFAULT' 
                        : 'hover:bg-white/40 text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <UserPlus size={20} />
                    <span className="font-sans font-medium text-sm">Team</span>
                </NavLink>
            </nav>

            {/* Profile */}
            <div className="flex items-center gap-3 p-3 rounded-full bg-white/50 border border-white/50">
                <div className="w-8 h-8 rounded-full bg-slate-200" />
                <div className="flex flex-col">
                    <span className="font-sans font-semibold text-xs text-slate-900">Alex Chen</span>
                    <span className="font-sans font-medium text-[11px] text-slate-500">Owner</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
