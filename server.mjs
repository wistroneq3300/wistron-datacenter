import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),port=Number(process.env.PORT||4300);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end('Invalid path');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.stat(file,(err,s)=>{if(err||!s.isFile()){res.writeHead(404);res.end('Not found');return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',s.size);res.setHeader('Cache-Control',path.extname(file)==='.glb'?'public, max-age=86400':'no-cache');fs.createReadStream(file).pipe(res);});
}).listen(port,'0.0.0.0',()=>console.log(`Wistron Studio: http://localhost:${port}`));
