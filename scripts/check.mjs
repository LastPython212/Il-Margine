// Verifica tutte le fonti predefinite: npm run check
import {SEEDS} from '../lib/sources.js';
import {loadSource} from '../lib/feed.js';
let ok=0;
for(const s of SEEDS){
  try{
    const r=await loadSource(s.url);
    const good=r.items.length>0;ok+=good;
    console.log(`${good?'OK  ':'VUOTO'} ${s.name.padEnd(34)} ${r.feedUrl?'feed: '+r.feedUrl:'scraping'} → ${r.items.length} articoli`);
  }catch(e){console.log(`ERR  ${s.name.padEnd(34)} ${e.message}`)}
}
console.log(`\n${ok}/${SEEDS.length} fonti restituiscono articoli`);
