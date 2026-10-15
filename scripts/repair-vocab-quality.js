#!/usr/bin/env node
// Repair confirmed sense/example mismatches without changing scheduling metadata.
// Run after importing IELTS content; expected definitions guard against rewriting
// future, independently corrected versions of these entries.
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'public', 'vocab', 'words.json');
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const fixes = {
  gore: {
    expected: 'Vice President of the United States under Bill Clinton (born in 1948)',
    fa: ['خون‌ریزی شدید', 'با شاخ زخمی کردن'], pos: 'اسم',
    def: 'blood, especially from a wound or violent injury',
    defFa: 'خون، به‌ویژه خونی که از زخم یا آسیب شدید جاری می‌شود',
    ex: 'The film contains scenes of violence and gore.',
    exFa: 'فیلم صحنه‌هایی از خشونت و خون‌ریزی شدید دارد.',
    senses: [['اسم', 'خون‌ریزی شدید', 'blood, especially from a wound or violent injury', 'خون ناشی از زخم یا آسیب شدید', 'The film contains scenes of violence and gore.', 'فیلم صحنه‌هایی از خشونت و خون‌ریزی شدید دارد.'],
      ['فعل', 'با شاخ زخمی کردن', 'to injure a person or animal with a horn or tusk', 'با شاخ یا عاج به کسی یا جانوری آسیب زدن', 'The bull gored the farmer.', 'گاو نر با شاخش کشاورز را زخمی کرد.']],
  },
  lin: {
    expected: 'United States sculptor and architect whose public works include the memorial to veterans of the Vietnam War in Washington (born in 1959)',
    fa: ['آبشار', 'حوضچهٔ پای آبشار'], pos: 'اسم',
    def: 'a waterfall or a pool below a waterfall (Scots; variant of linn)',
    defFa: 'در زبان اسکاتلندی: آبشار یا حوضچهٔ پایین آن؛ گونه‌ای از واژهٔ linn',
    ex: '', exFa: '', senses: null,
  },
  lower: {
    expected: 'very low in volume',
    fa: ['پایین‌تر', 'پایین آوردن', 'کاهش دادن'], pos: 'صفت',
    def: 'at or in a position below another; less high',
    defFa: 'در جایگاهی پایین‌تر یا با ارتفاع کمتر',
    ex: 'The lower shelves are easier to reach.',
    exFa: 'دسترسی به قفسه‌های پایین‌تر آسان‌تر است.',
    senses: [['صفت', 'پایین‌تر', 'at or in a position below another; less high', 'در جایگاهی پایین‌تر یا با ارتفاع کمتر', 'The lower shelves are easier to reach.', 'دسترسی به قفسه‌های پایین‌تر آسان‌تر است.'],
      ['فعل', 'پایین آوردن، کاهش دادن', 'to move something down or reduce its level', 'چیزی را پایین آوردن یا میزان آن را کم کردن', 'Please lower the volume.', 'لطفاً صدا را کم کن.']],
  },
  related: {
    expected: 'make a logical or causal connection',
    fa: ['مرتبط', 'خویشاوند'], pos: 'صفت',
    def: 'connected with something or someone',
    defFa: 'دارای ارتباط با چیزی یا کسی',
    ex: 'The two problems are closely related.',
    exFa: 'این دو مشکل ارتباط نزدیکی با هم دارند.',
    senses: [['صفت', 'مرتبط', 'connected with something or someone', 'دارای ارتباط با چیزی یا کسی', 'The two problems are closely related.', 'این دو مشکل ارتباط نزدیکی با هم دارند.'],
      ['صفت', 'خویشاوند', 'belonging to the same family', 'وابسته به یک خانواده', 'Are you related to her?', 'آیا با او خویشاوندی؟']],
  },
  involved: {
    expected: 'taking part in something',
    fa: ['درگیر', 'دخیل'], pos: 'صفت',
    def: 'taking part in an activity or situation',
    defFa: 'شرکت‌داشتن یا دخیل‌بودن در فعالیت یا موقعیت',
    ex: 'Several students were involved in the project.',
    exFa: 'چند دانشجو در این پروژه مشارکت داشتند.', senses: null,
  },
  limited: {
    expected: 'subject to limits or subjected to limits',
    fa: ['محدود'], pos: 'صفت',
    def: 'restricted in size, amount, or extent',
    defFa: 'دارای اندازه، مقدار یا دامنهٔ محدود',
    ex: 'We have limited time to finish the task.',
    exFa: 'برای تمام‌کردن کار زمان محدودی داریم.', senses: null,
  },
  process: {
    expected: 'a series of actions to achieve a result',
    fa: ['فرایند', 'روند'], pos: 'اسم',
    def: 'a series of actions to achieve a result',
    defFa: 'مجموعه‌ای از کارها برای رسیدن به نتیجه',
    ex: 'Learning a language is a gradual process.',
    exFa: 'یادگیری زبان فرایندی تدریجی است.', senses: null,
  },
  main: {
    expected: 'most important',
    fa: ['اصلی', 'عمده'], pos: 'صفت',
    def: 'most important', defFa: 'مهم‌ترین یا اصلی',
    ex: 'The main reason was a lack of time.',
    exFa: 'دلیل اصلی کمبود وقت بود.', senses: null,
  },
  amount: {
    expected: 'how much of something there is',
    fa: ['مقدار', 'مبلغ'], pos: 'اسم',
    def: 'how much of something there is',
    defFa: 'میزان یا مقدار چیزی',
    ex: 'A small amount of water remained.',
    exFa: 'مقدار کمی آب باقی مانده بود.', senses: null,
  },
  various: {
    expected: 'several different',
    fa: ['گوناگون', 'مختلف'], pos: 'صفت',
    def: 'several different', defFa: 'چند نوع متفاوت',
    ex: 'The course covers various topics.',
    exFa: 'این دوره موضوعات گوناگونی را پوشش می‌دهد.', senses: null,
  },
};

const byWord = new Map(rows.map(row => [row[0], row]));
let changed = 0;
for (const [word, fix] of Object.entries(fixes)) {
  const row = byWord.get(word);
  if (!row) throw new Error(`Missing word: ${word}`);
  if (row[5] === fix.def && row[6] === fix.ex) continue;
  if (row[5] !== fix.expected) throw new Error(`Unexpected existing sense for ${word}: ${row[5]}`);
  row[1] = fix.fa;
  row[4] = fix.pos;
  row[5] = fix.def;
  row[6] = fix.ex;
  row[7] = []; // old synonyms often belonged to the discarded sense
  row[9] = fix.exFa;
  row[10] = fix.defFa;
  row.length = 11;
  if (fix.senses) row[11] = fix.senses;
  changed++;
}

if (changed) fs.writeFileSync(file, JSON.stringify(rows));
console.log(`Repaired ${changed} confirmed entries; ${rows.length} total rows preserved.`);
