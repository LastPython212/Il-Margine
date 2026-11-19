import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
const H={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'it-IT,it;q=0.9,en;q=0.8'};
const PRIVATE=/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/;
export async function get(u){
  const x=new URL(u);
  if(!/^https?:$/.test(x.protocol)||PRIVATE.test(x.hostname))throw new Error('URL non consentito');
  const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(8000),redirect:'follow'});
  if(!r.ok)throw new Error('HTTP '+r.status);
  return r.text();
}
const isXml=t=>/^\s*(<\?xml|<rss|<feed|<rdf)/i.test(t.slice(0,300));
const parser=new Parser({customFields:{item:[['media:content','media'],['media:thumbnail','thumb'],['content:encoded','full']]}});
export function paras(html){
  const $=cheerio.load(html||'');const out=[];
  $('p,h2,h3,h4,blockquote,li').each((_,e)=>{
    const t=$(e).text().replace(/\s+/g,' ').trim();
    if(t.length>1)out.push(/^h/i.test(e.tagName)?'## '+t:t);
  });
  return out;
}
const DATE=/^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/;
// Fallback per siti (es. AIE) che mostrano schede "immagine + titolo + testo + data" senza link utilizzabili
function cards($,url){
  const isDate=(_,x)=>!$(x).children().length&&DATE.test($(x).text());
  const out=[],seen=new Set();
  $('body *').filter(isDate).each((_,e)=>{
    let best=null,box=$(e).parent();
    for(let k=0;k<6&&box.length;k++){
      if(box.find('*').filter(isDate).length===1){best=box;box=box.parent()}else break;
    }
    if(!best)return;
    const texts=[];
    best.find('*').each((_,x)=>{
      if($(x).children().length)return;
      const t=$(x).text().replace(/\s+/g,' ').trim();
      if(t.length>2&&!DATE.test(t))texts.push(t);
    });
    const title=texts.find(t=>t.length>=20);
    if(!title)return;
    const excerpt=texts.find(t=>t!==title&&t.length>=20)||'';
    const m=$(e).text().match(DATE);
    const dt=new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`);
    const a=best.find('a[href]').filter((_,x)=>!/^(#|javascript|mailto)/i.test($(x).attr('href')||'')).first().attr('href');
    let link;
    try{link=a?new URL(a,url).href:url.split('#')[0]+'#im-'+encodeURIComponent(title.slice(0,50))}catch{return}
    if(seen.has(link))return;seen.add(link);
    let img=best.find('img').first().attr('src')||'';
    try{img=img?new URL(img,url).href:''}catch{img=''}
    out.push({id:link,title,link,date:isNaN(dt)?new Date().toISOString():dt.toISOString(),excerpt:excerpt.slice(0,260),image:img,paras:excerpt?[excerpt]:[],shallow:!a});
  });
  return out.slice(0,15);
}
// Fallback generico: link "da articolo" ovunque nella pagina (siti Next.js/SPA con link fuori da titoli e <article>)
function anchors($,url){
  const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
  const me=hostOf(url),seen=new Set(),out=[];
  $('a[href]').each((_,e)=>{
    const a=$(e);
    if(a.closest('nav,footer,aside,form').length||a.parents('body > header,[role=banner]').length)return;
    let l;try{l=new URL(a.attr('href'),url).href}catch{return}
    if(hostOf(l)!==me||l.split('#')[0]===url.split('#')[0]||seen.has(l))return;
    const t=a.text().replace(/\s+/g,' ').trim();
    if(t.length<18||t.split(' ').length<3||/^(leggi|scopri|clicca|vai|vedi|continua|read more|iscriviti|accedi)\b/i.test(t))return;
    if(new URL(l).pathname==='/')return;
    seen.add(l);
    const box=a.closest('article,li,div');
    let im=box.find('img').first().attr('src')||'';
    try{im=im?new URL(im,url).href:''}catch{im=''}
    out.push({id:l,title:t,link:l,date:new Date().toISOString(),excerpt:'',image:im,paras:[]});
  });
  return out.slice(0,20);
}
// Schede con titolo non linkato e link "Leggi di più" a parte (es. Book Pride)
function readmore($,url){
  const out=[],seen=new Set(),HS='h1,h2,h3,h4,h5';
  $('a[href]').each((_,e)=>{
    const a=$(e),t=a.text().replace(/\s+/g,' ').trim();
    if(!/^(leggi|scopri|continua|approfondisci|read more)\b/i.test(t))return;
    if(a.closest('nav,footer,aside,form').length)return;
    let l;try{l=new URL(a.attr('href'),url).href}catch{return}
    if(seen.has(l)||l.split('#')[0]===url.split('#')[0])return;
    let h=null,box=a;
    for(let k=0;k<4&&box.length;k++){
      const own=box.find(HS);
      if(box[0]!==a[0]&&own.length===1){h=own;break}
      const prev=box.prevAll(HS).first();
      if(prev.length){h=prev;break}
      box=box.parent();
    }
    if(!h)return;
    const title=h.text().replace(/\s+/g,' ').trim();
    if(title.length<8)return;
    seen.add(l);
    const p=h.nextAll('p').first().text().replace(/\s+/g,' ').trim()||h.parent().find('p').first().text().replace(/\s+/g,' ').trim();
    const wrap=h.parent();
    let im=wrap.find(HS).length<=1?wrap.find('img').first().attr('src')||'':'';
    try{im=im?new URL(im,url).href:''}catch{im=''}
    out.push({id:l,title,link:l,date:new Date().toISOString(),excerpt:p.slice(0,260),image:im,paras:p?[p]:[],shallow:false});
  });
  return out.slice(0,20);
}
const RM=/^(leggi (di più|tutto|l.articolo|la notizia|ancora)|continua a leggere|read more|continue reading|scopri di più|vai all.articolo)/i;
// Schede con titolo NON linkato e un link "Leggi di più" separato (es. Book Pride)
function readMore($,url){
  const me=new URL(url).hostname.replace(/^www\./,'');
  const isRM=(_,x)=>RM.test($(x).text().replace(/\s+/g,' ').trim());
  const out=[],seen=new Set();
  $('a[href]').filter(isRM).each((_,e)=>{
    const a=$(e);let l;
    try{l=new URL(a.attr('href'),url).href}catch{return}
    if(new URL(l).hostname.replace(/^www\./,'')!==me||l.split('#')[0]===url.split('#')[0]||seen.has(l))return;
    let box=a,h=null;
    for(let k=0;k<5;k++){
      box=box.parent();if(!box.length)break;
      if(box.find('a[href]').filter(isRM).length>1)break;
      const x=box.find('h1,h2,h3,h4,h5').first();
      if(x.length){h=x;break}
    }
    if(!h)return;
    const title=h.text().replace(/\s+/g,' ').trim();
    if(title.length<8)return;
    seen.add(l);
    const dm=box.text().match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);
    const dt=dm?new Date(`${dm[3]}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}T12:00:00Z`):null;
    let im=box.find('img').first().attr('src')||'';
    try{im=im?new URL(im,url).href:''}catch{im=''}
    const ex=box.find('p').first().text().replace(/\s+/g,' ').trim().slice(0,260);
    out.push({id:l,title,link:l,date:dt&&!isNaN(dt)?dt.toISOString():new Date().toISOString(),excerpt:ex,image:im,paras:ex?[ex]:[]});
  });
  return out.slice(0,20);
}
// Se la pagina non ha articoli (es. home "vetrina"), prova la sezione News/Blog/Notizie linkata nel menu
async function scrapeSmart($,url){
  let items=scrape($,url);
  if(items.length>=3)return items;
  const nav=[];
  $('a[href]').each((_,e)=>{
    if(/^(news|notizie|blog|articoli|magazine|novità|ultime notizie|rassegna stampa|comunicati stampa)$/i.test($(e).text().trim()))
      try{nav.push(new URL($(e).attr('href'),url).href)}catch{}
  });
  for(const u of [...new Set(nav)].filter(u=>u.split('#')[0]!==url.split('#')[0]).slice(0,2)){
    try{const it=scrape(cheerio.load(await get(u)),u);if(it.length>items.length){items=it;break}}catch{}
  }
  return items;
}
function scrape($,url){
  const seen=new Set(),out=[];
  $('article a[href],h1 a[href],h2 a[href],h3 a[href]').each((_,e)=>{
    const t=$(e).text().replace(/\s+/g,' ').trim();
    let l;try{l=new URL($(e).attr('href'),url).href}catch{return}
    if(t.length<25||seen.has(l)||!l.startsWith('http'))return;
    seen.add(l);
    const img=$(e).closest('article,div,li').find('img').first().attr('src')||'';
    let im='';try{im=img?new URL(img,url).href:''}catch{}
    out.push({id:l,title:t,link:l,date:new Date().toISOString(),excerpt:'',image:im,paras:[]});
  });
  if(out.length<3){const c=cards($,url);if(c.length>out.length)return c}
  if(out.length<3){const r=readmore($,url);if(r.length>=3)return r}
  if(out.length<3){const r=readMore($,url);if(r.length>out.length)return r}
  if(out.length<3){const g=anchors($,url);if(g.length>out.length)return g}
  return out.slice(0,15);
}
export async function loadSource(url,hint){
  // hint: indirizzo del feed già trovato in passato, oppure 'none' (nessun feed: solo scraping)
  let xml=null,fu=url,t=null;
  if(hint&&hint!=='none'){try{const x=await get(hint);if(isXml(x)){xml=x;fu=hint}}catch{}}
  if(!xml){
    t=await get(url);
    if(isXml(t))xml=t;
    else{
      const $=cheerio.load(t);
      if(hint!=='none'){
        const c=[];
        $('link[rel="alternate"]').each((_,e)=>{
          const h=$(e).attr('href');
          if(h&&/rss|atom|xml/.test($(e).attr('type')||''))c.push(new URL(h,url).href);
        });
        const o=new URL(url).origin,b=url.replace(/\/$/,'');
        const wp=t.match(/https?:\/\/[^"'\s]+?(?=\/wp-content\/)/);
        try{if(wp&&new URL(wp[0]).hostname.replace(/^www\./,'')===new URL(url).hostname.replace(/^www\./,''))c.push(wp[0]+'/feed/')}catch{}
        for(const p of ['/feed/','/feed','/rss','/atom.xml','/rss.xml','/feed.xml','/index.xml'])c.push(b+p,o+p);
        try{[fu,xml]=await Promise.any([...new Set(c)].slice(0,10).map(async u=>{const x=await get(u);if(!isXml(x))throw 0;return[u,x]}))}catch{}
      }
      if(!xml)return{feedUrl:null,title:$('title').text().trim(),items:await scrapeSmart($,url)};
    }
  }
  let f=null;try{f=await parser.parseString(xml)}catch{}
  if(!f||!f.items?.length){
    const h=t||await get(url),$=cheerio.load(h);
    return{feedUrl:null,title:$('title').text().trim(),items:scrape($,url)};
  }
  const gn=fu.includes('news.google.com/rss');
  const items=f.items.slice(0,15).map(i=>{
    const html=i.full||i.content||'';
    const $=cheerio.load(html);
    const img=(i.enclosure?.type||'').startsWith('image')&&i.enclosure.url||i.media?.$?.url||i.thumb?.$?.url||$('img').first().attr('src')||'';
    const link=i.link||i.guid;
    return{id:i.guid||link,title:gn?(i.title||'').replace(/\s+-\s+[^-]+$/,'').trim():(i.title||'').trim(),link,shallow:gn,date:i.isoDate||new Date().toISOString(),
      excerpt:(i.contentSnippet||$.text()).replace(/\s+/g,' ').trim().slice(0,260),
      image:img,paras:i.full?paras(html).slice(0,80):[]};
  }).filter(i=>i.link&&i.title);
  return{feedUrl:fu,title:f.title,items};
}

// Se il sito blocca il server (403, bot detection…): ultimi articoli indicizzati da Google News per quel dominio
export async function loadViaGoogle(url){
  const host=new URL(url).hostname.replace(/^www\./,'');
  const g=`https://news.google.com/rss/search?q=${encodeURIComponent('site:'+host)}&hl=it&gl=IT&ceid=IT:it`;
  const f=await parser.parseString(await get(g));
  const items=f.items.slice(0,20).map(i=>({id:i.link,title:(i.title||'').replace(/\s+-\s+[^-]+$/,'').trim(),link:i.link,
    date:i.isoDate||new Date().toISOString(),excerpt:'',image:'',paras:[],shallow:true})).filter(i=>i.link&&i.title);
  return{feedUrl:g,title:host,items};
}
