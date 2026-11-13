import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Serve public application files, never the checkout or the caller's cwd.
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4300),host=process.env.HOST||'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.hdr':'application/octet-stream','.exr':'image/x-exr','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2','.otf':'font/otf','.webm':'video/webm'};
const entry=new Set(['/index.html','/app.js','/styles.css','/v2.css','/v3.css','/v5.css']);
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Invalid path');return;}
  if(pathname==='/')pathname='/index.html';
  const test=process.env.TEST_MODE==='1'&&(/^\/tests\/v[235]\/[^/]+\.html$/.test(pathname)||/^\/docs\/phase(0|1-2|3-4|5a)\//.test(pathname));
  const allowed=entry.has(pathname)||/^\/(assets|vendor|modules|data)\//.test(pathname)||test;
  if(!allowed||pathname.split(/[\\/]/).some(p=>p.startsWith('.'))||!types[path.extname(pathname)]){res.writeHead(404);res.end('Not found');return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.realpath(file,(error,real)=>{
    if(error||!real.startsWith(root+path.sep)){res.writeHead(404);res.end('Not found');return;}
    fs.stat(real,(err,s)=>{if(err||!s.isFile()){res.writeHead(404);res.end('Not found');return;}
      res.setHeader('Content-Type',types[path.extname(real)]);res.setHeader('Content-Length',s.size);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control',path.extname(real)==='.glb'?'public, max-age=86400':'no-cache');res.setHeader('Accept-Ranges','bytes');
      let range;
      if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);let start=NaN,end=NaN;if(match&&(match[1]||match[2])){start=match[1]?Number(match[1]):Math.max(0,s.size-Number(match[2]));end=match[1]&&match[2]?Math.min(Number(match[2]),s.size-1):s.size-1;}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=s.size){res.removeHeader('Content-Length');res.writeHead(416,{'Content-Range':`bytes */${s.size}`});res.end();return;}range={start,end};res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${s.size}`);res.setHeader('Content-Length',end-start+1);
      }
      if(req.method==='HEAD'){res.end();return;}const stream=fs.createReadStream(real,range);stream.on('error',()=>res.destroy());stream.pipe(res);
    });
  });
}).listen(port,host,()=>console.log(`Wistron Studio: http://${host}:${port}`));
