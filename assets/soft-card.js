// A 9×9 spring lattice gives each edge eight flexible spans instead of four.
export const SEGMENTS = 8;
const stride = SEGMENTS + 1;
export function createSoftCard(x, y, w, h, vx = 0) {
  const points = [], links = [], cells = [], perimeter = [];
  for (let row = 0; row <= SEGMENTS; row++) for (let col = 0; col <= SEGMENTS; col++) {
    const px = x + col * w / SEGMENTS, py = y + row * h / SEGMENTS;
    points.push({ x: px, y: py, px: px - vx / 120, py });
  }
  const link = (a, b, stiffness) => links.push({ a, b, stiffness, length: Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y) });
  for (let row = 0; row <= SEGMENTS; row++) for (let col = 0; col <= SEGMENTS; col++) {
    const i = row * stride + col;
    if (col < SEGMENTS) link(i,i+1,.4);
    if (row < SEGMENTS) link(i,i+stride,.4);
    // Diagonal and bending springs hold the shape while allowing soft ripples.
    if (col < SEGMENTS && row < SEGMENTS) {
      link(i,i+stride+1,.16);link(i+1,i+stride,.16);
      cells.push([i,i+1,i+stride+1,i+stride]);
    }
    if (col < SEGMENTS-1) link(i,i+2,.1);
    if (row < SEGMENTS-1) link(i,i+2*stride,.1);
  }
  for(let i=0;i<SEGMENTS;i++)perimeter.push(i);
  for(let i=0;i<SEGMENTS;i++)perimeter.push(i*stride+SEGMENTS);
  for(let i=SEGMENTS;i>0;i--)perimeter.push(SEGMENTS*stride+i);
  for(let i=SEGMENTS;i>0;i--)perimeter.push(i*stride);
  return { points, links, cells, perimeter, safe:points.map(p=>({x:p.x,y:p.y})), particleRadius:Math.min(w,h)/SEGMENTS*.18, cellArea:w*h/(SEGMENTS*SEGMENTS), grab:null };
}
export function moveSoftCard(body,dx,dy) {
  for(const p of body.points){p.x+=dx;p.px+=dx;p.y+=dy;p.py+=dy;}
  for(const p of body.safe){p.x+=dx;p.y+=dy;}
}
export function grabSoftCard(body,u,v,x,y) {
  const col=Math.min(SEGMENTS-1,Math.floor(u*SEGMENTS)),row=Math.min(SEGMENTS-1,Math.floor(v*SEGMENTS));
  const a=u*SEGMENTS-col,b=v*SEGMENTS-row,i=row*stride+col;
  const weights=Array(body.points.length).fill(0);
  weights[i]=(1-a)*(1-b);weights[i+1]=a*(1-b);weights[i+stride+1]=a*b;weights[i+stride]=(1-a)*b;
  body.grab={weights,x,y};
}
export function pinSoftCard(body,world) {
  if(!body.grab)return;
  const {weights,x,y}=body.grab;
  // The grabbed material follows the pointer directly. Springs distribute the
  // pull through the card; neither drag speed nor deformation has a hard cap.
  for(const [axis,target,min,max] of [['x',x,world?16:-Infinity,world?world.width-16:Infinity],['y',y,world?world.top:-Infinity,world?world.floor:Infinity]]){
    // At a wall, redistribute the correction to the remaining free nodes.
    // There are at most four weighted nodes, so four saturations finish it.
    for(let attempt=0;attempt<5;attempt++){
      const error=Math.max(min,Math.min(max,target))-body.points.reduce((sum,p,i)=>sum+p[axis]*weights[i],0);
      if(Math.abs(error)<1e-9)break;
      const free=body.points.map((p,i)=>weights[i]>0&&(error>0?p[axis]<max:p[axis]>min));
      const denominator=weights.reduce((sum,w,i)=>sum+(free[i]?w*w:0),0);
      if(!denominator)break;
      body.points.forEach((p,i)=>{if(free[i])p[axis]=Math.max(min,Math.min(max,p[axis]+error*weights[i]/denominator));});
    }
  }
}
function material(body,gentle) {
  for(const {a,b,length,stiffness} of body.links) {
    const p=body.points[a],q=body.points[b],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1;
    const correction=(d-length)/d*(gentle?.85:stiffness)*.5;
    p.x+=dx*correction;p.y+=dy*correction;q.x-=dx*correction;q.y-=dy*correction;
  }
  // Each cell resists losing its volume without forcing straight outer edges.
  for(const cell of body.cells) {
    const ps=cell.map(i=>body.points[i]);
    // Use relative coordinates: page positions can be tens of thousands of px.
    const origin=ps[0];
    const area=ps.reduce((s,p,i)=>{const q=ps[(i+1)%4];return s+((p.x-origin.x)*(q.y-origin.y)-(q.x-origin.x)*(p.y-origin.y))/2;},0);
    const gs=ps.map((p,i)=>({x:(ps[(i+1)%4].y-ps[(i+3)%4].y)/2,y:(ps[(i+3)%4].x-ps[(i+1)%4].x)/2}));
    const denominator=gs.reduce((s,g)=>s+g.x*g.x+g.y*g.y,0)||1;
    const pressure=(body.cellArea-area)/denominator*(gentle?.75:area<body.cellArea*.25?.65:.3);
    ps.forEach((p,i)=>{p.x+=gs[i].x*pressure;p.y+=gs[i].y*pressure;});
  }
}
function walls(body,world,gentle) {
  for(const p of body.points) {
    const vx=p.x-p.px,vy=p.y-p.py,bounce=gentle?0:.08;
    if(p.x<16){p.x=16;p.px=p.x+Math.min(0,vx)*bounce;}
    if(p.x>world.width-16){p.x=world.width-16;p.px=p.x+Math.max(0,vx)*bounce;}
    if(p.y<world.top){p.y=world.top;p.py=p.y+Math.min(0,vy)*bounce;}
    if(p.y>world.floor){p.y=world.floor;p.py=p.y+Math.max(0,vy)*bounce;p.px=p.x-vx*.8;}
  }
}
function box(body) {
  return body.points.reduce((r,p)=>({left:Math.min(r.left,p.x),right:Math.max(r.right,p.x),top:Math.min(r.top,p.y),bottom:Math.max(r.bottom,p.y)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
}
function contacts(a,b) {
  const edge=b.perimeter.map(i=>b.points[i]);
  for(const index of a.perimeter) {
    const p=a.points[index];let inside=false,nearest;
    // Ray casting handles concave, bowed edges as well as convex cards.
    for(let i=0,j=edge.length-1;i<edge.length;j=i++) {
      const q=edge[j],r=edge[i];
      if((q.y>p.y)!==(r.y>p.y)&&p.x<(r.x-q.x)*(p.y-q.y)/(r.y-q.y)+q.x)inside=!inside;
      const dx=r.x-q.x,dy=r.y-q.y,length2=dx*dx+dy*dy||1;
      const t=Math.max(0,Math.min(1,((p.x-q.x)*dx+(p.y-q.y)*dy)/length2));
      const x=q.x+dx*t,y=q.y+dy*t,distance=Math.hypot(p.x-x,p.y-y);
      if(!nearest||distance<nearest.distance)nearest={q,r,t,x,y,distance};
    }
    if(!inside||!nearest||nearest.distance<.001)continue;
    const {q,r,t,x,y,distance}=nearest;
    const amount=Math.min(18,distance+.3)*.55,nx=(x-p.x)/distance,ny=(y-p.y)/distance;
    p.x+=nx*amount;p.y+=ny*amount;
    q.x-=nx*amount*(1-t)*.5;q.y-=ny*amount*(1-t)*.5;
    r.x-=nx*amount*t*.5;r.y-=ny*amount*t*.5;
  }
}
function hull(body) {
  const ps=body.perimeter.map(i=>body.points[i]).sort((a,b)=>a.x-b.x||a.y-b.y);
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half=points=>{const result=[];for(const p of points){while(result.length>1&&cross(result[result.length-2],result[result.length-1],p)<=0)result.pop();result.push(p);}return result;};
  const lower=half(ps),upper=half([...ps].reverse());lower.pop();upper.pop();return lower.concat(upper);
}
function separateNodes(a,b=a) {
  // Spatial buckets make point-to-point exclusion inexpensive on the dense mesh.
  const spacing=a.particleRadius+b.particleRadius,buckets=new Map();
  b.points.forEach((p,i)=>{const key=`${Math.floor(p.x/spacing)},${Math.floor(p.y/spacing)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);});
  a.points.forEach((p,i)=>{
    const x=Math.floor(p.x/spacing),y=Math.floor(p.y/spacing);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const j of buckets.get(`${x+dx},${y+dy}`)||[]){
      if(a===b&&j<=i)continue;
      const q=b.points[j],vx=q.x-p.x,vy=q.y-p.y,distance=Math.hypot(vx,vy);
      if(distance>=spacing)continue;
      // A deterministic direction also separates exactly coincident points.
      const angle=(i*31+j*17)*2.399963229728653;
      const nx=distance>1e-6?vx/distance:Math.cos(angle),ny=distance>1e-6?vy/distance:Math.sin(angle);
      const correction=(spacing-distance)*.5+.001,cx=nx*correction,cy=ny*correction;
      p.x-=cx;p.y-=cy;p.px-=cx;p.py-=cy;
      q.x+=cx;q.y+=cy;q.px+=cx;q.py+=cy;
    }
  });
}
function separateBodies(a,b) {
  // Local vertex contacts can miss crossed edges or deeply overlapping cards.
  // Convex envelopes give the whole soft body a reliable non-overlap boundary.
  const ah=hull(a),bh=hull(b);let best=Infinity,nx=0,ny=0;
  for(const polygon of [ah,bh])for(let i=0;i<polygon.length;i++) {
    const p=polygon[i],q=polygon[(i+1)%polygon.length];
    const length=Math.hypot(q.x-p.x,q.y-p.y)||1,x=(q.y-p.y)/length,y=(p.x-q.x)/length;
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const p of ah){const d=p.x*x+p.y*y;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(const p of bh){const d=p.x*x+p.y*y;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
    if(amax<=bmin||bmax<=amin)return;
    const forward=amax-bmin,backward=bmax-amin;
    const overlap=Math.min(forward,backward);
    if(overlap<best){best=overlap;nx=forward<backward?x:-x;ny=forward<backward?y:-y;}
  }
  if(!Number.isFinite(best))return;
  const weight=a.grab?.1:b.grab?.9:.5,amount=best+.4;
  moveSoftCard(a,-nx*amount*weight,-ny*amount*weight);
  moveSoftCard(b,nx*amount*(1-weight),ny*amount*(1-weight));
  // Remove inward normal velocity so contacts don't keep injecting penetration.
  for(const [body,sign] of [[a,1],[b,-1]])for(const p of body.points){
    const inward=((p.x-p.px)*nx+(p.y-p.py)*ny)*sign;
    if(inward>0){p.px+=nx*inward*sign*.85;p.py+=ny*inward*sign*.85;}
  }
}
export function stepSoftCards(bodies,world,gentle=false) {
  for(const body of bodies)for(const p of body.points) {
    const vx=(p.x-p.px)*(gentle?.8:.982),vy=(p.y-p.py)*(gentle?.8:.982);
    p.px=p.x;p.py=p.y;p.x+=Math.max(-18,Math.min(18,vx));p.y+=Math.max(-18,Math.min(18,vy))+1250/14400;
  }
  for(let iteration=0;iteration<6;iteration++) {
    for(const b of bodies){material(b,gentle);pinSoftCard(b);separateNodes(b);}
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++) {
      const a=box(bodies[i]),b=box(bodies[j]);
      if(a.right<b.left||a.left>b.right||a.bottom<b.top||a.top>b.bottom)continue;
      contacts(bodies[i],bodies[j]);contacts(bodies[j],bodies[i]);
      separateNodes(bodies[i],bodies[j]);
      separateBodies(bodies[i],bodies[j]);
    }
    for(const b of bodies)walls(b,world,gentle);
  }
  for(const b of bodies){
    // Finish with the grab after material and collision corrections so they
    // cannot leave a held point stuck behind the pointer.
    walls(b,world,gentle);
    pinSoftCard(b,world);
    // Recover only from numerical failure, never from stretching or folding.
    if(b.points.some(p=>![p.x,p.y,p.px,p.py].every(Number.isFinite))){
      b.points.forEach((p,i)=>{p.x=p.px=b.safe[i].x;p.y=p.py=b.safe[i].y;});
      b.grab=null;
    }
    b.safe=b.points.map(p=>({x:p.x,y:p.y}));
  }
}
