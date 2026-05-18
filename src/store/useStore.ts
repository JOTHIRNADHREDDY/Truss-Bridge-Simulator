import { create } from 'zustand';
import { Node, Member, Load, Material, solveTruss, SimulationResult } from '../lib/physics';
import { generatePreset } from '../lib/presets';

export type Tool = 'SELECT' | 'ADD_NODE' | 'ADD_MEMBER' | 'ADD_PIN' | 'ADD_ROLLER_X' | 'ADD_ROLLER_Y' | 'ADD_FIXED' | 'ADD_LOAD' | 'DELETE';
export type Mode = 'BUILD' | 'SIMULATION';

export const MATERIALS: Record<string, Material> = {
  steel: { name: 'Steel', yieldStrength: 250e6, elasticModulus: 200e9, density: 7850, area: 0.01, color: '#94a3b8' },
  wood: { name: 'Wood', yieldStrength: 40e6, elasticModulus: 11e9, density: 600, area: 0.04, color: '#b45309' },
  aluminum: { name: 'Aluminum', yieldStrength: 270e6, elasticModulus: 69e9, density: 2700, area: 0.01, color: '#e2e8f0' },
};

interface HistoryState {
  nodes: Node[];
  members: Member[];
  loads: Load[];
  material: Material;
}

interface State {
  nodes: Node[];
  members: Member[];
  loads: Load[];
  material: Material;
  tool: Tool;
  mode: Mode;
  setMode: (mode: Mode) => void;
  simulation: SimulationResult | null;
  
  // History
  past: HistoryState[];
  future: HistoryState[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  
  // Viewport
  pan: { x: number; y: number };
  zoom: number;
  
  selectedEntities: { id: string, type: 'node' | 'member' | 'load' }[];
  setSelectedEntities: (entities: { id: string, type: 'node' | 'member' | 'load' }[]) => void;
  
  defaultLoadMagnitude: number;
  defaultLoadAngle: number;
  defaultLoadAngleZ: number;
  setDefaultLoadMagnitude: (mag: number) => void;
  setDefaultLoadAngle: (angle: number) => void;
  setDefaultLoadAngleZ: (angle: number) => void;
  
  deformationScale: number;
  setDeformationScale: (scale: number) => void;
  showDeformation: boolean;
  setShowDeformation: (show: boolean) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showValues: boolean;
  setShowValues: (show: boolean) => void;
  free3DMovement: boolean;
  setFree3DMovement: (free: boolean) => void;
  animationSpeed: number;
  setAnimationSpeed: (speed: number) => void;

  // Actions
  setTool: (tool: Tool) => void;
  addNode: (x: number, y: number, z?: number) => void;
  addMember: (source: string, target: string) => void;
  setSupport: (nodeId: string, type: 'pin' | 'rollerX' | 'rollerY' | 'fixed' | null) => void;
  addLoad: (nodeId: string, magnitude: number, angle: number, angleZ?: number) => void;
  updateLoad: (loadId: string, magnitude: number, angle: number, angleZ?: number) => void;
  updateNode: (id: string, x: number, y: number, z?: number) => void;
  updateNodes: (initialPositions: Record<string, {x: number, y: number, z: number}>, dx: number, dy: number, dz?: number) => void;
  deleteEntity: (id: string, type: 'node' | 'member' | 'load') => void;
  duplicateSelectedEntities: () => { id: string, type: 'node' | 'member' | 'load', x?: number, y?: number, z?: number }[];
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  setMaterial: (material: Material) => void;
  resetSimulation: () => void;
  stepSimulation: () => void;
  clearAll: () => void;
  breakMember: (id: string) => void;
  presetSpan: number;
  setPresetSpan: (span: number) => void;
  presetHeight: number;
  setPresetHeight: (height: number) => void;
  currentPreset: string | null;
  loadPreset: (presetName: 'warren' | 'pratt' | 'howe' | 'k-truss' | 'bowstring' | 'suspension') => void;
  autoFix: (type: string) => void;
}

const computeSimulation = (nodes: Node[], members: Member[], loads: Load[], material: Material) => {
  return solveTruss(nodes, members, loads, material);
};

const initialNodes: Node[] = [
  { id: 'n1', x: 200, y: 300, supportType: 'pin' },
  { id: 'n2', x: 600, y: 300, supportType: 'rollerX' },
  { id: 'n3', x: 400, y: 100 }
];

const initialMembers: Member[] = [
  { id: 'm1', source: 'n1', target: 'n2' },
  { id: 'm2', source: 'n2', target: 'n3' },
  { id: 'm3', source: 'n3', target: 'n1' }
];

const initialLoads: Load[] = [
  { id: 'l1', nodeId: 'n3', magnitude: 50000, angle: -90 } // 50kN downwards
];

const MAX_HISTORY = 50;

export const useStore = create<State>((set, get) => ({
  nodes: initialNodes,
  members: initialMembers,
  loads: initialLoads,
  material: MATERIALS.steel,
  tool: 'SELECT',
  mode: 'BUILD',
  setMode: (mode) => set({ mode }),
  simulation: computeSimulation(initialNodes, initialMembers, initialLoads, MATERIALS.steel),
  
  past: [],
  future: [],
  
  pushHistory: () => set((state) => {
    const currentState: HistoryState = {
      nodes: state.nodes,
      members: state.members,
      loads: state.loads,
      material: state.material,
    };
    const newPast = [...state.past, currentState].slice(-MAX_HISTORY);
    return { past: newPast, future: [], currentPreset: null };
  }),
  
  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    const currentState: HistoryState = {
      nodes: state.nodes,
      members: state.members,
      loads: state.loads,
      material: state.material,
    };
    return {
      past: newPast,
      future: [currentState, ...state.future],
      nodes: previous.nodes,
      members: previous.members,
      loads: previous.loads,
      material: previous.material,
      simulation: computeSimulation(previous.nodes, previous.members, previous.loads, previous.material)
    };
  }),
  
  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    const currentState: HistoryState = {
      nodes: state.nodes,
      members: state.members,
      loads: state.loads,
      material: state.material,
    };
    return {
      past: [...state.past, currentState],
      future: newFuture,
      nodes: next.nodes,
      members: next.members,
      loads: next.loads,
      material: next.material,
      simulation: computeSimulation(next.nodes, next.members, next.loads, next.material)
    };
  }),

  pan: { x: 0, y: 0 },
  zoom: 1,
  
  selectedEntities: [],
  setSelectedEntities: (entities) => set({ selectedEntities: entities }),
  
  defaultLoadMagnitude: 10000,
  defaultLoadAngle: -90,
  defaultLoadAngleZ: 0,
  setDefaultLoadMagnitude: (mag) => set({ defaultLoadMagnitude: mag }),
  setDefaultLoadAngle: (angle) => set({ defaultLoadAngle: angle }),
  setDefaultLoadAngleZ: (angle) => set({ defaultLoadAngleZ: angle }),
  
  deformationScale: 100,
  setDeformationScale: (scale) => set({ deformationScale: scale }),
  showDeformation: true,
  setShowDeformation: (show) => set({ showDeformation: show }),
  showGrid: true,
  setShowGrid: (show) => set({ showGrid: show }),
  showValues: false,
  setShowValues: (show) => set({ showValues: show }),
  free3DMovement: false,
  setFree3DMovement: (free) => set({ free3DMovement: free }),
  animationSpeed: 1,
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  setTool: (tool) => set({ tool }),
  
  addNode: (x, y, z = 0) => {
    get().pushHistory();
    set((state) => {
      const snap = 20;
      const snappedX = Math.round(x / snap) * snap;
      const snappedY = Math.round(y / snap) * snap;
      const snappedZ = Math.round(z / snap) * snap;
      
      if (state.nodes.some(n => Math.abs(n.x - snappedX) < 1 && Math.abs(n.y - snappedY) < 1 && Math.abs((n.z || 0) - snappedZ) < 1)) {
        return state;
      }

      const newNode: Node = { id: `n_${Date.now()}_${Math.random()}`, x: snappedX, y: snappedY, z: snappedZ };
      const newNodes = [...state.nodes, newNode];
      return { nodes: newNodes, simulation: computeSimulation(newNodes, state.members, state.loads, state.material) };
    });
  },

  addMember: (source, target) => {
    get().pushHistory();
    set((state) => {
      if (source === target) return state;
      if (state.members.some(m => (m.source === source && m.target === target) || (m.source === target && m.target === source))) {
        return state;
      }
      const newMember: Member = { id: `m_${Date.now()}_${Math.random()}`, source, target };
      const newMembers = [...state.members, newMember];
      return { members: newMembers, simulation: computeSimulation(state.nodes, newMembers, state.loads, state.material) };
    });
  },

  setSupport: (nodeId, type) => {
    get().pushHistory();
    set((state) => {
      const newNodes = state.nodes.map(n => {
        if (n.id === nodeId) {
          return { ...n, supportType: n.supportType === type ? null : type };
        }
        return n;
      });
      return { nodes: newNodes, simulation: computeSimulation(newNodes, state.members, state.loads, state.material) };
    });
  },

  addLoad: (nodeId, magnitude, angle, angleZ = 0) => {
    get().pushHistory();
    set((state) => {
      const existingLoad = state.loads.find(l => l.nodeId === nodeId);
      let newLoads;
      if (existingLoad) {
        newLoads = state.loads.map(l => l.nodeId === nodeId ? { ...l, magnitude, angle, angleZ } : l);
      } else {
        newLoads = [...state.loads, { id: `l_${Date.now()}`, nodeId, magnitude, angle, angleZ }];
      }
      return { loads: newLoads, simulation: computeSimulation(state.nodes, state.members, newLoads, state.material) };
    });
  },

  updateLoad: (loadId, magnitude, angle, angleZ = 0) => {
    set((state) => {
      const newLoads = state.loads.map(l => l.id === loadId ? { ...l, magnitude, angle, angleZ } : l);
      return { loads: newLoads, simulation: computeSimulation(state.nodes, state.members, newLoads, state.material) };
    });
  },

  updateNode: (id, x, y, z = 0) => set((state) => {
    const snap = 20;
    const snappedX = Math.round(x / snap) * snap;
    const snappedY = Math.round(y / snap) * snap;
    const snappedZ = Math.round(z / snap) * snap;
    
    const newNodes = state.nodes.map(n => n.id === id ? { ...n, x: snappedX, y: snappedY, z: snappedZ } : n);
    return { nodes: newNodes, simulation: computeSimulation(newNodes, state.members, state.loads, state.material) };
  }),

  updateNodes: (initialPositions, dx, dy, dz = 0) => set((state) => {
    const snap = 20;
    const snappedDx = Math.round(dx / snap) * snap;
    const snappedDy = Math.round(dy / snap) * snap;
    const snappedDz = Math.round(dz / snap) * snap;
    
    const newNodes = state.nodes.map(n => {
      if (initialPositions[n.id]) {
        return { 
          ...n, 
          x: initialPositions[n.id].x + snappedDx, 
          y: initialPositions[n.id].y + snappedDy,
          z: (initialPositions[n.id].z || 0) + snappedDz
        };
      }
      return n;
    });
    return { nodes: newNodes, simulation: computeSimulation(newNodes, state.members, state.loads, state.material) };
  }),

  deleteEntity: (id, type) => {
    get().pushHistory();
    set((state) => {
      let newNodes = state.nodes;
      let newMembers = state.members;
      let newLoads = state.loads;

      if (type === 'node') {
        newNodes = newNodes.filter(n => n.id !== id);
        newMembers = newMembers.filter(m => m.source !== id && m.target !== id);
        newLoads = newLoads.filter(l => l.nodeId !== id);
      } else if (type === 'member') {
        newMembers = newMembers.filter(m => m.id !== id);
      } else if (type === 'load') {
        newLoads = newLoads.filter(l => l.id !== id);
      }

      return { 
        nodes: newNodes, 
        members: newMembers, 
        loads: newLoads,
        simulation: computeSimulation(newNodes, newMembers, newLoads, state.material)
      };
    });
  },

  duplicateSelectedEntities: () => {
    get().pushHistory();
    let returnedEntities: { id: string, type: 'node' | 'member' | 'load', x?: number, y?: number, z?: number }[] = [];
    set((state) => {
      const selectedNodes = state.selectedEntities.filter(e => e.type === 'node').map(e => e.id);
      const selectedMembers = state.selectedEntities.filter(e => e.type === 'member').map(e => e.id);
      
      const newNodes: Node[] = [];
      const newMembers: Member[] = [];
      const newSelectedEntities: { id: string, type: 'node' | 'member' | 'load', x?: number, y?: number, z?: number }[] = [];
      
      const nodeMap: Record<string, string> = {}; // oldId -> newId
      
      // Duplicate nodes
      state.nodes.forEach(n => {
        if (selectedNodes.includes(n.id)) {
          const newId = `n_${Date.now()}_${Math.random()}`;
          nodeMap[n.id] = newId;
          newNodes.push({ ...n, id: newId });
          newSelectedEntities.push({ id: newId, type: 'node', x: n.x, y: n.y, z: n.z || 0 });
        }
      });
      
      // Duplicate members
      state.members.forEach(m => {
        if (selectedMembers.includes(m.id)) {
          // If both source and target are selected, connect the new nodes
          // Otherwise, connect to the existing node
          const newSource = nodeMap[m.source] || m.source;
          const newTarget = nodeMap[m.target] || m.target;
          
          const newId = `m_${Date.now()}_${Math.random()}`;
          newMembers.push({ ...m, id: newId, source: newSource, target: newTarget });
          newSelectedEntities.push({ id: newId, type: 'member' });
        }
      });
      
      const updatedNodes = [...state.nodes, ...newNodes];
      const updatedMembers = [...state.members, ...newMembers];
      
      returnedEntities = newSelectedEntities;
      
      return {
        nodes: updatedNodes,
        members: updatedMembers,
        selectedEntities: newSelectedEntities.map(e => ({ id: e.id, type: e.type })),
        simulation: computeSimulation(updatedNodes, updatedMembers, state.loads, state.material)
      };
    });
    return returnedEntities;
  },

  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom }),
  
  setMaterial: (material) => {
    get().pushHistory();
    set((state) => ({ 
      material,
      simulation: computeSimulation(state.nodes, state.members, state.loads, material)
    }));
  },

  resetSimulation: () => set((state) => {
    const resetMembers = state.members.map(m => ({ ...m, isBroken: false }));
    return { members: resetMembers, simulation: computeSimulation(state.nodes, resetMembers, state.loads, state.material) };
  }),

  stepSimulation: () => set((state) => {
    if (state.mode !== 'SIMULATION') return state;
    
    // In a real dynamic simulation, nodes/loads might move autonomously here.
    // For now, we just recompute if needed, but to avoid 60fps React re-renders 
    // when nothing is moving, we can skip the state update if the simulation 
    // is already up to date. Since our current physics is static equilibrium,
    // the simulation only changes when nodes/loads/members change.
    // However, to satisfy the "run continuously" requirement without killing performance,
    // we'll just return the current state if no autonomous movement happened.
    // If we add moving loads later, we would update them here and return the new simulation.
    
    return state; // No autonomous changes yet, so return state to prevent re-render
  }),

  clearAll: () => {
    set({ nodes: [], members: [], loads: [], simulation: null, past: [], future: [] });
  },

  breakMember: (id) => set((state) => {
    const newMembers = state.members.map(m => m.id === id ? { ...m, isBroken: true } : m);
    return { members: newMembers, simulation: computeSimulation(state.nodes, newMembers, state.loads, state.material) };
  }),

  currentPreset: null,
  presetSpan: 300,
  setPresetSpan: (span) => {
    set({ presetSpan: span });
    const state = get();
    if (state.currentPreset) {
      state.loadPreset(state.currentPreset as any);
    }
  },
  presetHeight: 150,
  setPresetHeight: (height) => {
    set({ presetHeight: height });
    const state = get();
    if (state.currentPreset) {
      state.loadPreset(state.currentPreset as any);
    }
  },

  loadPreset: (presetName) => {
    if (get().currentPreset !== presetName) {
      get().pushHistory();
    }
    set((state) => {
      const { nodes: newNodes, members: newMembers, loads: newLoads } = generatePreset(presetName, state.presetSpan, state.presetHeight);
      return { 
        currentPreset: presetName,
        nodes: newNodes, 
        members: newMembers, 
        loads: newLoads,
        simulation: computeSimulation(newNodes, newMembers, newLoads, state.material)
      };
    });
  },

  autoFix: (type) => {
    get().pushHistory();
    set((state) => {
      if (type === 'stronger_material') {
        const newMaterial = {
          name: 'High Strength Steel',
          elasticModulus: 200e9,
          yieldStrength: 500e6,
          density: 7850,
          area: 0.01
        };
        return {
          material: newMaterial,
          simulation: computeSimulation(state.nodes, state.members, state.loads, newMaterial)
        };
      }
      
      if (type === 'add_supports') {
        // Find bottom-most nodes without supports
        const newNodes = [...state.nodes];
        const sortedByY = [...newNodes].sort((a, b) => b.y - a.y);
        if (sortedByY.length >= 2) {
          const bottomNodes = sortedByY.filter(n => Math.abs(n.y - sortedByY[0].y) < 10);
          
          let added = false;
          // Add pin to leftmost, roller to rightmost
          const sortedByX = bottomNodes.sort((a, b) => a.x - b.x);
          if (sortedByX.length > 0 && !sortedByX[0].supportType) {
            const idx = newNodes.findIndex(n => n.id === sortedByX[0].id);
            newNodes[idx] = { ...newNodes[idx], supportType: 'pin' };
            added = true;
          }
          if (sortedByX.length > 1 && !sortedByX[sortedByX.length - 1].supportType) {
            const idx = newNodes.findIndex(n => n.id === sortedByX[sortedByX.length - 1].id);
            newNodes[idx] = { ...newNodes[idx], supportType: 'rollerX' };
            added = true;
          }
          
          if (added) {
            return {
              nodes: newNodes,
              simulation: computeSimulation(newNodes, state.members, state.loads, state.material)
            };
          }
        }
      }
      
      if (type === 'add_diagonal') {
        const newMembers = [...state.members];
        let added = false;
        for (let i = 0; i < state.nodes.length; i++) {
          for (let j = i + 1; j < state.nodes.length; j++) {
            const n1 = state.nodes[i];
            const n2 = state.nodes[j];
            const exists = newMembers.some(m => (m.source === n1.id && m.target === n2.id) || (m.source === n2.id && m.target === n1.id));
            if (!exists) {
              const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
              if (dist > 50 && dist < 300) {
                newMembers.push({ id: `m${Date.now()}`, source: n1.id, target: n2.id });
                added = true;
                break;
              }
            }
          }
          if (added) break;
        }
        
        if (added) {
          return {
            members: newMembers,
            simulation: computeSimulation(state.nodes, newMembers, state.loads, state.material)
          };
        }
      }
      
      if (type === 'reinforce_member') {
        if (!state.simulation || !state.simulation.isStable) return state;
        
        // Find the most stressed member
        let maxStress = 0;
        let weakestMemberId = null;
        for (const [id, stress] of Object.entries(state.simulation.memberStresses)) {
          if (Math.abs(stress) > maxStress) {
            maxStress = Math.abs(stress);
            weakestMemberId = id;
          }
        }
        
        if (weakestMemberId) {
          const weakestMember = state.members.find(m => m.id === weakestMemberId);
          if (weakestMember) {
            // Duplicate the member to reinforce it
            const newMember = { 
              id: `m${Date.now()}`, 
              source: weakestMember.source, 
              target: weakestMember.target 
            };
            const newMembers = [...state.members, newMember];
            return {
              members: newMembers,
              simulation: computeSimulation(state.nodes, newMembers, state.loads, state.material)
            };
          }
        }
      }
      
      return state;
    });
  }
}));
