import "./styles.css";
import { ApiError, api, getToken, hydratePhotos, setToken, setUnauthorizedHandler } from "./api.ts";
import { compressImage } from "./compress.ts";

type Any = Record<string, any>;
const $app = document.getElementById("app")!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const errMsg = (e: unknown) => (e instanceof ApiError ? e.messageHe : e instanceof Error ? e.message : "משהו השתבש. נסו שוב.");

const TOX: Record<string, string> = { toxic: "רעיל", mildly_toxic: "רעיל קלות", safe: "בטוח", unknown: "לא ידוע" };
const SEV: Record<string, string> = { ok: "תקין", attention: "דורש תשומת לב", urgent: "דחוף" };
const LOCATIONS = ["סלון", "מטבח", "חדר שינה", "מרפסת", "משרד", "חדר רחצה"];

let profile: Any = {};
let home: Any = {};
let scan: { mode: "identify" | "diagnose"; plantId?: string; image?: { base64: string; mime: string; dataUrl: string }; description: string; busy: boolean; error?: string; identify?: Any; diagnosis?: Any; photoId?: string; added?: boolean } = { mode: "identify", description: "", busy: false };

setUnauthorizedHandler(() => { location.hash = "#/login"; });

// ---------- ניווט ----------
function shell(active: string, html: string) {
  const tabs: [string, string, string][] = [["today", "📅", "היום"], ["jungle", "🪴", "הג'ונגל"], ["scan", "📷", "סרוק"], ["profile", "👤", "פרופיל"]];
  $app.innerHTML = `<main id="main" aria-live="polite">${html}</main>
    <nav class="bottom" aria-label="ניווט ראשי">${tabs.map(([k, ic, t]) => `<a href="#/${k}" ${k === active ? 'aria-current="page"' : ""}><span class="ic" aria-hidden="true">${ic}</span>${t}</a>`).join("")}</nav>`;
  hydratePhotos($app);
}
const loading = () => `<div class="loading" role="status">טוענים…</div>`;
const errorBox = (m: string) => `<div class="error" role="alert">${esc(m)}</div>`;

async function route() {
  const [, page = "today", arg] = (location.hash || "#/today").split("/");
  if (!getToken() && page !== "login") { location.hash = "#/login"; return; }
  try {
    if (page === "login") return viewLogin();
    if (!profile.loaded) await loadProfile();
    if (page === "today") return await viewToday();
    if (page === "jungle") return await viewJungle();
    if (page === "plant" && arg) return await viewPlant(arg);
    if (page === "scan") return viewScan();
    if (page === "profile") return await viewProfile();
    location.hash = "#/today";
  } catch (e) {
    shell(page, errorBox(errMsg(e)) + `<button class="block" data-a="retry">נסו שוב</button>`);
  }
}
async function loadProfile() {
  home = (await api("GET", "/api/profile")).home;
  profile = { loaded: true };
}
window.addEventListener("hashchange", route);

// ---------- התחברות ----------
function viewLogin(mode: "login" | "register" = "login", error = "") {
  $app.innerHTML = `<main><h1>🪴 הג'ונגל שלי</h1>
    <p class="muted">ניהול צמחי הבית: זיהוי, אבחון ותזכורות טיפול.</p>
    ${error ? errorBox(error) : ""}
    <form class="card" data-form="auth" data-mode="${mode}">
      <label for="em">אימייל</label><input id="em" name="email" type="email" autocomplete="email" required dir="ltr" />
      <label for="pw">סיסמה (לפחות 8 תווים)</label><input id="pw" name="password" type="password" minlength="8" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required dir="ltr" />
      ${mode === "register" ? `<label for="cd">קוד הרשמה (אם הוגדר)</label><input id="cd" name="code" autocomplete="off" dir="ltr" />` : ""}
      <p></p><button class="primary block" type="submit">${mode === "login" ? "התחברות" : "הרשמה"}</button>
    </form>
    <button class="block" data-a="auth-toggle" data-mode="${mode === "login" ? "register" : "login"}">${mode === "login" ? "אין חשבון? הרשמה" : "יש חשבון? התחברות"}</button></main>`;
}

// ---------- היום ----------
async function viewToday() {
  shell("today", `<h1>מה לעשות היום</h1>${loading()}`);
  const t = await api("GET", "/api/tasks/today");
  const item = (x: Any) => `<div class="card row">
      ${x.cover_photo_id ? `<img class="thumb sm" alt="" data-photo="${esc(x.cover_photo_id)}" />` : `<div class="thumb sm" aria-hidden="true"></div>`}
      <div class="grow"><b>${esc(x.nickname)}</b><div class="muted">${x.type === "water" ? "💧 השקיה" : "🌱 דישון"} · ${esc(fmtDate(x.due_date))}</div></div>
      <button class="primary" data-a="done" data-id="${esc(x.id)}" aria-label="${x.type === "water" ? "סמן כהושקה" : "סמן כהודשן"}: ${esc(x.nickname)}">${x.type === "water" ? "הושקה" : "הודשן"}</button></div>`;
  const sec = (title: string, list: Any[]) => (list.length ? `<h2>${title}</h2>${list.map(item).join("")}` : "");
  const any = t.overdue.length + t.today.length + t.upcoming.length;
  shell("today", `<h1>מה לעשות היום</h1>` + (any
    ? sec("באיחור", t.overdue) + sec("להיום", t.today) + sec("בקרוב", t.upcoming) + (t.overdue.length + t.today.length ? "" : `<div class="banner ok">אין משימות להיום 🎉</div>`)
    : `<div class="empty"><div class="big">🌿</div><p>אין עדיין משימות טיפול.</p><a class="btn primary" href="#/scan">הוסיפו צמח ראשון</a></div>`));
}
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "short" });

// ---------- הג'ונגל ----------
let jq = "", jloc = "";
async function viewJungle() {
  shell("jungle", `<h1>הג'ונגל שלי</h1>${loading()}`);
  const { plants } = await api("GET", "/api/plants");
  drawJungle(plants);
}
function drawJungle(all: Any[]) {
  const locs = [...new Set(all.map((p) => p.location).filter(Boolean))];
  const list = all.filter((p) => (!jloc || p.location === jloc) && (!jq || [p.nickname, p.common_name_he, p.scientific_name].some((s) => s?.toLowerCase().includes(jq.toLowerCase()))));
  shell("jungle", `<h1>הג'ונגל שלי</h1>
    ${all.length ? `<label class="sr" for="q">חיפוש</label><input id="q" type="search" placeholder="חיפוש צמח…" value="${esc(jq)}" data-a="search" />
    <div class="chips" role="group" aria-label="סינון לפי מיקום"><button class="chip" aria-pressed="${!jloc}" data-a="loc" data-v="">הכול</button>${locs.map((l) => `<button class="chip" aria-pressed="${jloc === l}" data-a="loc" data-v="${esc(l)}">${esc(l)}</button>`).join("")}</div>` : ""}
    ${list.length ? `<div class="grid">${list.map((p) => `<button class="card plant-card" data-a="open" data-id="${esc(p.id)}">
        ${p.cover_photo_id ? `<img alt="${esc(p.nickname)}" data-photo="${esc(p.cover_photo_id)}" />` : `<div class="thumb" aria-hidden="true"></div>`}
        <span class="meta"><b>${esc(p.nickname)}</b><span class="muted">${esc(p.common_name_he || "")}${p.location ? " · " + esc(p.location) : ""}</span></span></button>`).join("")}</div>`
      : all.length ? `<div class="empty">לא נמצאו צמחים.</div>`
      : `<div class="empty"><div class="big">🪴</div><p>הג'ונגל עוד ריק.</p><a class="btn primary" href="#/scan">צלמו צמח וזהו אותו</a></div>`}`);
  (window as any).__plants = all;
  const q = document.getElementById("q") as HTMLInputElement | null;
  if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

// ---------- צמח ----------
function toxBanner(tox: Any | null): string {
  if (!tox) return "";
  const pets = home.has_pets && (tox.cats === "toxic" || tox.dogs === "toxic" || tox.cats === "mildly_toxic" || tox.dogs === "mildly_toxic");
  const kids = home.has_children && (tox.children === "toxic" || tox.children === "mildly_toxic");
  const any = [tox.cats, tox.dogs, tox.children].some((v) => v === "toxic" || v === "mildly_toxic");
  const line = `<p class="muted">חתולים: ${TOX[tox.cats]} · כלבים: ${TOX[tox.dogs]} · ילדים: ${TOX[tox.children]}</p>`;
  const warn = pets || kids ? `<div class="banner bad" role="alert">⚠️ ${pets && kids ? "צמח רעיל לחיות המחמד ולילדים בבית שלכם." : pets ? "צמח רעיל לחיות המחמד בבית שלכם." : "צמח רעיל לילדים בבית שלכם."} מקמו אותו מחוץ להישג יד.</div>` : any ? `<div class="banner warn">הצמח רעיל במידה מסוימת. שימו לב אם יש חיות או ילדים.</div>` : "";
  return warn + `<div class="card"><b>רעילות</b>${line}${tox.details_he ? `<p class="muted">${esc(tox.details_he)}</p>` : ""}<p class="muted">מידע כללי, לא ייעוץ וטרינרי או רפואי.</p></div>`;
}

async function viewPlant(id: string) {
  shell("jungle", loading());
  const [p, g] = await Promise.all([api("GET", `/api/plants/${id}`), api("GET", `/api/plants/${id}/growth`)]);
  const care = p.care;
  const photos = g.entries.filter((e: Any) => e.photo_id);
  const first = photos[photos.length - 1], last = photos[0];
  const timeline = [...g.entries.map((e: Any) => ({ t: e.created_at, e })), ...g.diagnoses.map((d: Any) => ({ t: d.created_at, d }))].sort((a, b) => (a.t < b.t ? 1 : -1));
  shell("jungle", `<a href="#/jungle">→ חזרה לג'ונגל</a>
    <h1>${esc(p.nickname)}</h1>
    <p class="muted">${esc(p.common_name_he || "")} ${p.scientific_name ? `<i dir="ltr">(${esc(p.scientific_name)})</i>` : ""}${p.location ? " · " + esc(p.location) : ""}</p>
    ${p.cover_photo_id ? `<img class="preview" alt="${esc(p.nickname)}" data-photo="${esc(p.cover_photo_id)}" />` : ""}
    ${toxBanner(p.toxicity)}
    ${care ? `<div class="card"><b>טיפול</b><ul class="clean"><li>אור: ${esc(care.light)}</li><li>השקיה: ${esc(care.watering)}</li><li>לחות: ${esc(care.humidity)}</li><li>טמפרטורה: ${esc(care.temperature)}</li><li>קרקע: ${esc(care.soil)}</li><li>דישון: ${esc(care.feeding)}</li></ul></div>` : ""}
    <div class="card"><b>לוח טיפול</b><p class="muted">השקיה: ${p.water_every_days ? `כל ${p.water_every_days} ימים (מותאם לתנאי הבית)` : "לא הוגדר"} · הושקה לאחרונה: ${p.last_watered ? esc(fmtDate(p.last_watered)) : "—"}</p>
      <p class="muted">דישון: ${p.feed_every_days ? `כל ${p.feed_every_days} ימים` : "לא הוגדר"} · הודשן לאחרונה: ${p.last_fed ? esc(fmtDate(p.last_fed)) : "—"}</p></div>
    <div class="row wrap"><button class="primary grow" data-a="diagnose-plant" data-id="${esc(p.id)}">🩺 אבחון מצב הצמח</button>
      <label class="btn grow" style="margin:0">📸 הוסף תמונה<input class="sr" type="file" accept="image/*" capture="environment" data-a="growth-photo" data-id="${esc(p.id)}" /></label></div>
    ${first && last && first.photo_id !== last.photo_id ? `<h2>לפני ואחרי</h2><div class="ba"><figure><img class="preview" alt="תמונה ראשונה" data-photo="${esc(first.photo_id)}" /><figcaption>${esc(fmtDate(first.created_at.slice(0, 10)))}</figcaption></figure><figure><img class="preview" alt="תמונה אחרונה" data-photo="${esc(last.photo_id)}" /><figcaption>${esc(fmtDate(last.created_at.slice(0, 10)))}</figcaption></figure></div>` : ""}
    <h2>יומן צמיחה</h2>
    ${timeline.length ? timeline.map((x: Any) => x.d ? diagCard(x.d) : `<div class="card row">${x.e.photo_id ? `<img class="thumb sm" alt="" data-photo="${esc(x.e.photo_id)}" />` : ""}<div class="grow"><b>${esc(fmtDate(x.t.slice(0, 10)))}</b><p class="muted">${esc(x.e.note || "תמונה חדשה")}</p></div></div>`).join("") : `<div class="empty">אין עדיין רשומות.</div>`}
    <h2>עריכה</h2>
    <form class="card" data-form="edit-plant" data-id="${esc(p.id)}">
      <label for="n">שם</label><input id="n" name="nickname" value="${esc(p.nickname)}" required maxlength="80" />
      <label for="l">מיקום</label><input id="l" name="location" list="locs" value="${esc(p.location || "")}" /><datalist id="locs">${LOCATIONS.map((l) => `<option value="${l}">`).join("")}</datalist>
      <label for="w">השקיה כל (ימים)</label><input id="w" name="water_every_days" type="number" min="1" max="90" value="${p.water_every_days ?? ""}" />
      <label for="f">דישון כל (ימים)</label><input id="f" name="feed_every_days" type="number" min="1" max="365" value="${p.feed_every_days ?? ""}" />
      <label for="nt">הערות</label><textarea id="nt" name="notes" maxlength="2000">${esc(p.notes || "")}</textarea>
      <p></p><button class="primary block" type="submit">שמירה</button></form>
    <button class="danger block" data-a="delete-plant" data-id="${esc(p.id)}">מחיקת הצמח</button>`);
}
function diagCard(d: Any) {
  const r = d.result;
  return `<div class="card"><div class="row"><b class="grow">🩺 אבחון · ${esc(fmtDate(d.created_at.slice(0, 10)))}</b><span class="badge ${esc(d.severity)}">${SEV[d.severity] ?? ""}</span></div>
    ${d.description ? `<p class="muted">"${esc(d.description)}"</p>` : ""}${r?.causes?.[0] ? `<p>${esc(r.causes[0].name_he)}</p>` : ""}</div>`;
}

// ---------- סריקה ----------
function viewScan() {
  const s = scan;
  const result = s.mode === "identify" ? s.identify : s.diagnosis;
  shell("scan", `<h1>סריקה</h1>
    <div class="seg" role="group" aria-label="מצב"><button aria-pressed="${s.mode === "identify"}" data-a="mode" data-v="identify">זיהוי צמח</button><button aria-pressed="${s.mode === "diagnose"}" data-a="mode" data-v="diagnose">אבחון מצב</button></div>
    ${s.plantId ? `<div class="banner ok">האבחון יישמר ביומן של הצמח. <button class="chip" data-a="clear-plant">ביטול</button></div>` : ""}
    <div class="card">
      ${s.image ? `<img class="preview" alt="התמונה שנבחרה" src="${s.image.dataUrl}" />` : `<div class="empty"><div class="big">📷</div><p>צלמו או בחרו תמונה${s.mode === "diagnose" ? " (אפשר גם רק תיאור)" : ""}</p></div>`}
      <div class="row wrap"><label class="btn grow primary" style="margin:0">📸 צילום<input class="sr" type="file" accept="image/*" capture="environment" data-a="pick" /></label>
      <label class="btn grow" style="margin:0">🖼️ גלריה<input class="sr" type="file" accept="image/*" data-a="pick" /></label></div>
      <label for="desc">${s.mode === "diagnose" ? "תיאור מילולי של הבעיה" : "רמז (לא חובה)"}</label>
      <textarea id="desc" data-a="desc" maxlength="${s.mode === "diagnose" ? 2000 : 500}" placeholder="${s.mode === "diagnose" ? "למשל: העלים התחתונים מצהיבים והאדמה תמיד רטובה" : "למשל: קיבלתי אותו מחברה, גדל בצל"}">${esc(s.description)}</textarea>
      <p></p><button class="primary block" data-a="go" ${s.busy ? "disabled" : ""}>${s.busy ? "מנתח…" : s.mode === "identify" ? "זהה צמח" : "אבחן"}</button>
    </div>
    ${s.error ? errorBox(s.error) : ""}
    ${result ? (s.mode === "identify" ? identifyCard(s.identify!) : diagnoseCard(s.diagnosis!)) : ""}`);
}
const pct = (n: number) => Math.round(n * 100);
function identifyCard(r: Any) {
  if (!r.is_plant) return `<div class="banner warn">לא זיהיתי צמח בתמונה. נסו לצלם מקרוב, באור טוב.</div>`;
  return `<div class="card"><h2 style="margin-top:0">${esc(r.common_name_he)} <i class="muted" dir="ltr">${esc(r.scientific_name)}</i></h2>
    <div class="bar" role="img" aria-label="ביטחון ${pct(r.confidence)} אחוז"><i style="inline-size:${pct(r.confidence)}%"></i></div><p class="muted">ביטחון: ${pct(r.confidence)}%</p>
    ${r.needs_more_photos ? `<div class="banner warn">לא בטוח מספיק. ${esc(r.request_he)}</div>` : ""}
    ${r.alternatives.length ? `<b>אפשרויות נוספות</b><ul class="clean">${r.alternatives.map((a: Any) => `<li>${esc(a.common_name_he)} (${pct(a.confidence)}%) · ${esc(a.distinguishing_note_he)}</li>`).join("")}</ul>` : ""}
    <ul class="clean"><li>אור: ${esc(r.care.light)}</li><li>${esc(r.care.watering)}</li><li>${esc(r.care.feeding)}</li></ul>
    ${r.notes_he ? `<p class="muted">${esc(r.notes_he)}</p>` : ""}</div>
    ${toxBanner(r.toxicity)}
    ${scan.added ? `<div class="banner ok">נוסף לג'ונגל! <a href="#/jungle">לצפייה</a></div>` : `<form class="card" data-form="add-plant"><b>הוספה לג'ונגל</b>
      <label for="nn">איך נקרא לצמח?</label><input id="nn" name="nickname" value="${esc(r.common_name_he)}" required maxlength="80" />
      <label for="ll">איפה הוא נמצא?</label><input id="ll" name="location" list="locs2" placeholder="סלון" /><datalist id="locs2">${LOCATIONS.map((l) => `<option value="${l}">`).join("")}</datalist>
      <p></p><button class="primary block" type="submit">הוסף לג'ונגל שלי</button></form>`}`;
}
function diagnoseCard(d: Any) {
  if (!d.is_plant) return `<div class="banner warn">לא זיהיתי צמח בתמונה.</div>`;
  const list = (t: string, a: string[], ol = false) => (a.length ? `<b>${t}</b><${ol ? "ol" : "ul"} class="clean">${a.map((x) => `<li>${esc(x)}</li>`).join("")}</${ol ? "ol" : "ul"}>` : "");
  return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">תוצאת האבחון</h2><span class="badge ${esc(d.severity)}">${SEV[d.severity]}</span></div>
    ${d.severity === "urgent" ? `<div class="banner bad" role="alert">מצב דחוף: פעלו בהקדם לפי הצעדים למטה.</div>` : ""}
    ${d.causes.length ? `<b>סיבות אפשריות</b>${d.causes.map((c: Any) => `<div><div class="row"><span class="grow">${esc(c.name_he)}</span><span class="muted">${pct(c.likelihood)}%</span></div><div class="bar"><i style="inline-size:${pct(c.likelihood)}%"></i></div><p class="muted">${esc(c.evidence_he)}</p></div>`).join("")}` : ""}
    ${list("מה לעשות", d.steps_he, true)}${list("מעקב", d.follow_up_he)}${list("מידע שיעזור לדייק", d.need_more_info_he)}
    <p class="muted">${esc(d.disclaimer_he)}</p></div>`;
}

// ---------- פרופיל ----------
async function viewProfile() {
  const h = home;
  const check = (n: string, v: boolean, label: string) => `<label class="row"><input type="checkbox" name="${n}" ${v ? "checked" : ""} style="inline-size:24px;min-block-size:24px" /> ${label}</label>`;
  shell("profile", `<h1>פרופיל הבית</h1><p class="muted">התנאים משפיעים על תדירות ההשקיה והאזהרות.</p>
    <form class="card" data-form="profile">
      <label for="li">כמות אור</label><select id="li" name="light">${[["low", "מעט"], ["medium", "בינונית"], ["bright", "הרבה"]].map(([v, t]) => `<option value="${v}" ${h.light === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label for="hu">לחות</label><select id="hu" name="humidity">${[["low", "נמוכה"], ["medium", "בינונית"], ["high", "גבוהה"]].map(([v, t]) => `<option value="${v}" ${h.humidity === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label for="tc">טמפרטורה ממוצעת (°C)</label><input id="tc" name="temperature_c" type="number" min="5" max="45" value="${h.temperature_c ?? 24}" />
      <p></p>${check("has_pets", !!h.has_pets, "יש חיות מחמד")}${check("has_children", !!h.has_children, "יש ילדים קטנים")}
      <p></p><button class="primary block" type="submit">שמירה</button></form>
    <div class="card"><b>התראות</b><p class="muted">קבלו תזכורת בטלפון כשצריך להשקות או לדשן. באייפון זה עובד אחרי "הוסף למסך הבית".</p><button class="block" data-a="push">הפעלת התראות</button></div>
    <button class="block" data-a="logout">התנתקות</button>`);
}

// ---------- אירועים ----------
async function guardBtn(btn: HTMLElement | null, fn: () => Promise<void>) {
  if (btn) (btn as HTMLButtonElement).disabled = true;
  try { await fn(); } catch (e) { alert(errMsg(e)); } finally { if (btn) (btn as HTMLButtonElement).disabled = false; }
}

document.addEventListener("click", async (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-a]");
  if (!el || el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
  const a = el.dataset.a!, id = el.dataset.id!;
  if (a === "retry") return route();
  if (a === "auth-toggle") return viewLogin(el.dataset.mode as any);
  if (a === "open") { location.hash = `#/plant/${id}`; return; }
  if (a === "loc") { jloc = el.dataset.v!; return drawJungle((window as any).__plants); }
  if (a === "done") return guardBtn(el, async () => { await api("POST", `/api/tasks/${id}/done`); await viewToday(); });
  if (a === "mode") { scan = { ...scan, mode: el.dataset.v as any, error: undefined, plantId: el.dataset.v === "identify" ? undefined : scan.plantId }; return viewScan(); }
  if (a === "clear-plant") { scan.plantId = undefined; return viewScan(); }
  if (a === "diagnose-plant") { scan = { mode: "diagnose", plantId: id, description: "", busy: false }; location.hash = "#/scan"; if (location.hash === "#/scan") viewScan(); return; }
  if (a === "go") return runScan();
  if (a === "delete-plant") { if (confirm("למחוק את הצמח וכל ההיסטוריה שלו?")) await guardBtn(el, async () => { await api("DELETE", `/api/plants/${id}`); location.hash = "#/jungle"; }); return; }
  if (a === "logout") { setToken(null); profile = {}; scan = { mode: "identify", description: "", busy: false }; location.hash = "#/login"; return; }
  if (a === "push") return guardBtn(el, enablePush);
});

document.addEventListener("input", (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.dataset.a === "desc") scan.description = t.value;
  if (t.dataset.a === "search") { jq = t.value; drawJungle((window as any).__plants); }
});

document.addEventListener("change", async (ev) => {
  const t = ev.target as HTMLInputElement;
  const file = t.files?.[0];
  if (t.dataset.a === "pick" && file) {
    try { scan = { ...scan, image: await compressImage(file), error: undefined, identify: undefined, diagnosis: undefined, added: false }; } catch (e) { scan.error = errMsg(e); }
    viewScan();
  }
  if (t.dataset.a === "growth-photo" && file) {
    try { const img = await compressImage(file); await api("POST", `/api/plants/${t.dataset.id}/photos`, { image: img.base64, mime: img.mime }); await viewPlant(t.dataset.id!); } catch (e) { alert(errMsg(e)); }
  }
});

document.addEventListener("submit", async (ev) => {
  const f = ev.target as HTMLFormElement;
  const kind = f.dataset.form;
  if (!kind) return;
  ev.preventDefault();
  const fd = new FormData(f);
  const btn = f.querySelector<HTMLButtonElement>("button[type=submit]");
  await guardBtn(btn, async () => {
    if (kind === "auth") {
      try {
        const r = await api("POST", `/api/auth/${f.dataset.mode}`, { email: fd.get("email"), password: fd.get("password"), code: fd.get("code") || undefined });
        setToken(r.token); profile = {}; location.hash = "#/today"; if (location.hash === "#/today") route();
      } catch (e) { viewLogin(f.dataset.mode as any, errMsg(e)); }
    } else if (kind === "add-plant") {
      const r = scan.identify!;
      await api("POST", "/api/plants", { nickname: fd.get("nickname"), location: (fd.get("location") as string) || undefined, fromIdentify: r, photoId: scan.photoId });
      scan.added = true; viewScan();
    } else if (kind === "edit-plant") {
      const num = (k: string) => (fd.get(k) ? Number(fd.get(k)) : null);
      await api("PATCH", `/api/plants/${f.dataset.id}`, { nickname: fd.get("nickname"), location: (fd.get("location") as string) || null, notes: (fd.get("notes") as string) || null, water_every_days: num("water_every_days"), feed_every_days: num("feed_every_days") });
      await viewPlant(f.dataset.id!);
    } else if (kind === "profile") {
      const r = await api("PUT", "/api/profile", { home: { ...home, light: fd.get("light"), humidity: fd.get("humidity"), temperature_c: Number(fd.get("temperature_c")), has_pets: fd.has("has_pets"), has_children: fd.has("has_children") } });
      home = r.home; alert("נשמר. לוח הטיפול עודכן לפי תנאי הבית.");
    }
  });
});

async function runScan() {
  const s = scan;
  if (!s.image && !s.description.trim()) { s.error = "צלמו תמונה או כתבו תיאור."; return viewScan(); }
  if (s.mode === "identify" && !s.image) { s.error = "לזיהוי צריך תמונה."; return viewScan(); }
  s.busy = true; s.error = undefined; viewScan();
  try {
    if (s.mode === "identify") {
      const r = await api("POST", "/api/identify", { image: s.image!.base64, mime: s.image!.mime, hint: s.description || undefined });
      s.identify = r.result; s.photoId = r.photoId; s.added = false;
    } else {
      const r = await api("POST", "/api/diagnose", { image: s.image?.base64, mime: s.image?.mime, description: s.description || undefined, plantId: s.plantId });
      s.diagnosis = r.diagnosis;
    }
  } catch (e) { s.error = errMsg(e); }
  s.busy = false; viewScan();
}

async function enablePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("הדפדפן לא תומך בהתראות. באייפון: הוסיפו למסך הבית קודם.");
  const { key } = await api("GET", "/api/push/vapid-key");
  if (!key) throw new Error("התראות לא הוגדרו בשרת (חסרים מפתחות VAPID).");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("לא אושרה הרשאת התראות.");
  const reg = await navigator.serviceWorker.ready;
  const pad = "=".repeat((4 - (key.length % 4)) % 4);
  const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
  await api("POST", "/api/push/subscribe", { subscription: sub.toJSON() });
  alert("ההתראות הופעלו.");
}

if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js").catch(() => {});
route();
