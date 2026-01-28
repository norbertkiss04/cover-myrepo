interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-16">
      <p className="text-error">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 text-accent hover:text-accent-hover font-medium transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
