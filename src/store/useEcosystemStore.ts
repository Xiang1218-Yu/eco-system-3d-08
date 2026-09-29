import { create } from 'zustand';
import * as THREE from 'three';
import type { Organism, EcosystemStats, Species } from '@/types/ecosystem';
import { getSpeciesById, SPECIES } from '@/data/species';
import {
  type Snapshot,
  cloneOrganisms,
  restoreOrganisms,
} from '@/utils/snapshotUtils';

/** 每隔多少个模拟步保存一次快照（每步约 60ms） */
export const SNAPSHOT_INTERVAL = 15;
/** 历史快照容量上限，超出后丢弃最旧的一帧（环形缓冲） */
export const MAX_HISTORY_SNAPSHOTS = 120;

/**
 * 进入回放瞬间保存的“实时活态”检查点（不放进 store state，避免无谓重渲染）。
 * 退出回放时从这里恢复，使模拟从进入时的停留时刻继续。
 */
interface LiveCheckpoint {
  organisms: Organism[];
  simulationTime: number;
  selectedOrganismId: string | null;
  selectedSpeciesId: string | null;
  wasRunning: boolean;
}

let liveCheckpoint: LiveCheckpoint | null = null;
let snapshotIdSeq = 0;

interface EcosystemStore {
  organisms: Organism[];
  selectedSpeciesId: string | null;
  selectedOrganismId: string | null;
  isRunning: boolean;
  simulationTime: number;
  showLabels: boolean;

  // —— 时间轴回放 ——
  history: Snapshot[];
  isPlayback: boolean;
  playbackIndex: number | null;

  addOrganism: (speciesId: string, position?: THREE.Vector3) => void;
  removeOrganism: (organismId: string) => void;
  updateOrganism: (organismId: string, updates: Partial<Organism>) => void;
  setSelectedSpecies: (speciesId: string | null) => void;
  setSelectedOrganism: (organismId: string | null) => void;
  toggleSimulation: () => void;
  incrementTime: () => void;
  resetEcosystem: () => void;
  toggleLabels: () => void;
  getStats: () => EcosystemStats;
  batchUpdateOrganisms: (updates: { id: string; updates: Partial<Organism> }[]) => void;
  batchRemoveOrganisms: (ids: string[]) => void;

  pushSnapshot: () => void;
  enterPlayback: () => void;
  seekPlayback: (index: number) => void;
  exitPlayback: () => void;
}

const AQUARIUM_BOUNDS = {
  minX: -4,
  maxX: 4,
  minY: -2,
  maxY: 2,
  minZ: -2,
  maxZ: 2,
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function randomPosition(species: Species): THREE.Vector3 {
  const isProducer = species.trophicLevel === 'producer';
  const minY = isProducer ? AQUARIUM_BOUNDS.minY : AQUARIUM_BOUNDS.minY + 0.3;
  const maxY = isProducer ? AQUARIUM_BOUNDS.minY + 0.5 : AQUARIUM_BOUNDS.maxY - 0.3;

  return new THREE.Vector3(
    AQUARIUM_BOUNDS.minX + Math.random() * (AQUARIUM_BOUNDS.maxX - AQUARIUM_BOUNDS.minX),
    minY + Math.random() * (maxY - minY),
    AQUARIUM_BOUNDS.minZ + Math.random() * (AQUARIUM_BOUNDS.maxZ - AQUARIUM_BOUNDS.minZ),
  );
}

function createOrganism(speciesId: string, position?: THREE.Vector3): Organism | null {
  const species = getSpeciesById(speciesId);
  if (!species) return null;

  const pos = position || randomPosition(species);

  return {
    id: generateId(),
    speciesId,
    position: pos,
    velocity: new THREE.Vector3(
      (Math.random() - 0.5) * species.speed,
      (Math.random() - 0.5) * species.speed * 0.5,
      (Math.random() - 0.5) * species.speed,
    ),
    energy: species.energyValue * (0.7 + Math.random() * 0.3),
    age: Math.random() * species.lifespan * 0.3,
    state: 'idle',
    targetId: null,
    rotation: Math.random() * Math.PI * 2,
    scale: 0.8 + Math.random() * 0.4,
  };
}

export const useEcosystemStore = create<EcosystemStore>((set, get) => ({
  organisms: [],
  selectedSpeciesId: null,
  selectedOrganismId: null,
  isRunning: true,
  simulationTime: 0,
  showLabels: true,

  history: [],
  isPlayback: false,
  playbackIndex: null,

  addOrganism: (speciesId, position) => {
    const state = get();
    // 回放中展示的是历史帧，禁止改动实时生态缸
    if (state.isPlayback) return;
    const species = getSpeciesById(speciesId);
    if (!species) return;

    const currentCount = state.organisms.filter((o) => o.speciesId === speciesId).length;
    if (currentCount >= species.maxPopulation) return;

    const organism = createOrganism(speciesId, position);
    if (organism) {
      set((prev) => ({ organisms: [...prev.organisms, organism] }));
    }
  },

  removeOrganism: (organismId) => {
    if (get().isPlayback) return;
    set((prev) => ({
      organisms: prev.organisms.filter((o) => o.id !== organismId),
      selectedOrganismId: prev.selectedOrganismId === organismId ? null : prev.selectedOrganismId,
    }));
  },

  updateOrganism: (organismId, updates) => {
    if (get().isPlayback) return;
    set((prev) => ({
      organisms: prev.organisms.map((o) => (o.id === organismId ? { ...o, ...updates } : o)),
    }));
  },

  batchUpdateOrganisms: (updates) => {
    if (get().isPlayback) return;
    set((prev) => {
      const updateMap = new Map(updates.map((u) => [u.id, u.updates]));
      return {
        organisms: prev.organisms.map((o) => {
          const update = updateMap.get(o.id);
          return update ? { ...o, ...update } : o;
        }),
      };
    });
  },

  batchRemoveOrganisms: (ids) => {
    if (get().isPlayback) return;
    const idSet = new Set(ids);
    set((prev) => ({
      organisms: prev.organisms.filter((o) => !idSet.has(o.id)),
      selectedOrganismId:
        prev.selectedOrganismId && idSet.has(prev.selectedOrganismId) ? null : prev.selectedOrganismId,
    }));
  },

  setSelectedSpecies: (speciesId) => {
    // 回放中不允许放置新物种
    if (get().isPlayback) return;
    set({ selectedSpeciesId: speciesId });
  },

  // 回放中允许点击历史生物查看其当时的信息，故不加守卫
  setSelectedOrganism: (organismId) => {
    set({ selectedOrganismId: organismId });
  },

  toggleSimulation: () => {
    // 回放期间由时间轴面板控制暂停/继续，屏蔽主控制按钮
    if (get().isPlayback) return;
    set((prev) => ({ isRunning: !prev.isRunning }));
  },

  incrementTime: () => {
    if (get().isPlayback) return;
    set((prev) => ({ simulationTime: prev.simulationTime + 1 }));
  },

  resetEcosystem: () => {
    // 重置会清空全部内容，同时丢弃历史与活态检查点、退出回放
    liveCheckpoint = null;
    set({
      organisms: [],
      selectedSpeciesId: null,
      selectedOrganismId: null,
      simulationTime: 0,
      isRunning: true,
      history: [],
      isPlayback: false,
      playbackIndex: null,
    });
  },

  toggleLabels: () => {
    set((prev) => ({ showLabels: !prev.showLabels }));
  },

  getStats: () => {
    const state = get();
    const populationBySpecies: Record<string, number> = {};
    SPECIES.forEach((s) => {
      populationBySpecies[s.id] = 0;
    });
    state.organisms.forEach((o) => {
      populationBySpecies[o.speciesId] = (populationBySpecies[o.speciesId] || 0) + 1;
    });

    let balanceIndex = 0;
    const levels = ['producer', 'herbivore', 'carnivore', 'decomposer'];
    const levelCounts: Record<string, number> = { producer: 0, herbivore: 0, carnivore: 0, decomposer: 0 };
    state.organisms.forEach((o) => {
      const sp = getSpeciesById(o.speciesId);
      if (sp) levelCounts[sp.trophicLevel]++;
    });

    const total = state.organisms.length;
    if (total > 0) {
      const idealRatios = { producer: 0.5, herbivore: 0.3, carnivore: 0.1, decomposer: 0.1 };
      let deviation = 0;
      levels.forEach((level) => {
        const actual = levelCounts[level] / total;
        deviation += Math.abs(actual - idealRatios[level]);
      });
      balanceIndex = Math.max(0, 100 - deviation * 100);
    }

    return {
      time: state.simulationTime,
      isRunning: state.isRunning,
      balanceIndex,
      populationBySpecies,
      totalOrganisms: total,
    };
  },

  // 按固定间隔保存带时间戳的深拷贝快照
  pushSnapshot: () => {
    const state = get();
    if (state.isPlayback) return;

    const snapshot: Snapshot = {
      id: ++snapshotIdSeq,
      time: state.simulationTime,
      timestamp: Date.now(),
      organisms: cloneOrganisms(state.organisms),
      selectedOrganismId: state.selectedOrganismId,
      selectedSpeciesId: state.selectedSpeciesId,
    };

    set((prev) => {
      const history =
        prev.history.length >= MAX_HISTORY_SNAPSHOTS
          ? [...prev.history.slice(prev.history.length - MAX_HISTORY_SNAPSHOTS + 1), snapshot]
          : [...prev.history, snapshot];
      return { history };
    });
  },

  // 进入回放：冻结实时活态检查点，暂停模拟并跳到最新一帧
  enterPlayback: () => {
    const state = get();
    if (state.isPlayback) return;
    if (state.history.length === 0) return;

    liveCheckpoint = {
      organisms: cloneOrganisms(state.organisms),
      simulationTime: state.simulationTime,
      selectedOrganismId: state.selectedOrganismId,
      selectedSpeciesId: state.selectedSpeciesId,
      wasRunning: state.isRunning,
    };

    const index = state.history.length - 1;
    const snapshot = state.history[index];
    set({
      isPlayback: true,
      playbackIndex: index,
      isRunning: false,
      organisms: restoreOrganisms(snapshot.organisms),
      simulationTime: snapshot.time,
      selectedOrganismId: snapshot.selectedOrganismId,
      selectedSpeciesId: snapshot.selectedSpeciesId,
    });
  },

  // 拖动滑块：原子地切换三维场景、统计时间与选中信息
  seekPlayback: (index) => {
    const state = get();
    if (!state.isPlayback) return;

    const clamped = Math.max(0, Math.min(index, state.history.length - 1));
    const snapshot = state.history[clamped];
    if (!snapshot) return;

    set({
      playbackIndex: clamped,
      organisms: restoreOrganisms(snapshot.organisms),
      simulationTime: snapshot.time,
      selectedOrganismId: snapshot.selectedOrganismId,
      selectedSpeciesId: snapshot.selectedSpeciesId,
    });
  },

  // 退出回放：丢弃当前浏览的历史帧，从停留时刻（实时活态）继续运行
  exitPlayback: () => {
    const state = get();
    if (!state.isPlayback) return;

    const checkpoint = liveCheckpoint;
    liveCheckpoint = null;

    if (!checkpoint) {
      // 理论上不会发生（进入时一定写入），保险起见做一次安全复位
      set({ isPlayback: false, playbackIndex: null, isRunning: true });
      return;
    }

    set({
      isPlayback: false,
      playbackIndex: null,
      organisms: restoreOrganisms(checkpoint.organisms),
      simulationTime: checkpoint.simulationTime,
      selectedOrganismId: checkpoint.selectedOrganismId,
      selectedSpeciesId: checkpoint.selectedSpeciesId,
      isRunning: checkpoint.wasRunning,
    });
  },
}));

export { AQUARIUM_BOUNDS };
