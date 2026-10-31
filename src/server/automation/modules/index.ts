import type { ModuleId } from '../../../lib/automation'
import { adcheck } from './adcheck'
import { broadcastsRunner } from './broadcasts'
import { jobsMonitor, securityMonitor, serverMonitor, usersMonitor, webhookMonitor } from './monitoring'
import { analytics, dailyReport, notify } from './reporting'
import type { Runner } from './types'

// The job runner of every schedulable module. "support" works per message, not as a job.
export const RUNNERS: Partial<Record<ModuleId, Runner>> = {
  adcheck,
  users: usersMonitor,
  security: securityMonitor,
  notify,
  reports: dailyReport,
  broadcasts: broadcastsRunner,
  server: serverMonitor,
  webhook: webhookMonitor,
  jobs: jobsMonitor,
  analytics,
}
