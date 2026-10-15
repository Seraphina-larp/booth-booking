/**
 * GET /api/scripts
 *
 * 從官網 https://seraheyo.com/scripts/ 抓取劇本清單，回傳乾淨的 JSON。
 *
 * 為什麼要有這支：瀏覽器直接 fetch 官網會被 CORS 擋掉（官網沒有開放跨網域讀取），
 * 所以改由 Vercel 這邊的伺服器去抓，前端再跟同網域的這支 API 要資料。
 *
 * 抓取策略有兩層，前面失敗就往後退：
 *   1. WordPress REST API（結構化資料，最準）
 *   2. 直接解析劇本總覽頁的 HTML（官網改版也還能用的保底做法）
 *
 * 回傳格式：
 *   { ok: true, source: 'rest'|'html', fetchedAt, count, scripts: [...] }
 *   { ok: false, error: '...' }
 */

const SITE = 'https://seraheyo.com';
const LIST_URL = `${SITE}/scripts/`;

/* 官網上的類型標籤，用來從卡片文字裡辨識分類 */
const KNOWN_CATEGORIES = [
  '價值觀交流', '情感沉浸', '推理還原', '歡樂社交', '藝術文學', '合作私團',
];

const UA = 'Mozilla/5.0 (compatible; BoothBookingSync/1.0; +https://booth-booking-nu.vercel.app)';

function fetchText(url, accept = 'text/html') {
  return fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    redirect: 'follow',
  });
}

/* ------------------------------ 文字處理工具 ------------------------------ */

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(text) {
  const named = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#039;': "'", '&apos;': "'", '&nbsp;': ' ', '&hellip;': '…',
    '&ndash;': '–', '&mdash;': '—', '&times;': '×',
  };
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&[a-z#0-9]+;/gi, (entity) => (named[entity] !== undefined ? named[entity] : ' '));
}

function clean(text) {
  return decodeEntities(stripTags(text)).replace(/\s+/g, ' ').trim();
}

/* ------------------------------ 欄位解析 ------------------------------ */

/* 卡片文字長這樣：
   「那一束月光3 情感沉浸 《那一束月光3》 6人 5-7小時 平日 NT$750/人 ｜ 假日 NT$900/人」
   「豪門驚情系列 合作私團 eli 私團—《豪門驚情系列》 5-10人 3-7小時」          */
function parseCardText(text, slug) {
  if (!text) return null;

  /* 書名號裡的才是正式名稱；沒有書名號就退而取類型標籤前面那段 */
  const titleMatch = text.match(/《([^》]+)》/);
  /* 有些本同時掛兩個標籤（例如「合作私團 情感沉浸」），以文字裡先出現的那個為準 */
  const category = KNOWN_CATEGORIES
    .map((c) => ({ c, at: text.indexOf(c) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.c)[0] || '';
  let title = titleMatch ? titleMatch[1].trim() : '';
  if (!title) {
    title = category ? text.split(category)[0].trim() : text.split(/\s+/)[0];
  }
  if (!title) return null;

  /* 人數：6人 / 6~9人 / 5-10人 / 不限人數 */
  const playersMatch = text.match(/((?:\d+\s*[-~～至]\s*\d+|\d+)\s*人)(?!\s*\/)|(不限人數)/);
  const players = playersMatch ? (playersMatch[1] || playersMatch[2]).replace(/\s+/g, '') : '';

  /* 時長：5-7小時 / 6~8小時 / 5.5-6小時 / 8小時 / 5小時~7小時（官網兩種寫法都有） */
  const durationMatch = text.match(
    /(\d+(?:\.\d+)?\s*小時\s*[-~～至]\s*\d+(?:\.\d+)?\s*小時|(?:\d+(?:\.\d+)?\s*[-~～至]\s*)?\d+(?:\.\d+)?\s*小時)/,
  );
  const duration = durationMatch ? durationMatch[1].replace(/\s+/g, '') : '';

  /* 價格：平日/假日分開標，或只有一個數字（平假同價） */
  const weekdayMatch = text.match(/平日[^\d]{0,6}(\d[\d,]*)/);
  const holidayMatch = text.match(/假日[^\d]{0,6}(\d[\d,]*)/);
  const toNumber = (raw) => (raw ? Number(String(raw).replace(/,/g, '')) : '');

  let priceWeekday = toNumber(weekdayMatch && weekdayMatch[1]);
  let priceHoliday = toNumber(holidayMatch && holidayMatch[1]);

  if (priceWeekday === '' && priceHoliday === '') {
    /* 只寫一個價錢的情況，例如「NT$1000/人」或「優惠價 NT$700/人」 */
    const singleMatch = text.match(/NT\$\s*(\d[\d,]*)/);
    if (singleMatch) {
      priceWeekday = toNumber(singleMatch[1]);
      priceHoliday = priceWeekday;
    }
  }

  /* 合作私團會在書名號前面寫「eli 私團—」「阿齊私團—」 */
  let partner = '';
  if (category === '合作私團' || /私團/.test(text)) {
    /* 只取緊貼在「私團—《」前面那個名字，避免把前面的類型標籤一起吃進來。
       官網寫法有「阿齊私團—《…》」也有「eli 私團—《…》」，所以中間允許空白。 */
    const partnerMatch = text.match(/(\S{1,8})\s*私團\s*[—–-]\s*《/);
    if (partnerMatch) partner = `${partnerMatch[1].trim()} 私團`.replace(/\s+私團$/, '私團');
  }

  return {
    id: slug,
    title,
    category,
    players,
    duration,
    priceWeekday,
    priceHoliday,
    partner,
    url: `${SITE}/scripts/${slug}/`,
    active: true,
  };
}

/* ------------------------------ 來源一：WordPress REST ------------------------------ */

async function fetchViaRest() {
  /* 先問 WordPress 有哪些自訂文章類型，找出劇本對應的 rest_base */
  const typesResponse = await fetchText(`${SITE}/wp-json/wp/v2/types`, 'application/json');
  if (!typesResponse.ok) throw new Error(`types ${typesResponse.status}`);
  const types = await typesResponse.json();

  const candidates = Object.values(types || {})
    .map((type) => type && type.rest_base)
    .filter(Boolean)
    .filter((base) => /script|larp|劇本/i.test(base));
  /* 常見命名先試，再試探測到的 */
  const bases = Array.from(new Set(['scripts', ...candidates]));

  for (const base of bases) {
    const response = await fetchText(`${SITE}/wp-json/wp/v2/${base}?per_page=100`, 'application/json');
    if (!response.ok) continue;
    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) continue;

    const scripts = items.map((item) => {
      const slug = item.slug || String(item.id);
      const title = clean((item.title && item.title.rendered) || '');
      const blob = clean([
        (item.excerpt && item.excerpt.rendered) || '',
        (item.content && item.content.rendered) || '',
      ].join(' ')).slice(0, 1200);
      const parsed = parseCardText(`${title} ${blob}`, slug) || {};
      return { ...parsed, id: slug, title: title || parsed.title || '' };
    }).filter((s) => s.title);

    if (scripts.length) return { source: 'rest', scripts };
  }
  throw new Error('REST 找不到劇本資料');
}

/* ------------------------------ 來源二：解析總覽頁 HTML ------------------------------ */

async function fetchViaHtml() {
  const response = await fetchText(LIST_URL);
  if (!response.ok) throw new Error(`劇本總覽頁回應 ${response.status}`);
  const html = await response.text();

  /* 每張卡片都是一個連到 /scripts/<slug>/ 的連結，內容物就是卡片文字 */
  const anchorPattern = /<a\b[^>]*href="(?:https?:\/\/seraheyo\.com)?\/scripts\/([^"/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
  const bySlug = new Map();

  let match = anchorPattern.exec(html);
  while (match !== null) {
    const slug = decodeURIComponent(match[1]);
    const text = clean(match[2]);
    /* 同一個 slug 可能出現好幾次（圖片連結、標題連結），取文字最完整的那次 */
    const previous = bySlug.get(slug);
    if (!previous || text.length > previous.length) bySlug.set(slug, text);
    match = anchorPattern.exec(html);
  }

  const scripts = [];
  for (const [slug, text] of bySlug) {
    const parsed = parseCardText(text, slug);
    if (parsed && parsed.title) scripts.push(parsed);
  }

  if (scripts.length === 0) throw new Error('解析不到任何劇本，官網版型可能改了');
  return { source: 'html', scripts };
}

/* ------------------------------ Handler ------------------------------ */

export default async function handler(req, res) {
  /* 讓瀏覽器可以快取 10 分鐘，避免每次按同步都真的去打官網 */
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  const errors = [];
  for (const attempt of [fetchViaRest, fetchViaHtml]) {
    try {
      const { source, scripts } = await attempt();
      scripts.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
      res.status(200).json({
        ok: true,
        source,
        fetchedAt: new Date().toISOString(),
        count: scripts.length,
        scripts,
      });
      return;
    } catch (error) {
      errors.push(`${attempt.name}: ${error.message}`);
    }
  }

  res.status(502).json({
    ok: false,
    error: '抓不到官網劇本資料',
    detail: errors.join(' ｜ '),
  });
}
