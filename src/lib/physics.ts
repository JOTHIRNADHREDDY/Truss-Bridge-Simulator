export interface Node {
  id: string;
  x: number;
  y: number;
  z?: number;
  supportType?: 'pin' | 'rollerX' | 'rollerY' | 'rollerZ' | 'fixed' | null;
}

export interface Member {
  id: string;
  source: string;
  target: string;
  isBroken?: boolean;
}

export interface Load {
  id: string;
  nodeId: string;
  magnitude: number;
  angle: number; // in degrees, in XY plane
  angleZ?: number; // in degrees, angle from XY plane
}

export interface Material {
  name: string;
  yieldStrength: number;
  elasticModulus: number;
  density: number;
  area: number;
  color?: string;
}

export interface SimulationResult {
  isStable: boolean;
  memberForces: Record<string, number>;
  memberStresses: Record<string, number>;
  maxStress: number;
  displacements: Record<string, { dx: number; dy: number; dz: number }>;
  reactionForces: Record<string, { fx: number; fy: number; fz: number }>;
}

export function solveTruss(
  nodes: Node[],
  members: Member[],
  loads: Load[],
  material: Material
): SimulationResult {
  const n = nodes.length;
  if (n === 0) {
    return { isStable: true, memberForces: {}, memberStresses: {}, maxStress: 0, displacements: {}, reactionForces: {} };
  }
  if (members.length === 0) {
    return { isStable: false, memberForces: {}, memberStresses: {}, maxStress: 0, displacements: {}, reactionForces: {} };
  }

  const nodeIndex = new Map<string, number>();
  nodes.forEach((node, i) => nodeIndex.set(node.id, i));

  const K = Array(3 * n).fill(0).map(() => Array(3 * n).fill(0));
  const F = Array(3 * n).fill(0);

  // Assemble global stiffness matrix
  for (const member of members) {
    if (member.isBroken) continue;
    
    const i = nodeIndex.get(member.source);
    const j = nodeIndex.get(member.target);
    if (i === undefined || j === undefined) continue;

    const n1 = nodes[i];
    const n2 = nodes[j];

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = (n2.z || 0) - (n1.z || 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L === 0) continue;

    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;
    const EA_L = (material.elasticModulus * material.area) / L;

    const T = [-cx, -cy, -cz, cx, cy, cz];
    
    const indices = [3 * i, 3 * i + 1, 3 * i + 2, 3 * j, 3 * j + 1, 3 * j + 2];
    for (let r = 0; r < 6; r++) {
      for (let c_idx = 0; c_idx < 6; c_idx++) {
        K[indices[r]][indices[c_idx]] += EA_L * T[r] * T[c_idx];
      }
    }
  }

  // Apply loads
  for (const load of loads) {
    const i = nodeIndex.get(load.nodeId);
    if (i !== undefined) {
      const radXY = (load.angle * Math.PI) / 180;
      const radZ = ((load.angleZ || 0) * Math.PI) / 180;
      
      const fx = load.magnitude * Math.cos(radXY) * Math.cos(radZ);
      const fy = load.magnitude * Math.sin(radXY) * Math.cos(radZ);
      const fz = load.magnitude * Math.sin(radZ);
      
      F[3 * i] += fx;
      F[3 * i + 1] += fy;
      F[3 * i + 2] += fz;
    }
  }

  // Apply boundary conditions
  const fixedDofs = new Set<number>();
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.supportType === 'pin' || node.supportType === 'fixed') {
      fixedDofs.add(3 * i);
      fixedDofs.add(3 * i + 1);
      fixedDofs.add(3 * i + 2);
    } else if (node.supportType === 'rollerX') {
      fixedDofs.add(3 * i + 1); // fixed in Y
      fixedDofs.add(3 * i + 2); // fixed in Z
    } else if (node.supportType === 'rollerY') {
      fixedDofs.add(3 * i); // fixed in X
      fixedDofs.add(3 * i + 2); // fixed in Z
    } else if (node.supportType === 'rollerZ') {
      fixedDofs.add(3 * i); // fixed in X
      fixedDofs.add(3 * i + 1); // fixed in Y
    } else {
      // If no support, we still need to prevent out-of-plane rigid body motion if the structure is purely 2D.
      // We can check if all nodes have z=0 and no z-loads. If so, fix all Z dofs to prevent singular matrix.
    }
  }

  // Check if structure is purely 2D (all z=0, all loads have fz=0)
  let is2D = true;
  for (let i = 0; i < n; i++) {
    if ((nodes[i].z || 0) !== 0) {
      is2D = false;
      break;
    }
  }
  if (is2D) {
    for (let i = 0; i < n; i++) {
      fixedDofs.add(3 * i + 2); // fix all Z dofs
    }
  }

  // Save original K and F for reaction force calculation
  const K_orig = K.map(row => [...row]);
  const F_orig = [...F];

  for (const dof of fixedDofs) {
    for (let j = 0; j < 3 * n; j++) {
      K[dof][j] = 0;
      K[j][dof] = 0;
    }
    K[dof][dof] = 1;
    F[dof] = 0;
  }

  // Solve KU = F
  const U = solveLinearSystem(K, F);
  
  if (!U) {
    console.warn("Simulation failed: Structure is unstable (singular stiffness matrix).");
    return { isStable: false, memberForces: {}, memberStresses: {}, maxStress: 0, displacements: {}, reactionForces: {} };
  }

  const memberForces: Record<string, number> = {};
  const memberStresses: Record<string, number> = {};
  let maxStress = 0;
  const displacements: Record<string, { dx: number; dy: number; dz: number }> = {};
  const reactionForces: Record<string, { fx: number; fy: number; fz: number }> = {};

  for (let i = 0; i < n; i++) {
    displacements[nodes[i].id] = { dx: U[3 * i], dy: U[3 * i + 1], dz: U[3 * i + 2] };
  }

  // Calculate reaction forces: R = K_orig * U - F_orig
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.supportType) {
      let rx = 0;
      let ry = 0;
      let rz = 0;
      for (let j = 0; j < 3 * n; j++) {
        rx += K_orig[3 * i][j] * U[j];
        ry += K_orig[3 * i + 1][j] * U[j];
        rz += K_orig[3 * i + 2][j] * U[j];
      }
      rx -= F_orig[3 * i];
      ry -= F_orig[3 * i + 1];
      rz -= F_orig[3 * i + 2];
      reactionForces[node.id] = { fx: rx, fy: ry, fz: rz };
    }
  }

  for (const member of members) {
    if (member.isBroken) {
      memberForces[member.id] = 0;
      memberStresses[member.id] = 0;
      continue;
    }

    const i = nodeIndex.get(member.source)!;
    const j = nodeIndex.get(member.target)!;
    const n1 = nodes[i];
    const n2 = nodes[j];

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = (n2.z || 0) - (n1.z || 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;
    const EA_L = (material.elasticModulus * material.area) / L;

    const u_ix = U[3 * i];
    const u_iy = U[3 * i + 1];
    const u_iz = U[3 * i + 2];
    const u_jx = U[3 * j];
    const u_jy = U[3 * j + 1];
    const u_jz = U[3 * j + 2];

    // Force = EA/L * [-cx -cy -cz cx cy cz] * U
    const force = EA_L * (-cx * u_ix - cy * u_iy - cz * u_iz + cx * u_jx + cy * u_jy + cz * u_jz);
    const stress = force / material.area;

    memberForces[member.id] = force;
    memberStresses[member.id] = stress;
    maxStress = Math.max(maxStress, Math.abs(stress));
  }

  return { isStable: true, memberForces, memberStresses, maxStress, displacements, reactionForces };
}

function solveLinearSystem(A: number[][], B: number[]): number[] | null {
  const n = B.length;
  const a = A.map(row => [...row]);
  const b = [...B];

  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(a[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > maxEl) {
        maxEl = Math.abs(a[k][i]);
        maxRow = k;
      }
    }

    if (maxEl < 1e-10) {
      return null; // Singular matrix (unstable structure)
    }

    for (let k = i; k < n; k++) {
      const tmp = a[maxRow][k];
      a[maxRow][k] = a[i][k];
      a[i][k] = tmp;
    }
    const tmp = b[maxRow];
    b[maxRow] = b[i];
    b[i] = tmp;

    for (let k = i + 1; k < n; k++) {
      const c = -a[k][i] / a[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          a[k][j] = 0;
        } else {
          a[k][j] += c * a[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(a[i][i]) < 1e-10) return null;
    x[i] = b[i] / a[i][i];
    for (let k = i - 1; k >= 0; k--) {
      b[k] -= a[k][i] * x[i];
    }
  }
  return x;
}
