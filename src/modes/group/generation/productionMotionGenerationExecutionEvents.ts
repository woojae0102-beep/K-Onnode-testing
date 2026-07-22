// @ts-nocheck
/**
 * Production Motion Generation Execution Events (PHASE 19).
 */
import type { ProductionMotionGenerationPipelineStage } from './productionMotionGenerationPipelineContract';
import type { ProductionMotionGenerationJobContext } from './productionMotionGenerationJobContext';

export const EXECUTION_EVENT_TYPES = [
  'PipelineStarted',
  'StageStarted',
  'StageCompleted',
  'StageFailed',
  'RetryScheduled',
  'Cancelled',
  'Completed',
] as const;

export type ExecutionEventType = typeof EXECUTION_EVENT_TYPES[number];

export type ExecutionEventBase = {
  type: ExecutionEventType;
  jobId: string;
  timestamp: string;
};

export type PipelineStartedEvent = ExecutionEventBase & {
  type: 'PipelineStarted';
  job: ProductionMotionGenerationJobContext;
};

export type StageStartedEvent = ExecutionEventBase & {
  type: 'StageStarted';
  stage: ProductionMotionGenerationPipelineStage;
};

export type StageCompletedEvent = ExecutionEventBase & {
  type: 'StageCompleted';
  stage: ProductionMotionGenerationPipelineStage;
  job: ProductionMotionGenerationJobContext;
};

export type StageFailedEvent = ExecutionEventBase & {
  type: 'StageFailed';
  stage: ProductionMotionGenerationPipelineStage;
  errorCode: string;
  message?: string;
  recoverable: boolean;
};

export type RetryScheduledEvent = ExecutionEventBase & {
  type: 'RetryScheduled';
  attempt: number;
  delayMs: number;
  reason: string;
  errorCode: string;
};

export type CancelledEvent = ExecutionEventBase & {
  type: 'Cancelled';
  job: ProductionMotionGenerationJobContext;
};

export type CompletedEvent = ExecutionEventBase & {
  type: 'Completed';
  job: ProductionMotionGenerationJobContext;
};

export type ProductionMotionExecutionEvent =
  | PipelineStartedEvent
  | StageStartedEvent
  | StageCompletedEvent
  | StageFailedEvent
  | RetryScheduledEvent
  | CancelledEvent
  | CompletedEvent;

export type ExecutionEventListener = (event: ProductionMotionExecutionEvent) => void;

export class ExecutionEventBus {
  private listeners: ExecutionEventListener[] = [];

  subscribe(listener: ExecutionEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: ProductionMotionExecutionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  clear(): void {
    this.listeners = [];
  }
}

export default ExecutionEventBus;
