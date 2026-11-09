// Paper football stadiums are painted once in field coordinates. Both tablets sample
// this same surface, rotated around the 50, so details line up at the glass edge.
export const VENUES = {
  bears:   {name:'Soldier Field',city:'Chicago, IL',team:'Bears',code:'CHI',ink:'#182631',light:'#354758',accent:'#e57939',paper:'#f6eed8',end:'#243941',mark:'C',shell:'#172536',shellHi:'#425467',helmetStripe:'#df783c'},
  packers: {name:'Lambeau Field',city:'Green Bay, WI',team:'Packers',code:'GB',ink:'#244d3b',light:'#3c6c4f',accent:'#eec64f',paper:'#fff1ce',end:'#28543f',mark:'G',shell:'#d7a32c',shellHi:'#f5d764',helmetStripe:'#275537',trousers:'#e4bb49'},
  titans:  {name:'Nissan Stadium',city:'Nashville, TN',team:'Titans',code:'TEN',ink:'#447fa9',light:'#78b9df',accent:'#c34645',paper:'#f1efe4',end:'#447b96',mark:'T',shell:'#e2e5de',shellHi:'#fff7e7',helmetStripe:'#729ebe'},
  vols:    {name:'Neyland Stadium',city:'Knoxville, TN',team:'Volunteers',code:'UT',ink:'#cf622d',light:'#ed8741',accent:'#ffae52',paper:'#fff2db',end:'#e87d36',mark:'T',shell:'#e8e5d7',shellHi:'#fff8e3',helmetStripe:'#dc742f'}
};
const aliases={chi:'bears',chicago:'bears',chicagobears:'bears',gb:'packers',gbp:'packers',greenbay:'packers',greenbaypackers:'packers',ten:'titans',tennesseetitans:'titans',ut:'vols',utk:'vols',volunteers:'vols',tennesseevolunteers:'vols',universityoftennessee:'vols'};
const keyOf=value=>{const k=String(value?.id??value??'').toLowerCase().replace(/[^a-z]/g,'');return VENUES[k]?k:(aliases[k]||'bears');};
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const TAU=Math.PI*2, HALF=80/3, A=62, B=95, TEX=10;
const cream='#efe9d1', ink='#182c2d';
function polygon(c,points,fill,stroke,width=.7) {
  c.beginPath();c.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
  c.closePath();if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function line(c,x,y,x2,y2,color,width) {
  c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function label(c,str,x,y,size,color,{rot=0,width,weight=900,align='center',family='Arial, Helvetica, sans-serif'}={}) {
  c.save();c.translate(x,y);c.rotate(rot);c.font=weight+' '+size+'px '+family;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';
  if(width)c.fillText(str,0,0,width);else c.fillText(str,0,0);c.restore();
}
function random(seed) {
  let s=seed;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};
}
function buffer(width,height) {
  const b=document.createElement('canvas');b.width=width;b.height=height;return b;
}
function stadiumAtlas(id) {
  const b=buffer(A*2*TEX,B*2*TEX),c=b.getContext('2d'),v=VENUES[id],rng=random(723+id.length*17);
  c.setTransform(TEX,0,0,TEX,A*TEX,B*TEX);c.fillStyle='#202e31';c.fillRect(-A,-B,A*2,B*2);
  // Concentric angular seating tiers, aisles, individual folded crowd cards.
  function rim(dx,dy,r) {
    return [[-dx+r,-dy],[dx-r,-dy],[dx,-dy+r],[dx,dy-r],[dx-r,dy],[-dx+r,dy],[-dx,dy-r],[-dx,-dy+r]];
  }
  const crowdColors=[v.ink,v.accent,v.light,'#f2d8a9','#c0bda5','#56706d','#455c59','#1e3335','#344a47'];
  for(let row=15;row>=0;row--){
    const dx=32.4+row*1.49,dy=64+row*1.46,r=4.2+row*.68,pts=rim(dx,dy,r);
    polygon(c,pts,row%5===0?'#7b8476':row%2?'#434d48':'#55645b','#293739',.32);
    for(let n=0;n<8;n++){
      const [x,y]=pts[n],[x2,y2]=pts[(n+1)%8],len=Math.hypot(x2-x,y2-y),nx=-(y2-y)/len,ny=(x2-x)/len;
      const spots=Math.floor(len/.65);
      for(let j=1;j<spots;j++){
        if((j+2)%22<2||(row%5===0&&rng()>.39)||rng()<.09)continue;
        const q=(j+rng()*.3)/spots,px=x+(x2-x)*q+nx*.47,py=y+(y2-y)*q+ny*.47;
        c.fillStyle=crowdColors[Math.floor(rng()*crowdColors.length)];
        c.fillRect(px,py,.28+rng()*.29,.23+rng()*.31);
      }
    }
  }
  if(id==='bears'){
    for(const side of [-1,1]){
      c.fillStyle='#a69b7c';c.fillRect(side*54-1,-41,2,82);
      for(let i=-38;i<=38;i+=3.4){c.fillStyle='#d4c7a3';c.fillRect(side*54-1.6,i,3.2,1.1);c.fillStyle='#6f715e';c.fillRect(side*54-.5,i+.55,2.2,.48);}
    }
  }
  // Tunnel entrances and the two end video boards seat the field in the bowl.
  for(const end of [-1,1]){
    c.save();c.rotate(end===1?Math.PI:0);
    polygon(c,[[-4,-84],[4,-84],[3,-64],[-3,-64]],'#263433');
    c.fillStyle='#141e22';c.fillRect(-12,-80,24,6.4);c.fillStyle='#54645c';c.fillRect(-11.65,-79.6,23.3,.3);
    label(c,v.name.toUpperCase(),0,-76.9,2.1,'#f6e1ac',{width:21});
    c.restore();
  }
  polygon(c,rim(32.4,64,4),'#5d6658','#9e9d82',.4);
  polygon(c,rim(30.1,62.5,2.2),'#59705a','#34483e',.4);
  c.fillStyle='#e4dfc8';c.fillRect(-HALF-.75,-60.75,2*HALF+1.5,121.5);
  for(let i=0;i<20;i++){c.fillStyle=i%2?'#537753':'#5a805a';c.fillRect(-HALF,-50+5*i,2*HALF,5);}
  for(const e of [-1,1]){
    c.save();c.rotate(e===1?Math.PI:0);
    c.fillStyle=v.end;c.fillRect(-HALF,-60,2*HALF,10);
    if(id==='vols'){
      const nx=12,ny=2;
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
        c.fillStyle=(i+j)%2===0?'#e78637':'#ede8d5';c.fillRect(-HALF+i*2*HALF/nx,-60+5*j,2*HALF/nx+.02,5);
      }
    }else{
      const word=(id==='packers'&&e<0)?'GREEN BAY':v.team.toUpperCase();
      label(c,word,.1,-54.72,8.4,'#172d2d',{width:45,weight:'italic 900'});
      label(c,word,0,-55.13,8.4,v.paper,{width:45,weight:'italic 900'});
    }
    c.restore();
  }
  // Stadium light falls across matte paper turf, leaving shadow near the boards.
  const turfLight=c.createLinearGradient(-HALF,-45,HALF,36);
  turfLight.addColorStop(0,'rgba(11,37,33,.18)');
  turfLight.addColorStop(.43,'rgba(32,57,34,.03)');
  turfLight.addColorStop(1,'rgba(247,217,146,.12)');
  c.fillStyle=turfLight;c.fillRect(-HALF,-60,2*HALF,120);
  for(const side of [-1,1]){
    const beam=c.createLinearGradient(side*HALF,0,side*(HALF-6),0);
    beam.addColorStop(0,'rgba(13,35,28,.18)');beam.addColorStop(1,'rgba(17,40,29,0)');
    c.fillStyle=beam;c.fillRect(side<0?-HALF:HALF-6,-60,6,120);
  }
  // Tiny ink flecks and fibers are baked, never generated in the frame loop.
  for(let i=0;i<31000;i++){
    const x=(rng()-.5)*53.3,y=(rng()-.5)*119.8;
    c.fillStyle=rng()>.48?'rgba(243,228,177,.13)':'rgba(16,40,31,.15)';
    c.fillRect(x,y,.035+rng()*.21,.035+rng()*.12);
  }
  c.fillStyle='rgba(255,250,212,.06)';c.fillRect(-HALF,-60,.1+HALF*2,60);
  // Midfield mark is hand-lettered paper art, with the center seam painted over it.
  c.save();c.translate(0,0);
  if(id==='packers'){
    c.beginPath();c.ellipse(0,0,6.5,4.25,0,0,TAU);c.fillStyle=v.accent;c.fill();c.beginPath();c.ellipse(0,0,6.1,3.88,0,0,TAU);c.fillStyle=v.ink;c.fill();
    label(c,'G',0,.22,7.45,v.paper,{width:9.7,weight:'italic 900'});
  }else if(id==='titans'){
    c.beginPath();c.arc(0,0,4.6,0,TAU);c.fillStyle='#b74c46';c.fill();c.beginPath();c.arc(0,0,4.05,0,TAU);c.fillStyle='#74a6c3';c.fill();label(c,'T',0,.14,7.4,v.paper,{family:'Georgia, serif'});
    for(const [sx,sy] of [[-2.1,-2.6],[2.1,-2.6],[0,2.7]]){
      const star=[];for(let n=0;n<10;n++){const a=-Math.PI/2+n*Math.PI/5,r=n%2?.18:.46;star.push([sx+Math.cos(a)*r,sy+Math.sin(a)*r]);}polygon(c,star,v.paper);
    }
  }else{
    label(c,v.mark,.14,.23,10.7,id==='vols'?v.paper:'#172b32',{family:id==='vols'?'Georgia, serif':'Arial, sans-serif',weight:id==='vols'?900:'italic 900'});
    label(c,v.mark,0,0,10.25,id==='vols'?v.accent:'#df7639',{family:id==='vols'?'Georgia, serif':'Arial, sans-serif',weight:id==='vols'?900:'italic 900'});
  }
  c.restore();
  const hash=id==='vols'?6.67:3.08;
  for(let y=0;y<=100;y++){
    const yy=50-y;
    if(y%5===0)line(c,-HALF,yy,HALF,yy,y===0||y===100?'#f7edd3':'rgba(239,237,207,.82)',y===0||y===100?.33:.13);
    else for(const x of [-HALF+.18,-hash-.45,hash-.45,HALF-1.08])line(c,x,yy,x+.9,yy,'rgba(243,238,210,.79)',.11);
    if(y>0&&y<100&&y%10===0){
      const num=String(Math.min(y,100-y));
      for(const s of [-1,1]){
        label(c,num,s*(HALF-8),yy,3.25,'rgba(241,237,212,.90)',{rot:s*Math.PI/2,weight:900});
        if(y!==50){
          const x=s*(HALF-8),ay=yy+Math.sign(50-y)*2.64,sign=Math.sign(50-y);
          polygon(c,[[x-.42,ay],[x+.42,ay],[x,ay+sign*.72]],'rgba(241,237,212,.88)');
        }
      }
    }
  }
  // Thin paper fold across midfield and a broken crease on the visitor sideline.
  line(c,-HALF,0,HALF,0,'rgba(32,55,36,.27)',.12);
  line(c,HALF*.45,-59,HALF*.45,59,'rgba(239,230,186,.09)',.12);
  for(const s of [-1,1]){
    for(let i=-40;i<=40;i+=4){
      c.fillStyle=(i%8===0)?'#e4dfc8':'#9eaa92';c.fillRect(s>0?27.3:-28.7,i,1.4,.15);
    }
    c.save();c.translate(s*30.75,0);c.rotate(s*Math.PI/2);
    c.fillStyle=v.ink;c.fillRect(-21,-.83,42,1.7);
    label(c,v.name.toUpperCase(),0,.04,1.12,v.paper,{width:24});c.restore();
    for(let y=-34;y<=34;y+=15){
      c.fillStyle='#283e3c';c.fillRect(s*29-.58,y,1.15,7.8);
      c.fillStyle='#b5b8a4';c.fillRect(s*29-.41,y, .82,7.55);
      for(let t=0;t<6;t++){c.fillStyle=t%3===0?v.paper:v.ink;c.fillRect(s*28-.22,y+t*1.24,.44,.42);}
    }
    for(let y=-45;y<=45;y+=10){
      const t=s*27.55;c.fillStyle='#36483e';c.fillRect(t-.38,y-.21,.76,.56);
      polygon(c,[[t-.38,y-.2],[t+.4,y-.2],[t+.24,y-.8],[t-.21,y-.8]],'#e39648');
    }
    for(let k=0;k<37;k++){
      const y=(rng()-.5)*76,x=s*(27.6+rng()*2.0);
      ellipse(c,x+.06,y+.14,.19,.26,'rgba(27,43,34,.41)');
      ellipse(c,x,y,.13,.21,k%5===0?'#e1c698':(s>0?'#dbdcbd':v.ink));
    }
    for(const end of [-50,50,-60,60]){c.fillStyle='#f49343';c.fillRect(s*HALF-.21,end-.2,.42,.43);}
  }
  return b;
}

function rotated(source) {
  const out=buffer(source.width,source.height),c=out.getContext('2d');
  c.translate(out.width,out.height);c.rotate(Math.PI);c.drawImage(source,0,0);return out;
}
function projection(w,h,mode,seat,dir,focus,span,kicking) {
  if(mode==='split'){
    const xscale=Math.min(w*.905,h*1.38)/(2*HALF),yscale=h/64.6,face=seat===1?-1:1;
    return {w,h,face,mode,scaleAt:()=>xscale,screen:(x,y)=>({x:w/2+face*x*xscale,y:(50-y)*face*yscale}),
      world:(x,y)=>({x:(x-w/2)/(face*xscale),y:50-y/(face*yscale)}),
      atlasScaleX:xscale,atlasScaleY:yscale};
  }
  const face=dir, near=focus-face*(kicking?9:span*.31),bottom=h*1.025,top=h*.065, ratio=.64;
  const xscale=Math.min(w*1.055,h*2.9)/(2*HALF);
  function scaleAt(y){const d=(y-near)*face/span;return xscale*ratio/Math.max(.19,ratio+(1-ratio)*d);}
  function screen(x,y,z=0){
    const q=(y-near)*face/span,den=Math.max(.19,ratio+(1-ratio)*q);
    const scale=xscale*ratio/den;
    return {x:w/2+x*face*scale,y:bottom-(bottom-top)*q/den-z*scale*.72};
  }
  function world(x,y){
    const t=(bottom-y)/(bottom-top),q=t*ratio/(1-(1-ratio)*t),wy=near+face*q*span;
    return {x:(x-w/2)/(face*scaleAt(wy)),y:wy};
  }
  return {w,h,face,mode,screen,world,scaleAt};
}
function atlasField(c,tex,p) {
  const {w,h,face}=p;
  if(p.mode==='split'){
    const sx=p.atlasScaleX,sy=p.atlasScaleY;
    c.drawImage(tex,w*.5-A*sx,-B*sy,2*A*sx,2*B*sy);return;
  }
  // A single raster transfer avoids hundreds of full-texture draw calls every
  // time the camera moves. Field grain is sampled at display scale while moving
  // players and markings above it retain the tablet's full native resolution.
  const out=c.canvas, rw=out.width, rh=out.height;
  if(!tex.raster) {
    const source=tex.getContext('2d').getImageData(0,0,tex.width,tex.height);
    tex.raster=new Uint32Array(source.data.buffer);
  }
  if(!out.raster || out.raster.width!==rw || out.raster.height!==rh){
    out.raster=c.createImageData(rw,rh);out.pixels=new Uint32Array(out.raster.data.buffer);
  }
  const src=tex.raster, pixels=out.pixels, srcW=tex.width, srcH=tex.height;
  const empty=0xff363523;
  for(let row=0;row<rh;row++){
    const wy=p.world(0,(row+.5)*h/rh).y, sy=(B+face*(50-wy))*TEX;
    const start=row*rw,end=start+rw;
    if(sy<0||sy>=srcH-1){pixels.fill(empty,start,end);continue;}
    const dx=w/rw*TEX/p.scaleAt(wy),srow=Math.floor(sy)*srcW;
    const sx0=A*TEX+(.5-rw*.5)*dx;
    const x0=clamp(Math.ceil(-sx0/dx),0,rw),x1=clamp(Math.ceil((srcW-sx0)/dx),0,rw);
    if(x0>0)pixels.fill(empty,start,start+x0);
    if(x1<rw)pixels.fill(empty,start+x1,end);
    // Blend rows to preserve distant horizontal stripes during camera movement.
    const blend=Math.floor((sy%1)*32),inv=32-blend;
    let sx=sx0+x0*dx;
    for(let i=start+x0; i<start+x1; i++,sx+=dx){
      const index=srow+(sx|0),a=src[index],b=src[index+srcW];
      const rb=(((a&0xff00ff)*inv+(b&0xff00ff)*blend)>>>5)&0xff00ff;
      const g=(((a&0x00ff00)*inv+(b&0x00ff00)*blend)>>>5)&0x00ff00;
      pixels[i]=0xff000000|rb|g;
    }
  }
  c.putImageData(out.raster,0,0);
}
function pitchLine(c,p,x1,y1,x2,y2,color,width,dashed=false) {
  const a=p.screen(x1,y1),b=p.screen(x2,y2);if(dashed)c.setLineDash([6,5]);
  line(c,a.x,a.y,b.x,b.y,color,width);if(dashed)c.setLineDash([]);
}
function fieldRoutes(c,p,players) {
  c.save();c.lineJoin='round';c.lineCap='round';
  for(const player of players){
    if(!player.route?.length)continue;
    const points=[p.screen(player.x,player.y),...player.route.map(q=>p.screen(q.x,q.y))];
    c.beginPath();c.moveTo(points[0].x,points[0].y);for(const pt of points.slice(1))c.lineTo(pt.x,pt.y);
    c.strokeStyle='rgba(21,36,30,.55)';c.lineWidth=4.3;c.stroke();
    c.setLineDash([6,5]);c.strokeStyle='#fae7a4';c.lineWidth=1.9;c.stroke();c.setLineDash([]);
    const end=points.at(-1),prev=points.at(-2),a=Math.atan2(end.y-prev.y,end.x-prev.x),l=6;
    polygon(c,[[end.x+Math.cos(a)*3,end.y+Math.sin(a)*3],[end.x-l*Math.cos(a-.56),end.y-l*Math.sin(a-.56)],[end.x-l*Math.cos(a+.56),end.y-l*Math.sin(a+.56)]],'#ffe5a3');
  }
  c.restore();
}
function fieldBadge(c,p,x,y,text,color) {
  const a=p.screen(x,y),sgn=x*p.face>0?1:-1;
  if(a.y<4||a.y>p.h-7||p.w<420)return;
  const width=text.length*4.9+7,x0=a.x+sgn*4-(sgn<0?width:0);
  c.fillStyle='#203730';c.fillRect(x0,a.y-5,width,10);
  label(c,text,x0+width/2,a.y+.25,7.2,color,{family:'Arial, Helvetica, sans-serif'});
}
function goalpost(c,p,y) {
  const origin=p.screen(0,y),s=p.scaleAt(y),sign=y>50?1:-1;
  if(origin.y< -s*9||origin.y>p.h+s*10)return;
  let base,cross,left,right,topL,topR;
  if(p.mode==='split'){
    const y0=origin.y, u=-sign*p.face;
    base={x:origin.x,y:y0+u*s*.9};cross={x:origin.x,y:y0-u*s*1.35};
    left={x:cross.x-3.07*s,y:cross.y};right={x:cross.x+3.07*s,y:cross.y};
    topL={x:left.x,y:left.y-u*s*1.96};topR={x:right.x,y:right.y-u*s*1.96};
  }else{
    base=p.screen(0,y+sign*.65);cross=p.screen(0,y,3.3);left=p.screen(-3.075,y,3.3);
    right=p.screen(3.075,y,3.3);topL=p.screen(-3.075,y,9.3);topR=p.screen(3.075,y,9.3);
  }
  const wire=(a,b,col,size)=>line(c,a.x,a.y,b.x,b.y,col,size);
  c.save();c.lineCap='round';const t=clamp(s*.18,1.8,4.8);
  for(const [a,b] of [[base,cross],[left,right],[left,topL],[right,topR]]){
    wire(a,b,'#526241',t+1.25);wire(a,b,'#ffdb71',t);
  }
  wire(base,{x:base.x+(cross.x-base.x)*.32,y:base.y+(cross.y-base.y)*.32},'#33484e',t*2.6);c.restore();
}
function ellipse(c,x,y,rx,ry,fill,stroke,width=1) {
  c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);
  if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function uniforms(v,away) {
  return {shirt:away?v.paper:v.ink,hi:away?'#fff9e7':v.light,shade:away?'#bdbeaa':v.ink,helmet:v.shell,helmetHi:v.shellHi,helmetStripe:v.helmetStripe,
    stripe:v.accent,edge:away?'#7e8476':'#263a3b',number:away?v.ink:'#fff2d9',pants:v.trousers||(away?v.ink:'#dedfcd'),sock:away?v.paper:v.ink};
}
function flatFootball(c,x,y,size,angle,type) {
  c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
  const fold=type==='heavy'?['#94543b','#c78353','#6f432e','#f3d59b']:type==='light'?['#e3dbc0','#fff1d0','#a6a88f','#9a7450']:['#b47a49','#e6ab68','#825739','#f5d7a0'];
  polygon(c,[[-1.03,.55],[-.5,-.84],[1.05,.22]],fold[0], '#463e32',.14);
  polygon(c,[[-.49,-.77],[.03,.08],[.94,.22]],fold[1]);
  polygon(c,[[-.96,.49],[.03,.08],[.94,.22]],fold[2]);
  line(c,-.87,.44,.02,.09,fold[3],.07);line(c,-.42,-.61,.04,.06,fold[3],.08);
  for(let i=0;i<3;i++)line(c,-.29+i*.14,-.24+i*.071,-.38+i*.14,-.11+i*.071,fold[3],.065);
  c.restore();
}
function figure(c,pl,p,v,away,active,controlled,moving,time) {
  const pt=p.screen(pl.x,pl.y),yard=p.scaleAt(pl.y);
  const h=p.mode==='split'?clamp(yard*2.0,10,46):clamp(yard*3.38,13,78);
  if(pt.x< -h||pt.x>p.w+h||pt.y< -h||pt.y>p.h+h)return;
  const kit=uniforms(v,away),step=moving?Math.sin(time*9+pl.number*2.37):0;
  c.save();c.translate(pt.x,pt.y);
  if(p.mode==='split'){c.rotate(p.face===1?0:Math.PI);}
  const sh=p.mode==='split'?h*.30:h*.105;
  ellipse(c,h*.085,h*.055,h*.34,sh,'rgba(12,24,21,.34)');
  if(active||controlled){
    const color=active?'#ffdc79':'#abdbf2',r=h*(p.mode==='split'?.62:.5),ry=r*(p.mode==='split'?.8:.42);
    ellipse(c,0,h*.015,r,ry,'rgba(250,221,143,.11)','#294337',Math.max(2.9,h*.083));
    ellipse(c,0,h*.015,r,ry,null,color,Math.max(1.4,h*.045));
  }
  if(p.mode==='split'){
    c.rotate(pl.heading||0);c.scale(h/24,h/24);
    polygon(c,[[-5,2],[-1.3,2],[-1.9,8+step],[-5.8,9+step]],kit.pants,kit.edge,.5);
    polygon(c,[[1.1,1.7],[5.1,2],[5.8,8-step],[2.1,8.8-step]],kit.pants,kit.edge,.5);
    polygon(c,[[-10,-3.6],[-6.7,-6.4],[.6,-4.8],[7.1,-5.9],[10,-2.4],[6.6,2.8],[3.8,4.4],[-3.5,4.6],[-7.4,2.3]],kit.shirt,kit.edge,.55);
    polygon(c,[[-9,-3.6],[-5.8,-5.9],[-.1,-4.6],[-4.8,-2.1]],kit.hi);
    polygon(c,[[4,-4.1],[7.1,-5.3],[9.2,-2.4],[6.8,.6]],kit.hi);
    line(c,-8.5,-2.2,-6.3,.9,kit.stripe,1.2);line(c,7.9,-2.2,6.3,.5,kit.stripe,1.2);
    polygon(c,[[-4.3,-6.9],[-2.3,-9.0],[1.6,-9.2],[4.6,-6.5],[4.4,-2.2],[1.4,.0],[-2.4,-.6],[-4.3,-2.3]],kit.helmet,cream,.55);
    polygon(c,[[-4,-6.2],[-2,-8.4],[-.3,-8.6],[-1.2,-3.9],[-3.8,-2.4]],kit.helmetHi);
    line(c,.1,-8.65,.55,-1,kit.helmetStripe,1.12);line(c,-2,-8.7,2,-8.7,'#d5d5c3',.77);
    c.restore();return;
  }
  // Upright folded paper figures: shoes, gusseted knees, shoulder flaps,
  // a polygonal helmet and a separate folded facemask.
  c.scale(h/33,h/33);
  const lineRole=['C','RG','LG','RT','LT','DE','DT'].includes(pl.role);
  if(lineRole)c.scale(1.24,.76);
  if(moving)c.rotate(Math.sin(pl.heading||0)*p.face*.12+step*.023);
  const lean=Math.sin(pl.heading||0)*p.face*2.7,front=Math.cos(pl.heading||0)*p.face<-.2;
  c.translate(lean*.4,0);
  polygon(c,[[-5.6,-10],[-.6,-9],[-2,-3+step*1.3],[-4.8,-1+step],[-6.3,-3.3+step]],kit.pants,kit.edge,.6);
  polygon(c,[[.4,-8.8],[5.4,-10],[5.3,-3.2-step*1.4],[3.4,-1.2-step],[1.2,-2.4-step]],kit.pants,kit.edge,.6);
  polygon(c,[[-5.9,-3.3+step],[-2.5,-3+step],[-2.2,-.6+step],[-6.3,-.7+step],[-7.1,-1.1+step]],kit.sock,kit.edge,.55);
  polygon(c,[[2,-3.2-step],[5,-3.4-step],[6.7,-1.25-step],[6.1,-.65-step],[2.2,-.85-step]],kit.sock,kit.edge,.55);
  c.translate(lean,-Math.abs(step)*.7);
  polygon(c,[[-8.1,-18.8],[-9,-16.5],[-6.8,-11.9+step],[-4.9,-12.6+step],[-5.8,-15.5]],'#dfb58c',kit.edge,.55);
  polygon(c,[[7.8,-18.8],[9,-16.1],[7.1,-11.8-step],[5.3,-12.6-step],[5.8,-15.6]],'#c39270',kit.edge,.55);
  polygon(c,[[-9.5,-19.2],[-6.5,-23],[-2.8,-23.4],[2.3,-23.2],[7.1,-22.4],[9.3,-18.5],[7.2,-15.8],[5.3,-16.4],[5.1,-9],[-4.6,-8.6],[-6.1,-15.8],[-7.4,-15.8]],kit.shirt,kit.edge,.7);
  polygon(c,[[-9,-19.4],[-6.3,-22.6],[-2.9,-22.8],[-4.5,-19.6],[-5.2,-10.2],[-6.1,-16.5],[-7.4,-16.1]],kit.hi);
  polygon(c,[[2.8,-22.7],[6.9,-21.8],[8.8,-18.5],[6.5,-18.8],[4.6,-17.3]],kit.hi);
  polygon(c,[[.4,-9.1],[5.1,-12.4],[4.8,-9.2]],kit.edge);
  line(c,-8.6,-18.35,-6.4,-17.4,kit.stripe,.99);line(c,6.7,-17.3,8.35,-18,kit.stripe,1.1);
  polygon(c,[[-4.5,-10.8],[.45,-15.7],[4.6,-12.1],[4.8,-9.8]],'rgba(28,42,37,.2)');
  polygon(c,[[-2.7,-22.9],[.3,-20.4],[3.1,-22.8]],kit.edge);
  line(c,-4.75,-10.1,-1.25,-13.4,'rgba(249,240,214,.46)',.52);
  line(c,-3.65,-7.7,-4.72,-4.12,kit.stripe,.76);
  label(c,String(pl.number??''),0,-15.5,6.4,kit.number,{weight:900,width:8});
  line(c,-4.65,-9.5,4.7,-9.8,'#d4d4bd',.8);
  polygon(c,[[-5.2,-27.4],[-4.0,-30.8],[-1.4,-32.65],[2.4,-32.15],[5.1,-29.8],[5.7,-25.5],[4.25,-22.7],[-2.9,-22.3],[-5.1,-24.55]],kit.helmet,'#d7d3b8',.66);
  polygon(c,[[-4.8,-27.9],[-3.8,-30.5],[-1.4,-32.1],[2.4,-31.75],[-.5,-28.1],[-3.5,-25.2]],kit.helmetHi);
  polygon(c,[[.3,-31.95],[1.3,-32.0],[2.2,-29.8],[1.45,-25.9],[.6,-24.55],[.65,-28.2]],kit.helmetStripe);
  if(front){
    polygon(c,[[-4.25,-26.2],[4.9,-26.5],[4.2,-23.8],[2.3,-22.9],[-2.1,-23.1],[-4.0,-24.2]],'#253636');
    line(c,-3.7,-24.1,4.4,-24.3,'#d7d9c9',.75);line(c,-1.8,-24.1,-1.6,-22.8,'#d7d9c9',.65);line(c,2.5,-24.2,2.2,-22.9,'#d7d9c9',.65);
  }else{line(c,-3.7,-23.8,3.9,-24.1,kit.stripe,.8);}
  c.restore();
}

function ballArt(c,s,p,time,animate) {
  const b=s.ball;if(!b)return;
  const pos=p.screen(b.x,b.y),yard=p.scaleAt(b.y),held=Boolean(b.carrier)&&s.phase!=='kick';
  let z=held?Math.max(.75,b.z):b.z||.12;
  const angle=(animate&&s.flight?s.flight.t*9:0)+(p.face===-1?Math.PI:0);
  if(p.mode==='split'){
    const t=held?.58:clamp(.66+z*.036,.66,1.18),off=held?yard*.57:0;
    if(!held){
      ellipse(c,pos.x,pos.y,yard*(.39+z*.017),yard*(.24+z*.013),'rgba(22,31,24,.29)');
      if(z>1)ellipse(c,pos.x,pos.y,yard*(.74+z*.029),yard*(.70+z*.029),null,'rgba(255,229,157,.72)',1.3);
    }
    flatFootball(c,pos.x+p.face*off,pos.y,clamp(yard*t,4.5,17),angle-.34,s.ballType);return;
  }
  const high=p.screen(b.x,b.y,z),arm=held?yard*.71:0;
  if(!held){
    ellipse(c,pos.x+yard*.10,pos.y,yard*(.43+z*.017),yard*.17,'rgba(18,28,22,.29)');
    if(s.flight&&z>1){
      const t=s.flight.t/s.flight.duration,trail=[];
      for(let i=0;i<6;i++){
        const q=Math.max(0,t-i*.014),fl=s.flight;
        trail.push(p.screen(fl.sx+(fl.tx-fl.sx)*q,fl.sy+(fl.ty-fl.sy)*q,4*fl.apex*q*(1-q)+.75));
      }
      for(let i=trail.length-1;i>0;i--)line(c,trail[i].x,trail[i].y,trail[i-1].x,trail[i-1].y,'rgba(255,229,169,'+((6-i)*.08)+')',clamp(yard*.15,1,3));
    }
  }
  flatFootball(c,high.x+arm,held?pos.y-clamp(yard*1.37,6,30):high.y,clamp(yard*(held?.56:.76),4.5,22),angle-.32,s.ballType);
}
function touchAim(c,p,gesture) {
  if(!gesture?.from||!gesture?.to)return;
  const a=p.screen(gesture.from.x,gesture.from.y),b=p.screen(gesture.to.x,gesture.to.y);
  const ang=Math.atan2(b.y-a.y,b.x-a.x);c.save();c.lineCap='round';c.setLineDash([4,6]);
  line(c,a.x,a.y,b.x,b.y,'rgba(255,235,173,.94)',2.7);c.setLineDash([]);
  ellipse(c,a.x,a.y,4.1,4.1,null,'#fff0b2',1.6);
  for(const sign of [-1,1])line(c,b.x,b.y,b.x-10*Math.cos(ang+sign*.53),b.y-10*Math.sin(ang+sign*.53),'#ffdf8a',2.7);c.restore();
}
function celebration(c,s,p,v) {
  if(s.phase!=='dead'||!s.lastEvent?.points)return;
  const t=s.phaseTime;if(t>1.6)return;
  const rng=random(508+s.eventId);c.save();
  for(let i=0;i<32;i++){
    const x=rng()*p.w,y0=-rng()*p.h*.35,fall=(.42+rng()*.55)*p.h;
    const a=rng()*6.28,w=2+rng()*4.5;
    c.save();c.translate(x+Math.sin(a+t*3.2)*t*16,y0+t*fall);
    c.rotate(a+t*(i%2===0?3:-2));c.fillStyle=[v.accent,v.paper,v.light][i%3];c.fillRect(-w/2,-w*.23,w,w*.46);c.restore();
  }
  c.restore();
}

export function createRenderer(canvas) {
  const c=canvas.getContext('2d',{alpha:false});
  let p=null,texId='',atlas,reverse,focus,prevDir,prevStamp=0,previousPhase;
  let jerseyCache=null,jerseySig='',w=0,h=0,dpr=0,bg=null,bgKey='';
  function draw(s,options={}) {
    if(!s)return;
    const rect=canvas.getBoundingClientRect(),cw=rect.width,ch=rect.height;
    if(cw<1||ch<1)return;
    const ratio=Math.min(globalThis.devicePixelRatio||1,2,Math.sqrt(3400000/(cw*ch)));
    if(w!==cw||h!==ch||Math.abs(dpr-ratio)>.02){
      w=cw;h=ch;dpr=ratio;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);bg=null;bgKey='';
    }
    c.setTransform(dpr,0,0,dpr,0,0);c.lineCap='butt';c.lineJoin='round';
    const mode=options.mode==='split'?'split':'solo',seat=Number(options.seat)===1?1:0;
    const id=keyOf(options.venue||s.teams?.[0]),now=performance.now()/1000;
    if(id!==texId){atlas=stadiumAtlas(id);reverse=null;texId=id;bgKey='';}
    const face=mode==='split'?(seat===1?-1:1):(s.direction||1);
    if(face<0&&!reverse)reverse=rotated(atlas);
    const typeKey=(s.teams||[]).join('/');
    if(jerseySig!==typeKey||!jerseyCache){jerseyCache=(s.teams||['bears','packers']).map(id=>VENUES[keyOf(id)]);jerseySig=typeKey;}
    const kick=s.phase==='kick'||(s.phase==='dead'&&s.play==='kick');
    const target=kick?(s.flight?s.ball.y:s.los-5*face):(s.phase==='select'?s.los:s.ball.y);
    if(!Number.isFinite(focus)||prevDir!==face||(s.phase==='select'&&previousPhase!==s.phase)||options.reducedMotion)focus=target;
    if(s.phase==='kick'&&previousPhase!=='kick')focus=target;
    const dt=clamp(now-prevStamp,0,.15);focus+=(target-focus)*(1-Math.exp(-dt*(s.flight?12:8)));
    prevDir=face;prevStamp=now;previousPhase=s.phase;
    let span=clamp(39+12*h/w,42,57);
    if(kick)span=Math.max(span,Math.abs((face>0?110:-10)-focus)*1.03+17);
    p=projection(w,h,mode,seat,face,focus,span,kick);
    // The background is stable while choosing plays, studying the field and on
    // both paired tablets. Repaint only after the camera moves visibly.
    const bgCam=mode==='split'?'static':(focus*10).toFixed(0)+'/'+(span*7).toFixed(0);
    const key=[id,mode,face,bgCam].join('|');
    const bgScale=mode==='split'?Math.min(dpr,1.5):Math.min(dpr,1180/w,710/h,1.45);
    const bw=Math.max(1,Math.round(w*bgScale)),bh=Math.max(1,Math.round(h*bgScale));
    if(!bg||bg.width!==bw||bg.height!==bh){bg=buffer(bw,bh);bgKey='';}
    if(bgKey!==key){
      const bc=bg.getContext('2d');bc.setTransform(bw/w,0,0,bh/h,0,0);
      bc.fillStyle='#233536';bc.fillRect(0,0,w,h);atlasField(bc,face>0?atlas:reverse,p);
      if(mode==='solo'){
        const vignette=bc.createLinearGradient(0,0,0,h);
        vignette.addColorStop(0,'rgba(26,38,35,.19)');vignette.addColorStop(.34,'rgba(28,40,29,0)');vignette.addColorStop(1,'rgba(255,212,142,.045)');
        bc.fillStyle=vignette;bc.fillRect(0,0,w,h);
      }
      bgKey=key;
    }
    c.drawImage(bg,0,0,w,h);
    if(Number.isFinite(s.firstDown)&&s.phase!=='kick'&&s.phase!=='final'){
      pitchLine(c,p,-HALF,s.firstDown,HALF,s.firstDown,'rgba(43,56,33,.30)',3.8);
      pitchLine(c,p,-HALF,s.firstDown,HALF,s.firstDown,'rgba(252,203,89,.92)',2.1);
      fieldBadge(c,p,-HALF,s.firstDown,'1ST','#ffe394');
    }
    if(Number.isFinite(s.los)&&s.phase!=='final'){
      pitchLine(c,p,-HALF,s.los,HALF,s.los,'rgba(30,50,52,.54)',3.5);
      pitchLine(c,p,-HALF,s.los,HALF,s.los,'rgba(124,209,228,.84)',1.65);
    }
    const players=s.players||[];
    if(s.phase==='live'&&!s.passThrown&&s.playTime<2.75&&s.offense===seat)fieldRoutes(c,p,players.filter(pl=>pl.side===s.offense));
    const farGoal=p.face===1?110:-10,nearGoal=p.face===1?-10:110;
    goalpost(c,p,farGoal);
    if(s.flight&&s.ball?.mode==='pass'){
      const target=p.screen(s.flight.tx,s.flight.ty),r=p.scaleAt(s.flight.ty)*1.28;
      c.save();c.setLineDash([3,3]);ellipse(c,target.x,target.y,r,r*(mode==='split'?.85:.38),null,'#fff0b8',1.6);c.restore();
    }
    const order=players.slice().sort((a,b)=>(p.mode==='split'?1:p.face)*(b.y-a.y)||a.side-b.side||a.slot-b.slot);
    for(const pl of order){
      const carrier=s.ball?.carrier===pl.id,controlled=pl.id===s.defenderId&&seat!==s.offense;
      figure(c,pl,p,jerseyCache[pl.side]||VENUES.bears,pl.side===1,carrier,controlled,s.phase==='live'&&!options.reducedMotion,s.elapsed||0);
    }
    ballArt(c,s,p,s.elapsed,!options.reducedMotion);goalpost(c,p,nearGoal);
    touchAim(c,p,options.gesture);
    if(!options.reducedMotion)celebration(c,s,p,jerseyCache[s.offense]);
  }
  return {draw,
    toWorld(clientX,clientY){if(!p)return {x:0,y:0};const r=canvas.getBoundingClientRect();return p.world(clientX-r.left,clientY-r.top);},
    toScreen(x,y,z=0){return p?p.screen(x,y,z):{x:0,y:0};}
  };
}
