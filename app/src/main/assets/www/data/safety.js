// כללי בטיחות מזון לפי גיל (בחודשים). כללים כלליים בלבד — לא ייעוץ רפואי או תזונתי.
// action: 'block'  = המזון לא יוצע כלל לילד מתחת לגיל below
//         'adapt'  = מוצע, אבל מוצגת הוראת הגשה (note)
// match: רשימת מונחים; מונח של כמה מילים דורש שכל המילים יופיעו. except: מונחים שמבטלים את הכלל.
// group: בתוך קבוצה מופעל רק הכלל הספציפי ביותר (ה-below הנמוך ביותר שעדיין חל).
(typeof globalThis !== 'undefined' ? globalThis : window).BOX_SAFETY = [
  { id: 'honey', group: 'honey', below: 12, action: 'block', match: ['דבש'], note: 'דבש אסור מתחת לגיל שנה' },
  { id: 'whole-nuts', group: 'nuts', below: 60, action: 'block',
    match: ['אגוזים', 'שקדים', 'קשיו', 'פיסטוק', 'בוטנים שלמים', 'פופקורן', 'מסטיק', 'סוכריות קשות'],
    note: 'סכנת חנק' },
  { id: 'peanut-butter', group: 'pbutter', below: 48, action: 'adapt', match: ['חמאת בוטנים'],
    note: 'מרחו שכבה דקה מאוד על הלחם — לא כפית או גוש' },
  { id: 'grapes-quarter', group: 'grapes', below: 36, action: 'adapt', match: ['ענבים'],
    note: 'חתכו כל ענב לאורך לרבעים' },
  { id: 'grapes-half', group: 'grapes', below: 60, action: 'adapt', match: ['ענבים'],
    note: 'חתכו כל ענב לאורך לחצאים' },
  { id: 'cherry-tomato-quarter', group: 'cherry', below: 36, action: 'adapt', match: ['עגבניות שרי'],
    note: 'חתכו כל עגבנייה לאורך לרבעים' },
  { id: 'cherry-tomato-half', group: 'cherry', below: 60, action: 'adapt', match: ['עגבניות שרי'],
    note: 'חתכו כל עגבנייה לחצאים' },
  { id: 'sausage', group: 'sausage', below: 60, action: 'adapt', match: ['נקניקיה', 'נקניק'],
    note: 'אל תגישו עיגולים: חתכו לאורך ואז לחתיכות קטנות' },
  { id: 'olives', group: 'olives', below: 48, action: 'adapt', match: ['זיתים'],
    note: 'ודאו שאין גלעין, וחתכו לחתיכות קטנות' },
  { id: 'raw-carrot', group: 'carrot', below: 48, action: 'adapt', match: ['גזר'],
    except: ['מבושל', 'מגורר', 'אפוי', 'מרוסק'], note: 'גזר חי קשה ללעיסה: הגישו מבושל או מגורר' },
  { id: 'raw-apple', group: 'apple', below: 36, action: 'adapt', match: ['תפוח', 'אגס'],
    except: ['אדמה', 'מבושל', 'אפוי'], note: 'הגישו פרוסות דקות או מגורר' },
  { id: 'cucumber', group: 'cucumber', below: 36, action: 'adapt', match: ['מלפפון'],
    note: 'הגישו פרוסות דקות או רבעים לאורך, לא עיגולים' },
  { id: 'fish-bones', group: 'fish', below: 120, action: 'adapt', match: ['דג'],
    except: ['טונה', 'קציצות'], note: 'ודאו שאין עצמות' }
];
