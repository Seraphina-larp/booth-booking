import React, { useEffect, useMemo, useState } from 'react';
import liff from '@line/liff';
import { CalendarDays, Clock3, Flower2, Send } from 'lucide-react';

const LIFF_ID = '2010754497-onVcfQzW';

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function LineRequest() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ date: '', startTime: '', durationHours: '', activityName: '' });
  const minDate = useMemo(todayLocal, []);

  useEffect(() => {
    (async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
        setProfile(await liff.getProfile());
        setReady(true);
      } catch (err) {
        console.error(err);
        setError('LINE 身分驗證沒有完成，請從 LINE 官方帳號內重新開啟申請頁。');
      }
    })();
  }, []);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const duration = Number(form.durationHours);
    if (!form.date || !form.startTime || !form.activityName.trim() || !duration) {
      setError('請把日期、開始時間、使用時數和活動名稱填完整。');
      return;
    }
    if (form.date < minDate) {
      setError('申請日期不能早於今天。');
      return;
    }
    if (duration < 0.5 || duration > 24) {
      setError('使用時數請填 0.5～24 小時。');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/line-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, durationHours: duration, idToken: liff.getIDToken() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '申請送出失敗');
      setDone(true);
    } catch (err) {
      setError(err.message || '目前無法送出申請，請稍後再試。');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <main className="line-page">
        <section className="line-card success-card">
          <div className="success-icon">✓</div>
          <h1>已送出場次申請！</h1>
          <p>沙拉收到後會確認包廂與費用，審核完成將主動通知你 📢</p>
          <button type="button" onClick={() => liff.isInClient() ? liff.closeWindow() : window.close()}>關閉頁面</button>
        </section>
        <LineStyles />
      </main>
    );
  }

  return (
    <main className="line-page">
      <section className="line-card">
        <div className="brand"><Flower2 size={22} /> 沙拉嘿喲・私人寓所</div>
        <h1>極速申請場次</h1>
        <p className="intro">先留下最必要的資訊就好，包廂與費用會在審核時一起確認。</p>
        {profile && <div className="line-person">申請人：{profile.displayName}</div>}

        {!ready && !error ? <div className="loading">正在連接 LINE…</div> : (
          <form onSubmit={submit}>
            <label><span><CalendarDays size={16} /> 日期</span><input type="date" min={minDate} value={form.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label><span><Clock3 size={16} /> 開始時間</span><input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></label>
            <label><span>使用時數</span><input type="number" min="0.5" max="24" step="0.5" inputMode="decimal" placeholder="例如 4" value={form.durationHours} onChange={(e) => set('durationHours', e.target.value)} /></label>
            <label><span>活動名稱</span><input type="text" maxLength="100" placeholder="例如：桌遊聚會" value={form.activityName} onChange={(e) => set('activityName', e.target.value)} /></label>
            {error && <div className="line-error">{error}</div>}
            <button className="submit-button" type="submit" disabled={!ready || sending}><Send size={17} />{sending ? '送出中…' : '送出申請'}</button>
          </form>
        )}
      </section>
      <LineStyles />
    </main>
  );
}

function LineStyles() {
  return <style>{`
    *{box-sizing:border-box} body{margin:0;background:#fff4ef;color:#654d48;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","PingFang TC",sans-serif}
    .line-page{min-height:100vh;padding:22px 16px 40px;background:linear-gradient(180deg,#fff7f2 0%,#fce8e7 100%)}
    .line-card{max-width:480px;margin:0 auto;background:rgba(255,255,255,.94);border:1px solid #f1d3d4;border-radius:24px;padding:25px 20px;box-shadow:0 12px 35px rgba(150,87,92,.12)}
    .brand{display:flex;align-items:center;gap:7px;color:#ce6176;font-weight:800;font-size:14px}.line-card h1{margin:18px 0 8px;font-size:27px;color:#8f4f59}.intro{margin:0 0 16px;line-height:1.7;color:#8d7771;font-size:14px}
    .line-person{padding:10px 12px;margin:0 0 18px;border-radius:12px;background:#fff2f2;color:#a75d68;font-size:14px;font-weight:700}
    form{display:grid;gap:15px}label{display:grid;gap:7px;font-weight:700;font-size:14px}label span{display:flex;align-items:center;gap:6px}
    input{width:100%;border:1px solid #eac9ca;border-radius:12px;padding:13px 12px;background:#fff;font:inherit;color:#5f4945;outline:none}input:focus{border-color:#d56b7e;box-shadow:0 0 0 3px rgba(213,107,126,.12)}
    button{border:0;border-radius:13px;padding:14px 18px;background:#d9657b;color:#fff;font-weight:800;font-size:16px}.submit-button{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:4px}button:disabled{opacity:.55}
    .line-error{padding:10px 12px;border-radius:10px;background:#fff0ed;color:#b54e45;font-size:13px;line-height:1.5}.loading{text-align:center;padding:30px 0;color:#a58a83}
    .success-card{text-align:center;margin-top:12vh}.success-icon{width:58px;height:58px;margin:0 auto 15px;border-radius:50%;display:grid;place-items:center;background:#e57084;color:#fff;font-size:30px;font-weight:900}.success-card p{line-height:1.8;margin-bottom:22px}
  `}</style>;
}
