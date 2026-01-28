export default function PlaceholderPanel() {
  return (
    <div className="w-full rounded-2xl border border-dashed border-border bg-surface-alt/50 flex flex-col items-center justify-center p-8 min-h-[320px] text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-accent/50" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      </div>
      <p className="text-sm text-text-muted mb-0.5">Your cover will appear here</p>
      <p className="text-xs text-text-muted/70">Fill in the form and hit generate</p>
    </div>
  );
}
