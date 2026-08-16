"use client";

import { useState } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useFireCalculator, FireAssumptions } from "@/hooks/use-fire-calculator";
import { Palmtree, TrendingUp, DollarSign, Calendar } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export default function RetirementClient() {
  const { data, isLoading } = useFinanceData();
  const [assumptions, setAssumptions] = useState<FireAssumptions>({
    inflationRate: 6,
    marketReturnRate: 12,
    safeWithdrawalRate: 4,
    currentAge: 30,
  });

  // Calculate values (defaulting to 0 if data isn't loaded yet)
  const currentNetWorth = 
    ((data?.accounts) || []).reduce((sum, a) => sum + Number(a.balance || 0), 0) +
    ((data?.investments) || []).reduce((sum, i) => sum + Number((i.quantity || 0) * (i.current_price || i.buy_price || 0)), 0) +
    ((data?.mutualFunds) || []).reduce((sum, mf) => sum + Number((mf.units || 0) * (mf.current_nav || mf.avg_nav || 0)), 0) +
    ((data?.bonds) || []).reduce((sum, b) => sum + Number((b.quantity || 0) * (b.current_price || b.face_value || 0)), 0) +
    ((data?.alternativeAssets) || []).reduce((sum, a) => sum + Number(a.current_value || a.purchase_price || 0), 0) +
    ((data?.forexAccounts) || []).reduce((sum, f) => sum + Number(f.balance || 0), 0) -
    ((data?.liabilities) || []).reduce((sum, l) => sum + Number(l.remaining_amount || l.total_amount || 0), 0);

  const monthlyExpenses = ((data?.expenses) || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const monthlyIncome = ((data?.incomes) || []).reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const monthlySavings = monthlyIncome - monthlyExpenses;

  // Use the hook before any early returns
  const { projections, fireAge, fireYear } = useFireCalculator({
    currentNetWorth,
    monthlySavings,
    monthlyExpenses,
    assumptions,
  });

  if (isLoading || !data) {
    return (
      <div className="p-8 flex justify-center items-center h-full text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const handleAssumptionChange = (key: keyof FireAssumptions, value: number) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: data.profile?.base_currency || 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-white">
          <Palmtree className="h-8 w-8 text-emerald-500" />
          Retirement & FIRE Planner
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Net Worth Card */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Current Net Worth</h3>
            <DollarSign className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold">{formatCurrency(currentNetWorth)}</div>
          <p className="text-xs text-zinc-400 mt-1">Based on linked accounts</p>
        </div>
        
        {/* FIRE Target Number */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">FIRE Target Number</h3>
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency((monthlyExpenses * 12) / ((assumptions.safeWithdrawalRate || 4) / 100))}
          </div>
          <p className="text-xs text-zinc-400 mt-1">Required portfolio size</p>
        </div>

        {/* Projected FIRE Age */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Projected FIRE Age</h3>
            <Calendar className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold">
            {fireAge !== null ? `${fireAge} yrs` : "N/A"}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {fireYear !== null ? `Target Year: ${fireYear}` : "Insufficient savings rate"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <div className="md:col-span-1 space-y-6 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow p-6">
          <h3 className="font-semibold text-lg border-b border-zinc-800 pb-2">Assumptions</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Current Age
                </label>
                <span className="text-sm text-zinc-400">{assumptions.currentAge}</span>
              </div>
              <input
                type="range"
                min={18}
                max={70}
                step={1}
                value={assumptions.currentAge}
                onChange={(e) => handleAssumptionChange('currentAge', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Inflation Rate (%)
                </label>
                <span className="text-sm text-zinc-400">{assumptions.inflationRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={assumptions.inflationRate}
                onChange={(e) => handleAssumptionChange('inflationRate', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Market Return (%)
                </label>
                <span className="text-sm text-zinc-400">{assumptions.marketReturnRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={0.5}
                value={assumptions.marketReturnRate}
                onChange={(e) => handleAssumptionChange('marketReturnRate', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Safe Withdrawal Rate (%)
                </label>
                <span className="text-sm text-zinc-400">{assumptions.safeWithdrawalRate}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.1}
                value={assumptions.safeWithdrawalRate}
                onChange={(e) => handleAssumptionChange('safeWithdrawalRate', Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-50 shadow p-6 min-h-[400px]">
          <h3 className="font-semibold text-lg mb-4">FIRE Projection Map</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={projections} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="age" stroke="#52525b" tickFormatter={(val) => `Age ${val}`} />
              <YAxis stroke="#52525b" tickFormatter={(val) => `₹${(val / 10000000).toFixed(1)}Cr`} width={80} />
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#f4f4f5' }}
                itemStyle={{ color: '#f4f4f5' }}
                formatter={(value: any, name: any) => {
                  return [formatCurrency(Number(value)), name === 'netWorth' ? 'Net Worth' : 'FIRE Target'];
                }}
                labelFormatter={(label) => `Age: ${label}`}
              />
              <Legend verticalAlign="top" height={36}/>
              <Area type="monotone" dataKey="targetFireNumber" name="FIRE Target" stroke="#ef4444" fillOpacity={1} fill="url(#colorTarget)" strokeWidth={2} />
              <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#10b981" fillOpacity={1} fill="url(#colorNetWorth)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
