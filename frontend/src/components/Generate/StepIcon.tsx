export default function StepIcon({ state }: { state: 'done' | 'active' | 'pending' }) {
  if (state === 'done') {
    return (
      <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
    );
  }
  if (state === 'active') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-accent flex items-center justify-center flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0" />
  );
}
