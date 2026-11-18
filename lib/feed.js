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
        for(const p of ['/feed/','/feed','/rss','/atom.xml','/rss.xml','/feed.xml','/index.xml'])c.push(b+p,o+p);
        try{[fu,xml]=await Promise.any([...new Set(c)].slice(0,10).map(async u=>{const x=await get(u);if(!isXml(x))throw 0;return[u,x]}))}catch{}
      }
      if(!xml)return{feedUrl:null,title:$('title').text().trim(),items:scrape($,url)};
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
