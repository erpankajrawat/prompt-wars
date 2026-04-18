"use client";

import { useEffect, useState } from 'react';
import { ChefHat, Flame, Users } from 'lucide-react';

interface QueueEntry {
  order_id: string;
  wait_time_secs: number;
}

export default function BigScreenDisplay() {
  const [inKitchen, setInKitchen] = useState<QueueEntry[]>([]);
  const [ready, setReady] = useState<QueueEntry[]>([]);
  
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch(`/api/kitchen-queue`);
        const data = await res.json();
        setInKitchen(data.in_kitchen || []);
        setReady(data.ready || []);
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-12 overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-16 border-b border-white/10 pb-8">
         <h1 className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 uppercase">
           Stadium Status
         </h1>
         <div className="flex space-x-6 text-2xl font-medium items-center">
            <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl">
               <Users className="text-blue-400 w-8 h-8"/> 
               <span>Restrooms: <span className="text-emerald-400 font-bold">2 min walk</span></span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-12 flex-1">
        {/* NOW SERVING — orders that are ready_for_pickup */}
        <div className="glass-panel p-10 flex flex-col relative overflow-hidden bg-white/[0.02]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px]" />
            <h2 className="text-4xl font-bold mb-8 flex items-center gap-4 text-emerald-400">
              <CheckCircle2Icon className="w-10 h-10" /> Now Serving
            </h2>
            <div className="flex flex-wrap gap-6">
                {ready.length > 0 ? ready.map((entry) => (
                  <div key={entry.order_id} className="text-5xl font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-8 py-6 rounded-2xl shadow-lg shadow-emerald-500/10 animate-bounce">
                      {entry.order_id.replace("ORDER-", "#")}
                  </div>
                )) : (
                  <div className="text-white/40 text-2xl">No orders ready yet.</div>
                )}
            </div>
        </div>

        {/* IN KITCHEN PREP — orders that are in_kitchen */}
        <div className="glass-panel p-10 flex flex-col relative overflow-hidden bg-white/[0.02]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px]" />
            <h2 className="text-4xl font-bold mb-8 flex items-center gap-4 text-orange-400">
               <Flame className="w-10 h-10" /> In Kitchen Prep
            </h2>
            <div className="flex flex-col gap-6">
                {inKitchen.length > 0 ? inKitchen.map((entry) => (
                   <div key={entry.order_id} className="text-3xl font-medium bg-white/5 px-6 py-4 rounded-xl border border-white/10 flex justify-between items-center tracking-tight">
                     <span>{entry.order_id.replace("ORDER-", "Order #")}</span>
                     <div className="flex items-center gap-6">
                         <span className={`text-xl font-light tracking-normal bg-black/50 px-4 py-2 rounded-lg border border-white/5 shadow-inner ${
                            entry.wait_time_secs > 15 
                               ? 'text-emerald-400' 
                               : entry.wait_time_secs > 0 
                                  ? 'text-orange-400' 
                                  : 'text-red-500 animate-pulse'
                         }`}>
                            <span className="font-bold">{entry.wait_time_secs > 0 ? entry.wait_time_secs : `+${Math.abs(entry.wait_time_secs)}`}</span> sec
                         </span>
                         <span className={`${entry.wait_time_secs > 0 ? 'text-orange-400' : 'text-red-500'} flex items-center gap-2`}>
                           <ChefHat className="w-5 h-5"/> {entry.wait_time_secs > 0 ? 'Prep' : 'DELAYED'}
                         </span>
                     </div>
                   </div>
                )) : (
                   <div className="text-white/40 text-2xl mt-4">Kitchen is clear.</div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}

// Icon component
function CheckCircle2Icon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
