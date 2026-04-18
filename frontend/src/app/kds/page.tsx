"use client";

import { useState, useEffect } from 'react';
import { ChefHat, Plus, X, Utensils, CheckCircle, Clock, Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Types for the conceptual KDS
interface Chef {
  id: string;
  name: string;
  isAvailable: boolean;
}

interface AssignedTask {
  id: string;
  order_id: string;
  item_name: string;
  assigned_chef_id: string;
  agent_instruction: string;
  prep_time_secs: number;
  status: 'PENDING' | 'COOKING' | 'DONE';
}

export default function KitchenDisplayPage() {
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [newChefName, setNewChefName] = useState('');
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('kds_token');
    if (t) setToken(t);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('kds_token', data.access_token);
        setToken(data.access_token);
        setLoginError('');
      } else {
        setLoginError('Invalid identity');
      }
    } catch {
      setLoginError('Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kds_token');
    setToken(null);
  };

  // Periodically fetch live roster and task assignments from backend
  const fetchData = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/kds', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      if (data.chefs) setChefs(data.chefs);
      if (data.tasks) setTasks(data.tasks);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchData();
    const interval = setInterval(fetchData, 2000); // Live poll every 2s
    return () => clearInterval(interval);
  }, [token]);

  // Handle adding/removing chefs
  const addChef = async () => {
    if (!newChefName || !token) return;
    await fetch('/api/chefs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: newChefName })
    });
    setNewChefName('');
    fetchData();
  };

  const removeChef = async (id: string) => {
    if (!token) return;
    setChefs(chefs.filter(c => c.id !== id));
    await fetch(`/api/chefs/${id}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  // Complete a task
  const completeTask = async (taskId: string) => {
    if (!token) return;
    setTasks(tasks.filter(t => t.id !== taskId)); 
    await fetch(`/api/tasks/${taskId}/complete`, { 
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchData();
  };

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 blur-[150px] rounded-full pointer-events-none" />
        <form onSubmit={handleLogin} className="z-10 bg-white/5 border border-white/10 p-10 rounded-3xl w-full max-w-sm backdrop-blur-xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ChefHat className="text-white w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">KDS Secure Login</h1>
          
          <input className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-orange-500 transition-colors" type="text" placeholder="Username (chef)" value={username} onChange={e=>setUsername(e.target.value)} />
          <input className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 mb-2 focus:outline-none focus:border-orange-500 transition-colors" type="password" placeholder="Password (kitchen123)" value={password} onChange={e=>setPassword(e.target.value)} />
          <div className="h-6 mb-4">
            {loginError && <p className="text-red-400 text-sm font-medium text-center animate-pulse">{loginError}</p>}
          </div>
           
           <div className="flex flex-col gap-3">
             <button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]" type="submit">Access Kitchen</button>
             <Link href="/" className="w-full text-center py-2 text-white/40 hover:text-white transition-colors text-sm">Return to Main Menu</Link>
           </div>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-6 md:p-10 relative overflow-hidden bg-[#0a0a0a] text-white">
      {/* Dynamic Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center z-10 mb-8 border-b border-white/10 pb-6">
        <div>
          <button onClick={handleLogout} className="inline-flex items-center text-white/50 hover:text-white transition-colors mb-2 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Logout / Exit
          </button>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500 tracking-tight flex items-center gap-3">
            <Utensils className="w-8 h-8 text-orange-400" />
            Agentic Kitchen Display
          </h1>
          <p className="text-white/50 text-sm mt-1">AI-Optimized Task Routing in Real-time</p>
        </div>

        {/* Chef Roster Management */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-6 items-center backdrop-blur-md">
          <div className="flex items-center gap-2">
            <ChefHat className="text-white/60" />
            <span className="font-semibold text-sm mr-2">Active Roster:</span>
            {chefs.map(chef => (
              <span key={chef.id} className="bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                {chef.name}
                <button onClick={() => removeChef(chef.id)} className="hover:text-green-100"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-2 border-l border-white/10 pl-6">
            <input 
              type="text" 
              placeholder="Clock in chef..." 
              value={newChefName}
              onChange={(e) => setNewChefName(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 transition-colors w-36"
              onKeyDown={(e) => e.key === 'Enter' && addChef()}
            />
            <button onClick={addChef} className="bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Kitchen Stations (One per active Chef) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 z-10 flex-1">
        {chefs.map(chef => {
          const chefTasks = tasks.filter(t => t.assigned_chef_id === chef.id && t.status !== 'DONE');
          
          return (
            <div key={chef.id} className="flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative group hover:border-orange-500/30 transition-all duration-500">
              {/* Station Header */}
              <div className="bg-black/40 p-5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <ChefHat className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">{chef.name}'s Station</h2>
                    <p className="text-green-400 text-xs flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Online
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-light text-white/80">{chefTasks.length}</span>
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Tasks</p>
                </div>
              </div>

              {/* Assignments List */}
              <div className="p-5 flex-1 space-y-4 overflow-y-auto">
                {chefTasks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20">
                    <Clock className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">Standing by for orders...</p>
                  </div>
                ) : (
                  chefTasks.map((task, idx) => (
                    <div key={task.id} className="bg-black/60 border border-white/10 rounded-2xl p-4 hover:border-orange-500/50 transition-colors relative overflow-hidden group/task">
                      
                      {/* Status Indicator */}
                      <div className={`absolute top-0 left-0 w-1 h-full ${task.status === 'COOKING' ? 'bg-orange-500' : 'bg-blue-500'}`} />

                      <div className="flex justify-between items-start mb-2 pl-2">
                        <div>
                          <span className="text-xs font-mono text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-md border border-orange-400/20 mr-2">
                            #{task.order_id}
                          </span>
                          <span className="font-bold text-lg">{task.item_name}</span>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-white/40 bg-white/5 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> {task.prep_time_secs}s
                        </span>
                      </div>

                      {/* AI Agent Instruction */}
                      <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 pl-2 relative flex items-start gap-3">
                        <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5 ml-1" />
                        <p className="text-sm text-purple-100/80 leading-relaxed font-medium">
                          {task.agent_instruction}
                        </p>
                      </div>

                      {/* Action Button */}
                      <button 
                        onClick={() => completeTask(task.id)}
                        className="mt-4 w-full bg-white/5 hover:bg-green-500 hover:text-white text-white/60 border border-white/10 hover:border-green-500 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-sm group-hover/task:bg-white/10"
                      >
                        <CheckCircle className="w-4 h-4" /> Mark as Done
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
