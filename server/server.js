/*
 * Обработчик заявок: принимает POST /api/lead и пересылает заявку
 * в Telegram (через бота) и на почту (SMTP).
 * Запуск: node server.js   (настройки — в файле .env рядом, см. .env.example)
 * Node.js 18+.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- простая загрузка .env без зависимостей ---
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOST || '127.0.0.1';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const MAIL_TO = process.env.MAIL_TO || '';
const LOG_FILE = process.env.LEADS_LOG || path.join(__dirname, 'leads.log');

let mailer = null;
if (MAIL_TO && process.env.SMTP_HOST) {
  try {
    const nodemailer = require('nodemailer');
    mailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } catch (e) {
    console.error('nodemailer не установлен — выполните `npm install` в папке server. Почта отключена.');
  }
}

// --- защита от спама: не больше 5 заявок с одного IP за 10 минут ---
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 5;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 600000)) hits.delete(k); }, 600000).unref();

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildText(l, html) {
  const b = s => html ? `<b>${s}</b>` : s;
  const e = s => html ? escHtml(s) : s;
  const rows = [
    ['Имя', l.name], ['Телефон', l.phone], ['Клуб', l.club], ['Город', l.city],
    ['Спортсменов', l.athletes], ['Срок', l.deadline], ['Работы', l.works],
    ['Комментарий', l.comment], ['Предложение для', l.offerClub], ['Страница', l.page]
  ].filter(r => r[1]);
  return [b('Новая заявка: командная форма'), '', ...rows.map(([k, v]) => `${b(k + ':')} ${e(v)}`)].join('\n');
}

async function sendTelegram(l) {
  if (!TG_TOKEN || !TG_CHAT) return false;
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text: buildText(l, true), parse_mode: 'HTML', disable_web_page_preview: true })
  });
  if (!r.ok) throw new Error('Telegram: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return true;
}

async function sendMail(l) {
  if (!mailer) return false;
  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: MAIL_TO,
    subject: `Заявка на командную форму — ${l.club || l.name}`,
    text: buildText(l, false)
  });
  return true;
}

// --- проверка полей (дублирует проверку на сайте) ---
const L = 'A-Za-zА-Яа-яЁё';
const reName = new RegExp(`^[${L}][${L} '\\-]*$`);
const reCity = new RegExp(`^[${L}][${L} .\\-()]*$`);
const reClub = new RegExp(`^[0-9${L} «»"'.,№()\\-–—&+!/:]+$`);
let KNOWN_WORKS = null;
function knownWorks() {
  try {
    const f = path.join(__dirname, '..', 'public', 'data', 'works.json');
    const st = fs.statSync(f);
    if (!KNOWN_WORKS || KNOWN_WORKS.mtime !== st.mtimeMs) {
      KNOWN_WORKS = { mtime: st.mtimeMs, ids: JSON.parse(fs.readFileSync(f, 'utf8')).works.map(w => Number(w.id)) };
    }
    return KNOWN_WORKS.ids;
  } catch { return null; }
}
function normPhone(v) {
  let d = String(v).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10 && d[0] === '9') d = '7' + d;
  if (d.length !== 11 || d[0] !== '7' || !'3489'.includes(d[1])) return null;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
}
function validate(l) {
  l.name = l.name.replace(/\s+/g, ' ');
  if (l.name.length < 2 || !reName.test(l.name)) return ['name', 'Только буквы, пробел и дефис, от 2 символов'];
  if (/[^\d+\s()\-]/.test(l.phone)) return ['phone', 'Только цифры и +'];
  const p = normPhone(l.phone);
  if (!p) return ['phone', 'Номер должен содержать 11 цифр: +7 и ещё 10'];
  l.phone = p;
  if (l.club && (!reClub.test(l.club) || !/[0-9A-Za-zА-Яа-яЁё]/.test(l.club))) return ['club', 'Название содержит недопустимые символы'];
  if (l.city && (l.city.length < 2 || !reCity.test(l.city))) return ['city', 'Только буквы, пробел, дефис и точка'];
  if (l.athletes && (!/^\d{1,3}$/.test(l.athletes) || +l.athletes < 1 || +l.athletes > 500)) return ['athletes', 'От 1 до 500 человек'];
  if (l.deadline) {
    const m = l.deadline.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    const t = m && new Date(`${m[3]}-${m[2]}-${m[1]}T23:59:59`);
    const now = new Date(), max = new Date(); max.setFullYear(max.getFullYear() + 2);
    if (!t || isNaN(t) || t < now || t > max) return ['deadline', 'Выберите дату в календаре, не раньше сегодня'];
  }
  if (l.works) {
    if (!/^[\d\s,;№#.]+$/.test(l.works)) return ['works', 'Укажите номера работ цифрами'];
    const nums = [...new Set((l.works.match(/\d+/g) || []).map(Number))];
    const known = knownWorks();
    const unknown = known ? nums.filter(n => !known.includes(n)) : [];
    if (unknown.length) return ['works', `Таких работ нет: №${unknown.join(', №')}`];
    l.works = nums.sort((a, b) => a - b).map(n => '№' + n).join(', ');
  }
  return null;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url.split('?')[0] !== '/api/lead') return json(res, 404, { ok: false });
  const ip = (req.headers['x-real-ip'] || req.socket.remoteAddress || '').toString();
  let size = 0; const chunks = [];
  req.on('data', c => { size += c.length; if (size > 20000) { req.destroy(); } else chunks.push(c); });
  req.on('end', async () => {
    let d;
    try { d = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { ok: false, error: 'bad_json' }); }
    // ловушка для ботов: делаем вид, что всё хорошо
    if (d.website) return json(res, 200, { ok: true });
    if (tooMany(ip)) return json(res, 429, { ok: false, error: 'too_many' });

    const lead = {
      name: clip(d.name, 50), phone: clip(d.phone, 30), club: clip(d.club, 100), city: clip(d.city, 50),
      athletes: clip(d.athletes, 3), deadline: clip(d.deadline, 10), works: clip(d.works, 200),
      comment: clip(d.comment, 1000), offerClub: clip(d.offerClub, 80), page: clip(d.page, 300)
    };
    const bad = validate(lead);
    if (bad) return json(res, 422, { ok: false, error: 'validation', field: bad[0], message: bad[1] });

    // резервная копия заявки в файл — даже если Telegram и почта недоступны
    try { fs.appendFileSync(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), ...lead }) + '\n'); } catch (e) { console.error('log:', e.message); }

    const results = await Promise.allSettled([sendTelegram(lead), sendMail(lead)]);
    results.forEach(r => { if (r.status === 'rejected') console.error(r.reason && r.reason.message); });
    const delivered = results.some(r => r.status === 'fulfilled' && r.value === true);
    if (!delivered) console.error('Заявка сохранена только в', LOG_FILE, '— проверьте настройки Telegram/почты');
    json(res, 200, { ok: true });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Обработчик заявок: http://${HOST}:${PORT}/api/lead`);
  console.log(`Telegram: ${TG_TOKEN && TG_CHAT ? 'вкл' : 'выкл'}, почта: ${mailer ? 'вкл' : 'выкл'}`);
});
