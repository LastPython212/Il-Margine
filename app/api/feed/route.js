import {NextResponse} from 'next/server';
import {loadSource,loadViaGoogle} from '../../../lib/feed';
export const maxDuration=60;
export async function POST(req){
  const {urls=[]}=await req.json();
  const results=await Promise.all(urls.slice(0,8).map(async e=>{
    const{url,feed}=typeof e==='string'?{url:e}:e;
    try{return{url,ok:true,...await loadSource(url,feed)}}
    catch(e){
      try{const g=await loadViaGoogle(url);if(g.items.length)return{url,ok:true,...g}}catch{}
      return{url,ok:false,error:String(e.message||e),items:[]}
    }
  }));
  return NextResponse.json({results});
}
