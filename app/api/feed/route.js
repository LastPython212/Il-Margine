import {NextResponse} from 'next/server';
import {loadSource} from '../../../lib/feed';
export const maxDuration=60;
export async function POST(req){
  const {urls=[]}=await req.json();
  const results=await Promise.all(urls.slice(0,8).map(async url=>{
    try{return{url,ok:true,...await loadSource(url)}}
    catch(e){return{url,ok:false,error:String(e.message||e),items:[]}}
  }));
  return NextResponse.json({results});
}
