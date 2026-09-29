import { useEffect, useRef } from 'react';
import { useEcosystemStore, SNAPSHOT_INTERVAL } from '@/store/useEcosystemStore';
import { simulateStep } from '@/utils/ecosystemSimulator';

export function useEcosystemSimulation() {
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(true);
  const tickCountRef = useRef<number>(0);

  const batchUpdateOrganisms = useEcosystemStore((s) => s.batchUpdateOrganisms);
  const batchRemoveOrganisms = useEcosystemStore((s) => s.batchRemoveOrganisms);
  const addOrganism = useEcosystemStore((s) => s.addOrganism);
  const incrementTime = useEcosystemStore((s) => s.incrementTime);
  const pushSnapshot = useEcosystemStore((s) => s.pushSnapshot);
  const isRunning = useEcosystemStore((s) => s.isRunning);
  const isPlayback = useEcosystemStore((s) => s.isPlayback);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    const tick = (time: number) => {
      const store = useEcosystemStore.getState();

      // 回放期间模拟完全冻结：不推进、不产生新快照
      if (!store.isPlayback && isRunningRef.current && time - lastTimeRef.current > 60) {
        lastTimeRef.current = time;

        const organisms = store.organisms;
        const { updates, toRemove, toAdd } = simulateStep(organisms);

        if (updates.length > 0) {
          batchUpdateOrganisms(updates);
        }
        if (toRemove.length > 0) {
          batchRemoveOrganisms(toRemove);
        }
        toAdd.forEach(({ speciesId, position }) => {
          addOrganism(speciesId, position);
        });

        incrementTime();

        // 按固定间隔保存带时间戳的深拷贝快照
        tickCountRef.current += 1;
        if (tickCountRef.current >= SNAPSHOT_INTERVAL) {
          tickCountRef.current = 0;
          useEcosystemStore.getState().pushSnapshot();
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [batchUpdateOrganisms, batchRemoveOrganisms, addOrganism, incrementTime, pushSnapshot]);

  // 退出回放时重置节拍计数，避免恢复瞬间立刻补拍一张
  useEffect(() => {
    if (!isPlayback) {
      tickCountRef.current = 0;
    }
  }, [isPlayback]);
}
