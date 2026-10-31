import { and, asc, eq, gt, gte, ne, or, sql } from 'drizzle-orm'
import { db } from '../../../../db/index.js'
import { ads, places, reports } from '../../../../db/schema.js'
import { AUTO_REASON_PREFIX, AUTO_REPORTER } from '../../../lib/automation'
import { getCursor, moduleOn, recordError, setCursor } from '../store'
import { DAY, list, num, timeLeft, type Runner } from './types'

// "Перевірка оголошень": rule-based checks of ads and catalog cards. A finding becomes an open
// report from AUTO_REPORTER, so it lands in the existing moderation queue. Never deletes or blocks.

type Kind = 'ad' | 'place'
type Settings = Record<string, boolean | number | string | string[]>
interface Item {
  kind: Kind
  id: string
  userId: string
  title: string
  description: string
  contacts: string[]
  texts: string[]
  createdAt: Date
  updatedAt: Date
}

const fromAd = (a: typeof ads.$inferSelect): Item => ({
  kind: 'ad',
  id: a.id,
  userId: a.telegramUserId,
  title: a.title,
  description: a.description,
  contacts: [a.phone, a.tgContact],
  texts: [a.title, a.description, a.tgContact],
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
})

const fromPlace = (p: typeof places.$inferSelect): Item => ({
  kind: 'place',
  id: p.id,
  userId: p.telegramUserId,
  title: p.title,
  description: p.description,
  contacts: [p.phone, p.tgContact, p.instagram],
  texts: [p.title, p.description, p.hours, p.price, p.mapUrl, p.instagram, p.tgContact],
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
})

const DOMAIN_RE = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?=[\/\s:?#)\],;!]|$)/gi

export function domainsIn(text: string) {
  const out = new Set<string>()
  for (const m of text.matchAll(DOMAIN_RE)) out.add(m[1].toLowerCase().replace(/^www\./, ''))
  return [...out]
}

const allowed = (domain: string, allow: string[]) => allow.some((d) => domain === d || domain.endsWith(`.${d}`))

async function duplicateOf(it: Item, days: number) {
  const since = new Date(Date.now() - days * DAY)
  const t = it.kind === 'ad' ? ads : places
  const sameText = or(
    sql`lower(${t.title}) = ${it.title.trim().toLowerCase()}`,
    it.description.trim().length >= 30 ? sql`lower(${t.description}) = ${it.description.trim().toLowerCase()}` : undefined,
  )
  const [row] = await db
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.status, 'active'), ne(t.id, it.id), gte(t.createdAt, since), sameText))
    .limit(1)
  return row?.id ?? null
}

// Returns the rule violations of one item (empty = looks fine).
export async function checkItem(it: Item, s: Settings) {
  const issues: string[] = []
  if (s.checkRequired) {
    if (it.title.trim().length < num(s.minTitle, 5)) issues.push(`закоротка назва (< ${num(s.minTitle, 5)} символів)`)
    if (it.description.trim().length < num(s.minDescription, 20)) issues.push(`закороткий опис (< ${num(s.minDescription, 20)} символів)`)
    if (s.requireContact && !it.contacts.some((c) => c.trim())) issues.push('немає контакту')
  }
  const text = `${it.title}\n${it.description}`
  if (s.checkText) {
    const lower = text.toLowerCase()
    const hits = list(s.stopWords).filter((w) => w && lower.includes(w))
    if (hits.length) issues.push(`стоп-слова: ${hits.slice(0, 5).join(', ')}`)
    const caps = num(s.capsPercent, 0)
    const letters = text.match(/\p{L}/gu) ?? []
    if (caps > 0 && letters.length >= 20) {
      const upper = letters.filter((c) => c !== c.toLowerCase() && c === c.toUpperCase()).length
      const pct = Math.round((upper / letters.length) * 100)
      if (pct >= caps) issues.push(`забагато великих літер (${pct}%)`)
    }
  }
  if (s.checkLinks) {
    const allow = list(s.allowDomains)
    if (allow.length) {
      const bad = domainsIn(it.texts.join('\n')).filter((d) => !allowed(d, allow))
      if (bad.length) issues.push(`посилання на сторонні домени: ${bad.slice(0, 5).join(', ')}`)
    }
  }
  if (s.checkDuplicates) {
    const dup = await duplicateOf(it, num(s.duplicateDays, 7))
    if (dup) issues.push(`повтор іншої публікації (${dup.slice(0, 8)})`)
  }
  return issues
}

// Files (or refreshes) the automatic report. A dismissed report is only reopened if the findings changed.
async function flag(it: Item, issues: string[]) {
  const reason = `${AUTO_REASON_PREFIX}${issues.join('; ')}`.slice(0, 500)
  const rows = await db
    .insert(reports)
    .values({ telegramUserId: AUTO_REPORTER, targetKind: it.kind, targetId: it.id, reason })
    .onConflictDoUpdate({
      target: [reports.telegramUserId, reports.targetKind, reports.targetId],
      set: { reason, status: 'open', resolvedAt: null, createdAt: new Date() },
      setWhere: sql`${reports.reason} <> ${reason}`,
    })
    .returning({ id: reports.id })
  return rows.length > 0
}

const BATCH = 40

async function batch(kind: Kind, after: { at: Date; id: string } | null, from: Date | null) {
  const t = kind === 'ad' ? ads : places
  const where = and(
    eq(t.status, 'active'),
    from ? gt(t.updatedAt, from) : undefined,
    after ? or(gt(t.updatedAt, after.at), and(eq(t.updatedAt, after.at), gt(t.id, after.id))) : undefined,
  )
  if (kind === 'ad') return (await db.select().from(ads).where(where).orderBy(asc(ads.updatedAt), asc(ads.id)).limit(BATCH)).map(fromAd)
  return (await db.select().from(places).where(where).orderBy(asc(places.updatedAt), asc(places.id)).limit(BATCH)).map(fromPlace)
}

// Scheduled runs check what changed since the previous run; a manual run re-checks everything active.
export const adcheck: Runner = async (ctx) => {
  const st = ctx.state as { started?: string; from?: string | null; kind?: Kind; at?: string; id?: string; checked?: number; flagged?: number }
  if (!st.started) {
    st.started = new Date().toISOString()
    st.from = ctx.job.trigger === 'manual' ? null : ((await getCursor('adcheck'))?.toISOString() ?? null)
    st.kind = 'ad'
    st.checked = 0
    st.flagged = 0
  }
  while (st.kind) {
    if (!timeLeft(ctx)) return { done: false, state: st, progressText: `Перевірено ${st.checked}` }
    const rows = await batch(st.kind, st.at && st.id ? { at: new Date(st.at), id: st.id } : null, st.from ? new Date(st.from) : null)
    for (const it of rows) {
      const issues = await checkItem(it, ctx.settings)
      if (issues.length && (await flag(it, issues))) st.flagged!++
      st.checked!++
      st.at = it.updatedAt.toISOString()
      st.id = it.id
    }
    if (rows.length < BATCH) {
      st.kind = st.kind === 'ad' ? 'place' : undefined
      st.at = undefined
      st.id = undefined
    }
    await ctx.heartbeat(st.kind === 'place' ? 50 : st.kind ? 10 : 95, `Перевірено ${st.checked}`)
  }
  await setCursor('adcheck', new Date(st.started))
  return {
    done: true,
    summary: `Перевірено ${st.checked}, у чергу модерації додано ${st.flagged}`,
    result: { checked: st.checked, flagged: st.flagged, full: !st.from },
  }
}

// Immediate check right after a user publishes or edits (when "Перевіряти нові публікації одразу"
// is on). Never throws: a failed check must not affect the publication itself.
export async function checkNow(kind: Kind, id: string) {
  try {
    const mod = await moduleOn('adcheck')
    if (!mod || !mod.settings.checkNew) return
    const it =
      kind === 'ad'
        ? (await db.select().from(ads).where(eq(ads.id, id)).then((r) => r.map(fromAd)))[0]
        : (await db.select().from(places).where(eq(places.id, id)).then((r) => r.map(fromPlace)))[0]
    if (!it) return
    const issues = await checkItem(it, mod.settings)
    if (issues.length) await flag(it, issues)
  } catch (e) {
    console.error('Instant ad check error:', e)
    await recordError('adcheck.instant', e)
  }
}
