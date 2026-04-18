"use client";
import { useState } from 'react';
import { Upload, Camera, Cpu } from 'lucide-react';

export default function VisionCheckout() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const simulateCheckout = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/vision-checkout`, { method: 'POST' });
      const data = await res.json();
      await new Promise(r => setTimeout(r, 2000)); // Simulate Gemini Vision latency
      setResult(data);
    } catch(err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="min-h-screen items-center flex justify-center p-8 bg-[hsl(240,10%,8%)] text-white">
        <div className="max-w-xl w-full">
            <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
              <Camera className="text-blue-400" /> Vision Checkout <span className="text-sm bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Admin Test</span>
            </h1>
            <p className="text-white/60 mb-8">Simulate the overhead cameras by "uploading" a photo. The Gemini 1.5 Pro Agents will analyze this frame to charge the user.</p>
            
            <div 
              onClick={simulateCheckout}
              className="border-2 border-dashed border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all p-12 rounded-2xl flex flex-col items-center justify-center cursor-pointer min-h-[300px]"
            >
               {analyzing ? (
                  <>
                     <Cpu className="w-16 h-16 text-blue-400 animate-pulse mb-4" />
                     <p className="text-blue-300 text-xl animate-pulse">Gemini Vision is analyzing pixels...</p>
                  </>
               ) : (
                  <>
                     <Upload className="w-16 h-16 text-white/40 mb-4" />
                     <p className="text-xl text-white/60">Click to 'Upload' Camera Frame</p>
                  </>
               )}
            </div>

            {result && (
               <div className="mt-8 bg-emerald-900/40 border border-emerald-500/30 p-6 rounded-2xl">
                  <h3 className="text-2xl font-bold text-emerald-400 mb-4 border-b border-emerald-500/20 pb-2">Checkout Successful</h3>
                  <div className="space-y-2 mb-6">
                     {result.items.map((item: string, i: number) => (
                        <div key={i} className="flex justify-between text-lg">
                           <span>{item}</span>
                        </div>
                     ))}
                  </div>
                  <div className="flex justify-between text-2xl font-bold border-t border-white/10 pt-4">
                     <span>Total Billed to Account</span>
                     <span>{result.charged}</span>
                  </div>
               </div>
            )}
        </div>
    </div>
  )
}
