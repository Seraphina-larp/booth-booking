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

/* ------------------------------ 品質把關 ------------------------------ */

/* 一個來源只有「真的解析出內容」才算數。
   WordPress REST 回得出 44 筆標題，但人數、時長、價格都在自訂欄位裡，
   excerpt/content 讀不到，結果每一本都只有名字。這種資料若直接採用，
   合併時會因為「空值不覆蓋既有資料」而完全靜默——看起來同步成功、
   實際上什麼都沒更新，官網改了價格也抓不到。 */
function detailStats(scripts) {
  const withPrice = scripts.filter(
    (s) => s.priceWeekday !== '' && s.priceWeekday !== undefined && s.priceWeekday !== null,
  ).length;
  const withAny = scripts.filter((s) => richness(s) > 0).length;
  return { total: scripts.length, withPrice, withAny };
}

function isUsable(scripts) {
  const { total, withPrice } = detailStats(scripts);
  return total > 0 && withPrice >= Math.max(3, Math.ceil(total * 0.3));
}

/* ------------------------------ 來源二：解析總覽頁 HTML ------------------------------ */

/* 以標題在整頁純文字裡的位置取一段窗格，給 ?debug 用。 */
function windowAround(pageText, title) {
  if (!title) return '';
  const marker = `《${title}》`;
  let at = pageText.indexOf(marker);
  let markerLength = marker.length;
  if (at < 0) {
    at = pageText.indexOf(title);
    markerLength = title.length;
  }
  if (at < 0) return '';

  const from = Math.max(0, at - 30);
  const slice = pageText.slice(from, at + markerLength + 220);
  const afterMarker = (at - from) + markerLength;
  const nextTitle = slice.indexOf('《', afterMarker);
  return nextTitle >= 0 ? slice.slice(0, nextTitle) : slice;
}

/* 一筆資料抓到幾個有用欄位，用來在多種解析結果中挑最完整的 */
function richness(parsed) {
  if (!parsed) return -1;
  return [
    parsed.category, parsed.players, parsed.duration,
    parsed.priceWeekday, parsed.priceHoliday,
  ].filter((v) => v !== '' && v !== undefined && v !== null).length;
}

async function fetchViaHtml() {
  const response = await fetchText(LIST_URL);
  if (!response.ok) throw new Error(`劇本總覽頁回應 ${response.status}`);
  const html = await response.text();
  const pageText = clean(html);

  /* 每張卡片都有連到 /scripts/<slug>/ 的連結。
     記下每個 slug 第一次出現的位置，用來切出這張卡片的範圍——
     價格常常放在 <a> 外面的兄弟元素，只讀連結內文會整個漏掉。 */
  const anchorPattern = /<a\b[^>]*href="(?:https?:\/\/seraheyo\.com)?\/scripts\/([^"/?#]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
  const bySlug = new Map();

  let match = anchorPattern.exec(html);
  while (match !== null) {
    const rawSlug = match[1];
    const text = clean(match[2]);
    const previous = bySlug.get(rawSlug);
    if (!previous) {
      bySlug.set(rawSlug, { rawSlug, text, at: match.index });
    } else {
      /* 同一個 slug 會出現好幾次（圖片連結、標題連結），取文字最完整的那次 */
      if (text.length > previous.text.length) previous.text = text;
      previous.at = Math.min(previous.at, match.index);
    }
    match = anchorPattern.exec(html);
  }

  /* 依出現順序，每張卡片的範圍就是「自己的連結」到「下一張卡片的連結」。
     不往前多抓——往前會讀進上一張卡片的書名號與價格，每一本都會拿到前一本的資料。 */
  const ordered = [...bySlug.values()].sort((a, b) => a.at - b.at);
  ordered.forEach((entry, index) => {
    const end = index + 1 < ordered.length ? ordered[index + 1].at : html.length;
    entry.cardText = clean(html.slice(entry.at, end));
  });

  const scripts = [];
  for (const entry of ordered) {
    /* 中文網址的 slug 解碼後就是書名，可以當最後的退路 */
    let decodedSlug = entry.rawSlug;
    try { decodedSlug = decodeURIComponent(entry.rawSlug); } catch { /* 解不開就用原字串 */ }

    /* 連結內文與整張卡片都解析一次，取資訊比較完整的那個 */
    const fromAnchor = parseCardText(entry.text, entry.rawSlug);
    const fromCard = parseCardText(entry.cardText, entry.rawSlug);
    const best = richness(fromCard) > richness(fromAnchor) ? fromCard : fromAnchor;
    if (!best) continue;

    /* 標題以連結內文裡的書名號最可靠——那一定是這張卡自己的。
       卡片範圍解析出來的次之，再不行才用連結文字或 slug。 */
    const titleInAnchor = (entry.text.match(/《([^》]+)》/) || [])[1];
    best.title = (titleInAnchor || best.title || entry.text || decodedSlug).trim();
    if (best.title) scripts.push(best);
  }

  if (scripts.length === 0) throw new Error('解析不到任何劇本，官網版型可能改了');
  return { source: 'html', scripts, pageText };
}

/* ------------------------------ Handler ------------------------------ */

export default async function handler(req, res) {
  /* 手動按「從官網同步」時一定要拿到最新資料，所以帶 ?fresh=1 就完全不快取。
     沒帶的時候才用短快取，避免頁面反覆載入時一直打官網。

     註：原本不分情況都設 s-maxage=600, stale-while-revalidate=3600，
     結果 CDN 會先回 10 分鐘內的舊快取、之後一小時內還會先回舊的再背景更新，
     官網改了價格按同步也抓不到新的。 */
  const params = new URL(req.url, 'http://localhost').searchParams;
  /* ?debug=<書名> 會回傳那一本的解析過程，官網改版時不用靠猜的 */
  const debugTitle = params.get('debug');
  const fresh = params.get('fresh') === '1' || !!debugTitle;
  res.setHeader(
    'Cache-Control',
    fresh ? 'no-store, max-age=0' : 's-maxage=600, stale-while-revalidate=3600',
  );

  const errors = [];
  const attempts = [];

  /* HTML 優先：總覽頁是人實際看到的畫面，價格在那裡。
     REST 只當後備，因為它讀不到自訂欄位裡的人數、時長與價格。 */
  for (const attempt of [fetchViaHtml, fetchViaRest]) {
    try {
      const result = await attempt();
      result.scripts.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
      attempts.push(result);
      if (isUsable(result.scripts)) break;
    } catch (error) {
      errors.push(`${attempt.name}: ${error.message}`);
    }
  }

  if (attempts.length === 0) {
    res.status(502).json({
      ok: false,
      error: '抓不到官網劇本資料',
      detail: errors.join(' ｜ '),
    });
    return;
  }

  /* 沒有任何來源達標時，退而求其次用資訊最完整的那一份，並據實標示 */
  const chosen = attempts.find((a) => isUsable(a.scripts))
    || attempts.reduce((best, a) => (
      detailStats(a.scripts).withPrice > detailStats(best.scripts).withPrice ? a : best
    ));
  const stats = detailStats(chosen.scripts);

  const body = {
    ok: true,
    source: chosen.source,
    fetchedAt: new Date().toISOString(),
    count: chosen.scripts.length,
    /* 讓前端能明講「有 N 本沒讀到價格」，而不是默默保留舊值 */
    withPrice: stats.withPrice,
    withAnyDetail: stats.withAny,
    partial: !isUsable(chosen.scripts),
    triedSources: attempts.map((a) => ({ source: a.source, ...detailStats(a.scripts) })),
    scripts: chosen.scripts,
  };

  if (debugTitle) {
    const pageText = attempts.find((a) => a.pageText)?.pageText || '';
    body.debug = {
      listUrl: LIST_URL,
      pageTextLength: pageText.length,
      window: windowAround(pageText, debugTitle) || '（在整頁文字裡找不到這個書名）',
      parsed: chosen.scripts.find((s) => s.title === debugTitle) || null,
      errors,
    };
  }

  res.status(200).json(body);
}
