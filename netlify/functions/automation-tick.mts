import type { Config } from '@netlify/functions'
import { tick } from '../../src/server/automation/engine'
import { recordError } from '../../src/server/automation/store'

// Automation scheduler: wakes up every 5 minutes, recovers stuck jobs, queues the modules whose
// schedule slot has come and works through the queue within the 30-second limit.
// Netlify runs scheduled functions on the published (production) deploy only.
export default async () => {
  try {
    const r = await tick(22_000)
    if (r.queued.length || r.ran.length || r.recovered) console.log('Automation tick:', JSON.stringify(r))
  } catch (e) {
    console.error('Automation tick error:', e)
    await recordError('automation.tick', e)
  }
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
