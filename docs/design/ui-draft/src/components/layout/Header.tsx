
import { Search, Bell } from 'lucide-react';

interface HeaderProps {
    title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
    return (
        <header className="flex items-center justify-between w-full h-[56px] min-h-[56px]">
            <h1 className="font-sans font-bold text-2xl text-slate-900">{title}</h1>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-[28px] h-10 px-4 shadow-sm w-[260px]">
                    <Search className="text-slate-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="bg-transparent border-none outline-none font-sans text-sm text-slate-800 placeholder-slate-400 ml-2 flex-1"
                    />
                </div>
                <button className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 rounded-[20px] shadow-sm hover:bg-slate-50 transition-colors">
                    <Bell className="w-5 h-5 text-slate-600" />
                </button>
            </div>
        </header>
    );
};

export default Header;
