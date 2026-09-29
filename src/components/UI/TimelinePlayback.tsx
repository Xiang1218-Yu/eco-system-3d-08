import { useCallback, useEffect } from 'react';
import { History, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { GlassCard } from '@/components/common/GlassCard';
import { useEcosystemStore } from '@/store/useEcosystemStore';

function formatSimTime(t: number) {
  const mins = Math.floor(t / 100);
  const secs = t % 100;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatWallTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

export function TimelinePlayback() {
  const history = useEcosystemStore((s) => s.history);
  const isPlayback = useEcosystemStore((s) => s.isPlayback);
  const playbackIndex = useEcosystemStore((s) => s.playbackIndex);
  const enterPlayback = useEcosystemStore((s) => s.enterPlayback);
  const exitPlayback = useEcosystemStore((s) => s.exitPlayback);
  const seekPlayback = useEcosystemStore((s) => s.seekPlayback);

  const frameCount = history.length;
  const current = isPlayback && playbackIndex !== null ? history[playbackIndex] : null;

  const step = useCallback(
    (delta: number) => {
      if (playbackIndex === null) return;
      seekPlayback(playbackIndex + delta);
    },
    [playbackIndex, seekPlayback],
  );

  // 键盘：← / → 逐帧，Esc 退出回放
  useEffect(() => {
    if (!isPlayback) return;
    const handleKey = (e: KeyboardEvent) => {
      // 滑块自身已支持方向键步进，避免双重跳帧
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'Escape') {
        exitPlayback();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlayback, step, exitPlayback]);

  // —— 回放控制条 ——
  if (isPlayback && current && playbackIndex !== null) {
    return (
      <>
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm font-medium flex items-center gap-2">
            <Clock size={14} />
            回放模式 · 模拟已暂停（拖动滑块对比种群变化，Esc 退出）
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[34rem] max-w-[calc(100vw-2rem)]">
          <GlassCard className="px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={exitPlayback}
                className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors shrink-0"
                title="退出回放并从此刻继续运行"
              >
                <X size={18} />
              </button>

              <button
                onClick={() => step(-1)}
                disabled={playbackIndex <= 0}
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                title="上一帧（←）"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex-1 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={frameCount - 1}
                  step={1}
                  value={playbackIndex}
                  onChange={(e) => seekPlayback(Number(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full bg-white/15 accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between items-center mt-1.5 text-xs">
                  <span className="text-white/60 font-mono">
                    {formatSimTime(history[0]?.time ?? 0)}
                  </span>
                  <span className="text-white font-mono">
                    {formatSimTime(current.time)}
                    <span className="text-white/40 ml-2 font-sans">
                      {playbackIndex + 1} / {frameCount} 帧
                    </span>
                  </span>
                  <span className="text-white/60 font-mono">
                    {formatSimTime(history[frameCount - 1]?.time ?? 0)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => step(1)}
                disabled={playbackIndex >= frameCount - 1}
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                title="下一帧（→）"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="text-center text-white/40 text-[11px] mt-1">
              拍摄于 {formatWallTime(current.timestamp)}
            </div>
          </GlassCard>
        </div>
      </>
    );
  }

  // —— 入口按钮 ——
  const disabled = frameCount === 0;

  return (
    <div className="absolute bottom-4 right-4 z-30">
      <GlassCard
        className={`px-4 py-3 flex flex-col items-center gap-1 ${
          disabled ? 'opacity-40' : 'cursor-pointer'
        }`}
        onClick={disabled ? undefined : enterPlayback}
      >
        <History size={20} className={disabled ? 'text-white/50' : 'text-amber-300'} />
        <span className="text-white text-xs font-medium whitespace-nowrap">
          {disabled ? '暂无回放' : '时间轴回放'}
        </span>
        {!disabled && (
          <span className="text-white/40 text-[10px]">{frameCount} 个快照</span>
        )}
      </GlassCard>
    </div>
  );
}
