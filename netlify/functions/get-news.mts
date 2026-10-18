import Parser from 'rss-parser'

// Aggregated news feed for the «Новини» screen: Ukrainian RSS feeds plus public
// Telegram channels (scraped from the t.me/s/<channel> web preview).
// Every source fails independently — a dead feed just contributes no items.

type Category = 'finance' | 'tech' | 'world' | 'telegram'

export interface NewsItem {
  id: string
  title: string
  description: string
  content: string
  link: string
  pubDate: string
  sourceName: string
  sourceIcon: string
  isTelegram: boolean
  category: Category
  imageUrl: string | null
}

const RSS_SOURCES: { url: string; name: string; site: string; category: Category }[] = [
  { url: 'https://epravda.com.ua/rss/', name: 'Економічна правда', site: 'epravda.com.ua', category: 'finance' },
  { url: 'https://itc.ua/ua/feed/', name: 'ITC.ua', site: 'itc.ua', category: 'tech' },
  { url: 'https://dou.ua/feed/', name: 'DOU', site: 'dou.ua', category: 'tech' },
  { url: 'https://feeds.bbci.co.uk/ukrainian/rss.xml', name: 'BBC News Україна', site: 'bbc.com', category: 'world' },
]

const TG_CHANNELS = ['epravda', 'itcua', 'suspilnenews', 'ukrpravda_news']

const PER_SOURCE = 15
const TIMEOUT = 8000
const UA = 'Mozilla/5.0 (compatible; UATMarketBot/1.0; +https://t.me)'

const favicon = (site: string) => `https://www.google.com/s2/favicons?domain=${site}&sz=64`

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
}

function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

// HTML → plain text, keeping paragraph breaks as blank lines.
function toText(html: string) {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|blockquote|figure)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function clip(s: string, max: number) {
  const flat = s.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`
}

function firstImg(html: string) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m ? decode(m[1]) : null
}

async function get(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.text()
}

type FeedExtra = { mediaContent?: { $?: { url?: string } }; mediaThumb?: { $?: { url?: string } }; contentEncoded?: string }

async function fromRss(src: (typeof RSS_SOURCES)[number]): Promise<NewsItem[]> {
  const parser = new Parser<object, FeedExtra>({
    customFields: {
      item: [
        ['media:content', 'mediaContent'],
        ['media:thumbnail', 'mediaThumb'],
        ['content:encoded', 'contentEncoded'],
      ],
    },
  })
  const feed = await parser.parseString(await get(src.url))
  return feed.items.slice(0, PER_SOURCE).flatMap((it): NewsItem[] => {
    const link = it.link?.trim()
    const date = new Date(it.isoDate ?? it.pubDate ?? '')
    if (!link || !it.title || Number.isNaN(date.getTime())) return []
    const html = it.contentEncoded || it.content || ''
    const content = toText(html) || toText(it.contentSnippet ?? '')
    const description = clip(toText(it.contentSnippet || it.summary || '') || content, 220)
    const imageUrl =
      it.enclosure?.url && (it.enclosure.type ?? 'image').startsWith('image')
        ? it.enclosure.url
        : (it.mediaContent?.$?.url ?? it.mediaThumb?.$?.url ?? firstImg(html))
    return [
      {
        id: `${src.site}:${it.guid ?? link}`,
        title: decode(it.title).trim(),
        description,
        content: content || description,
        link,
        pubDate: date.toISOString(),
        sourceName: src.name,
        sourceIcon: favicon(src.site),
        isTelegram: false,
        category: src.category,
        // BBC ships 240px thumbnails; the same CDN serves larger sizes.
        imageUrl: imageUrl ? imageUrl.replace('ichef.bbci.co.uk/ace/ws/240/', 'ichef.bbci.co.uk/ace/ws/640/') : null,
      },
    ]
  })
}

async function fromTelegram(channel: string): Promise<NewsItem[]> {
  const html = await get(`https://t.me/s/${channel}`)
  const icon =
    html.match(/tgme_page_photo_image[^>]*>\s*<img src="([^"]+)"/)?.[1] ?? favicon('telegram.org')

  return html
    .split('tgme_widget_message_wrap')
    .slice(1)
    .reverse() // page lists oldest first
    .slice(0, PER_SOURCE)
    .flatMap((block): NewsItem[] => {
      const post = block.match(/data-post="([^"]+)"/)?.[1]
      const datetime = block.match(/<time[^>]+datetime="([^"]+)"/)?.[1]
      const textHtml = block.match(
        /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="tgme_widget_message_(?:footer|link_preview|reactions)|<a class="tgme_widget_message_link_preview)/,
      )?.[1]
      if (!post || !datetime || !textHtml) return []
      // Emoji are rendered as <i><b>🔥</b></i>; the inner text is the emoji itself, so toText keeps it.
      const content = toText(textHtml)
      if (!content) return []
      const [firstLine, ...rest] = content.split('\n').filter((l) => l.trim())
      const image =
        block.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/)?.[1] ??
        block.match(/tgme_widget_message_video_thumb[^>]*background-image:url\('([^']+)'\)/)?.[1] ??
        block.match(/link_preview_image[^>]*background-image:url\('([^']+)'\)/)?.[1] ??
        null
      return [
        {
          id: `tg:${post}`,
          title: clip(firstLine, 140),
          description: clip(rest.join(' '), 220),
          content,
          link: `https://t.me/${post}`,
          pubDate: new Date(datetime).toISOString(),
          sourceName: `@${channel}`,
          sourceIcon: icon,
          isTelegram: true,
          category: 'telegram',
          imageUrl: image,
        },
      ]
    })
}

export default async () => {
  const results = await Promise.allSettled([
    ...RSS_SOURCES.map(fromRss),
    ...TG_CHANNELS.map(fromTelegram),
  ])
  for (const r of results) if (r.status === 'rejected') console.warn('news source failed:', String(r.reason))

  const seen = new Set<string>()
  const items = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((n) => !seen.has(n.id) && seen.add(n.id))
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate))

  const ok = items.length > 0
  return Response.json(
    { items, updatedAt: new Date().toISOString() },
    {
      status: ok ? 200 : 502,
      headers: {
        // Don't cache a fully failed fetch.
        'Cache-Control': ok ? 'public, max-age=600, s-maxage=900' : 'no-store',
        'Netlify-CDN-Cache-Control': ok ? 'public, s-maxage=900, stale-while-revalidate=300' : 'no-store',
      },
    },
  )
}
