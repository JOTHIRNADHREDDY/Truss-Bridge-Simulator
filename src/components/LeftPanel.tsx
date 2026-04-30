import React from 'react';
import { useStore, Tool, MATERIALS } from '../store/useStore';
import { MousePointer2, Circle, Minus, Anchor, ArrowDownToLine, Trash2, RotateCcw, Trash, ArrowRightToLine, ArrowUpToLine, Square, Eye, EyeOff, Play, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function LeftPanel() {
  const { 
    tool, setTool, 
    mode, setMode,
    material, setMaterial, 
    resetSimulation, clearAll, 
    defaultLoadMagnitude, setDefaultLoadMagnitude,
    defaultLoadAngle, setDefaultLoadAngle,
    defaultLoadAngleZ, setDefaultLoadAngleZ,
    deformationScale, setDeformationScale,
    showDeformation, setShowDeformation,
    showValues, setShowValues,
    loadPreset,
    presetSpan, setPresetSpan,
    presetHeight, setPresetHeight
  } = useStore();

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'SELECT', icon: <MousePointer2 size={20} />, label: 'Select' },
    { id: 'ADD_NODE', icon: <Circle size={20} />, label: 'Add Node' },
    { id: 'ADD_MEMBER', icon: <Minus size={20} />, label: 'Add Member' },
    { id: 'ADD_PIN', icon: <Anchor size={20} />, label: 'Pin Support' },
    { id: 'ADD_ROLLER_X', icon: <ArrowRightToLine size={20} />, label: 'Roller X (Horizontal)' },
    { id: 'ADD_ROLLER_Y', icon: <ArrowUpToLine size={20} />, label: 'Roller Y (Vertical)' },
    { id: 'ADD_FIXED', icon: <Square size={20} />, label: 'Fixed Support' },
    { id: 'ADD_LOAD', icon: <ArrowDownToLine size={20} />, label: 'Add Load' },
    { id: 'DELETE', icon: <Trash2 size={20} />, label: 'Delete' },
  ];

  const handleSave = () => {
    const data = {
      nodes: useStore.getState().nodes,
      members: useStore.getState().members,
      loads: useStore.getState().loads,
      material: useStore.getState().material,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'truss_design.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.nodes && data.members && data.loads && data.material) {
            useStore.setState({
              nodes: data.nodes,
              members: data.members,
              loads: data.loads,
              material: data.material,
              past: [],
              future: [],
              simulation: null
            });
          }
        } catch (err) {
          console.error("Failed to load design", err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full text-zinc-100">
      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Truss Simulator</h1>
          <p className="text-xs text-zinc-400 mt-1">Design & Analyze</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            if ((window as any).triggerScreenshot) {
              (window as any).triggerScreenshot();
            }
          }} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors" title="Export Image">
            <Eye size={14} />
          </button>
          <button onClick={handleSave} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors" title="Save Design">
            <ArrowDownToLine size={14} />
          </button>
          <button onClick={handleLoad} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors" title="Load Design">
            <ArrowUpToLine size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-zinc-800">
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setMode('BUILD')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all",
              mode === 'BUILD' ? "bg-blue-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Wrench size={16} />
            Build
          </button>
          <button
            onClick={() => setMode('SIMULATION')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all",
              mode === 'SIMULATION' ? "bg-emerald-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Play size={16} />
            Simulate
          </button>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        {mode === 'BUILD' && (
          <>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Tools</h2>
            <div className="space-y-1">
              {tools.map((t) => (
                <div key={t.id}>
                  <button
                    onClick={() => setTool(t.id)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors",
                      tool === t.id 
                        ? "bg-blue-600 text-white" 
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    )}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                  {t.id === 'ADD_LOAD' && tool === 'ADD_LOAD' && (
                    <div className="mt-2 mb-4 px-3 py-3 bg-zinc-800/50 rounded-md border border-zinc-700 space-y-4">
                      <div>
                        <div className="flex justify-between text-xs text-zinc-400 mb-1">
                          <span>Magnitude</span>
                          <span>{defaultLoadMagnitude / 1000} kN</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="1000" 
                          value={defaultLoadMagnitude / 1000} 
                          onChange={(e) => {
                            setDefaultLoadMagnitude(Number(e.target.value) * 1000);
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-zinc-400 mb-1">
                          <span>Angle (XY)</span>
                          <span>{defaultLoadAngle}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="-180" 
                          max="180" 
                          value={defaultLoadAngle} 
                          onChange={(e) => {
                            setDefaultLoadAngle(Number(e.target.value));
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-zinc-400 mb-1">
                          <span>Angle (Z)</span>
                          <span>{defaultLoadAngleZ}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="-90" 
                          max="90" 
                          value={defaultLoadAngleZ} 
                          onChange={(e) => {
                            setDefaultLoadAngleZ(Number(e.target.value));
                          }}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {mode === 'SIMULATION' && (
          <div className="mb-6 p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-md">
            <p className="text-sm text-emerald-400">Simulation Active</p>
            <p className="text-xs text-zinc-400 mt-1">Editing is locked. You can select nodes and members to view their properties.</p>
          </div>
        )}

        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-8 mb-3">View Settings</h2>
        <div className="space-y-3 px-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Show Values</span>
            <button 
              onClick={() => setShowValues(!showValues)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {showValues ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Free 3D Movement</span>
            <button 
              onClick={() => useStore.getState().setFree3DMovement(!useStore.getState().free3DMovement)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {useStore.getState().free3DMovement ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Show Grid</span>
            <button 
              onClick={() => useStore.getState().setShowGrid(!useStore.getState().showGrid)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {useStore.getState().showGrid ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Animation Speed</span>
              <span>{useStore.getState().animationSpeed}x</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="3" 
              step="0.1"
              value={useStore.getState().animationSpeed} 
              onChange={(e) => useStore.getState().setAnimationSpeed(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Show Deformation</span>
            <button 
              onClick={() => setShowDeformation(!showDeformation)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              {showDeformation ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          {showDeformation && (
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Scale Factor</span>
                <span>{deformationScale}x</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="1000" 
                value={deformationScale} 
                onChange={(e) => setDeformationScale(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          )}
        </div>

        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-8 mb-3">Presets</h2>
        <div className="space-y-3 mb-4 px-1">
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Span Width</span>
              <span>{presetSpan}</span>
            </div>
            <input 
              type="range" 
              min="100" 
              max="1000" 
              step="50"
              value={presetSpan} 
              onChange={(e) => setPresetSpan(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Height / Slope</span>
              <span>{presetHeight}</span>
            </div>
            <input 
              type="range" 
              min="50" 
              max="500" 
              step="10"
              value={presetHeight} 
              onChange={(e) => setPresetHeight(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => loadPreset('warren')} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors">Warren</button>
          <button onClick={() => loadPreset('pratt')} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors">Pratt</button>
          <button onClick={() => loadPreset('howe')} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors">Howe</button>
          <button onClick={() => loadPreset('k-truss')} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors">K-Truss</button>
          <button onClick={() => loadPreset('bowstring')} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors">Bowstring</button>
          <button onClick={() => loadPreset('suspension')} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors">Suspension</button>
        </div>

        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-8 mb-3">Material</h2>
        <div className="space-y-2">
          {Object.entries(MATERIALS).map(([key, mat]) => (
            <button
              key={key}
              onClick={() => setMaterial(mat)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors border",
                material.name === mat.name
                  ? "bg-zinc-800 border-blue-500 text-white"
                  : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"
              )}
            >
              <div className="font-medium">{mat.name}</div>
              <div className="text-xs opacity-70">Yield: {(mat.yieldStrength / 1e6).toFixed(0)} MPa</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800 space-y-2">
        <button
          onClick={resetSimulation}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md text-sm transition-colors"
        >
          <RotateCcw size={16} />
          <span>Reset Broken</span>
        </button>
        <button
          onClick={clearAll}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-md text-sm transition-colors"
        >
          <Trash size={16} />
          <span>Clear All</span>
        </button>
      </div>
    </div>
  );
}
