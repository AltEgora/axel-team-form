(function () {
  'use strict';
  var C = window.SITE_CONFIG || {};
  var BASE = C.basePath == null ? '/' : C.basePath;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Метрика ---------- */
  function goal(name, params) {
    if (C.metrikaId && typeof window.ym === 'function') {
      try { window.ym(C.metrikaId, 'reachGoal', name, params || {}); } catch (e) {}
    }
  }
  if (C.metrikaId && /^\d+$/.test(String(C.metrikaId))) {
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(C.metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-goal]');
    if (el) goal(el.getAttribute('data-goal'));
  });

  /* ---------- Контакты из config.js ---------- */
  $$('[data-phone]').forEach(function (a) { a.href = 'tel:' + (C.phoneTel || ''); });
  $$('[data-phone-text]').forEach(function (s) { s.textContent = C.phoneDisplay || ''; });
  $$('[data-production-term]').forEach(function (s) { s.textContent = C.productionTerm || ''; });
  $$('[data-hours]').forEach(function (s) { s.textContent = C.hours || ''; });
  $$('[data-manager-name]').forEach(function (s) { if (C.managerName) s.textContent = ' · ' + C.managerName; });
  $$('[data-main-site]').forEach(function (a) { if (C.mainSite) a.href = C.mainSite; });

  var ICONS = {
    telegram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 3.5L2.8 10.7c-.8.3-.8 1.4 0 1.7l4.6 1.6 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.5 4.7 3.5c.6.4 1.4.1 1.6-.6l3.2-15.4c.2-.9-.6-1.6-1.4-1.3z"/><path d="M7.4 14l10.1-7.2-7.9 8.9"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 20.5l1.3-4.4A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.2c.2-.4.6-.4.8 0l.7 1.5c.1.3 0 .6-.2.8l-.5.5c.6 1.3 1.6 2.3 2.9 2.9l.5-.5c.2-.2.5-.3.8-.2l1.5.7c.4.2.4.6 0 .8-.6.6-1.4.9-2.2.7-2.4-.6-4.3-2.5-4.9-4.9-.2-.8.1-1.7.6-2.3z"/></svg>',
    max: '<span class="msg__max">MAX</span>'
  };
  var NAMES = { telegram: 'Telegram', whatsapp: 'WhatsApp', max: 'MAX' };
  $$('[data-messengers]').forEach(function (box) {
    var labels = box.hasAttribute('data-labels');
    ['telegram', 'whatsapp', 'max'].forEach(function (k) {
      if (!C[k]) return;
      var a = document.createElement('a');
      a.className = 'msg msg--' + k;
      a.href = C[k]; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('data-goal', k + '_click');
      a.setAttribute('aria-label', 'Написать в ' + NAMES[k]);
      a.innerHTML = (k === 'max' && labels) ? '' : ICONS[k];
      if (labels) a.insertAdjacentText('beforeend', (k === 'max' ? '' : ' ') + NAMES[k]);
      box.appendChild(a);
    });
  });

  /* ---------- Персонализация: ?club=Название ---------- */
  var params = new URLSearchParams(location.search);
  var club = (params.get('club') || '').trim().slice(0, 80);
  if (club) {
    var eb = $('[data-club-eyebrow]');
    if (eb) eb.textContent = 'Предложение для клуба «' + club + '»';
    var ci = $('[data-club-input]');
    if (ci) ci.value = club;
    document.title = 'Командная форма для клуба «' + club + '» — Аксель·НН';
  }

  /* ---------- Галерея ---------- */
  var DATA = { categories: [], works: [] };
  var picked = [];
  try { picked = JSON.parse(sessionStorage.getItem('picked') || '[]'); } catch (e) { picked = []; }

  var vCats = $('[data-view="categories"]');
  var vGal = $('[data-view="gallery"]');

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  function renderCats() {
    var box = $('[data-cats]');
    box.innerHTML = DATA.categories.map(function (c) {
      var n = DATA.works.filter(function (w) { return w.category === c.id; }).length;
      return '<a class="cat" href="#' + esc(c.id) + '">' +
        '<span class="cat__icon"><img src="' + BASE + esc(c.icon) + '" alt="" width="74" height="74"></span>' +
        '<span class="cat__title">' + esc(c.title) + '</span>' +
        '<span class="cat__count">' + n + ' ' + plural(n, ['работа', 'работы', 'работ']) + '</span>' +
        '<span class="link-arrow">Смотреть <svg width="30" height="8" viewBox="0 0 56 8" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M0 4h51M48 1l5 3-5 3"/></svg></span>' +
        '</a>';
    }).join('');
    $('[data-cat-tabs]').innerHTML = DATA.categories.map(function (c) {
      return '<a class="cat-tab" role="tab" href="#' + esc(c.id) + '" data-tab="' + esc(c.id) + '">' + esc(c.title) + '</a>';
    }).join('');
  }

  function plural(n, f) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return f[0];
    if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return f[1];
    return f[2];
  }

  function renderGallery(catId) {
    var cat = DATA.categories.filter(function (c) { return c.id === catId; })[0];
    if (!cat) return false;
    $('[data-gallery-title]').textContent = cat.title;
    $$('[data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === catId)); });
    var works = DATA.works.filter(function (w) { return w.category === catId; });
    $('[data-works]').innerHTML = works.map(function (w) {
      var on = picked.indexOf(w.id) !== -1;
      var media = w.photo
        ? '<img class="work__photo" src="' + BASE + esc(w.photo) + '" alt="Работа №' + w.id + (w.club ? ', ' + esc(w.club) : '') + '" loading="lazy">'
        : '<span class="work__ph"><img src="' + BASE + esc(cat.icon) + '" alt=""><span>Фото работы</span></span>';
      return '<article class="work' + (on ? ' is-picked' : '') + '" data-work="' + w.id + '">' +
        '<button type="button" class="work__media" ' + (w.photo ? 'data-zoom' : 'tabindex="-1"') + ' aria-label="Открыть фото работы №' + w.id + '">' + media +
        '<span class="work__num">Работа №' + w.id + '</span></button>' +
        '<div class="work__body">' +
        '<span class="work__club">' + esc(w.club || '[Клуб / команда]') + '</span>' +
        '<span class="work__details">' + esc(w.details || '[Цвета, нанесение, кол-во]') + '</span>' +
        '<button type="button" class="work__pick" aria-pressed="' + on + '" data-pick="' + w.id + '">' + (on ? 'Выбрано' : 'Хочу так же') + '</button>' +
        '</div></article>';
    }).join('');
    return true;
  }

  function route(fromClick) {
    var m = location.hash.match(/^#([\w-]+)$/);
    if (m && m[1] !== 'works' && renderGallery(m[1])) {
      vCats.hidden = true; vGal.hidden = false;
      goal('category_open', { category: m[1] });
      if (fromClick) $('#works').scrollIntoView({ behavior: 'smooth' });
    } else if (!vGal.hidden && location.hash === '#works') {
      vGal.hidden = true; vCats.hidden = false;
    }
  }
  window.addEventListener('hashchange', function () { route(true); });

  /* Выбор работ */
  function syncPicked() {
    picked.sort(function (a, b) { return a - b; });
    try { sessionStorage.setItem('picked', JSON.stringify(picked)); } catch (e) {}
    var bar = $('[data-picked]');
    var list = picked.map(function (n) { return '№' + n; }).join(', ');
    bar.hidden = picked.length === 0;
    $('[data-picked-list]').textContent = list;
    var inp = $('[data-works-input]');
    if (inp && !inp.dataset.touched) inp.value = list;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (!b) return;
    var id = Number(b.getAttribute('data-pick'));
    var i = picked.indexOf(id);
    if (i === -1) { picked.push(id); goal('work_pick', { work: id }); } else picked.splice(i, 1);
    var on = i === -1;
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Выбрано' : 'Хочу так же';
    b.closest('.work').classList.toggle('is-picked', on);
    syncPicked();
  });
  var worksInput = $('[data-works-input]');
  if (worksInput) worksInput.addEventListener('input', function () { worksInput.dataset.touched = '1'; });

  /* Просмотр фото */
  var lb = $('[data-lightbox]');
  document.addEventListener('click', function (e) {
    var z = e.target.closest('[data-zoom]');
    if (z) {
      var img = z.querySelector('img.work__photo');
      var card = z.closest('.work');
      $('[data-lightbox-img]').src = img.src;
      $('[data-lightbox-cap]').textContent = $('.work__num', card).textContent + ' · ' + $('.work__club', card).textContent + ' · ' + $('.work__details', card).textContent;
      lb.hidden = false; document.body.style.overflow = 'hidden';
      return;
    }
    if (e.target.closest('[data-lightbox-close]') || e.target === lb) closeLb();
  });
  function closeLb() { lb.hidden = true; document.body.style.overflow = ''; }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

  fetch(BASE + 'data/works.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) { DATA = d; renderCats(); route(false); syncPicked(); })
    .catch(function () { $('[data-cats]').innerHTML = '<p>Не удалось загрузить работы. Обновите страницу.</p>'; });

  /* ---------- Нижняя панель: прячем, когда видна форма ---------- */
  var dock = $('[data-dock]');
  if ('IntersectionObserver' in window && dock) {
    new IntersectionObserver(function (en) {
      dock.classList.toggle('is-hidden', en[0].isIntersecting);
    }, { threshold: 0.15 }).observe($('#lead'));
  }

  /* ---------- Форма заявки: проверка полей ---------- */
  var form = $('[data-form]');
  var errBox = $('[data-form-error]');
  function showErr(msg) { errBox.textContent = msg; errBox.hidden = !msg; }

  var LETTERS = 'A-Za-zА-Яа-яЁё';
  var reName = new RegExp('^[' + LETTERS + '][' + LETTERS + " '\\-]*$");
  var reCity = new RegExp('^[' + LETTERS + '][' + LETTERS + " .\\-()]*$");
  var reClub = new RegExp('^[0-9' + LETTERS + ' «»"\'.,№()\\-–—&+!/:]+$');
  var reHasLetterOrDigit = new RegExp('[0-9' + LETTERS + ']');
  var clean = function (v) { return String(v || '').replace(/\s+/g, ' ').trim(); };

  // Телефон: 11 цифр, начинается на 7 или 8 (или 10 цифр, начиная с 9) -> +7XXXXXXXXXX
  function phoneDigits(v) {
    var d = String(v || '').replace(/\D/g, '');
    // в поле уже стоит +7, а человек по привычке набрал 8 9XX… — восьмёрку убираем
    if (d.length === 12 && d.slice(0, 2) === '78') d = '7' + d.slice(2);
    if (d.charAt(0) === '8') d = '7' + d.slice(1);
    else if (d.charAt(0) === '9') d = '7' + d;
    else if (d && d.charAt(0) !== '7') d = '7' + d;
    return d.slice(0, 11);
  }
  function formatPhone(d) {
    if (!d) return '';
    var r = '+7';
    if (d.length > 1) r += ' (' + d.slice(1, 4);
    if (d.length >= 4) r += ')';
    if (d.length > 4) r += ' ' + d.slice(4, 7);
    if (d.length > 7) r += '-' + d.slice(7, 9);
    if (d.length > 9) r += '-' + d.slice(9, 11);
    return r;
  }
  function todayISO(addYears) {
    var t = new Date(); t.setFullYear(t.getFullYear() + (addYears || 0));
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function parseWorks(v) {
    var s = clean(v);
    if (!s) return { ok: true, list: [] };
    if (!/^[\d\s,;№#.и]+$/.test(s)) return { ok: false, msg: 'Укажите номера работ цифрами через запятую, например: 5, 7' };
    var nums = (s.match(/\d+/g) || []).map(Number).filter(function (n, i, a) { return a.indexOf(n) === i; });
    var known = DATA.works.map(function (w) { return Number(w.id); });
    var unknown = known.length ? nums.filter(function (n) { return known.indexOf(n) === -1; }) : [];
    if (unknown.length) return { ok: false, msg: 'Таких работ нет: №' + unknown.join(', №') + '. Номера есть на карточках в галерее.' };
    if (nums.length > 20) return { ok: false, msg: 'Укажите не больше 20 работ' };
    return { ok: true, list: nums.sort(function (a, b) { return a - b; }) };
  }

  // Правила: функция возвращает текст ошибки или ''
  var RULES = {
    name: function (v) {
      v = clean(v);
      if (!v) return 'Укажите имя';
      if (v.length < 2) return 'Имя слишком короткое';
      if (v.length > 50) return 'Не больше 50 символов';
      if (!reName.test(v)) return 'Только буквы, пробел и дефис';
      return '';
    },
    phone: function (v) {
      var d = phoneDigits(v);
      if (!d) return 'Укажите телефон';
      if (/[^\d+\s()\-]/.test(v)) return 'Только цифры и +';
      if (d.length !== 11) return 'Номер должен содержать 11 цифр: +7 и ещё 10';
      if ('3489'.indexOf(d.charAt(1)) === -1) return 'Проверьте код: после +7 номер начинается на 3, 4, 8 или 9';
      return '';
    },
    club: function (v) {
      v = clean(v);
      if (!v) return '';
      if (v.length > 100) return 'Не больше 100 символов';
      if (!reClub.test(v) || !reHasLetterOrDigit.test(v)) return 'Название содержит недопустимые символы';
      return '';
    },
    city: function (v) {
      v = clean(v);
      if (!v) return '';
      if (v.length < 2 || v.length > 50) return 'От 2 до 50 символов';
      if (!reCity.test(v)) return 'Только буквы, пробел, дефис и точка';
      return '';
    },
    athletes: function (v) {
      v = clean(v);
      if (!v) return '';
      if (!/^\d+$/.test(v)) return 'Укажите число';
      var n = Number(v);
      if (n < 1 || n > 500) return 'От 1 до 500 человек';
      return '';
    },
    deadline: function (v) {
      if (!v) return '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Выберите дату в календаре';
      if (v < todayISO()) return 'Дата уже прошла';
      if (v > todayISO(2)) return 'Слишком далёкая дата';
      return '';
    },
    works: function (v) { var r = parseWorks(v); return r.ok ? '' : r.msg; },
    comment: function (v) { return clean(v).length > 1000 ? 'Не больше 1000 символов' : ''; }
  };

  function setFieldError(name, msg) {
    var box = $('[data-field="' + name + '"]', form);
    if (!box) return;
    var e = $('[data-error]', box);
    var input = form.elements[name];
    box.classList.toggle('is-invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    e.textContent = msg; e.hidden = !msg;
  }
  function check(name) { var msg = RULES[name](form.elements[name].value); setFieldError(name, msg); return !msg; }

  // Маска телефона
  var phone = form.elements.phone, prevDigits = '';
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 ('; });
  phone.addEventListener('blur', function () { if (phoneDigits(phone.value).length <= 1) phone.value = ''; });
  // набирать можно только + и цифры (вставку чистит обработчик paste)
  phone.addEventListener('beforeinput', function (e) {
    if (e.data && e.inputType !== 'insertFromPaste' && /[^+\d]/.test(e.data)) e.preventDefault();
  });
  phone.addEventListener('input', function (e) {
    var d = phoneDigits(phone.value);
    // стёрли скобку или дефис — убираем и цифру перед ним
    if (e.inputType === 'deleteContentBackward' && d === prevDigits) d = d.slice(0, -1);
    phone.value = d.length <= 1 && e.inputType && e.inputType.indexOf('delete') === 0 ? '' : formatPhone(d);
    prevDigits = d;
  });
  phone.addEventListener('paste', function () { setTimeout(function () { var d = phoneDigits(phone.value); phone.value = formatPhone(d); prevDigits = d; }, 0); });

  // Число спортсменов — только цифры
  var athletes = form.elements.athletes;
  athletes.addEventListener('input', function () { athletes.value = athletes.value.replace(/\D/g, '').slice(0, 3); });

  // Дата — не раньше сегодня
  form.elements.deadline.min = todayISO();
  form.elements.deadline.max = todayISO(2);

  // Проверяем поле, когда из него ушли, и сразу при исправлении.
  // Если ушли кликом, подсказку показываем после клика: иначе форма сдвинется
  // и клик (например, по галочке согласия) попадёт мимо.
  var pointerDown = false, queued = [];
  function flushQueued() { var q = queued; queued = []; q.forEach(check); }
  document.addEventListener('pointerdown', function () { pointerDown = true; }, true);
  document.addEventListener('pointerup', function () { pointerDown = false; setTimeout(flushQueued, 0); }, true);
  document.addEventListener('pointercancel', function () { pointerDown = false; setTimeout(flushQueued, 0); }, true);
  Object.keys(RULES).forEach(function (name) {
    var el = form.elements[name];
    el.addEventListener('blur', function () {
      if (!el.value) return;
      if (pointerDown) { if (queued.indexOf(name) === -1) queued.push(name); } else check(name);
    });
    el.addEventListener('input', function () { if (el.closest('.field').classList.contains('is-invalid')) check(name); });
    el.addEventListener('change', function () { if (el.type === 'date') check(name); });
  });
  form.elements.consent.addEventListener('change', function () {
    form.elements.consent.closest('.consent').classList.toggle('is-invalid', !form.elements.consent.checked);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showErr('');
    var bad = Object.keys(RULES).filter(function (n) { return !check(n); });
    var consentOk = form.elements.consent.checked;
    form.elements.consent.closest('.consent').classList.toggle('is-invalid', !consentOk);
    if (bad.length) {
      showErr(bad.length === 1 ? 'Проверьте выделенное поле.' : 'Проверьте выделенные поля.');
      form.elements[bad[0]].focus();
      return;
    }
    if (!consentOk) { showErr('Нужно согласие на обработку персональных данных.'); return; }

    var f = form.elements;
    var works = parseWorks(f.works.value).list;
    var dl = f.deadline.value;
    var payload = {
      name: clean(f.name.value), phone: formatPhone(phoneDigits(f.phone.value)), club: clean(f.club.value),
      city: clean(f.city.value), athletes: clean(f.athletes.value),
      deadline: dl ? dl.split('-').reverse().join('.') : '',
      works: works.map(function (n) { return '№' + n; }).join(', '),
      comment: String(f.comment.value || '').trim(), website: f.website.value,
      offerClub: club, page: location.href
    };
    if (C.previewMode) {
      showErr('Это предпросмотр: здесь заявка не отправляется. На сервере она придёт в Telegram.');
      return;
    }
    var btn = $('[data-submit]');
    btn.disabled = true;
    fetch(C.leadEndpoint || '/api/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 422 && j.field && RULES[j.field]) { setFieldError(j.field, j.message || 'Проверьте поле'); throw new Error('field'); }
        if (r.status === 429) throw new Error('rate');
        if (!r.ok || !j.ok) throw new Error(j.error || 'send');
      });
    }).then(function () {
      goal('form_submit');
      form.hidden = true; $('[data-form-done]').hidden = false;
      picked = []; syncPicked(); $$('.work.is-picked').forEach(function (w) { w.classList.remove('is-picked'); });
    }).catch(function (err) {
      if (err.message === 'field') showErr('Проверьте выделенное поле.');
      else if (err.message === 'rate') showErr('Слишком много заявок подряд. Попробуйте через 10 минут или позвоните: ' + (C.phoneDisplay || ''));
      else showErr('Не получилось отправить заявку. Позвоните нам: ' + (C.phoneDisplay || '') + ' или напишите в мессенджер.');
    }).then(function () { btn.disabled = false; });
  });
})();
