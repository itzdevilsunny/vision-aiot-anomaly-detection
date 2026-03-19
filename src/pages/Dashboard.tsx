import React from 'react';
import {
    Menu
} from 'lucide-react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAlertStore } from '../store/useAlertStore';
import { useAuthStore } from '../store/useAuthStore';
import NotificationDropdown from '../components/NotificationDropdown';

const MODULE_ORDER = [
    { path: '/dashboard', title: 'Overview' },
    { path: '/dashboard/cameras', title: 'Live Cameras' },
    { path: '/dashboard/alerts', title: 'Anomaly Alerts' },
    { path: '/dashboard/analytics', title: 'Analytics' },
    { path: '/dashboard/map', title: 'Zone Map' },
    { path: '/dashboard/edge', title: 'Edge Nodes' },
    { path: '/dashboard/security', title: 'Security' },
    { path: '/dashboard/storage', title: 'Storage' },
    { path: '/dashboard/settings', title: 'Settings' },
];

export default function DashboardLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const pendingAlertCount = useAlertStore((s) => s.alerts.filter(a => a.status === 'Pending').length);

    const currentIndex = MODULE_ORDER.findIndex((m) => m.path === location.pathname);

    return (
        <div className="flex h-screen bg-[#070D1F] text-slate-50 overflow-hidden font-body selection:bg-blue-500/30">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-950 flex flex-col py-6 font-medium text-sm border-r border-outline-variant/10 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}>
                <div className="px-6 mb-10 mt-2 flex items-center gap-3 shrink-0">
                    <img
                        src="/logo.png"
                        alt="VisionAIoT Logo"
                        className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.7)]"
                    />
                    <div>
                        <h1 className="text-blue-400 font-headline font-bold text-xl leading-none">VisionAIoT</h1>
                        <p className="text-[10px] text-slate-500 tracking-[0.2em] uppercase mt-1">Sentinel System</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto w-full">
                    <nav className="space-y-1 w-full">
                        <SidebarItem icon="dashboard" label="Overview" active={location.pathname === '/dashboard'} path="/dashboard" />
                        <SidebarItem icon="videocam" label="Live Cameras" active={location.pathname === '/dashboard/cameras'} badge="4" path="/dashboard/cameras" />
                        <SidebarItem icon="warning" label="Anomaly Alerts" active={location.pathname === '/dashboard/alerts'} badge={pendingAlertCount > 0 ? String(pendingAlertCount) : undefined} badgeColor="bg-red-500" path="/dashboard/alerts" />
                        <SidebarItem icon="analytics" label="Analytics" active={location.pathname === '/dashboard/analytics'} path="/dashboard/analytics" />
                        <SidebarItem icon="map" label="Zone Map" active={location.pathname === '/dashboard/map'} path="/dashboard/map" />
                    </nav>

                    <div className="mt-auto px-4 space-y-1 mt-8">
                        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest px-4 mb-2">Infrastructure</div>
                        <SidebarItem icon="router" label="Edge Nodes" active={location.pathname === '/dashboard/edge'} badge="3 Active" badgeColor="bg-emerald-500" path="/dashboard/edge" />
                        <SidebarItem icon="security" label="Security" active={location.pathname === '/dashboard/security'} path="/dashboard/security" />
                        <SidebarItem icon="storage" label="Storage" active={location.pathname === '/dashboard/storage'} path="/dashboard/storage" />
                        <SidebarItem icon="settings" label="Settings" active={location.pathname === '/dashboard/settings'} path="/dashboard/settings" />

                        <button
                            onClick={() => {
                                useAuthStore.getState().logout();
                                navigate('/');
                            }}
                            className="w-full mt-6 py-3 px-4 rounded-xl bg-surface-container-highest text-tertiary font-bold flex items-center justify-center gap-2 hover:bg-tertiary hover:text-on-tertiary transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">logout</span>
                            Exit Dashboard
                        </button>
                    </div>
                </div>
            </aside>

            {/* Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 bg-surface relative z-0">
                {/* Top Header */}
                <header className="absolute top-0 right-0 left-0 z-30 bg-slate-950/80 backdrop-blur-xl shadow-[0_20px_40px_rgba(59,130,246,0.08)] flex justify-between items-center w-full px-6 py-3 border-b border-outline-variant/10 h-16">
                    <div className="flex items-center gap-4 lg:gap-8">
                        <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-3 text-slate-400 text-lg">search</span>
                            <input className="bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-sm w-48 sm:w-64 lg:w-80 outline-none focus:ring-1 focus:ring-primary text-on-surface placeholder:text-slate-500 font-body" placeholder="Search system resources..." type="text" />
                        </div>
                        <nav className="hidden xl:flex items-center gap-6 font-headline text-sm tracking-tight">
                            <Link to="/dashboard" className={`pb-1 ${location.pathname === '/dashboard' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-blue-300 transition-colors'}`}>Overview</Link>
                            <Link to="/dashboard/cameras" className={`pb-1 ${location.pathname === '/dashboard/cameras' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-blue-300 transition-colors'}`}>Live Cameras</Link>
                            <Link to="/dashboard/alerts" className={`pb-1 ${location.pathname === '/dashboard/alerts' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-blue-300 transition-colors'}`}>Anomaly Alerts</Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <NotificationDropdown />
                        <div className="h-8 w-[1px] bg-outline-variant/30 mx-2 hidden sm:block"></div>
                        <div className="flex items-center gap-3 group cursor-pointer border border-transparent hover:border-slate-800 rounded-xl p-1 pr-2 transition-all">
                            <span className="text-right hidden sm:block">
                                <p className="text-xs font-bold font-headline text-on-surface">Alex Chen</p>
                                <p className="text-[10px] text-slate-500">System Admin</p>
                            </span>
                            <img alt="User Profile" className="w-10 h-10 rounded-xl object-cover ring-2 ring-transparent group-hover:ring-primary transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1oKCW0RZFlHJSe0SCXmH5XRQ__qBTxA-7teCSE8yO555ULk6Ze18z5x10y4uEPuDFAgmTCyoFGAAI4xTjb1mMvz0aCzkARevXDrs8H1gqatZ6Gamz0b7Ph-lv244zmZe-jTKkvZx-tpB5Ce6GcULUa4iEHrKnQoRBnOZMGXDa9SEOswKDpFbjfu-m94BCT02_677EIK6KX5WtpR2Om4vhhQ7ntcVElG_jPn_CYSHC-H69hC0Bt_1XrPJbM_OMPA1KIPqas3XvtFM" />
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 mt-16 p-4 sm:p-8 overflow-y-auto bg-surface w-full">
                    <Outlet />
                </main>

                {/* Floating Action Button */}
                <button className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-primary text-on-primary-fixed shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-50">
                    <span className="material-symbols-outlined">add</span>
                </button>
            </div>
        </div>
    );
}

// Helper Components
function SidebarItem({ icon, label, active, badge, badgeColor = "bg-blue-500", path = "/dashboard" }: { icon: string, label: string, active?: boolean, badge?: string, badgeColor?: string, path?: string }) {
    return (
        <Link to={path} className={`w-full flex items-center justify-between px-4 py-3 transition-all duration-200 cursor-pointer ${active
            ? 'bg-blue-500/10 text-blue-400 border-r-4 border-blue-500 hover:translate-x-1'
            : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200 hover:translate-x-1'
            }`}>
            <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined transition-colors ${active ? 'text-blue-400' : 'text-slate-500'}`}>
                    {icon}
                </span>
                <span className={`text-sm ${active ? 'text-white' : ''}`}>{label}</span>
            </div>
            {badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${badgeColor}`}>{badge}</span>
            )}
        </Link>
    );
}
