import { Node, Member, Load } from './physics';

export function generatePreset(presetName: string, customSpan?: number, customHeight?: number): { nodes: Node[], members: Member[], loads: Load[] } {
  const nodes: Node[] = [];
  const members: Member[] = [];
  const loads: Load[] = [];

  const startX = -200;
  const startY = 0;
  const span = customSpan || 100;
  const height = customHeight || 100;
  const depth = 100; // Z-direction spacing

  const addNode = (id: string, x: number, y: number, z: number, supportType?: any) => {
    nodes.push({ id, x, y, z, supportType });
  };

  const addMember = (id: string, source: string, target: string) => {
    members.push({ id, source, target });
  };

  if (['warren', 'pratt', 'howe', 'k-truss'].includes(presetName)) {
    const numBays = 4;
    // Front and Back trusses
    for (let zIdx = 0; zIdx < 2; zIdx++) {
      const z = zIdx === 0 ? depth / 2 : -depth / 2;
      const prefix = zIdx === 0 ? 'f' : 'b'; // front or back

      // Bottom chord
      for (let i = 0; i <= numBays; i++) {
        const support = i === 0 ? (zIdx === 0 ? 'pin' : 'rollerZ') : (i === numBays ? 'rollerX' : null);
        addNode(`${prefix}_nb${i}`, startX + i * span, startY, z, support);
      }
      
      // Top chord
      if (presetName === 'warren') {
        for (let i = 0; i < numBays; i++) {
          addNode(`${prefix}_nt${i}`, startX + span / 2 + i * span, startY + height, z);
        }
      } else {
        for (let i = 0; i <= numBays; i++) {
          addNode(`${prefix}_nt${i}`, startX + i * span, startY + height, z);
        }
      }

      // Bottom members
      for (let i = 0; i < numBays; i++) addMember(`${prefix}_mb${i}`, `${prefix}_nb${i}`, `${prefix}_nb${i+1}`);
      
      // Top members
      const topCount = presetName === 'warren' ? numBays - 1 : numBays;
      for (let i = 0; i < topCount; i++) addMember(`${prefix}_mt${i}`, `${prefix}_nt${i}`, `${prefix}_nt${i+1}`);

      // Web members
      if (presetName === 'warren') {
        for (let i = 0; i < numBays; i++) {
          addMember(`${prefix}_md1_${i}`, `${prefix}_nb${i}`, `${prefix}_nt${i}`);
          addMember(`${prefix}_md2_${i}`, `${prefix}_nt${i}`, `${prefix}_nb${i+1}`);
        }
      } else if (presetName === 'pratt') {
        for (let i = 0; i <= numBays; i++) addMember(`${prefix}_mv${i}`, `${prefix}_nb${i}`, `${prefix}_nt${i}`);
        addMember(`${prefix}_md0`, `${prefix}_nt0`, `${prefix}_nb1`);
        addMember(`${prefix}_md1`, `${prefix}_nt1`, `${prefix}_nb2`);
        addMember(`${prefix}_md2`, `${prefix}_nt4`, `${prefix}_nb3`);
        addMember(`${prefix}_md3`, `${prefix}_nt3`, `${prefix}_nb2`);
      } else if (presetName === 'howe') {
        for (let i = 0; i <= numBays; i++) addMember(`${prefix}_mv${i}`, `${prefix}_nb${i}`, `${prefix}_nt${i}`);
        addMember(`${prefix}_md0`, `${prefix}_nb0`, `${prefix}_nt1`);
        addMember(`${prefix}_md1`, `${prefix}_nb1`, `${prefix}_nt2`);
        addMember(`${prefix}_md2`, `${prefix}_nb4`, `${prefix}_nt3`);
        addMember(`${prefix}_md3`, `${prefix}_nb3`, `${prefix}_nt2`);
      } else if (presetName === 'k-truss') {
        for (let i = 0; i <= numBays; i++) {
          if (i === numBays / 2) {
            // Middle vertical has no middle node
            addMember(`${prefix}_mv_${i}`, `${prefix}_nb${i}`, `${prefix}_nt${i}`);
          } else {
            addNode(`${prefix}_nm${i}`, startX + i * span, startY + height / 2, z);
            addMember(`${prefix}_mv1_${i}`, `${prefix}_nb${i}`, `${prefix}_nm${i}`);
            addMember(`${prefix}_mv2_${i}`, `${prefix}_nm${i}`, `${prefix}_nt${i}`);
          }
        }
        for (let i = 0; i < numBays; i++) {
          if (i < numBays / 2) {
            addMember(`${prefix}_md1_${i}`, `${prefix}_nm${i}`, `${prefix}_nt${i+1}`);
            addMember(`${prefix}_md2_${i}`, `${prefix}_nm${i}`, `${prefix}_nb${i+1}`);
          } else {
            addMember(`${prefix}_md1_${i}`, `${prefix}_nm${i+1}`, `${prefix}_nt${i}`);
            addMember(`${prefix}_md2_${i}`, `${prefix}_nm${i+1}`, `${prefix}_nb${i}`);
          }
        }
      }
    }

    // Cross bracing (connect front and back)
    for (let i = 0; i <= numBays; i++) {
      addMember(`cb_b${i}`, `f_nb${i}`, `b_nb${i}`);
      if (presetName !== 'warren' || i < numBays) {
        addMember(`cb_t${i}`, `f_nt${i}`, `b_nt${i}`);
      }
    }
    for (let i = 0; i < numBays; i++) {
      // Bottom chord cross bracing
      addMember(`cd_b1_${i}`, `f_nb${i}`, `b_nb${i+1}`);
      addMember(`cd_b2_${i}`, `b_nb${i}`, `f_nb${i+1}`);

      // Top chord cross bracing
      if (presetName !== 'warren' || i < numBays - 1) {
        addMember(`cd_t1_${i}`, `f_nt${i}`, `b_nt${i+1}`);
        addMember(`cd_t2_${i}`, `b_nt${i}`, `f_nt${i+1}`);
      }
    }

    // Vertical/portal cross bracing
    for (let i = 0; i <= numBays; i++) {
      if (presetName === 'k-truss') {
        if (i === numBays / 2) {
          addMember(`cv_1_${i}`, `f_nb${i}`, `b_nt${i}`);
          addMember(`cv_2_${i}`, `b_nb${i}`, `f_nt${i}`);
        } else {
          addMember(`cv_1_${i}`, `f_nm${i}`, `b_nt${i}`);
          addMember(`cv_2_${i}`, `f_nm${i}`, `b_nb${i}`);
          addMember(`cv_3_${i}`, `b_nm${i}`, `f_nt${i}`);
          addMember(`cv_4_${i}`, `b_nm${i}`, `f_nb${i}`);
          addMember(`cb_m${i}`, `f_nm${i}`, `b_nm${i}`);
        }
      } else if (presetName !== 'warren') {
        addMember(`cv_1_${i}`, `f_nb${i}`, `b_nt${i}`);
        addMember(`cv_2_${i}`, `b_nb${i}`, `f_nt${i}`);
      }
    }
    if (presetName === 'warren') {
      addMember(`cv_1_0`, `f_nb0`, `b_nt0`);
      addMember(`cv_2_0`, `b_nb0`, `f_nt0`);
      addMember(`cv_1_end`, `f_nb${numBays}`, `b_nt${numBays-1}`);
      addMember(`cv_2_end`, `b_nb${numBays}`, `f_nt${numBays-1}`);
    }

    // Loads
    loads.push({ id: 'l1', nodeId: 'f_nb2', magnitude: 25000, angle: -90 });
    loads.push({ id: 'l2', nodeId: 'b_nb2', magnitude: 25000, angle: -90 });

  } else if (presetName === 'bowstring') {
    const numBays = 6;
    const arcHeight = 120;
    for (let zIdx = 0; zIdx < 2; zIdx++) {
      const z = zIdx === 0 ? depth / 2 : -depth / 2;
      const prefix = zIdx === 0 ? 'f' : 'b';

      for (let i = 0; i <= numBays; i++) {
        const support = i === 0 ? (zIdx === 0 ? 'pin' : 'rollerZ') : (i === numBays ? 'rollerX' : null);
        addNode(`${prefix}_nb${i}`, startX + i * span, startY, z, support);
        
        if (i > 0 && i < numBays) {
          const xNormalized = (i / numBays) * 2 - 1; // -1 to 1
          const y = startY + arcHeight * (1 - xNormalized * xNormalized);
          addNode(`${prefix}_nt${i}`, startX + i * span, y, z);
        }
      }

      const getTopNode = (i: number) => (i === 0 || i === numBays) ? `${prefix}_nb${i}` : `${prefix}_nt${i}`;

      for (let i = 0; i < numBays; i++) {
        addMember(`${prefix}_mb${i}`, `${prefix}_nb${i}`, `${prefix}_nb${i+1}`);
        addMember(`${prefix}_mt${i}`, getTopNode(i), getTopNode(i+1));
        addMember(`${prefix}_md1_${i}`, `${prefix}_nb${i}`, getTopNode(i+1));
        addMember(`${prefix}_md2_${i}`, getTopNode(i), `${prefix}_nb${i+1}`);
      }
      for (let i = 1; i < numBays; i++) {
        addMember(`${prefix}_mv${i}`, `${prefix}_nb${i}`, getTopNode(i));
      }
    }

    for (let i = 0; i <= numBays; i++) {
      addMember(`cb_b${i}`, `f_nb${i}`, `b_nb${i}`);
      if (i > 0 && i < numBays) {
        addMember(`cb_t${i}`, `f_nt${i}`, `b_nt${i}`);
      }
    }
    for (let i = 0; i < numBays; i++) {
      addMember(`cd_b1_${i}`, `f_nb${i}`, `b_nb${i+1}`);
      addMember(`cd_b2_${i}`, `b_nb${i}`, `f_nb${i+1}`);

      const getTopNodeF = (i: number) => (i === 0 || i === numBays) ? `f_nb${i}` : `f_nt${i}`;
      const getTopNodeB = (i: number) => (i === 0 || i === numBays) ? `b_nb${i}` : `b_nt${i}`;

      addMember(`cd_t1_${i}`, getTopNodeF(i), getTopNodeB(i+1));
      addMember(`cd_t2_${i}`, getTopNodeB(i), getTopNodeF(i+1));
    }

    loads.push({ id: 'l1', nodeId: 'f_nb3', magnitude: 25000, angle: -90 });
    loads.push({ id: 'l2', nodeId: 'b_nb3', magnitude: 25000, angle: -90 });

  } else if (presetName === 'suspension') {
    const numBays = 8;
    const towerHeight = 200;
    const sag = 150;
    for (let zIdx = 0; zIdx < 2; zIdx++) {
      const z = zIdx === 0 ? depth / 2 : -depth / 2;
      const prefix = zIdx === 0 ? 'f' : 'b';

      for (let i = 0; i <= numBays; i++) {
        const support = (i === 0 || i === numBays) ? (zIdx === 0 ? 'pin' : 'rollerZ') : null;
        addNode(`${prefix}_nb${i}`, startX + i * span, startY, z, support);
        
        // Cable curve (parabola)
        const xNormalized = (i / numBays) * 2 - 1;
        const y = startY + towerHeight - sag * (1 - xNormalized * xNormalized);
        addNode(`${prefix}_nc${i}`, startX + i * span, y, z, (i === 0 || i === numBays) ? 'fixed' : null);
      }

      for (let i = 0; i < numBays; i++) {
        addMember(`${prefix}_mb${i}`, `${prefix}_nb${i}`, `${prefix}_nb${i+1}`);
        addMember(`${prefix}_mc${i}`, `${prefix}_nc${i}`, `${prefix}_nc${i+1}`);
        // Add stiffening diagonals to make the suspension bridge stable
        addMember(`${prefix}_md1_${i}`, `${prefix}_nb${i}`, `${prefix}_nc${i+1}`);
        addMember(`${prefix}_md2_${i}`, `${prefix}_nc${i}`, `${prefix}_nb${i+1}`);
      }
      for (let i = 1; i < numBays; i++) {
        addMember(`${prefix}_mv${i}`, `${prefix}_nb${i}`, `${prefix}_nc${i}`);
      }
    }

    for (let i = 0; i <= numBays; i++) {
      addMember(`cb_b${i}`, `f_nb${i}`, `b_nb${i}`);
    }
    for (let i = 0; i < numBays; i++) {
      addMember(`cd_b1_${i}`, `f_nb${i}`, `b_nb${i+1}`);
      addMember(`cd_b2_${i}`, `b_nb${i}`, `f_nb${i+1}`);

      addMember(`cd_c1_${i}`, `f_nc${i}`, `b_nc${i+1}`);
      addMember(`cd_c2_${i}`, `b_nc${i}`, `f_nc${i+1}`);
    }

    loads.push({ id: 'l1', nodeId: 'f_nb4', magnitude: 25000, angle: -90 });
    loads.push({ id: 'l2', nodeId: 'b_nb4', magnitude: 25000, angle: -90 });

  }

  return { nodes, members, loads };
}
