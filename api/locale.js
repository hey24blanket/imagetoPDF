export default function handler(req,res){
 const marker=new URL(req.url||'/', 'https://blanket.invalid').searchParams.get('blanket_traffic');
 const traffic=['owner','test','external'].includes(marker)?'?blanket_traffic='+marker:'';

 const cookie=req.headers.cookie||'';
 const preferred=cookie.match(/(?:^|;\s*)print-language=(ko|en)(?:;|$)/)?.[1];
 const language=preferred||(req.headers['x-vercel-ip-country']==='KR'?'ko':'en');
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie, X-Vercel-IP-Country');res.statusCode=307;res.setHeader('Location',`/${language}/${traffic}`);res.end();
}
