import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const SignIn = () => {
    const navigate = useNavigate();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock login
        navigate('/');
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-page-gradient relative overflow-hidden">
             {/* Background Glow - Same as Layout but centered */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,rgba(6,182,212,0)_70%)] blur-3xl pointer-events-none" />

            {/* Auth Card */}
            <div className="w-[400px] bg-white/70 backdrop-blur-xl rounded-[32px] border border-white/50 p-10 flex flex-col gap-8 shadow-2xl shadow-cyan-500/10 relative z-10">
                
                {/* Logo Area */}
                <div className="flex items-center gap-3 justify-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-md" />
                    <span className="font-sans font-bold text-2xl text-slate-900">OpsFlow</span>
                </div>

                {/* Text Group */}
                <div className="text-center flex flex-col gap-2">
                    <h1 className="font-sans font-bold text-2xl text-slate-900">Welcome back</h1>
                    <p className="font-sans text-sm text-slate-500">Sign in to your workspace</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-700 ml-1">Email</label>
                        <input 
                            type="email" 
                            placeholder="name@company.com" 
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-sans text-sm text-slate-800 placeholder:text-slate-400"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-xs font-semibold text-slate-700">Password</label>
                            <a href="#" className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">Forgot?</a>
                        </div>
                        <input 
                            type="password" 
                            placeholder="••••••••" 
                            className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-sans text-sm text-slate-800 placeholder:text-slate-400"
                        />
                    </div>

                    <button className="h-11 w-full bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold text-sm mt-2 shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 transition-all flex items-center justify-center gap-2 group">
                        <span>Sign In</span>
                        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-center gap-1 text-sm">
                    <span className="text-slate-500">Don't have an account?</span>
                    <Link to="/register" className="font-semibold text-cyan-600 hover:text-cyan-700">Register</Link>
                </div>
            </div>
        </div>
    );
};

export default SignIn;