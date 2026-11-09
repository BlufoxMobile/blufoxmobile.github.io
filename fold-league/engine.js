// Paper gridiron simulation. Coordinates are yards. +y points toward side 0's scoring end zone.
export const PLAYS = {
  cross: { name: 'Cross Roads', short: 'Cross', type: 'pass', description: 'Two receivers cross through the middle.' },
  go: { name: 'Four Verticals', short: 'Verticals', type: 'pass', description: 'Stretch the defense with a deep throw.' },
  slant: { name: 'Quick Slant', short: 'Slant', type: 'pass', description: 'Hit a receiver breaking inside.' },
  sweep: { name: 'Outside Sweep', short: 'Sweep', type: 'run', description: 'Follow your lead blocker toward the edge.' },
  dive: { name: 'Inside Dive', short: 'Dive', type: 'run', description: 'Hit the gap, then swipe past the safety.' },
  kick: { name: 'Field Goal', short: 'Field goal', type: 'kick', description: 'Flick through the uprights. Long makes score more.' }
};
export const BALLS = {
  light: { name:'Feather Fold', weight:'Light', description:'Quick cuts and a high, wind-sensitive flight.', range:.95, speed:1.13, grip:1.13, drift:1.6, strike:.84, maxKick:63 },
  classic: { name:'Classic Fold', weight:'Medium', description:'A balanced fold with predictable touch.', range:1, speed:1, grip:1, drift:1, strike:1, maxKick:69 },
  heavy: { name:'Heavy Fold', weight:'Heavy', description:'A firm flick carries farther and cuts through wind.', range:1.12, speed:.95, grip:.91, drift:.56, strike:1.28, maxKick:77 }
};
const HALF_WIDTH = 26 + 2/3;
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const dir = side => side === 0 ? 1 : -1;
const own = (side,yards) => side === 0 ? yards : 100-yards;
const targetLine = (side,los) => clamp(los+dir(side)*10,0,100);
const opponentGoal = s => s.offense === 0 ? 100 : 0;
const position = (x,y) => ({x,y});
const offenseRoles = ['QB','RB','WR','WR','TE','SL','LT','LG','C','RG','RT'];
const defenseRoles = ['FS','CB','CB','SS','LB','LB','LB','DE','DT','DT','DE'];
const offenseNumbers = [1,22,11,14,87,18,72,66,61,65,75];
const defenseNumbers = [24,21,31,36,53,54,56,91,95,96,98];
const eligibleSlots = [1,2,3,4,5];
const pick = (s,side,slot) => s.players[side * 11 + slot];
const byId = (s,id) => id ? s.players.find(p=>p.id===id) : null;
function random(s) {
  s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;
  return s.seed / 4294967296;
}
function emit(s,type,text,side=s.offense,points=0) {
  s.message=text;
  s.lastEvent={id:++s.eventId,type,text,side,points};
}
function drive(side,spot=own(side,25)) {
  const los=clamp(spot,.5,99.5);
  return {offense:side,los,down:1,firstDown:targetLine(side,los)};
}
function freshBall(x,y) {
  return {x,y,z:.6,carrier:null,mode:'held'};
}
export function createGame(options={}) {
  const duration=Number(options.quarterSeconds);
  const quarterSeconds=Number.isFinite(duration)&&duration>0 ? duration : 120;
  const s={
    version:1,teams:[...(options.teams??['CHI','GB'])],cpu:[...(options.cpu??[false,true])],
    ballType:Object.hasOwn(BALLS,options.ball)?options.ball:'classic',
    phase:'select',quarter:1,quarterSeconds,clock:quarterSeconds,runningClock:false,elapsed:0,
    score:[0,0],...drive(0),direction:1,players:[],ball:freshBall(0,25),
    defense:'zone',play:null,message:'Opening drive',hint:'Choose a play.',lastEvent:null,eventId:0,
    seed:(Number(options.seed??17)>>>0),wind:0,playTime:0,phaseTime:0,flight:null,pending:null,
    cutX:0,cutY:0,cutTime:0,cutCooldown:0,defenderId:null,defendTime:0,defendX:0,defendY:0,
    passThrown:false,caughtAt:-1,accumulator:0
  };
  setup(s);
  emit(s,'start','Opening drive');
  return s;
}
function setup(s) {
  s.phase='select'; s.phaseTime=0; s.playTime=0; s.play=null; s.flight=null; s.pending=null;
  s.direction=dir(s.offense); s.passThrown=false; s.caughtAt=-1; s.cutTime=0; s.cutCooldown=0; s.defendTime=0;
  s.wind=(random(s)-.5)*3.5; s.cpuDelay=1.55+random(s)*1.1; s.cpuNext=.8+random(s)*.8;
  s.defense=s.cpu[1-s.offense] ? ['zone','zone','man','blitz'][Math.floor(random(s)*4)] : 'zone';
  const of=[[0,-4],[-4,-5.5],[-21,0],[21,0],[7,-.4],[-12,-1],[-4.5,0],[-2.3,0],[0,0],[2.3,0],[4.5,0]];
  const df=[[0,15],[-20,5],[20,5],[10,11],[-10,6],[0,5],[7,5],[-5,1.6],[-1.6,1.6],[1.6,1.6],[5,1.6]];
  s.players=[];
  for(let side=0;side<2;side++) {
    const attacking=side===s.offense;
    const coords=attacking?of:df;
    coords.forEach(([offset,depth],slot)=>{
      const x=offset*s.direction, y=clamp(s.los+depth*s.direction,-8,108);
      s.players.push({
        id:side+'-'+slot,slot,side,role:(attacking?offenseRoles:defenseRoles)[slot],
        number:(attacking?offenseNumbers:defenseNumbers)[slot],x,y,ox:x,oy:y,
        heading:(attacking?s.direction:-s.direction)>0?0:Math.PI,route:[],waypoint:0
      });
    });
  }
  const qb=pick(s,s.offense,0);
  s.ball=freshBall(qb.x,qb.y); s.ball.carrier=qb.id; s.defenderId=pick(s,1-s.offense,5).id;
  s.hint='Choose a play.';
}
export function kickInfo(s) {
  const distance=Math.round(Math.abs(opponentGoal(s)-s.los)+17);
  const b=BALLS[s.ballType];
  return {distance,points:distance<40?3:distance<50?4:distance<60?5:6,maxDistance:b.maxKick,
    requiredPower:Math.pow(clamp((distance-6)/(b.maxKick-6),0,1),1/b.strike)};
}
// Routes are offsets from each player's initial lateral position and the line of scrimmage.
function assignRoutes(s) {
  const routes={
    cross:[[[0,4],[-11,8]],[[0,5],[28,19]],[[0,9],[-27,15]],[[0,5],[10,10]],[[-1,11],[5,19]]],
    go:[[[0,3],[-10,7]],[[0,17],[-1,48]],[[0,18],[1,49]],[[-2,16],[-2,41]],[[2,14],[1,44]]],
    slant:[[[0,3],[-11,5]],[[2,3],[27,15]],[[-2,3],[-27,16]],[[1,4],[9,7]],[[0,6],[2,20]]]
  }[s.play];
  if(!routes) return;
  eligibleSlots.forEach((slot,i)=>{
    const p=pick(s,s.offense,slot);
    p.route=routes[i].map(([x,y])=>position(clamp(p.ox+x*s.direction,-25,25),clamp(s.los+y*s.direction,-6,106)));
  });
}
function snap(s,play) {
  s.play=play; s.phaseTime=0; s.playTime=0; s.runningClock=play!=='kick'; s.cpuNext=1.0+random(s)*1.55;
  if(play==='kick') {
    s.phase='kick';
    const d=s.direction, side=s.offense;
    const kicker=pick(s,side,0), holder=pick(s,side,1);
    kicker.role='K'; kicker.x=-2.6*d; kicker.y=s.los-10*d;
    holder.role='H'; holder.x=.5*d; holder.y=s.los-7*d;
    // Tight wings protect the holder. The end-zone camera still uses the same field coordinates.
    [2,3,4,5].forEach((slot,i)=>{
      const p=pick(s,side,slot);
      p.x=[-8.2,8.2,6.4,-6.4][i]*d;p.y=s.los-(i<2?1.7:.7)*d;
    });
    for(let i=0;i<11;i++) {
      const p=pick(s,1-side,i);
      p.x=(-11+i*2.2)*d; p.y=s.los+(i===0||i===10?2.9:1.4)*d;
    }
    s.ball.x=0; s.ball.y=holder.y; s.ball.z=.2; s.ball.carrier=holder.id;
    s.hint='Flick toward the uprights.';
    emit(s,'lineup',kickInfo(s).distance+'-yard field goal');
    return;
  }
  s.phase='live'; assignRoutes(s);
  if(PLAYS[play].type==='run') {
    const rb=pick(s,s.offense,1); s.ball.carrier=rb.id; s.ball.x=rb.x; s.ball.y=rb.y;
    s.hint='Swipe to cut past a defender.';
  } else s.hint='Flick toward a receiver.';
  emit(s,'snap',PLAYS[play].name);
}
function speedFor(p) { return p.slot===4?6.7:p.slot===1?7.3:8.05; }
function walk(p,x,y,speed,dt) {
  const dx=x-p.x,dy=y-p.y,length=Math.hypot(dx,dy);
  if(length<.002) return;
  const f=Math.min(1,speed*dt/length);
  p.x+=dx*f; p.y+=dy*f; p.heading=Math.atan2(dx,dy);
}
function advanceRoute(p,dt) {
  const waypoint=p.route[p.waypoint];
  if(!waypoint) return;
  walk(p,waypoint.x,waypoint.y,speedFor(p),dt);
  if(dist(p,waypoint)<.07) p.waypoint++;
}
function leadPosition(p,seconds) {
  const v={x:p.x,y:p.y};
  let remaining=speedFor(p)*seconds;
  for(let i=p.waypoint;i<p.route.length&&remaining>0;i++) {
    const goal=p.route[i],d=dist(v,goal);
    if(d<=remaining) {v.x=goal.x;v.y=goal.y;remaining-=d;}
    else {v.x+=(goal.x-v.x)*remaining/d;v.y+=(goal.y-v.y)*remaining/d;break;}
  }
  return v;
}
function unit(action) {
  const x=Number(action.dx),y=Number(action.dy);
  if(!Number.isFinite(x)||!Number.isFinite(y)) return null;
  const magnitude=Math.hypot(x,y);
  return magnitude>.01 ? {x:x/magnitude,y:y/magnitude} : null;
}
function throwPass(s,u,power) {
  const ball=s.ball,b=BALLS[s.ballType],qb=pick(s,s.offense,0);
  if(ball.carrier!==qb.id||s.passThrown) return false;
  const reach=6+43*b.range*Math.pow(power,b.strike);
  let target={x:ball.x+u.x*reach,y:ball.y+u.y*reach}, receiver=null,best=-Infinity;
  for(const slot of eligibleSlots) {
    const r=pick(s,s.offense,slot), now=dist(qb,r);
    const first=leadPosition(r,clamp(now/(24*b.speed),.25,1.65));
    const far=dist(qb,first);
    if(far<2||far>reach+3.2) continue;
    // A throw aimed at the current receiver or at the space ahead can lead that route.
    const cosNow=((r.x-qb.x)*u.x+(r.y-qb.y)*u.y)/Math.max(.01,now);
    const cosLead=((first.x-qb.x)*u.x+(first.y-qb.y)*u.y)/far;
    const score=Math.max(cosNow,cosLead)-.068*Math.abs(far-reach)/Math.max(12,reach);
    if(score>best&&Math.max(cosNow,cosLead)>.957) {best=score;receiver=r;target=first;}
  }
  const duration=clamp(dist(qb,target)/(24*b.speed),.22,2);
  if(receiver) target=leadPosition(receiver,duration);
  const drift=s.wind*b.drift*duration*.25;
  s.flight={sx:ball.x,sy:ball.y,tx:target.x+drift,ty:target.y,t:0,duration,apex:2.3+duration*2.2};
  ball.carrier=null; ball.mode='pass'; s.passThrown=true; s.hint='Pass in flight.';
  emit(s,'throw','Pass away'); return true;
}
function launchKick(s,u,power) {
  if(s.flight||s.phase!=='kick') return false;
  const info=kickInfo(s),b=BALLS[s.ballType],ball=s.ball;
  const range=6+(b.maxKick-6)*Math.pow(power,b.strike);
  const forward=Math.max(0,u.y*s.direction);
  const reach=range*forward, travel=Math.min(reach,info.distance);
  const tx=forward>.02 ? u.x/forward*travel+s.wind*b.drift*travel/85 : u.x*range;
  const made=reach>=info.distance&&Math.abs(tx)<=3.08;
  const duration=.75+travel/50;
  s.flight={sx:ball.x,sy:ball.y,tx,ty:ball.y+travel*s.direction,t:0,duration,apex:3+travel*.12,
    made,reason:reach<info.distance?'falls short':tx<0?'wide left':'wide right',...info};
  s.ball.mode='kick'; s.ball.carrier=null; s.runningClock=true; s.hint='Kick in flight.';
  emit(s,'kick','The kick is away'); return true;
}
function nearest(list,point) {
  let best=null,min=Infinity;
  for(const p of list) {const d=dist(p,point);if(d<min){best=p;min=d;}}
  return best;
}
export function act(s,side,action) {
  if(!action||!Number.isInteger(side)||side<0||side>1||s.phase==='final') return false;
  if(action.type==='defense'&&side!==s.offense&&(s.phase==='select'||(s.phase==='live'&&s.playTime<=1.0))&&['zone','blitz','man'].includes(action.scheme)) {
    s.defense=action.scheme;return true;
  }
  if(action.type==='play'&&side===s.offense&&s.phase==='select'&&Object.hasOwn(PLAYS,action.play)) {
    snap(s,action.play);return true;
  }
  if(!['flick','cut'].includes(action.type)) return false;
  const u=unit(action);
  if(!u) return false;
  if(action.type==='cut'&&side!==s.offense&&s.phase==='live') {
    const defenders=s.players.filter(p=>p.side===side);
    const p=nearest(defenders,s.ball); s.defenderId=p.id; s.defendTime=.62; s.defendX=u.x; s.defendY=u.y;
    return true;
  }
  if(side!==s.offense) return false;
  const power=clamp(Number(action.power??.7),0,1);
  if(!Number.isFinite(power)) return false;
  if(action.type==='flick'&&s.phase==='kick') return launchKick(s,u,power);
  if(s.phase!=='live') return false;
  if(action.type==='flick'&&PLAYS[s.play].type==='pass'&&!s.passThrown) return throwPass(s,u,power);
  if((action.type==='cut'||action.type==='flick')&&s.ball.carrier&&s.cutCooldown<=0) {
    s.cutX=u.x; s.cutY=u.y; s.cutTime=.53; s.cutCooldown=.66;
    return true;
  }
  return false;
}
function finish(s,type,text,next,runClock=false,side=s.offense,points=0) {
  s.phase='dead';s.phaseTime=0;s.pending=next;s.runningClock=runClock;s.flight=null;s.hint='';
  if(points) s.score[side]+=points;
  emit(s,type,text,side,points);
}
function finishDown(s,spot,complete=true,out=false) {
  const side=s.offense,d=s.direction;
  if(complete&&(spot-opponentGoal(s))*d>=0) {
    finish(s,'touchdown','Touchdown! +7 including the extra point',drive(1-side),false,side,7);return;
  }
  if(complete&&(spot-own(side,0))*d<=0) {
    finish(s,'safety','Safety! +2',drive(1-side,own(1-side,35)),false,1-side,2);return;
  }
  const spotY=complete?clamp(spot,.5,99.5):s.los;
  const gain=Math.round((spotY-s.los)*d);
  if(complete&&(spotY-s.firstDown)*d>=-.01) {
    finish(s,'first','First down · '+(gain>=0?'+':'')+gain+' yd',drive(side,spotY),!out);return;
  }
  if(s.down===4) {
    finish(s,'turnover','Turnover on downs',drive(1-side,spotY));return;
  }
  const text=complete?(out?'Out of bounds':gain<0?'Loss of yards':'Tackle')+' · '+(gain>0?'+':'')+gain+' yd':'Incomplete pass';
  finish(s,complete?'tackle':'incomplete',text,{offense:side,los:spotY,down:s.down+1,firstDown:s.firstDown},complete&&!out);
}
function kickEnd(s,f) {
  const side=s.offense;
  if(f.made) {
    finish(s,'good',f.distance+'-yard field goal! +'+f.points,drive(1-side),false,side,f.points);return;
  }
  const opponent=1-side;
  const kickSpot=s.los-7*s.direction;
  const restart=(kickSpot-own(opponent,20))*dir(opponent)>0?kickSpot:own(opponent,20);
  finish(s,'miss','Kick '+f.reason,drive(opponent,restart));
}
function flightTick(s,dt) {
  const f=s.flight;
  f.t=Math.min(f.duration,f.t+dt);
  const a=f.t/f.duration,ball=s.ball;
  ball.x=f.sx+(f.tx-f.sx)*a;ball.y=f.sy+(f.ty-f.sy)*a;
  ball.z=.8+4*f.apex*a*(1-a)+(ball.mode==='kick'&&f.made?4*a:0);
  if(a<1) return;
  if(ball.mode==='kick') {kickEnd(s,f);return;}
  s.flight=null;
  if(Math.abs(ball.x)>HALF_WIDTH||ball.y< -10||ball.y>110) {ball.z=0;ball.mode='loose';finishDown(s,s.los,false);return;}
  const receivers=eligibleSlots.map(i=>pick(s,s.offense,i));
  const target=nearest(receivers,ball),defender=nearest(s.players.filter(p=>p.side!==s.offense),ball);
  if(dist(defender,ball)<1.4&&dist(defender,ball)+.65<dist(target,ball)) {
    ball.carrier=defender.id;ball.mode='held';ball.z=1;
    const opposite=1-s.offense;
    const spot=(ball.y-own(opposite,0))*dir(opposite)<=0?own(opposite,20):ball.y;
    finish(s,'interception','Intercepted!',drive(opposite,spot),false,opposite);return;
  }
  if(dist(target,ball)>3.25) {ball.z=0;ball.mode='loose';finishDown(s,s.los,false);return;}
  ball.carrier=target.id;ball.mode='held';ball.x=target.x;ball.y=target.y;ball.z=1;
  s.caughtAt=s.playTime; s.hint='Swipe to cut upfield.';emit(s,'catch','Caught! Turn upfield');
  if((ball.y-opponentGoal(s))*s.direction>=0) finishDown(s,ball.y);
}
function cpuCall(s) {
  const k=kickInfo(s),toGo=(s.firstDown-s.los)*s.direction, late=s.quarter>=4&&s.clock<30;
  if(k.distance<=k.maxDistance-4&&(s.down===4||(s.clock<8&&s.score[s.offense]+k.points>=s.score[1-s.offense]))) return 'kick';
  if((s.down>=3&&toGo>4)||late) return random(s)<.64?'cross':'go';
  const r=random(s);return r<.22?'slant':r<.44?'cross':r<.56?'go':r<.79?'sweep':'dive';
}
function cpuLive(s) {
  if(!s.cpu[s.offense]||s.playTime<s.cpuNext||s.flight) return;
  s.cpuNext=s.playTime+.52+random(s)*.62;
  if(s.phase==='kick') {
    const info=kickInfo(s),b=BALLS[s.ballType];
    const power=clamp(info.requiredPower+.08+(random(s)-.5)*.13,0,1);
    const spread=.022+Math.pow(info.distance/b.maxKick,3)*.10;
    const x=-s.wind*b.drift/85+(random(s)-.5)*spread;
    act(s,s.offense,{type:'flick',dx:x,dy:s.direction,power});return;
  }
  if(s.phase!=='live') return;
  const carrier=byId(s,s.ball.carrier);
  if(!carrier) return;
  if(carrier.role==='QB'&&!s.passThrown&&PLAYS[s.play].type==='pass') {
    const defenders=s.players.filter(p=>p.side!==s.offense);
    let best=null,score=-Infinity;
    for(const slot of eligibleSlots) {
      const p=pick(s,s.offense,slot), projected=leadPosition(p,.75);
      const distance=dist(carrier,projected);
      if(distance>47) continue;
      const space=dist(nearest(defenders,projected),projected);
      const rank=Math.min(9,space)+(projected.y-s.los)*s.direction*.18+random(s)*2.4;
      if(rank>score){score=rank;best=p;}
    }
    if(best) {
      const aim=leadPosition(best,clamp(dist(carrier,best)/24,.25,1.6)),range=dist(carrier,aim);
      const power=Math.pow(clamp((range-4)/(43*BALLS[s.ballType].range),.12,1),1/BALLS[s.ballType].strike);
      act(s,s.offense,{type:'flick',dx:aim.x-carrier.x,dy:aim.y-carrier.y,power});
    }
  } else {
    const defenders=s.players.filter(p=>p.side!==s.offense&&(p.y-carrier.y)*s.direction>-.5);
    const p=nearest(defenders,carrier);
    if(p&&dist(p,carrier)<8) {
      const towardMiddle=Math.abs(carrier.x)>20 ? -Math.sign(carrier.x) : carrier.x>=p.x?1:-1;
      act(s,s.offense,{type:'cut',dx:towardMiddle*.9,dy:s.direction});
    }
  }
}
const marking = [5,2,3,4,5,1,4];
function liveTick(s,dt) {
  const d=s.direction,side=s.offense,carrier=byId(s,s.ball.carrier);
  const pocket=!!(carrier&&carrier.role==='QB'&&!s.passThrown&&PLAYS[s.play].type==='pass');
  const receiving=pocket||s.ball.mode==='pass';
  const defenders=s.players.filter(p=>p.side!==side);
  const linemen=s.players.filter(p=>p.side===side&&p.slot>=6);
  for(const p of s.players) {
    if(p.side!==side) continue;
    if(p===carrier) {
      if(pocket) {
        walk(p,p.ox,p.oy-1.6*d,1.9,dt);
      } else {
        const b=BALLS[s.ballType];
        let vx=0,vy=d;
        if(s.play==='sweep'&&s.playTime<1.4) {vx=-.78*d;vy=.78*d;}
        if(s.play==='dive'&&s.playTime<.72) vx=.55*d;
        if(s.cutTime>0) {vx=s.cutX;vy=s.cutY;}
        const v=Math.hypot(vx,vy), speed=7.2*b.grip*(s.cutTime>0?1.20:1);
        walk(p,p.x+vx/v*3,p.y+vy/v*3,speed,dt);
      }
    } else if(receiving&&eligibleSlots.includes(p.slot)) {
      advanceRoute(p,dt);
    } else if(p.slot>=6) {
      const lane=(p.slot-8)*2.35*d, ahead=carrier?carrier.y:s.los;
      walk(p,lane+(s.play==='sweep'?-Math.min(7,s.playTime*3)*d:0),
        pocket?s.los+d*.6:ahead+d*3.4, pocket?2.4:5.7,dt);
    } else if(carrier&&s.passThrown) {
      walk(p,carrier.x+(p.slot%2?3:-3),carrier.y+3*d,5,dt);
    } else if(!receiving&&p.slot>=2&&p.slot<=5) {
      const y=p.oy+d*5;
      walk(p,p.ox* .90,y,4.7,dt);
    }
  }
  const pursuit=carrier||s.ball;
  for(const p of defenders) {
    if(s.defendTime>0&&p.id===s.defenderId) {
      walk(p,p.x+s.defendX*4,p.y+s.defendY*4,9,dt);continue;
    }
    const rush=p.slot>=7||(s.defense==='blitz'&&(p.slot===5||p.slot===6));
    if(receiving&&!rush) {
      const r=pick(s,side,marking[p.slot]),distanceToBall=dist(p,s.ball);
      if(s.ball.mode==='pass'&&s.flight&&distanceToBall<8&&s.flight.t>s.flight.duration*.56) {
        walk(p,s.flight.tx,s.flight.ty,6.8,dt);
      } else if(s.defense==='man'||p.slot===1||p.slot===2) {
        const trail=p.slot===1?-1.5:1.5;
        walk(p,r.x+trail,r.y+2.5*d,6.55,dt);
      } else {
        const zoneX=p.ox*.74+r.x*.26, zoneY=p.oy+clamp((r.y-s.los)*d,0,12)*.38*d;
        walk(p,zoneX,zoneY,5.2,dt);
      }
    } else {
      const trench=linemen.some(b=>dist(b,p)<2.8)&&p.slot>=6;
      const speed=pocket ? (s.playTime<2.9&&trench?.43:3.15) :
        (p.slot>=7?5.75:p.slot<4?8.5:7.65)*(trench?.58:1);
      const anticipate=!pocket&&carrier&&p.slot<7 ? clamp(dist(p,carrier)*.25,0,3.2)*d : 0;
      walk(p,pursuit.x,pursuit.y+anticipate,speed,dt);
    }
  }
  if(s.flight) {flightTick(s,dt);return;}
  if(!carrier) return;
  s.ball.x=carrier.x;s.ball.y=carrier.y;s.ball.z=.8;
  if((carrier.y-opponentGoal(s))*d>=0) {finishDown(s,carrier.y);return;}
  if(Math.abs(carrier.x)>=HALF_WIDTH) {finishDown(s,carrier.y,true,true);return;}
  const canTackle=s.playTime>(pocket?1.95:.65)&&(s.caughtAt<0||s.playTime-s.caughtAt>.34);
  const radius=s.cutTime>.29?.57:1.15;
  if(canTackle&&defenders.some(p=>dist(p,carrier)<radius)) {
    finishDown(s,carrier.y);return;
  }
  if(s.playTime>(pocket?7:32)) finishDown(s,carrier.y);
}
function quarterBreak(s) {
  if(s.quarter>=4&&s.score[0]!==s.score[1]) {
    s.phase='final';s.runningClock=false;s.hint='';
    emit(s,'final','Final whistle',s.score[0]>s.score[1]?0:1);return;
  }
  s.quarter++;s.clock=s.quarterSeconds;s.runningClock=false;
  if(s.quarter===3||s.quarter===5) Object.assign(s,drive(1));
  setup(s);emit(s,'quarter',s.quarter===3?'Second half':s.quarter>=5?'Overtime · next score wins':'Quarter '+s.quarter);
}
function tick(s,dt) {
  if(s.phase==='final') return;
  s.elapsed+=dt;s.phaseTime+=dt;
  if(s.runningClock) s.clock=Math.max(0,s.clock-dt);
  if(s.phase==='dead') {
    if(s.phaseTime<1.65) return;
    if(s.quarter>=5&&s.score[0]!==s.score[1]) {
      s.phase='final';s.runningClock=false;emit(s,'final','Overtime final',s.score[0]>s.score[1]?0:1);return;
    }
    Object.assign(s,s.pending);
    if(s.clock<=0) quarterBreak(s);else setup(s);
    return;
  }
  if(s.phase==='select') {
    if(s.clock<=0){quarterBreak(s);return;}
    if(s.cpu[s.offense]&&s.phaseTime>=s.cpuDelay) snap(s,cpuCall(s));
    return;
  }
  s.playTime+=dt;s.cutTime=Math.max(0,s.cutTime-dt);s.cutCooldown=Math.max(0,s.cutCooldown-dt);s.defendTime=Math.max(0,s.defendTime-dt);
  cpuLive(s);
  if(s.phase==='kick'){
    if(s.flight) {
      const kicker=pick(s,s.offense,0),d=s.direction;
      walk(kicker,.9*d,s.los-5.9*d,6.8,dt);
      for(const p of s.players) if(p.side!==s.offense) walk(p,p.x,s.los-d*1.4,1.9,dt);
      flightTick(s,dt);
    }
    return;
  }
  liveTick(s,dt);
}
// Fixed 60 Hz keeps host frame-rate changes from altering the simulation.
export function step(s,dtSeconds) {
  if(!Number.isFinite(dtSeconds)||dtSeconds<=0||s.phase==='final') return s;
  const tickSize=1/60;
  s.accumulator+=Math.min(.5,dtSeconds);
  while(s.accumulator>=tickSize-1e-10) {
    s.accumulator-=tickSize;tick(s,tickSize);
  }
  return s;
}
