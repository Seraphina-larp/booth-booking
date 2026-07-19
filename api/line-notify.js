const { getAdmin, requireAdmin } = require('./_firebase');

function money(value) {
  return `NT$ ${Number(value || 0).toLocaleString('zh-TW')}`;
}

async function pushLine(userId, text) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN_MISSING');
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE_PUSH_FAILED:${response.status}:${detail}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const { applicationId, outcome, booking, reason } = req.body || {};
    if (!applicationId || !['approved', 'rejected'].includes(outcome)) {
      return res.status(400).json({ error: '通知資料不完整' });
    }
    const ref = getAdmin().firestore().collection('applications').doc(applicationId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ error: '找不到這筆申請' });
    const application = snapshot.data();
    if (!application.lineUserId) return res.status(200).json({ ok: true, skipped: true });

    let text;
    if (outcome === 'approved') {
      text = [
        '你的場次申請已通過 🎉',
        '',
        `日期：${booking.date}`,
        `時間：${booking.timeStart}～${booking.timeEnd}`,
        `活動：${booking.activityName}`,
        `包廂：${booking.roomLabel}`,
        `場地費：${money(booking.fee)}`,
        '',
        '場次資訊已加入私人寓所行事曆，如需調整請直接回覆訊息聯絡沙拉。',
      ].join('\n');
    } else {
      text = [
        '這次的場次申請暫時無法通過 🙏',
        '',
        `活動：${application.activityName || ''}`,
        `申請日期：${application.preferredDate || ''}`,
        `原因：${String(reason || '其他安排因素')}`,
        '',
        '如果想更換日期或調整內容，可以直接回覆訊息聯絡沙拉。',
      ].join('\n');
    }
    await pushLine(application.lineUserId, text);
    await ref.set({
      lineNotificationStatus: 'sent',
      lineNotifiedAt: new Date().toISOString(),
      ...(outcome === 'rejected' ? { rejectionReason: String(reason || '') } : {}),
    }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('LINE notification failed', error);
    if (['AUTH_REQUIRED', 'ADMIN_REQUIRED'].includes(error.message)) return res.status(403).json({ error: '沒有管理者權限' });
    return res.status(500).json({ error: '場次已處理，但 LINE 通知傳送失敗' });
  }
};
