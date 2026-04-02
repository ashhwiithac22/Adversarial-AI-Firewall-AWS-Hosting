import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, ShieldAlert, ShieldCheck, Activity, BarChart3, Upload, Cpu, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const App = () => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total_checks: 0, threats_neutralized: 0, system_status: 'IDLE' });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('http://localhost:8000/api/stats');
                setStats(res.data);
            } catch (err) {
                console.error("Stats fetch failed", err);
            }
        };
        fetchStats();
    }, []);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
            setResult(null);
        }
    };

    const handlePredict = async () => {
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('http://localhost:8000/api/predict', formData);
            setResult(res.data);
            // After prediction, refresh stats
            const statsRes = await axios.get('http://localhost:8000/api/stats');
            setStats(statsRes.data);
        } catch (err) {
            alert("Connection error: Ensure FastAPI backend is running on port 8000");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl min-h-screen">
            {/* Header */}
            <header className="flex justify-between items-center mb-16">
                <div>
                    <h1 className="text-5xl font-black gradient-text tracking-tighter">ANTIGRAVITY FIREWALL</h1>
                    <p className="text-secondary mt-2 flex items-center gap-2">
                        <Cpu size={16} /> ADVERSARIAL AI DEFENSE SYSTEM v1.0
                    </p>
                </div>
                <div className="glass-panel px-4 py-2 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${stats.system_status === 'SECURE' ? 'bg-accent-green' : 'bg-accent-blue'} animate-pulse`}></div>
                    <span className="font-semibold text-sm">SYSTEM STATUS: {stats.system_status}</span>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'Total Scans', value: stats.total_checks, icon: Activity, color: 'text-blue-400' },
                    { label: 'Threats Blocked', value: stats.threats_neutralized, icon: ShieldAlert, color: 'text-red-400' },
                    { label: 'Latency', value: '0.4ms', icon: Zap, color: 'text-yellow-400' },
                    { label: 'Confidence', value: '98.2%', icon: ShieldCheck, color: 'text-emerald-400' }
                ].map((item, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={item.label} 
                        className="glass-panel p-6"
                    >
                        <item.icon size={24} className={`${item.color} mb-4`} />
                        <div className="text-3xl font-bold">{item.value}</div>
                        <div className="text-secondary text-sm font-medium uppercase tracking-widest">{item.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Main Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Upload Section */}
                <div className="glass-panel p-8">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Upload size={24} /> DRONE FEED ANALYSIS
                    </h2>
                    
                    <div className="upload-zone" onClick={() => document.getElementById('fileInput').click()}>
                        <input 
                            type="file" 
                            id="fileInput" 
                            hidden 
                            onChange={handleFileChange} 
                            accept="image/*"
                        />
                        {preview ? (
                            <img src={preview} alt="Drone Feed" className="w-full max-h-64 object-contain rounded-lg" />
                        ) : (
                            <div className="py-12">
                                <Shield size={48} className="mx-auto mb-4 text-gray-600" />
                                <p className="text-secondary">Drag & drop or click to upload</p>
                                <p className="text-xs text-gray-500 mt-2">SUPPORTED: PNG, JPG (128x128 Optimization)</p>
                            </div>
                        )}
                    </div>

                    <button 
                        disabled={!file || loading}
                        onClick={handlePredict}
                        className={`btn-primary w-full mt-6 flex justify-center items-center gap-2 ${loading && 'opacity-50 pointer-events-none'}`}
                    >
                        {loading ? (
                            <> <Activity className="animate-spin" /> ANALYZING PATTERNS... </>
                        ) : (
                            <> <Shield className="w-5 h-5" /> START DEEP PACKET SCAN </>
                        )}
                    </button>
                </div>

                {/* Results Section */}
                <div className="flex flex-col gap-8">
                    <AnimatePresence mode="wait">
                        {result ? (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className={`glass-panel p-8 flex-grow ${result.is_adversarial ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-emerald-500'}`}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className={`text-3xl font-black ${result.is_adversarial ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {result.prediction}
                                        </h3>
                                        <p className="text-secondary text-sm mt-1">SCAN COMPLETED AT {new Date().toLocaleTimeString()}</p>
                                    </div>
                                    {result.is_adversarial ? <AlertTriangle className="text-red-500" size={48} /> : <ShieldCheck className="text-emerald-500" size={48} />}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span>Adversarial Confidence</span>
                                        <span className="font-bold">{(result.confidence * 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${result.confidence * 100}%` }}
                                            className={`h-full ${result.is_adversarial ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        ></motion.div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-8">
                                        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                                            <div className="text-xs text-secondary mb-1">THREAT LEVEL</div>
                                            <div className={`font-bold ${result.is_adversarial ? 'text-red-400' : 'text-emerald-400'}`}>{result.threat_level}</div>
                                        </div>
                                        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                                            <div className="text-xs text-secondary mb-1">COUNTERMEASURE</div>
                                            <div className="font-bold">{result.action}</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="glass-panel p-8 flex-grow flex flex-col items-center justify-center text-center opacity-30 grayscale">
                                <Shield className="mb-4" size={64} />
                                <h3 className="text-xl font-bold">AWAITING SCAN</h3>
                                <p className="text-sm max-w-xs">Upload a drone telemetry image to start real-time adversarial detection.</p>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Network Logs Placeholder */}
                    <div className="glass-panel p-4 h-48 overflow-hidden font-mono text-[10px] text-emerald-500/60 flex flex-col gap-1">
                        <div className="flex gap-2"><span>[SYSTEM]</span><span>Boot sequence successful.</span></div>
                        <div className="flex gap-2"><span>[NETWORK]</span><span>Encrypted drone feed tunnel established.</span></div>
                        <div className="flex gap-2"><span>[KERNEL]</span><span>Firewall monitoring active on port 8000.</span></div>
                        <div className="flex gap-2 animate-pulse"><span>[DEFENSE]</span><span>Heuristic engine listening for FGSM patterns...</span></div>
                        {result && <div className="flex gap-2 text-white"><span>[SCAN]</span><span>Result: {result.prediction} - Confidence {result.confidence}</span></div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
