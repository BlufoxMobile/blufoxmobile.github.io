/* Room codes use PeerServer for discovery. Local invites exchange the same WebRTC
   offer and answer by hand, so a pair on one LAN can play without a broker. */
const ROOM_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_PREFIX = 'foldfootball-v1-';
const WIRE_VERSION = 1;
const MAX_PACKET = 64 * 1024;
const SETUP_TIMEOUT = 22000;
const LOST = 'Connection lost. Keep both iPads awake and on the same Wi-Fi.';
const BROKER = 'The room service could not be reached. Try again or use local pairing on the same Wi-Fi.';
const NO_ROOM = 'Room not found. Check the six characters and keep the host’s game open.';
let peerLibrary;

function randomText(length, alphabet = ROOM_CHARS) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, n => alphabet[n % alphabet.length]).join('');
}

function checkBrowser() {
  if (!globalThis.RTCPeerConnection || !globalThis.crypto?.getRandomValues) {
    throw new Error('Open this game over HTTPS in Safari or another browser with WebRTC support.');
  }
}

async function loadPeer() {
  checkBrowser();
  peerLibrary ??= import('./vendor/peerjs-1.5.5.min.js').catch(error => {
    peerLibrary = null;
    throw error;
  });
  await peerLibrary;
  return window.peerjs.Peer;
}

function humanError(error) {
  if (error?.type === 'peer-unavailable') return NO_ROOM;
  if (error?.type === 'unavailable-id') return 'That room code is already taken. Create a new room.';
  if (['network', 'socket-error', 'socket-closed', 'server-error'].includes(error?.type)) return BROKER;
  return 'Could not connect the iPads. Use the same Wi-Fi or try local pairing.';
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // An error can occur in an event before the calling async function awaits this.
  promise.catch(() => {});
  return { promise, resolve, reject };
}

function rejected(reason) { return reason instanceof Error ? reason : new Error(reason); }

function encodeDescription(type, session, description) {
  const bytes = new TextEncoder().encode(JSON.stringify([session, description.sdp]));
  return `PF1.${type}.` + btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeDescription(value, expected) {
  try {
    const match = String(value || '').replace(/\s/g, '').match(/^PF1\.([OA])\.([A-Za-z0-9_-]{20,40000})$/);
    if (!match || match[1] !== expected) throw new Error();
    const binary = atob(match[2].replace(/-/g, '+').replace(/_/g, '/'));
    const [session, sdp] = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    if (typeof session !== 'string' || !/^[A-Z2-9]{16}$/.test(session) || typeof sdp !== 'string' || !sdp.startsWith('v=0') || !sdp.includes('m=application')) throw new Error();
    return { session, description: { type: expected === 'O' ? 'offer' : 'answer', sdp } };
  } catch {
    throw new Error(`Paste the entire ${expected === 'O' ? 'invite from the host' : 'reply from the second iPad'}, including the PF1 prefix.`);
  }
}

// With no ICE servers a manual offer gathers local candidates quickly. Wait for
// gathering so Safari can use a single paste in each direction (no trickle ICE).
function gathered(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, 6500);
    pc.addEventListener('icegatheringstatechange', onChange);
    onChange();
  });
}

function rawPipe(channel) {
  return {
    on(name, fn) {
      if (name === 'data') channel.addEventListener('message', event => fn(event.data));
      else channel.addEventListener(name, fn);
    },
    send: value => channel.send(value),
    close: () => channel.close(),
    buffered: () => channel.bufferedAmount,
    isOpen: () => channel.readyState === 'open'
  };
}

function peerPipe(connection) {
  return {
    on: (name, fn) => connection.on(name, fn),
    send: value => connection.send(value),
    close: () => connection.close(),
    buffered: () => connection.dataChannel?.bufferedAmount || 0,
    isOpen: () => connection.open
  };
}

export function createLink(initial = {}) {
  const listeners = new Set([initial]);
  let generation = 0, role = null, mode = null, code = '', roomSession = '', guestKey = '', reservedKey = '';
  let peer = null, pc = null, pipe = null, connected = false, status = 'closed', sequence = 0, received = 0;
  let opened = null, joined = null, timer, channelTimer, heartbeat, reconnect, brokerRetry, lastSeen = 0;
  let hadConnection = false, hasAnswer = false;

  function statusChange(next, detail) {
    status = next;
    for (const observer of [...listeners]) observer.onStatus?.(next, detail);
  }

  function cleanup() {
    generation++;
    clearTimeout(timer); clearTimeout(channelTimer); clearInterval(heartbeat);
    clearTimeout(reconnect); clearTimeout(brokerRetry);
    const oldPipe = pipe, oldPeer = peer, oldPc = pc;
    pipe = null; peer = null; pc = null; connected = false;
    opened?.reject(rejected('Pairing was closed.')); joined?.reject(rejected('Pairing was closed.'));
    opened = null; joined = null;
    oldPipe?.close(); oldPeer?.destroy(); oldPc?.close();
  }

  function start(which, method) {
    cleanup();
    checkBrowser();
    role = which; mode = method; code = ''; roomSession = ''; reservedKey = '';
    guestKey = ''; hadConnection = false; hasAnswer = false;
    statusChange('connecting', method === 'manual' ? 'Preparing a local Wi-Fi link…' : 'Contacting the room service…');
    return generation;
  }

  function isCurrent(epoch) {
    if (generation !== epoch) throw new Error('Pairing was closed.');
  }

  function breakInitial(message) {
    const openAttempt = opened, joinAttempt = joined;
    opened = null; joined = null;
    cleanup();
    openAttempt?.reject(rejected(message)); joinAttempt?.reject(rejected(message));
    statusChange('error', message);
  }

  function reconnectGuest() {
    clearTimeout(reconnect);
    if (!(role === 'guest' && mode === 'room' && hadConnection)) return;
    const epoch = generation;
    reconnect = setTimeout(() => {
      if (epoch !== generation || connected || pipe || !peer) return;
      if (!peer.disconnected && !peer.destroyed) dial();
      else reconnectGuest();
    }, 2000);
  }

  function drop(current, reason = LOST, retry = true) {
    if (current !== pipe) return;
    pipe = null;
    const previouslyConnected = connected;
    connected = false; clearTimeout(channelTimer); clearInterval(heartbeat);
    current.close();
    if (joined && !hadConnection) {
      breakInitial(reason);
    } else if (previouslyConnected || hadConnection || mode === 'manual') {
      statusChange('disconnected', reason);
    } else if (role === 'host') {
      statusChange('waiting', `Room ${code} is open. Join on the other iPad.`);
    }
    if (retry) reconnectGuest();
  }

  function put(current, packet) {
    try { current.send(JSON.stringify(packet)); return true; }
    catch { drop(current); return false; }
  }

  function ready(current) {
    clearTimeout(timer); clearTimeout(channelTimer); clearTimeout(reconnect);
    clearInterval(heartbeat); lastSeen = Date.now(); sequence = 0; received = 0;
    connected = true; hadConnection = true;
    heartbeat = setInterval(() => {
      if (pipe !== current) return;
      if (Date.now() - lastSeen > 18000) return drop(current);
      put(current, { t:'ping' });
    }, 3000);
    joined?.resolve(); joined = null;
    statusChange('connected', 'Both iPads are connected.');
  }

  function attach(current) {
    // Release stale half-open handshakes before another guest can claim a seat.
    if (pipe || !role) { current.close(); return; }
    const epoch = generation;
    pipe = current;
    const alive = () => epoch === generation && current === pipe;
    const onOpen = () => {
      if (alive() && role === 'guest') put(current, { t:'hello', v:WIRE_VERSION, code, key:guestKey });
    };
    clearTimeout(channelTimer);
    // A manual host may be waiting for the user to share its invite. Start that
    // timeout after acceptAnswer, instead of expiring while the user copies it.
    if (mode === 'room' || role === 'guest') {
      channelTimer = setTimeout(() => { if (alive()) drop(current, 'The second iPad did not respond. Check Wi-Fi, then pair again.'); }, SETUP_TIMEOUT);
    }
    current.on('open', onOpen);
    current.on('close', () => { if (alive()) drop(current); });
    current.on('error', () => { if (alive()) drop(current); });
    current.on('data', raw => {
      if (!alive() || typeof raw !== 'string' || raw.length > MAX_PACKET) return;
      let p;
      try { p = JSON.parse(raw); } catch { return; }
      if (!p || typeof p !== 'object') return;
      lastSeen = Date.now();
      if (!connected) {
        if (role === 'host' && p.t === 'hello') {
          if (p.v !== WIRE_VERSION || p.code !== code || !/^[A-Z2-9]{16}$/.test(p.key) || (reservedKey && reservedKey !== p.key)) {
            put(current, { t:'reject' });
            setTimeout(() => { if (alive()) drop(current, 'This room is reserved for the paired iPad.', false); }, 100);
            return;
          }
          reservedKey = p.key;
          if (put(current, { t:'ready', v:WIRE_VERSION, session:roomSession })) ready(current);
        } else if (role === 'guest' && p.t === 'ready' && p.v === WIRE_VERSION && typeof p.session === 'string' && p.session.length === 16) {
          if (roomSession && roomSession !== p.session) return drop(current, 'That room has closed. Pair again to start a new match.', false);
          roomSession = p.session; ready(current);
        } else if (p.t === 'reject') drop(current, 'This room is already paired with another iPad.', false);
        return;
      }
      if (p.t === 'ping') return void put(current, {t:'pong'});
      if (p.t !== 'event' || p.session !== roomSession || !Number.isSafeInteger(p.seq) || p.seq <= received || typeof p.kind !== 'string' || p.kind.length > 32) return;
      received = p.seq;
      for (const observer of [...listeners]) observer.onMessage?.(p.kind, p.data);
    });
    if (current.isOpen()) queueMicrotask(onOpen);
  }

  function dial() {
    if (!peer || pipe || connected) return;
    try {
      attach(peerPipe(peer.connect(ROOM_PREFIX + code, { reliable:true, serialization:'raw' })));
    } catch {
      if (hadConnection) reconnectGuest(); else breakInitial(BROKER);
    }
  }

  async function openRoom(epoch, id) {
    const Peer = await loadPeer(); isCurrent(epoch);
    const p = new Peer(id, { secure:true, debug:0 });
    peer = p;
    const pending = opened = deferred();
    const alive = () => generation === epoch && peer === p;
    timer = setTimeout(() => { if (alive()) breakInitial(BROKER); }, SETUP_TIMEOUT);
    p.on('open', () => {
      if (!alive()) return;
      const firstOpen = Boolean(opened);
      clearTimeout(timer); opened?.resolve(); opened = null;
      if (role === 'guest' && hadConnection && !pipe) reconnectGuest();
      if (!firstOpen && !connected && role === 'host') {
        statusChange('waiting', `Room ${code} is open. Rejoin on the other iPad.`);
      }
    });
    p.on('connection', connection => {
      if (!alive() || role !== 'host' || pipe) { connection.close(); return; }
      attach(peerPipe(connection));
    });
    p.on('error', error => {
      if (!alive() || connected) return;
      const detail = humanError(error);
      if (pipe) drop(pipe, detail);
      else if (hadConnection) { statusChange('disconnected', detail); reconnectGuest(); }
      else breakInitial(detail);
    });
    p.on('disconnected', () => {
      if (!alive() || p.destroyed) return;
      if (!connected && role === 'host' && !opened) statusChange('disconnected', 'Reconnecting the room service…');
      const retry = () => {
        if (!alive() || p.destroyed || !p.disconnected) return;
        try { p.reconnect(); } catch { /* still waiting for a signaling socket */ }
        brokerRetry = setTimeout(retry, 4000);
      };
      clearTimeout(brokerRetry); brokerRetry = setTimeout(retry, 2000);
    });
    await pending.promise; isCurrent(epoch);
  }

  function localConnection(epoch) {
    const native = pc = new RTCPeerConnection({iceServers:[]});
    native.addEventListener('datachannel', e => {
      if (generation === epoch && role === 'guest') attach(rawPipe(e.channel));
    });
    function onFailure() {
      if (generation !== epoch) return;
      if (native.connectionState === 'failed' || native.iceConnectionState === 'failed') {
        const detail = 'The local link failed. Use the same Wi-Fi, allow local network access, then create a fresh invite.';
        if (pipe) drop(pipe, detail, false); else breakInitial(detail);
      }
    }
    native.addEventListener('connectionstatechange', onFailure);
    native.addEventListener('iceconnectionstatechange', onFailure);
    return native;
  }

  async function localText(epoch, native, type) {
    await gathered(native); isCurrent(epoch);
    if (!native.localDescription?.sdp.includes('a=candidate:')) throw new Error('No local Wi-Fi route was found. Allow local network access or use a room code.');
    return encodeDescription(type, roomSession, native.localDescription);
  }

  function startGuestKey(roomCode) {
    // In-tab storage lets the same guest recover its seat on a reconnect.
    const key = ROOM_PREFIX + 'guest-' + roomCode;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved && /^[A-Z2-9]{16}$/.test(saved)) return saved;
      const created = randomText(16); sessionStorage.setItem(key, created); return created;
    } catch { return randomText(16); }
  }

  return {
    get role() { return role; }, get code() { return code; }, get connected() { return connected; }, get status() { return status; },
    subscribe(observer) { listeners.add(observer); return () => listeners.delete(observer); },
    async host() {
      const epoch = start('host', 'room'); code = randomText(6); roomSession = randomText(16);
      await openRoom(epoch, ROOM_PREFIX + code);
      statusChange('waiting', `Room ${code} is open. Join on the other iPad.`);
      return code;
    },
    async join(value) {
      const roomCode = String(value || '').trim().toUpperCase();
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode)) throw new Error('Enter the six-character code shown on the host iPad.');
      const epoch = start('guest', 'room'); code = roomCode; guestKey = startGuestKey(code);
      await openRoom(epoch, ROOM_PREFIX + 'guest-' + randomText(14));
      const pending = joined = deferred(); statusChange('waiting', `Connecting to room ${code}…`);
      dial(); await pending.promise;
    },
    async makeInvite() {
      const epoch = start('host', 'manual'); roomSession = randomText(16); code = roomSession;
      const native = localConnection(epoch); attach(rawPipe(native.createDataChannel('fold-football', {ordered:true})));
      await native.setLocalDescription(await native.createOffer());
      const result = await localText(epoch, native, 'O');
      statusChange('waiting', 'Share the invite with the other iPad, then paste its reply.');
      return result;
    },
    async answerInvite(invite) {
      const decoded = decodeDescription(invite, 'O');
      const epoch = start('guest', 'manual'); roomSession = decoded.session; code = roomSession; guestKey = randomText(16);
      const native = localConnection(epoch);
      await native.setRemoteDescription(decoded.description);
      await native.setLocalDescription(await native.createAnswer());
      const result = await localText(epoch, native, 'A');
      statusChange('waiting', 'Share this reply with the host iPad.');
      return result;
    },
    async acceptAnswer(reply) {
      if (!pc || role !== 'host' || mode !== 'manual' || hasAnswer || connected) throw new Error('Create a fresh host invite before accepting another reply.');
      const decoded = decodeDescription(reply, 'A');
      if (decoded.session !== roomSession) throw new Error('This reply belongs to a different invite. Use the response to the current invite.');
      const epoch = generation;
      await pc.setRemoteDescription(decoded.description); isCurrent(epoch); hasAnswer = true;
      if (!connected) {
        statusChange('waiting', 'Connecting the iPads over Wi-Fi…');
        channelTimer = setTimeout(() => { if (generation === epoch && pipe && !connected) drop(pipe, 'The local link timed out. Join the same Wi-Fi, then create a fresh invite.', false); }, SETUP_TIMEOUT);
      }
    },
    send(kind, data) {
      if (!connected || !pipe || typeof kind !== 'string' || kind.length > 32) return false;
      // A newly drawn state supersedes one stuck behind a full outgoing buffer.
      if (kind === 'state' && pipe.buffered() > 42000) return false;
      return put(pipe, {t:'event', session:roomSession, seq:++sequence, kind, data});
    },
    close() {
      cleanup(); role = null; code = ''; hadConnection = false;
      statusChange('closed', 'Room closed.');
    }
  };
}
