const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('file://'+process.cwd()+'/scene.html');await p.waitForTimeout(500);
fs.mkdirSync('frames',{recursive:true});const FPS=30;const N=60*FPS;
const only=process.argv[2]?process.argv[2].split(',').map(Number):null;
for(let i=0;i<N;i++){if(only&&!only.includes(i))continue;await p.evaluate(t=>render(t),i/FPS);await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.png`,type:'png'});}
await b.close();})();
