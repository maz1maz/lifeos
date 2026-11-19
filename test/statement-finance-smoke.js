// Run with: node test/statement-finance-smoke.js
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

async function load(entry) {
  const built = await esbuild.build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, external: ['react', 'react-dom', 'react/jsx-runtime'], loader: { '.css': 'empty' } });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}

async function main() {
  const statement = await load('src/today/src/statement.jsx');
  const life = await load('src/today/src/life.jsx');
  const print = await load('src/today/src/statementPrint.js');
  const contract = {
    amount: 1000, advancePayment: 0,
    boq: [{ id: 'a', desc: 'کار', qty: 10, price: 100, kind: 'supply' }],
    measures: [{ itemId: 'a', statementNo: 1, qty: 4 }, { itemId: 'a', statementNo: 2, qty: 3 }],
    svRates: { discountAmount: 100, hasRetention: false, hasInsurance: false, advance: 0, vat: 0 }
  };
  assert.equal(statement.statementSummary(contract, 1, []).payableWithVat, 360);
  assert.equal(statement.statementSummary(contract, 2, []).payableWithVat, 270);
  const payments = [{ statementNo: 1, paidAmount: 360, amountSource: 'auto' }, { statementNo: 2, paidAmount: 100, amountSource: 'auto' }];
  // amount is the statement's payable net of the deposits up to it (statementSummary); remaining is what is still owed
  assert.deepEqual(life.latestStatementPayable(contract, payments), { no: 2, amount: 170, remaining: 170 });
  assert.equal(life.statementLedger(payments, contract).remaining, 170);
  assert.equal(life.projectOutstanding(contract, payments), 170);
  const noStatement = { amount: 1000, advancePayment: 200, remainingAmount: 800 };
  assert.equal(life.projectOutstanding(noStatement, []), 800);
  assert.equal(life.projectOutstanding(noStatement, [{ statementNo: 1, amount: 0, paidAmount: 0 }]), 800);
  assert.equal(life.projectOutstanding(noStatement, [{ statementNo: 1, amount: 500, paidAmount: 100 }]), 400);
  assert.equal(life.projectOutstanding(null, []), 0);
  assert.equal(life.projectReceived({ advancePayment: 200 }, payments), 660);
  assert.equal(life.projectReceived({ advancePayment: 200 }, [{ paidAmount: 50 }, { paidAmount: 75 }]), 325);
  const numbered = { ...contract, svFinal: 1, measures: [contract.measures[0]], svPeriods: { 3: { from: '2026-10-01' } } };
  assert.deepEqual(statement.statementNumbers(numbered, payments), [1, 2, 3]);
  const picker = renderToStaticMarkup(React.createElement(statement.StatementWorkbook, { contract: numbered, payments, onPatchContract: () => {} }));
  assert.match(picker, /<option value="1">۱ \(قطعی\)<\/option>/);
  assert.match(picker, /<option value="2">۲<\/option>/);
  assert.match(picker, /<option value="3"(?: selected="")?>۳<\/option>/);
  const doc = statement.statementDoc(contract, { name: 'پروژه آزمایشی' }, 2, payments);
  const html = print.statementHtml(doc);
  assert.match(html, /<small>مبلغ قرارداد<\/small><b class="n">۱٬۰۰۰<\/b>/);
  assert.match(html, /مبلغ پیش‌پرداخت/);
  assert.doesNotMatch(html, /پیشرفت مالی نسبت به قرارداد|سپرده حسن انجام کار|سپرده بیمه/);
  const legacy = { ...contract, svRates: { discount: 10, retention: 0, insurance: 0, advance: 0, vat: 0 } };
  assert.equal(statement.svRatesOf(legacy).discountAmount, 100);
  // Finance transactions → Excel: rows in date order, toman = rial ÷ 10, transfers kept out of income/expense.
  const fx = await load('src/today/src/financeExport.js');
  const txs = [
    { date: '2026-11-02', title: 'حقوق', category: 'درآمد', kind: 'income', account: 'بلو', amount: 50000000 },
    { date: '2026-11-01', title: 'نان', category: 'خوراک', kind: 'expense', account: 'بلو', amount: 1200000, tags: ['خانه'] },
    { date: '2026-11-03', title: 'به پس‌انداز', category: 'انتقال', kind: 'expense', account: 'بلو', amount: 9000000 },
  ];
  const rows = fx.transactionRows(txs);
  assert.deepEqual(rows.map(r => r[1]), ['2026-11-01', '2026-11-02', '2026-11-03']);
  assert.deepEqual(rows[0].slice(2), ['نان', 'خوراک', 'هزینه', 'بلو', 120000, 1200000, 'خانه']);
  assert.equal(rows[2][4], 'انتقال');
  const sum = fx.transactionSummary(txs);
  assert.deepEqual([sum.income, sum.expense, sum.cats], [5000000, 120000, [['خوراک', 120000]]]);
  // loan calculator: equal installments, whole rial
  const loan = await load('src/today/src/loan.jsx');
  const lp = loan.loanPlan(100000000, 24, 12);
  assert.equal(lp.payment, 9455960); assert.equal(lp.total, lp.payment * 12); assert.equal(lp.interest, lp.total - 100000000);
  assert.deepEqual(loan.loanPlan(1200, 0, 12), { payment: 100, total: 1200, interest: 0, months: 12 });
  assert.equal(loan.loanPlan(0, 10, 12), null); assert.equal(loan.loanPlan(1000, 10, 0), null);
  // «اگر…»: whole rial, totals, presets move the dollar-priced groups together
  const wi = await load('src/today/src/whatif.jsx');
  const mix = [{ type: 'stock', label: 'سهام', value: 1000000 }, { type: 'gold', label: 'طلا', value: 500000 }, { type: 'crypto', label: 'رمزارز', value: 333333 }];
  const sc = wi.whatIfScenario(mix, { gold: 20, crypto: -10 });
  assert.equal(sc.before, 1833333); assert.equal(sc.rows[1].after, 600000); assert.equal(sc.rows[2].after, 300000); assert.equal(sc.after, 1900000); assert.equal(sc.delta, 66667); assert.equal(sc.pct, 3.6);
  const dollarUp = Object.fromEntries(wi.WHATIF_PRESETS)['دلار +۲۰٪'];
  assert.equal(dollarUp.gold, 20); assert.equal(dollarUp.crypto, 20); assert.equal(dollarUp.stock, undefined);
  assert.equal(wi.whatIfScenario(mix, {}).delta, 0);
  console.log('statement finance smoke: passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
