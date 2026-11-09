import {createGame, step, act, kickInfo, PLAYS, BALLS} from './engine.js';
import {createRenderer, VENUES} from './renderer.js';
import {openPairing} from './pair-ui.js';

const $ = id => document.getElementById(id);
const iconPaths = {
  play:'<path fill="currentColor" stroke="none" d="m7 4 13 8-13 8z"/>',
  ipads:'<rect x="2" y="3" width="8" height="17" rx="1.6"/><rect x="14" y="3" width="8" height="17" rx="1.6"/><path d="M5.5 17h1m11 0h1"/>',
  book:'<path d="M3 4.5h5c1.8 0 3 .6 4 1.7 1-1.1 2.2-1.7 4-1.7h5v14h-5c-1.6 0-2.8.4-4 1.4-1.2-1-2.4-1.4-4-1.4H3zM12 6.2v13"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  pause:'<path d="M8 5v14m8-14v14" stroke-width="3.2"/>',
  check:'<path d="m4 12 5 5L20 6" stroke-width="3"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+iconPaths[name]+'</svg>';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

const teamList=[
  {code:'CHI',key:'bears',city:'Chicago',name:'Bears',shade:'#1c2a36',accent:'#ea773c'},
  {code:'GB',key:'packers',city:'Green Bay',name:'Packers',shade:'#1d332a',accent:'#f3c94e'},
  {code:'TEN',key:'titans',city:'Tennessee',name:'Titans',shade:'#243d46',accent:'#69b8df'},
  {code:'UT',key:'vols',city:'Tennessee',name:'Volunteers',shade:'#494237',accent:'#ff8b39'}
];
const teamFor=code=>teamList.find(team=>team.code===code)||teamList[0];
let settings={teams:['CHI','GB'],ball:'classic',sound:false};
try {
  const stored=JSON.parse(localStorage.getItem('fold-league-settings')||'{}');
  if(Array.isArray(stored.teams)&&stored.teams.length===2&&new Set(stored.teams).size===2&&stored.teams.every(t=>teamList.some(team=>team.code===t))) settings.teams=stored.teams;
  if(Object.hasOwn(BALLS,stored.ball))settings.ball=stored.ball;
  settings.sound=stored.sound===true;
} catch {}
function persist(){try{localStorage.setItem('fold-league-settings',JSON.stringify(settings))}catch{}}
let editSide=0;
function configure(){
  $('homeTab').setAttribute('aria-pressed',editSide===0);$('awayTab').setAttribute('aria-pressed',editSide===1);
  $('matchup').textContent=settings.teams[1]+' @ '+settings.teams[0]+' · '+VENUES[teamFor(settings.teams[0]).key].name;
  $('teams').innerHTML=teamList.map(t=>'<button class="team-card" data-team="'+t.code+'" style="--team:'+t.shade+'" aria-pressed="'+(t.code===settings.teams[editSide])+'" aria-label="'+t.city+' '+t.name+', '+VENUES[t.key].name+'"><img alt="" src="./assets/'+t.code.toLowerCase()+'.webp"><span class="check">'+icon('check')+'</span><span class="team-copy"><small>'+t.city.toUpperCase()+'</small><strong>'+t.name+'</strong></span></button>').join('');
  const phrases={light:'Fast cuts',classic:'Balanced',heavy:'Long range'};
  $('stocks').innerHTML=Object.entries(BALLS).map(([id,b])=>'<button class="stock" data-ball="'+id+'" title="'+b.description+' Maximum kick '+b.maxKick+' yards." aria-pressed="'+(settings.ball===id)+'"><i class="paperfold" aria-hidden="true"></i><span>'+b.name+'<small>'+phrases[id]+' · '+b.maxKick+' yd</small></span></button>').join('');
  $('sound').innerHTML=icon(settings.sound?'sound':'mute');$('sound').setAttribute('aria-label',settings.sound?'Turn sound off':'Turn sound on');$('sound').title=$('sound').getAttribute('aria-label');
}
$('homeTab').onclick=()=>{editSide=0;configure()};$('awayTab').onclick=()=>{editSide=1;configure()};
$('teams').onclick=e=>{const t=e.target.closest('[data-team]')?.dataset.team;if(!t)return;const old=settings.teams[editSide];if(settings.teams[1-editSide]===t)settings.teams[1-editSide]=old;settings.teams[editSide]=t;persist();configure();sound('select')};
$('stocks').onclick=e=>{const k=e.target.closest('[data-ball]')?.dataset.ball;if(!k)return;settings.ball=k;persist();configure();sound('select')};
let audio;
function prime(){if(!settings.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
function sound(type){
  if(!settings.sound||!audio||audio.state!=='running')return;
  const sequences={select:[240],snap:[94,132],throw:[410,540],catch:[460,660],tackle:[104,69],incomplete:[150,120],miss:[196,147],good:[330,440,550,660],touchdown:[330,440,550,660,880],final:[330,440,550,660],interception:[270,150]};
  const notes=sequences[type]; if(!notes)return;
  notes.forEach((hz,i)=>{const t=audio.currentTime+i*.077,osc=audio.createOscillator(),gain=audio.createGain();osc.type=['snap','tackle'].includes(type)?'triangle':'sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.075,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+.135);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.14)});
}
$('sound').onclick=()=>{settings.sound=!settings.sound;prime();persist();configure();sound('select')};
function showDialog(d){if(!d.open)d.showModal()}
document.querySelectorAll('[data-open-guide]').forEach(btn=>btn.onclick=()=>showDialog($('guide')));
document.addEventListener('click',e=>{const id=e.target.closest('[data-close]')?.dataset.close;if(id)$(id)?.close()});
configure();

const canvas=$('field'), controls=$('controls'), modal=$('break-sheet');
let view, state=null, mode='solo', seat=0, link=null, unsubscribe=null, inGame=false;
let paused=false,offline=false,abandoned=false,round='',frame=0,lastFrame=0,lastSent=0,gesture=null;
let panelKey='', eventKey=-1,toastUntil=0,modalKey='',previous=null,receivedAt=0,receiveGap=80,previewPlay=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const ordinal=['','1st','2nd','3rd','4th'];
const schemes={zone:'Zone',man:'Man cover',blitz:'Blitz'};
const paths={
  cross:'M8 27V18L30 6m-5 0h5v5M38 27V15L18 8',
  go:'M8 28V5m-4 5 4-5 4 5m13 18V4m-4 5 4-5 4 5m9 18V8',
  slant:'M6 27v-9L27 6m-5 0h5v5M33 27v-8l-9-4',
  sweep:'M22 27v-5C9 21 7 17 7 6m-4 4 4-5 4 5',
  dive:'M22 29c0-7 5-7 5-13V5m-4 5 4-5 4 5',
  kick:'M8 7v10h27V7M22 17v10'
};
function sketch(key){return '<svg aria-hidden="true" viewBox="0 0 43 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="'+paths[key]+'"/></svg>'}
function gameSeed(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]}
function newRound(){return createGame({teams:[...settings.teams],ball:settings.ball,quarterSeconds:120,cpu:[false,mode==='solo'],seed:gameSeed()})}
function enter(modeArg,assignedSeat){
  mode=modeArg;seat=assignedSeat;inGame=true;paused=false;offline=false;abandoned=false;gesture=null;panelKey='';eventKey=-1;toastUntil=0;modalKey='';previous=null;receivedAt=0;lastSent=0;previewPlay=null;
  $('home').hidden=true;$('game').hidden=false;document.body.classList.add('playing');$('game').classList.toggle('split',mode==='split');
  $('event').style.display='none';$('live-tip').style.display='none';$('controls').replaceChildren();$('down').textContent='Connecting';$('situ').textContent='';
  view??=createRenderer(canvas);lastFrame=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);window.scrollTo(0,0);prime();
}
function exitGame(notify=true){
  if(notify)link?.send('leave',{round});
  unsubscribe?.();unsubscribe=null;link?.close();link=null;round='';state=null;inGame=false;paused=false;gesture=null;previous=null;cancelAnimationFrame(frame);if(modal.open)modal.close();document.body.classList.remove('playing');$('game').hidden=true;$('home').hidden=false;configure();window.scrollTo(0,0);
}
function startSolo(){enter('solo',0);round=String(gameSeed());state=newRound();sound('snap')}
$('solo').onclick=startSolo;
function sendState(){
  if(link?.connected&&seat===0&&state)link.send('state',{round,state,paused});
}
function startPair(channel,role){
  link=channel;enter('split',role==='host'?0:1);state=null;round='';
  if(seat===0){round=String(gameSeed());state=newRound()}
  unsubscribe=link.subscribe({onMessage:remoteMessage,onStatus(status){if(!inGame||abandoned)return;if(status==='connected'){offline=false;if(seat===0)sendState();else link.send('ready',{});}else if(['disconnected','error','closed','connecting','waiting'].includes(status)){offline=true;gesture=null;}syncModal()}});
  if(seat===0)sendState();else link.send('ready',{});
}
function pairing(joinCode=''){prime();openPairing({onStart:startPair,joinCode})}
$('pair').onclick=()=>pairing();
const roomQuery=new URLSearchParams(location.search).get('room');if(roomQuery)pairing(roomQuery);
function gameTag(){return state?[state.quarter,state.offense,state.down,state.los].join('/'):''}
function validSnapshot(s) {
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const side = n => n === 0 || n === 1;
  if (!s || s.version !== 1 || !side(s.offense) || ![1, -1].includes(s.direction)) return false;
  if (!['select','live','kick','dead','final'].includes(s.phase) || !Object.hasOwn(BALLS,s.ballType)) return false;
  if (s.play !== null && !Object.hasOwn(PLAYS,s.play)) return false;
  if (!Array.isArray(s.teams) || s.teams.length !== 2 || !s.teams.every(t => teamList.some(team => team.code === t))) return false;
  if (!Array.isArray(s.score) || s.score.length !== 2 || !s.score.every(n => Number.isSafeInteger(n) && n >= 0)) return false;
  if (!point(s.ball) || !Number.isFinite(s.ball.z) || ![s.quarter,s.down,s.eventId].every(Number.isSafeInteger)) return false;
  if (![s.clock,s.los,s.firstDown,s.elapsed,s.playTime].every(Number.isFinite)) return false;
  if (s.flight && ![s.flight.sx,s.flight.sy,s.flight.tx,s.flight.ty,s.flight.apex,s.flight.t,s.flight.duration].every(Number.isFinite)) return false;
  if (s.lastEvent && (typeof s.lastEvent.text !== 'string' || typeof s.lastEvent.type !== 'string')) return false;
  return Array.isArray(s.players) && s.players.length === 22 && s.players.every(p =>
    point(p) && side(p.side) && Number.isFinite(p.heading) && Array.isArray(p.route) &&
    p.route.length <= 8 && p.route.every(point)
  );
}
function remoteMessage(kind,data){
  if(!inGame||!data||typeof data!=='object')return;
  if(kind==='ready'&&seat===0){sendState();return}
  if(kind==='state'&&seat===1){
    if(typeof data.round!=='string'||!validSnapshot(data.state))return;
    const now=performance.now();previous=round===data.round?state:null;receiveGap=Math.max(35,Math.min(160,now-receivedAt||80));receivedAt=now;
    if(round!==data.round){eventKey=-1;panelKey='';modalKey=''}
    round=data.round;state=data.state;paused=!!data.paused;offline=false;return;
  }
  if(kind==='leave'&&(!round||data.round===round)){abandoned=true;syncModal();return}
  if(data.round!==round||!state)return;
  if(kind==='input'&&seat===0&&!paused&&!offline&&data.tag===gameTag()){
    if(act(state,1,data.action))sendState();
  }else if(kind==='pause'&&seat===0&&typeof data.paused==='boolean'&&!offline&&state.phase!=='final'){
    paused=data.paused;gesture=null;sendState();syncModal();
  }
}
function action(a){
  if(!state||paused||offline||abandoned)return;
  if(mode==='split'&&seat===1){link?.send('input',{round,tag:gameTag(),action:a});return}
  if(act(state,seat,a))sendState();
}
function loop(now){
  if(!inGame)return;const dt=Math.min(.12,(now-lastFrame)/1000);lastFrame=now;
  if(state){
    if(!paused&&!offline&&!abandoned&&(mode==='solo'||seat===0))step(state,dt);
    if(mode==='split'&&seat===0&&now-lastSent>=66){sendState();lastSent=now}
    const renderState=guestFrame(now);
    view.draw(renderState,{mode,seat,venue:teamFor(state.teams[0]).key,reducedMotion:reducedMotion.matches,previewPlay,gesture:gesture?.world});
    hud(now);
  }
  syncModal();frame=requestAnimationFrame(loop);
}
function guestFrame(now){
  if(mode!=='split'||seat!==1||!previous||previous.phase!==state.phase||previous.eventId!==state.eventId||paused||!state.players.length)return state;
  const t=Math.max(0,Math.min(1,(now-receivedAt)/receiveGap));if(t>=1)return state;
  const lerp=(a,b)=>a+(b-a)*t;
  return {...state,players:state.players.map((p,i)=>{const old=previous.players[i];return old&&p.id===old.id?{...p,x:lerp(old.x,p.x),y:lerp(old.y,p.y)}:p}),ball:{...state.ball,x:lerp(previous.ball.x,state.ball.x),y:lerp(previous.ball.y,state.ball.y),z:lerp(previous.ball.z,state.ball.z)}};
}
function setText(el,txt){if(el.textContent!==txt)el.textContent=txt}
function shellScore(side){
  const t=teamFor(state.teams[side]);return '<i style="--accent:'+t.accent+'"></i><span>'+t.code+'</span><strong>'+Number(state.score[side])+'</strong>'+(state.offense===side?'<small>● BALL</small>':'');
}
function makePlayCards(k) {
  const cards = Object.entries(PLAYS).map(([key, play]) => {
    const kick = key === 'kick';
    const meta = kick ? k.distance+' YD · '+k.points+' PTS' : play.type.toUpperCase();
    const range = kick ? '<small class="kick-range">'+(k.distance > k.maxDistance ? 'Out of range · ' : '')+'Max '+k.maxDistance+' yd</small>' : '';
    return '<button class="play-option" data-play="'+key+'" title="'+play.description+'">'+
      sketch(key)+'<span class="meta">'+meta+'</span><strong>'+play.short+'</strong>'+range+'</button>';
  });
  return '<div class="play-options">'+cards.join('')+'</div>';
}
function escapeText(value) {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
function note(title,description) {
  return '<div class="input-note"><strong>'+escapeText(title)+'</strong><span>'+escapeText(description)+'</span></div>';
}
function hud(now){
  const k=kickInfo(state),mine=seat===state.offense;
  const clock=Math.ceil(state.clock);setText($('clock'),Math.floor(clock/60)+':'+String(clock%60).padStart(2,'0'));setText($('period'),state.quarter>4?'OT':'Q'+state.quarter);
  const yard=Math.abs(state.firstDown-state.los),goal=Math.abs(state.firstDown-(state.offense===0?100:0))<.01;
  setText($('down'),ordinal[state.down]+' & '+(goal?'goal':Math.max(1,Math.ceil(yard-.01)))+'  ·  '+(mine?'Your offense':'Your defense'));
  const home=teamFor(state.teams[0]),spot=Math.round(state.los);
  const location=spot===50?'Midfield':(spot<50?state.teams[0]:state.teams[1])+' '+Math.min(spot,100-spot);
  setText($('situ'),VENUES[home.key].name+'  /  '+location);
  const sharedKey=[state.phase,state.offense,state.quarter,state.down,k.distance,state.ballType,state.play,state.passThrown,state.ball.mode,state.defense,state.score.join('-'),state.teams.join('-'),state.lastEvent?.id].join('|');
  if(sharedKey!==panelKey){
    panelKey=sharedKey;$('score0').innerHTML=shellScore(0);$('score1').innerHTML=shellScore(1);
    if(state.phase==='select'&&mine)controls.innerHTML=makePlayCards(k);
    else if(state.phase==='select')controls.innerHTML='<div class="play-options def-options">'+Object.entries(schemes).map(([id,name])=>'<button data-scheme="'+id+'" aria-pressed="'+(state.defense===id)+'" class="play-option"><span class="meta">DEFENSE</span><strong>'+name+'</strong></button>').join('')+'</div>';
    else if(state.phase==='kick'&&!state.flight)controls.innerHTML=note(mine?'Flick for '+k.points+' points':'Field goal attempt',k.distance+' yards · '+BALLS[state.ballType].name+' max '+k.maxDistance+' yd');
    else if(state.phase==='live'&&mine&&PLAYS[state.play]?.type==='pass'&&!state.passThrown)controls.innerHTML=note('Flick toward a receiver','Swipe anywhere on the field. A longer, faster flick throws farther.');
    else if(state.phase==='live'&&mine&&state.ball.carrier)controls.innerHTML=note('Swipe to cut','Your runner advances automatically. Swipe to change the angle.');
    else if(state.phase==='live'&&!mine)controls.innerHTML=note('Pursue the ball','Swipe on the field to steer the nearest defender.');
    else if(state.phase==='dead')controls.innerHTML=note(state.lastEvent?.text||'Play complete','Next down coming up');
    else controls.innerHTML=note(state.phase==='final'?'Final whistle':state.ball.mode==='kick'?'Kick in flight':'Pass in flight',mine?'Watch the ball':'Track the play');
  }
  if(eventKey!==state.eventId){
    eventKey=state.eventId;const e=state.lastEvent;const show=e&&['first','turnover','good','miss','touchdown','safety','interception','quarter','catch'].includes(e.type);
    toastUntil=show?now+1450:0;if(show)setText($('event'),e.text);if(e)sound(e.type);previewPlay=null;
  }
  $('event').style.display=toastUntil>now?'block':'none';
  let tip='';
  if(gesture)tip='FLICK POWER  '+Math.round(gesture.power*100)+'%';
  else if(mode==='split'&&['live','kick'].includes(state.phase)&&((seat===0&&state.ball.y>50)||(seat===1&&state.ball.y<50)))tip='BALL ON THE OTHER iPAD · SWIPE HERE';
  else if(state.phase==='kick'&&!state.flight&&mine)tip='AIM UPFIELD  ·  '+Math.round(k.requiredPower*100)+'% POWER'+(k.distance>k.maxDistance?'  ·  OUT OF RANGE':'');
  if(toastUntil>now&&mode==='split')tip='';setText($('live-tip'),tip);$('live-tip').style.display=tip?'block':'none';
}
controls.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.dataset.play){action({type:'play',play:b.dataset.play});previewPlay=null}else if(b?.dataset.scheme){action({type:'defense',scheme:b.dataset.scheme});sound('select')}});
controls.addEventListener('pointerover',e=>{if(e.pointerType==='mouse')previewPlay=e.target.closest('[data-play]')?.dataset.play||null});
controls.addEventListener('pointerleave',()=>{previewPlay=null});
function pointerDown(e){
  if(!state||paused||offline||abandoned||gesture||!['live','kick'].includes(state.phase)||e.button!==0)return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=view.toWorld(e.clientX,e.clientY);
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now(),power:0,tag:gameTag(),eventId:state.eventId,world:{from:p,to:p}};
}
function pointerData(e){
  // Project both endpoints with the current camera so a moving broadcast view
  // cannot introduce a false horizontal or longitudinal flick.
  const a=view.toWorld(gesture.x,gesture.y),b=view.toWorld(e.clientX,e.clientY);
  const px=Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y),size=Math.min(canvas.clientWidth,canvas.clientHeight);
  const duration=Math.max(55,performance.now()-gesture.time),power=Math.min(1,px/Math.max(78,Math.min(175,size*.29))*.78+Math.min(.28,px/duration*.21));
  return {dx:b.x-a.x,dy:b.y-a.y,power:px<4?0:power,px,a,b};
}
canvas.addEventListener('pointerdown',pointerDown);
canvas.addEventListener('pointermove',e=>{if(gesture?.id!==e.pointerId)return;const p=pointerData(e);gesture.power=p.power;gesture.world={from:p.a,to:p.b}});
canvas.addEventListener('pointercancel',()=>{gesture=null});
canvas.addEventListener('lostpointercapture',()=>{gesture=null});
canvas.addEventListener('pointerup',e=>{
  if(gesture?.id!==e.pointerId)return;const p=pointerData(e),valid=gesture.tag===gameTag();gesture=null;
  if(!valid||p.px<9)return;
  const attack=seat===state.offense;
  const flick=attack&&(state.phase==='kick'||(PLAYS[state.play]?.type==='pass'&&!state.passThrown));
  action({type:flick?'flick':'cut',dx:p.dx,dy:p.dy,power:p.power});
});
function requestPause(value){
  if(!inGame||!state||state.phase==='final'||offline||abandoned)return;
  gesture=null;if(mode==='split'&&seat===1){link?.send('pause',{round,paused:value});return}
  paused=value;sendState();syncModal();
}
$('pause').onclick=()=>requestPause(true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&inGame)requestPause(true)});
modal.addEventListener('cancel',e=>{e.preventDefault();if(paused&&!abandoned&&!offline)requestPause(false)});
function syncModal(){
  if(!inGame)return;
  const key=abandoned?'left':offline?'lost':state?.phase==='final'?'final':paused?'paused':'';
  if(key===modalKey)return;modalKey=key;
  if(!key){if(modal.open)modal.close();return}
  let title,body,buttons='';
  if(key==='paused'){title='Time out';body=mode==='split'?'Both iPads are paused. Either player can resume.':'The game clock is stopped.';buttons='<button class="primary" data-break="resume">Resume game</button>'}
  if(key==='lost'){title='Connection lost';body=link?.code?.length===6?'The clock is stopped. Keep both iPads awake while the room reconnects.':'The local connection closed. Return to the locker room to pair again.'}
  if(key==='left'){title='Opponent left';body='The other iPad has left the game.'}
  if(key==='final'){
    const winner=teamFor(state.teams[state.score[0]>state.score[1]?0:1]);title=winner.name+' win';body=state.teams[0]+' '+state.score[0]+' — '+state.teams[1]+' '+state.score[1];
    if(mode==='solo'||seat===0)buttons='<button class="primary" data-break="again">Play again</button>';
  }
  $('break-content').innerHTML='<div class="micro">FOLD LEAGUE</div><h2>'+title+'</h2><p class="'+(key==='final'?'score-result':'')+'">'+body+'</p><div class="sheet-actions">'+buttons+'<button class="secondary" data-break="exit">Locker room</button></div>';showDialog(modal);
}
$('break-content').onclick=e=>{
  const k=e.target.closest('[data-break]')?.dataset.break;
  if(k==='exit')exitGame();if(k==='resume')requestPause(false);
  if(k==='again'){round=String(gameSeed());state=newRound();previous=null;eventKey=-1;panelKey='';paused=false;sendState();syncModal()}
};
document.addEventListener('keydown',e=>{if(inGame&&e.key==='Escape'&&!modal.open){e.preventDefault();requestPause(true)}});
