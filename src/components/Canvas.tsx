import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas as ThreeCanvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Line, Sphere, Cylinder, Cone, Box, Html, Environment, ContactShadows, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { solveTruss as computeSimulation } from '../lib/physics';
import { Focus } from 'lucide-react';

// Helper to calculate distance and angle between two points
function getCylinderTransform(p1: THREE.Vector3, p2: THREE.Vector3) {
  const distance = p1.distanceTo(p2);
  const position = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  return { position, quaternion, distance };
}

function MemberMesh({ member, index, n1, n2, getNodePos, material, simulation, onPointerOver, onPointerOut, onClick, isSelected, isDimmed }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const targetP1 = getNodePos(n1);
  const targetP2 = getNodePos(n2);
  
  const currentP1 = useRef(targetP1.clone());
  const currentP2 = useRef(targetP2.clone());

  const [fallOffset, setFallOffset] = useState(0);
  const [fallRotation, setFallRotation] = useState(0);

  let radius = 0.05;
  let isHighStress = false;
  let stressRatio = 0;
  let stressValue = 0;

  const mode = useStore(state => state.mode);
  
  const colorDeepBlue = useMemo(() => new THREE.Color('#1e3a8a'), []);
  const colorCyan = useMemo(() => new THREE.Color('#06b6d4'), []);
  const colorGreen = useMemo(() => new THREE.Color('#10b981'), []);
  const colorYellow = useMemo(() => new THREE.Color('#eab308'), []);
  const colorOrange = useMemo(() => new THREE.Color('#f97316'), []);
  const colorRed = useMemo(() => new THREE.Color('#ef4444'), []);
  const colorDarkRed = useMemo(() => new THREE.Color('#7f1d1d'), []);

  const targetColor = useMemo(() => new THREE.Color(), []);

  if (member.isBroken) {
    targetColor.copy(colorDarkRed);
  } else if (mode === 'SIMULATION' && simulation && simulation.isStable) {
    stressValue = simulation.memberStresses[member.id] || 0;
    stressRatio = Math.abs(stressValue) / material.yieldStrength;
    const maxStress = simulation.maxStress || 1;
    
    // Normalize stress based on max stress in the system
    const normalized = Math.abs(stressValue) / maxStress;
    
    if (normalized <= 0.2) {
      targetColor.lerpColors(colorDeepBlue, colorCyan, normalized / 0.2);
    } else if (normalized <= 0.4) {
      targetColor.lerpColors(colorCyan, colorGreen, (normalized - 0.2) / 0.2);
    } else if (normalized <= 0.6) {
      targetColor.lerpColors(colorGreen, colorYellow, (normalized - 0.4) / 0.2);
    } else if (normalized <= 0.8) {
      targetColor.lerpColors(colorYellow, colorOrange, (normalized - 0.6) / 0.2);
    } else {
      targetColor.lerpColors(colorOrange, colorRed, (normalized - 0.8) / 0.2);
    }
    
    if (stressRatio > 0.7) {
      isHighStress = true;
    }
    
    radius = 0.03 + Math.min(0.05, stressRatio * 0.05);
  } else {
    targetColor.set(material.color || '#94a3b8');
  }

  if (isSelected) {
    targetColor.set('#a855f7'); // Purple for selected
    radius += 0.02;
  }

  useFrame((state, delta) => {
    const speed = useStore.getState().animationSpeed;
    
    // Lerp positions
    currentP1.current.lerp(targetP1, 10 * delta);
    currentP2.current.lerp(targetP2, 10 * delta);
    
    const { position, quaternion, distance } = getCylinderTransform(currentP1.current, currentP2.current);
    
    if (meshRef.current) {
      if (member.isBroken) {
        setFallOffset((prev) => prev - 0.5 * delta * speed);
        setFallRotation((prev) => prev + 0.2 * delta * speed);
        
        meshRef.current.position.set(position.x, position.y + fallOffset, position.z);
        meshRef.current.quaternion.copy(quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), fallRotation));
      } else {
        meshRef.current.position.copy(position);
        meshRef.current.quaternion.copy(quaternion);
        meshRef.current.scale.set(1, distance, 1); // Scale Y to match distance since we use a unit cylinder
      }
    }

    if (materialRef.current) {
      materialRef.current.color.lerp(targetColor, 10 * delta);
      
      if (isHighStress && !isSelected) {
        const pulseSpeed = stressRatio > 0.9 ? 20 : 10;
        materialRef.current.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * pulseSpeed * speed) * 0.5;
        materialRef.current.emissive.copy(targetColor);
      } else if (isSelected) {
        materialRef.current.emissiveIntensity = 0.8;
        materialRef.current.emissive.set('#a855f7');
      } else {
        materialRef.current.emissiveIntensity = 0;
      }
    }
  });

  const showValues = useStore(state => state.showValues);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate initial transform for the first render
  const initialTransform = getCylinderTransform(currentP1.current, currentP2.current);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={initialTransform.position}
        quaternion={initialTransform.quaternion}
        scale={[1, initialTransform.distance, 1]}
        onClick={(e) => onClick(e, member.id)}
        onPointerOver={(e) => {
          e.stopPropagation();
          setIsHovered(true);
          onPointerOver(e, member);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setIsHovered(false);
          onPointerOut(e);
        }}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[radius, radius, 1, 16]} />
        <meshStandardMaterial 
          ref={materialRef}
          color={targetColor.clone()} 
          transparent 
          opacity={member.isBroken ? Math.max(0, 1 + fallOffset) : isDimmed ? 0.3 : 1} 
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>
      {!member.isBroken && !isDimmed && (
        <Text
          position={[initialTransform.position.x, initialTransform.position.y + 0.2, initialTransform.position.z]}
          fontSize={0.15}
          color={isSelected ? "#60a5fa" : "#a1a1aa"}
          anchorX="center"
          anchorY="middle"
        >
          {`M${index + 1}`}
        </Text>
      )}
      
      {/* Detailed Hover Tooltip or Show Values Toggle */}
      {mode === 'SIMULATION' && simulation && simulation.isStable && (isHovered || showValues) && (
        <Html position={initialTransform.position} center zIndexRange={[100, 0]} className="pointer-events-none">
          <div className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap shadow-lg backdrop-blur-md border ${
            stressRatio > 1 ? 'bg-red-900/90 border-red-500 text-red-100' :
            stressRatio > 0.7 ? 'bg-orange-900/90 border-orange-500 text-orange-100' :
            'bg-zinc-900/90 border-zinc-700 text-zinc-100'
          }`}>
            <div className="font-bold">{Math.abs(stressValue / 1e6).toFixed(1)} MPa</div>
            {(isHovered || showValues) && (
              <>
                <div className="text-[10px] opacity-80">{stressValue > 0 ? 'Tension' : 'Compression'}</div>
                <div className="text-[10px] opacity-80">{(stressRatio * 100).toFixed(0)}% Yield</div>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function Scene({ controlsRef }: { controlsRef: any }) {
  const { 
    nodes, members, loads, tool, mode, material, simulation,
    defaultLoadMagnitude, defaultLoadAngle, defaultLoadAngleZ,
    deformationScale, showDeformation,
    addNode, addMember, setSupport, addLoad, updateLoad, deleteEntity, breakMember, updateNode, updateNodes,
    selectedEntities, setSelectedEntities, pushHistory, duplicateSelectedEntities, stepSimulation
  } = useStore();

  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [hoveredMember, setHoveredMember] = useState<any | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingLoadId, setDraggingLoadId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<THREE.Vector3 | null>(null);
  const [initialNodePositions, setInitialNodePositions] = useState<Record<string, {x: number, y: number, z: number}>>({});
  const [mousePos, setMousePos] = useState<THREE.Vector3>(new THREE.Vector3());
  const [alignmentLines, setAlignmentLines] = useState<{start: THREE.Vector3, end: THREE.Vector3}[]>([]);
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  // Camera animation state
  const targetCameraPos = useRef<THREE.Vector3 | null>(null);
  const targetCameraLookAt = useRef<THREE.Vector3 | null>(null);

  // Smooth deformation state
  const currentDisplacements = useRef<Record<string, { dx: number, dy: number, dz?: number }>>({});

  // Expose fitToView to parent via a custom event or ref if needed, 
  // but since the button is in Canvas, we can just define it here and pass it up or use it directly.
  const fitToView = () => {
    if (!controlsRef.current) return;

    let targetNodes = nodes;
    
    // Bonus: Focus Selected Object
    if (selectedEntities.length > 0) {
      const selectedNodeIds = new Set(
        selectedEntities.filter(e => e.type === 'node').map(e => e.id)
      );
      selectedEntities.filter(e => e.type === 'member').forEach(e => {
        const member = members.find(m => m.id === e.id);
        if (member) {
          selectedNodeIds.add(member.source);
          selectedNodeIds.add(member.target);
        }
      });
      
      if (selectedNodeIds.size > 0) {
        targetNodes = nodes.filter(n => selectedNodeIds.has(n.id));
      }
    }

    if (targetNodes.length === 0) return;

    // Step 1: Compute Bounding Box
    const box = new THREE.Box3();
    targetNodes.forEach(node => {
      box.expandByPoint(getNodePos(node));
    });

    // If box is empty or too small (e.g., single node)
    if (box.isEmpty()) return;
    
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Handle single node case
    if (size.lengthSq() < 0.01) {
      targetCameraLookAt.current = center.clone();
      targetCameraPos.current = center.clone().add(new THREE.Vector3(0, 0, 5));
      return;
    }

    // Step 2: Calculate Ideal Camera Distance
    const maxSize = Math.max(size.x, size.y, size.z);
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    const fov = perspectiveCamera.fov || 50;
    const aspect = perspectiveCamera.aspect || 1;
    
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * fov / 360));
    const fitWidthDistance = fitHeightDistance / aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance);
    
    // Add padding (20%)
    const padding = 1.2;
    const finalDistance = distance * padding;

    // Step 3: Move Camera Smoothly
    // We want to keep the current viewing angle if possible, just pull back/push in and center
    const currentDir = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target).normalize();
    
    // If looking straight down or weird angle, default to a nice isometric or front view
    if (currentDir.lengthSq() < 0.1) {
      currentDir.set(0, 0, 1);
    }

    targetCameraLookAt.current = center.clone();
    targetCameraPos.current = center.clone().add(currentDir.multiplyScalar(finalDistance));
  };

  // Expose fitToView to window for the HUD button
  useEffect(() => {
    (window as any).triggerFitToView = fitToView;
    
    (window as any).triggerMovingLoad = () => {
      const state = useStore.getState();
      const currentNodes = state.nodes;
      if (currentNodes.length === 0) return;
      
      // Find bottom chord nodes (lowest Y)
      const minY = Math.min(...currentNodes.map(n => n.y));
      const bottomNodes = currentNodes.filter(n => Math.abs(n.y - minY) < 10).sort((a, b) => a.x - b.x);
      
      if (bottomNodes.length < 2) return;

      let currentIndex = 0;
      const loadId = `moving_load_${Date.now()}`;
      
      // Add initial load directly
      useStore.setState(s => {
        const newLoads = [...s.loads, { id: loadId, nodeId: bottomNodes[0].id, magnitude: s.defaultLoadMagnitude * 2, angle: -90, angleZ: 0 }];
        return { 
          loads: newLoads,
          simulation: computeSimulation(s.nodes, s.members, newLoads, s.material)
        };
      });
      
      // Force a simulation update for breaking members
      useStore.getState().stepSimulation();

      const interval = setInterval(() => {
        currentIndex++;
        if (currentIndex >= bottomNodes.length) {
          clearInterval(interval);
          // Remove load
          useStore.setState(s => {
            const newLoads = s.loads.filter(l => l.id !== loadId);
            return { 
              loads: newLoads,
              simulation: computeSimulation(s.nodes, s.members, newLoads, s.material)
            };
          });
          useStore.getState().stepSimulation();
          return;
        }
        
        useStore.setState(s => {
          const newLoads = s.loads.map(l => l.id === loadId ? { ...l, nodeId: bottomNodes[currentIndex].id } : l);
          return { 
            loads: newLoads,
            simulation: computeSimulation(s.nodes, s.members, newLoads, s.material)
          };
        });
        useStore.getState().stepSimulation();
      }, 500);
    };

    return () => {
      delete (window as any).triggerFitToView;
      delete (window as any).triggerMovingLoad;
    };
  }, [nodes, members, selectedEntities, camera, addLoad, deleteEntity, defaultLoadMagnitude]);

  const maxStress = simulation?.maxStress || 0;
  const isFailing = maxStress > material.yieldStrength;
  const shakeIntensity = useRef(0);

  useFrame((state, delta) => {
    if (mode === 'SIMULATION') {
      stepSimulation();
    }

    const speed = useStore.getState().animationSpeed;
    if (isFailing && mode === 'SIMULATION') {
      shakeIntensity.current = Math.min(shakeIntensity.current + delta * 2 * speed, 0.5);
    } else {
      shakeIntensity.current = Math.max(shakeIntensity.current - delta * 2 * speed, 0);
    }

    if (shakeIntensity.current > 0 && !targetCameraPos.current) {
      const time = state.clock.getElapsedTime();
      const shakeX = Math.sin(time * 50 * speed) * shakeIntensity.current * 0.1;
      const shakeY = Math.cos(time * 43 * speed) * shakeIntensity.current * 0.1;
      
      // Apply shake as an offset from the controls target
      if (controlsRef.current) {
        const dist = camera.position.distanceTo(controlsRef.current.target);
        const dir = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target).normalize();
        
        // We don't want to permanently modify camera position, just temporarily offset it
        // But since useFrame runs every frame, we can just add a small oscillating value
        // that averages to 0 over time.
        camera.position.x += shakeX * delta * 10 * speed;
        camera.position.y += shakeY * delta * 10 * speed;
      }
    }

    // Smooth deformation
    if (simulation?.isStable && showDeformation) {
      nodes.forEach(node => {
        if (!currentDisplacements.current[node.id]) {
          currentDisplacements.current[node.id] = { dx: 0, dy: 0, dz: 0 };
        }
        const target = simulation.displacements[node.id] || { dx: 0, dy: 0, dz: 0 };
        currentDisplacements.current[node.id].dx = THREE.MathUtils.lerp(currentDisplacements.current[node.id].dx, target.dx, 10 * delta * speed);
        currentDisplacements.current[node.id].dy = THREE.MathUtils.lerp(currentDisplacements.current[node.id].dy, target.dy, 10 * delta * speed);
        currentDisplacements.current[node.id].dz = THREE.MathUtils.lerp(currentDisplacements.current[node.id].dz || 0, target.dz || 0, 10 * delta * speed);
      });
    } else {
      // Reset displacements if not showing or unstable
      nodes.forEach(node => {
        if (currentDisplacements.current[node.id]) {
          currentDisplacements.current[node.id].dx = THREE.MathUtils.lerp(currentDisplacements.current[node.id].dx, 0, 15 * delta * speed);
          currentDisplacements.current[node.id].dy = THREE.MathUtils.lerp(currentDisplacements.current[node.id].dy, 0, 15 * delta * speed);
          currentDisplacements.current[node.id].dz = THREE.MathUtils.lerp(currentDisplacements.current[node.id].dz || 0, 0, 15 * delta * speed);
        }
      });
    }

    if (targetCameraPos.current && targetCameraLookAt.current && controlsRef.current) {
      camera.position.lerp(targetCameraPos.current, 5 * delta);
      controlsRef.current.target.lerp(targetCameraLookAt.current, 5 * delta);
      controlsRef.current.update();
      
      if (camera.position.distanceTo(targetCameraPos.current) < 0.1) {
        targetCameraPos.current = null;
        targetCameraLookAt.current = null;
      }
    }
  });

  useEffect(() => {
    if (!simulation || !simulation.isStable) return;
    members.forEach(member => {
      if (member.isBroken) return;
      const stress = simulation.memberStresses[member.id] || 0;
      if (Math.abs(stress) > material.yieldStrength) {
        breakMember(member.id);
      }
    });
  }, [simulation, members, material.yieldStrength, breakMember]);

  // Handle double click to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveNode(null);
        setSelectedEntities([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedEntities]);

  useEffect(() => {
    if (selectedEntities.length === 1) {
      const selectedEntity = selectedEntities[0];
      let focusPoint = new THREE.Vector3();
      if (selectedEntity.type === 'node') {
        const node = nodes.find(n => n.id === selectedEntity.id);
        if (node) focusPoint = getNodePos(node);
      } else if (selectedEntity.type === 'member') {
        const member = members.find(m => m.id === selectedEntity.id);
        if (member) {
          const n1 = nodes.find(n => n.id === member.source);
          const n2 = nodes.find(n => n.id === member.target);
          if (n1 && n2) {
            focusPoint = getCylinderTransform(getNodePos(n1), getNodePos(n2)).position;
          }
        }
      }
      
      if (focusPoint.length() > 0) {
        targetCameraLookAt.current = focusPoint.clone();
        targetCameraPos.current = focusPoint.clone().add(new THREE.Vector3(0, 0, 8)); // Zoom in slightly
      }
    }
  }, [selectedEntities]);

  const getNodePos = (node: any) => {
    let x = node.x;
    let y = node.y;
    let z = node.z || 0;
    if (currentDisplacements.current[node.id]) {
      x += currentDisplacements.current[node.id].dx * deformationScale;
      y += currentDisplacements.current[node.id].dy * deformationScale;
      z += (currentDisplacements.current[node.id].dz || 0) * deformationScale;
    }
    return new THREE.Vector3(x / 100, y / 100, z / 100);
  };

  const handlePointerMove = (e: any) => {
    if (e.point) {
      setMousePos(e.point);
      
      if (draggingLoadId && (tool === 'SELECT' || mode === 'SIMULATION')) {
        const load = loads.find(l => l.id === draggingLoadId);
        const node = nodes.find(n => n.id === load?.nodeId);
        if (load && node) {
          const p = getNodePos(node);
          const worldX = e.point.x * 100;
          const worldY = e.point.y * 100;
          const dx = worldX - p.x * 100;
          const dy = worldY - p.y * 100;
          
          // Calculate new magnitude and angle
          const magnitude = Math.max(1000, Math.sqrt(dx * dx + dy * dy) * 500); // Scale factor for visual drag
          let angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          // Snap angle to 15 degree increments if shift is held
          if (e.shiftKey) {
            angle = Math.round(angle / 15) * 15;
          }
          
          updateLoad(load.id, magnitude, angle, load.angleZ);
        }
        return;
      }

      if (draggingNodeId && (tool === 'SELECT' || mode === 'SIMULATION') && dragStartPos) {
        const worldX = e.point.x * 100;
        const worldY = e.point.y * 100;
        
        const startWorldX = dragStartPos.x * 100;
        const startWorldY = dragStartPos.y * 100;
        
        const dx = worldX - startWorldX;
        const dy = worldY - startWorldY;
        
        updateNodes(initialNodePositions, dx, dy);
        
        // Calculate alignment lines
        const newLines: {start: THREE.Vector3, end: THREE.Vector3}[] = [];
        const selectedNodeIds = selectedEntities.filter(e => e.type === 'node').map(e => e.id);
        const unselectedNodes = nodes.filter(n => !selectedNodeIds.includes(n.id));
        
        selectedNodeIds.forEach(id => {
          const node = nodes.find(n => n.id === id);
          if (!node) return;
          
          unselectedNodes.forEach(un => {
            if (Math.abs(node.x - un.x) < 1) {
              newLines.push({
                start: new THREE.Vector3(node.x / 100, node.y / 100, 0),
                end: new THREE.Vector3(un.x / 100, un.y / 100, 0)
              });
            }
            if (Math.abs(node.y - un.y) < 1) {
              newLines.push({
                start: new THREE.Vector3(node.x / 100, node.y / 100, 0),
                end: new THREE.Vector3(un.x / 100, un.y / 100, 0)
              });
            }
          });
        });
        setAlignmentLines(newLines);
      }
    }
  };

  const handlePointerDown = (e: any) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const point = e.point;
    const worldX = point.x * 100;
    const worldY = point.y * 100;

    if (mode === 'BUILD') {
      if (tool === 'ADD_NODE') {
        addNode(worldX, worldY);
      } else if (tool === 'SELECT') {
        setSelectedEntities([]);
      }
    } else if (mode === 'SIMULATION') {
      if (tool === 'SELECT') {
        setSelectedEntities([]);
      }
    }
  };

  const handlePointerUp = () => {
    if (draggingNodeId || draggingLoadId) {
      pushHistory(); // Save state after drag finishes
      setDraggingNodeId(null);
      setDraggingLoadId(null);
      setAlignmentLines([]);
    }
  };

  const handleNodeClick = (e: any, nodeId: string) => {
    e.stopPropagation();
    if (mode === 'SIMULATION') {
      setSelectedEntities([{ id: nodeId, type: 'node' }]);
      return;
    }

    if (tool === 'SELECT') {
      if (e.shiftKey) {
        const isSelected = selectedEntities.some(ent => ent.id === nodeId);
        if (isSelected) {
          setSelectedEntities(selectedEntities.filter(ent => ent.id !== nodeId));
        } else {
          setSelectedEntities([...selectedEntities, { id: nodeId, type: 'node' }]);
        }
      } else {
        setSelectedEntities([{ id: nodeId, type: 'node' }]);
      }
    } else if (tool === 'ADD_MEMBER') {
      if (!activeNode) {
        setActiveNode(nodeId);
      } else if (activeNode !== nodeId) {
        addMember(activeNode, nodeId);
        setActiveNode(nodeId); // Keep the new node active to continue drawing
      }
    } else if (tool === 'ADD_PIN') {
      setSupport(nodeId, 'pin');
    } else if (tool === 'ADD_ROLLER_X') {
      setSupport(nodeId, 'rollerX');
    } else if (tool === 'ADD_ROLLER_Y') {
      setSupport(nodeId, 'rollerY');
    } else if (tool === 'ADD_FIXED') {
      setSupport(nodeId, 'fixed');
    } else if (tool === 'ADD_LOAD') {
      addLoad(nodeId, defaultLoadMagnitude, defaultLoadAngle, defaultLoadAngleZ);
    } else if (tool === 'DELETE') {
      deleteEntity(nodeId, 'node');
      setSelectedEntities(selectedEntities.filter(ent => ent.id !== nodeId));
    }
  };

  const handleNodePointerDown = (e: any, nodeId: string) => {
    if ((tool === 'SELECT' || mode === 'SIMULATION') && e.button === 0) {
      e.stopPropagation();
      
      let currentSelection = selectedEntities;
      if (e.shiftKey) {
        // Shift key is handled by onClick for selection toggling
        return;
      }

      if (!selectedEntities.some(ent => ent.id === nodeId)) {
        currentSelection = [{ id: nodeId, type: 'node' }];
        setSelectedEntities(currentSelection);
      }

      let activeNodeId = nodeId;
      let initialPositions: Record<string, {x: number, y: number, z: number}> = {};

      if (e.ctrlKey || e.metaKey) {
        // Duplicate on drag
        const newEntities = duplicateSelectedEntities();
        
        // Find the newly created node that corresponds to the one we clicked
        // Since we don't have a direct mapping, we just grab the first new node
        // or we can map it by position.
        const clickedNode = nodes.find(n => n.id === nodeId);
        if (clickedNode) {
          const newClickedNode = newEntities.find(ent => ent.type === 'node' && ent.x === clickedNode.x && ent.y === clickedNode.y && ent.z === (clickedNode.z || 0));
          if (newClickedNode) {
            activeNodeId = newClickedNode.id;
          } else {
            const firstNewNode = newEntities.find(ent => ent.type === 'node');
            if (firstNewNode) activeNodeId = firstNewNode.id;
          }
        }
        
        newEntities.filter(ent => ent.type === 'node').forEach(ent => {
          if (ent.x !== undefined && ent.y !== undefined) {
            initialPositions[ent.id] = { x: ent.x, y: ent.y, z: ent.z || 0 };
          }
        });
      } else {
        currentSelection.filter(ent => ent.type === 'node').forEach(ent => {
          const node = nodes.find(n => n.id === ent.id);
          if (node) {
            initialPositions[node.id] = { x: node.x, y: node.y, z: node.z || 0 };
          }
        });
      }

      if (currentSelection.length === 1 && tool === 'SELECT' && mode === 'BUILD') {
        // TransformControls will handle this
        return;
      }

      setDraggingNodeId(activeNodeId);
      setInitialNodePositions(initialPositions);
      setDragStartPos(e.point.clone());
    }
  };

  const handleMemberClick = (e: any, memberId: string) => {
    e.stopPropagation();
    if (mode === 'SIMULATION') {
      setSelectedEntities([{ id: memberId, type: 'member' }]);
      return;
    }

    if (tool === 'SELECT') {
      if (e.shiftKey) {
        const isSelected = selectedEntities.some(ent => ent.id === memberId);
        if (isSelected) {
          setSelectedEntities(selectedEntities.filter(ent => ent.id !== memberId));
        } else {
          setSelectedEntities([...selectedEntities, { id: memberId, type: 'member' }]);
        }
      } else {
        setSelectedEntities([{ id: memberId, type: 'member' }]);
      }
    } else if (tool === 'DELETE') {
      deleteEntity(memberId, 'member');
      setSelectedEntities(selectedEntities.filter(ent => ent.id !== memberId));
    }
  };

  const handleLoadPointerDown = (e: any, loadId: string) => {
    if ((tool === 'SELECT' || mode === 'SIMULATION') && e.button === 0) {
      e.stopPropagation();
      setDraggingLoadId(loadId);
      
      if (!selectedEntities.some(ent => ent.id === loadId)) {
        setSelectedEntities([{ id: loadId, type: 'load' }]);
      }
    }
  };

  const handleLoadClick = (e: any, loadId: string) => {
    e.stopPropagation();
    if (mode === 'SIMULATION') {
      setSelectedEntities([{ id: loadId, type: 'load' }]);
      return;
    }

    if (tool === 'SELECT') {
      if (e.shiftKey) {
        const isSelected = selectedEntities.some(ent => ent.id === loadId);
        if (isSelected) {
          setSelectedEntities(selectedEntities.filter(ent => ent.id !== loadId));
        } else {
          setSelectedEntities([...selectedEntities, { id: loadId, type: 'load' }]);
        }
      } else {
        setSelectedEntities([{ id: loadId, type: 'load' }]);
      }
    } else if (tool === 'DELETE') {
      deleteEntity(loadId, 'load');
      setSelectedEntities(selectedEntities.filter(ent => ent.id !== loadId));
    }
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setActiveNode(null);
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    setActiveNode(null);
  }, [tool, mode]);

  const hasSelection = selectedEntities.length > 0;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 15]} 
        intensity={1.5} 
        castShadow 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <Environment preset="city" />
      <fog attach="fog" args={['#09090b', 15, 40]} />
      
      <ContactShadows position={[0, -2, 0]} opacity={0.4} scale={50} blur={2} far={10} />

      {/* Interaction Plane */}
      <mesh 
        ref={planeRef} 
        position={[0, 0, -0.1]} 
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {useStore.getState().showGrid && (
        <Grid infiniteGrid fadeDistance={50} sectionColor="#3f3f46" cellColor="#27272a" position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]} />
      )}

      {/* Alignment Guides */}
      {alignmentLines.map((line, i) => (
        <Line
          key={`align-${i}`}
          points={[line.start, line.end]}
          color="#10b981"
          lineWidth={1}
          dashed
          dashScale={20}
        />
      ))}

      {/* Ghost Node Preview */}
      {tool === 'ADD_NODE' && mode === 'BUILD' && (
        <Sphere
          position={[Math.round(mousePos.x * 100 / 20) * 20 / 100, Math.round(mousePos.y * 100 / 20) * 20 / 100, 0]}
          args={[0.12, 32, 32]}
        >
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.4} roughness={0.2} metalness={0.8} />
        </Sphere>
      )}

      {/* Active Member Preview */}
      {tool === 'ADD_MEMBER' && activeNode && mode === 'BUILD' && (
        <Line
          points={[getNodePos(nodes.find(n => n.id === activeNode)!), mousePos]}
          color="#3b82f6"
          lineWidth={2}
          dashed
          dashScale={50}
        />
      )}

      {/* Members */}
      {members.map((member, index) => {
        const n1 = nodes.find(n => n.id === member.source);
        const n2 = nodes.find(n => n.id === member.target);
        if (!n1 || !n2) return null;

        const isSelected = selectedEntities.some(ent => ent.id === member.id);
        const isDimmed = hasSelection && !isSelected;

        return (
          <MemberMesh
            key={member.id}
            member={member}
            index={index}
            n1={n1}
            n2={n2}
            getNodePos={getNodePos}
            material={material}
            simulation={simulation}
            isSelected={isSelected}
            isDimmed={isDimmed}
            onClick={handleMemberClick}
            onPointerOver={(e: any, m: any) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; setHoveredMember(m); }}
            onPointerOut={() => { document.body.style.cursor = 'crosshair'; setHoveredMember(null); }}
          />
        );
      })}

      {/* Supports */}
      {nodes.map(node => {
        if (!node.supportType) return null;
        const p = getNodePos(node);
        const size = 0.2;
        const isDimmed = hasSelection && !selectedEntities.some(ent => ent.id === node.id);
        const opacity = isDimmed ? 0.3 : 1;

        return (
          <group key={`support-${node.id}`} position={[p.x, p.y, p.z - 0.05]}>
            {node.supportType === 'pin' && (
              <Cone args={[size, size * 2, 4]} position={[0, -size, 0]} rotation={[0, Math.PI/4, 0]} castShadow>
                <meshStandardMaterial color="#10b981" roughness={0.2} metalness={0.8} transparent opacity={opacity} />
              </Cone>
            )}
            {node.supportType === 'rollerX' && (
              <Sphere args={[size/1.5, 16, 16]} position={[0, -size, 0]} castShadow>
                <meshStandardMaterial color="#10b981" roughness={0.2} metalness={0.8} transparent opacity={opacity} />
              </Sphere>
            )}
            {node.supportType === 'rollerY' && (
              <Sphere args={[size/1.5, 16, 16]} position={[-size, 0, 0]} castShadow>
                <meshStandardMaterial color="#10b981" roughness={0.2} metalness={0.8} transparent opacity={opacity} />
              </Sphere>
            )}
            {node.supportType === 'fixed' && (
              <Box args={[size * 2, size, size]} position={[0, -size/2, 0]} castShadow>
                <meshStandardMaterial color="#10b981" roughness={0.2} metalness={0.8} transparent opacity={opacity} />
              </Box>
            )}
          </group>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const p = getNodePos(node);
        const isActive = node.id === activeNode;
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedEntities.some(ent => ent.id === node.id);
        const isDimmed = hasSelection && !isSelected;
        
        const hasLoad = loads.some(l => l.nodeId === node.id);
        
        const nodeMesh = (
          <Sphere
            position={p}
            args={[0.12, 32, 32]}
            onClick={(e) => handleNodeClick(e, node.id)}
            onPointerDown={(e) => handleNodePointerDown(e, node.id)}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = (tool === 'SELECT' && mode === 'BUILD') ? 'grab' : 'pointer'; setHoveredNode(node); }}
            onPointerOut={(e) => { document.body.style.cursor = 'crosshair'; setHoveredNode(null); }}
            castShadow
          >
            <meshStandardMaterial 
              color={isSelected ? '#3b82f6' : isActive ? '#60a5fa' : hasLoad ? '#f43f5e' : isHovered ? '#93c5fd' : '#e4e4e7'} 
              roughness={0.2} 
              metalness={0.8}
              transparent
              opacity={isDimmed ? 0.3 : 1}
              emissive={isSelected || isActive || isHovered ? '#3b82f6' : hasLoad ? '#f43f5e' : '#000000'}
              emissiveIntensity={isSelected ? 0.8 : isActive || isHovered ? 0.5 : hasLoad ? 0.4 : 0}
            />
          </Sphere>
        );

        return (
          <group key={node.id}>
            {isSelected && tool === 'SELECT' && mode === 'BUILD' && selectedEntities.length === 1 ? (
              <TransformControls
                mode="translate"
                showZ={useStore.getState().free3DMovement}
                onMouseUp={() => {
                  pushHistory(); // Save history on drag end
                }}
                onObjectChange={(e: any) => {
                  if (e.target && e.target.object) {
                    const pos = e.target.object.position;
                    updateNode(node.id, pos.x * 100, pos.y * 100, pos.z * 100);
                  }
                }}
              >
                {nodeMesh}
              </TransformControls>
            ) : (
              nodeMesh
            )}
            
            {/* Node Tooltip */}
            {isHovered && !isDimmed && (
              <Html position={[p.x, p.y + 0.3, p.z]} center className="pointer-events-none z-50">
                <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 text-zinc-200 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap">
                  Node: ({Math.round(node.x)}, {Math.round(node.y)})
                  {node.supportType && <div className="text-emerald-400">Support: {node.supportType}</div>}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Member Tooltip */}
      {hoveredMember && (!hasSelection || selectedEntities.some(ent => ent.id === hoveredMember.id)) && (
        <Html 
          position={getCylinderTransform(
            getNodePos(nodes.find(n => n.id === hoveredMember.source)!), 
            getNodePos(nodes.find(n => n.id === hoveredMember.target)!)
          ).position} 
          center 
          className="pointer-events-none z-50"
        >
          <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 text-zinc-200 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap">
            <div>Length: {Math.round(Math.hypot(
              nodes.find(n => n.id === hoveredMember.target)!.x - nodes.find(n => n.id === hoveredMember.source)!.x,
              nodes.find(n => n.id === hoveredMember.target)!.y - nodes.find(n => n.id === hoveredMember.source)!.y
            ))} mm</div>
            {simulation?.isStable && (
              <>
                <div className={simulation.memberForces[hoveredMember.id] > 0 ? 'text-blue-400' : 'text-orange-400'}>
                  Force: {(simulation.memberForces[hoveredMember.id] / 1000).toFixed(1)} kN
                </div>
                <div className={Math.abs(simulation.memberStresses[hoveredMember.id]) > material.yieldStrength ? 'text-red-400 font-bold' : 'text-zinc-300'}>
                  Stress: {(Math.abs(simulation.memberStresses[hoveredMember.id]) / 1e6).toFixed(1)} MPa
                </div>
                {Math.abs(simulation.memberStresses[hoveredMember.id]) > material.yieldStrength * 0.7 && (
                  <div className="text-orange-400 font-bold mt-1">
                    ⚠️ High Stress
                  </div>
                )}
              </>
            )}
          </div>
        </Html>
      )}

      {/* Loads */}
      {loads.map(load => {
        const node = nodes.find(n => n.id === load.nodeId);
        if (!node) return null;
        const p = getNodePos(node);
        
        const isSelected = selectedEntities.some(ent => ent.id === load.id);
        const isDimmed = hasSelection && !isSelected;
        const opacity = isDimmed ? 0.3 : 1;

        const arrowLen = 0.8;
        const angleRad = (load.angle * Math.PI) / 180;
        const angleZRad = ((load.angleZ || 0) * Math.PI) / 180;
        
        const dirX = Math.cos(angleRad) * Math.cos(angleZRad);
        const dirY = Math.sin(angleRad) * Math.cos(angleZRad);
        const dirZ = Math.sin(angleZRad);
        const direction = new THREE.Vector3(dirX, dirY, dirZ).normalize();
        
        const startX = p.x - direction.x * arrowLen;
        const startY = p.y - direction.y * arrowLen;
        const startZ = p.z - direction.z * arrowLen;
        
        const midX = (startX + p.x) / 2;
        const midY = (startY + p.y) / 2;
        const midZ = (startZ + p.z) / 2;
        
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

        return (
          <group 
            key={load.id} 
            onClick={(e) => handleLoadClick(e, load.id)}
            onPointerDown={(e) => handleLoadPointerDown(e, load.id)}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab'; }}
            onPointerOut={() => { document.body.style.cursor = 'crosshair'; }}
          >
            <Cylinder
              position={[midX, midY, midZ]}
              quaternion={quaternion}
              args={[0.03, 0.03, arrowLen, 16]}
              castShadow
            >
              <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={isSelected ? 0.8 : 0.2} transparent opacity={opacity} />
            </Cylinder>
            <Cone
              position={[p.x - direction.x*0.1, p.y - direction.y*0.1, p.z - direction.z*0.1]}
              quaternion={quaternion}
              args={[0.1, 0.25, 16]}
              castShadow
            >
              <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={isSelected ? 0.8 : 0.2} transparent opacity={opacity} />
            </Cone>
            {!isDimmed && (
              <Text
                position={[startX - direction.x*0.3, startY - direction.y*0.3, startZ - direction.z*0.3]}
                fontSize={0.25}
                color={isSelected ? "#fb7185" : "#f43f5e"}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                {`${(load.magnitude / 1000).toFixed(1)}kN`}
              </Text>
            )}
          </group>
        );
      })}
    </>
  );
}

export function Canvas() {
  const { tool, mode, nodes, members, undo, redo, simulation } = useStore();
  const controlsRef = useRef<any>(null);

  const handleFitToView = () => {
    if ((window as any).triggerFitToView) {
      (window as any).triggerFitToView();
    }
  };

  const setCameraView = (view: 'top' | 'iso' | 'side') => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    
    // We could use lerp here too, but for presets a direct jump or a simple GSAP animation is often better.
    // For now, we'll just set it directly to keep it simple and responsive.
    if (view === 'top') {
      controls.object.position.set(4, 2, 15);
      controls.target.set(4, 2, 0);
    } else if (view === 'iso') {
      controls.object.position.set(10, 8, 12);
      controls.target.set(4, 2, 0);
    } else if (view === 'side') {
      controls.object.position.set(-5, 2, 5);
      controls.target.set(4, 2, 0);
    }
    controls.update();
  };

  useEffect(() => {
    (window as any).triggerScreenshot = () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'truss_screenshot.png';
        a.click();
      }
    };
    return () => {
      delete (window as any).triggerScreenshot;
    };
  }, []);

  return (
    <div className="flex-1 relative bg-zinc-950 overflow-hidden cursor-crosshair">
      <ThreeCanvas shadows camera={{ position: [4, 2, 12], fov: 50, far: 100000 }} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={['#09090b']} />
        <fog attach="fog" args={['#09090b', 10, 100000]} />
        <Environment preset="city" />
        <ambientLight intensity={0.2} />
        <directionalLight 
          castShadow 
          position={[100, 200, 100]} 
          intensity={1.5} 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-1000}
          shadow-camera-right={1000}
          shadow-camera-top={1000}
          shadow-camera-bottom={-1000}
          shadow-camera-far={10000}
        />
        <Scene controlsRef={controlsRef} />
        {useStore.getState().showGrid && (
          <Grid infiniteGrid fadeDistance={10000} sectionColor="#3f3f46" cellColor="#27272a" position={[0, -0.01, 0]} />
        )}
        <axesHelper args={[500]} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={10000} blur={2} far={1000} />
        <OrbitControls 
          ref={controlsRef}
          enableDamping={true}
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={100000}
          maxPolarAngle={Math.PI / 1.5}
          makeDefault
          mouseButtons={{
            LEFT: (tool === 'SELECT' || mode === 'SIMULATION') ? THREE.MOUSE.ROTATE : undefined,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
          }}
        />
      </ThreeCanvas>
      
      {/* HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center gap-2">
        {mode === 'SIMULATION' && simulation && !simulation.isStable && (
          <div className="bg-red-900/80 backdrop-blur-sm border border-red-700 text-red-200 text-xs px-4 py-2 rounded-full shadow-lg font-medium animate-pulse">
            ⚠️ Structure Unstable
          </div>
        )}
        {mode === 'SIMULATION' && simulation && simulation.isStable && (
          members.some(m => Math.abs(simulation.memberStresses[m.id] || 0) > useStore.getState().material.yieldStrength * 0.8) && (
            <div className="bg-orange-900/80 backdrop-blur-sm border border-orange-700 text-orange-200 text-xs px-4 py-2 rounded-full shadow-lg font-medium">
              ⚠️ High Stress Detected
            </div>
          )
        )}
      </div>

      <div className="absolute top-4 right-4 pointer-events-auto z-10">
        <button
          onClick={handleFitToView}
          className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm border border-zinc-700 text-zinc-200 p-2 rounded-md shadow-lg transition-colors group relative"
          title="Fit to View"
        >
          <Focus size={20} />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Fit to View
          </span>
        </button>
      </div>

      <div className="absolute top-4 left-4 pointer-events-none space-y-2">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 text-zinc-400 text-xs px-3 py-2 rounded-md font-mono shadow-lg">
          <div className="text-zinc-200 font-semibold mb-1 flex justify-between items-center">
            <span>Status</span>
            <span className={`px-2 py-0.5 rounded text-[10px] ${mode === 'BUILD' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {mode}
            </span>
          </div>
          {mode === 'BUILD' && <div>Tool: <span className="text-blue-400">{tool}</span></div>}
          <div>Nodes: {nodes.length} | Members: {members.length}</div>
        </div>
        
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 text-zinc-400 text-xs px-3 py-2 rounded-md font-mono shadow-lg pointer-events-auto flex flex-col gap-2">
          <div className="text-zinc-200 font-semibold">Camera Presets</div>
          <div className="flex gap-2">
            <button onClick={() => setCameraView('top')} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors">Top</button>
            <button onClick={() => setCameraView('iso')} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors">Iso</button>
            <button onClick={() => setCameraView('side')} className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors">Side</button>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 text-zinc-400 text-xs px-3 py-2 rounded-md font-mono shadow-lg">
          <div>Left Click: Use Tool / Rotate</div>
          <div>Middle Mouse: Pan</div>
          <div>Scroll: Zoom</div>
          <div>Double Click: Focus Object</div>
          {mode === 'BUILD' && <div>Drag Node: Select Tool + Left Click</div>}
          {mode === 'BUILD' && <div>Duplicate: Ctrl + Drag (or Ctrl+D)</div>}
          <div className="mt-2 text-zinc-500">Shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo), Del (Delete)</div>
        </div>
      </div>
    </div>
  );
}
