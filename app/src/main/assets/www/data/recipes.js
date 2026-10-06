// מאגר מנות. כל מנה היא קופסה מורכבת מרכיבים.
// item: n = שם, role = main/side/veg/fruit, a = אלרגנים, f = מילות מפתח נוספות (להתאמת חסימות ומזווה).
// cells = מספר התאים הנדרש בקופסה (ברירת מחדל: מספר הרכיבים); mixable = אפשר לערבב לתא אחד.
// tags: frozen (מהמקפיא), nocook (בלי בישול), cheap, prep (הכנה מראש).
(function () {
  var A = { g: 'גלוטן', m: 'חלב', e: 'ביצה', f: 'דגים', s: 'שומשום', p: 'בוטנים', n: 'אגוזים' };
  function i(n, role, a, f) {
    return { n: n, role: role, a: (a || '').split('').filter(Boolean).map(function (c) { return A[c]; }), f: f || [] };
  }
  function r(id, name, emoji, time, tags, items, mixable) {
    return { id: id, name: name, emoji: emoji, time: time, tags: tags, items: items, mixable: !!mixable };
  }
  (typeof globalThis !== 'undefined' ? globalThis : window).BOX_RECIPES = [
    r('pasta-cheese', 'פסטה עם גבינה', '🍝', 6, ['prep', 'cheap'], [i('פסטה', 'main', 'g'), i('גבינה צהובה', 'side', 'm', ['גבינה']), i('מלפפון', 'veg'), i('ענבים', 'fruit')], true),
    r('omelet-pita', 'חביתה בפיתה', '🥚', 8, ['cheap'], [i('חביתה', 'main', 'e', ['ביצה']), i('פיתה', 'side', 'g'), i('גזר', 'veg'), i('תותים', 'fruit')]),
    r('tuna-patties', 'קציצות טונה', '🐟', 6, ['frozen', 'prep'], [i('קציצות טונה', 'main', 'gfe', ['טונה', 'דג']), i('בטטה', 'veg'), i('שעועית', 'side')]),
    r('corn-quiche', 'פשטידת תירס', '🌽', 5, ['frozen', 'prep'], [i('פשטידת תירס', 'main', 'gem', ['תירס', 'ביצה']), i('פלפל', 'veg'), i('תותים', 'fruit')]),
    r('olive-quiche', 'פשטידת זיתים', '🫒', 5, ['frozen', 'prep'], [i('פשטידת זיתים', 'main', 'gem', ['זיתים', 'ביצה']), i('גזר', 'veg'), i('אגס', 'fruit')]),
    r('broccoli-quiche', 'פשטידת ברוקולי', '🥦', 5, ['frozen', 'prep'], [i('פשטידת ברוקולי', 'main', 'gem', ['ברוקולי', 'ביצה']), i('עגבניות שרי', 'veg'), i('ענבים', 'fruit')]),
    r('cheese-toast', 'טוסט גבינה', '🥪', 7, ['cheap'], [i('טוסט גבינה', 'main', 'gm', ['גבינה', 'לחם']), i('עגבניות שרי', 'veg'), i('תפוח', 'fruit')]),
    r('egg-sandwich', 'כריך ביצה קשה', '🥚', 6, ['cheap'], [i('כריך ביצה', 'main', 'ge', ['ביצה', 'לחם']), i('מלפפון', 'veg'), i('בננה', 'fruit')]),
    r('cream-cheese-sandwich', 'כריך גבינה לבנה', '🥪', 4, ['nocook', 'cheap'], [i('כריך גבינה לבנה', 'main', 'gm', ['גבינה', 'לחם']), i('מלפפון', 'veg'), i('ענבים', 'fruit')]),
    r('hummus-pita', 'פיתה עם חומוס', '🫓', 4, ['nocook', 'cheap'], [i('פיתה עם חומוס', 'main', 'gs', ['חומוס', 'פיתה', 'טחינה']), i('מלפפון', 'veg'), i('תפוז', 'fruit')]),
    r('chicken-schnitzel', 'שניצל עוף עם אורז', '🍗', 6, ['frozen', 'prep'], [i('שניצל עוף', 'main', 'ge', ['עוף']), i('אורז', 'side'), i('מלפפון', 'veg')]),
    r('chicken-patty', 'לביבת עוף', '🍗', 6, ['frozen', 'prep'], [i('לביבת עוף', 'main', 'ge', ['עוף']), i('אורז', 'side'), i('גזר מבושל', 'veg')]),
    r('lentil-balls', 'קציצות עדשים', '🫘', 6, ['frozen', 'prep'], [i('קציצות עדשים', 'main', 'g', ['עדשים']), i('בטטה', 'veg'), i('מלפפון', 'veg')]),
    r('sweet-potato-beans', 'בטטה אפויה ושעועית', '🍠', 8, ['prep', 'cheap'], [i('בטטה אפויה', 'main', '', ['בטטה']), i('שעועית', 'side'), i('מלפפון', 'veg'), i('תפוז', 'fruit')], true),
    r('yogurt-cereal', 'יוגורט וקורנפלקס', '🥣', 3, ['nocook'], [i('יוגורט', 'main', 'm'), i('קורנפלקס', 'side', 'g'), i('בננה', 'fruit')]),
    r('cottage-bread', 'קוטג׳ עם לחם וירקות', '🧀', 4, ['nocook'], [i('קוטג׳', 'main', 'm', ['גבינה']), i('לחם', 'side', 'g'), i('מלפפון', 'veg'), i('אגס', 'fruit')]),
    r('pasta-corn', 'פסטה עם תירס וגבינה', '🌽', 7, ['prep', 'cheap'], [i('פסטה', 'main', 'g'), i('תירס', 'side'), i('גבינה צהובה', 'side', 'm', ['גבינה']), i('ענבים', 'fruit')], true),
    r('rice-corn-peas', 'אורז עם תירס ואפונה', '🍚', 6, ['prep', 'cheap'], [i('אורז', 'main'), i('תירס', 'side'), i('אפונה', 'veg'), i('תפוז', 'fruit')], true),
    r('home-pizza', 'פיצה ביתית', '🍕', 6, ['prep'], [i('פיצה', 'main', 'gm', ['גבינה']), i('מלפפון', 'veg'), i('ענבים', 'fruit')]),
    r('pancakes', 'פנקייק עם פירות', '🥞', 5, ['prep'], [i('פנקייק', 'main', 'gme', ['ביצה']), i('תותים', 'fruit'), i('יוגורט', 'side', 'm')]),
    r('tuna-sandwich', 'כריך טונה', '🥪', 5, ['nocook'], [i('כריך טונה', 'main', 'gfe', ['טונה', 'דג', 'לחם']), i('מלפפון', 'veg'), i('עגבניות שרי', 'veg')]),
    r('pasta-tomato', 'פסטה ברוטב עגבניות', '🍝', 6, ['prep', 'cheap'], [i('פסטה ברוטב עגבניות', 'main', 'g', ['פסטה']), i('גבינה צהובה', 'side', 'm', ['גבינה']), i('גזר מבושל', 'veg')], true),
    r('shakshuka-pita', 'שקשוקה בפיתה', '🍳', 10, [], [i('שקשוקה', 'main', 'e', ['ביצה']), i('פיתה', 'side', 'g'), i('מלפפון', 'veg'), i('אבטיח', 'fruit')]),
    r('hot-dog', 'נקניקיה בלחמנייה', '🌭', 6, [], [i('נקניקיה', 'main', 'g'), i('לחמנייה', 'side', 'g'), i('מלפפון', 'veg'), i('אבטיח', 'fruit')]),
    r('ptitim-veg', 'פתיתים עם ירקות', '🍚', 7, ['prep', 'cheap'], [i('פתיתים', 'main', 'g'), i('אפונה', 'veg'), i('גזר מבושל', 'veg'), i('תפוח', 'fruit')], true),
    r('couscous-chickpeas', 'קוסקוס עם גרגרי חומוס', '🫘', 7, ['prep', 'cheap'], [i('קוסקוס', 'main', 'g'), i('גרגרי חומוס', 'side'), i('מלפפון', 'veg'), i('תפוז', 'fruit')], true),
    r('egg-cheese-bread', 'חביתה עם גבינה ולחם', '🍳', 8, [], [i('חביתה עם גבינה', 'main', 'em', ['ביצה', 'גבינה']), i('לחם', 'side', 'g'), i('עגבניות שרי', 'veg'), i('בננה', 'fruit')]),
    r('pasta-salad', 'סלט פסטה', '🥗', 6, ['prep', 'cheap'], [i('פסטה', 'main', 'g'), i('תירס', 'side'), i('מלפפון', 'veg'), i('פלפל', 'veg')], true),
    r('cheese-burekas', 'בורקס גבינה', '🥐', 5, ['frozen', 'prep'], [i('בורקס גבינה', 'main', 'gme', ['גבינה']), i('מלפפון', 'veg'), i('תפוח', 'fruit')]),
    r('potato-latkes', 'לביבות תפוחי אדמה', '🥔', 6, ['frozen', 'prep'], [i('לביבות תפוחי אדמה', 'main', 'ge', ['תפוח אדמה']), i('גבינה לבנה', 'side', 'm', ['גבינה']), i('גזר מבושל', 'veg'), i('ענבים', 'fruit')]),
    r('peanut-butter-sandwich', 'כריך חמאת בוטנים', '🥜', 3, ['nocook'], [i('כריך חמאת בוטנים', 'main', 'gp', ['חמאת בוטנים', 'לחם']), i('גזר מגורר', 'veg'), i('תפוח', 'fruit')]),
    r('tortilla-cheese', 'טורטייה עם גבינה וירקות', '🌯', 5, [], [i('טורטייה', 'main', 'g'), i('גבינה צהובה', 'side', 'm', ['גבינה']), i('מלפפון', 'veg'), i('פלפל', 'veg')]),
    r('fish-sticks', 'דג בפירורי לחם עם אורז', '🐟', 7, ['frozen'], [i('דג בפירורי לחם', 'main', 'gfe', ['דג']), i('אורז', 'side'), i('מלפפון', 'veg')]),
    r('meat-rice', 'קציצת בשר עם אורז', '🍖', 7, ['frozen', 'prep'], [i('קציצת בשר', 'main', 'ge', ['בשר']), i('אורז', 'side'), i('מלפפון', 'veg'), i('אבטיח', 'fruit')]),
    r('mujadara', 'מג׳דרה (אורז ועדשים)', '🍚', 8, ['prep', 'cheap'], [i('אורז', 'main'), i('עדשים', 'side'), i('מלפפון', 'veg')], true),
    r('pesto-pasta', 'פסטה בפסטו', '🍝', 6, ['prep'], [i('פסטה בפסטו', 'main', 'gmn', ['פסטה', 'אגוזים']), i('עגבניות שרי', 'veg'), i('ענבים', 'fruit')], true),
    r('tahini-banana', 'כריך טחינה ובננה', '🍌', 3, ['nocook', 'cheap'], [i('כריך טחינה', 'main', 'gs', ['לחם', 'טחינה']), i('בננה', 'fruit'), i('מלפפון', 'veg')]),
    r('crackers-cheese', 'קרקרים עם גבינה ופירות', '🧀', 3, ['nocook'], [i('קרקרים', 'main', 'g'), i('גבינה צהובה', 'side', 'm', ['גבינה']), i('ענבים', 'fruit'), i('מלפפון', 'veg')]),
    r('veg-omelet-pita', 'חביתת ירקות ופיתה', '🍳', 8, [], [i('חביתת ירקות', 'main', 'e', ['ביצה']), i('פיתה', 'side', 'g'), i('אפונה', 'veg'), i('תפוז', 'fruit')]),
    r('rice-chicken-veg', 'אורז עם עוף וירקות', '🍗', 8, ['prep'], [i('עוף', 'main'), i('אורז', 'side'), i('גזר מבושל', 'veg'), i('תפוח', 'fruit')], true),
    r('cottage-corn-pita', 'פיתה עם קוטג׳ ותירס', '🫓', 4, ['nocook', 'cheap'], [i('פיתה', 'main', 'g'), i('קוטג׳', 'side', 'm', ['גבינה']), i('תירס', 'side'), i('פלפל', 'veg')]),
    r('bean-wrap', 'לאפה עם שעועית וגבינה', '🌯', 6, ['prep'], [i('לאפה', 'main', 'g'), i('שעועית', 'side'), i('גבינה צהובה', 'side', 'm', ['גבינה']), i('מלפפון', 'veg')]),
    r('yogurt-fruit', 'יוגורט עם פירות ולחמנייה', '🍓', 3, ['nocook'], [i('יוגורט', 'main', 'm'), i('לחמנייה', 'side', 'g'), i('תותים', 'fruit'), i('מלפפון', 'veg')])
  ];
})();
