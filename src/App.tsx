/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { Canvas } from './components/Canvas';
import { useStore } from './store/useStore';

export default function App() {
  const { undo, redo, selectedEntities, deleteEntity, setSelectedEntities, duplicateSelectedEntities } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedEntities.length > 0) {
          duplicateSelectedEntities();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEntities.length > 0) {
          e.preventDefault();
          selectedEntities.forEach(entity => {
            deleteEntity(entity.id, entity.type);
          });
          setSelectedEntities([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedEntities, deleteEntity, setSelectedEntities]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <LeftPanel />
      <Canvas />
      <RightPanel />
    </div>
  );
}
