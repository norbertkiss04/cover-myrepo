import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import type { GenerationInput, Generation, GenerationStatus } from '../types';

const FAKE_STEPS = [
  { at: 0, message: 'Analyzing your description...' },
  { at: 5, message: 'Crafting the visual concept...' },
  { at: 12, message: 'Composing the layout...' },
  { at: 22, message: 'Rendering the artwork...' },
  { at: 38, message: 'Refining details...' },
  { at: 50, message: 'Finalizing your cover...' },
];

const TOTAL_FAKE_DURATION = 60;
const MAX_FAKE_PERCENT = 95;

interface GenerationContextType {
  status: GenerationStatus;
  generationId: number | null;
  bookTitle: string | null;
  authorName: string | null;
  step: number;
  totalSteps: number;
  stepMessage: string;
  result: Generation | null;
  error: string | null;
  socketConnected: boolean;
  fakePercent: number;
  fakeMessage: string;
  startGeneration: (data: GenerationInput) => void;
  startRegeneration: (generationId: number) => void;
  reset: () => void;
}

const GenerationContext = createContext<GenerationContextType | undefined>(undefined);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, session, updateCredits } = useAuth();

  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [bookTitle, setBookTitle] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [stepMessage, setStepMessage] = useState('');
  const [result, setResult] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const [fakePercent, setFakePercent] = useState(0);
  const [fakeMessage, setFakeMessage] = useState(FAKE_STEPS[0].message);

  const socketSetup = useRef(false);
  const updateCreditsRef = useRef(updateCredits);
  updateCreditsRef.current = updateCredits;

  const fakeTimerRef = useRef<number>(0);
  const fakeStartRef = useRef<number>(0);
  const fakeFinishingRef = useRef(false);

  const startFakeProgress = useCallback(() => {
    cancelAnimationFrame(fakeTimerRef.current);
    fakeFinishingRef.current = false;
    fakeStartRef.current = Date.now();
    setFakePercent(0);
    setFakeMessage(FAKE_STEPS[0].message);

    const tick = () => {
      const elapsed = (Date.now() - fakeStartRef.current) / 1000;
      const t = Math.min(elapsed / TOTAL_FAKE_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setFakePercent(Math.round(eased * MAX_FAKE_PERCENT));

      for (let i = FAKE_STEPS.length - 1; i >= 0; i--) {
        if (elapsed >= FAKE_STEPS[i].at) {
          setFakeMessage(FAKE_STEPS[i].message);
          break;
        }
      }

      if (t < 1 && !fakeFinishingRef.current) {
        fakeTimerRef.current = requestAnimationFrame(tick);
      }
    };

    fakeTimerRef.current = requestAnimationFrame(tick);
  }, []);

  const finishFakeProgress = useCallback(() => {
    if (fakeFinishingRef.current) return;
    fakeFinishingRef.current = true;
    cancelAnimationFrame(fakeTimerRef.current);

    setFakeMessage('Complete!');

    const startPercent = fakePercent;
    const startTime = Date.now();
    const duration = 500;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setFakePercent(Math.round(startPercent + (100 - startPercent) * eased));
      if (t < 1) {
        fakeTimerRef.current = requestAnimationFrame(animate);
      }
    };

    fakeTimerRef.current = requestAnimationFrame(animate);
  }, [fakePercent]);

  const stopFakeProgress = useCallback(() => {
    cancelAnimationFrame(fakeTimerRef.current);
    fakeFinishingRef.current = false;
    setFakePercent(0);
    setFakeMessage(FAKE_STEPS[0].message);
  }, []);

  const finishRef = useRef(finishFakeProgress);
  finishRef.current = finishFakeProgress;

  useEffect(() => {
    if (!isAuthenticated || !session) {
      if (socketSetup.current) {
        disconnectSocket();
        socketSetup.current = false;
        setSocketConnected(false);
      }
      return;
    }

    if (socketSetup.current) return;
    socketSetup.current = true;

    let socket;
    try {
      socket = connectSocket();
    } catch {
      socketSetup.current = false;
      return;
    }

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('active_generation', (data: { generation_id: number; book_title: string; author_name: string; step?: number; total_steps?: number; step_message?: string }) => {
      setStatus((prev) => {
        if (prev === 'generating') return prev;
        setGenerationId(data.generation_id);
        setBookTitle(data.book_title);
        setAuthorName(data.author_name);
        setStep(data.step ?? 0);
        setTotalSteps(data.total_steps ?? 0);
        setStepMessage(data.step_message || 'Resuming generation...');
        setResult(null);
        setError(null);
        return 'generating';
      });
    });

    socket.on('generation_started', (data: { generation_id: number; book_title: string; author_name: string; remaining_credits?: number }) => {
      setStatus('generating');
      setGenerationId(data.generation_id);
      setBookTitle(data.book_title);
      setAuthorName(data.author_name);
      setStep(0);
      setTotalSteps(0);
      setStepMessage('Starting...');
      setResult(null);
      setError(null);
      if (data.remaining_credits !== undefined) {
        updateCreditsRef.current(data.remaining_credits);
      }
    });

    socket.on('generation_progress', (data: { generation_id: number; step: number; total_steps: number; message: string }) => {
      setStep(data.step);
      setTotalSteps(data.total_steps);
      setStepMessage(data.message);
    });

    socket.on('generation_completed', (data: { generation_id: number; generation: Generation }) => {
      setStatus('completed');
      setResult(data.generation);
      setStep(0);
      setTotalSteps(0);
      setStepMessage('');
    });

    socket.on('generation_failed', (data: { generation_id: number; error: string; remaining_credits?: number }) => {
      setStatus('failed');
      setError(data.error);
      setStep(0);
      setTotalSteps(0);
      setStepMessage('');
      if (data.remaining_credits !== undefined) {
        updateCreditsRef.current(data.remaining_credits);
      }
    });

    socket.on('generation_error', (data: { error: string; generation_id?: number }) => {
      setError(data.error);
    });

    return () => {
      disconnectSocket();
      socketSetup.current = false;
      setSocketConnected(false);
    };
  }, [isAuthenticated, session]);

  useEffect(() => {
    if (status === 'generating' && !fakeFinishingRef.current && fakePercent === 0) {
      startFakeProgress();
    } else if (status === 'completed') {
      finishRef.current();
    } else if (status === 'failed' || status === 'idle') {
      stopFakeProgress();
    }
  }, [status, startFakeProgress, stopFakeProgress]);

  const startGeneration = useCallback((data: GenerationInput) => {
    const socket = getSocket();
    if (!socket?.connected) {
      setError('Not connected to server. Please refresh the page.');
      return;
    }
    setError(null);
    socket.emit('start_generation', data);
  }, []);

  const startRegeneration = useCallback((id: number) => {
    const socket = getSocket();
    if (!socket?.connected) {
      setError('Not connected to server. Please refresh the page.');
      return;
    }
    setError(null);
    socket.emit('start_regeneration', { generation_id: id });
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setGenerationId(null);
    setBookTitle(null);
    setAuthorName(null);
    setStep(0);
    setTotalSteps(0);
    setStepMessage('');
    setResult(null);
    setError(null);
    stopFakeProgress();
  }, [stopFakeProgress]);

  return (
    <GenerationContext.Provider
      value={{
        status,
        generationId,
        bookTitle,
        authorName,
        step,
        totalSteps,
        stepMessage,
        result,
        error,
        socketConnected,
        fakePercent,
        fakeMessage,
        startGeneration,
        startRegeneration,
        reset,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const context = useContext(GenerationContext);
  if (context === undefined) {
    throw new Error('useGeneration must be used within a GenerationProvider');
  }
  return context;
}
