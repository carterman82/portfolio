import { SEGMENTS, createSoftCard, moveSoftCard, grabSoftCard, pinSoftCard, stepSoftCards } from './soft-card.js';
import { cardTexture } from './card-texture.js';

const toggle = document.querySelector('#jello-toggle');
const toolbar = toggle.parentElement;
const help = document.querySelector('#jello-help');
const panels = [...document.querySelectorAll('#info-verse .article-preview, #bagelcomics .article-preview')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
let bodies=[], layer, toolbarSlot, frame=0, last=0, accumulator=0, quiet=0, active=false;
let world;
function measure() {
  world = { width: innerWidth, floor: document.querySelector('#servers').getBoundingClientRect().top+scrollY, top: document.querySelector('#projects > .wrap').getBoundingClientRect().top+scrollY+8 };
  layer.style.height = `${world.floor}px`;
  layer.style.clipPath = `inset(${world.top}px 0 0 0)`;
}
function syncPageGeometry() {
  if(!active)return;
  const previous=world;measure();
  if(!previous)return;
  const dy=world.top-previous.top;
  if(Math.abs(dy)>.1)for(const b of bodies){
    moveSoftCard(b.physics,0,dy);
    if(b.physics.grab)b.physics.grab.y+=dy;
    paint(b);
  }
  if(Math.abs(dy)>.1||Math.abs(world.floor-previous.floor)>.1)wake();
}
// Images, fonts and other sections can change page coordinates without a
// window resize. Keep the physics in the website showcase's coordinate space.
const layoutObserver=new ResizeObserver(syncPageGeometry);
for(const element of [document.body,document.querySelector('#projects'),document.querySelector('#projects > .wrap'),document.querySelector('#servers')])layoutObserver.observe(element);
function size(b) {
  const width=b.placeholder.getBoundingClientRect().width;
  b.w=width;b.h=b.height*width/b.width;
}
function paint(b) {
  const points=b.physics.points;
  const left=Math.floor(Math.min(...points.map(p=>p.x)))-2,top=Math.floor(Math.min(...points.map(p=>p.y)))-2;
  const width=Math.ceil(Math.max(...points.map(p=>p.x)))-left+2,height=Math.ceil(Math.max(...points.map(p=>p.y)))-top+2;
  const dpr=Math.min(devicePixelRatio||1,2),canvas=b.canvas;
  if(canvas.width!==Math.ceil(width*dpr))canvas.width=Math.ceil(width*dpr);
  if(canvas.height!==Math.ceil(height*dpr))canvas.height=Math.ceil(height*dpr);
  canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
  b.shell.style.transform=`translate(${left}px,${top}px)`;
  const edge=b.physics.perimeter.map(i=>points[i]);
  canvas.style.clipPath=`polygon(${edge.map(p=>`${p.x-left}px ${p.y-top}px`).join(',')})`;
  const ctx=b.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  ctx.save();ctx.beginPath();edge.forEach((p,i)=>i?ctx.lineTo(p.x-left,p.y-top):ctx.moveTo(p.x-left,p.y-top));ctx.closePath();ctx.clip();
  for(const tile of b.tiles) {
    const ps=tile.indices.map(i=>({x:points[i].x-left,y:points[i].y-top}));
    const [p,q,r]=ps,tw=b.width/SEGMENTS,th=b.height/SEGMENTS;
    const a=tile.lower?(q.x-r.x)/tw:(q.x-p.x)/tw,bb=tile.lower?(q.y-r.y)/tw:(q.y-p.y)/tw;
    const c=tile.lower?(r.x-p.x)/th:(r.x-q.x)/th,d=tile.lower?(r.y-p.y)/th:(r.y-q.y)/th;
    const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
    ctx.save();ctx.beginPath();
    ps.forEach((point,i)=>{const dx=point.x-center.x,dy=point.y-center.y,length=Math.hypot(dx,dy)||1;const x=point.x+dx/length,y=point.y+dy/length;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.closePath();ctx.clip();
    ctx.transform(a,bb,c,d,p.x,p.y);
    // Sample just this cell (plus overlap), rather than resampling the entire
    // card hundreds of times per frame as the mesh density increases.
    const sx=Math.max(0,tile.col*tw-2),sy=Math.max(0,tile.row*th-2);
    const sw=Math.min(b.width,(tile.col+1)*tw+2)-sx,sh=Math.min(b.height,(tile.row+1)*th+2)-sy;
    const textureScaleX=b.texture.width/b.width,textureScaleY=b.texture.height/b.height;
    ctx.drawImage(b.texture,sx*textureScaleX,sy*textureScaleY,sw*textureScaleX,sh*textureScaleY,sx-tile.col*tw,sy-tile.row*th,sw,sh);ctx.restore();
  }
  ctx.restore();
}
function wake() {
  quiet=0;
  if(active&&!frame&&!document.hidden) {last=performance.now();accumulator=0;frame=requestAnimationFrame(tick);}
}
function tick(now) {
  frame=0;
  accumulator+=Math.min((now-last)/1000,.05);last=now;
  const previous=bodies.flatMap(b=>b.physics.points.map(p=>({x:p.x,y:p.y})));
  while(accumulator>=1/120) {
    stepSoftCards(bodies.map(b=>b.physics),world,reduced.matches);
    accumulator-=1/120;
  }
  let displacement=0,index=0;
  for(const b of bodies) {
    for(const p of b.physics.points) {const old=previous[index++];displacement=Math.max(displacement,Math.hypot(p.x-old.x,p.y-old.y));}
    paint(b);
  }
  quiet=displacement<.12&&!bodies.some(b=>b.drag)?quiet+1:0;
  if(quiet<90) frame=requestAnimationFrame(tick);
}
// Invert the bilinear surface to keep the exact grabbed location attached.
function pick(b,x,y) {
  let best={distance:Infinity,u:.5,v:.5};
  for(const tile of b.tiles) {
  if(tile.lower)continue;
  const i=tile.row*(SEGMENTS+1)+tile.col;
  const [p,q,r,s]=[i,i+1,i+SEGMENTS+2,i+SEGMENTS+1].map(i=>b.physics.points[i]);
  let u=.5,v=.5;
  for(let i=0;i<8;i++) {
    const ex=p.x*(1-u)*(1-v)+q.x*u*(1-v)+r.x*u*v+s.x*(1-u)*v-x;
    const ey=p.y*(1-u)*(1-v)+q.y*u*(1-v)+r.y*u*v+s.y*(1-u)*v-y;
    const ux=(q.x-p.x)*(1-v)+(r.x-s.x)*v,uy=(q.y-p.y)*(1-v)+(r.y-s.y)*v;
    const vx=(s.x-p.x)*(1-u)+(r.x-q.x)*u,vy=(s.y-p.y)*(1-u)+(r.y-q.y)*u;
    const determinant=ux*vy-uy*vx;if(Math.abs(determinant)<.001) break;
    u-=(ex*vy-ey*vx)/determinant;v-=(ey*ux-ex*uy)/determinant;
  }
  const a=clamp(u,0,1),c=clamp(v,0,1);
  const px=p.x*(1-a)*(1-c)+q.x*a*(1-c)+r.x*a*c+s.x*(1-a)*c;
  const py=p.y*(1-a)*(1-c)+q.y*a*(1-c)+r.y*a*c+s.y*(1-a)*c;
  const distance=Math.hypot(px-x,py-y);
  if(distance<best.distance)best={distance,u:(tile.col+a)/SEGMENTS,v:(tile.row+c)/SEGMENTS};
  }
  return [best.u,best.v];
}
function wire(b) {
  b.shell.addEventListener('dragstart',e=>e.preventDefault());
  b.shell.addEventListener('click',e=>{
    if(b.suppressClick&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();b.suppressClick=false;}
    else if(e.target===b.canvas)b.panel.click();
  },true);
  b.shell.addEventListener('pointerdown',e=>{
    if(e.button!==0||b.drag)return;
    b.canvas.setPointerCapture(e.pointerId);b.suppressClick=false;
    b.drag={id:e.pointerId,x:e.pageX,y:e.pageY,time:e.timeStamp};
    const [u,v]=pick(b,e.pageX,e.pageY);
    grabSoftCard(b.physics,u,v,e.pageX,e.pageY);
    b.shell.style.zIndex='2';b.shell.classList.add('is-dragging');wake();
  });
  b.shell.addEventListener('pointermove',e=>{
    if(!b.drag||b.drag.id!==e.pointerId)return;
    if(!b.suppressClick&&Math.hypot(e.pageX-b.drag.x,e.pageY-b.drag.y)<5)return;
    b.suppressClick=true;b.drag.time=e.timeStamp;
    const grab=b.physics.grab;
    grab.x=clamp(e.pageX,20,world.width-20);grab.y=clamp(e.pageY,world.top+8,world.floor-4);
    // Apply the pointer constraint now; the rest follows through the springs.
    pinSoftCard(b.physics,world);
    paint(b);wake();
  });
  const release=e=>{
    if(!b.drag||b.drag.id!==e.pointerId)return;
    if(e.type!=='pointerup'||e.timeStamp-b.drag.time>100||reduced.matches) for(const p of b.physics.points){p.px=p.x;p.py=p.y;}
    b.physics.grab=null;b.drag=null;b.shell.style.zIndex='';b.shell.classList.remove('is-dragging');wake();
  };
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>b.shell.addEventListener(type,release));
  b.shell.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target===b.shell){e.preventDefault();b.panel.click();return;}
    const delta={ArrowLeft:[-32,0],ArrowRight:[32,0],ArrowUp:[0,-64],ArrowDown:[0,32]}[e.key];
    if(!delta)return;e.preventDefault();
    const ps=b.physics.points;
    const dx=clamp(delta[0],16-Math.min(...ps.map(p=>p.x)),world.width-16-Math.max(...ps.map(p=>p.x)));
    const dy=clamp(delta[1],world.top-Math.min(...ps.map(p=>p.y)),world.floor-Math.max(...ps.map(p=>p.y)));
    moveSoftCard(b.physics,dx,dy);paint(b);wake();
  });
}
function reset() {
  active=false;cancelAnimationFrame(frame);frame=0;
  for(const b of bodies){b.panel.classList.remove('jello-original','jello-source');if(b.style===null)b.panel.removeAttribute('style');else b.panel.setAttribute('style',b.style);b.placeholder.replaceWith(b.panel);}
  layer?.remove();bodies=[];toolbar.classList.remove('is-active');
  toolbarSlot?.remove();toolbarSlot=undefined;
  toggle.textContent='Jelloify';toggle.setAttribute('aria-pressed','false');help.textContent='Give these cards a little gravity.';
}
toggle.addEventListener('click',async()=>{
  if(active){reset();return;}
  toggle.disabled=true;toggle.textContent='Softening cards…';
  let textures;
  try { textures=await Promise.all(panels.map(cardTexture)); }
  catch { help.textContent='Could not prepare the cards. Please try again.';toggle.textContent='Jelloify';toggle.disabled=false;return; }
  toggle.disabled=false;
  // Snapshot every source position before reparenting any card. Mixing viewport
  // rects taken before a mutation with scrollY after anchoring can misplace them.
  const pageX=scrollX,pageY=scrollY;
  const starts=panels.map(panel=>{const rect=panel.getBoundingClientRect();return {x:rect.left+pageX,y:rect.top+pageY,width:rect.width,height:rect.height,style:panel.getAttribute('style')};});
  // Preserve the controls' space when the restore control becomes fixed, so
  // activation changes neither page height nor the browser's scroll anchor.
  toolbarSlot=document.createElement('div');
  toolbarSlot.style.height=`${toolbar.getBoundingClientRect().height}px`;
  toolbarSlot.style.marginTop=getComputedStyle(toolbar).marginTop;
  toolbarSlot.setAttribute('aria-hidden','true');toolbar.before(toolbarSlot);
  active=true;layer=document.createElement('div');layer.className='jello-layer';document.body.append(layer);
  bodies=panels.map((panel,index)=>{
    const start=starts[index],style=start.style;
    const placeholder=document.createElement('div');placeholder.style.height=`${start.height}px`;panel.replaceWith(placeholder);
    const shell=document.createElement('div');shell.className='jello-body';shell.tabIndex=0;shell.setAttribute('role','group');
    shell.setAttribute('aria-label',`${panel.querySelector('h4').textContent}. Drag anywhere or use arrow keys to move. Escape restores layout.`);
    const width=textures[index].width;panel.classList.add('jello-original');panel.style.width=`${width}px`;
    shell.append(panel);layer.append(shell);
    const height=textures[index].height,tiles=[];
    const canvas=document.createElement('canvas');canvas.className='jello-surface';canvas.setAttribute('aria-hidden','true');shell.append(canvas);
    // One continuous raster surface avoids compositing seams between cells.
    for(let row=0;row<SEGMENTS;row++)for(let col=0;col<SEGMENTS;col++) {
      for(const lower of [false,true]) {
      const i=row*(SEGMENTS+1)+col;
      tiles.push({row,col,lower,indices:lower?[i,i+SEGMENTS+2,i+SEGMENTS+1]:[i,i+1,i+SEGMENTS+2]});
      }
    }
    panel.classList.add('jello-source');
    const b={panel,placeholder,shell,canvas,ctx:canvas.getContext('2d'),texture:textures[index].image,tiles,style,width,height,w:start.width,h:start.height,startX:start.x,startY:start.y,drag:null};
    wire(b);return b;
  });
  toolbar.classList.add('is-active');measure();
  bodies.forEach(b=>{
    // Release from the live card's exact page bounds, with no relocation,
    // resizing or sideways kick before gravity starts the simulation.
    b.physics=createSoftCard(b.startX,b.startY,b.w,b.h);paint(b);
  });
  toggle.textContent='Restore project cards';toggle.setAttribute('aria-pressed','true');
  help.textContent='Drag anywhere to stretch and toss a card; click to visit. Arrow keys move focused cards. Escape restores the layout.';
  wake();
});
window.addEventListener('resize',()=>{
  if(!active)return;measure();
  bodies.forEach(b=>{const p=b.physics.points[0];size(b);b.physics=createSoftCard(clamp(p.x,16,innerWidth-b.w-16),clamp(p.y,world.top,world.floor-b.h),b.w,b.h);b.drag=null;b.shell.classList.remove('is-dragging');paint(b);});wake();
});
document.addEventListener('keydown',e=>{if(active&&e.key==='Escape'){reset();toggle.focus({preventScroll:true});}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;for(const b of bodies){b.physics.grab=null;b.drag=null;b.shell.classList.remove('is-dragging');}}else wake();});
