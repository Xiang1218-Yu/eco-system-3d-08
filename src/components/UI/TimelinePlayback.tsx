import { History, Play, XCircle } from 'lucide-react';
import { GlassCard } from '@/components/common/GlassCard';
import {
  MAX_SNAPSHOT_HISTORY,
  SNAPSHOT_INTERVAL,
  useEcosystemStore,
} from '@/store/useEcosystemStore';

function formatSimulationTime(time: number): string {
  const totalSeconds = Math.floor(time / 100);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TimelinePlayback() {
  const snapshots = useEcosystemStore((s) => s.snapshots);
  const isPlayback = useEcosystemStore((s) => s.isPlayback);
  const playbackIndex = useEcosystemStore((s) => s.playbackIndex);
  const enterPlayback = useEcosystemStore((s) => s.enterPlayback);
  const selectSnapshot = useEcosystemStore((s) => s.selectSnapshot);
  const exitPlayback = useEcosystemStore((s) => s.exitPlayback);

  const hasHistory = snapshots.length > 0;
  const currentIndex = isPlayback
    ? (playbackIndex ?? snapshots.length - 1)
    : snapshots.length - 1;
  const currentSnapshot = snapshots[currentIndex];
  const sliderIndex = hasHistory ? currentIndex : 0;
  const intervalSeconds = SNAPSHOT_INTERVAL / 100;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(560px,calc(100vw-2rem))]">
      <GlassCard className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={enterPlayback}
            disabled={!hasHistory || isPlayback}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              isPlayback
                ? 'bg-amber-500/20 text-amber-300 cursor-default'
                : hasHistory
                  ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
            }`}
            title={hasHistory ? '暂停并回放历史快照' : '等待第一个历史快照'}
          >
            <History size={16} />
            {isPlayback ? '回放中' : '时间轴'}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-white font-mono text-sm">
                {currentSnapshot ? formatSimulationTime(currentSnapshot.simulationTime) : '--:--'}
              </span>
              <span className="text-white/50 text-xs">
                {hasHistory ? `${currentIndex + 1} / ${snapshots.length}` : '暂无历史'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, snapshots.length - 1)}
              step={1}
              value={sliderIndex}
              disabled={!isPlayback || snapshots.length <= 1}
              onChange={(event) => selectSnapshot(Number(event.target.value))}
              className="w-full accent-cyan-400 disabled:cursor-not-allowed"
              aria-label="历史快照时间轴"
            />
          </div>

          {isPlayback && (
            <button
              type="button"
              onClick={exitPlayback}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-sm font-medium shrink-0"
              title="从当前时刻继续运行"
            >
              <Play size={16} />
              继续
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mt-1 text-[11px] text-white/45">
          <span>
            {isPlayback
              ? '模拟已暂停：场景、统计与选中信息均为历史状态'
              : `每 ${intervalSeconds} 秒保存一次快照`}
          </span>
          {isPlayback && (
            <button
              type="button"
              onClick={exitPlayback}
              className="flex items-center gap-1 hover:text-white transition-colors shrink-0 ml-3"
            >
              <XCircle size={12} />
              退出并继续
            </button>
          )}
        </div>

        {!hasHistory && (
          <div className="mt-1 text-[11px] text-white/35">
            模拟运行后会自动生成历史；最多保留 {MAX_SNAPSHOT_HISTORY} 个快照。
          </div>
        )}
      </GlassCard>
    </div>
  );
}
