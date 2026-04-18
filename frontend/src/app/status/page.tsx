"use client";

import { useState } from 'react';
import { Search, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function StatusPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const checkStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/status?identifier=${encodeURIComponent(identifier)}`);
      const data = await res.json();
      if (data.status === 'success') {
        setResult(data);
      } else {
        setError(data.message || 'Order not found');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 relative overflow-hidden flex flex-col items-center justify-center">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-500/20 blur-[150px] pointer-events-none rounded-full" />
      
      <div className="w-full max-w-md z-10 relative">
        <Link href="/" className="inline-flex items-center text-white/50 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Launchpad
        </Link>
        
        <h1 className="text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          Check Order Status
        </h1>

        <form onSubmit={checkStatus} className="mb-8 relative flex shadow-2xl">
          <input 
            type="text" 
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="Enter Order ID or Phone..." 
            className="w-full bg-white/5 border-y border-l border-white/10 rounded-l-2xl p-5 text-lg outline-none focus:bg-white/10 transition-colors"
          />
          <button 
            type="submit" 
            disabled={loading || !identifier.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 border-y border-r border-purple-500/50 rounded-r-2xl px-8 flex items-center justify-center transition-colors shadow-lg shadow-purple-500/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden">
             {result.order_status === 'READY' && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />}
             
             <div className="text-center space-y-6 relative z-10">
               <div>
                  <h3 className="text-white/50 text-sm uppercase tracking-wider font-bold mb-1">Order Number</h3>
                  <p className="text-2xl font-mono">{result.order_id}</p>
               </div>
               
               <div className="h-px w-full bg-white/10" />
               
               <div className="flex justify-center flex-col items-center">
                  {result.order_status === 'READY' ? (
                     <div className="flex flex-col items-center text-emerald-400">
                        <CheckCircle2 className="w-16 h-16 mb-2" />
                        <span className="text-3xl font-black tracking-tight">READY</span>
                        <p className="text-white/70 text-sm mt-2 font-medium">Head to the kiosk for pickup!</p>
                     </div>
                  ) : result.order_status === 'IN KITCHEN' ? (
                     <div className="flex flex-col items-center">
                        <div className="text-orange-400 font-black tracking-tight text-3xl mb-4 flex items-center gap-2">
                           <Loader2 className="w-8 h-8 animate-spin" /> IN KITCHEN
                        </div>
                        <div className="bg-black/50 w-full rounded-2xl py-6 border border-white/5 shadow-inner">
                           <div className="text-5xl font-light text-purple-300">
                             {result.wait_time_secs} <span className="text-lg opacity-50 font-normal">sec</span>
                           </div>
                           <div className="text-xs uppercase font-bold text-white/40 mt-1">Est. Wait Time</div>
                        </div>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center">
                        <div className="text-blue-400 font-black tracking-tight text-3xl mb-4 flex items-center gap-2">
                           <Loader2 className="w-8 h-8 animate-spin" /> QUEUED
                        </div>
                        <p className="text-white/50 text-sm">Waiting for Kitchen Agent to pick up your order…</p>
                        <div className="bg-black/50 w-full rounded-2xl py-6 border border-white/5 shadow-inner mt-4">
                           <div className="text-5xl font-light text-blue-300">
                             {result.wait_time_secs} <span className="text-lg opacity-50 font-normal">sec</span>
                           </div>
                           <div className="text-xs uppercase font-bold text-white/40 mt-1">Est. Wait Time</div>
                        </div>
                     </div>
                  )}
               </div>
             </div>
          </div>
        )}
      </div>
    </main>
  );
}
