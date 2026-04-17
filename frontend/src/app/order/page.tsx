"use client";

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { ShoppingBag, Clock, Phone, AlertCircle, ArrowLeft, Trash2, Timer, ChefHat } from 'lucide-react';
import Link from 'next/link';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  prep_time_secs: number;
  emoji: string;
}

export default function OrderPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderState, setOrderState] = useState<'IDLE' | 'ORDERING' | 'WAITING'>('IDLE');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<MenuItem[]>([]);

  // Fetch live menu (with per-item prep times) from backend
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/menu`)
      .then(r => r.json())
      .then(data => setMenu(data.items || []))
      .catch(() => {
        // Fallback static menu if backend is offline
        setMenu([
          { id: 'hd1', name: 'Premium Hot Dog',     price: 8.50,  prep_time_secs: 20, emoji: '🌭' },
          { id: 'bz1', name: 'Craft Beer',           price: 12.00, prep_time_secs: 5,  emoji: '🍺' },
          { id: 'pz1', name: 'Slice of Pepperoni',   price: 9.00,  prep_time_secs: 25, emoji: '🍕' },
          { id: 'nb1', name: 'Nachos & Cheese',      price: 7.50,  prep_time_secs: 15, emoji: '🧀' },
          { id: 'cc1', name: 'Chicken Strips (x3)',  price: 11.00, prep_time_secs: 35, emoji: '🍗' },
          { id: 'sd1', name: 'Loaded Stadium Fries', price: 6.50,  prep_time_secs: 18, emoji: '🍟' },
          { id: 'sw1', name: 'Soft Drink (Large)',   price: 4.50,  prep_time_secs: 3,  emoji: '🥤' },
          { id: 'pr1', name: 'Soft Pretzel',         price: 5.00,  prep_time_secs: 12, emoji: '🥨' },
        ]);
      });
  }, []);

  const addToCart = (item: MenuItem) => setCart(prev => [...prev, item]);
  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));

  const cartTotal = cart.reduce((sum, i) => sum + i.price, 0);
  // Kitchen cooks in parallel — total time is the slowest item
  const bottleneckSecs = cart.length > 0 ? Math.max(...cart.map(i => i.prep_time_secs)) : 0;
  const bottleneckItem = cart.find(i => i.prep_time_secs === bottleneckSecs);

  const handleOrder = async () => {
    if (!phoneNumber) return alert("Enter phone number for OTP");
    if (cart.length === 0) return alert("Add items to cart");
    setOrderState('ORDERING');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_phone: phoneNumber, items: cart.map(i => i.id) })
      });
      const data = await res.json();
      setOrderDetails({ ...data, cartSnapshot: cart });
      setOrderState('WAITING');
    } catch (err) {
      console.error(err);
      setOrderState('IDLE');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-16 relative overflow-hidden bg-black text-white">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="absolute top-6 left-6 z-20 md:top-10 md:left-10">
        <Link href="/" className="inline-flex items-center text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back
        </Link>
      </div>

      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent mb-8 z-10 tracking-tight pt-8">
        Astro Concessions Kiosk
      </h1>

      {/* ── IDLE: Menu + Cart ─────────────────────────────────────── */}
      {orderState === 'IDLE' && (
        <div className="z-10 w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Menu Panel */}
          <div className="bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5 text-primary" /> Menu
            </h2>
            {menu.map(item => (
              <div key={item.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="font-medium text-sm leading-tight">{item.name}</p>
                    <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                      <Timer className="w-3 h-3" /> {item.prep_time_secs}s prep
                      <span className="ml-2 text-white/60">${item.price.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => addToCart(item)}
                  className="px-3 py-1 bg-primary/20 text-primary rounded-full hover:bg-primary hover:text-white transition-colors text-sm font-medium shrink-0"
                >
                  Add
                </button>
              </div>
            ))}
          </div>

          {/* Cart + Checkout Panel */}
          <div className="bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-accent" /> Your Order
            </h2>

            {cart.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">Add items from the menu</p>
            ) : (
              <div className="space-y-2 flex-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                    <div className="flex items-center gap-2">
                      <span>{item.emoji}</span>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-white/40 text-xs flex items-center gap-1">
                          <Timer className="w-3 h-3" />{item.prep_time_secs}s prep
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 text-sm">${item.price.toFixed(2)}</span>
                      <button onClick={() => removeFromCart(idx)} className="text-white/30 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Kitchen estimate */}
                {cart.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mt-2">
                    <p className="text-orange-300 text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
                      <ChefHat className="w-3.5 h-3.5" /> Kitchen Agent Estimate
                    </p>
                    <p className="text-white/70 text-xs">
                      Bottleneck: <span className="text-orange-300 font-medium">{bottleneckItem?.emoji} {bottleneckItem?.name} ({bottleneckSecs}s)</span>
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">All items cooked in parallel on the grill</p>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-2">
                  <span className="text-white/60 text-sm">Total</span>
                  <span className="font-bold text-lg">${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-auto">
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-2 text-white/70">
                  <Phone className="w-4 h-4"/> Phone (for OTP)
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 555-0100"
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
              <button
                onClick={handleOrder}
                disabled={cart.length === 0 || !phoneNumber}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 disabled:opacity-40 text-white font-semibold py-4 rounded-xl flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-opacity"
              >
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ORDERING: Loading ─────────────────────────────────────── */}
      {orderState === 'ORDERING' && (
        <div className="z-10 flex flex-col items-center space-y-4 w-full max-w-md bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md p-12 text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-white/80 animate-pulse">Kitchen Agent resolving prep times…</p>
        </div>
      )}

      {/* ── WAITING: Confirmation ─────────────────────────────────── */}
      {orderState === 'WAITING' && orderDetails && (
        <div className="w-full max-w-md space-y-5 z-10 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md p-8 text-center flex flex-col items-center">
          <div className="bg-primary/20 p-4 rounded-full">
            <Clock className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold">Order Received!</h2>
          <p className="text-white/60 text-sm">#{orderDetails.order_id} — Kitchen Agent is picking it up in ~5s</p>

          {/* Item breakdown */}
          {orderDetails.cartSnapshot && (
            <div className="w-full bg-black/40 rounded-2xl p-4 border border-white/5 text-left space-y-2">
              <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Order breakdown</p>
              {orderDetails.cartSnapshot.map((item: MenuItem, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">{item.emoji} {item.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.prep_time_secs === bottleneckSecs ? 'bg-orange-500/20 text-orange-300' : 'bg-white/10 text-white/50'}`}>
                    {item.prep_time_secs}s {item.prep_time_secs === bottleneckSecs && '⏱️'}
                  </span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-2 text-xs text-white/40">
                Kitchen cooks in parallel · bottleneck = {bottleneckSecs}s
              </div>
            </div>
          )}

          <div className="bg-black/50 border border-white/10 rounded-2xl w-full py-6 space-y-1 shadow-inner">
            <p className="text-5xl font-light text-accent">
              {orderDetails.wait_time_secs} <span className="text-xl text-white/50">sec</span>
            </p>
            <p className="text-xs uppercase tracking-wider font-semibold text-white/40">Est. Wait</p>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 rounded-lg w-full flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold block mb-1">MOCKED OTP SMS SENT:</span>
              Pickup code: <span className="font-mono bg-black/40 px-2 py-0.5 rounded">{orderDetails.otp}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl">
            <QRCode value={orderDetails.order_id} size={140} />
          </div>
          <p className="text-xs text-white/40">Present this QR to Kiosk for Pickup</p>
        </div>
      )}
    </main>
  );
}

