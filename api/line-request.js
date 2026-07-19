const { getAdmin } = require('./_firebase');

const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID || '2010754497';

function addHours(time, hours) {
  const [hour, minute] = time.split(':').map(Number);
  const total = hour * 60 + minute + Math.round(hours * 60);
  return `${String(Math.floor((total % 1440) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function slotFor(time) {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return '早';
  if (hour < 18) return '中';
  return '晚';
}

async function verifyLineIdToken(idToken) {
  const body = new URLSearchParams({ id_token: idToken, client_id: LINE_LOGIN_CHANNEL_ID });
  const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = await response.json();
  if (!response.ok || !result.sub) throw new Error('LINE_TOKEN_INVALID');
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { idToken, date, startTime, durationHours, activityName } = req.body || {};
    const duration = Number(durationHours);
    if (!idToken || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(startTime || '')) {
      return res.status(400).json({ error: '申請資料不完整' });
    }
    if (!String(activityName || '').trim() || String(activityName).trim().length > 100 || duration < 0.5 || duration > 24) {
      return res.status(400).json({ error: '活動名稱或使用時數不正確' });
    }

    const line = await verifyLineIdToken(idToken);
    const firestore = getAdmin().firestore();
    const ref = firestore.collection('applications').doc();
    const now = new Date().toISOString();
    const application = {
      id: ref.id,
      source: 'line',
      status: 'pending',
      submittedAt: now,
      partnerName: String(line.name || 'LINE 夥伴').slice(0, 100),
      contact: `LINE：${String(line.name || '已驗證使用者').slice(0, 100)}`,
      lineUserId: line.sub,
      activityName: String(activityName).trim(),
      preferredDate: date,
      preferredRoomId: '',
      preferredSlot: slotFor(startTime),
      preferredTimeStart: startTime,
      preferredTimeEnd: addHours(startTime, duration),
      estimatedHours: duration,
      notes: '',
    };
    await ref.set(application);
    return res.status(200).json({ ok: true, applicationId: ref.id });
  } catch (error) {
    console.error('LINE application failed', error);
    if (error.message === 'LINE_TOKEN_INVALID') return res.status(401).json({ error: 'LINE 登入已失效，請重新開啟頁面' });
    return res.status(500).json({ error: '目前無法送出申請，請稍後再試' });
  }
};
