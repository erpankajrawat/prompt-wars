"use client";
import { useState } from 'react';
import { Camera, CheckCircle } from 'lucide-react';

export default function KioskPage() {
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState<null | string>(null);

  const handleScanSimulation = async () => {
    // In a real app we'd use a webcam to read the QR Code using react-qr-reader.
    // For this simulation, we simulate scanning the entered Order ID.
    try {
      const res = await fetch(`/api/kiosk-pickup/${orderId}`, {
         method: 'POST'
      });
      const data = await res.json();
      if(data.status === 'success') {
         setStatus(`Success! Delivered ${orderId}. Removed from Agent Queue.`);
         setOrderId("");
      } else {
         setStatus("Error: " + data.message);
      }
    } catch (err) {
       setStatus("Connection Error to Backend Agent");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-black">
      <div className="glass-panel p-10 max-w-lg w-full flex flex-col items-center">
         <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6">
            <Camera className="w-10 h-10 text-primary" />
         </div>
         <h1 className="text-3xl font-bold mb-2">Worker Kiosk</h1>
         <p className="text-white/60 text-center mb-8">Scan attending QR codes to dispatch order and notify the Optimization Agent.</p>
         
         <div className="w-full space-y-4">
            <input 
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Simulated Scan (Enter Order ID like ORDER-100)"
              className="w-full bg-black/50 border border-white/20 p-4 rounded-xl text-white"
            />
            <button 
              onClick={handleScanSimulation}
              className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200"
            >
              Simulate Scan Complete
            </button>
         </div>

         {status && (
            <div className="mt-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 flex items-center gap-2">
               <CheckCircle className="w-5 h-5"/> {status}
            </div>
         )}
      </div>
    </div>
  );
}
