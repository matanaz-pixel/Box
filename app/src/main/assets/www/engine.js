// מנוע ההמלצות של BOX: סינון (חסימות, בטיחות לפי גיל, קופסה, זמן) ודירוג (העדפות, יעדים, גיוון).
// פונקציות טהורות — אין גישה ל-DOM או ל-localStorage, ולכן אפשר לבדוק אותן ב-Node.
(function (root) {
  'use strict';
  var DAY = 86400000;
  var DEFAULT_AGE_MONTHS = 24; // כשאין תאריך לידה מניחים פעוט (גיל שנתיים), כדי שהוראות ההגשה יהיו שמרניות
  var STOP = { 'עם': 1, 'של': 1, 'את': 1, 'בלי': 1, 'לא': 1 };

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[֑-ׇ]/g, '')
      .replace(/[^א-תa-z0-9\s]/g, ' ');
  }
  function words(s) { return norm(s).split(/\s+/).filter(Boolean); }
  function stem(w) { var r = w.replace(/(ים|ות|ה|ת)$/, ''); return r.length >= 2 ? r : w; }

  function wordHit(t, w) {
    var cands = [w];
    if (w.length > 3 && 'הובלמכש'.indexOf(w.charAt(0)) >= 0) cands.push(w.slice(1));
    return cands.some(function (x) {
      var sx = stem(x);
      return sx === t || (t.length >= 3 && sx.indexOf(t) === 0);
    });
  }
  // all=true: כל מילות המונח חייבות להופיע (כללי בטיחות); false: מספיקה מילה אחת (חסימות — שמרני)
  function termHits(term, hay, all) {
    var ts = words(term).filter(function (w) { return !STOP[w]; }).map(stem).filter(function (t) { return t.length >= 2; });
    if (!ts.length) return false;
    var test = function (t) { return hay.some(function (w) { return wordHit(t, w); }); };
    return all ? ts.every(test) : ts.some(test);
  }

  function ageMonths(birth, now) {
    if (!birth) return null;
    var b = new Date(birth + 'T00:00:00');
    if (isNaN(b.getTime())) return null;
    now = now || new Date();
    var m = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
    if (now.getDate() < b.getDate()) m--;
    return Math.max(m, 0);
  }
  function effAge(child, now) {
    var a = ageMonths(child && child.birth, now);
    return a == null ? { m: DEFAULT_AGE_MONTHS, assumed: true } : { m: a, assumed: false };
  }
  function ageLabel(child, now) {
    var a = ageMonths(child && child.birth, now);
    if (a == null) return 'גיל לא הוזן';
    if (a < 24) return 'בן/בת ' + a + ' חודשים';
    return 'בן/בת ' + Math.floor(a / 12);
  }

  function itemWords(it) { return words([it.n].concat(it.f || []).join(' ')); }
  function itemAllWords(it) { return words([it.n].concat(it.f || [], it.a || []).join(' ')); }

  function blockedBy(child, item) {
    var hay = itemAllWords(item), bl = (child && child.blocked) || [];
    for (var k = 0; k < bl.length; k++) if (termHits(bl[k], hay, false)) return bl[k];
    return null;
  }

  function ruleMatches(rule, hay) {
    if (rule.except && rule.except.some(function (t) { return termHits(t, hay, true); })) return false;
    return rule.match.some(function (t) { return termHits(t, hay, true); });
  }
  function safetyFor(child, item, rules, now) {
    var age = effAge(child, now).m, hay = itemWords(item), notes = [], block = null, seen = {};
    rules.filter(function (r) { return age < r.below && ruleMatches(r, hay); })
      .sort(function (a, b) { return a.below - b.below; })
      .forEach(function (r) {
        var g = r.group || r.id;
        if (seen[g]) return;
        seen[g] = 1;
        if (r.action === 'block') block = block || r; else notes.push(r.note);
      });
    return { block: block, notes: notes };
  }

  function ctxData(ctx) {
    return { recipes: (ctx && ctx.recipes) || root.BOX_RECIPES || [], rules: (ctx && ctx.rules) || root.BOX_SAFETY || [], now: (ctx && ctx.now) || new Date() };
  }

  // בדיקת התאמה של מנה לילד. מחזירה {ok, reason, serve:[{item, notes}]}
  function check(child, recipe, ctx) {
    var d = ctxData(ctx), serve = [];
    for (var k = 0; k < recipe.items.length; k++) {
      var it = recipe.items[k], b = blockedBy(child, it);
      if (b) return { ok: false, reason: 'חסום: ' + b, serve: [] };
      var s = safetyFor(child, it, d.rules, d.now);
      if (s.block) return { ok: false, reason: 'לא מתאים לגיל: ' + it.n, serve: [] };
      if (s.notes.length) serve.push({ item: it.n, notes: s.notes });
    }
    // תאים נדרשים: עיקרית+תוספת חולקות תא, ירק בתא משלו, פרי בתא משלו
    var roles = recipe.items.map(function (x) { return x.role; });
    var cells = (roles.indexOf('main') >= 0 || roles.indexOf('side') >= 0 ? 1 : 0) + (roles.indexOf('veg') >= 0 ? 1 : 0) + (roles.indexOf('fruit') >= 0 ? 1 : 0);
    var box = (child && child.box) || 3;
    if (box < cells && !(box === 1 && recipe.mixable)) return { ok: false, reason: 'לא נכנס בקופסה', serve: [] };
    if (ctx && ctx.maxTime && recipe.time > ctx.maxTime) return { ok: false, reason: 'ארוך מדי', serve: [] };
    if (ctx && ctx.exclude && ctx.exclude.indexOf(recipe.id) >= 0) return { ok: false, reason: 'הוחרג', serve: [] };
    return { ok: true, reason: '', serve: serve };
  }

  function seeded(str) {
    var h = 1779033703 ^ str.length;
    for (var k = 0; k < str.length; k++) { h = Math.imul(h ^ str.charCodeAt(k), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  function historyAgo(ctx, now) {
    var out = [];
    (ctx.history || []).forEach(function (h) {
      var t = new Date(h.d + 'T00:00:00').getTime();
      if (!isNaN(t)) out.push({ ago: Math.max(Math.round((dayStart(now) - t) / DAY), 0), r: h.r });
    });
    (ctx.planned || []).forEach(function (p) { out.push({ ago: p.ago, r: p.r }); });
    return out;
  }

  function mainOf(recipe) { return (recipe.items.filter(function (x) { return x.role === 'main'; })[0] || recipe.items[0]).n; }

  function recommend(child, ctx) {
    ctx = ctx || {};
    var d = ctxData(ctx), rng = seeded(String(ctx.seed || '')), goals = (child && child.goals) || [], likes = (child && child.likes) || [];
    var hist = historyAgo(ctx, d.now), byId = {};
    d.recipes.forEach(function (r) { byId[r.id] = r; });
    var variety = goals.indexOf('variety') >= 0 ? 1.7 : 1, likeW = goals.indexOf('eat') >= 0 ? 1.5 : 1;
    var out = [];
    d.recipes.forEach(function (recipe) {
      var c = check(child, recipe, ctx);
      if (!c.ok) return;
      var score = 0, why = [], liked = [];
      recipe.items.forEach(function (it) {
        var hay = itemWords(it);
        if (likes.some(function (l) { return termHits(l, hay, false); })) { liked.push(it.n); score += (it.role === 'main' ? 3 : 2) * likeW; }
      });
      if (liked.length) why.push('כוללת דברים שאוהבים: ' + liked.slice(0, 3).join(', '));
      if (goals.indexOf('speed') >= 0 && recipe.time <= 6) { score += 2; why.push('מהירה: ' + recipe.time + ' דקות'); }
      if (goals.indexOf('nutrition') >= 0 && recipe.items.some(function (x) { return x.role === 'veg'; }) && recipe.items.some(function (x) { return x.role === 'fruit'; })) { score += 2; why.push('כוללת ירק ופרי'); }
      if (goals.indexOf('prep') >= 0 && (recipe.tags.indexOf('frozen') >= 0 || recipe.tags.indexOf('prep') >= 0)) { score += 2; why.push('אפשר להכין מראש'); }
      if (goals.indexOf('budget') >= 0 && recipe.tags.indexOf('cheap') >= 0) { score += 1.5; why.push('חסכונית'); }
      var recent = 0, mainRecent = false, m = mainOf(recipe);
      hist.forEach(function (h) {
        if (h.r === recipe.id && h.ago < 14) recent = Math.max(recent, 1 - h.ago / 14);
        var o = byId[h.r];
        if (o && h.r !== recipe.id && h.ago < 7 && mainOf(o) === m) mainRecent = true;
      });
      if (recent) { score -= 6 * recent * variety; }
      else if (hist.length) why.push('לא הוגשה לאחרונה');
      if (mainRecent) score -= 2 * variety;
      if (!why.length) why.push('מתאימה לקופסה ולהעדפות');
      score += rng() * 0.6; // שבירת שוויון יציבה לפי seed
      out.push({ recipe: recipe, score: score, why: why, serve: c.serve });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return ctx.limit ? out.slice(0, ctx.limit) : out;
  }

  // תכנון שבוע: ימים רצופים בלי חזרות (כל עוד יש מספיק מנות מתאימות)
  function buildWeek(child, ctx, days) {
    ctx = ctx || {}; days = days || 5;
    var plan = [], ids = [];
    for (var i = 0; i < days; i++) {
      var planned = ids.map(function (r, j) { return { ago: i - j, r: r }; });
      var base = Object.assign({}, ctx, { seed: (ctx.seed || '') + '|' + i, planned: planned.concat(ctx.planned || []) });
      var recs = recommend(child, Object.assign({}, base, { exclude: (ctx.exclude || []).concat(ids) }));
      if (!recs.length) recs = recommend(child, base); // אין מספיק מנות — מותר לחזור
      var pick = recs[0] || null;
      plan.push(pick); ids.push(pick ? pick.recipe.id : null);
    }
    return plan;
  }

  // "בנה ממה שיש": מנות מתאימות שהכי הרבה מהרכיבים שלהן זמינים
  function fromPantry(child, have, ctx) {
    var haveClean = (have || []).filter(Boolean);
    var recs = recommend(child, ctx);
    var res = [];
    recs.forEach(function (rc) {
      var covered = [], missing = [];
      rc.recipe.items.forEach(function (it) {
        var hay = itemWords(it);
        (haveClean.some(function (h) { return termHits(h, hay, false); }) ? covered : missing).push(it.n);
      });
      if (!covered.length) return;
      res.push({ recipe: rc.recipe, serve: rc.serve, why: rc.why, covered: covered, missing: missing,
        score: covered.length / rc.recipe.items.length * 10 + rc.score * 0.2 });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res;
  }

  var api = { norm: norm, stem: stem, termHits: termHits, ageMonths: ageMonths, effAge: effAge, ageLabel: ageLabel,
    blockedBy: blockedBy, safetyFor: safetyFor, check: check, recommend: recommend, buildWeek: buildWeek, fromPantry: fromPantry,
    DEFAULT_AGE_MONTHS: DEFAULT_AGE_MONTHS };
  root.BoxEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
