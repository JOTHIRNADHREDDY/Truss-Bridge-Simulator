import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Sparkles, FileText } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

export function RightPanel() {
  const { simulation, material, members, loads, nodes, mode, selectedEntities } = useStore();

  const [timeSeriesData, setTimeSeriesData] = useState<{time: number, stress: number}[]>([]);

  const totalLoad = loads.reduce((sum, l) => sum + l.magnitude, 0);
  const maxStress = simulation?.maxStress || 0;
  const isFailing = maxStress > material.yieldStrength;

  // AI Assistant Logic
  const m = members.length;
  const j = nodes.length;
  let r = 0;
  nodes.forEach(n => {
    if (n.supportType === 'pin') r += 3;
    else if (n.supportType === 'rollerX') r += 2; // fixed in Y and Z
    else if (n.supportType === 'rollerY') r += 2; // fixed in X and Z
    else if (n.supportType === 'rollerZ') r += 2; // fixed in X and Y
    else if (n.supportType === 'fixed') r += 6;
  });

  const determinacy = m + r - 3 * j;
  let stabilityStatus = 'Stable';
  if (determinacy < 0) stabilityStatus = 'Unstable';
  else if (determinacy === 0) stabilityStatus = 'Perfectly Determinate';
  else if (m > 0) stabilityStatus = 'Redundant';
  else stabilityStatus = 'No Structure';

  const weakMembers = members.map((m, i) => {
    const stress = Math.abs(simulation?.memberStresses[m.id] || 0);
    const ratio = stress / material.yieldStrength;
    return { member: m, index: i, ratio };
  }).filter(m => m.ratio > 0.7).sort((a, b) => b.ratio - a.ratio);

  const getSuggestions = () => {
    const suggestions = [];
    if (m === 0) return [{ text: "Add nodes and members to start building." }];
    
    if (determinacy < 0) {
      suggestions.push({ text: "Add more members to form triangles." });
      suggestions.push({ text: "Add supports at base nodes.", action: 'add_supports' });
    } else if (determinacy > 0) {
      suggestions.push({ text: "Remove unnecessary members to optimize structure." });
    }

    if (weakMembers.length > 0) {
      suggestions.push({ text: "Reinforce highly stressed members.", action: 'reinforce_member' });
      suggestions.push({ text: "Add diagonal support.", action: 'add_diagonal' });
      suggestions.push({ text: "Use stronger material.", action: 'stronger_material' });
    }

    if (suggestions.length === 0 && determinacy === 0 && m > 0) {
      suggestions.push({ text: "Structure is optimal." });
    }
    return suggestions;
  };

  const suggestions = getSuggestions();

  const simulationRef = useRef(simulation);
  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  // Update time series data
  useEffect(() => {
    if (!simulationRef.current) {
      setTimeSeriesData([]);
    }
    
    if (mode !== 'SIMULATION') return;
    
    let animationFrameId: number;
    let lastUpdateTime = 0;

    const updateGraph = (timestamp: number) => {
      if (timestamp - lastUpdateTime >= 100) {
        setTimeSeriesData(prev => {
          const now = Date.now();
          const currentSim = simulationRef.current;
          const newData = [...prev, { time: now, stress: (currentSim?.maxStress || 0) / 1e6 }];
          // Keep last 100 points
          if (newData.length > 100) {
            return newData.slice(newData.length - 100);
          }
          return newData;
        });
        lastUpdateTime = timestamp;
      }
      animationFrameId = requestAnimationFrame(updateGraph);
    };

    animationFrameId = requestAnimationFrame(updateGraph);

    return () => cancelAnimationFrame(animationFrameId);
  }, [mode]);

  const lineChartData = {
    labels: timeSeriesData.map((_, i) => i),
    datasets: [
      {
        label: 'Max Stress (MPa)',
        data: timeSeriesData.map(d => d.stress),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    },
    scales: {
      y: {
        grid: { color: '#27272a' },
        ticks: { color: '#a1a1aa', font: { size: 10 } },
        suggestedMin: 0,
        suggestedMax: (material.yieldStrength / 1e6) * 1.2
      },
      x: {
        display: false
      }
    }
  };

  const chartData = {
    labels: members.map((_, i) => `M${i + 1}`),
    datasets: [
      {
        label: 'Stress (MPa)',
        data: members.map(m => Math.abs(simulation?.memberStresses[m.id] || 0) / 1e6),
        backgroundColor: members.map(m => {
          if (m.isBroken) return '#7f1d1d'; // dark red
          const stressValue = simulation?.memberStresses[m.id] || 0;
          const normalized = maxStress > 0 ? Math.abs(stressValue) / maxStress : 0;
          
          if (normalized <= 0.2) return '#1e3a8a';
          if (normalized <= 0.4) return '#06b6d4';
          if (normalized <= 0.6) return '#10b981';
          if (normalized <= 0.8) return '#eab308';
          if (normalized <= 1.0) return '#f97316';
          return '#ef4444';
        }),
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#18181b', // zinc-900
        titleColor: '#a1a1aa', // zinc-400
        bodyColor: '#e4e4e7', // zinc-200
        borderColor: '#27272a', // zinc-800
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        grid: {
          color: '#27272a', // zinc-800
        },
        ticks: {
          color: '#a1a1aa', // zinc-400
          font: { size: 10 }
        },
        title: {
          display: true,
          text: 'Stress (MPa)',
          color: '#71717a', // zinc-500
          font: { size: 10 }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#a1a1aa', // zinc-400
          font: { size: 10 }
        }
      }
    },
  };

  const generateReport = () => {
    const reportContent = `
TRUSS BRIDGE SIMULATION REPORT
==============================

SUMMARY
-------
Status: ${!simulation ? 'No Structure' : !simulation.isStable ? 'Unstable Structure' : isFailing ? 'Material Yielding' : 'Stable'}
Material: ${material.name}
Yield Strength: ${(material.yieldStrength / 1e6).toFixed(1)} MPa
Max Stress: ${(maxStress / 1e6).toFixed(1)} MPa
Total Load: ${(totalLoad / 1000).toFixed(1)} kN

STRUCTURE
---------
Nodes: ${nodes.length}
Members: ${members.length}
Loads: ${loads.length}

MEMBER STRESSES
---------------
${members.map((m, i) => {
  const force = simulation?.memberForces[m.id] || 0;
  const stress = simulation?.memberStresses[m.id] || 0;
  return `M${i + 1}: ${(Math.abs(stress) / 1e6).toFixed(1)} MPa (${force > 1 ? 'Tension' : force < -1 ? 'Compression' : 'Zero'}) ${m.isBroken ? '- BROKEN' : ''}`;
}).join('\n')}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truss_report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full text-zinc-100 overflow-y-auto custom-scrollbar">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold tracking-tight">Analytics</h2>
      </div>

      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Status</h3>
          <div className={`px-3 py-2 rounded-md font-medium text-sm flex items-center space-x-2 ${
            !simulation ? 'bg-zinc-800 text-zinc-400' :
            !simulation.isStable ? 'bg-red-900/50 text-red-400 border border-red-800' :
            isFailing ? 'bg-orange-900/50 text-orange-400 border border-orange-800' :
            'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              !simulation ? 'bg-zinc-500' :
              !simulation.isStable ? 'bg-red-500 animate-pulse' :
              isFailing ? 'bg-orange-500 animate-pulse' :
              'bg-emerald-500'
            }`} />
            <span>
              {!simulation ? 'No Structure' :
               !simulation.isStable ? 'Unstable Structure' :
               isFailing ? 'Material Yielding' : 'Stable'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Max Stress</div>
            <div className={`text-xl font-bold ${isFailing ? 'text-red-400' : 'text-zinc-100'}`}>
              {(maxStress / 1e6).toFixed(1)} <span className="text-sm font-normal text-zinc-500">MPa</span>
            </div>
          </div>
          <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-1">Safety Factor</div>
            <div className={`text-xl font-bold ${maxStress === 0 ? 'text-zinc-100' : (material.yieldStrength / maxStress) < 1 ? 'text-red-400' : (material.yieldStrength / maxStress) < 1.5 ? 'text-orange-400' : 'text-emerald-400'}`}>
              {maxStress === 0 ? '∞' : (material.yieldStrength / maxStress).toFixed(2)}
            </div>
          </div>
          <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800 col-span-2">
            <div className="text-xs text-zinc-500 mb-1">Total Load</div>
            <div className="text-xl font-bold text-zinc-100">
              {(totalLoad / 1000).toFixed(1)} <span className="text-sm font-normal text-zinc-500">kN</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            if ((window as any).triggerMovingLoad) {
              (window as any).triggerMovingLoad();
            }
          }}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles size={16} />
          Simulate Moving Load
        </button>

        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Material Limits</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Yield Strength</span>
              <span className="font-medium">{(material.yieldStrength / 1e6).toFixed(1)} MPa</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
              <div 
                className={`h-full ${isFailing ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, (maxStress / material.yieldStrength) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Stress Legend</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
              <span>0 MPa</span>
              <span>{(maxStress / 2e6).toFixed(1)} MPa</span>
              <span>{(maxStress / 1e6).toFixed(1)} MPa</span>
            </div>
            <div className="relative h-3 w-full rounded-full" style={{
              background: 'linear-gradient(to right, #1e3a8a 0%, #06b6d4 20%, #10b981 40%, #eab308 60%, #f97316 80%, #ef4444 100%)'
            }}>
              {/* Selected Member Indicator */}
              {selectedEntities.filter(e => e.type === 'member').map(e => {
                const stress = Math.abs(simulation?.memberStresses[e.id] || 0);
                const normalized = maxStress > 0 ? stress / maxStress : 0;
                return (
                  <div 
                    key={e.id}
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-white border border-zinc-900 rounded-full shadow-sm z-10"
                    style={{ left: `${normalized * 100}%` }}
                    title={`Selected: ${(stress / 1e6).toFixed(1)} MPa`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
              <span>Low</span>
              <span>Med</span>
              <span>Max</span>
            </div>
            {selectedEntities.some(e => e.type === 'member') && (
              <div className="mt-2 text-xs text-zinc-300 text-center font-mono">
                Selected: {(Math.abs(simulation?.memberStresses[selectedEntities.find(e => e.type === 'member')?.id || ''] || 0) / 1e6).toFixed(1)} MPa
              </div>
            )}
          </div>
        </div>

        {members.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Max Stress vs Time</h3>
            <div className="h-32 bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/50 mb-4">
              <Line data={lineChartData} options={lineChartOptions} />
            </div>
            
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Stress Distribution</h3>
            <div className="h-48 bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/50">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {members.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Members</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {members.map((m, index) => {
                const force = simulation?.memberForces[m.id] || 0;
                const stress = simulation?.memberStresses[m.id] || 0;
                const stressRatio = Math.abs(stress) / material.yieldStrength;
                
                return (
                  <div key={m.id} className="bg-zinc-800/30 p-2 rounded border border-zinc-800/50 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className={`w-1.5 h-1.5 rounded-full`} style={{
                        backgroundColor: m.isBroken ? '#7f1d1d' : (() => {
                          const normalized = maxStress > 0 ? Math.abs(stress) / maxStress : 0;
                          if (normalized <= 0.2) return '#1e3a8a';
                          if (normalized <= 0.4) return '#06b6d4';
                          if (normalized <= 0.6) return '#10b981';
                          if (normalized <= 0.8) return '#eab308';
                          if (normalized <= 1.0) return '#f97316';
                          return '#ef4444';
                        })()
                      }} />
                      <span className="text-xs text-zinc-300 font-mono">
                        M{index + 1}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-zinc-200">
                        {m.isBroken ? 'BROKEN' : `${Math.abs(force / 1000).toFixed(1)} kN`}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {force > 1 ? '(T)' : force < -1 ? '(C)' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {members.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles size={14} className="text-blue-400" /> AI Assistant
            </h3>
            
            <div className="bg-zinc-800/30 p-3 rounded-lg border border-zinc-800/50 space-y-3">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase mb-1">Determinacy</div>
                <div className={`text-sm font-medium ${
                  determinacy < 0 ? 'text-red-400' :
                  determinacy === 0 ? 'text-emerald-400' : 'text-yellow-400'
                }`}>
                  {stabilityStatus} (m+r={m+r}, 3j={3*j})
                </div>
              </div>

              {weakMembers.length > 0 && (
                <div>
                  <div className="text-[10px] text-zinc-500 uppercase mb-1">Weak Members</div>
                  <div className="flex flex-wrap gap-1">
                    {weakMembers.map(wm => (
                      <span key={wm.member.id} className={`text-xs px-1.5 py-0.5 rounded ${
                        wm.ratio > 0.9 ? 'bg-red-900/50 text-red-400 border border-red-800 animate-pulse' : 'bg-orange-900/50 text-orange-400 border border-orange-800'
                      }`}>
                        M{wm.index + 1}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] text-zinc-500 uppercase mb-1">Suggestions</div>
                <ul className="space-y-1">
                  {suggestions.map((sug, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="flex-1">{sug.text}</span>
                      {sug.action && (
                        <button
                          onClick={() => useStore.getState().autoFix(sug.action!)}
                          className="px-1.5 py-0.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-[10px] transition-colors whitespace-nowrap"
                        >
                          Apply Fix
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={generateReport}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition-colors mt-4"
            >
              <FileText size={16} />
              <span>Export Report</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
