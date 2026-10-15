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
  console.log('statement finance smoke: passed');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
