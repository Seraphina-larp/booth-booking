import React, { useState, useEffect, useMemo } from 'react';
import {
  Sunrise, Sun, Moon, Plus, Pencil, Trash2, Check, X, Lock, Unlock,
  ChevronLeft, ChevronRight, User, Wallet, CalendarDays,
  MapPin, Inbox, Send, Search, RotateCcw, Flower2, Key, MessageSquare, Bell, Upload, FileText, Download, Users,
} from 'lucide-react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

/* ---------------------------------- 常數 ---------------------------------- */

const ROOMS_DEFAULT = [
  { id: 'r1', code: '4F全', name: '愛してる', lang: '日語' },
  { id: 'r2', code: '5F全', name: '我鍾意你', lang: '粵語' },
  { id: 'r3', code: '5F外', name: 'Ti amo', lang: '義大利語' },
  { id: 'r4', code: '5F內', name: "Je t'aime", lang: '法語' },
  { id: 'r5', code: '5F中', name: 'Я тебя люблю', lang: '俄語' },
];

const SLOTS = [
  { key: '早', label: '早場', Icon: Sunrise },
  { key: '中', label: '午場', Icon: Sun },
  { key: '晚', label: '晚場', Icon: Moon },
];
const SLOT_ORDER = { 早: 0, 中: 1, 晚: 2 };

const CATEGORY_META = {
  own: { label: '自家場', color: '#6B9C7F' },
  rentOut: { label: '出租場', color: '#C97A52' },
  borrowed: { label: '外借場', color: '#8F7AB5' },
};

const FEEDBACK_TYPES = ['道具不足', '需要列印', '設備或場地問題', '其他建議'];

const DEFAULT_TEXTS = {
  overview_hint: '',
  request_hint: '填寫以下資訊送出，場地方確認後會幫您安排進場次表。',
  host_hint: '輸入自己的姓名，再輸入查詢密碼，就能看到您帶場/支援NPC的場次，以及您向我們租場地的場次與金額。沒有密碼是看不到任何場次內容的，密碼如果忘記了請聯絡管理者。',
  feedback_hint: '劇本道具該補了、需要印什麼，或其他想讓場地方知道的事，都可以在這裡留言。',
  pending_hint: '',
  finance_hint: '',
  staff_hint: '幫每位主持人／NPC／租場夥伴設定查詢密碼。他們在「主持人查詢」輸入自己名字後，需要輸入這組密碼才能看到金額（薪水或場地費）。',
  reminders_hint: '這裡會整理出「誰、什麼時候要帶場」並產生提醒文字。要說明的是：這個原型沒辦法自動發送 LINE 訊息——LINE 的官方推播需要另外申請 Messaging API 並架設後端服務才能做到排程自動發送，這部分超出純前端原型能做的範圍。目前先幫你做到「整理名單 + 一鍵複製訊息」，複製後手動貼到 LINE 傳送即可，也可以勾選「已提醒」避免重複通知。',
  import_hint: '選好類型、日期、包廂之後填活動名稱、預約人、主持人，按「加入清單」會先放進下面的待新增清單，確認沒問題後再按「確認新增」一次存入。如果你有一大批資料想直接貼上試算表批量處理，可以打開下面的「進階」選項。',
  import_hint2: '進階匯入用的標題列格式如上。時段欄可填早/中/晚其中一個或多個，跨時段請用「、」或「;」分隔（不要用一般逗號，會跟欄位分隔符號搞混），例如「中、晚」。開始時間與結束時間都必須填寫（格式 HH:MM），不能留空。類型填「自家場」「出租場」或「外借場」。主持人清單格式是「姓名:角色:薪水」，多人用「;」分隔，例如 沙拉:主持:1800;小宇:NPC:800（自家場/外借場用，出租場可留空）。收款狀態填「已收款」，留空代表未收款。租金計算方式填「固定費率」「票房抽成」或「直接輸入」（出租場用）。',
};

const TEXT_FIELDS = [
  { key: 'overview_hint', label: '總覽分頁' },
  { key: 'request_hint', label: '我要租場分頁' },
  { key: 'host_hint', label: '主持人查詢分頁' },
  { key: 'feedback_hint', label: '帶場回饋分頁' },
  { key: 'pending_hint', label: '待確認分頁（管理者）' },
  { key: 'finance_hint', label: '金額總覽分頁（管理者）' },
  { key: 'staff_hint', label: '人員密碼分頁（管理者）' },
  { key: 'reminders_hint', label: '提醒清單分頁（管理者）' },
  { key: 'import_hint', label: '新增場次分頁－說明文字（管理者）' },
  { key: 'import_hint2', label: '新增場次分頁－進階格式細節（管理者）' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const ADMIN_PIN = '05201314';

/* --------------------------------- 工具函式 --------------------------------- */

function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function weekdayOf(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || !parts[0]) return '';
  const [y, m, d] = parts;
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

function formatDateShort(dateStr) {
  if (!dateStr) return '未填日期';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const [, m, d] = parts;
  return `${m}/${d}（${weekdayOf(dateStr)}）`;
}

function computeFee(b) {
  if (!b || b.category !== 'rentOut') return 0;
  if (b.feeType === 'fixed') return (Number(b.feeRate) || 0) * (Number(b.feeHours) || 0);
  if (b.feeType === 'share') return (Number(b.feeRevenue) || 0) * (Number(b.feePercentage) || 0) / 100;
  if (b.feeType === 'manual') return Number(b.feeManualAmount) || 0;
  return 0;
}

function computeAmount(b) {
  if (!b) return 0;
  if (b.category === 'rentOut') return computeFee(b);
  return Number(b.ownAmount) || 0;
}

function formatMoney(n) {
  const v = Math.round(n || 0);
  return 'NT$' + v.toLocaleString('en-US');
}

function getHostsList(b) {
  if (!b) return [];
  if (Array.isArray(b.hosts) && b.hosts.length) return b.hosts;
  if (b.hostName) return [{ id: 'legacy', name: b.hostName, role: '主持', wage: '', wagePaid: 'unpaid' }];
  return [];
}

function getSlotsList(b) {
  if (!b) return ['早'];
  if (Array.isArray(b.slots) && b.slots.length) return b.slots;
  if (b.slot) return [b.slot];
  return ['早'];
}

function slotsSortKey(b) {
  const keys = getSlotsList(b).map((s) => (Object.prototype.hasOwnProperty.call(SLOT_ORDER, s) ? SLOT_ORDER[s] : 99));
  return keys.length ? Math.min(...keys) : 99;
}

function slotsLabel(b) {
  return getSlotsList(b).map((s) => (SLOTS.find((x) => x.key === s) || {}).label || s).join('＋');
}

function daysBetween(dateStr, fromStr) {
  return Math.round((new Date(dateStr) - new Date(fromStr)) / 86400000);
}

function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) { /* ignore */ }
}

async function loadKey(key, fallback) {
  try {
    const ref = doc(db, 'appData', key);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().value;
    return fallback;
  } catch (e) {
    console.error('讀取失敗', key, e);
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    const ref = doc(db, 'appData', key);
    await setDoc(ref, { value });
  } catch (e) {
    console.error('儲存失敗', key, e);
  }
}

/* --------------------------------- 資料匯入 --------------------------------- */

const IMPORT_HEADER_LINE = '日期,時段,類型,包廂或場地,活動名稱,預約人,聯絡方式,主持人清單,對方主持人,收費金額,收款狀態,租金計算方式,費率,小時數,票房總額,抽成比例,手動金額,開始時間,結束時間,備註';

function detectDelimiter(line) {
  return line.includes('\t') ? '\t' : ',';
}

function splitDelimLine(line, delim) {
  return line.split(delim).map((s) => s.trim());
}

function rowToBooking(obj, rooms) {
  const categoryLabel = (obj['類型'] || '自家場').trim();
  const categoryEntry = Object.entries(CATEGORY_META).find(([, m]) => m.label === categoryLabel);
  const category = categoryEntry ? categoryEntry[0] : 'own';

  const date = (obj['日期'] || '').trim();
  if (!date) throw new Error('缺少日期');
  const slotRaw = (obj['時段'] || '早').trim();
  const slots = slotRaw.split(/[,;、]/).map((s) => s.trim()).filter((s) => Object.prototype.hasOwnProperty.call(SLOT_ORDER, s));
  if (slots.length === 0) throw new Error('時段需為 早/中/晚（多個請用、或;分隔，例如 早、中）');

  const activityName = (obj['活動名稱'] || '').trim();
  if (!activityName) throw new Error('缺少活動名稱');

  let roomId = '';
  let venueName = '';
  const roomOrVenue = (obj['包廂或場地'] || '').trim();
  if (category === 'borrowed') {
    venueName = roomOrVenue;
    if (!venueName) throw new Error('外借場缺少場地名稱');
  } else {
    const room = rooms.find((r) => r.code === roomOrVenue || r.name === roomOrVenue);
    if (!room) throw new Error('找不到包廂「' + roomOrVenue + '」');
    roomId = room.id;
  }

  const hostsRaw = (obj['主持人清單'] || '').trim();
  const hosts = hostsRaw
    ? hostsRaw.split(';').filter(Boolean).map((piece) => {
      const parts = piece.split(':');
      return {
        id: uid('h'),
        name: (parts[0] || '').trim(),
        role: (parts[1] || '主持').trim(),
        wage: parts[2] !== undefined && parts[2].trim() !== '' ? Number(parts[2]) : '',
        wagePaid: 'unpaid',
      };
    }).filter((h) => h.name)
    : [];

  const paymentStatus = (obj['收款狀態'] || '').trim() === '已收款' ? 'paid' : 'unpaid';
  const feeTypeLabel = (obj['租金計算方式'] || '固定費率').trim();
  const feeType = feeTypeLabel === '票房抽成' ? 'share' : (feeTypeLabel === '直接輸入' ? 'manual' : 'fixed');

  const timeStart = (obj['開始時間'] || '').trim();
  const timeEnd = (obj['結束時間'] || '').trim();
  if (!timeStart || !timeEnd) throw new Error('開始時間與結束時間都必須填寫');

  return {
    id: uid('bk'), category, date, roomId, venueName,
    slots, timeStart, timeEnd,
    activityName,
    personName: (obj['預約人'] || '').trim(),
    contact: (obj['聯絡方式'] || '').trim(),
    hosts: category === 'rentOut' ? [] : (hosts.length ? hosts : [{ id: uid('h'), name: '', role: '主持', wage: '', wagePaid: 'unpaid' }]),
    hostNote: (obj['對方主持人'] || '').trim(),
    ownAmount: (obj['收費金額'] || '').trim(),
    paymentStatus,
    feeType,
    feeRate: (obj['費率'] || '').trim(),
    feeHours: (obj['小時數'] || '').trim(),
    feeRevenue: (obj['票房總額'] || '').trim(),
    feePercentage: (obj['抽成比例'] || '').trim(),
    feeManualAmount: (obj['手動金額'] || '').trim(),
    notes: (obj['備註'] || '').trim(),
  };
}

function parseImportText(text, rooms) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { rows: [], errors: [{ row: 0, reason: '至少需要標題列加一筆資料' }] };
  const delim = detectDelimiter(lines[0]);
  const headers = splitDelimLine(lines[0], delim);
  const rows = [];
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitDelimLine(lines[i], delim);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] !== undefined ? cells[idx] : ''; });
    try {
      rows.push(rowToBooking(obj, rooms));
    } catch (err) {
      errors.push({ row: i + 1, reason: err.message });
    }
  }
  return { rows, errors };
}

/* --------------------------------- 示範資料 --------------------------------- */

function seedBookings(rooms) {
  const find = (code) => rooms.find((r) => r.code === code) || rooms[0];
  return [
    {
      id: uid('bk'), category: 'own', date: '2026-06-18', roomId: find('5F內').id,
      venueName: '', slots: ['晚'], timeStart: '19:00', timeEnd: '23:00', activityName: '季風吹過橘色的海',
      personName: '', contact: '',
      hosts: [{ id: uid('h'), name: 'bobo', role: '主持', wage: 1500, wagePaid: 'paid' }], hostNote: '',
      ownAmount: 3600, paymentStatus: 'paid', feeType: 'fixed', feeRate: '', feeHours: '',
      feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: '',
    },
    {
      id: uid('bk'), category: 'own', date: '2026-06-20', roomId: find('4F全').id,
      venueName: '', slots: ['中', '晚'], timeStart: '13:00', timeEnd: '22:00', activityName: '無名之町 上+下',
      personName: '', contact: '',
      hosts: [
        { id: uid('h'), name: '沙拉', role: '主持', wage: 1800, wagePaid: 'unpaid' },
        { id: uid('h'), name: '小宇', role: 'NPC', wage: 800, wagePaid: 'paid' },
      ], hostNote: '',
      ownAmount: 4200, paymentStatus: 'unpaid', feeType: 'fixed', feeRate: '', feeHours: '',
      feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: '上下半場跨中晚兩個時段',
    },
    {
      id: uid('bk'), category: 'rentOut', date: '2026-06-19', roomId: find('5F外').id,
      venueName: '', slots: ['中'], timeStart: '13:00', timeEnd: '18:00', activityName: '告別詩',
      personName: 'Sharon', contact: 'LINE: sharon_888',
      hosts: [], hostNote: '', ownAmount: '',
      paymentStatus: 'unpaid', feeType: 'fixed', feeRate: 600, feeHours: 4,
      feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: '',
    },
    {
      id: uid('bk'), category: 'rentOut', date: '2026-06-25', roomId: find('5F全').id,
      venueName: '', slots: ['早'], timeStart: '10:00', timeEnd: '15:00', activityName: '二流貨色',
      personName: '三月工作室', contact: 'LINE: march_studio',
      hosts: [], hostNote: '', ownAmount: '',
      paymentStatus: 'paid', feeType: 'share', feeRate: '', feeHours: '',
      feeRevenue: 8000, feePercentage: 30, feeManualAmount: '', notes: '',
    },
    {
      id: uid('bk'), category: 'borrowed', date: '2026-06-22', roomId: '',
      venueName: '阿明的密室基地', slots: ['晚'], timeStart: '19:30', timeEnd: '22:30',
      activityName: '月迷津渡', personName: '', contact: '',
      hosts: [{ id: uid('h'), name: '沙拉', role: '主持', wage: 1600, wagePaid: 'unpaid' }], hostNote: '',
      ownAmount: 3000, paymentStatus: 'paid', feeType: 'fixed', feeRate: '',
      feeHours: '', feeRevenue: '', feePercentage: '', feeManualAmount: '',
      notes: '在夥伴場地支援一場',
    },
    {
      id: uid('bk'), category: 'rentOut', date: '2026-06-13', roomId: find('5F中').id,
      venueName: '', slots: ['晚'], timeStart: '19:00', timeEnd: '23:00', activityName: '我鍾意你包場活動',
      personName: '佳怡', contact: 'LINE: jiayi_room',
      hosts: [], hostNote: '', ownAmount: '',
      paymentStatus: 'unpaid', feeType: 'fixed', feeRate: 600, feeHours: 3,
      feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: '',
    },
    {
      id: uid('bk'), category: 'own', date: '2026-06-24', roomId: find('4F全').id,
      venueName: '', slots: ['晚'], timeStart: '19:00', timeEnd: '23:00', activityName: '世紀末的最後一場雪',
      personName: '', contact: '',
      hosts: [{ id: uid('h'), name: 'bobo', role: '主持', wage: 1500, wagePaid: 'unpaid' }], hostNote: '',
      ownAmount: 3600, paymentStatus: 'unpaid', feeType: 'fixed', feeRate: '', feeHours: '',
      feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: '',
    },
  ];
}

function seedPending(rooms) {
  const room = rooms.find((r) => r.code === '5F中') || rooms[0];
  return [
    {
      id: uid('pd'), status: 'pending', submittedAt: new Date().toISOString(),
      partnerName: '佳怡', contact: 'LINE: jiayi_room',
      preferredDate: '2026-06-29', preferredRoomId: room.id, preferredSlot: '晚',
      preferredTimeStart: '19:00', preferredTimeEnd: '23:00',
      activityName: '告別詩', estimatedHours: 4, notes: '晚上7點開始,預計4小時',
    },
  ];
}

function seedStaffDirectory() {
  return {
    'bobo': '1234', '沙拉': '0000', '小宇': '5678',
    'Sharon': '8888', '三月工作室': '2025', '佳怡': '6666',
  };
}

function seedFeedback() {
  return [
    {
      id: uid('fb'), hostName: 'bobo', activityName: '季風吹過橘色的海',
      feedbackType: '道具不足',
      content: '花束道具有點舊了，可以補新的嗎？另外結局信封只剩2份，要再印一些。',
      submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'new',
    },
  ];
}

/* --------------------------------- 小元件 --------------------------------- */

function SlotIcon({ slot, size = 15 }) {
  const found = SLOTS.find((s) => s.key === slot);
  const Icon = found ? found.Icon : Sun;
  return <Icon size={size} strokeWidth={2} />;
}

function CategoryBadge({ category }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.own;
  return (
    <span className="badge" style={{ background: meta.color }}>
      {meta.label}
    </span>
  );
}

function CategoryLegend() {
  return (
    <div className="legend-row">
      {Object.entries(CATEGORY_META).map(([key, meta]) => (
        <span key={key} className="legend-item">
          <span className="legend-dot" style={{ background: meta.color }} />
          {meta.label}
        </span>
      ))}
    </div>
  );
}

function PaymentChip({ status, onClick, clickable, labels }) {
  const paid = status === 'paid';
  const text = labels || ['已收款', '未收款'];
  return (
    <button
      type="button"
      className={`pay-chip ${paid ? 'pay-paid' : 'pay-unpaid'}`}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      <span className="pay-dot" />
      {paid ? text[0] : text[1]}
    </button>
  );
}

function MonthNav({ year, month, onPrev, onNext }) {
  return (
    <div className="month-nav">
      <button type="button" className="icon-btn" onClick={onPrev} aria-label="上個月">
        <ChevronLeft size={18} />
      </button>
      <div className="month-label">{year} 年 {month} 月</div>
      <button type="button" className="icon-btn" onClick={onNext} aria-label="下個月">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function RoomTag({ booking, rooms }) {
  if (booking.category === 'borrowed') {
    return (
      <div className="room-tag">
        <MapPin size={14} />
        <span className="room-code">外借場地</span>
        <em className="room-name">{booking.venueName || '未填場地名稱'}</em>
      </div>
    );
  }
  const room = rooms.find((r) => r.id === booking.roomId);
  if (!room) return <div className="room-tag muted">（未選擇包廂）</div>;
  return (
    <div className="room-tag">
      <span className="room-code">{room.code}</span>
      <em className="room-name">{room.name}</em>
      <span className="room-lang">（{room.lang}）</span>
    </div>
  );
}

/* --------------------------------- 月曆格 --------------------------------- */

function MonthCalendarGrid({ year, month, bookingsByDate, selectedDate, onSelectDate }) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = todayStr();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="cal-wrap">
      <div className="cal-grid cal-weekdays">
        {WEEKDAYS.map((w) => <div key={w} className="cal-weekday">{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} className="cal-cell empty" />;
          const dateStr = `${year}-${pad2(month)}-${pad2(d)}`;
          const items = bookingsByDate[dateStr] || [];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const shown = items.slice(0, 3);
          return (
            <button
              type="button"
              key={dateStr}
              className={`cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectDate(dateStr)}
            >
              <span className="cal-day-num">{d}</span>
              {items.length > 0 && (
                <span className="cal-dots">
                  {shown.map((b) => (
                    <span key={b.id} className="cal-dot" style={{ background: (CATEGORY_META[b.category] || CATEGORY_META.own).color }} />
                  ))}
                  {items.length > 3 && <span className="cal-more">+{items.length - 3}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- 場次卡片 --------------------------------- */

function SessionCard({
  booking, rooms, adminUnlocked, showMoney, viewerName,
  onEdit, onDeleteAsk, onTogglePay, onToggleHostWage,
  confirmingDelete, onConfirmDelete, onCancelDelete,
}) {
  const meta = CATEGORY_META[booking.category] || CATEGORY_META.own;
  const hostsList = getHostsList(booking);
  const normViewer = viewerName ? viewerName.trim().toLowerCase() : null;
  const myHosts = normViewer ? hostsList.filter((h) => (h.name || '').trim().toLowerCase() === normViewer) : hostsList;
  const isRentOutSelf = booking.category === 'rentOut' && normViewer && (booking.personName || '').trim().toLowerCase() === normViewer;
  const showTotal = showMoney && (!normViewer || isRentOutSelf);
  const totalAmount = computeAmount(booking);
  const personLabel = booking.category === 'rentOut' ? '租場夥伴' : '預約人';
  const totalLabel = booking.category === 'rentOut' ? '場地費' : '收費金額';

  return (
    <div className="ticket" style={{ borderLeftColor: meta.color }}>
      <div className="ticket-row">
        <div className="slot-time">
          {getSlotsList(booking).map((sk) => (
            <span key={sk} className="slot-chip"><SlotIcon slot={sk} size={13} /> {(SLOTS.find((s) => s.key === sk) || {}).label || sk}</span>
          ))}
          {(booking.timeStart || booking.timeEnd) && <span className="time-text">{booking.timeStart}～{booking.timeEnd}</span>}
        </div>
        <CategoryBadge category={booking.category} />
      </div>

      <RoomTag booking={booking} rooms={rooms} />

      <div className="activity-name">{booking.activityName || '（未填活動 / 劇本名稱）'}</div>

      <div className="person-line">
        <User size={13} />
        <span>{personLabel}：{booking.personName || '未填'}</span>
      </div>

      {booking.category === 'rentOut' && booking.hostNote && (
        <div className="person-line">
          <User size={13} />
          <span>對方主持人：{booking.hostNote}</span>
        </div>
      )}

      {myHosts.map((h) => {
        const hasWage = h.wage !== '' && h.wage !== undefined && h.wage !== null;
        return (
          <div className="person-line host-line" key={h.id || h.name}>
            <User size={13} />
            <span className="host-name-role">{h.role || '主持人'}：{h.name || '未填'}</span>
            {showMoney && hasWage && (
              <>
                <span className="host-wage">薪水 {formatMoney(h.wage)}</span>
                <PaymentChip
                  status={h.wagePaid || 'unpaid'}
                  clickable={adminUnlocked}
                  onClick={() => onToggleHostWage(booking.id, h.id)}
                  labels={['已給付', '未給付']}
                />
              </>
            )}
          </div>
        );
      })}

      {showTotal && (
        <div className="person-line">
          <Wallet size={13} />
          <span>{totalLabel}：{formatMoney(totalAmount)}</span>
        </div>
      )}

      {booking.notes && <div className="notes-line">備註：{booking.notes}</div>}

      <div className="ticket-footer">
        {showTotal && (
          <PaymentChip
            status={booking.paymentStatus}
            clickable={adminUnlocked}
            onClick={() => onTogglePay(booking.id)}
          />
        )}
        {adminUnlocked && (
          <div className="ticket-actions">
            {confirmingDelete ? (
              <>
                <span className="confirm-text">確定刪除？</span>
                <button type="button" className="icon-btn danger" onClick={() => onConfirmDelete(booking.id)}>
                  <Check size={15} />
                </button>
                <button type="button" className="icon-btn" onClick={onCancelDelete}>
                  <X size={15} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="icon-btn" onClick={() => onEdit(booking)} aria-label="編輯">
                  <Pencil size={15} />
                </button>
                <button type="button" className="icon-btn danger-outline" onClick={() => onDeleteAsk(booking.id)} aria-label="刪除">
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- 新增/編輯表單 --------------------------------- */

/* --------------------------------- 主持人/NPC 編輯器（共用元件） --------------------------------- */

function HostsEditor({ hosts, onChange }) {
  function updateHost(idx, field, value) {
    onChange(hosts.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  }
  function addHost() {
    onChange([...hosts, { id: uid('h'), name: '', role: '主持', wage: '', wagePaid: 'unpaid' }]);
  }
  function removeHost(idx) {
    onChange(hosts.filter((_, i) => i !== idx));
  }
  return (
    <div className="hosts-block">
      {hosts.map((h, idx) => (
        <div className="host-row" key={h.id}>
          <input type="text" placeholder="姓名" value={h.name} onChange={(e) => updateHost(idx, 'name', e.target.value)} />
          <input type="text" placeholder="角色，例如主持/NPC" value={h.role} onChange={(e) => updateHost(idx, 'role', e.target.value)} />
          <input type="number" placeholder="薪水" value={h.wage} onChange={(e) => updateHost(idx, 'wage', e.target.value)} />
          {hosts.length > 1 && (
            <button type="button" className="icon-btn danger-outline" onClick={() => removeHost(idx)} aria-label="移除">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-ghost small" onClick={addHost}><Plus size={13} /> 新增人員</button>
    </div>
  );
}

function SessionForm({ initialData, rooms, mode, onCancel, onSave }) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState('');

  function set(field, value) {
    setData((d) => ({ ...d, [field]: value }));
  }
  function toggleSlot(key) {
    setData((d) => {
      const current = d.slots || [];
      const has = current.includes(key);
      let next = has ? current.filter((k) => k !== key) : [...current, key];
      if (next.length === 0) next = [key];
      return { ...d, slots: next };
    });
  }

  function handleSubmit() {
    if (!data.date || !data.activityName.trim()) {
      setError('請至少填寫日期與活動／劇本名稱');
      return;
    }
    if (!data.timeStart || !data.timeEnd) {
      setError('請選擇開始與結束時間');
      return;
    }
    if (data.category === 'borrowed' && !data.venueName.trim()) {
      setError('外借場請填寫場地名稱');
      return;
    }
    if (data.category !== 'borrowed' && !data.roomId) {
      setError('請選擇包廂');
      return;
    }
    setError('');
    onSave(data);
  }

  const titleMap = { add: '新增場次', edit: '編輯場次', approve: '核准並填入場次' };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>{titleMap[mode] || '場次'}</h3>
          <button type="button" className="icon-btn" onClick={onCancel}><X size={18} /></button>
        </div>

        <div className="field">
          <label>類型</label>
          <div className="radio-row">
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <label key={key} className={`radio-pill ${data.category === key ? 'active' : ''}`} style={data.category === key ? { borderColor: meta.color, color: meta.color } : {}}>
                <input
                  type="radio"
                  name="category"
                  checked={data.category === key}
                  onChange={() => set('category', key)}
                  style={{ display: 'none' }}
                />
                {meta.label}
              </label>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>日期</label>
            <input type="date" value={data.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field span2">
            <label>時段（可複選，跨時段就多勾幾個）</label>
            <div className="slot-checkbox-row">
              {SLOTS.map((s) => (
                <label key={s.key} className={`slot-check-pill ${(data.slots || []).includes(s.key) ? 'active' : ''}`}>
                  <input type="checkbox" checked={(data.slots || []).includes(s.key)} onChange={() => toggleSlot(s.key)} style={{ display: 'none' }} />
                  <SlotIcon slot={s.key} size={14} /> {s.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>開始時間</label>
            <input type="time" value={data.timeStart} onChange={(e) => set('timeStart', e.target.value)} />
          </div>
          <div className="field">
            <label>結束時間</label>
            <input type="time" value={data.timeEnd} onChange={(e) => set('timeEnd', e.target.value)} />
          </div>

          {data.category === 'borrowed' ? (
            <div className="field span2">
              <label>外借場地名稱</label>
              <input type="text" placeholder="例如：阿明的密室基地" value={data.venueName} onChange={(e) => set('venueName', e.target.value)} />
            </div>
          ) : (
            <div className="field span2">
              <label>包廂</label>
              <select value={data.roomId} onChange={(e) => set('roomId', e.target.value)}>
                <option value="">請選擇</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.code}．{r.name}（{r.lang}）</option>
                ))}
              </select>
            </div>
          )}

          <div className="field span2">
            <label>活動／劇本名稱</label>
            <input type="text" value={data.activityName} onChange={(e) => set('activityName', e.target.value)} />
          </div>

          <div className="field">
            <label>{data.category === 'rentOut' ? '租場夥伴' : '預約人 / 顧客'}</label>
            <input type="text" value={data.personName} onChange={(e) => set('personName', e.target.value)} />
          </div>
          <div className="field">
            <label>聯絡方式（選填）</label>
            <input type="text" placeholder="LINE ID / 電話" value={data.contact} onChange={(e) => set('contact', e.target.value)} />
          </div>

          {data.category === 'rentOut' ? (
            <div className="field">
              <label>對方主持人（選填）</label>
              <input type="text" value={data.hostNote} onChange={(e) => set('hostNote', e.target.value)} />
            </div>
          ) : (
            <div className="field span2">
              <label>主持人 / NPC（可新增多位，各自填薪水）</label>
              <HostsEditor hosts={data.hosts} onChange={(hosts) => set('hosts', hosts)} />
            </div>
          )}

          <div className="field">
            <label>{data.category === 'rentOut' ? '租金收款狀態' : '收款狀態'}</label>
            <select value={data.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value)}>
              <option value="unpaid">未收款</option>
              <option value="paid">已收款</option>
            </select>
          </div>

          {data.category !== 'rentOut' && (
            <div className="field span2">
              <label>收費金額（向顧客收取，NT$）</label>
              <input type="number" value={data.ownAmount} onChange={(e) => set('ownAmount', e.target.value)} />
            </div>
          )}

          {data.category === 'rentOut' && (
            <>
              <div className="field span2 fee-block">
                <label>租金計算方式</label>
                <div className="radio-row">
                  {[['fixed', '固定費率'], ['share', '票房抽成'], ['manual', '直接輸入金額']].map(([k, l]) => (
                    <label key={k} className={`radio-pill ${data.feeType === k ? 'active' : ''}`}>
                      <input type="radio" name="feeType" checked={data.feeType === k} onChange={() => set('feeType', k)} style={{ display: 'none' }} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>

              {data.feeType === 'fixed' && (
                <>
                  <div className="field">
                    <label>每小時費率（NT$）</label>
                    <input type="number" value={data.feeRate} onChange={(e) => set('feeRate', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>租用小時數</label>
                    <input type="number" value={data.feeHours} onChange={(e) => set('feeHours', e.target.value)} />
                  </div>
                </>
              )}
              {data.feeType === 'share' && (
                <>
                  <div className="field">
                    <label>票房總額（NT$）</label>
                    <input type="number" value={data.feeRevenue} onChange={(e) => set('feeRevenue', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>抽成比例（%）</label>
                    <input type="number" value={data.feePercentage} onChange={(e) => set('feePercentage', e.target.value)} />
                  </div>
                </>
              )}
              {data.feeType === 'manual' && (
                <div className="field span2">
                  <label>金額（NT$）</label>
                  <input type="number" value={data.feeManualAmount} onChange={(e) => set('feeManualAmount', e.target.value)} />
                </div>
              )}
              <div className="field span2 fee-preview">
                試算金額：<strong>{formatMoney(computeFee(data))}</strong>
              </div>
            </>
          )}

          <div className="field span2">
            <label>備註（選填）</label>
            <textarea rows={2} value={data.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
          <button type="button" className="btn-primary" onClick={handleSubmit}>儲存場次</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- 人員密碼管理 --------------------------------- */

function StaffPasswordRow({ name, value, onSave, onDelete }) {
  const [pw, setPw] = useState(value);
  const [saved, setSaved] = useState(false);
  function handleSave() {
    onSave(pw);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <div className="staff-row">
      <span className="staff-name">{name}</span>
      <input type="text" placeholder="設定密碼" value={pw} onChange={(e) => { setPw(e.target.value); setSaved(false); }} />
      <button type="button" className="btn-primary small" onClick={handleSave}>{saved ? '已儲存' : '儲存'}</button>
      <button type="button" className="icon-btn danger-outline" onClick={onDelete} aria-label="刪除"><Trash2 size={14} /></button>
    </div>
  );
}

function AddStaffForm({ onAdd }) {
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name.trim(), pw);
    setName('');
    setPw('');
  }
  return (
    <div className="staff-row add-row">
      <input type="text" placeholder="新增人員姓名" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="text" placeholder="設定密碼" value={pw} onChange={(e) => setPw(e.target.value)} />
      <button type="button" className="btn-primary small" onClick={handleAdd}><Plus size={13} /> 新增</button>
    </div>
  );
}

function TextEditRow({ label, value, defaultValue, onSave, onReset }) {
  const [val, setVal] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setVal(value); }, [value]);
  function handleSave() {
    onSave(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <div className="text-edit-row">
      <div className="text-edit-label">{label}</div>
      <textarea
        rows={2}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={defaultValue || '（目前沒有預設文字，留空表示不顯示）'}
      />
      <div className="text-edit-actions">
        <button type="button" className="btn-primary small" onClick={handleSave}>{saved ? '已儲存' : '儲存'}</button>
        <button type="button" className="btn-ghost small" onClick={() => { setVal(defaultValue); onReset(); }}>還原預設</button>
      </div>
    </div>
  );
}

/* --------------------------------- 提醒清單列 --------------------------------- */

function ReminderRow({ item, type, reminded, onToggle, rooms }) {
  const { booking: b, host: h } = item;
  const roomLabel = b.category === 'borrowed' ? b.venueName : ((rooms.find((rm) => rm.id === b.roomId) || {}).code || '');
  const msg = type === 'night'
    ? `嗨 ${h.name}！明天（${formatDateShort(b.date)}）要帶《${b.activityName}》，今晚早點睡，保持好狀態喔！`
    : `嗨 ${h.name}！提醒你 ${formatDateShort(b.date)} 要帶《${b.activityName}》（${roomLabel}），記得先預留時間準備～`;
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    copyText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="reminder-row">
      <div className="reminder-info">
        <div className="reminder-name">{h.name}{h.role ? `（${h.role}）` : ''}</div>
        <div className="reminder-meta">{formatDateShort(b.date)} · {b.activityName} · {roomLabel}</div>
      </div>
      <div className="reminder-msg">{msg}</div>
      <div className="reminder-actions">
        <button type="button" className="btn-ghost small" onClick={handleCopy}>{copied ? '已複製' : '複製訊息'}</button>
        <label className="reminded-check">
          <input type="checkbox" checked={reminded} onChange={onToggle} /> 已提醒
        </label>
      </div>
    </div>
  );
}

/* --------------------------------- 主元件 --------------------------------- */

export default function BoothBookingApp() {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState(ROOMS_DEFAULT);
  const [bookings, setBookings] = useState([]);
  const [pending, setPending] = useState([]);
  const [staffDirectory, setStaffDirectory] = useState({});
  const [feedbackList, setFeedbackList] = useState([]);
  const [reminderLog, setReminderLog] = useState({});
  const [syncConfig, setSyncConfig] = useState({ sheetName: '', lastSyncAt: '', lastSyncMessage: '' });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [pageTexts, setPageTexts] = useState({});
  const [tab, setTab] = useState('overview');

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showPinBox, setShowPinBox] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminUser, setAdminUser] = useState(null);

  const todayD = new Date();
  const [viewYear, setViewYear] = useState(todayD.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayD.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [viewMode, setViewMode] = useState('calendar');

  const [modal, setModal] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmRejectId, setConfirmRejectId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [reqForm, setReqForm] = useState({
    partnerName: '', contact: '', preferredDate: '', preferredRoomId: '',
    preferredSlot: '早', preferredTimeStart: '', preferredTimeEnd: '', activityName: '', estimatedHours: '', notes: '',
  });
  const [reqSubmitted, setReqSubmitted] = useState(false);
  const [reqError, setReqError] = useState('');

  const [hostQuery, setHostQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [hostOverviewShowPast, setHostOverviewShowPast] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [unlockedFor, setUnlockedFor] = useState(null);

  const [feedbackForm, setFeedbackForm] = useState({ hostName: '', activityName: '', feedbackType: FEEDBACK_TYPES[0], content: '' });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importMode, setImportMode] = useState('append');
  const [importDone, setImportDone] = useState(null);

  const [quickForm, setQuickForm] = useState(() => emptyBookingData(todayStr()));
  const [quickQueue, setQuickQueue] = useState([]);
  const [quickError, setQuickError] = useState('');
  const [quickDone, setQuickDone] = useState(null);

  const [tableDraft, setTableDraft] = useState([]);
  useEffect(() => { setTableDraft(bookings); }, [bookings]);

  useEffect(() => {
    (async () => {
      const r = await loadKey('rooms-config', ROOMS_DEFAULT);
      const b = await loadKey('bookings', null);
      const p = await loadKey('pending-requests', null);
      const sd = await loadKey('staff-directory', null);
      const fb = await loadKey('host-feedback', null);
      const rl = await loadKey('reminder-log', {});
      const pt = await loadKey('page-texts', {});
      const sc = await loadKey('sync-config', { sheetName: '', lastSyncAt: '', lastSyncMessage: '' });
      setSyncConfig(sc || { sheetName: '', lastSyncAt: '', lastSyncMessage: '' });
      setRooms(r);
      if (b === null && p === null) {
        const sb = seedBookings(r);
        const sp = seedPending(r);
        const ssd = seedStaffDirectory();
        const sfb = seedFeedback();
        setBookings(sb);
        setPending(sp);
        setStaffDirectory(ssd);
        setFeedbackList(sfb);
        setReminderLog({});
        setPageTexts({});
        saveKey('bookings', sb);
        saveKey('pending-requests', sp);
        saveKey('staff-directory', ssd);
        saveKey('host-feedback', sfb);
      } else {
        setBookings(b || []);
        setPending(p || []);
        setStaffDirectory(sd || {});
        setFeedbackList(fb || []);
        setReminderLog(rl || {});
        setPageTexts(pt || {});
      }
      setLoading(false);
    })();
  }, []);

  function persistBookings(next) { setBookings(next); saveKey('bookings', next); }
  function persistPending(next) { setPending(next); saveKey('pending-requests', next); }
  function persistStaff(next) { setStaffDirectory(next); saveKey('staff-directory', next); }
  function persistFeedback(next) { setFeedbackList(next); saveKey('host-feedback', next); }
  function persistReminderLog(next) { setReminderLog(next); saveKey('reminder-log', next); }
  function persistPageTexts(next) { setPageTexts(next); saveKey('page-texts', next); }
  function getText(key) {
    const v = pageTexts[key];
    return (v === undefined || v === null) ? (DEFAULT_TEXTS[key] || '') : v;
  }
  function persistSyncConfig(next) { setSyncConfig(next); saveKey('sync-config', next); }

  function buildSyncRows() {
    return bookings
      .map((b) => ({
        id: b.id,
        date: b.date,
        activityName: b.activityName || '',
        roomLabel: b.category === 'borrowed' ? b.venueName : ((rooms.find((r) => r.id === b.roomId) || {}).code || ''),
        hostNames: getHostsList(b).map((h) => h.name).filter(Boolean).join('、'),
        timeStart: b.timeStart || '',
        timeEnd: b.timeEnd || '',
      }))
      .filter((r) => r.hostNames);
  }

  function exportBookingsForSheet() {
    const rows = [['BookingId', '日期', '活動劇本名稱', '包廂或場地', '主持人姓名', '開始時間', '結束時間', '一週提醒已發送', '前晚提醒已發送']];
    buildSyncRows().forEach((r) => rows.push([r.id, r.date, r.activityName, r.roomLabel, r.hostNames, r.timeStart, r.timeEnd, '', '']));
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Bookings同步.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function syncToSheet() {
    if (!syncConfig.sheetName.trim()) {
      setSyncMessage('請先填寫 Google 試算表的名稱，再按同步。');
      return;
    }
    setSyncing(true);
    setSyncMessage('連線中，請稍候…');
    const rows = buildSyncRows();
    const prompt = [
      '你已經連結使用者的 Google Drive，請完成以下任務：',
      `1. 在使用者的 Google Drive 裡找到名稱包含「${syncConfig.sheetName.trim()}」的 Google 試算表。`,
      '2. 開啟它，找到名為「Bookings」的工作表；如果不存在就新建一個，並在第一列填入標題：BookingId,日期,活動劇本名稱,包廂或場地,主持人姓名,開始時間,結束時間,一週提醒已發送,前晚提醒已發送',
      '3. 讀取目前 A2 到 I 欄、所有有資料的列。',
      '4. 我會提供一份「目前應該存在」的場次清單（JSON）。請用 BookingId 比對：',
      '   - 清單裡的場次若 Bookings 表已有相同 BookingId 的列，更新該列 B~G 欄為新內容，但完全不要更動該列原本 H、I 欄（已發送提醒）的值。',
      '   - 清單裡的場次若是新的 BookingId，新增一列，H、I 欄留空。',
      '   - Bookings 表現有的列若其 BookingId 不在這份清單裡，代表已被刪除，請把該列移除。',
      '5. 把合併後的完整結果，一次性覆寫回 Bookings 工作表的資料範圍（不要一列一列分開呼叫，效率較高）。',
      '6. 完成後用一句話告訴我：新增了幾列、更新了幾列、刪除了幾列。如果找不到試算表或工作表，也請直接告訴我原因。',
      '',
      '場次清單 JSON：',
      JSON.stringify(rows),
    ].join('\n');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
          mcp_servers: [{ type: 'url', url: 'https://drivemcp.googleapis.com/mcp/v1', name: 'google-drive' }],
        }),
      });
      const data = await response.json();
      const textBlocks = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const finalMsg = textBlocks || (data.error ? `同步失敗：${data.error.message || JSON.stringify(data.error)}` : '沒有收到文字回覆，請自己到 Sheet 確認結果是否正確。');
      setSyncMessage(finalMsg);
      persistSyncConfig({ ...syncConfig, lastSyncAt: new Date().toISOString(), lastSyncMessage: finalMsg });
    } catch (err) {
      const msg = '同步失敗：' + (err && err.message ? err.message : String(err));
      setSyncMessage(msg);
      persistSyncConfig({ ...syncConfig, lastSyncAt: new Date().toISOString(), lastSyncMessage: msg });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      setAdminUnlocked(!!user);
      if (!user && ['pending', 'hostOverview', 'finance', 'staff', 'reminders', 'import', 'texts'].includes(tab)) {
        setTab('overview');
      }
      if (!user && viewMode === 'table') setViewMode('calendar');
    });
    return () => unsubscribe();
  }, [tab, viewMode]);

  async function handleUnlock() {
    try {
      setAdminLoginError('');
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      setShowPinBox(false);
      setAdminPassword('');
    } catch (e) {
      setAdminLoginError('登入失敗，請確認 Email 或密碼是否正確');
    }
  }

  async function handleLock() {
    await signOut(auth);
    setAdminUnlocked(false);
    setAdminUser(null);
    setAdminPassword('');
    if (['pending', 'hostOverview', 'finance', 'staff', 'reminders', 'import', 'texts'].includes(tab)) setTab('overview');
    if (viewMode === 'table') setViewMode('calendar');
  }

  function emptyBookingData(presetDate) {
    return {
      id: uid('bk'), category: 'own', date: presetDate || todayStr(),
      roomId: rooms[0]?.id || '', venueName: '', slots: ['早'], timeStart: '', timeEnd: '',
      activityName: '', personName: '', contact: '',
      hosts: [{ id: uid('h'), name: '', role: '主持', wage: '', wagePaid: 'unpaid' }], hostNote: '',
      ownAmount: '', paymentStatus: 'unpaid', feeType: 'fixed', feeRate: '', feeHours: '',
      feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: '',
    };
  }

  function openAdd() { setModal({ mode: 'add', data: emptyBookingData(selectedDate) }); }
  function openEdit(b) {
    const hosts = Array.isArray(b.hosts) && b.hosts.length
      ? b.hosts
      : (b.hostName
        ? [{ id: uid('h'), name: b.hostName, role: '主持', wage: '', wagePaid: 'unpaid' }]
        : [{ id: uid('h'), name: '', role: '主持', wage: '', wagePaid: 'unpaid' }]);
    const timeStart = b.timeStart || b.time || '';
    const timeEnd = b.timeEnd || '';
    setModal({ mode: 'edit', data: { ...b, hosts, hostNote: b.hostNote || '', slots: getSlotsList(b), timeStart, timeEnd } });
  }
  function openApprove(request) {
    const room = rooms.find((r) => r.id === request.preferredRoomId) || rooms[0];
    setModal({
      mode: 'approve',
      pendingId: request.id,
      data: {
        id: uid('bk'), category: 'rentOut', date: request.preferredDate || todayStr(),
        roomId: room?.id || '', venueName: '', slots: [request.preferredSlot || '早'],
        timeStart: request.preferredTimeStart || '', timeEnd: request.preferredTimeEnd || '',
        activityName: request.activityName || '', personName: request.partnerName || '',
        contact: request.contact || '', hosts: [], hostNote: '', ownAmount: '', paymentStatus: 'unpaid',
        feeType: 'fixed', feeRate: '', feeHours: request.estimatedHours || '',
        feeRevenue: '', feePercentage: '', feeManualAmount: '', notes: request.notes || '',
      },
    });
  }
  function closeModal() { setModal(null); }

  function handleSaveModal(data) {
    const exists = bookings.some((b) => b.id === data.id);
    const next = exists ? bookings.map((b) => (b.id === data.id ? data : b)) : [...bookings, data];
    persistBookings(next);
    if (modal?.mode === 'approve' && modal.pendingId) {
      persistPending(pending.map((p) => (p.id === modal.pendingId ? { ...p, status: 'approved' } : p)));
    }
    closeModal();
  }

  function handleDelete(id) {
    const nextBookings = bookings.filter((b) => b.id !== id);
    const nextDraft = tableDraft.filter((b) => b.id !== id);
    persistBookings(nextBookings);
    setTableDraft(nextDraft);
    setConfirmDeleteId(null);
  }
  function handleReject(id) { persistPending(pending.map((p) => (p.id === id ? { ...p, status: 'rejected' } : p))); setConfirmRejectId(null); }
  function togglePayment(id) {
    persistBookings(bookings.map((b) => (b.id === id ? { ...b, paymentStatus: b.paymentStatus === 'paid' ? 'unpaid' : 'paid' } : b)));
  }
  function toggleHostWage(bookingId, hostId) {
    persistBookings(bookings.map((b) => {
      if (b.id !== bookingId) return b;
      const hosts = (b.hosts || []).map((h) => (h.id === hostId ? { ...h, wagePaid: h.wagePaid === 'paid' ? 'unpaid' : 'paid' } : h));
      return { ...b, hosts };
    }));
  }

  function submitRequest() {
    if (!reqForm.partnerName.trim() || !reqForm.contact.trim() || !reqForm.activityName.trim()) {
      setReqError('請填寫姓名／單位、聯絡方式與活動／劇本名稱');
      return;
    }
    if (!reqForm.preferredTimeStart || !reqForm.preferredTimeEnd) {
      setReqError('請選擇開始與結束時間');
      return;
    }
    setReqError('');
    const next = [...pending, { ...reqForm, id: uid('pd'), status: 'pending', submittedAt: new Date().toISOString() }];
    persistPending(next);
    setReqSubmitted(true);
  }
  function resetReqForm() {
    setReqForm({ partnerName: '', contact: '', preferredDate: '', preferredRoomId: '', preferredSlot: '早', preferredTimeStart: '', preferredTimeEnd: '', activityName: '', estimatedHours: '', notes: '' });
    setReqError('');
    setReqSubmitted(false);
  }

  function submitFeedback() {
    if (!feedbackForm.hostName.trim() || !feedbackForm.content.trim()) return;
    const next = [...feedbackList, { ...feedbackForm, id: uid('fb'), submittedAt: new Date().toISOString(), status: 'new' }];
    persistFeedback(next);
    setFeedbackSubmitted(true);
  }
  function resetFeedbackForm() {
    setFeedbackForm({ hostName: '', activityName: '', feedbackType: FEEDBACK_TYPES[0], content: '' });
    setFeedbackSubmitted(false);
  }
  function toggleFeedbackStatus(id) {
    persistFeedback(feedbackList.map((f) => (f.id === id ? { ...f, status: f.status === 'resolved' ? 'new' : 'resolved' } : f)));
  }

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ''));
    reader.readAsText(file);
  }
  function handlePreviewImport() {
    setImportResult(parseImportText(importText, rooms));
    setImportDone(null);
  }
  function handleConfirmImport() {
    if (!importResult || importResult.rows.length === 0) return;
    const next = importMode === 'replace' ? importResult.rows : [...bookings, ...importResult.rows];
    persistBookings(next);
    setImportDone(importResult.rows.length);
    setImportResult(null);
    setImportText('');
  }

  function handleAddToQueue() {
    if (!quickForm.date || !quickForm.activityName.trim()) {
      setQuickError('請至少填寫日期與活動／劇本名稱');
      return;
    }
    if (!quickForm.timeStart || !quickForm.timeEnd) {
      setQuickError('請選擇開始與結束時間');
      return;
    }
    if (quickForm.category === 'borrowed' && !quickForm.venueName.trim()) {
      setQuickError('外借場請填寫場地名稱');
      return;
    }
    if (quickForm.category !== 'borrowed' && !quickForm.roomId) {
      setQuickError('請選擇包廂');
      return;
    }
    setQuickError('');
    setQuickQueue((q) => [...q, { ...quickForm, id: uid('bk') }]);
    setQuickForm({ ...emptyBookingData(quickForm.date), category: quickForm.category, roomId: quickForm.roomId, slots: quickForm.slots });
    setQuickDone(null);
  }
  function removeFromQueue(id) {
    setQuickQueue((q) => q.filter((b) => b.id !== id));
  }
  function toggleQuickSlot(key) {
    setQuickForm((f) => {
      const current = f.slots || [];
      const has = current.includes(key);
      let next = has ? current.filter((k) => k !== key) : [...current, key];
      if (next.length === 0) next = [key];
      return { ...f, slots: next };
    });
  }
  function handleConfirmQueue() {
    if (quickQueue.length === 0) return;
    persistBookings([...bookings, ...quickQueue]);
    setQuickDone(quickQueue.length);
    setQuickQueue([]);
  }

  function roomOrVenueText(b) {
    if (b.category === 'borrowed') return b.venueName || '';
    const room = rooms.find((r) => r.id === b.roomId);
    return room ? room.code : '';
  }
  function hostsToText(b) {
    if (b.category === 'rentOut') return b.hostNote || '';
    return getHostsList(b).filter((h) => h.name).map((h) => `${h.name}:${h.role || '主持'}:${h.wage !== '' && h.wage !== null && h.wage !== undefined ? h.wage : ''}`).join(';');
  }
  function amountValue(b) {
    if (b.category === 'rentOut') return b.feeType === 'manual' ? b.feeManualAmount : computeFee(b);
    return b.ownAmount;
  }
  function updateDraftField(id, field, value) {
    setTableDraft((d) => d.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }
  function toggleDraftSlot(id, key) {
    setTableDraft((d) => d.map((b) => {
      if (b.id !== id) return b;
      const current = getSlotsList(b);
      const has = current.includes(key);
      let next = has ? current.filter((k) => k !== key) : [...current, key];
      if (next.length === 0) next = [key];
      return { ...b, slots: next };
    }));
  }
  function updateDraftRoomOrVenue(id, text) {
    setTableDraft((d) => d.map((b) => {
      if (b.id !== id) return b;
      if (b.category === 'borrowed') return { ...b, venueName: text };
      const room = rooms.find((r) => r.code === text.trim() || r.name === text.trim());
      return { ...b, roomId: room ? room.id : b.roomId };
    }));
  }
  function updateDraftHostsText(id, text) {
    setTableDraft((d) => d.map((b) => {
      if (b.id !== id) return b;
      if (b.category === 'rentOut') return { ...b, hostNote: text };
      const parsed = text.split(';').filter(Boolean).map((piece) => {
        const parts = piece.split(':');
        return {
          id: uid('h'),
          name: (parts[0] || '').trim(),
          role: (parts[1] || '主持').trim(),
          wage: parts[2] !== undefined && parts[2].trim() !== '' ? Number(parts[2]) : '',
          wagePaid: 'unpaid',
        };
      }).filter((h) => h.name);
      return { ...b, hosts: parsed.length ? parsed : [{ id: uid('h'), name: '', role: '主持', wage: '', wagePaid: 'unpaid' }] };
    }));
  }
  function updateDraftAmount(id, value) {
    setTableDraft((d) => d.map((b) => {
      if (b.id !== id) return b;
      if (b.category === 'rentOut') return { ...b, feeType: 'manual', feeManualAmount: value };
      return { ...b, ownAmount: value };
    }));
  }
  function saveTableChanges() { persistBookings(tableDraft); }
  function addTableRow() { persistBookings([...tableDraft, emptyBookingData(todayStr())]); }
  function deleteTableRow(id) {
    persistBookings(tableDraft.filter((b) => b.id !== id));
    setConfirmDeleteId(null);
  }

  function doReset() {
    const sb = seedBookings(rooms);
    const sp = seedPending(rooms);
    const ssd = seedStaffDirectory();
    const sfb = seedFeedback();
    persistBookings(sb);
    persistPending(sp);
    persistStaff(ssd);
    persistFeedback(sfb);
    persistReminderLog({});
    persistPageTexts({});
    setConfirmReset(false);
  }

  function gotoMonth(newYear, newMonth) {
    setViewYear(newYear);
    setViewMonth(newMonth);
    const t = todayStr();
    const prefix = `${newYear}-${pad2(newMonth)}`;
    setSelectedDate(t.startsWith(prefix) ? t : `${prefix}-01`);
  }
  function prevMonth() {
    if (viewMonth === 1) gotoMonth(viewYear - 1, 12);
    else gotoMonth(viewYear, viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) gotoMonth(viewYear + 1, 1);
    else gotoMonth(viewYear, viewMonth + 1);
  }

  const bookingsByDate = useMemo(() => {
    const map = {};
    bookings.forEach((b) => { (map[b.date] = map[b.date] || []).push(b); });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (slotsSortKey(a) - slotsSortKey(b)) || (a.timeStart || '').localeCompare(b.timeStart || ''))
    );
    return map;
  }, [bookings]);

  const selectedDayItems = bookingsByDate[selectedDate] || [];

  const sortedDraft = useMemo(() => {
    return [...tableDraft].sort((a, b) => a.date.localeCompare(b.date) || (slotsSortKey(a) - slotsSortKey(b)));
  }, [tableDraft]);
  const isDirty = useMemo(() => JSON.stringify(tableDraft) !== JSON.stringify(bookings), [tableDraft, bookings]);

  const monthGroups = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonth)}`;
    return Object.keys(bookingsByDate)
      .filter((d) => d.startsWith(prefix))
      .sort()
      .map((date) => ({ date, items: bookingsByDate[date] }));
  }, [bookingsByDate, viewYear, viewMonth]);

  const pendingActive = pending.filter((p) => p.status === 'pending').sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const pendingHistory = pending.filter((p) => p.status !== 'pending');

  const hostNames = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      getHostsList(b).forEach((h) => { if (h.name) set.add(h.name); });
      if (b.category === 'rentOut' && b.personName) set.add(b.personName);
    });
    return Array.from(set);
  }, [bookings]);

  const hostMatches = useMemo(() => {
    if (!hostQuery.trim()) return null;
    const q = hostQuery.trim().toLowerCase();
    const matched = bookings.filter((b) => {
      const hostHit = getHostsList(b).some((h) => (h.name || '').toLowerCase().includes(q));
      const partnerHit = b.category === 'rentOut' && (b.personName || '').toLowerCase().includes(q);
      return hostHit || partnerHit;
    });
    const t = todayStr();
    const upcoming = matched.filter((b) => b.date >= t).sort((a, b) => a.date.localeCompare(b.date) || slotsSortKey(a) - slotsSortKey(b));
    const past = matched.filter((b) => b.date < t).sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming, past };
  }, [hostQuery, bookings]);

  const isUnlocked = !!(unlockedFor && hostQuery.trim() && unlockedFor === hostQuery.trim());

  const actualHostNames = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      getHostsList(b).forEach((h) => { if (h.name) set.add(h.name); });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [bookings]);

  const hostOverviewData = useMemo(() => {
    const t = todayStr();
    const map = {};
    actualHostNames.forEach((name) => {
      const matched = bookings.filter((b) => getHostsList(b).some((h) => (h.name || '') === name));
      const upcoming = matched.filter((b) => b.date >= t).sort((a, b) => a.date.localeCompare(b.date) || slotsSortKey(a) - slotsSortKey(b));
      const past = matched.filter((b) => b.date < t).sort((a, b) => b.date.localeCompare(a.date));
      map[name] = { upcoming, past };
    });
    return map;
  }, [actualHostNames, bookings]);

  function tryUnlock() {
    const key = hostQuery.trim();
    const stored = staffDirectory[key];
    if (stored !== undefined && stored === pwInput) {
      setUnlockedFor(key);
      setPwError(false);
      setPwInput('');
    } else {
      setPwError(true);
    }
  }

  const allKnownNames = useMemo(() => {
    const set = new Set();
    bookings.forEach((b) => {
      getHostsList(b).forEach((h) => { if (h.name) set.add(h.name.trim()); });
      if (b.category === 'rentOut' && b.personName) set.add(b.personName.trim());
    });
    Object.keys(staffDirectory).forEach((n) => set.add(n));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [bookings, staffDirectory]);

  const financeBookings = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonth)}`;
    return bookings.filter((b) => b.category === 'rentOut' && b.date && b.date.startsWith(prefix));
  }, [bookings, viewYear, viewMonth]);

  const financeGroups = useMemo(() => {
    const map = {};
    financeBookings.forEach((b) => {
      const key = b.personName || '未具名';
      if (!map[key]) map[key] = { items: [], total: 0, paid: 0, unpaid: 0 };
      const fee = computeFee(b);
      map[key].items.push({ ...b, fee });
      map[key].total += fee;
      if (b.paymentStatus === 'paid') map[key].paid += fee; else map[key].unpaid += fee;
    });
    Object.values(map).forEach((g) => g.items.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [financeBookings]);

  const financeOverall = useMemo(() => {
    let total = 0, paid = 0, unpaid = 0;
    Object.values(financeGroups).forEach((g) => { total += g.total; paid += g.paid; unpaid += g.unpaid; });
    return { total, paid, unpaid };
  }, [financeGroups]);

  const hostWageBookings = useMemo(() => {
    const prefix = `${viewYear}-${pad2(viewMonth)}`;
    return bookings.filter((b) => b.category !== 'rentOut' && b.date && b.date.startsWith(prefix));
  }, [bookings, viewYear, viewMonth]);

  const hostWageGroups = useMemo(() => {
    const map = {};
    hostWageBookings.forEach((b) => {
      getHostsList(b).forEach((h) => {
        if (!h.name) return;
        const wage = Number(h.wage) || 0;
        const key = h.name.trim();
        if (!map[key]) map[key] = { items: [], total: 0, paid: 0, unpaid: 0 };
        map[key].items.push({ booking: b, host: h, wage });
        map[key].total += wage;
        if (h.wagePaid === 'paid') map[key].paid += wage; else map[key].unpaid += wage;
      });
    });
    Object.values(map).forEach((g) => g.items.sort((a, b) => a.booking.date.localeCompare(b.booking.date)));
    return map;
  }, [hostWageBookings]);

  const hostWageOverall = useMemo(() => {
    let total = 0, paid = 0, unpaid = 0;
    Object.values(hostWageGroups).forEach((g) => { total += g.total; paid += g.paid; unpaid += g.unpaid; });
    return { total, paid, unpaid };
  }, [hostWageGroups]);

  function csvEscape(val) {
    const s = String(val === undefined || val === null ? '' : val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportFinanceCsv() {
    const rows = [['類別', '對象', '日期', '劇本/活動', '包廂或場地', '金額', '狀態']];

    Object.keys(financeGroups).sort((a, b) => a.localeCompare(b, 'zh-Hant')).forEach((name) => {
      const g = financeGroups[name];
      g.items.forEach((item) => {
        const roomLabel = item.category === 'borrowed' ? item.venueName : ((rooms.find((r) => r.id === item.roomId) || {}).code || '');
        rows.push(['出租收入', name, item.date, item.activityName, roomLabel, item.fee, item.paymentStatus === 'paid' ? '已收款' : '未收款']);
      });
      rows.push(['出租收入', name, '', '小計', '', g.total, '']);
    });

    Object.keys(hostWageGroups).sort((a, b) => a.localeCompare(b, 'zh-Hant')).forEach((name) => {
      const g = hostWageGroups[name];
      g.items.forEach(({ booking: b, host: h, wage }) => {
        const roomLabel = b.category === 'borrowed' ? b.venueName : ((rooms.find((r) => r.id === b.roomId) || {}).code || '');
        rows.push(['主持人薪資', name, b.date, b.activityName, roomLabel, wage, h.wagePaid === 'paid' ? '已給付' : '未給付']);
      });
      rows.push(['主持人薪資', name, '', '小計', '', g.total, '']);
    });

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `財務報表_${viewYear}-${pad2(viewMonth)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const reminderItems = useMemo(() => {
    const t = todayStr();
    const result = [];
    bookings.forEach((b) => {
      if (b.category === 'rentOut') return;
      if (b.date < t) return;
      const days = daysBetween(b.date, t);
      if (days > 7) return;
      getHostsList(b).forEach((h) => {
        if (!h.name) return;
        result.push({ booking: b, host: h, daysUntil: days });
      });
    });
    result.sort((a, b) => a.daysUntil - b.daysUntil);
    return result;
  }, [bookings]);
  const nightList = reminderItems.filter((r) => r.daysUntil <= 1);
  const weekList = reminderItems.filter((r) => r.daysUntil >= 2 && r.daysUntil <= 7);

  const tabs = [
    { key: 'overview', label: '總覽', Icon: CalendarDays },
    { key: 'request', label: '我要租場', Icon: Send },
    { key: 'host', label: '主持人查詢', Icon: Search },
    { key: 'feedback', label: '帶場回饋', Icon: MessageSquare },
  ];
  if (adminUnlocked) {
    tabs.push({ key: 'pending', label: '待確認', Icon: Inbox, badge: pendingActive.length });
    tabs.push({ key: 'hostOverview', label: '主持人總覽', Icon: Users });
    tabs.push({ key: 'finance', label: '金額總覽', Icon: Wallet });
    tabs.push({ key: 'staff', label: '人員密碼', Icon: Key });
    tabs.push({ key: 'reminders', label: '提醒清單', Icon: Bell, badge: nightList.length });
    tabs.push({ key: 'import', label: '新增場次', Icon: Upload });
    tabs.push({ key: 'texts', label: '頁面文字', Icon: FileText });
  }

  if (loading) {
    return (
      <div className="booth-app">
        <style>{baseStyles}</style>
        <div className="loading-screen">載入中…</div>
      </div>
    );
  }

  return (
    <div className="booth-app">
      <style>{baseStyles}</style>

      <header className="header">
        <div className="header-top">
          <div>
            <h1 className="app-title"><Flower2 size={18} /> <span>包廂預約管理</span></h1>
            <div className="subtitle">沙拉嘿喲 · 場次管理系統 </div>
          </div>
          <div className="lock-area">
            {adminUnlocked ? (
              <button type="button" className="lock-btn unlocked" onClick={handleLock}>
                <Unlock size={14} /> 管理者模式
              </button>
            ) : showPinBox ? (
              <div className="pin-box">
                <input
                  type="email"
                  placeholder="管理員 Email"
                  value={adminEmail}
                  onChange={(e) => { setAdminEmail(e.target.value); setAdminLoginError(''); }}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="管理員密碼"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock(); }}
                />
                <button type="button" className="btn-primary small" onClick={handleUnlock}>登入</button>
                {adminLoginError && <span className="pin-error">{adminLoginError}</span>}
              </div>
            ) : (
              <button type="button" className="lock-btn" onClick={() => setShowPinBox(true)}>
                <Lock size={14} /> 管理者解鎖
              </button>
            )}
          </div>
        </div>
        <div className="header-divider" />
      </header>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.Icon size={15} />
            {t.label}
            {!!t.badge && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'overview' && (
          <section>
            {getText('overview_hint') && <p className="hint">{getText('overview_hint')}</p>}
            <MonthNav year={viewYear} month={viewMonth} onPrev={prevMonth} onNext={nextMonth} />
            <CategoryLegend />

            <div className="view-toggle">
              <button type="button" className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>月曆檢視</button>
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>列表檢視</button>
              {adminUnlocked && (
                <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>表格編輯</button>
              )}
            </div>

            {viewMode === 'calendar' ? (
              <>
                <MonthCalendarGrid
                  year={viewYear}
                  month={viewMonth}
                  bookingsByDate={bookingsByDate}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />

                <div className="day-detail">
                  <div className="date-heading">{formatDateShort(selectedDate)}</div>

                  {adminUnlocked && (
                    <button type="button" className="btn-primary add-btn" onClick={openAdd}>
                      <Plus size={16} /> 新增這天的場次
                    </button>
                  )}

                  {selectedDayItems.length === 0 && (
                    <div className="empty-state small">
                      <Inbox size={24} />
                      <p>這天沒有場次</p>
                    </div>
                  )}

                  {selectedDayItems.map((b) => (
                    <SessionCard
                      key={b.id}
                      booking={b}
                      rooms={rooms}
                      adminUnlocked={adminUnlocked}
                      showMoney={adminUnlocked}
                      onEdit={openEdit}
                      onDeleteAsk={setConfirmDeleteId}
                      onTogglePay={togglePayment}
                      onToggleHostWage={toggleHostWage}
                      confirmingDelete={confirmDeleteId === b.id}
                      onConfirmDelete={handleDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </div>
              </>
            ) : viewMode === 'list' ? (
              <div className="list-view">
                {adminUnlocked && (
                  <button type="button" className="btn-primary add-btn" onClick={openAdd}>
                    <Plus size={16} /> 新增場次
                  </button>
                )}

                {monthGroups.length === 0 && (
                  <div className="empty-state">
                    <Inbox size={28} />
                    <p>這個月還沒有場次</p>
                  </div>
                )}

                {monthGroups.map((group) => (
                  <div key={group.date} className="date-group">
                    <div className="date-heading">{formatDateShort(group.date)}</div>
                    {group.items.map((b) => (
                      <SessionCard
                        key={b.id}
                        booking={b}
                        rooms={rooms}
                        adminUnlocked={adminUnlocked}
                        showMoney={adminUnlocked}
                        onEdit={openEdit}
                        onDeleteAsk={setConfirmDeleteId}
                        onTogglePay={togglePayment}
                        onToggleHostWage={toggleHostWage}
                        confirmingDelete={confirmDeleteId === b.id}
                        onConfirmDelete={handleDelete}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="table-view">
                <p className="hint small">這裡列出所有場次（不限當月），可以直接點欄位編輯，新增/刪除整列，或按筆形圖示開啟完整編輯視窗（填主持人薪水、租金算法等）。← 表格較寬，可以左右滑動查看更多欄位。</p>
                <div className="table-scroll">
                  <table className="edit-table">
                    <thead>
                      <tr>
                        <th>日期</th><th>時段</th><th>開始時間</th><th>結束時間</th><th>類型</th><th>包廂/場地</th><th>活動／劇本名稱</th>
                        <th>預約人</th><th>主持人／對方主持人</th><th>金額</th><th>收款</th><th>備註</th><th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDraft.map((b) => (
                        <tr key={b.id}>
                          <td><input type="date" value={b.date} onChange={(e) => updateDraftField(b.id, 'date', e.target.value)} /></td>
                          <td>
                            <div className="table-slot-toggle">
                              {SLOTS.map((s) => (
                                <button
                                  type="button"
                                  key={s.key}
                                  className={`slot-mini-btn ${getSlotsList(b).includes(s.key) ? 'active' : ''}`}
                                  onClick={() => toggleDraftSlot(b.id, s.key)}
                                >
                                  {s.key}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td><input type="time" value={b.timeStart || ''} onChange={(e) => updateDraftField(b.id, 'timeStart', e.target.value)} /></td>
                          <td><input type="time" value={b.timeEnd || ''} onChange={(e) => updateDraftField(b.id, 'timeEnd', e.target.value)} /></td>
                          <td>
                            <select value={b.category} onChange={(e) => updateDraftField(b.id, 'category', e.target.value)}>
                              {Object.entries(CATEGORY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <input
                              key={b.id + b.category + '-room'}
                              type="text"
                              defaultValue={roomOrVenueText(b)}
                              onBlur={(e) => updateDraftRoomOrVenue(b.id, e.target.value)}
                              placeholder={b.category === 'borrowed' ? '場地名稱' : '包廂代碼'}
                            />
                          </td>
                          <td><input type="text" value={b.activityName} onChange={(e) => updateDraftField(b.id, 'activityName', e.target.value)} /></td>
                          <td><input type="text" value={b.personName} onChange={(e) => updateDraftField(b.id, 'personName', e.target.value)} /></td>
                          <td>
                            <input
                              key={b.id + b.category + '-hosts'}
                              type="text"
                              defaultValue={hostsToText(b)}
                              onBlur={(e) => updateDraftHostsText(b.id, e.target.value)}
                              placeholder="姓名:角色:薪水"
                            />
                          </td>
                          <td><input type="number" value={amountValue(b)} onChange={(e) => updateDraftAmount(b.id, e.target.value)} /></td>
                          <td>
                            <select value={b.paymentStatus} onChange={(e) => updateDraftField(b.id, 'paymentStatus', e.target.value)}>
                              <option value="unpaid">未收</option>
                              <option value="paid">已收</option>
                            </select>
                          </td>
                          <td><input type="text" value={b.notes} onChange={(e) => updateDraftField(b.id, 'notes', e.target.value)} /></td>
                          <td className="table-actions">
                            <button type="button" className="icon-btn" onClick={() => openEdit(b)} aria-label="完整編輯"><Pencil size={14} /></button>
                            {confirmDeleteId === b.id ? (
                              <>
                                <button type="button" className="icon-btn danger" onClick={() => deleteTableRow(b.id)}><Check size={14} /></button>
                                <button type="button" className="icon-btn" onClick={() => setConfirmDeleteId(null)}><X size={14} /></button>
                              </>
                            ) : (
                              <button type="button" className="icon-btn danger-outline" onClick={() => setConfirmDeleteId(b.id)} aria-label="刪除"><Trash2 size={14} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer-actions">
                  <button type="button" className="btn-ghost small" onClick={addTableRow}><Plus size={13} /> 新增一列</button>
                  <button type="button" className="btn-primary" onClick={saveTableChanges}>
                    {isDirty ? '儲存所有變更' : '已儲存'}
                  </button>
                </div>
              </div>
            )}

            {adminUnlocked && (
              <div className="reset-row">
                {confirmReset ? (
                  <div className="confirm-inline">
                    <span>確定要重置為示範資料？這會覆蓋目前所有場次、申請、回饋與密碼設定。</span>
                    <button type="button" className="btn-ghost small" onClick={() => setConfirmReset(false)}>取消</button>
                    <button type="button" className="btn-danger small" onClick={doReset}>確定重置</button>
                  </div>
                ) : (
                  <button type="button" className="btn-ghost small" onClick={() => setConfirmReset(true)}>
                    <RotateCcw size={13} /> 重置為示範資料
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'request' && (
          <section className="request-section">
            <h2>租場申請</h2>
            {getText('request_hint') && <p className="hint">{getText('request_hint')}</p>}

            {reqSubmitted ? (
              <div className="success-banner">
                <Check size={18} />
                <div>
                  <div>申請已送出，請等待場地方確認後通知您。</div>
                  <button type="button" className="btn-ghost small" onClick={resetReqForm}>再送一筆申請</button>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="field">
                  <label>姓名／團隊名稱</label>
                  <input type="text" value={reqForm.partnerName} onChange={(e) => setReqForm({ ...reqForm, partnerName: e.target.value })} />
                </div>
                <div className="field">
                  <label>聯絡方式（LINE ID／電話）</label>
                  <input type="text" value={reqForm.contact} onChange={(e) => setReqForm({ ...reqForm, contact: e.target.value })} />
                </div>
                <div className="field">
                  <label>想要的日期</label>
                  <input type="date" value={reqForm.preferredDate} onChange={(e) => setReqForm({ ...reqForm, preferredDate: e.target.value })} />
                </div>
                <div className="field">
                  <label>想要的時段</label>
                  <select value={reqForm.preferredSlot} onChange={(e) => setReqForm({ ...reqForm, preferredSlot: e.target.value })}>
                    {SLOTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>開始時間</label>
                  <input type="time" value={reqForm.preferredTimeStart} onChange={(e) => setReqForm({ ...reqForm, preferredTimeStart: e.target.value })} />
                </div>
                <div className="field">
                  <label>結束時間</label>
                  <input type="time" value={reqForm.preferredTimeEnd} onChange={(e) => setReqForm({ ...reqForm, preferredTimeEnd: e.target.value })} />
                </div>
                <div className="field span2">
                  <label>想要的包廂（不指定可留空）</label>
                  <select value={reqForm.preferredRoomId} onChange={(e) => setReqForm({ ...reqForm, preferredRoomId: e.target.value })}>
                    <option value="">不指定</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}．{r.name}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>活動／劇本名稱</label>
                  <input type="text" value={reqForm.activityName} onChange={(e) => setReqForm({ ...reqForm, activityName: e.target.value })} />
                </div>
                <div className="field">
                  <label>預估時長（小時，選填）</label>
                  <input type="number" value={reqForm.estimatedHours} onChange={(e) => setReqForm({ ...reqForm, estimatedHours: e.target.value })} />
                </div>
                <div className="field span2">
                  <label>備註（選填）</label>
                  <textarea rows={2} value={reqForm.notes} onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })} />
                </div>
                {reqError && <div className="field span2"><div className="form-error">{reqError}</div></div>}
                <div className="field span2">
                  <button type="button" className="btn-primary wide" onClick={submitRequest}>
                    <Send size={15} /> 送出申請
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'host' && (
          <section>
            <h2>主持人查詢</h2>
            {getText('host_hint') && <p className="hint">{getText('host_hint')}</p>}
            <div className="host-search">
              <Search size={16} />
              <select
                value={hostQuery}
                onChange={(e) => {
                  setHostQuery(e.target.value);
                  setPwInput('');
                  setPwError(false);
                  setUnlockedFor(null);
                }}
              >
                <option value="">請選擇主持人</option>
                {hostNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {!hostMatches && <div className="empty-state"><User size={28} /><p>輸入姓名後會顯示您的場次</p></div>}

            {hostMatches && (
              <>
                {!isUnlocked ? (
                  <div className="pw-gate">
                    {staffDirectory[hostQuery.trim()] === undefined ? (
                      <p className="pw-hint">管理者尚未設定您的查詢密碼，請聯絡管理者協助設定後才能查看場次與金額。</p>
                    ) : (
                      <div className="pw-row">
                        <input
                          type="password"
                          placeholder="輸入您的查詢密碼"
                          value={pwInput}
                          onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
                        />
                        <button type="button" className="btn-primary small" onClick={tryUnlock}>解鎖查看場次</button>
                        {pwError && <span className="pw-error">密碼錯誤</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="sub-heading">即將到來（{hostMatches.upcoming.length}）</div>
                    {hostMatches.upcoming.length === 0 && <div className="empty-state small">目前沒有即將到來的場次</div>}
                    {hostMatches.upcoming.map((b) => (
                      <SessionCard
                        key={b.id} booking={b} rooms={rooms} adminUnlocked={false}
                        showMoney={isUnlocked} viewerName={hostQuery.trim()}
                        onEdit={() => {}} onDeleteAsk={() => {}} onTogglePay={() => {}} onToggleHostWage={() => {}}
                      />
                    ))}

                    <button type="button" className="btn-ghost small" onClick={() => setShowPast((s) => !s)}>
                      {showPast ? '隱藏' : '顯示'}過去場次（{hostMatches.past.length}）
                    </button>
                    {showPast && hostMatches.past.map((b) => (
                      <SessionCard
                        key={b.id} booking={b} rooms={rooms} adminUnlocked={false}
                        showMoney={isUnlocked} viewerName={hostQuery.trim()}
                        onEdit={() => {}} onDeleteAsk={() => {}} onTogglePay={() => {}} onToggleHostWage={() => {}}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'feedback' && (
          <section>
            <h2>帶場回饋</h2>
            {getText('feedback_hint') && <p className="hint">{getText('feedback_hint')}</p>}

            {adminUnlocked && feedbackList.length > 0 && (
              <div className="feedback-admin-list">
                <div className="sub-heading">收到的回饋（{feedbackList.filter((f) => f.status === 'new').length} 筆未處理）</div>
                {feedbackList.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).map((f) => (
                  <div className={`feedback-card ${f.status === 'resolved' ? 'resolved' : ''}`} key={f.id}>
                    <div className="feedback-head">
                      <span className="feedback-type-badge">{f.feedbackType}</span>
                      <span className="feedback-from">{f.hostName}{f.activityName ? ` · ${f.activityName}` : ''}</span>
                    </div>
                    <div className="feedback-content">{f.content}</div>
                    <div className="feedback-foot">
                      <span className="feedback-time">
                        {new Date(f.submittedAt).toLocaleString('zh-Hant-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button
                        type="button"
                        className={f.status === 'resolved' ? 'btn-ghost small' : 'btn-primary small'}
                        onClick={() => toggleFeedbackStatus(f.id)}
                      >
                        {f.status === 'resolved' ? '標示為未處理' : '標示已處理'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {feedbackSubmitted ? (
              <div className="success-banner">
                <Check size={18} />
                <div>
                  <div>回饋已送出，謝謝你！</div>
                  <button type="button" className="btn-ghost small" onClick={resetFeedbackForm}>再送一筆回饋</button>
                </div>
              </div>
            ) : (
              <div className="form-grid">
                <div className="field">
                  <label>您的姓名</label>
                  <input type="text" value={feedbackForm.hostName} onChange={(e) => setFeedbackForm({ ...feedbackForm, hostName: e.target.value })} />
                </div>
                <div className="field">
                  <label>劇本／場次名稱（選填）</label>
                  <input type="text" value={feedbackForm.activityName} onChange={(e) => setFeedbackForm({ ...feedbackForm, activityName: e.target.value })} />
                </div>
                <div className="field span2">
                  <label>回饋類型</label>
                  <select value={feedbackForm.feedbackType} onChange={(e) => setFeedbackForm({ ...feedbackForm, feedbackType: e.target.value })}>
                    {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>回饋內容</label>
                  <textarea rows={3} placeholder="例如：結局信封不夠了、某個道具壞了、想加印新的線索卡⋯" value={feedbackForm.content} onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })} />
                </div>
                <div className="field span2">
                  <button type="button" className="btn-primary wide" onClick={submitFeedback}>
                    <Send size={15} /> 送出回饋
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'pending' && adminUnlocked && (
          <section>
            <h2>待確認申請</h2>
            {getText('pending_hint') && <p className="hint">{getText('pending_hint')}</p>}
            {pendingActive.length === 0 && <div className="empty-state"><Inbox size={28} /><p>目前沒有待確認的申請</p></div>}
            {pendingActive.map((req) => (
              <div key={req.id} className="ticket pending-card" style={{ borderLeftColor: '#C97A52' }}>
                <div className="ticket-row">
                  <div className="slot-time"><SlotIcon slot={req.preferredSlot} /> {formatDateShort(req.preferredDate)} {req.preferredTimeStart}～{req.preferredTimeEnd}</div>
                  <span className="submitted-at">送出時間：{new Date(req.submittedAt).toLocaleString('zh-Hant-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="activity-name">{req.activityName || '（未填活動名稱）'}</div>
                <div className="person-line"><User size={13} /><span>申請人：{req.partnerName}</span></div>
                <div className="person-line"><User size={13} /><span>聯絡方式：{req.contact}</span></div>
                {req.preferredRoomId && <div className="person-line">想要的包廂：{(rooms.find((r) => r.id === req.preferredRoomId) || {}).code}．{(rooms.find((r) => r.id === req.preferredRoomId) || {}).name}</div>}
                {req.estimatedHours && <div className="person-line">預估時長：{req.estimatedHours} 小時</div>}
                {req.notes && <div className="notes-line">備註：{req.notes}</div>}

                <div className="ticket-footer">
                  {confirmRejectId === req.id ? (
                    <div className="confirm-inline">
                      <span>確定拒絕此申請？</span>
                      <button type="button" className="btn-ghost small" onClick={() => setConfirmRejectId(null)}>取消</button>
                      <button type="button" className="btn-danger small" onClick={() => handleReject(req.id)}>確定拒絕</button>
                    </div>
                  ) : (
                    <div className="ticket-actions">
                      <button type="button" className="btn-primary small" onClick={() => openApprove(req)}>核准並填入場次</button>
                      <button type="button" className="btn-ghost small" onClick={() => setConfirmRejectId(req.id)}>拒絕</button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pendingHistory.length > 0 && (
              <details className="history-block">
                <summary>歷史紀錄（{pendingHistory.length}）</summary>
                {pendingHistory.map((req) => (
                  <div key={req.id} className="history-row">
                    <span>{req.partnerName}・{req.activityName}</span>
                    <span className={`history-status ${req.status}`}>{req.status === 'approved' ? '已核准' : '已拒絕'}</span>
                  </div>
                ))}
              </details>
            )}
          </section>
        )}

        {tab === 'hostOverview' && adminUnlocked && (
          <section>
            <h2>主持人總覽</h2>
            <p className="hint">不需要密碼，這裡可以一次看到每位主持人／NPC的所有場次，點開姓名就能展開，金額也可以直接在這裡切換已給付狀態。</p>

            {actualHostNames.length === 0 && (
              <div className="empty-state"><Users size={28} /><p>目前還沒有任何主持人紀錄</p></div>
            )}

            <button type="button" className="btn-ghost small" onClick={() => setHostOverviewShowPast((s) => !s)}>
              {hostOverviewShowPast ? '隱藏' : '顯示'}所有人的過去場次
            </button>

            {actualHostNames.map((name) => {
              const data = hostOverviewData[name] || { upcoming: [], past: [] };
              return (
                <details key={name} className="host-overview-block">
                  <summary>{name}（即將到來 {data.upcoming.length} 筆{hostOverviewShowPast ? `，過去 ${data.past.length} 筆` : ''}）</summary>
                  {data.upcoming.length === 0 && <div className="empty-state small">目前沒有即將到來的場次</div>}
                  {data.upcoming.map((b) => (
                    <SessionCard
                      key={b.id} booking={b} rooms={rooms} adminUnlocked
                      showMoney viewerName={name}
                      onEdit={openEdit} onDeleteAsk={setConfirmDeleteId}
                      onTogglePay={togglePayment} onToggleHostWage={toggleHostWage}
                      confirmingDelete={confirmDeleteId === b.id}
                      onConfirmDelete={handleDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                  {hostOverviewShowPast && data.past.map((b) => (
                    <SessionCard
                      key={b.id} booking={b} rooms={rooms} adminUnlocked
                      showMoney viewerName={name}
                      onEdit={openEdit} onDeleteAsk={setConfirmDeleteId}
                      onTogglePay={togglePayment} onToggleHostWage={toggleHostWage}
                      confirmingDelete={confirmDeleteId === b.id}
                      onConfirmDelete={handleDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </details>
              );
            })}
          </section>
        )}

        {tab === 'finance' && adminUnlocked && (
          <section>
            <h2>租場金額總覽</h2>
            {getText('finance_hint') && <p className="hint">{getText('finance_hint')}</p>}
            <MonthNav year={viewYear} month={viewMonth} onPrev={prevMonth} onNext={nextMonth} />

            <button type="button" className="btn-ghost wide export-btn" onClick={exportFinanceCsv}>
              <Download size={15} /> 匯出本月財務報表（CSV，含出租收入＋主持人薪資）
            </button>

            <div className="sub-heading">出租收入－依夥伴／單位統計</div>
            <div className="stat-row">
              <div className="stat-box">
                <div className="stat-label">本月應收合計</div>
                <div className="stat-value">{formatMoney(financeOverall.total)}</div>
              </div>
              <div className="stat-box paid">
                <div className="stat-label">已收</div>
                <div className="stat-value">{formatMoney(financeOverall.paid)}</div>
              </div>
              <div className="stat-box unpaid">
                <div className="stat-label">未收</div>
                <div className="stat-value">{formatMoney(financeOverall.unpaid)}</div>
              </div>
            </div>

            {Object.keys(financeGroups).length === 0 && (
              <div className="empty-state"><Wallet size={28} /><p>這個月沒有出租場次</p></div>
            )}

            {Object.entries(financeGroups)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([name, g]) => (
                <div key={name} className="finance-group">
                  <div className="finance-group-head">
                    <span className="finance-name">{name}</span>
                    <span className="finance-subtotal">{formatMoney(g.total)}</span>
                  </div>
                  {g.items.map((item) => (
                    <div key={item.id} className="finance-row">
                      <div className="finance-row-left">
                        <span className="finance-date">{formatDateShort(item.date)}</span>
                        <span className="finance-activity">{item.activityName}</span>
                      </div>
                      <div className="finance-row-right">
                        <span className="finance-fee">{formatMoney(item.fee)}</span>
                        <PaymentChip status={item.paymentStatus} clickable onClick={() => togglePayment(item.id)} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            <div className="sub-heading">主持人薪資－依個人統計</div>
            <div className="stat-row">
              <div className="stat-box">
                <div className="stat-label">本月應付合計</div>
                <div className="stat-value">{formatMoney(hostWageOverall.total)}</div>
              </div>
              <div className="stat-box paid">
                <div className="stat-label">已給付</div>
                <div className="stat-value">{formatMoney(hostWageOverall.paid)}</div>
              </div>
              <div className="stat-box unpaid">
                <div className="stat-label">未給付</div>
                <div className="stat-value">{formatMoney(hostWageOverall.unpaid)}</div>
              </div>
            </div>

            {Object.keys(hostWageGroups).length === 0 && (
              <div className="empty-state"><Wallet size={28} /><p>這個月沒有主持人薪資紀錄</p></div>
            )}

            {Object.entries(hostWageGroups)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([name, g]) => (
                <div key={name} className="finance-group">
                  <div className="finance-group-head">
                    <span className="finance-name">{name}</span>
                    <span className="finance-subtotal">{formatMoney(g.total)}</span>
                  </div>
                  {g.items.map(({ booking: b, host: h, wage }) => (
                    <div key={b.id + h.id} className="finance-row">
                      <div className="finance-row-left">
                        <span className="finance-date">{formatDateShort(b.date)}</span>
                        <span className="finance-activity">{b.activityName}{h.role ? `（${h.role}）` : ''}</span>
                      </div>
                      <div className="finance-row-right">
                        <span className="finance-fee">{formatMoney(wage)}</span>
                        <PaymentChip
                          status={h.wagePaid || 'unpaid'}
                          clickable
                          onClick={() => toggleHostWage(b.id, h.id)}
                          labels={['已給付', '未給付']}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </section>
        )}

        {tab === 'staff' && adminUnlocked && (
          <section>
            <h2>人員密碼管理</h2>
            {getText('staff_hint') && <p className="hint">{getText('staff_hint')}</p>}
            {allKnownNames.map((name) => (
              <StaffPasswordRow
                key={name}
                name={name}
                value={staffDirectory[name] || ''}
                onSave={(pw) => persistStaff({ ...staffDirectory, [name]: pw })}
                onDelete={() => {
                  const next = { ...staffDirectory };
                  delete next[name];
                  persistStaff(next);
                }}
              />
            ))}
            <AddStaffForm onAdd={(name, pw) => persistStaff({ ...staffDirectory, [name]: pw })} />
          </section>
        )}

        {tab === 'reminders' && adminUnlocked && (
          <section>
            <h2>提醒清單</h2>
            {getText('reminders_hint') && <p className="hint">{getText('reminders_hint')}</p>}

            <div className="sync-block">
              <div className="sub-heading">同步到 Google Sheet（給 LINE 自動提醒讀取，實驗功能）</div>
              <p className="hint small">
                填上你那份 LINE 提醒系統用的 Google 試算表名稱，按「立即同步」就會請 Claude 透過你已連結的 Google Drive
                自動把上面的場次資料寫進該試算表的 Bookings 工作表，不用自己再打一次。這個功能需要實際測試過才能確定有沒有成功，
                如果同步失敗或你還沒設定 Google Sheet，下面也有「下載 Bookings.csv」可以手動貼上當備用方案。
              </p>
              <div className="form-grid">
                <div className="field span2">
                  <label>Google 試算表名稱（跟 Drive 裡顯示的名稱一致）</label>
                  <input
                    type="text"
                    placeholder="例如：包廂主持人提醒系統"
                    value={syncConfig.sheetName}
                    onChange={(e) => persistSyncConfig({ ...syncConfig, sheetName: e.target.value })}
                  />
                </div>
              </div>
              <div className="sync-actions">
                <button type="button" className="btn-primary" onClick={syncToSheet} disabled={syncing}>
                  {syncing ? '同步中…' : '立即同步'}
                </button>
                <button type="button" className="btn-ghost" onClick={exportBookingsForSheet}>
                  <Download size={15} /> 下載 Bookings.csv（備用，手動貼上）
                </button>
              </div>
              {syncMessage && <div className="sync-message">{syncMessage}</div>}
              {syncConfig.lastSyncAt && (
                <div className="sync-meta">上次同步：{new Date(syncConfig.lastSyncAt).toLocaleString('zh-Hant-TW')}</div>
              )}
            </div>

            <div className="sub-heading">明天／今天要帶場（睡前提醒，{nightList.length} 筆）</div>
            {nightList.length === 0 && <div className="empty-state small">目前沒有</div>}
            {nightList.map((item) => (
              <ReminderRow
                key={`${item.booking.id}_${item.host.id}_night`}
                item={item}
                type="night"
                rooms={rooms}
                reminded={!!reminderLog[`${item.booking.id}_${item.host.id}_night`]}
                onToggle={() => persistReminderLog({ ...reminderLog, [`${item.booking.id}_${item.host.id}_night`]: !reminderLog[`${item.booking.id}_${item.host.id}_night`] })}
              />
            ))}

            <div className="sub-heading">未來七天要帶場（一週前提醒，{weekList.length} 筆）</div>
            {weekList.length === 0 && <div className="empty-state small">目前沒有</div>}
            {weekList.map((item) => (
              <ReminderRow
                key={`${item.booking.id}_${item.host.id}_week`}
                item={item}
                type="week"
                rooms={rooms}
                reminded={!!reminderLog[`${item.booking.id}_${item.host.id}_week`]}
                onToggle={() => persistReminderLog({ ...reminderLog, [`${item.booking.id}_${item.host.id}_week`]: !reminderLog[`${item.booking.id}_${item.host.id}_week`] })}
              />
            ))}
          </section>
        )}

        {tab === 'import' && adminUnlocked && (
          <section>
            <h2>新增場次</h2>
            {getText('import_hint') && <p className="hint">{getText('import_hint')}</p>}

            <div className="quick-add-form">
              <div className="field">
                <label>類型</label>
                <div className="radio-row">
                  {Object.entries(CATEGORY_META).map(([key, meta]) => (
                    <label key={key} className={`radio-pill ${quickForm.category === key ? 'active' : ''}`} style={quickForm.category === key ? { borderColor: meta.color, color: meta.color } : {}}>
                      <input type="radio" checked={quickForm.category === key} onChange={() => setQuickForm((f) => ({ ...f, category: key }))} style={{ display: 'none' }} />
                      {meta.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>日期</label>
                  <input type="date" value={quickForm.date} onChange={(e) => setQuickForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="field span2">
                  <label>時段（可複選，跨時段就多勾幾個）</label>
                  <div className="slot-checkbox-row">
                    {SLOTS.map((s) => (
                      <label key={s.key} className={`slot-check-pill ${(quickForm.slots || []).includes(s.key) ? 'active' : ''}`}>
                        <input type="checkbox" checked={(quickForm.slots || []).includes(s.key)} onChange={() => toggleQuickSlot(s.key)} style={{ display: 'none' }} />
                        <SlotIcon slot={s.key} size={14} /> {s.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>開始時間</label>
                  <input type="time" value={quickForm.timeStart} onChange={(e) => setQuickForm((f) => ({ ...f, timeStart: e.target.value }))} />
                </div>
                <div className="field">
                  <label>結束時間</label>
                  <input type="time" value={quickForm.timeEnd} onChange={(e) => setQuickForm((f) => ({ ...f, timeEnd: e.target.value }))} />
                </div>

                {quickForm.category === 'borrowed' ? (
                  <div className="field span2">
                    <label>外借場地名稱</label>
                    <input type="text" placeholder="例如：阿明的密室基地" value={quickForm.venueName} onChange={(e) => setQuickForm((f) => ({ ...f, venueName: e.target.value }))} />
                  </div>
                ) : (
                  <div className="field span2">
                    <label>包廂</label>
                    <select value={quickForm.roomId} onChange={(e) => setQuickForm((f) => ({ ...f, roomId: e.target.value }))}>
                      <option value="">請選擇</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{r.code}．{r.name}（{r.lang}）</option>)}
                    </select>
                  </div>
                )}

                <div className="field span2">
                  <label>活動／劇本名稱</label>
                  <input type="text" value={quickForm.activityName} onChange={(e) => setQuickForm((f) => ({ ...f, activityName: e.target.value }))} />
                </div>

                <div className="field">
                  <label>{quickForm.category === 'rentOut' ? '租場夥伴' : '預約人 / 顧客（可留空）'}</label>
                  <input type="text" value={quickForm.personName} onChange={(e) => setQuickForm((f) => ({ ...f, personName: e.target.value }))} />
                </div>
                <div className="field">
                  <label>收款狀態</label>
                  <select value={quickForm.paymentStatus} onChange={(e) => setQuickForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                    <option value="unpaid">未收款</option>
                    <option value="paid">已收款</option>
                  </select>
                </div>

                {quickForm.category === 'rentOut' ? (
                  <div className="field span2">
                    <label>對方主持人（選填）</label>
                    <input type="text" value={quickForm.hostNote} onChange={(e) => setQuickForm((f) => ({ ...f, hostNote: e.target.value }))} />
                  </div>
                ) : (
                  <div className="field span2">
                    <label>主持人 / NPC（點「新增人員」可加多位，各自填薪水）</label>
                    <HostsEditor hosts={quickForm.hosts} onChange={(hosts) => setQuickForm((f) => ({ ...f, hosts }))} />
                  </div>
                )}

                <div className="field span2">
                  <label>備註（選填）</label>
                  <textarea rows={2} value={quickForm.notes} onChange={(e) => setQuickForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {quickError && <div className="form-error">{quickError}</div>}

              <button type="button" className="btn-primary wide" onClick={handleAddToQueue}>
                <Plus size={15} /> 加入清單
              </button>
            </div>

            {quickQueue.length > 0 && (
              <div className="quick-queue">
                <div className="sub-heading">待新增清單（{quickQueue.length} 筆，確認後才會真正存入）</div>
                {quickQueue.map((b) => (
                  <div key={b.id} className="queue-row">
                    <span>
                      {formatDateShort(b.date)}・{slotsLabel(b)}・{b.category === 'borrowed' ? b.venueName : ((rooms.find((r) => r.id === b.roomId) || {}).code || '未選包廂')}・{b.activityName || '（未命名）'}
                    </span>
                    <button type="button" className="icon-btn danger-outline" onClick={() => removeFromQueue(b.id)} aria-label="移除"><X size={14} /></button>
                  </div>
                ))}
                <button type="button" className="btn-primary wide" onClick={handleConfirmQueue}>
                  確認新增 {quickQueue.length} 筆場次
                </button>
              </div>
            )}

            {quickDone !== null && (
              <div className="success-banner">
                <Check size={18} />
                <div>已成功新增 {quickDone} 筆場次。</div>
              </div>
            )}

            <details className="advanced-import">
              <summary>進階：用 CSV／試算表貼上批量匯入</summary>

              <div className="import-template">{IMPORT_HEADER_LINE}</div>
              {getText('import_hint2') && <p className="hint small">{getText('import_hint2')}</p>}

              <div className="field">
                <label>上傳 CSV／TXT 檔案</label>
                <input type="file" accept=".csv,.txt" onChange={handleImportFile} />
              </div>
              <div className="field">
                <label>或直接貼上資料（含標題列）</label>
                <textarea rows={6} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="第一行貼標題列，接下來每行一筆場次⋯" />
              </div>

              <button type="button" className="btn-primary" onClick={handlePreviewImport} disabled={!importText.trim()}>
                解析預覽
              </button>

              {importResult && (
                <div className="import-preview">
                  <p>
                    共 {importResult.rows.length + importResult.errors.length} 行，
                    成功解析 {importResult.rows.length} 筆，有問題 {importResult.errors.length} 筆。
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="import-errors">
                      {importResult.errors.map((e, idx) => <li key={idx}>第 {e.row} 行：{e.reason}</li>)}
                    </ul>
                  )}
                  {importResult.rows.length > 0 && (
                    <>
                      <div className="radio-row">
                        <label className={`radio-pill ${importMode === 'append' ? 'active' : ''}`}>
                          <input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} style={{ display: 'none' }} />
                          附加到現有場次
                        </label>
                        <label className={`radio-pill ${importMode === 'replace' ? 'active' : ''}`}>
                          <input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} style={{ display: 'none' }} />
                          清空後取代全部
                        </label>
                      </div>
                      <button type="button" className="btn-primary" onClick={handleConfirmImport}>
                        確認匯入 {importResult.rows.length} 筆
                      </button>
                    </>
                  )}
                </div>
              )}

              {importDone !== null && (
                <div className="success-banner">
                  <Check size={18} />
                  <div>已成功匯入 {importDone} 筆場次。</div>
                </div>
              )}
            </details>
          </section>
        )}

        {tab === 'texts' && adminUnlocked && (
          <section>
            <h2>頁面文字</h2>
            <p className="hint">這裡可以改每個分頁上方顯示給大家看的說明文字，改完按儲存就會立刻生效，留空表示不顯示。「還原預設」可以把單一段文字改回原本內建的版本。</p>
            {TEXT_FIELDS.map((f) => (
              <TextEditRow
                key={f.key}
                label={f.label}
                value={getText(f.key)}
                defaultValue={DEFAULT_TEXTS[f.key] || ''}
                onSave={(val) => persistPageTexts({ ...pageTexts, [f.key]: val })}
                onReset={() => {
                  const next = { ...pageTexts };
                  delete next[f.key];
                  persistPageTexts(next);
                }}
              />
            ))}
          </section>
        )}
      </main>

      <footer className="footer-note">
       
      </footer>

      {modal && (
        <SessionForm
          key={modal.data.id + modal.mode}
          initialData={modal.data}
          rooms={rooms}
          mode={modal.mode}
          onCancel={closeModal}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
}

/* --------------------------------- 樣式 --------------------------------- */

const baseStyles = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital@1&family=Noto+Serif+TC:wght@500;700&family=Noto+Sans+TC:wght@400;500;700&display=swap');

* { box-sizing: border-box; }
.booth-app {
  background: linear-gradient(180deg, #FCE8E6 0%, #FBF0E6 45%, #F8EEE0 100%);
  min-height: 100vh;
  color: #5B4032;
  font-family: 'Noto Sans TC', sans-serif;
  padding-bottom: 40px;
}
.loading-screen { display:flex; align-items:center; justify-content:center; height:100vh; color:#A98C7A; }

.header {
  background: rgba(255,248,242,0.85);
  padding: 18px 20px 0;
  position: relative;
  overflow: hidden;
}
.header::before, .header::after {
  content: ''; position: absolute; width: 130px; height: 130px; border-radius: 50%;
  background: radial-gradient(circle, rgba(232,150,166,0.35), transparent 70%);
  pointer-events: none;
}
.header::before { top: -55px; left: -45px; }
.header::after { top: -65px; right: -35px; }
.header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; position: relative; z-index: 1; }
.app-title {
  font-family: 'Noto Serif TC', serif;
  font-weight: 700;
  font-size: 1.3rem;
  color: #C45D72;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.app-title svg { color: #D6677C; }
.subtitle { font-size: 0.8rem; color: #A98C7A; margin-top: 2px; }
.header-divider { border-top: 1.5px dashed #E3AEB8; margin-top: 14px; position: relative; z-index: 1; }

.lock-btn {
  display: flex; align-items: center; gap: 6px;
  background: #FFFFFF; border: 1px solid #E3AEB8; color: #A0786A;
  padding: 7px 12px; border-radius: 999px; font-size: 0.82rem; cursor: pointer;
}
.lock-btn.unlocked { border-color: #D6677C; color: #D6677C; background: #FCE9EC; }
.pin-box { display: flex; align-items: center; gap: 6px; position: relative; }
.pin-box input {
  width: 90px; background: #FFFFFF; border: 1px solid #E3AEB8; border-radius: 6px;
  padding: 6px 8px; color: #5B4032; font-size: 0.85rem;
}
.pin-error { position: absolute; top: 100%; right: 0; font-size: 0.72rem; color: #C2693F; margin-top: 4px; }

.tabs {
  display: flex; gap: 8px; padding: 14px 16px; overflow-x: auto;
}
.tab-btn {
  display: flex; align-items: center; gap: 6px; white-space: nowrap;
  background: #FFFBF6; border: 1px solid #E9C9CE; color: #9C7A6A;
  padding: 8px 14px; border-radius: 999px; font-size: 0.85rem; cursor: pointer;
}
.tab-btn.active { background: #D6677C; color: #fff; border-color: #D6677C; font-weight: 700; }
.tab-badge {
  background: #C2693F; color: #fff; font-size: 0.68rem; border-radius: 999px;
  padding: 1px 6px; min-width: 16px; text-align: center;
}

.content { max-width: 720px; margin: 0 auto; padding: 8px 16px 8px; }
.content h2 { font-family: 'Noto Serif TC', serif; font-size: 1.1rem; color: #5B4032; margin: 4px 0 4px; }
.hint { color: #A98C7A; font-size: 0.85rem; margin-bottom: 14px; }

.legend-row { display: flex; gap: 14px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; color: #8A6B58; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

.view-toggle { display: flex; gap: 8px; justify-content: center; margin-bottom: 14px; }
.view-toggle button {
  background: #FFFBF6; border: 1px solid #E9C9CE; color: #9C7A6A;
  padding: 6px 14px; border-radius: 999px; font-size: 0.8rem; cursor: pointer;
}
.view-toggle button.active { background: #C45D72; color: #fff; border-color: #C45D72; font-weight: 700; }

.month-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 10px; }
.month-label { font-family: 'Noto Serif TC', serif; font-size: 1.05rem; color: #5B4032; min-width: 120px; text-align: center; }
.icon-btn {
  background: #FFFBF6; border: 1px solid #E9C9CE; color: #D6677C;
  border-radius: 8px; padding: 6px; display: flex; cursor: pointer;
}
.icon-btn.danger { background: #C2693F; border-color: #C2693F; color: #fff; }
.icon-btn.danger-outline { color: #C2693F; }

/* 月曆格 */
.cal-wrap { margin-bottom: 18px; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.cal-weekdays { margin-bottom: 4px; }
.cal-weekday { text-align: center; font-size: 0.72rem; color: #A98C7A; padding-bottom: 2px; }
.cal-cell {
  aspect-ratio: 1; border-radius: 10px; background: #FFFBF6; border: 1px solid #F0DCDF;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  padding: 4px 2px; cursor: pointer; position: relative; color: #5B4032; gap: 2px;
}
.cal-cell.empty { visibility: hidden; pointer-events: none; background: transparent; border: none; }
.cal-cell.today { border-color: #D6677C; border-width: 2px; font-weight: 700; }
.cal-cell.selected { background: #D6677C; border-color: #D6677C; color: #fff; }
.cal-day-num { font-size: 0.82rem; font-variant-numeric: tabular-nums; }
.cal-dots { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; align-items: center; }
.cal-dot { width: 6px; height: 6px; border-radius: 50%; }
.cal-more { font-size: 0.55rem; }

.day-detail { margin-top: 4px; }

.add-btn { width: 100%; justify-content: center; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: #BFA89A; padding: 36px 0; text-align: center;
}
.empty-state.small { padding: 18px 0; font-size: 0.85rem; }

.date-heading {
  font-family: 'Noto Serif TC', serif; color: #C45D72; font-size: 0.98rem;
  margin-bottom: 10px; padding-left: 8px; border-left: 3px solid #C45D72;
}

.ticket {
  background: #FFFBF6;
  color: #5B4032;
  border-left: 6px solid #6B9C7F;
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
  position: relative;
  box-shadow: 0 3px 10px rgba(196,93,114,0.14);
}
.ticket-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.slot-time { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 700; flex-wrap: wrap; }
.slot-chip { display: inline-flex; align-items: center; gap: 3px; }

.slot-checkbox-row { display: flex; gap: 8px; flex-wrap: wrap; }
.slot-check-pill {
  display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid #E9C9CE; border-radius: 999px; padding: 6px 14px;
  font-size: 0.85rem; cursor: pointer; color: #8A6B58;
}
.slot-check-pill.active { background: #D6677C; color: #fff; border-color: #D6677C; font-weight: 700; }

.table-slot-toggle { display: flex; gap: 2px; }
.slot-mini-btn {
  border: 1px solid #E9C9CE; background: #fff; color: #8A6B58; border-radius: 6px;
  padding: 3px 6px; font-size: 0.75rem; cursor: pointer; min-width: 26px;
}
.slot-mini-btn.active { background: #D6677C; color: #fff; border-color: #D6677C; font-weight: 700; }
.time-text { font-variant-numeric: tabular-nums; color: #A98C7A; font-weight: 400; }

.badge {
  color: #fff; font-size: 0.72rem; font-weight: 700; padding: 3px 10px;
  border-radius: 999px;
}

.room-tag { display: flex; align-items: baseline; gap: 6px; font-size: 0.85rem; margin-bottom: 6px; flex-wrap: wrap; }
.room-tag.muted { color: #BFA89A; }
.room-code { font-weight: 700; }
.room-name { font-family: 'Cormorant Garamond', 'Noto Serif TC', serif; font-style: italic; color: #7A5C49; }
.room-lang { color: #BFA89A; font-size: 0.78rem; }

.activity-name { font-weight: 700; font-size: 1.02rem; margin-bottom: 6px; color: #5B4032; }
.person-line { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: #8A6B58; margin-bottom: 3px; flex-wrap: wrap; }
.host-line { gap: 6px 10px; }
.host-name-role { white-space: nowrap; }
.host-wage { font-weight: 700; font-variant-numeric: tabular-nums; color: #5B4032; }
.notes-line { font-size: 0.8rem; color: #A98C7A; margin-top: 4px; font-style: italic; }

.ticket-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; flex-wrap: wrap; gap: 8px; }
.ticket-actions { display: flex; gap: 6px; align-items: center; }
.confirm-text { font-size: 0.78rem; color: #8A6B58; }
.confirm-inline { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: #8A6B58; flex-wrap: wrap; }

.pay-chip {
  display: flex; align-items: center; gap: 5px; border-radius: 999px;
  padding: 4px 10px; font-size: 0.78rem; border: 1px solid transparent; font-weight: 700;
}
.pay-dot { width: 7px; height: 7px; border-radius: 50%; }
.pay-paid { background: #E8F1EA; color: #3F7A57; }
.pay-paid .pay-dot { background: #6FAE89; }
.pay-unpaid { background: #FBE7DE; color: #B4583E; }
.pay-unpaid .pay-dot { background: #E08F6B; }

.reset-row { margin-top: 20px; text-align: center; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(91,64,50,0.45);
  display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50;
}
.modal-box {
  background: #FFF8F2; color: #5B4032; border-radius: 18px; padding: 20px;
  max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto;
  border: 1px solid #F0DCDF;
}
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-head h3 { font-family: 'Noto Serif TC', serif; margin: 0; font-size: 1.1rem; color: #C45D72; }
.modal-head .icon-btn { background: transparent; border: none; color: #5B4032; }

.field { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.75rem; color: #A98C7A; letter-spacing: 0.02em; }
.field input, .field select, .field textarea {
  background: #fff; border: 1px solid #E9C9CE; border-radius: 8px;
  padding: 8px 10px; font-size: 0.9rem; color: #5B4032; font-family: inherit;
}
.field input:focus, .field select:focus, .field textarea:focus { outline: 2px solid #D6677C; outline-offset: 1px; }

.form-grid { display: grid; grid-template-columns: 1fr; gap: 4px 14px; }
@media (min-width: 600px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .span2 { grid-column: span 2; }
}

.radio-row { display: flex; gap: 8px; flex-wrap: wrap; }
.radio-pill {
  border: 1px solid #E9C9CE; border-radius: 999px; padding: 6px 14px;
  font-size: 0.82rem; cursor: pointer; color: #8A6B58;
}
.radio-pill.active { font-weight: 700; border-width: 2px; }

.fee-block { margin-top: 4px; }
.fee-preview { background: #FBE9DC; padding: 8px 10px; border-radius: 8px; font-size: 0.9rem; }

.hosts-block label { display: block; margin-bottom: 6px; }
.host-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.host-row input {
  flex: 1; min-width: 80px; background: #fff; border: 1px solid #E9C9CE;
  border-radius: 8px; padding: 6px 8px; font-size: 0.85rem; color: #5B4032;
}

.form-error { color: #B4583E; font-size: 0.85rem; margin: 6px 0; }

.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }

.btn-primary {
  background: #D6677C; color: #fff; border: none; border-radius: 10px;
  padding: 9px 16px; font-weight: 700; font-size: 0.88rem; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.btn-primary.small { padding: 6px 12px; font-size: 0.8rem; }
.btn-primary.wide { width: 100%; justify-content: center; }
.btn-ghost.wide { width: 100%; justify-content: center; }
.export-btn { margin-bottom: 18px; }

.sync-block { background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px; padding: 14px; margin-bottom: 18px; }
.sync-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.sync-message { margin-top: 10px; padding: 8px 10px; background: #FFF3EA; border-radius: 8px; font-size: 0.85rem; color: #8A6B58; white-space: pre-wrap; }
.sync-meta { margin-top: 6px; font-size: 0.78rem; color: #A98C7A; }
.btn-ghost {
  background: transparent; border: 1px solid #C9A0A8; color: #8A6B58;
  border-radius: 10px; padding: 9px 16px; font-size: 0.88rem; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
}
.btn-ghost.small { padding: 5px 10px; font-size: 0.78rem; }
.btn-danger { background: #C2693F; color: #fff; border: none; border-radius: 10px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; }

.request-section .form-grid { background: #FFFBF6; padding: 16px; border-radius: 16px; border: 1px solid #F0DCDF; }

.success-banner {
  background: #EAF3EE; border: 1px solid #8FB39B; color: #3F7A57;
  border-radius: 12px; padding: 14px; display: flex; gap: 10px; align-items: flex-start;
}

.host-search {
  display: flex; align-items: center; gap: 8px; background: #FFFBF6;
  border: 1px solid #E9C9CE; border-radius: 12px; padding: 10px 12px; margin-bottom: 16px;
}
.host-search input { background: transparent; border: none; color: #5B4032; flex: 1; font-size: 0.9rem; }
.host-search input:focus { outline: none; }
.host-search svg { color: #A98C7A; }
.sub-heading { color: #A98C7A; font-size: 0.82rem; margin: 10px 0 8px; }

.pw-gate { background: #FFF3EA; border: 1px solid #F0DCDF; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
.pw-hint { font-size: 0.85rem; color: #A0786A; margin: 0; }
.pw-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pw-row input { background: #fff; border: 1px solid #E9C9CE; border-radius: 8px; padding: 7px 10px; font-size: 0.85rem; }
.pw-error { color: #C2693F; font-size: 0.78rem; }

.staff-row {
  display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap;
  background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 10px; padding: 8px 10px;
}
.staff-name { font-weight: 700; min-width: 80px; }
.staff-row input { flex: 1; min-width: 100px; background: #fff; border: 1px solid #E9C9CE; border-radius: 8px; padding: 6px 8px; font-size: 0.85rem; }
.add-row { background: #FFF3EA; }

.pending-card .submitted-at { font-size: 0.72rem; color: #BFA89A; }
.history-block { margin-top: 18px; color: #8A6B58; font-size: 0.85rem; }
.history-block summary { cursor: pointer; }
.history-row { display: flex; justify-content: space-between; padding: 6px 4px; border-bottom: 1px solid #F0DCDF; }
.history-status.approved { color: #3F7A57; }
.history-status.rejected { color: #C2693F; }

.stat-row { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
.stat-box { flex: 1; min-width: 110px; background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px; padding: 12px; text-align: center; }
.stat-box.paid { border-color: #6FAE89; }
.stat-box.unpaid { border-color: #E08F6B; }
.stat-label { font-size: 0.75rem; color: #A98C7A; margin-bottom: 4px; }
.stat-value { font-family: 'Noto Serif TC', serif; font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; color: #5B4032; }

.finance-group { background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.finance-group-head { display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 8px; }
.finance-subtotal { font-variant-numeric: tabular-nums; color: #C45D72; }
.finance-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-top: 1px solid #F0DCDF; gap: 10px; flex-wrap: wrap; }
.finance-row-left { display: flex; gap: 8px; font-size: 0.85rem; color: #5B4032; }
.finance-row-right { display: flex; align-items: center; gap: 10px; }
.finance-fee { font-variant-numeric: tabular-nums; font-weight: 700; }

.feedback-admin-list { margin-bottom: 22px; }
.feedback-card { background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; }
.feedback-card.resolved { opacity: 0.6; }
.feedback-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
.feedback-type-badge { background: #C97A52; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.feedback-from { font-size: 0.82rem; color: #8A6B58; }
.feedback-content { font-size: 0.9rem; color: #5B4032; margin-bottom: 8px; }
.feedback-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.feedback-time { font-size: 0.72rem; color: #BFA89A; }

.reminder-row {
  background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px;
  padding: 12px 14px; margin-bottom: 10px;
}
.reminder-info { margin-bottom: 6px; }
.reminder-name { font-weight: 700; }
.reminder-meta { font-size: 0.8rem; color: #A98C7A; }
.reminder-msg { background: #FFF3EA; border-radius: 8px; padding: 8px 10px; font-size: 0.85rem; color: #5B4032; margin-bottom: 8px; }
.reminder-actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.reminded-check { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #8A6B58; cursor: pointer; }

.import-template {
  background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 10px; padding: 10px 12px;
  font-size: 0.72rem; color: #5B4032; word-break: break-all; margin-bottom: 10px; font-family: monospace;
}
.hint.small { font-size: 0.78rem; margin-bottom: 14px; }
.import-preview { background: #FFF3EA; border: 1px solid #F0DCDF; border-radius: 12px; padding: 12px 14px; margin: 14px 0; font-size: 0.88rem; }
.import-errors { margin: 8px 0; padding-left: 18px; color: #B4583E; font-size: 0.82rem; }
.import-errors li { margin-bottom: 4px; }

.quick-add-form { background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 16px; padding: 16px; margin-bottom: 16px; }
.quick-queue { background: #FFF3EA; border: 1px solid #F0DCDF; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
.queue-row {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; font-size: 0.85rem;
}
.advanced-import { margin-top: 18px; background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px; padding: 12px 14px; }
.advanced-import summary { cursor: pointer; color: #8A6B58; font-size: 0.88rem; font-weight: 700; }
.advanced-import[open] summary { margin-bottom: 10px; }

.host-overview-block {
  background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px;
  padding: 10px 14px; margin-bottom: 10px;
}
.host-overview-block summary { cursor: pointer; color: #C45D72; font-weight: 700; font-size: 0.92rem; }
.host-overview-block[open] summary { margin-bottom: 10px; }

.table-view { margin-top: 4px; }
.table-scroll { overflow-x: auto; border: 1px solid #E9C9CE; border-radius: 12px; background: #FFFBF6; }
.edit-table { border-collapse: collapse; width: 100%; min-width: 980px; }
.edit-table th, .edit-table td { border-bottom: 1px solid #F0DCDF; padding: 6px 8px; text-align: left; font-size: 0.8rem; }
.edit-table th { color: #A98C7A; font-weight: 700; white-space: nowrap; background: #FFF3EA; }
.edit-table td input, .edit-table td select {
  width: 100%; min-width: 70px; background: #fff; border: 1px solid #E9C9CE;
  border-radius: 6px; padding: 4px 6px; font-size: 0.8rem; color: #5B4032;
}
.table-actions { display: flex; gap: 4px; align-items: center; white-space: nowrap; }
.table-footer-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; flex-wrap: wrap; gap: 10px; }

.text-edit-row {
  background: #FFFBF6; border: 1px solid #E9C9CE; border-radius: 12px;
  padding: 12px 14px; margin-bottom: 12px;
}
.text-edit-label { font-weight: 700; font-size: 0.85rem; color: #C45D72; margin-bottom: 6px; }
.text-edit-row textarea {
  width: 100%; background: #fff; border: 1px solid #E9C9CE; border-radius: 8px;
  padding: 8px 10px; font-size: 0.85rem; color: #5B4032; font-family: inherit; margin-bottom: 8px;
}
.text-edit-actions { display: flex; gap: 8px; }

.footer-note { text-align: center; color: #BFA89A; font-size: 0.72rem; padding: 20px 16px 4px; }

:focus-visible { outline: 2px solid #D6677C; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }

`;
