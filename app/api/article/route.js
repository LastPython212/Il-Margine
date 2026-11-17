import {NextResponse} from 'next/server';
import * as cheerio from 'cheerio';
import {get,paras} from '../../../lib/feed';
export async function GET(req){
  try{
    const url=new URL(req.url).searchParams.get('url');
    const $=cheerio.load(await get(url));
    const image=$('meta[property="og:image"]').attr('content')||'';
    $('script,style,nav,header,footer,aside,form,.comments,#comments').remove();
    const root=$('article').first().length?$('article').first():$('main').first().length?$('main').first():$('body');
    return NextResponse.json({image,paras:paras(root.html()).slice(0,120)});
  }catch(e){return NextResponse.json({paras:[],error:String(e.message)})}
}
