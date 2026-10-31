import type { automationJobs } from '../../../../db/schema.js'
import type { AutomationConfig } from '../../../lib/automation'
import type { Level } from '../store'

// What a module runner gets for one step of its job.
export interface RunCtx {
  job: typeof automationJobs.$inferSelect
  config: AutomationConfig
  settings: Record<string, boolean | number | string | string[]>
  // Checkpoint saved by the previous step of this job ({} on the first step).
  state: Record<string, unknown>
  // Wall-clock time (ms) by which the step must return.
  deadline: number
  event: (level: Level, kind: string, message: string, details?: Record<string, unknown>) => Promise<void>
  heartbeat: (progress?: number, progressText?: string) => Promise<void>
}

export type StepResult =
  | { done: true; summary: string; result?: unknown }
  | { done: false; state: Record<string, unknown>; progress?: number; progressText?: string }

export type Runner = (ctx: RunCtx) => Promise<StepResult>

export const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
export const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : [])
export const HOUR = 3600_000
export const DAY = 24 * HOUR
// Leave this much time before the deadline to save the checkpoint.
export const timeLeft = (ctx: RunCtx) => ctx.deadline - Date.now() > 4000
