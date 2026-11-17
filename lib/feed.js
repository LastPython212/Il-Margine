import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
const H={'User-Agent':'Mozilla/5.0 (compatible; IlMargine/1.0)',Accept:'text/html,application/xml,*/*'};
const PRIVATE=/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/;
export async function get(u){
  const x=new URL(u);
  if(!/^https?:$/.test(x.protocol)||PRIVATE.test(x.hostname))throw new Error('URL non consentito');
  const r=await fetch(u,{headers:H,signal:AbortSignal.timeout(10000),redirect:'follow'});
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
  return out.slice(0,15);
}
export async function loadSource(url){
  const t=await get(url);let xml=null,fu=url;
  if(isXml(t))xml=t;
  else{
    const $=cheerio.load(t);const c=[];
    $('link[rel="alternate"]').each((_,e)=>{
      const h=$(e).attr('href');
      if(h&&/rss|atom|xml/.test($(e).attr('type')||''))c.push(new URL(h,url).href);
    });
    const o=new URL(url).origin,b=url.replace(/\/$/,'');
    for(const p of ['/feed','/rss','/feed.xml','/rss.xml','/atom.xml','/index.xml'])c.push(b+p,o+p);
    for(const u of [...new Set(c)].slice(0,10)){
      try{const x=await get(u);if(isXml(x)){xml=x;fu=u;break}}catch{}
    }
    if(!xml)return{feedUrl:null,title:$('title').text().trim(),items:scrape($,url)};
  }
  const f=await parser.parseString(xml);
  const items=f.items.slice(0,15).map(i=>{
    const html=i.full||i.content||'';
    const $=cheerio.load(html);
    const img=(i.enclosure?.type||'').startsWith('image')&&i.enclosure.url||i.media?.$?.url||i.thumb?.$?.url||$('img').first().attr('src')||'';
    const link=i.link||i.guid;
    return{id:i.guid||link,title:(i.title||'').trim(),link,date:i.isoDate||new Date().toISOString(),
      excerpt:(i.contentSnippet||$.text()).replace(/\s+/g,' ').trim().slice(0,260),
      image:img,paras:i.full?paras(html).slice(0,80):[]};
  }).filter(i=>i.link&&i.title);
  return{feedUrl:fu,title:f.title,items};
}
