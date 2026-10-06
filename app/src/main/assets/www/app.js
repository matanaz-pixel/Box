// BOX — ממשק. כל הלוגיקה של ההמלצות והבטיחות נמצאת ב-engine.js ובקבצי data/.
(function () {
'use strict';
const E = window.BoxEngine;
const KEY2 = 'box.v2', KEY1 = 'box.v1';
const GOALS = [['⏱️', 'מהיר', 'speed'], ['❤️', 'שיאכלו', 'eat'], ['🥦', 'תזונה טובה', 'nutrition'], ['💰', 'חסכוני', 'budget'], ['❄️', 'הכנה מראש', 'prep'], ['🔄', 'גיוון', 'variety']];
const PREFS = [['🍝', 'פסטה'], ['🐟', 'טונה'], ['🥒', 'מלפפון'], ['🥚', 'ביצה'], ['🌽', 'תירס'], ['🫒', 'זיתים'], ['🧀', 'גבינה'], ['🍇', 'ענבים'], ['🍠', 'בטטה'], ['🍗', 'עוף'], ['🍚', 'אורז'], ['🍓', 'תותים']];
const FOODS = [['🥚', 'ביצים'], ['🧀', 'גבינה'], ['🍝', 'פסטה'], ['🥒', 'מלפפון'], ['🍇', 'ענבים'], ['🌽', 'תירס'], ['🫘', 'שעועית'], ['🍠', 'בטטה'], ['🐟', 'טונה'], ['🫓', 'פיתה'], ['🍞', 'לחם'], ['🍚', 'אורז'], ['🥕', 'גזר'], ['🥛', 'יוגורט'], ['🍗', 'עוף'], ['🍎', 'תפוח']];
const BOXES = [[1, '▯', 'תא אחד'], [3, '▯▯▯', '3 תאים'], [4, '▯▯▯▯', '4 תאים']];
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
const TAGS = { frozen: '🧊 מהמקפיא', nocook: '🚫🔥 בלי בישול', prep: '⏲️ מכינים מראש' };

// ---------- state ----------
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function newChild(name) { return { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name || '', birth: '', likes: [], blocked: [], box: 3, goals: [] }; }
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function migrate() {
  const base = { v: 2, children: [], activeId: null, history: {}, today: {}, weeks: {} };
  try {
    const o = JSON.parse(lsGet(KEY1));
    if (o && o.onboarded) {
      const c = newChild(o.name || 'הילד/ה');
      if (Array.isArray(o.likes)) c.likes = o.likes.map(String);
      if (Array.isArray(o.blocked)) c.blocked = o.blocked.map(String);
      c.box = [1, 3, 4].indexOf(o.box) >= 0 ? o.box : 3;
      c.goals = (o.goals || []).map(g => { const m = GOALS.find(x => x[1] === g); return m ? m[2] : g === 'שהיא תאכל' ? 'eat' : null; }).filter(Boolean);
      base.children.push(c); base.activeId = c.id;
    }
  } catch (e) {}
  return base;
}
function load() {
  try { const st = JSON.parse(lsGet(KEY2)); if (st && st.v === 2 && Array.isArray(st.children)) return st; } catch (e) {}
  return migrate();
}
let state = load();
function save() { lsSet(KEY2, JSON.stringify(state)); }
function child() { return state.children.find(c => c.id === state.activeId) || state.children[0] || null; }
function getRecipe(id) { return window.BOX_RECIPES.find(r => r.id === id) || null; }

// ---------- recommendations glue ----------
function recsFor(c, seed, extra) { return E.recommend(c, Object.assign({ seed: seed, history: state.history[c.id] || [] }, extra || {})); }

function ensureToday(c) {
  const d = ymd(new Date());
  let t = state.today[c.id];
  if (!t || t.d !== d) t = state.today[c.id] = { d: d, salt: 0, rid: null, done: false };
  const recs = recsFor(c, c.id + '|' + d + '|' + t.salt);
  let e = recs.find(x => x.recipe.id === t.rid);
  if (!e) { e = recs[0] || null; t.rid = e ? e.recipe.id : null; t.done = false; save(); }
  return { t: t, e: e, recs: recs };
}
function weekKey() { const n = new Date(); return ymd(new Date(n.getFullYear(), n.getMonth(), n.getDate() - n.getDay())); }
function replacement(c, w, i) {
  w.sw = (w.sw || 0) + 1;
  const others = w.days.filter((x, j) => j !== i && x);
  const recs = recsFor(c, c.id + '|' + w.wk + '|' + w.salt + '|r' + w.sw + '|' + i, { exclude: others.concat(w.days[i] ? [w.days[i]] : []), planned: others.map(r => ({ ago: 1, r: r })) });
  return recs[0] ? recs[0].recipe.id : null;
}
function ensureWeek(c) {
  const wk = weekKey();
  let w = state.weeks[c.id];
  if (!w || w.wk !== wk) w = state.weeks[c.id] = { wk: wk, salt: 0, sw: 0, days: null };
  let dirty = false;
  if (!w.days) { w.days = E.buildWeek(c, { seed: c.id + '|' + wk + '|' + w.salt, history: state.history[c.id] || [] }, 5).map(p => p ? p.recipe.id : null); dirty = true; }
  w.days.forEach((rid, i) => { // כל רינדור מאמת מחדש מול החסימות והגיל הנוכחיים
    const r = rid && getRecipe(rid);
    if (!r || !E.check(c, r, {}).ok) { w.days[i] = replacement(c, w, i); dirty = true; }
  });
  if (dirty) save();
  return w;
}

// ---------- views ----------
const views = {};
function show(id) {
  if (!state.children.length && id !== 'onboard') { openOnboard(null, 1); return; }
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.body.classList.toggle('ob', id === 'onboard');
  if (views[id]) views[id]();
  renderBadge();
  scrollTo(0, 0);
}
function activeView() { return document.querySelector('.view.active').id; }
function renderAll() { const v = activeView(); if (views[v]) views[v](); renderBadge(); }
function renderBadge() { const c = child(); document.getElementById('childBadge').textContent = c ? '🧒 ' + c.name : '🧒'; }
function toast(t) { const x = document.getElementById('toast'); x.textContent = t; x.style.display = 'block'; clearTimeout(window.tt); window.tt = setTimeout(() => x.style.display = 'none', 2600); }

function serveHtml(serve) {
  if (!serve || !serve.length) return '';
  return '<div class="safe">🔪 <b>הוראות הגשה לגיל</b>' + serve.map(s => '<br>• <b>' + esc(s.item) + ':</b> ' + esc(s.notes.join(' · '))).join('') + '</div>';
}
function ageWarn(c) { return E.effAge(c).assumed ? '<div class="warn">לא הוזן תאריך לידה. מוצגות הוראות הגשה לגיל שנתיים (שמרני). <a href="#" onclick="openOnboard(\'' + esc(c.id) + '\',1);return false">הזינו תאריך</a></div>' : ''; }
function pills(r) { return '<div class="pills"><span class="pill">⏱️ ' + r.time + ' דקות</span>' + r.tags.filter(t => TAGS[t]).map(t => '<span class="pill">' + TAGS[t] + '</span>').join('') + '</div>'; }

views.home = function () {
  const c = child(), el = document.getElementById('home');
  const { t, e, recs } = ensureToday(c);
  let h = '<p class="muted">בוקר טוב 👋</p><h1>הקופסה של ' + esc(c.name) + '</h1>' + ageWarn(c);
  if (!e) {
    h += '<div class="card"><h2>לא נמצאה מנה מתאימה</h2><p class="muted">החסימות, הגיל או סוג הקופסה מסננים את כל המנות במאגר. בדקו את החסימות בפרופיל.</p><button class="ghost" onclick="show(\'profile\')">לפרופיל</button></div>';
    el.innerHTML = h; return;
  }
  const r = e.recipe;
  h += '<div class="card"><div class="photo">' + esc(r.emoji) + '</div><h2>' + esc(r.name) + '</h2>' +
    '<p class="muted">' + r.items.map(i => esc(i.n)).join(' · ') + '</p>' + pills(r) +
    '<p class="muted">' + e.why.slice(0, 2).map(esc).join('<br>') + '</p>' + serveHtml(e.serve) +
    (t.done ? '<div class="pills"><span class="pill">✅ הוכנה היום</span></div>' : '') +
    '<div class="stack"><button class="primary" onclick="show(\'prepare\')">' + (t.done ? 'לצפייה בהכנה' : 'מתחילים להכין') + '</button>' +
    '<button onclick="openModal()">↻ החלף משהו</button><button onclick="show(\'build\')">🆘 בנה לי ממה שיש</button></div></div>';
  const more = recs.filter(x => x.recipe.id !== r.id).slice(0, 2);
  if (more.length) h += '<div class="card"><h2>✨ עוד רעיונות</h2><div class="grid">' + more.map(x => '<button class="choice" onclick="setToday(\'' + x.recipe.id + '\')"><strong>' + esc(x.recipe.emoji) + '</strong>' + esc(x.recipe.name) + '</button>').join('') + '</div></div>';
  el.innerHTML = h;
};
function setToday(rid) { const c = child(); const t = ensureToday(c).t; t.rid = rid; t.done = false; save(); closeModal(); show('home'); toast('הוחלף ✓'); }
function openModal() {
  const c = child(), { t, recs } = ensureToday(c);
  const alts = recs.filter(x => x.recipe.id !== t.rid).slice(0, 5);
  document.getElementById('altList').innerHTML = alts.length ? alts.map(x => '<button class="alt" onclick="setToday(\'' + x.recipe.id + '\')">' + esc(x.recipe.emoji) + ' ' + esc(x.recipe.name) + '<small>' + esc(x.why[0]) + ' · ' + x.recipe.time + ' דק׳</small></button>').join('') : '<p class="muted">אין חלופות מתאימות.</p>';
  document.getElementById('modal').style.display = 'flex';
}
function closeModal() { document.getElementById('modal').style.display = 'none'; }

views.prepare = function () {
  const c = child(), el = document.getElementById('prepare'), { t, e } = ensureToday(c);
  if (!e) { el.innerHTML = '<h1>מכינים את הקופסה</h1><div class="card"><p class="muted">אין מנה מתאימה כרגע.</p></div>'; return; }
  const r = e.recipe, notesOf = n => (e.serve.find(s => s.item === n) || { notes: [] }).notes;
  const stepText = it => it.role === 'main' ? (r.tags.indexOf('frozen') >= 0 ? 'הוציאו מהמקפיא בלילה וחממו בבוקר.' : 'הכינו מראש או חממו.') : it.role === 'side' ? 'הוסיפו לתא.' : 'שטפו וחתכו.';
  el.innerHTML = '<h1>מכינים את הקופסה</h1><p class="muted">' + esc(r.emoji + ' ' + r.name) + ' · ' + esc(c.name) + '</p>' + ageWarn(c) +
    '<div class="card" id="steps">' + r.items.map((it, k) => '<div class="step"><div class="num">' + (k + 1) + '</div><div><b>' + esc(it.n) + '</b><br><span class="muted">' + esc(stepText(it)) + '</span>' +
      notesOf(it.n).map(n => '<br><b style="color:#8a5a00">🔪 ' + esc(n) + '</b>').join('') + '</div><button onclick="stepDone(this)">✓</button></div>').join('') + '</div>' +
    '<button class="primary" onclick="finishBox()">' + (t.done ? 'הקופסה כבר סומנה ✓' : 'הקופסה מוכנה ✓') + '</button>';
};
function stepDone(b) { b.style.background = '#dff0e5'; toast('נשמר ✓'); }
function finishBox() {
  const c = child(), { t } = ensureToday(c);
  if (!t.done && t.rid) {
    const h = state.history[c.id] = state.history[c.id] || [];
    h.push({ d: ymd(new Date()), r: t.rid }); if (h.length > 60) h.splice(0, h.length - 60);
    t.done = true; save(); toast('נשמר ✓ הקופסה מוכנה');
  }
  show('home');
}

function renderGrid(id, data, selected, keyIdx) {
  document.getElementById(id).innerHTML = data.map(x => { const key = x[keyIdx == null ? 1 : keyIdx]; return '<button class="choice' + (selected.indexOf(key) >= 0 ? ' sel' : '') + '" data-v="' + esc(key) + '" onclick="this.classList.toggle(\'sel\')"><strong>' + x[0] + '</strong>' + esc(x[1]) + '</button>'; }).join('');
}
views.build = function () { renderGrid('ingredients', FOODS, []); document.getElementById('result').innerHTML = ''; document.getElementById('free').value = ''; };
function selectedIn(id) { return [...document.querySelectorAll('#' + id + ' .choice.sel')].map(x => x.dataset.v); }
function buildPantry() {
  const c = child();
  const typed = document.getElementById('free').value.split(/[,،\n]+/).map(x => x.trim()).filter(Boolean);
  const all = selectedIn('ingredients').concat(typed);
  const blocked = all.filter(x => E.blockedBy(c, { n: x, f: [], a: [] }));
  const have = all.filter(x => blocked.indexOf(x) < 0);
  const out = document.getElementById('result');
  if (blocked.length) toast('🚫 חסום ולא נכלל: ' + blocked.join(', '));
  const res = have.length ? E.fromPantry(c, have, { seed: c.id + '|p|' + have.join(','), history: state.history[c.id] || [] }).slice(0, 2) : [];
  if (!res.length) { out.innerHTML = '<div class="card"><h2>לא מצאתי התאמה</h2><p class="muted">סמנו עוד מצרכים או כתבו מה יש בבית. מצרכים חסומים לא נחשבים.</p></div>'; return; }
  out.innerHTML = res.map((x, k) => '<div class="card"><h2>' + (k ? 'אפשרות נוספת' : '💡 מצאתי משהו טוב') + '</h2><div class="photo">' + esc(x.recipe.emoji) + '</div><h2>' + esc(x.recipe.name) + '</h2>' + pills(x.recipe) +
    '<p class="muted">יש לכם: ' + esc(x.covered.join(', ')) + (x.missing.length ? '<br>חסר: ' + esc(x.missing.join(', ')) : '') + '</p>' + serveHtml(x.serve) +
    '<button class="primary" onclick="setToday(\'' + x.recipe.id + '\');show(\'prepare\')">יאללה, מכינים</button></div>').join('');
}

views.week = function () {
  const c = child(), w = ensureWeek(c), today = new Date().getDay();
  document.getElementById('weekFor').textContent = 'השבוע של ' + c.name + '. הצעה גמישה, אפשר להחליף כל יום.';
  document.getElementById('weekList').innerHTML = w.days.map((rid, i) => {
    const r = rid && getRecipe(rid), chk = r ? E.check(c, r, {}) : null;
    const body = r ? '<b>' + esc(r.emoji + ' ' + r.name) + '</b><br><span class="muted">' + r.items.map(x => esc(x.n)).join(' · ') + '</span>' +
      chk.serve.map(s => '<br><span class="small" style="color:#8a5a00">🔪 ' + esc(s.item) + ': ' + esc(s.notes.join(' · ')) + '</span>').join('') : '<b>אין מנה מתאימה</b><br><span class="muted">בדקו את החסימות</span>';
    return '<div class="weekrow"><div class="day"' + (i === today ? ' style="background:#df8c73;color:#fff"' : '') + '>' + DAYS[i] + '</div><div>' + body + '</div><button onclick="swapDay(' + i + ')">↻</button></div>';
  }).join('');
};
function swapDay(i) { const c = child(), w = ensureWeek(c); const n = replacement(c, w, i); if (!n) { toast('אין חלופה מתאימה'); return; } w.days[i] = n; save(); views.week(); toast('היום הוחלף'); }
function newWeek() { const c = child(), w = ensureWeek(c); w.salt++; w.sw = 0; w.days = null; save(); views.week(); toast('נבנה שבוע חדש ✓'); }

// ---------- profile ----------
let armedDelete = null;
views.profile = function () {
  const c = child(), cid = esc(c.id);
  document.getElementById('childChips').innerHTML = state.children.map(k => '<button class="chip' + (k.id === c.id ? ' sel' : '') + '" onclick="setActive(\'' + esc(k.id) + '\')">🧒 ' + esc(k.name) + '</button>').join('') + '<button class="chip" onclick="openOnboard(null,1)">＋ ילד/ה</button>';
  const goals = c.goals.map(g => (GOALS.find(x => x[2] === g) || ['', g])[1]);
  document.getElementById('profileBody').innerHTML = ageWarn(c) +
    '<div class="card"><h2>🧒 ' + esc(c.name) + '</h2><p class="muted">' + esc(E.ageLabel(c)) + '</p><div class="stack"><button class="ghost" onclick="openOnboard(\'' + cid + '\',1)">עריכת פרטים</button>' +
    '<button class="ghost danger" onclick="delChild(this)">' + (armedDelete === c.id ? 'לחצו שוב למחיקה' : 'מחיקת הילד/ה') + '</button></div></div>' +
    '<div class="card"><h2>❤️ אוהב/ת</h2><div class="pills">' + (c.likes.map(l => '<span class="pill">' + esc(l) + '</span>').join('') || '<span class="muted">עדיין לא נבחרו</span>') + '</div><button class="ghost" onclick="openOnboard(\'' + cid + '\',2)">עריכה</button></div>' +
    '<div class="card"><h2>🛡️ בטיחות וחסימות</h2><p class="muted">מזונות חסומים לא יוצעו בהצעות, בהחלפות, בשבוע וב"בנה ממה שיש". אפשר לחסום מזון (ביצים) או קבוצה (גלוטן, חלב, בוטנים, אגוזים, דגים, שומשום). הקשה על ✕ מסירה חסימה.</p><div class="pills" id="blockedList">' + blockedPills(c.blocked, false) + '</div><input id="blockInput2" placeholder="הוסיפו אלרגיה או חסימה"><button class="ghost" onclick="addBlock(\'blockInput2\',false)">＋ הוסף חסימה</button></div>' +
    '<div class="card"><h2>🍱 קופסה ויעדים</h2><p class="muted">' + esc((BOXES.find(b => b[0] === c.box) || [0, '', '3 תאים'])[2]) + ' · ' + (esc(goals.join(', ')) || 'ללא יעדים') + '</p><button class="ghost" onclick="openOnboard(\'' + cid + '\',4)">עריכה</button></div>' +
    '<div class="card"><p class="muted small">הכללים באפליקציה (חסימות והוראות הגשה לפי גיל) הם הנחיות כלליות לצורכי נוחות, ואינם ייעוץ רפואי או תזונתי. בכל אלרגיה או חשש יש להתייעץ עם רופא או דיאטנית.</p></div>';
};
function setActive(id) { state.activeId = id; armedDelete = null; save(); views.profile(); renderBadge(); }
function delChild(btn) {
  const c = child();
  if (armedDelete !== c.id) { armedDelete = c.id; btn.textContent = 'לחצו שוב למחיקה'; setTimeout(() => { if (armedDelete === c.id) { armedDelete = null; if (activeView() === 'profile') views.profile(); } }, 4000); return; }
  armedDelete = null;
  state.children = state.children.filter(k => k.id !== c.id);
  delete state.today[c.id]; delete state.weeks[c.id]; delete state.history[c.id];
  state.activeId = state.children[0] ? state.children[0].id : null; save();
  toast('נמחק'); show(state.children.length ? 'profile' : 'onboard');
}
function blockedPills(list, draftMode) {
  return list.map((b, i) => '<span class="pill">🚫 ' + esc(b) + ' <b onclick="removeBlock(' + i + ',' + draftMode + ')" style="cursor:pointer;padding:0 4px">✕</b></span>').join('') || '<span class="muted">אין חסימות</span>';
}
function blockList(draftMode) { return draftMode ? draft.blocked : child().blocked; }
function addBlock(inputId, draftMode) {
  const el = document.getElementById(inputId), v = el.value.trim();
  if (!v) return;
  const list = blockList(draftMode);
  if (list.some(b => b.toLowerCase() === v.toLowerCase())) { toast('כבר חסום'); return; }
  list.push(v); el.value = ''; if (!draftMode) save();
  draftMode ? (document.getElementById('obBlocked').innerHTML = blockedPills(draft.blocked, true)) : renderAll();
  toast('נחסם: ' + v);
}
function removeBlock(i, draftMode) {
  const b = blockList(draftMode).splice(i, 1)[0];
  if (!draftMode) save();
  draftMode ? (document.getElementById('obBlocked').innerHTML = blockedPills(draft.blocked, true)) : renderAll();
  toast('החסימה הוסרה: ' + b);
}

// ---------- onboarding ----------
let draft = null, editingId = null;
function openOnboard(id, step) {
  editingId = id || null;
  const base = id ? state.children.find(c => c.id === id) : null;
  draft = base ? JSON.parse(JSON.stringify(base)) : newChild('');
  document.getElementById('name').value = draft.name;
  const b = document.getElementById('birth'); b.max = ymd(new Date()); b.value = draft.birth || '';
  document.getElementById('obTitle').textContent = base ? 'פרטי ' + base.name : 'למי מכינים?';
  document.getElementById('obCancel').style.display = state.children.length ? 'block' : 'none';
  document.getElementById('obSave').style.display = base ? 'block' : 'none';
  renderGrid('prefgrid', PREFS, draft.likes);
  renderGrid('boxgrid', BOXES.map(x => [x[1], x[2], x[0]]), [draft.box], 2);
  document.querySelectorAll('#boxgrid .choice').forEach(x => x.setAttribute('onclick', 'pick(this)'));
  renderGrid('goalgrid', GOALS, draft.goals, 2);
  document.getElementById('obBlocked').innerHTML = blockedPills(draft.blocked, true);
  show('onboard'); ob(step || 1);
}
function ob(n) { for (let i = 1; i <= 5; i++) document.getElementById('ob' + i).style.display = i === n ? 'block' : 'none'; document.getElementById('bar').style.width = (n * 20) + '%'; }
function pick(el) { el.parentElement.querySelectorAll('.choice').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); }
function readDetails() {
  const name = document.getElementById('name').value.trim(), birth = document.getElementById('birth').value;
  if (!name) { toast('נא להזין שם'); return null; }
  if (!birth || isNaN(new Date(birth + 'T00:00:00').getTime()) || birth > ymd(new Date())) { toast('נא להזין תאריך לידה תקין (קובע את הוראות ההגשה)'); return null; }
  return { name: name, birth: birth };
}
function obNext(n) {
  if (n === 1) { const d = readDetails(); if (!d) return; draft.name = d.name; draft.birth = d.birth; return ob(2); }
  if (n === 2) { draft.likes = selectedIn('prefgrid'); return ob(3); }
  if (n === 3) return ob(4);
  if (n === 4) { draft.box = Number((selectedIn('boxgrid')[0]) || 3); return ob(5); }
  if (n === 5) { if (selectedIn('goalgrid').length > 3) { toast('אפשר לבחור עד 3'); return; } obFinish(); }
}
function obFinish() {
  const d = readDetails(); if (!d) return;
  const c = Object.assign({}, draft, d, { likes: selectedIn('prefgrid'), box: Number(selectedIn('boxgrid')[0] || draft.box || 3), goals: selectedIn('goalgrid').slice(0, 3) });
  if (selectedIn('goalgrid').length > 3) { toast('אפשר לבחור עד 3'); return; }
  if (editingId) { const i = state.children.findIndex(k => k.id === editingId); if (i >= 0) state.children[i] = c; }
  else { state.children.push(c); }
  state.activeId = c.id; save();
  toast('מעולה ❤️'); show(editingId ? 'profile' : 'home');
}
function obCancel() { show(state.children.length ? (editingId ? 'profile' : 'home') : 'onboard'); }

// כפתור Back של אנדרואיד: מחזיר true אם ה-web טיפל בו
window.boxBack = function () {
  if (document.getElementById('modal').style.display === 'flex') { closeModal(); return true; }
  const v = activeView();
  if (v === 'onboard') { if (state.children.length) { obCancel(); return true; } return false; }
  if (v !== 'home') { show('home'); return true; }
  return false;
};

Object.assign(window, { show, toast, openModal, closeModal, setToday, stepDone, finishBox, buildPantry, swapDay, newWeek, setActive, delChild, addBlock, removeBlock, openOnboard, ob, pick, obNext, obFinish, obCancel });
if (lsGet(KEY2) === null) save();
if (!state.children.length) openOnboard(null, 1); else show('home');
})();
