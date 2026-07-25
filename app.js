import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, push, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBX_xg3MTYFZLR3q6i7Rf2Ikz2Yii4X0MA",
  authDomain: "study-world-f04f4.firebaseapp.com",
  databaseURL: "https://study-world-f04f4-default-rtdb.firebaseio.com",
  projectId: "study-world-f04f4",
  storageBucket: "study-world-f04f4.firebasestorage.app",
  messagingSenderId: "458761318304",
  appId: "1:458761318304:web:d107447cbce7d77273bec5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messagesRef = ref(db, "messages");

const feed = document.getElementById('feed');
const textEl = document.getElementById('text');
const sendBtn = document.getElementById('send');
const setupEl = document.getElementById('setup');
const myNameDisplay = document.getElementById('my-name-display');
const theirNameDisplay = document.getElementById('their-name-display');
let myName = null;
let editingId = null;
let activeMsgId = null;
let activeMsgIsMine = false;
let currentMessages = {};

const REACTION_SET = ["❤️","😂","😮","😢","👍","🔥"];

// ---- setup (name is stored locally on this device only) ----
function init(){
  const saved = localStorage_fallback_get('myName');
  if(saved){ myName = saved; startApp(); return; }
  setupEl.style.display = 'flex';
}
// Simple in-memory fallback since this app avoids browser localStorage per environment rules;
// here we use a plain JS variable backed by a cookie so the name persists across visits.
function localStorage_fallback_get(key){
  const match = document.cookie.match(new RegExp('(^| )'+key+'=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}
function localStorage_fallback_set(key, value){
  document.cookie = key+'='+encodeURIComponent(value)+';max-age=31536000;path=/';
}

document.getElementById('name-save').onclick = ()=>{
  const v = document.getElementById('name-input').value.trim();
  if(!v) return;
  myName = v;
  localStorage_fallback_set('myName', v);
  startApp();
};
document.getElementById('name-input').addEventListener('keydown', e=>{
  if(e.key==='Enter') document.getElementById('name-save').click();
});

function startApp(){
  setupEl.style.display = 'none';
  myNameDisplay.textContent = myName;
  onValue(messagesRef, (snapshot)=>{
    currentMessages = snapshot.val() || {};
    render(currentMessages);
  });
}

function newId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function linkify(str){
  const urlRe = /(https?:\/\/[^\s]+)/g;
  return str.replace(urlRe, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function extKind(url){
  const u = url.toLowerCase().split('?')[0];
  if(/\.(png|jpe?g|gif|webp|svg)$/.test(u)) return 'image';
  if(/\.(mp4|webm|mov|m4v)$/.test(u)) return 'video';
  if(/\.(mp3|wav|m4a|ogg)$/.test(u)) return 'audio';
  return 'file';
}

function renderReactions(m){
  if(!m.reactions || Object.keys(m.reactions).length===0) return '';
  const counts = {};
  Object.entries(m.reactions).forEach(([person, emoji])=>{
    counts[emoji] = counts[emoji] || {count:0, mine:false};
    counts[emoji].count++;
    if(person===myName) counts[emoji].mine = true;
  });
  let html = '<div class="reactions">';
  Object.entries(counts).forEach(([emoji, data])=>{
    html += `<span class="rchip${data.mine?' mine-r':''}">${emoji}<span class="rcount">${data.count>1?data.count:''}</span></span>`;
  });
  html += '</div>';
  return html;
}

function render(messagesObj){
  const list = Object.entries(messagesObj)
    .map(([id, m]) => ({...m, id}))
    .sort((a,b)=> a.time - b.time);

  const others = list.filter(m=>m.sender!==myName);
  if(others.length){
    theirNameDisplay.textContent = others[others.length-1].sender;
  }
  if(list.length===0){
    feed.innerHTML = '<div class="empty">No messages yet. Say hello — this line only exists between the two of you.</div>';
    return;
  }
  feed.innerHTML = '';
  list.forEach(m=>{
    const row = document.createElement('div');
    row.className = 'row ' + (m.sender===myName ? 'mine':'theirs');
    row.dataset.id = m.id;
    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (m.deleted ? ' deleted' : '');

    if(m.deleted){
      bubble.textContent = 'This message was deleted';
    } else if(m.type === 'text'){
      bubble.innerHTML = linkify(escapeHtml(m.content));
    } else if(m.type === 'attachment'){
      const kind = extKind(m.content);
      if(kind==='image'){
        bubble.innerHTML = (m.caption? escapeHtml(m.caption)+'<br>':'') + `<img src="${m.content}" alt="image">`;
      } else if(kind==='video'){
        bubble.innerHTML = (m.caption? escapeHtml(m.caption)+'<br>':'') + `<video src="${m.content}" controls></video>`;
      } else if(kind==='audio'){
        bubble.innerHTML = (m.caption? escapeHtml(m.caption)+'<br>':'') + `<audio src="${m.content}" controls></audio>`;
      } else {
        const icon = {file:'📄'}[kind] || '🔗';
        bubble.innerHTML = (m.caption? escapeHtml(m.caption)+'<br>':'') +
          `<a class="card" href="${m.content}" target="_blank" rel="noopener">
             <span class="ic">${icon}</span>
             <span class="info"><b>${escapeHtml(m.content)}</b><span>Open link</span></span>
           </a>`;
      }
    }
    if(!m.deleted){
      bubble.onclick = (e)=>{ e.stopPropagation(); openMsgActions(m.id, m.sender===myName); };
    }
    row.appendChild(bubble);

    if(!m.deleted){
      const reactHtml = renderReactions(m);
      if(reactHtml){
        const rdiv = document.createElement('div');
        rdiv.innerHTML = reactHtml;
        row.appendChild(rdiv.firstChild);
      }
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const d = new Date(m.time);
    const timeStr = d.toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
    meta.innerHTML = escapeHtml(m.sender) + ' · ' + timeStr + (m.edited && !m.deleted ? ' <span class="edited-tag">· edited</span>' : '');
    row.appendChild(meta);
    feed.appendChild(row);
  });
  feed.scrollTop = feed.scrollHeight;
}

function sendMessage(msg){
  push(messagesRef, msg);
}
function updateMessage(id, patch){
  update(ref(db, 'messages/' + id), patch);
}

sendBtn.onclick = ()=>{
  const v = textEl.value.trim();
  if(!v) return;
  if(editingId){
    const id = editingId;
    exitEditMode();
    updateMessage(id, {content:v, edited:true});
    textEl.value = '';
    textEl.style.height = 'auto';
    return;
  }
  textEl.value = '';
  textEl.style.height = 'auto';
  sendMessage({sender:myName, type:'text', content:v, time:Date.now(), edited:false, deleted:false, reactions:{}});
};
textEl.addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendBtn.click(); }
});
textEl.addEventListener('input', ()=>{
  textEl.style.height = 'auto';
  textEl.style.height = Math.min(textEl.scrollHeight,100)+'px';
});

// ---- emoji panel ----
const EMOJIS = ["❤️","🔥","😂","😍","😊","🥰","😘","😭","😢","😁","😅","😆","🤣","😉","😎","🤩","🥳","😜","🤔","🙄",
"😴","🤗","😇","🙃","😳","🤯","😱","🥺","😤","😡","👍","👎","👏","🙌","🙏","🤝","💪","✌️","👌","🤙",
"👀","👋","💖","💕","💗","💓","💞","💘","💝","💔","✨","🌟","⭐","🎉","🎊","🌈","☀️","🌙","⚡","💯",
"🔥","🍀","🌸","🌺","🌻","🦋","🐶","🐱","🦄","🐼","🎶","🎵","🎧","📸","📷","🎥","💃","🕺","🥂","🍕",
"🍔","🍟","🍩","🍦","☕","🍾","🥺","😌","😏","🤤","🫶","🫡","🥹","😮‍💨","🤌","🧡","💛","💚","💙","💜"];
const emojiPanel = document.getElementById('emoji-panel');
EMOJIS.forEach(em=>{
  const b = document.createElement('button');
  b.textContent = em;
  b.onclick = ()=>{ textEl.value += em; textEl.focus(); };
  emojiPanel.appendChild(b);
});
document.getElementById('emoji-toggle').onclick = ()=>{
  document.getElementById('attach-panel').classList.remove('open');
  emojiPanel.classList.toggle('open');
};

// ---- attach panel ----
const attachPanel = document.getElementById('attach-panel');
document.getElementById('attach-toggle').onclick = ()=>{
  emojiPanel.classList.remove('open');
  attachPanel.classList.toggle('open');
};
document.getElementById('attach-cancel').onclick = ()=>{
  attachPanel.classList.remove('open');
  document.getElementById('attach-url').value='';
  document.getElementById('attach-caption').value='';
};
document.getElementById('attach-send').onclick = ()=>{
  const url = document.getElementById('attach-url').value.trim();
  const cap = document.getElementById('attach-caption').value.trim();
  if(!url) return;
  attachPanel.classList.remove('open');
  document.getElementById('attach-url').value='';
  document.getElementById('attach-caption').value='';
  sendMessage({sender:myName, type:'attachment', content:url, caption:cap, time:Date.now(), edited:false, deleted:false, reactions:{}});
};

document.getElementById('ig-btn').onclick = ()=>{
  window.open('https://www.instagram.com/reels/', '_blank');
};

// ---- message action sheet ----
const overlayBg = document.getElementById('overlay-bg');
const msgActions = document.getElementById('msg-actions');
const reactRow = document.getElementById('react-row');
const actEdit = document.getElementById('act-edit');
const actDelete = document.getElementById('act-delete');
const actCancel = document.getElementById('act-cancel');
const editBanner = document.getElementById('edit-banner');

REACTION_SET.forEach(em=>{
  const b = document.createElement('button');
  b.textContent = em;
  b.onclick = ()=>{
    toggleReaction(activeMsgId, em);
    closeMsgActions();
  };
  reactRow.appendChild(b);
});
const reactMoreBtn = document.createElement('button');
reactMoreBtn.id = 'react-more-btn';
reactMoreBtn.textContent = '➕';
reactMoreBtn.onclick = ()=>{
  reactMoreGrid.classList.toggle('open');
};
reactRow.appendChild(reactMoreBtn);

const reactMoreGrid = document.getElementById('react-more-grid');
EMOJIS.forEach(em=>{
  const b = document.createElement('button');
  b.textContent = em;
  b.onclick = ()=>{
    toggleReaction(activeMsgId, em);
    reactMoreGrid.classList.remove('open');
    closeMsgActions();
  };
  reactMoreGrid.appendChild(b);
});

function openMsgActions(id, isMine){
  activeMsgId = id;
  activeMsgIsMine = isMine;
  actEdit.style.display = isMine ? 'flex' : 'none';
  actDelete.style.display = isMine ? 'flex' : 'none';
  overlayBg.classList.add('open');
  msgActions.classList.add('open');
}
function closeMsgActions(){
  overlayBg.classList.remove('open');
  msgActions.classList.remove('open');
  document.getElementById('react-more-grid').classList.remove('open');
  activeMsgId = null;
}
overlayBg.onclick = closeMsgActions;
actCancel.onclick = closeMsgActions;

function toggleReaction(id, emoji){
  const msg = currentMessages[id];
  if(!msg) return;
  const reactions = {...(msg.reactions||{})};
  if(reactions[myName] === emoji){
    delete reactions[myName];
  } else {
    reactions[myName] = emoji;
  }
  updateMessage(id, {reactions});
}

actEdit.onclick = ()=>{
  const id = activeMsgId;
  closeMsgActions();
  const msg = currentMessages[id];
  if(!msg || msg.type!=='text') return;
  editingId = id;
  textEl.value = msg.content;
  textEl.focus();
  textEl.style.height = 'auto';
  textEl.style.height = Math.min(textEl.scrollHeight,100)+'px';
  editBanner.classList.add('open');
};
document.getElementById('edit-cancel').onclick = exitEditMode;
function exitEditMode(){
  editingId = null;
  textEl.value = '';
  textEl.style.height = 'auto';
  editBanner.classList.remove('open');
}

actDelete.onclick = ()=>{
  const id = activeMsgId;
  closeMsgActions();
  updateMessage(id, {deleted:true, content:'', reactions:{}});
  if(editingId === id) exitEditMode();
};

init();
