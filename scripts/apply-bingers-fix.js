const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'server.js');
let t = fs.readFileSync(f, 'utf8');
const old = "let r={id:id(),userId:user.id,title:it.title,type:'series',status:it.status||'watchlist',rating:null,progress:'',currentSeason:it.currentSeason||null,currentEpisode:it.currentEpisode||null,totalEpisodes:null,";
const neu = "let st=it.status||'watchlist';if(st==='watchlist'&&(Number(it.currentSeason)>0||Number(it.currentEpisode)>0||Number(it.episodesWatched)>0))st='watching';let r={id:id(),userId:user.id,title:it.title,type:'series',status:st,rating:null,progress:'',currentSeason:it.currentSeason||null,currentEpisode:it.currentEpisode||null,totalEpisodes:null,";
if (t.includes(neu)) { console.log('Already fixed'); process.exit(0); }
if (!t.includes(old)) { console.error('Pattern not found — server.js may already differ'); process.exit(1); }
fs.writeFileSync(f, t.replace(old, neu));
console.log('Bingers import status fix applied');
