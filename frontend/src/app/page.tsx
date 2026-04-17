"use client";

import Link from 'next/link';
import { MonitorPlay, ShoppingBag, Search } from 'lucide-react';

export default function Launchpad() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 relative overflow-hidden bg-black text-white">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/10 blur-[150px] pointer-events-none" />

      <div className="z-10 text-center mb-16 space-y-4">
        <h1 className="text-6xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-400 to-accent tracking-tighter">
          Astro Concessions
        </h1>
        <p className="text-xl md:text-2xl text-white/50 font-light mt-4">Select an interface to begin</p>
      </div>

      <div className="z-10 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
        <Link href="/display" className="group">
          <div className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 transition-all duration-300 rounded-3xl p-10 flex flex-col items-center text-center h-full hover:scale-105 will-change-transform shadow-2xl backdrop-blur-md">
            <div className="w-24 h-24 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MonitorPlay className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold mb-4 group-hover:text-blue-400 transition-colors">Queue Display</h2>
            <p className="text-white/50 text-lg">Big screen interface for kitchen status and dynamic wait times.</p>
          </div>
        </Link>
        <Link href="/order" className="group">
          <div className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 transition-all duration-300 rounded-3xl p-10 flex flex-col items-center text-center h-full hover:scale-105 will-change-transform shadow-2xl backdrop-blur-md">
            <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold mb-4 group-hover:text-emerald-400 transition-colors">Place Order</h2>
            <p className="text-white/50 text-lg">Interactive Kiosk interface for fans to place mobile orders.</p>
          </div>
        </Link>
        <Link href="/status" className="group">
          <div className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 transition-all duration-300 rounded-3xl p-10 flex flex-col items-center text-center h-full hover:scale-105 will-change-transform shadow-2xl backdrop-blur-md">
            <div className="w-24 h-24 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Search className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold mb-4 group-hover:text-purple-400 transition-colors">Check Status</h2>
            <p className="text-white/50 text-lg">Search interface to look up order status by phone or order ID.</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
