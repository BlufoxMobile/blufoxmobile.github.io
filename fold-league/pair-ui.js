import { createLink } from './link.js';

let activeLobby;
const styleURL = new URL('./pair-ui.css', import.meta.url).href;
const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;

function installStyles() {
  if (document.getElementById('pair-lobby-styles')) return;
  const sheet = document.createElement('link');
  sheet.id = 'pair-lobby-styles';
  sheet.rel = 'stylesheet';
  sheet.href = styleURL;
  document.head.append(sheet);
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(text, style, action) {
  const control = node('button', `pair-btn pair-${style}`, text);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}

function fieldDiagram() {
  const field = node('div', 'pair-diagram');
  field.setAttribute('aria-hidden', 'true');
  for (const index of ['01', '02']) {
    const ipad = node('span', 'pair-tablet');
    ipad.append(node('b', '', index));
    field.append(ipad);
  }
  return field;
}

function alignment() {
  const row = node('div', 'pair-alignment');
  row.append(fieldDiagram());
  const caption = node('div');
  caption.append(node('strong', '', 'Top edges together'), node('p', '', 'Lay both iPads flat, lock the same orientation, and sit at opposite end zones.'));
  row.append(caption);
  return row;
}

// The lobby owns the transport until the first connected event. Ownership then
// passes to onStart; the running game can subscribe to status and messages.
export function openPairing({ onStart, onClose, joinCode = '' } = {}) {
  activeLobby?.close();
  installStyles();
  const opener = document.activeElement;
  const dialog = node('dialog', 'pair-dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'pair-heading');
  const card = node('div', 'pair-card');
  const top = node('div', 'pair-top');
  const tag = node('span', 'pair-label', 'HEAD-TO-HEAD');
  const dismissButton = button('×', 'icon', () => close());
  dismissButton.setAttribute('aria-label', 'Close multiplayer setup');
  top.append(tag, dismissButton);
  const body = node('div', 'pair-body');
  card.append(top, body);
  dialog.append(card);
  document.body.append(dialog);

  let closed = false;
  let token = 0;
  let link = null;
  let statusLine;
  let roomInput = String(joinCode || '').trim().toUpperCase();
  const handle = { close: () => close() };
  activeLobby = handle;

  function release() {
    token++;
    const old = link;
    link = null;
    if (old) old.close();
  }

  function hide() {
    closed = true;
    if (activeLobby === handle) activeLobby = undefined;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    dialog.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
  }

  function close() {
    if (closed) return;
    release();
    hide();
    onClose?.();
  }

  function setStatus(text, kind = 'info') {
    if (!statusLine || closed) return;
    statusLine.dataset.kind = kind;
    statusLine.textContent = text;
  }

  function newLink(role) {
    release();
    const attempt = token;
    const current = createLink({
      onStatus(status, detail) {
        if (closed || attempt !== token) return;
        if (status === 'connected') {
          link = null;
          hide();
          onStart?.(current, role);
        } else if (status === 'error' || status === 'disconnected') {
          setStatus(detail || 'Connection interrupted. Try again.', 'error');
        } else if (status === 'connecting' || status === 'waiting') {
          setStatus(detail || 'Waiting for the other iPad…');
        }
      },
    });
    link = current;
    return { current, active: () => !closed && link === current && attempt === token };
  }

  function page(title, description) {
    body.replaceChildren();
    const heading = node('h2', 'pair-heading', title);
    heading.id = 'pair-heading';
    heading.tabIndex = -1;
    body.append(heading, node('p', 'pair-intro', description));
    const controls = node('div', 'pair-controls');
    body.append(controls);
    statusLine = node('p', 'pair-status');
    statusLine.setAttribute('role', 'status');
    statusLine.setAttribute('aria-live', 'polite');
    const footer = node('div', 'pair-foot');
    body.append(statusLine, footer);
    dialog.scrollTop = 0;
    if (dialog.open) heading.focus({ preventScroll: true });
    return { controls, footer };
  }

  function option(title, detail, label, action) {
    const item = button('', 'option', action);
    const group = node('span', 'pair-option-text');
    group.append(node('strong', '', title), node('small', '', detail));
    const arrow = node('span', 'pair-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    item.append(node('span', 'pair-role', label), group, arrow);
    return item;
  }

  function intro() {
    release();
    const { controls } = page('Two iPads. One field.', 'Open this game on both iPads and connect them to the same Wi-Fi. Choose a role on each screen.');
    controls.append(
      alignment(),
      option('Host a game', 'Use this iPad’s matchup and share a room code.', 'P1', hostRoom),
      option('Join a game', 'Enter the code shown on the host iPad.', 'P2', joinRoom),
    );
  }

  function backButton(text, action) {
    return button(text, 'text', action);
  }

  async function copyValue(value, input, label) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch {
      if (!input?.isConnected) return;
      input.focus();
      input.select();
      if (typeof input.setSelectionRange === 'function') input.setSelectionRange(0, value.length);
      setStatus('Text selected. Use Copy from your device’s menu.');
    }
  }

  function shareControls(value, input, label, canShare = true) {
    const actions = node('div', 'pair-actions');
    actions.append(button(`Copy ${label}`, 'secondary', () => copyValue(value, input, label)));
    if (canShare && typeof navigator.share === 'function') {
      actions.append(button(`Share ${label}`, 'secondary', async () => {
        try { await navigator.share({ text: value }); }
        catch (err) { if (err.name !== 'AbortError') setStatus(`Use Copy ${label} to send the text.`, 'error'); }
      }));
    }
    return actions;
  }

  function showField(container, id, title, multi, readonly = false) {
    const label = node('label', 'pair-label pair-field-label', title);
    label.htmlFor = id;
    const input = node(multi ? 'textarea' : 'input', multi ? 'pair-input pair-long' : 'pair-input pair-code');
    input.id = id;
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', multi ? 'off' : 'characters');
    input.readOnly = readonly;
    if (multi) input.rows = 2;
    else { input.type = 'text'; input.maxLength = 6; }
    container.append(label, input);
    return input;
  }

  async function hostRoom() {
    const { controls, footer } = page('Host the field', 'On the second iPad, choose Join a game and enter this six-character code. Keep both screens awake.');
    const pane = node('div', 'pair-code-panel');
    const codeBox = showField(pane, 'pair-host-code', 'Room code', false, true);
    codeBox.placeholder = '······';
    controls.append(pane, alignment());
    footer.append(backButton('Change role', intro), backButton('Pair manually', () => manual('host')));
    const session = newLink('host');
    setStatus('Opening the room…');
    try {
      const code = await session.current.host();
      if (!session.active()) return;
      codeBox.value = code;
      pane.append(shareControls(code, codeBox, 'code', false));
      setStatus('Room open. Waiting for the second iPad…');
    } catch (err) {
      if (!session.active()) return;
      setStatus(err.message || 'Couldn’t open the room. Try again or pair manually.', 'error');
      pane.append(button('Retry room', 'secondary', hostRoom));
    }
  }

  function joinRoom() {
    release();
    const { controls, footer } = page('Join the field', 'Enter the room code displayed on the host iPad. The game starts when both screens connect.');
    const form = node('form', 'pair-form');
    const input = showField(form, 'pair-join-code', 'Room code', false);
    input.placeholder = 'ABC234';
    input.value = roomInput.slice(0, 6);
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); roomInput = input.value; });
    const submit = node('button', 'pair-btn pair-primary', 'Join game');
    submit.type = 'submit';
    form.append(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = input.value.trim().toUpperCase();
      if (!codePattern.test(code)) {
        setStatus('Enter all six letters or numbers from the host iPad.', 'error');
        input.focus();
        return;
      }
      if (submit.disabled) return;
      const session = newLink('guest');
      submit.disabled = true;
      submit.textContent = 'Connecting…';
      setStatus('Looking for the host…');
      try { await session.current.join(code); }
      catch (err) { if (session.active()) setStatus(err.message || 'Room unavailable. Check the code and try again.', 'error'); }
      finally {
        if (session.active()) { submit.disabled = false; submit.textContent = 'Join game'; }
      }
    });
    controls.append(form, alignment());
    footer.append(backButton('Change role', intro), backButton('Pair manually', () => manual('guest')));
  }

  function manual(role) {
    const hosting = role === 'host';
    const { controls, footer } = page(hosting ? 'Send an invite' : 'Answer an invite', hosting
      ? 'Send the invite text to your opponent with AirDrop or Messages. Keep this screen open and paste their reply below.'
      : 'Paste the invite text from the host. Send the generated reply back to them, then keep this screen open.');
    const session = newLink(role);
    const generated = node('div', 'pair-manual-block');
    const entry = node('form', 'pair-form pair-manual-block');
    if (hosting) controls.append(generated, entry);
    else controls.append(entry, generated);
    const key = hosting ? 'reply' : 'invite';
    const incoming = showField(entry, 'pair-manual-in', `Paste ${key} text`, true);
    incoming.placeholder = hosting ? 'Reply from the second iPad' : 'Invite from the host';
    const submit = node('button', 'pair-btn pair-primary', hosting ? 'Connect iPads' : 'Create reply');
    submit.type = 'submit';
    entry.append(submit);
    const outgoing = (value, kind) => {
      const box = showField(generated, 'pair-manual-out', `Your ${kind} text`, true, true);
      box.value = value;
      generated.append(shareControls(value, box, kind));
    };
    footer.append(backButton('Use room code', hosting ? hostRoom : joinRoom), backButton(hosting ? 'Fresh invite' : 'Start again', () => manual(role)));
    entry.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      const text = incoming.value.trim();
      if (!text) { setStatus(`Paste the full ${key} from the other iPad.`, 'error'); incoming.focus(); return; }
      submit.disabled = true;
      setStatus(hosting ? 'Connecting the two screens…' : 'Preparing your reply…');
      try {
        if (hosting) {
          await session.current.acceptAnswer(text);
          if (session.active()) setStatus('Reply accepted. Waiting for the connection…');
        } else {
          const reply = await session.current.answerInvite(text);
          if (!session.active()) return;
          generated.replaceChildren();
          outgoing(reply, 'reply');
          setStatus('Send the reply to the host. Keep this screen open.');
        }
      } catch (err) {
        if (session.active()) setStatus(err.message || `Couldn’t read this ${key}. Try a fresh invite.`, 'error');
      } finally {
        if (session.active()) submit.disabled = false;
      }
    });
    if (hosting) {
      submit.disabled = true;
      setStatus('Preparing your invite…');
      session.current.makeInvite().then(invite => {
        if (!session.active()) return;
        outgoing(invite, 'invite');
        submit.disabled = false;
        setStatus('Invite ready. Waiting for a reply…');
      }).catch(err => {
        if (!session.active()) return;
        setStatus(err.message || 'Unable to prepare this invite.', 'error');
        generated.append(button('Create fresh invite', 'secondary', () => manual('host')));
      });
    }
  }

  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll('button:not(:disabled), input, textarea'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else { dialog.setAttribute('open', ''); dialog.classList.add('pair-fallback'); }
  if (roomInput) joinRoom(); else intro();
  return handle;
}
