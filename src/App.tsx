/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LiveFinancialChart } from './components/LiveFinancialChart';

export default function App() {
  if (import.meta.env.VITE_SERVICE_ACTIVE === 'false') {
    return (
      <main className="w-full h-screen bg-[#0b0e11] flex items-center justify-center">
         <div className="text-center p-8 bg-[#1a1e2a] rounded-2xl border border-[#2a3040]">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-[#ef4444] mb-2">Service Suspended</h1>
            <p className="text-gray-400">The chart service is currently undergoing maintenance.</p>
         </div>
      </main>
    );
  }

  return (
    <main className="w-full h-screen bg-[#0b0e11]">
      <LiveFinancialChart />
    </main>
  );
}
