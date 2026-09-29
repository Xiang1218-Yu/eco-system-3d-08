import { GlassCard } from '@/components/common/GlassCard';
import { useEcosystemStore } from '@/store/useEcosystemStore';
import { Play, Pause, RotateCcw, Eye, EyeOff, Sparkles } from 'lucide-react';

export function ControlButtons() {
  const isRunning = useEcosystemStore((s) => s.isRunning);
  const toggleSimulation = useEcosystemStore((s) => s.toggleSimulation);
  const resetEcosystem = useEcosystemStore((s) => s.resetEcosystem);
  const showLabels = useEcosystemStore((s) => s.showLabels);
  const toggleLabels = useEcosystemStore((s) => s.toggleLabels);
  const selectedSpeciesId = useEcosystemStore((s) => s.selectedSpeciesId);
  const isPlayback = useEcosystemStore((s) => s.isPlayback);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
      <GlassCard className="px-4 py-2 flex items-center gap-2">
        <div className="flex items-center gap-2 pr-3 border-r border-white/20">
          <Sparkles size={18} className="text-cyan-400" />
          <span className="text-white font-bold text-lg tracking-wide">
            3D 虚拟生态缸
          </span>
        </div>

        {isPlayback && (
          <div className="px-3 py-1 rounded-full bg-amber-500/30 text-amber-200 text-sm font-medium">
            ⏱ 时间轴回放中
          </div>
        )}

        {selectedSpeciesId && !isPlayback && (
          <div className="px-3 py-1 rounded-full bg-cyan-500/30 text-cyan-300 text-sm animate-pulse">
            👆 点击缸内任意位置放置物种
          </div>
        )}

        <div
          className={`flex items-center gap-1 pl-2 border-l border-white/20 ${
            isPlayback ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <button
            onClick={toggleSimulation}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title={isRunning ? '暂停模拟' : '开始模拟'}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={toggleLabels}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title={showLabels ? '隐藏标签' : '显示标签'}
          >
            {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>

          <button
            onClick={resetEcosystem}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
            title="重置生态缸"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
