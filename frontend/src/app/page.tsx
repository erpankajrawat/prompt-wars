"use client";

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { ShoppingBag, Clock, CheckCircle2, Phone, AlertCircle } from 'lucide-react';

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderState, setOrderState] = useState<'IDLE' | 'ORDERING' | 'WAITING' | 'READY'>('IDLE');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  
  // Hardcoded menu
  const menu = [
    { id: 'hd1', name: 'Premium Hot Dog', price: 8.5 },
    { id: 'bz1', name: 'Craft Beer', price: 12.0 },
    { id: 'pz1', name: 'Slice of Pepperoni', price: 9.0 },
  ];
  const [cart, setCart] = useState<string[]>([]);

  const handleOrder = async () => {
    if (!phoneNumber) return alert("Enter phone number for OTP");
    if (cart.length === 0) return alert("Add items to cart");
    
    setOrderState('ORDERING');
    
    try {
      const res = await fetch('http://localhost:8000/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_phone: phoneNumber, items: cart })
      });
      const data = await res.json();
      setOrderDetails(data);
      setOrderState('WAITING');
    } catch (err) {
      console.error(err);
      setOrderState('IDLE');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24 relative overflow-hidden">
      {/* Dynamic Background Effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent mb-8 z-10 tracking-tight">
        Astro Concessions
      </h1>

      {orderState === 'IDLE' && (
        <div className="w-full max-w-md space-y-6 z-10 glass-panel p-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" /> Select Items
            </h2>
            {menu.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5 hover:border-primary/50 transition-colors">
                <span>{item.name} <span className="text-white/50 text-sm ml-2">${item.price}</span></span>
                <button 
                  onClick={() => setCart([...cart, item.id])}
                  className="px-3 py-1 bg-primary/20 text-primary rounded-full hover:bg-primary hover:text-white transition-colors text-sm font-medium"
                >
                  Add
                </button>
              </div>
            ))}
          </div>

          <div className="bg-secondary/50 p-4 rounded-xl space-y-2 border border-white/10">
            <p className="text-sm text-white/70">Cart: {cart.length} items</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2"><Phone className="w-4 h-4"/> Phone Number (For Mock OTP)</label>
            <input 
              type="tel"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="e.g. 555-0100"
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <button 
            onClick={handleOrder}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-4 rounded-xl glow-button flex justify-center items-center gap-2"
          >
            Place Order
          </button>
        </div>
      )}

      {orderState === 'ORDERING' && (
        <div className="z-10 flex flex-col items-center space-y-4 w-full max-w-md glass-panel p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-white/80 animate-pulse">Agents orchestrating flow...</p>
        </div>
      )}

      {orderState === 'WAITING' && orderDetails && (
        <div className="w-full max-w-md space-y-6 z-10 glass-panel p-8 text-center flex flex-col items-center">
          <div className="bg-primary/20 p-4 rounded-full mb-2">
            <Clock className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold">Order Received!</h2>
          <p className="text-white/60">Your order #{orderDetails.order_id} is being prioritized by the Kitchen Agent.</p>
          
          <div className="bg-black/50 border border-white/10 rounded-2xl w-full py-8 space-y-2 shadow-inner">
            <p className="text-5xl font-light text-accent">
              {orderDetails.wait_time_mins} <span className="text-xl text-white/50">min</span>
            </p>
            <p className="text-sm uppercase tracking-wider font-semibold text-white/50">Remaining Time</p>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 rounded-lg w-full flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold block mb-1">MOCKED OTP SMS SENT:</span>
              Use this code to pick up your order: <span className="font-mono bg-black/40 px-2 py-0.5 rounded">{orderDetails.otp}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl mt-4">
             <QRCode value={orderDetails.order_id} size={150} />
          </div>
          <p className="text-xs text-white/40">Present this QR to Kiosk for Pickup</p>
        </div>
      )}
    </main>
  );
}
