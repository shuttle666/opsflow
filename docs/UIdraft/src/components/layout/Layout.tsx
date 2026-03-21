import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="flex h-screen w-full bg-page-gradient p-6 gap-6 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[50%] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.15)_0%,rgba(6,182,212,0)_70%)] blur-3xl pointer-events-none" />

            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col gap-6 w-full h-full relative z-10 overflow-y-auto pr-2 pb-2">
                {children}
            </main>
        </div>
    );
};

export default Layout;
