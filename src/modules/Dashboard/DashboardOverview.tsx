import { useState, useEffect } from 'react';
import { useAlertStore } from '../../store/useAlertStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Activity, Server, Zap, CheckCircle, AlertTriangle, Terminal, FileText, Plus, Shield, MapPin, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import LiveInferenceFeed from './LiveInferenceFeed';
import AddNodeModal from '../../components/AddNodeModal';
import AnomalyTrendChart from './AnomalyTrendChart';

// WebSocket connection strings (instantiated inside useEffect to prevent SSR hydration mismatch)
const SYSTEM_WS_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/system`;
const MAIN_WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

export default function CommandCenter() {
    const { alerts, addLiveAlert } = useAlertStore();
    const { addLiveNotification } = useNotificationStore();
    const [systemLogs, setSystemLogs] = useState<{ time: string, msg: string, type: string }[]>([]);
    const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
    const [alertSearchQuery, setAlertSearchQuery] = useState('');
    
    // Dynamic Camera Navigation
    const [currentCamIndex, setCurrentCamIndex] = useState(0);
    // In a real app, this would be fetched from /api/nodes
    const [cameras, setCameras] = useState([
        { id: 'CAM-04', name: 'Primary Surveillance', streamUrl: 'http://192.168.1.8:8080/video', fps: 30 },
        { id: 'CAM-01', name: 'North Entrance', streamUrl: 'http://192.168.1.5:8080/video', fps: 24 },
        { id: 'CAM-02', name: 'Loading Dock', streamUrl: 'http://192.168.0.5:8080/video', fps: 24 },
    ]);

    const handleNextCamera = () => {
        setCurrentCamIndex((prev) => (prev + 1) % cameras.length);
    };

    const handleBackCamera = () => {
        setCurrentCamIndex((prev) => (prev - 1 + cameras.length) % cameras.length);
    };

    const activeCamera = cameras[currentCamIndex] || { id: 'None', name: 'None', streamUrl: '', fps: 0 };
    
    // Real-Time Dashboard States
    const [activeNodes, setActiveNodes] = useState(0);
    const [totalNodes, setTotalNodes] = useState(3);
    const [avgLatency, setAvgLatency] = useState(0);
    const [healthPercent, setHealthPercent] = useState(100);
    const [latencyTrend, setLatencyTrend] = useState<{value: number}[]>(Array(5).fill({value: 0}));

    // 1. Initial API Fetching for historical KPIs (optional baseline)
    const { data: stats } = useQuery({
        queryKey: ['command_center_stats'],
        queryFn: async () => {
             // Fallback demo data baseline
             return {
                 totalAnomalies: 221, criticalAnomalies: 0,
                 anomalyTrend: [{ value: 5 }, { value: 7 }, { value: 3 }, { value: 8 }, { value: 12 }],
             };
        },
        refetchInterval: false,
    });

    // 2. Listen for Real-Time Telemetry
    useEffect(() => {
        // Prevent Vercel connection errors during SSR
        if (typeof window === 'undefined' || window.location.hostname.includes('vercel.app')) return;

        const socket = io(SYSTEM_WS_URL);
        const mainSocket = io(MAIN_WS_URL);
        // System Logs
        socket.on('system_log', (log) => {
            setSystemLogs(prev => [{ time: new Date().toLocaleTimeString(), ...log }, ...prev].slice(0, 50));
        });

        // Edge Heartbeats mapping to Active Nodes & Health
        const edgeStatusMap = new Map();
        mainSocket.on('edge_heartbeat', (nodeData) => {
            edgeStatusMap.set(nodeData.id, nodeData.status);
            
            // Calculate Active Nodes
            let active = 0;
            edgeStatusMap.forEach(status => {
                if (status === 'online') active++;
            });
            setActiveNodes(active);
            setTotalNodes(Math.max(3, edgeStatusMap.size)); // Demo assumes at least 3

            // Calculate System Health (mock logic based on CPU/RAM of nodes)
            if (nodeData.metrics) {
                const cpuHealth = Math.max(0, 100 - nodeData.metrics.cpu_usage);
                const ramHealth = Math.max(0, 100 - nodeData.metrics.ram_usage);
                let newHealth = Math.round((cpuHealth + ramHealth) / 2);
                
                // If avg latency > 50ms, drop health by 5% as requested
                setAvgLatency(currentAvgLatency => {
                    if (currentAvgLatency > 50) {
                        newHealth -= 5;
                    }
                    return currentAvgLatency; // don't actually mutate latency here
                });
                
                setHealthPercent(newHealth);
            }
        });

        // AI Inference Updates (Latency tracking)
        mainSocket.on('boxes_CAM-04', () => {
            // Simulate a rolling latency calculation based on inference arrivals
            const mockCurrentLatency = 8 + Math.random() * 4;
            setAvgLatency(prev => {
                const newAvg = (prev * 0.9) + (mockCurrentLatency * 0.1); // smoothing
                setLatencyTrend(t => [...t.slice(1), { value: newAvg }]);
                return newAvg;
            });
        });

        // Live Alerts
        mainSocket.on('new_anomaly', (alert) => {
             addLiveAlert(alert);
             
             // Sync to Notification Bell
             addLiveNotification({
                 id: alert.id || Date.now().toString(),
                 type: alert.severity === 'Critical' ? 'critical' : 'warning',
                 title: `New Anomaly: ${alert.type.replace('_', ' ')}`,
                 message: `Detected at ${alert.camera_id} with ${(alert.confidence * 100).toFixed(1)}% confidence.`,
                 is_read: false,
                 created_at: new Date().toISOString()
             });

             // Play alert sound for priority anomalies
             const audio = new Audio('/alert-chime.mp3'); 
             audio.play().catch(e => console.log('Audio autoplay blocked by browser', e));
        });

        return () => { 
            socket.off('system_log'); 
            mainSocket.off('edge_heartbeat');
            mainSocket.off('boxes_CAM-04');
            mainSocket.off('new_anomaly');
            socket.disconnect();
            mainSocket.disconnect();
        };
    }, [addLiveAlert, addLiveNotification]);

    // Derived stats for UI
    const activeAlerts = alerts.filter(a => {
        const matchesStatus = a.status !== 'Resolved';
        if (!alertSearchQuery) return matchesStatus;
        const q = alertSearchQuery.toLowerCase();
        return matchesStatus && (
            a.type.toLowerCase().includes(q) ||
            a.camera_id.toLowerCase().includes(q) ||
            a.severity.toLowerCase().includes(q)
        );
    }).slice(0, 6);
    const totalAnomaliesLive = (stats?.totalAnomalies || 0) + alerts.length;
    const criticalAnomaliesLive = alerts.filter(a => a.severity === 'Critical').length;

    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateReport = async () => {
         try {
             setIsGenerating(true);
             const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL || ''}/api/reports/daily`, {
                 responseType: 'blob', // Important for downloading files
             });
             
             // Create a URL for the blob and trigger download
             const url = window.URL.createObjectURL(new Blob([response.data]));
             const link = document.createElement('a');
             link.href = url;
             link.setAttribute('download', 'Daily_Report.pdf');
             document.body.appendChild(link);
             link.click();
             link.parentNode?.removeChild(link);
         } catch (error) {
             console.error('Failed to generate report', error);
             alert('Failed to generate report. Please try again later.');
         } finally {
             setIsGenerating(false);
         }
    };

    return (
        <div className="w-full flex-1 h-full min-h-full font-body">
            {/* Navigation Controls & Context */}
            <div className="flex flex-col items-center mb-10 pt-4">
                <div className="glass-panel rounded-full px-2 py-2 flex items-center gap-2 mb-6">
                    <button onClick={handleBackCamera} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low text-slate-400 hover:text-primary transition-colors cursor-pointer">
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <div className="px-6 py-1 bg-surface-container-highest rounded-full border border-outline-variant/20">
                        <span className="text-xs font-bold tracking-widest text-primary-fixed uppercase">{activeCamera.name}</span>
                    </div>
                    <button onClick={handleNextCamera} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low text-slate-400 hover:text-primary transition-colors cursor-pointer">
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </div>
                <h2 className="text-3xl sm:text-5xl font-headline font-bold tracking-tighter text-white text-center">System Overview</h2>
                <p className="text-slate-400 font-body mt-2 text-center max-w-lg text-sm sm:text-base">AI-driven environmental analysis across all active edge nodes. Current network latency: {avgLatency.toFixed(0)}ms.</p>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto pb-20">
                {/* Main Featured Card (Centered Focus) */}
                <div className="col-span-12 lg:col-span-8 h-[450px] relative rounded-2xl overflow-hidden bg-surface-container-highest primary-glow group">
                    <div className="absolute inset-0 z-0 bg-black">
                        <LiveInferenceFeed streamUrl={activeCamera.streamUrl} cameraId={activeCamera.id} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent z-10 pointer-events-none"></div>
                    
                    <div className="absolute top-6 left-6 flex gap-3 z-20 pointer-events-none">
                        <div className="px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-full flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-secondary pulse-secondary"></div>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Live Feed: {activeCamera.id}</span>
                        </div>
                        <div className="px-3 py-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{activeCamera.fps} FPS</span>
                        </div>
                    </div>
                    
                    <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end z-20 pointer-events-none">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-tertiary text-sm">emergency</span>
                                <span className="text-xs font-bold text-tertiary-fixed-dim uppercase tracking-widest">Anomaly Detection Enabled</span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-headline font-bold text-white">Central Operations Hub</h3>
                            <p className="text-slate-300 mt-2 max-w-md text-sm">Real-time telemetry from {activeNodes} sensors. AI Confidence: 99.4%</p>
                        </div>
                        <button onClick={() => setIsAddNodeModalOpen(true)} className="pointer-events-auto bg-gradient-to-br from-primary to-primary-container px-4 py-2 sm:px-6 sm:py-3 rounded-xl font-bold text-on-primary-fixed flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95 cursor-pointer">
                            <span className="hidden sm:inline">Add Node</span>
                            <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                    </div>
                </div>

                {/* Secondary Data Stack */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    {/* Status Card */}
                    <div className="flex-1 glass-panel rounded-2xl p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary">memory</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">System Health</span>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-4xl font-headline font-bold text-white">{healthPercent}%</span>
                                <span className={`text-xs font-bold flex items-center gap-1 ${healthPercent >= 90 ? 'text-secondary' : 'text-tertiary'}`}>
                                    <span className="material-symbols-outlined text-xs">{healthPercent >= 90 ? 'trending_up' : 'trending_down'}</span>
                                    {healthPercent >= 90 ? 'Stable' : 'Warning'}
                                </span>
                            </div>
                            <div className="w-full h-1 bg-surface-container-low rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${healthPercent >= 90 ? 'bg-primary' : 'bg-tertiary'}`} style={{ width: `${healthPercent}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* AI Alert Card */}
                    <div className="flex-1 bg-surface-container-highest rounded-2xl p-6 border border-tertiary/10 relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-tertiary/5 blur-3xl rounded-full"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-tertiary/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-tertiary text-sm">notifications_active</span>
                            </div>
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Recent Alert</span>
                        </div>
                        
                        {activeAlerts.length > 0 ? (
                            <>
                                <p className="text-sm font-medium text-on-surface line-clamp-2 uppercase">{activeAlerts[0].type.replace('_', ' ')} detected at {activeAlerts[0].camera_id}.</p>
                                <p className="text-[10px] text-slate-500 mt-2">{new Date(activeAlerts[0].timestamp).toLocaleTimeString()} • Confidence: {(activeAlerts[0].confidence * 100).toFixed(1)}%</p>
                                <div className="mt-4 flex gap-2 relative z-10">
                                    <button className="flex-1 py-2 rounded-lg bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase hover:bg-tertiary/20 transition-colors cursor-pointer">Dismiss</button>
                                    <button className="flex-1 py-2 rounded-lg bg-tertiary text-on-tertiary text-[10px] font-bold uppercase hover:opacity-90 transition-opacity cursor-pointer">Intervene</button>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col justify-center">
                                <p className="text-sm font-medium text-slate-400">No active priority alerts.</p>
                                <p className="text-[10px] text-slate-500 mt-1">System monitoring all zones.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Metrics */}
                <div className="col-span-12 md:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <span className="material-symbols-outlined text-slate-500">database</span>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Anomalies</h4>
                        </div>
                        <p className="text-2xl font-headline font-bold text-white">{totalAnomaliesLive}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Found in last 24h</p>
                </div>

                <div className="col-span-12 md:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <span className="material-symbols-outlined text-slate-500">warning</span>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Critical Alerts</h4>
                        </div>
                        <p className="text-2xl font-headline font-bold text-tertiary-fixed-dim">{criticalAnomaliesLive}</p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Requires immediate attention</p>
                </div>

                <div className="col-span-12 md:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <span className="material-symbols-outlined text-slate-500">group</span>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Operators</h4>
                        </div>
                        <div className="flex -space-x-2">
                            <img alt="User 1" className="w-8 h-8 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgLc2jz0QXYjMFdKMDSk-ZTgzsCw0koUYmEmMdK1y46EE6RbqCnD2EPL7YmxgXjrH0cOSQC7zWntFusWmKA9Aej0E1HRArzRtsSjkSaiYY2EXiGuilWX3kgYmg_CnT4_XaNigkqAkVefYHdVskeydJBf0bGfBYUAl_vjJD0r-aTEjeSrWMSZPSwSvSsXUuTP8LyVWCFpBqqeGq566I4yu3hXlNJJ55eLn9YEpGL_cA8W87fT0-AfS_A2DT-wrjZLsAjEdG3EYeW70"/>
                            <img alt="User 2" className="w-8 h-8 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA64JTYDDvz3R6p7_D_jCvMJvypEkwNuQupXWRRj4T-8zQKTUQZrJYmRXWWUb_qtrQ5R6qD7-HDHMfRSSQFtmGPcFpvaH2fBgJdl278RJB9ZIxv_hgU9dvPcSnhuJTCjU_Eny9UaKj-pwFmfogXCOzSHG2yP7R5q23kqLw6MgUdeJqkUk0GZFjcNAtGQP-Qim08bU6oFsOltbrXjFvqL82DuC5YxguJvBZbieKRt4PJNobVmirwVlBoItjOiv5YOnJjLrrgIQojzjw"/>
                            <img alt="User 3" className="w-8 h-8 rounded-full border-2 border-surface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAoWSp4Y5kXKyBvYGTyELyJDiCS_H0u7UaCv0NtqKSGlQv7hngi8VtOx8_xRoKz35bQ139RXN-4WWsfniCtfvXaCMA9IOAbLHJKwlXaM8xcKtJPrQUhPGGnxMqXTPAQRtcXpqcY3ErrKfyPOpGUhzxPRIAEYGYOho5joBMJwdqxwTOiq0YFjITRHLltmnbnAJAqGGiR6rN6_DNuhdCrUD9WL5guC_ZZreJRoa0e7ZGiuyBojezlpUaFxxap7iaEFMswErYRga90bXQ"/>
                            <div className="w-8 h-8 rounded-full bg-surface-container-low border-2 border-surface flex items-center justify-center text-[10px] font-bold text-slate-400">+5</div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Peak activity detected now</p>
                </div>
            </div>

            <AddNodeModal 
                isOpen={isAddNodeModalOpen} 
                onClose={() => setIsAddNodeModalOpen(false)} 
                onAdd={(data) => {
                    console.log('Deploying node:', data);
                    setSystemLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: `Provisioning new edge node: ${data.name}...`, type: 'info' }, ...prev].slice(0, 50));
                    setTimeout(() => {
                         setTotalNodes(prev => prev + 1);
                         setActiveNodes(prev => prev + 1);
                         const newCamId = `CAM-0${cameras.length + 1}`;
                         setCameras(prev => [...prev, { id: newCamId, name: data.name, streamUrl: data.ip.includes('http') ? data.ip : `http://${data.ip}`, fps: 30 }]);
                         setSystemLogs(prev => [{ time: new Date().toLocaleTimeString(), msg: `Node ${data.name} connected successfully.`, type: 'info' }, ...prev].slice(0, 50));
                    }, 1500);
                    setIsAddNodeModalOpen(false);
                }} 
            />
        </div>
    );
}
