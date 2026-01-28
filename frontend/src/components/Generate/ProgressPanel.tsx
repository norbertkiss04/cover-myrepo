import { motion } from 'framer-motion';
import type { useGeneration } from '../../context/GenerationContext';

function OrbitingDots() {
  const dots = [0, 1, 2, 3, 4, 5];
  const radius = 40;

  return (
    <div className="relative w-32 h-32">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-4 h-4 rounded-full bg-accent"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {dots.map((index) => {
        const angle = (index / dots.length) * 360;
        return (
          <motion.div
            key={index}
            className="absolute w-2.5 h-2.5 rounded-full bg-accent"
            style={{
              left: '50%',
              top: '50%',
              marginLeft: -5,
              marginTop: -5,
            }}
            animate={{
              x: [
                Math.cos((angle * Math.PI) / 180) * radius,
                Math.cos(((angle + 360) * Math.PI) / 180) * radius,
              ],
              y: [
                Math.sin((angle * Math.PI) / 180) * radius,
                Math.sin(((angle + 360) * Math.PI) / 180) * radius,
              ],
              scale: [0.8, 1, 0.8],
              opacity: [0.4, 0.9, 0.4],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
              delay: index * 0.15,
            }}
          />
        );
      })}
    </div>
  );
}

export default function ProgressPanel({ generation }: { generation: ReturnType<typeof useGeneration> }) {
  const { cancelGeneration } = generation;

  return (
    <div className="w-full rounded-2xl border border-border bg-surface flex flex-col p-6 min-h-[320px]">
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <OrbitingDots />

        <motion.p
          className="text-sm text-text-secondary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Creating your cover...
        </motion.p>
      </div>

      <div className="pt-4 flex flex-col items-center gap-2">
        <p className="text-xs text-text-muted">You can navigate away while generating.</p>
        <button
          type="button"
          onClick={cancelGeneration}
          className="text-xs text-error hover:text-error/80 font-medium transition-colors"
        >
          Cancel generation
        </button>
      </div>
    </div>
  );
}
