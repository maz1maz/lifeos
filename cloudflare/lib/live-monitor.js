// Live-monitor provider boundary. The browser only calls LifeOS; this module
// fetches public RSS feeds on the Worker and keeps optional vendor credentials server-side.
const PUBLIC_FEEDS = [
  { category: 'جهان', source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'اقتصاد', source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { category: 'فناوری', source: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { category: 'انرژی', source: 'Google News', url: 'https://news.google.com/rss/search?q=energy+OR+oil+OR+gas&hl=en-US&gl=US&ceid=US:en' },
  { category: 'بلایا', source: 'Google News', url: 'https://news.google.com/rss/search?q=earthquake+OR+flood+OR+wildfire&hl=en-US&gl=US&ceid=US:en' },
];
// Bump this whenever the normalized public-feed shape changes, so a broken
// upstream response cannot remain visible for the old cache lifetime.
const CACHE_KEY = 'https://lifeos-cache.internal/live-monitor/public-v2';
const CACHE_MS = 5 * 60 * 1000;
const text = (value, max) => String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, max);
const safeUrl = value => /^https:\/\//i.test(String(value || '')) ? String(value) : '';
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i')); return m ? text(m[1], 1000) : ''; };
const isRawUrl = value => /^(?:https?:\/\/|www\.)/i.test(String(value || '').trim()) || /(?:news\.google\.com|feeds\.bbci\.co\.uk)\/rss\//i.test(String(value || ''));
const cleanTitle = value => { const result = text(value, 360); return result.length >= 4 && !isRawUrl(result) ? result : ''; };
const cleanSummary = value => { const result = text(value, 480); return result && !isRawUrl(result) ? result : ''; };

const mock = now => ({
  mode: 'sample', updatedAt: new Date(now).toISOString(),
  items: [{ id: 'sample-world', category: 'جهان', source: 'LifeOS', language: 'en', publishedAt: new Date(now).toISOString(), title: 'No live source is available right now', summary: 'نمونه: اتصال موقت به RSSهای عمومی ممکن نبود؛ با تازه‌سازی دوباره تلاش کن.', url: '' }],
  markets: [], alerts: [],
});

function normalize(payload, now) {
  const data = payload && typeof payload === 'object' ? payload : {};
  return {
    mode: 'live', updatedAt: data.updatedAt || new Date(now).toISOString(),
    items: (Array.isArray(data.items) ? data.items : []).slice(0, 60).map((item, i) => ({ id: text(item.id || `live-${i}`, 100), category: text(item.category || 'جهان', 30), source: text(item.source || 'منبع ناشناس', 80), language: text(item.language || 'und', 12), publishedAt: item.publishedAt || new Date(now).toISOString(), title: text(item.title, 360), summary: text(item.summary, 900), summaryFa: text(item.summaryFa, 900), url: safeUrl(item.url) })).filter(item => item.title),
    markets: (Array.isArray(data.markets) ? data.markets : []).slice(0, 12).map((item, i) => ({ key: text(item.key || `market-${i}`, 40), name: text(item.name, 60), value: text(item.value, 80), change24h: Number(item.change24h) || 0, unit: text(item.unit, 40) })).filter(item => item.name),
    alerts: (Array.isArray(data.alerts) ? data.alerts : []).slice(0, 8).map((item, i) => ({ id: text(item.id || `alert-${i}`, 100), severity: ['low', 'medium', 'high'].includes(item.severity) ? item.severity : 'medium', title: text(item.title, 240), detail: text(item.detail, 700), source: text(item.source || 'منبع ناشناس', 80), publishedAt: item.publishedAt || new Date(now).toISOString() })).filter(item => item.title),
  };
}

async function fetchRss(feed) {
  const response = await fetch(feed.url, { headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9' }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`${feed.source} HTTP ${response.status}`);
  const xml = await response.text();
  return (xml.match(/<item\b[\s\S]*?<\/item>/gi) || []).slice(0, 5).map((item, i) => {
    const source = tag(item, 'source') || feed.source, publishedAt = tag(item, 'pubDate') || tag(item, 'published') || new Date().toISOString();
    const title = cleanTitle(tag(item, 'title'));
    // Google News descriptions often contain attribution markup rather than a
    // useful article abstract. Keep the original headline and source link,
    // but do not turn that markup into a misleading Persian summary.
    const summary = feed.source === 'Google News' ? '' : cleanSummary(tag(item, 'description') || tag(item, 'content'));
    return { id: `${feed.category}-${i}-${tag(item, 'guid') || tag(item, 'link') || title}`, category: feed.category, source: text(source, 80), language: 'en', publishedAt: Number.isNaN(Date.parse(publishedAt)) ? new Date().toISOString() : new Date(publishedAt).toISOString(), title, summary, url: safeUrl(tag(item, 'link')) };
  }).filter(item => item.title);
}

async function translateSummaries(data, translateToFa) {
  if (!translateToFa || !data.items.length) return data;
  try {
    const candidates = data.items.map((item, index) => ({ index, summary: item.summary })).filter(item => item.summary && !isRawUrl(item.summary)).slice(0, 15);
    if (!candidates.length) return data;
    const translations = await translateToFa(candidates.map(item => item.summary));
    data.items = data.items.map((item, index) => {
      const translatedIndex = candidates.findIndex(candidate => candidate.index === index);
      return translatedIndex < 0 ? item : { ...item, summaryFa: cleanSummary(translations[translatedIndex]) };
    });
  } catch (error) { console.error(JSON.stringify({ message: 'live monitor summary translation failed', error: String(error) })); }
  return data;
}

async function publicRss(translateToFa) {
  const cache = typeof caches === 'undefined' ? null : caches.default;
  if (cache) try { const hit = await cache.match(CACHE_KEY); if (hit) { const cached = await hit.json(); if (cached.cachedAt && Date.now() - cached.cachedAt < CACHE_MS) return cached.data; } } catch (error) {}
  const results = await Promise.allSettled(PUBLIC_FEEDS.map(fetchRss));
  const items = results.filter(result => result.status === 'fulfilled').flatMap(result => result.value).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 20);
  if (!items.length) throw new Error('public RSS unavailable');
  const data = await translateSummaries({ mode: 'live', updatedAt: new Date().toISOString(), items, markets: [], alerts: [], sources: 'public-rss' }, translateToFa);
  if (cache) try { await cache.put(CACHE_KEY, new Response(JSON.stringify({ cachedAt: Date.now(), data }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' } })); } catch (error) {}
  return data;
}

export async function getLiveMonitor(env, translateToFa) {
  const now = Date.now(), endpoint = String(env.LIVE_MONITOR_PROVIDER_URL || '').trim();
  if (!endpoint) try { return await publicRss(translateToFa); } catch (error) { return { ...mock(now), providerError: 'دریافت RSSهای عمومی ناموفق بود؛ دادهٔ نمونه نمایش داده می‌شود.' }; }
  try {
    const headers = { Accept: 'application/json' }; if (env.LIVE_MONITOR_API_KEY) headers.Authorization = `Bearer ${env.LIVE_MONITOR_API_KEY}`;
    const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`provider HTTP ${response.status}`);
    const result = await translateSummaries(normalize(await response.json(), now), translateToFa);
    if (!result.items.length && !result.markets.length && !result.alerts.length) throw new Error('provider returned no usable data');
    return result;
  } catch (error) { try { return { ...(await publicRss(translateToFa)), providerError: 'provider اختصاصی در دسترس نبود؛ RSS عمومی نمایش داده می‌شود.' }; } catch { return { ...mock(now), providerError: 'دریافت دادهٔ زنده ناموفق بود؛ دادهٔ نمونه نمایش داده می‌شود.' }; } }
}
