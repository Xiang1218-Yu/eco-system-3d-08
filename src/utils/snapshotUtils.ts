import * as THREE from 'three';
import type { Organism } from '@/types/ecosystem';

/**
 * 时间轴快照。
 *
 * 注意：快照内的 position / velocity 必须是独立的 THREE.Vector3 深拷贝，
 * 不能直接持有 store 中的引用——否则模拟推进时向量会被原地修改，
 * 历史帧会被“污染”。
 */
export interface Snapshot {
  /** 快照序号（单调递增，去重用） */
  id: number;
  /** 该帧的模拟时刻（simulationTime） */
  time: number;
  /** 拍摄快照时的真实时间戳（Date.now()） */
  timestamp: number;
  organisms: Organism[];
  selectedOrganismId: string | null;
  selectedSpeciesId: string | null;
}

/** 深拷贝单个生物，重建 position / velocity 两个三维向量 */
export function cloneOrganism(organism: Organism): Organism {
  return {
    ...organism,
    position: organism.position.clone(),
    velocity: organism.velocity.clone(),
  };
}

/** 深拷贝整个生物数组 */
export function cloneOrganisms(organisms: Organism[]): Organism[] {
  return organisms.map(cloneOrganism);
}

/**
 * 从快照恢复生物数组。
 * 恢复时再克隆一次向量，保证“正在展示的历史帧”与 history 中存储的帧
 * 完全隔离（即便有代码误改当前 state，也不会写回历史）。
 */
export function restoreOrganisms(snapshotOrganisms: Organism[]): Organism[] {
  return snapshotOrganisms.map((o) => ({
    ...o,
    position: new THREE.Vector3(o.position.x, o.position.y, o.position.z),
    velocity: new THREE.Vector3(o.velocity.x, o.velocity.y, o.velocity.z),
  }));
}
