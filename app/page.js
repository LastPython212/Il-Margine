'use client';
import {useState,useEffect,useMemo,useCallback} from 'react';
import {SEEDS,CATS} from '../lib/sources';

// Persistenza: tutto passa da queste due funzioni → sostituibili con Supabase/SQLite.
const store={
  get:(k,d)=>{try{return JSON.parse(localStorage.getItem('im.'+k))??d}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem('im.'+k,JSON.stringify(v))}catch{}}
};
const norm=u=>{try{const x=new URL(u);return(x.host+x.pathname+(x.hash.startsWith('#im-')?x.hash:'')).replace(/\/$/,'').toLowerCase()}catch{return u}};
const fmt=d=>new Date(d).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});
const host=u=>{try{return new URL(u).hostname.replace('www.','')}catch{return u}};
const fix=u=>/^https?:\/\//i.test(u)?u:'https://'+u;
function merge(prev,next){
  const m=new Map();
  for(const i of [...next,...prev]){
    const k=norm(i.link),t=i.title.toLowerCase();
    if(!m.has(k)&&![...m.values()].some(x=>x.title.toLowerCase()===t&&x.src===i.src))m.set(k,i);
  }
  return [...m.values()].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,800);
}
function download(name,text,type='text/plain'){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();
}

export default function Home(){
  const [ready,setReady]=useState(false);
  const [sources,setSources]=useState(SEEDS);
  const [items,setItems]=useState([]);
  const [saved,setSaved]=useState([]);
  const [dark,setDark]=useState(false);
  const [view,setView]=useState('grid');
  const [q,setQ]=useState('');const [cat,setCat]=useState('Tutte');const [src,setSrc]=useState('');const [tab,setTab]=useState('all');
  const [loading,setLoading]=useState(false);const [prog,setProg]=useState({done:0,total:0});const [note,setNote]=useState('');const [status,setStatus]=useState({});
  const [reader,setReader]=useState(null);const [modal,setModal]=useState(false);

  const refresh=useCallback(async(list,force=false)=>{
    const FRESH=15*60*1000;
    const todo=list.filter(s=>s.on&&(force||!s.last||Date.now()-s.last>FRESH));
    if(!todo.length){setNote('Tutte le fonti sono già aggiornate (meno di 15 minuti fa). Usa “Aggiorna tutto” per forzare.');return;}
    setNote('');setLoading(true);setProg({done:0,total:todo.length});
    setStatus(s=>({...s,...Object.fromEntries(todo.map(x=>[x.url,'In corso…']))}));
    let k=0;
    const worker=async()=>{
      while(k<todo.length){
        const src=todo[k++];
        const feed=force&&src.feed==='none'?undefined:src.feed;
        const r=await fetch('/api/feed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls:[{url:src.url,feed}]})}).then(r=>r.json()).catch(()=>({results:[{url:src.url,ok:false,error:'Errore di rete o timeout',items:[]}]}));
        for(const x of r.results||[]){
          setStatus(s=>({...s,[x.url]:x.ok?(x.items.length?`${x.feedUrl?'Feed':'Scraping'} ✓ ${x.items.length} articoli`:'Nessun articolo trovato'):x.error}));
          if(x.ok)setSources(s=>s.map(a=>a.url===x.url?{...a,last:Date.now(),feed:x.feedUrl||'none',name:a.auto&&!a.seed&&x.title?x.title:a.name}:a));
          setItems(p=>merge(p,x.items.map(it=>({...it,src:x.url}))));
        }
        setProg(p=>({...p,done:p.done+1}));
      }
    };
    await Promise.all(Array.from({length:Math.min(6,todo.length)},worker));
    setLoading(false);
  },[]);

  useEffect(()=>{
    const s0=store.get('sources',SEEDS);
    const have=new Set(s0.map(x=>norm(x.url)));
    const s=store.get('seedv',0)<3?[...s0,...SEEDS.filter(x=>!have.has(norm(x.url)))]:s0;
    store.set('seedv',3);
    setSources(s);setItems(store.get('items',[]));setStatus(Object.fromEntries(Object.entries(store.get('status',{})).filter(([,v])=>v!=='In corso…')));setSaved(store.get('saved',[]));
    setDark(store.get('dark',matchMedia('(prefers-color-scheme: dark)').matches));
    setView(store.get('view','grid'));setReady(true);refresh(s);
  },[refresh]);
  useEffect(()=>{if(ready){store.set('sources',sources);store.set('saved',saved);store.set('view',view);store.set('dark',dark);store.set('items',items.slice(0,300));store.set('status',status)}},[ready,sources,saved,view,dark,items,status]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light'},[dark]);

  const smap=useMemo(()=>Object.fromEntries(sources.map(s=>[s.url,s])),[sources]);
  const savedIds=useMemo(()=>new Set(saved.map(i=>norm(i.link))),[saved]);
  const list=useMemo(()=>{
    const base=tab==='saved'?saved:items.filter(i=>smap[i.src]?.on);
    const t=q.trim().toLowerCase();
    return base.filter(i=>(cat==='Tutte'||smap[i.src]?.cat===cat)&&(!src||i.src===src)&&(!t||(i.title+' '+i.excerpt).toLowerCase().includes(t)));
  },[items,saved,smap,tab,q,cat,src]);

  const toggleSave=i=>setSaved(s=>savedIds.has(norm(i.link))?s.filter(x=>norm(x.link)!==norm(i.link)):[i,...s]);
  const openReader=async i=>{
    setReader({...i,loading:i.paras.length<3&&!i.shallow});
    if(i.paras.length<3&&!i.shallow){
      const r=await fetch('/api/article?url='+encodeURIComponent(i.link)).then(r=>r.json()).catch(()=>({paras:[]}));
      setReader(c=>c&&c.link===i.link?{...c,loading:false,paras:r.paras?.length?r.paras:[i.excerpt],image:c.image||r.image}:c);
    }
  };

  const addSources=(entries,c)=>{
    const have=new Set(sources.map(s=>norm(s.url)));const add=[];
    for(const e of entries){
      const url=fix(e.url.trim());
      try{new URL(url)}catch{continue}
      if(have.has(norm(url)))continue;
      have.add(norm(url));add.push({url,name:e.name||host(url),cat:e.cat||c,on:true,auto:true});
    }
    if(add.length){setSources(s=>[...s,...add]);refresh(add)}
    return add.length;
  };
  const exportSaved=fmt2=>{
    if(fmt2==='md')download('preferiti.md',saved.map(i=>`- [${i.title}](${i.link})`).join('\n'));
    else download('preferiti.csv','titolo,link\n'+saved.map(i=>`"${i.title.replace(/"/g,'""')}",${i.link}`).join('\n'),'text/csv');
  };

  return(<>
    <header>
      <div className="logo">Il <b>Margine</b></div>
      <input type="search" placeholder="Cerca: AIE, Salone del Libro, classifiche…" value={q} onChange={e=>setQ(e.target.value)} style={{flex:'1 1 220px',maxWidth:420}}/>
      <button className="btn" onClick={()=>{const v=view==='grid'?'list':'grid';setView(v)}} title="Cambia vista">{view==='grid'?'☰ Lista':'▦ Griglia'}</button>
      <button className="btn" onClick={()=>setDark(!dark)}>{dark?'☀':'☾'}</button>
      <button className="btn on" onClick={()=>refresh(sources)} disabled={loading}>{loading?`Aggiorno… ${prog.done}/${prog.total}`:'↻ Aggiorna Feed'}</button>
      <button className="btn" onClick={()=>refresh(sources,true)} disabled={loading} title="Ricarica tutte le fonti, anche quelle appena aggiornate">Aggiorna tutto</button>
      <button className="btn pri" onClick={()=>setModal(true)}>＋ Gestisci fonti</button>
    </header>
    <div className="bar">
      <button className={'chip '+(tab==='all'?'on':'')} onClick={()=>setTab('all')}>Tutte</button>
      <button className={'chip '+(tab==='saved'?'on':'')} onClick={()=>setTab('saved')}>★ Preferiti ({saved.length})</button>
      <span style={{width:12}}/>
      {['Tutte',...CATS].map(c=><button key={c} className={'chip '+(cat===c?'on':'')} onClick={()=>setCat(c)}>{c}</button>)}
      <select value={src} onChange={e=>setSrc(e.target.value)} style={{marginLeft:'auto'}}>
        <option value="">Tutte le fonti</option>
        {sources.filter(s=>s.on).map(s=><option key={s.url} value={s.url}>{s.name}</option>)}
      </select>
      {tab==='saved'&&saved.length>0&&<>
        <button className="btn" onClick={()=>exportSaved('md')}>Esporta .md</button>
        <button className="btn" onClick={()=>exportSaved('csv')}>Esporta .csv</button></>}
    </div>
    <main>{note&&<div style={{color:'var(--mut)',padding:'4px 0 14px'}}>{note}</div>}
      {!list.length&&<div className="empty">{loading?`Carico le notizie… ${prog.done}/${prog.total} fonti controllate`:tab==='saved'?'Nessun preferito: tocca ☆ su un articolo.':'Nessun articolo trovato.'}</div>}
      <div className={view==='grid'?'grid':'list'}>
        {list.map(i=>(
          <article key={i.link} className="card" onClick={()=>openReader(i)}>
            {i.image&&<img src={i.image} alt="" loading="lazy" onError={e=>e.target.style.display='none'}/>}
            <div className="b">
              <div className="meta"><span>{smap[i.src]?.name||host(i.link)}</span><span>·</span><span>{fmt(i.date)}</span>
                <button className="star" onClick={e=>{e.stopPropagation();toggleSave(i)}}>{savedIds.has(norm(i.link))?'★':'☆'}</button></div>
              <h3>{i.title}</h3>
              {i.excerpt&&<p>{i.excerpt.slice(0,150)}{i.excerpt.length>150?'…':''}</p>}
            </div>
          </article>))}
      </div>
    </main>

    {reader&&<div className="ov" onClick={()=>setReader(null)}>
      <div className="drawer" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',gap:8}}>
          <button className="btn" onClick={()=>setReader(null)}>✕ Chiudi</button>
          <button className="btn" onClick={()=>toggleSave(reader)}>{savedIds.has(norm(reader.link))?'★ Salvato':'☆ Salva'}</button>
          <a className="btn pri" href={reader.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none',marginLeft:'auto'}}>Apri originale ↗</a>
        </div>
        <div className="meta" style={{marginTop:20}}>{smap[reader.src]?.name} · {fmt(reader.date)}</div>
        <h1>{reader.title}</h1>
        {reader.image&&<img src={reader.image} alt=""/>}
        {reader.loading&&<p>Carico il testo…</p>}
        {reader.paras.map((p,k)=>p.startsWith('## ')?<h2 key={k}>{p.slice(3)}</h2>:<p key={k}>{p}</p>)}
      </div>
    </div>}

    {modal&&<SourcesModal {...{sources,setSources,status,addSources,onClose:()=>setModal(false)}}/>}
  </>);
}

function SourcesModal({sources,setSources,status,addSources,onClose}){
  const [url,setUrl]=useState('');const [cat,setCat]=useState(CATS[0]);const [bulk,setBulk]=useState('');const [msg,setMsg]=useState('');
  const upd=(u,p)=>setSources(s=>s.map(x=>x.url===u?{...x,...p}:x));
  const importText=(text,name)=>{
    let entries=[];
    if(/<opml/i.test(text)){
      const d=new DOMParser().parseFromString(text,'text/xml');
      d.querySelectorAll('outline').forEach(o=>{
        const u=o.getAttribute('xmlUrl')||o.getAttribute('xmlurl');
        if(u)entries.push({url:u,name:o.getAttribute('title')||o.getAttribute('text')});
      });
    }else entries=(text.match(/https?:\/\/[^\s,;"'<>]+|(?:^|[\s,;])(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s,;"'<>]*)?/gim)||[]).map(u=>({url:u.trim().replace(/^[,;]/,'')}));
    setMsg(`${addSources(entries,cat)} nuove fonti aggiunte${name?' da '+name:''}.`);
  };
  return(<div className="ov" style={{justifyContent:'center'}} onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex'}}><h2 style={{margin:0,fontFamily:'Lora,serif'}}>Gestisci fonti</h2><button className="btn" style={{marginLeft:'auto'}} onClick={onClose}>✕</button></div>
      <p style={{color:'var(--mut)'}}>Incolla un URL di feed (RSS/Atom) o di un sito: il feed viene rilevato automaticamente (<code>&lt;link rel=alternate&gt;</code>, /feed, /rss, /atom.xml) o, in mancanza, si estraggono i titoli dalla pagina.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <input style={{flex:'1 1 220px'}} placeholder="https://esempio.it" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(importText(url),setUrl(''))}/>
        <select value={cat} onChange={e=>setCat(e.target.value)}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
        <button className="btn pri" onClick={()=>{importText(url);setUrl('')}}>Aggiungi</button>
      </div>
      <details style={{margin:'12px 0'}}><summary style={{cursor:'pointer'}}>Importazione massiva (lista URL, OPML, CSV)</summary>
        <textarea rows={4} style={{width:'100%',marginTop:8}} placeholder="Un URL per riga…" value={bulk} onChange={e=>setBulk(e.target.value)}/>
        <div style={{display:'flex',gap:8,marginTop:6}}>
          <button className="btn" onClick={()=>{importText(bulk);setBulk('')}}>Importa lista</button>
          <input type="file" accept=".opml,.xml,.csv,.txt" onChange={async e=>{const f=e.target.files[0];if(f)importText(await f.text(),f.name);e.target.value=''}}/>
        </div></details>
      {msg&&<p className="ok">{msg}</p>}
      <p style={{fontSize:13,color:'var(--mut)'}}>Fonti attive con articoli: {sources.filter(s=>s.on&&status[s.url]?.includes('✓')).length} / {sources.filter(s=>s.on).length}</p>
      {sources.map(s=><div className="row" key={s.url}>
        <input type="checkbox" checked={s.on} onChange={e=>upd(s.url,{on:e.target.checked})} title="Attiva/disattiva"/>
        <div className="n"><b>{s.name}</b><div style={{fontSize:12,color:'var(--mut)'}}>{host(s.url)} · <span className={status[s.url]?.includes('✓')?'ok':status[s.url]==='In corso…'?'':'err'}>{status[s.url]||''}</span></div></div>
        <select value={s.cat} onChange={e=>upd(s.url,{cat:e.target.value})} style={{maxWidth:170}}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
        <button className="btn" onClick={()=>setSources(x=>x.filter(a=>a.url!==s.url))} title="Elimina">🗑</button>
      </div>)}
    </div>
  </div>);
}
