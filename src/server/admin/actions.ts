import * as automation from './automation'
import * as content from './content'
import * as listings from './listings'
import * as system from './system'
import * as users from './users'
import type { Admin } from './util'

// Every admin operation, keyed by action name. Only reachable through adminApi (./api.ts), which
// verifies the admin before dispatching — there is no other entry point to these functions.
export const ACTIONS = {
  session: system.session,
  stats: system.stats,
  'users.list': users.listUsers,
  'users.get': users.getUser,
  'users.block': users.setBlocked,
  'listings.list': listings.listListings,
  'listings.moderate': listings.moderate,
  'listings.update': listings.updateListing,
  'listings.delete': listings.deleteListing,
  'reports.list': listings.listReports,
  'reports.resolve': listings.resolveReport,
  'config.get': content.getConfig,
  'config.save': content.saveConfig,
  'assets.upload': content.uploadAsset,
  'docs.list': content.listDocs,
  'docs.save': content.saveDoc,
  'docs.delete': content.deleteDoc,
  'broadcasts.list': content.listBroadcasts,
  'broadcasts.preview': content.previewBroadcast,
  'broadcasts.test': content.testBroadcast,
  'broadcasts.create': content.createBroadcast,
  'broadcasts.send': content.sendBroadcastBatch,
  'broadcasts.stop': content.stopBroadcast,
  'log.list': system.listLog,
  'webhook.get': system.getWebhook,
  'webhook.setup': system.resetWebhook,
  'automation.get': automation.overview,
  'automation.save': automation.saveAutomation,
  'automation.run': automation.runNow,
  'automation.job': automation.jobControl,
  'automation.jobs': automation.listJobs,
  'automation.result': automation.jobResult,
  'automation.events': automation.listEvents,
  'automation.testNotify': automation.testNotification,
  'automation.daily': automation.previewDaily,
  'support.list': automation.listTickets,
  'support.get': automation.getTicket,
  'support.reply': automation.replyTicket,
  'support.close': automation.closeTicketAction,
} satisfies Record<string, (admin: Admin, payload: unknown) => Promise<unknown>>

export type AdminActions = typeof ACTIONS
export type AdminAction = keyof AdminActions
export type AdminResult<A extends AdminAction> = Awaited<ReturnType<AdminActions[A]>>
