import React from 'react';
import { ChartLevels, Trend } from '../utils/mockData';

interface OverlayCardProps {
  levels: ChartLevels;
  trend: Trend;
}

export const OverlayCard: React.FC<OverlayCardProps> = ({ levels, trend }) => {
  return (
    <div className="absolute top-6 left-6 z-10 bg-[#131722]/90 backdrop-blur-[10px] border border-[#2a2e39]/80 rounded-xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-white w-[320px] font-sans pointer-events-none space-y-6">
      
      {/* SELLING AREAS */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">GOLD SELLING AREAS</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">R4</span>
            <span className="text-[11px] text-[#ef5350] font-mono">{levels.r4.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">R3</span>
            <span className="text-[11px] text-[#ef5350] font-mono">{levels.r3.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">R2</span>
            <span className="text-[11px] text-[#ef5350] font-mono">{levels.r2.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">R1</span>
            <span className="text-[11px] text-[#ef5350] font-mono">{levels.r1.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* BUYING AREAS */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">GOLD BUYING AREAS</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">S1</span>
            <span className="text-[11px] text-[#26a69a] font-mono">{levels.s1.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">S2</span>
            <span className="text-[11px] text-[#26a69a] font-mono">{levels.s2.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">S3</span>
            <span className="text-[11px] text-[#26a69a] font-mono">{levels.s3.toFixed(2)}</span>
          </div>
          <div className="flex justify-between bg-black/30 p-2 rounded">
            <span className="text-[11px] text-gray-400">S4</span>
            <span className="text-[11px] text-[#26a69a] font-mono">{levels.s4.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* PIVOT POINT */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">GOLD PIVOT POINT</h3>
        <div className="bg-white/10 px-4 py-1.5 rounded-full">
          <span className="text-xs font-mono text-white">{levels.pivot.toFixed(2)}</span>
        </div>
      </div>

      {/* TREND NOW */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">GOLD TREND NOW</h3>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-[#ef5350] font-bold">BEARISH {trend.bearish}%</span>
          <span className="text-[10px] text-[#26a69a] font-bold">BULLISH {trend.bullish}%</span>
        </div>
        <div className="flex w-full bg-gray-800 rounded-full overflow-hidden h-2">
          <div 
            className="bg-[#ef5350] transition-all duration-500 ease-out" 
            style={{ width: `${trend.bearish}%` }}
          />
          <div 
            className="bg-[#26a69a] transition-all duration-500 ease-out" 
            style={{ width: `${trend.bullish}%` }}
          />
        </div>
      </div>

    </div>
  );
};
