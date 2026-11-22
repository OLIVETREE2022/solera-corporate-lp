// お問い合わせフォームの送信先。Resend 経由でメールを送る。
// 必要な環境変数: RESEND_API_KEY（必須）, CONTACT_TO（任意。既定は info@olivetree-wellness.com）
const FIELDS = ['ご用件', '会社名', 'ご担当者名', 'email', '電話番号', '利用人数の目安', 'ご質問・ご要望'];
const LABELS = { email: 'メールアドレス' };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const get = (k) => String(body[k] || '').trim().slice(0, 4000);

  // 迷惑送信よけ: 人には見えない欄が埋まっていたら、送らずに完了ページへ
  if (get('_honey')) {
    res.statusCode = 303;
    res.setHeader('Location', '/thanks.html');
    return res.end();
  }
  const email = get('email');
  if (!get('会社名') || !get('ご担当者名') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('入力内容を確認してください。会社名・ご担当者名・メールアドレスは必須です。');
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('送信の設定が完了していません。お手数ですが info@olivetree-wellness.com までメールでご連絡ください。');
  }
  const rows = FIELDS.map((k) => [LABELS[k] || k, get(k)]).filter(([, v]) => v);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `<table cellpadding="8" style="border-collapse:collapse;font-size:14px">${rows
    .map(([k, v]) => `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd;white-space:nowrap">${esc(k)}</th><td style="border-bottom:1px solid #ddd">${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')}</table>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || '法人契約LP <onboarding@resend.dev>',
      to: [process.env.CONTACT_TO || 'info@olivetree-wellness.com'],
      reply_to: email,
      subject: `【法人契約LP】${get('ご用件') || 'お問い合わせ'}｜${get('会社名')}`,
      text,
      html,
    }),
  });
  if (!r.ok) {
    console.error('resend error', r.status, await r.text());
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('送信に失敗しました。お手数ですが info@olivetree-wellness.com までメールでご連絡ください。');
  }
  res.statusCode = 303;
  res.setHeader('Location', '/thanks.html');
  return res.end();
};
