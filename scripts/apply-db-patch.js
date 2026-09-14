const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'server.js');
let text = fs.readFileSync(f, 'utf8');
if (text.trim() === 'PLACEHOLDER' || text.length < 1000) {
  console.error('server.js is broken (PLACEHOLDER). Restore from git first:');
  console.error('  git checkout 485de487f741af83e456327e7455cb562e9f59c5 -- server.js');
  console.error('Then re-run: node scripts/apply-db-patch.js');
  process.exit(1);
}
const old = "function read(){let x=JSON.parse(fs.readFileSync(DB,'utf8'));x.investments??=[];x.accounts??=[];x.budgets??=[];x.projects??=[];x.timeEntries??=[];x.habits??=[];x.habitLogs??=[];x.subscriptions??=[];x.debts??=[];x.footballTeams??=[];x.matches??=[];x.news??=[];x.movies??=[];x.timers??=[];x.exercise??=[];x.weeklyNotes??=[];x.mediaLog??=[];x.investmentTx??=[];x.assetPrices??=[];x.priceAlerts??=[];x.portfolioSnapshots??=[];x.newsSources??=[];x.contacts??=[];x.contactLogs??=[];x.learning??=[];x.bookmarks??=[];x.shoppingItems??=[];x.trips??=[];x.tripChecklist??=[];x.documents??=[];x.goals??=[];x.wins??=[];x.decisions??=[];x.lifeReviews??=[];x.pokerSessions??=[]; x.reminders ??= []; x.telegramLinkCodes ??= [];return x}function write(x){fs.writeFileSync(DB,JSON.stringify(x,null,2))}";
if (!text.includes(old)) {
  if (text.includes('_writeChain') && text.includes('backupDb')) {
    console.log('Already patched.');
    process.exit(0);
  }
  console.error('Could not find original read/write block. Abort.');
  process.exit(1);
}
const neu = `function read(){let x=JSON.parse(fs.readFileSync(DB,'utf8'));if(!x._meta)x._meta={version:1};if(typeof x._meta.version!=='number')x._meta.version=1;x.investments??=[];x.accounts??=[];x.budgets??=[];x.projects??=[];x.timeEntries??=[];x.habits??=[];x.habitLogs??=[];x.subscriptions??=[];x.debts??=[];x.footballTeams??=[];x.matches??=[];x.news??=[];x.movies??=[];x.timers??=[];x.exercise??=[];x.weeklyNotes??=[];x.mediaLog??=[];x.investmentTx??=[];x.assetPrices??=[];x.priceAlerts??=[];x.portfolioSnapshots??=[];x.newsSources??=[];x.contacts??=[];x.contactLogs??=[];x.learning??=[];x.bookmarks??=[];x.shoppingItems??=[];x.trips??=[];x.tripChecklist??=[];x.documents??=[];x.goals??=[];x.wins??=[];x.decisions??=[];x.lifeReviews??=[];x.pokerSessions??=[];x.reminders??=[];x.telegramLinkCodes??=[];x.sessions??=[];x.users??=[];x.transactions??=[];return x}
let _writeChain=Promise.resolve();
function write(x){if(!x._meta)x._meta={version:1};x._meta.version=(Number(x._meta.version)||0)+1;x._meta.updatedAt=new Date().toISOString();let payload=JSON.stringify(x,null,2);_writeChain=_writeChain.then(function(){let tmp=DB+'.tmp';fs.writeFileSync(tmp,payload);fs.renameSync(tmp,DB)}).catch(function(e){console.error('DB write failed',e)});return _writeChain}
function backupDb(){try{if(!fs.existsSync(DB))return;let dir=path.join(path.dirname(DB),'backups');if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true});let stamp=new Date().toISOString().slice(0,10);fs.copyFileSync(DB,path.join(dir,'db-'+stamp+'.json'));let files=fs.readdirSync(dir).filter(function(f){return f.indexOf('db-')===0}).sort();while(files.length>7)fs.unlinkSync(path.join(dir,files.shift()))}catch(e){console.error('backup failed',e)}}`;
text = text.replace(old, neu);
const oldL = "server.listen(PORT,'0.0.0.0',()=>console.log(`LifeOS running on ${PORT}`));";
const newL = "backupDb();\nsetInterval(backupDb,24*60*60*1000);\n" + oldL;
if (text.includes(oldL) && !text.includes('setInterval(backupDb')) text = text.replace(oldL, newL);
fs.writeFileSync(f, text);
console.log('Patched server.js OK, size', text.length);
