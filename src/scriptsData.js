/* =============================================================================
 * 劇本資料庫（預設種子資料）
 * 來源：https://seraheyo.com/scripts/ ，2026-10 抓取，共 44 本
 * -----------------------------------------------------------------------------
 * 這份只是「第一次使用時的預設清單」。實際資料存在 Firestore：
 *   publicConfig/scripts      劇本目錄（公開讀取，給下拉選單用）
 *   privateConfig/app .scriptCosts   成本資料（只有管理者讀得到）
 *
 * 要新增或修改劇本，請直接在後台「劇本庫」分頁操作，不要改這個檔案。
 * =========================================================================== */

export const SCRIPT_CATEGORIES = [
  '情感沉浸', '推理還原', '歡樂社交', '價值觀交流', '藝術文學', '合作私團',
];

/* 欄位：代碼, 名稱, 類型, 人數, 時長, 平日價, 假日價, 合作方 */
const RAW_SCRIPTS = [
  ['moonlight3', '那一束月光3', '情感沉浸', '6人', '5-7小時', 750, 900, ''],
  ['moonlight1', '那一束月光1', '情感沉浸', '6人', '5-6小時', 700, 800, ''],
  ['wanderer', '流浪者', '藝術文學', '6人', '5-6小時', 700, 800, ''],
  ['second-rate', '二流貨色', '情感沉浸', '6人', '4-5小時', 650, 750, ''],
  ['the-regret', '二流貨色2：青花', '情感沉浸', '6人', '6小時', 900, 900, ''],
  ['52n', '北緯52度', '情感沉浸', '6人', '8-9小時', 2157, 2157, ''],
  ['monsoon-orange-sea', '季風吹過橘色的海', '情感沉浸', '6人', '8小時', 1100, 1300, ''],
  ['bitter-summer', '季風吹過橘色的海2：苦夏', '情感沉浸', '6人', '8小時', 1000, 1000, ''],
  ['river-where-she-is', '尋找她所在的河流', '推理還原', '7人', '5小時', 750, 900, ''],
  ['lost-in-the-sea', '溺於無明之海', '情感沉浸', '6人', '6-7小時', 1200, 1400, ''],
  ['poem-of-fiction', '虛構者的詩', '推理還原', '6人', '4-5小時', 700, 800, ''],
  ['makeup-artist', '化妝師', '情感沉浸', '6人', '6~8小時', 1100, 1300, ''],
  ['my-deity-friend', '我的神明朋友', '情感沉浸', '6人', '4~5小時', 700, 800, ''],
  ['hundred-love-poems', '百封情詩', '情感沉浸', '6人', '5小時', 600, 700, ''],
  ['sea-is-a-rain', '海是一場雨', '情感沉浸', '6人', '7小時', 1000, 1200, ''],
  ['decade-like-bouquet', '花束般的十年', '情感沉浸', '6人', '5-6小時', 700, 800, ''],
  ['lovestruck', '成為反派幹掉所有戀愛腦', '歡樂社交', '6~9人', '4小時', 600, 700, ''],
  ['three-views-out-of-control', '三觀失控', '推理還原', '6人', '4小時', 650, 750, ''],
  ['slacking-off', '摸魚', '歡樂社交', '7人', '4-5小時', 550, 600, ''],
  ['sky-comic-house', '天空漫畫屋', '情感沉浸', '6人', '4-5小時', 600, 700, ''],
  ['letters', '信．簡', '價值觀交流', '6人', '5-7小時', 700, 850, ''],
  ['most-romantic-thing', '最浪漫的事', '情感沉浸', '8人', '4小時', 650, 750, ''],
  ['last-snow-of-century', '世紀末的最後一場雪', '推理還原', '7人', '5小時', 600, 650, ''],
  ['whale-fall', '鯨落', '推理還原', '5人', '4小時', 600, 700, ''],
  ['nameless-town-1', '無名之町-上篇', '推理還原', '不限人數', '4-5小時', '', '', ''],
  ['nameless-town-2', '無名之町-下篇', '推理還原', '不限人數', '4-6小時', '', '', ''],
  ['little-orange-choir', '小橘合唱團', '情感沉浸', '6人', '4小時', 600, 650, ''],
  ['day-and-night', '日日夜夜', '推理還原', '6人', '6~7小時', 1000, 1000, ''],
  ['someone-3', '某某3：我與我周旋久', '價值觀交流', '6人', '6-7小時', 800, 850, ''],
  ['song-of-yesterday', '昨日歌', '情感沉浸', '6人', '4-5小時', 1000, 1000, ''],
  ['mirage-in-clouds', '雲中海蜃', '價值觀交流', '6人', '6-8小時', 1400, 1400, ''],
  ['heartbreak-chart', '失戀排行榜', '歡樂社交', '6人', '6小時', 850, 850, ''],
  ['cosmic-romance', '宇宙浪漫指南', '情感沉浸', '6人', '5小時', 700, 700, ''],
  ['desert-rose-moon', '沙丘，玫瑰，苦月亮', '情感沉浸', '6人', '5.5-6小時', '', '', ''],
  ['eraser', '橡皮', '情感沉浸', '6人', '4小時', 650, 750, ''],
  ['dundundun-adventure', '好帥的吨吨吨冒險', '歡樂社交', '6人', '4小時', 850, 850, ''],
  ['farewell-poem', '告別詩', '情感沉浸', '6人', '5小時', 800, 800, ''],
  ['superidol', '超人氣偶像劇', '情感沉浸', '6人', '5小時', 700, 800, ''],
  ['ghost', '糟糕，一不小心成了鬼', '歡樂社交', '6人', '4-5小時', 700, 800, ''],
  ['ferrydimmed-in-moonlight', '月迷津渡', '歡樂社交', '5人', '2-3小時', 500, 600, ''],
  ['larpstore', '我有一個劇本店', '歡樂社交', '6人', '5-7小時', 700, 800, ''],
  ['murdering-andersen', '謀殺安徒生', '歡樂社交', '6人', '5小時', 600, 700, ''],
  ['rich-family-thriller', '豪門驚情系列', '合作私團', '5-10人', '3-7小時', '', '', 'eli 私團'],
  ['the-echo-of-addiction', '戒斷反應', '合作私團', '6人', '6-7小時', 900, 1000, '阿齊私團'],
];

export const SCRIPTS_SEED = RAW_SCRIPTS.map(
  ([id, title, category, players, duration, priceWeekday, priceHoliday, partner]) => ({
    id,
    title,
    category,
    players,
    duration,
    priceWeekday,
    priceHoliday,
    partner,
    active: true,
  }),
);

export const EMPTY_SCRIPT_COST = {
  scriptCost: '',
  propCost: '',
  otherCost: '',
  purchasedAt: '',
  costNote: '',
};

export function normalizeTitle(s) {
  return String(s || '').replace(/[《》〈〉()（）\[\]【】\s\-－—~～、,，.。．・·!！?？:：;；+＋/／]/g, '').toLowerCase();
}

/* 用代碼或名稱找劇本。舊場次只存了名稱，而且常常是簡稱，
   所以除了正式名稱，也比對每本自己的別名清單（aliases）。 */
export function findScript(scripts, key) {
  if (!key) return null;
  const target = normalizeTitle(key);
  if (!target) return null;
  return (
    scripts.find((s) => s.id === key)
    || scripts.find((s) => s.title === key)
    || scripts.find((s) => normalizeTitle(s.title) === target)
    || scripts.find((s) => (s.aliases || []).some((a) => normalizeTitle(a) === target))
    || null
  );
}

/* 兩個字串的相似度（0~1），用相鄰雙字組比對。
   目的是幫「無名之町 上+下」這類簡稱猜出最可能的本，只是建議，不自動套用。 */
function bigrams(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  if (s.length === 1) set.add(s);
  return set;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  setA.forEach((gram) => { if (setB.has(gram)) shared += 1; });
  return (2 * shared) / (setA.size + setB.size);
}

/* short 的字元是否依序出現在 long 裡（例如「季風2」之於「季風吹過橘色的海2苦夏」）。
   簡稱多半是把原名挑幾個字留下來，所以這個比單純的包含更管用。 */
function isSubsequence(short, long) {
  if (short.length < 2 || short.length >= long.length) return false;
  let i = 0;
  for (let j = 0; j < long.length && i < short.length; j += 1) {
    if (long[j] === short[i]) i += 1;
  }
  return i === short.length;
}

/* 幫一個對不到的名稱猜最接近的劇本；信心太低就不給建議。
   這只是建議，一律要使用者確認後才會寫成別名。 */
export function suggestScript(scripts, name) {
  const target = normalizeTitle(name);
  if (!target) return null;
  let best = null;
  let bestScore = 0;
  scripts.forEach((script) => {
    const title = normalizeTitle(script.title);
    if (!title) return;
    const contains = title.includes(target) || target.includes(title);
    const subseq = isSubsequence(target, title);
    const score = Math.max(
      similarity(target, title),
      contains ? 0.72 : 0,
      subseq ? 0.55 : 0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = script;
    }
  });
  return bestScore >= 0.4 ? { script: best, score: bestScore } : null;
}

/* 判斷日期是否為假日（六、日）；用來決定要套平日價還是假日價 */
export function isHolidayDate(dateStr) {
  if (!dateStr) return false;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3 || !parts[0]) return false;
  const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  return day === 0 || day === 6;
}

/* 單人定價：假日優先用假日價，沒填就退回平日價 */
export function unitPriceOf(script, dateStr) {
  if (!script) return 0;
  const weekday = Number(script.priceWeekday) || 0;
  const holiday = Number(script.priceHoliday) || 0;
  if (isHolidayDate(dateStr)) return holiday || weekday;
  return weekday || holiday;
}
