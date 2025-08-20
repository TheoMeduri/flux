// app.js (ES Module) — Composer + Feed + Avatar fix

// ===== Firebase (CDN, modular) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  limit as qlimit,
  onSnapshot,
  increment,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ===== Config =====
const firebaseConfig = {
  apiKey: "AIzaSyAzy7pGHF6bpeMe3e-tHGwfjyE2hW4xcu0",
  authDomain: "flux-922f2.firebaseapp.com",
  projectId: "flux-922f2",
  storageBucket: "flux-922f2.firebasestorage.app",
  messagingSenderId: "717404554931",
  appId: "1:717404554931:web:5c31490a074ff2d07712c6",
};

// ===== Init =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ===== Página =====
const REDIRECT_LOGIN = "../";     // ajuste se o login for outra rota
const FEED_LIMIT     = 50;

const $ = (s) => document.querySelector(s);

// Topbar
const topName   = $("#topName");
const topEmail  = $("#topEmail");
const topAvatar = $("#topAvatar");
const welcome   = $("#welcome");
const btnExit   = $("#btnExit");
const searchInput = $("#searchInput");

// Composer
const composerEl        = document.querySelector(".fx-composer");
const composerAvatarEl  = document.querySelector(".fx-composer .fx-avatar"); // <<< AQUI: avatar do composer
const composerInput     = document.querySelector(".fx-composer__input");
const composerPublishBtn= document.querySelector(".fx-composer .fx-btn--primary");

// Feed container
const feedEl = document.getElementById("feed");

// Estado
let CURRENT_USER = null;
let CURRENT_PUBLIC_DOC = null;

// ===== Utils =====
function getInitials(str) {
  const src = (str || "").trim();
  if (!src) return "?";
  const isMail = src.includes("@");
  const base = isMail ? src.split("@")[0] : src;
  const parts = base.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function gradientFromUid(uid){
  let h=0; for (let i=0;i<uid.length;i++) h=(h*31 + uid.charCodeAt(i))>>>0;
  const a = h % 360, b = (h*7)%360;
  return `linear-gradient(135deg, hsl(${a} 80% 55%), hsl(${b} 72% 55%))`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Pinta avatar (foto se houver; senão, iniciais com gradiente)
function paintAvatarEl(el, { initials, uid, photoURL }) {
  if (!el) return;
  // limpa estados anteriores
  el.classList.remove("is-photo");
  el.style.backgroundImage = "";
  el.style.background = "";

  if (photoURL) {
    el.textContent = "";
    el.classList.add("is-photo");
    el.style.backgroundImage = `url("${photoURL}")`;
    // caso seu CSS não tenha a classe, asseguramos aqui:
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  } else {
    el.textContent = initials || "?";
    el.style.background = uid ? gradientFromUid(uid) : "linear-gradient(135deg, var(--flux-blue), var(--flux-violet))";
  }
}

function formatRelative(ts) {
  if (!ts) return "agora";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff/60)}min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString();
}

function createEl(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function renderPostCard(postId, data) {
  const { author = {}, content = "", createdAt = null, media = null } = data || {};
  const initials = getInitials(author.displayName || author.email || "");
  const when = formatRelative(createdAt);

  const card = createEl(`
    <article class="fx-post" data-id="${postId}">
      <header class="fx-post__head">
        <div class="fx-avatar">${escapeHtml(initials)}</div>
        <div class="fx-post__meta">
          <div class="fx-post__name">
            ${escapeHtml(author.displayName || "Usuário")}
            <span class="fx-handle">${author.handle ? "@" + escapeHtml(author.handle) : ""}</span>
          </div>
          <time class="fx-post__time">${escapeHtml(when)}</time>
        </div>
      </header>
      <div class="fx-post__content">${escapeHtml(content)}</div>
      ${media && media.url ? `
        <figure class="fx-post__media">
          <img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || "mídia")}"/>
        </figure>` : ``}
      <footer class="fx-actions">
        <a href="#" class="fx-action"><i class="ri-heart-3-line"></i><span>Curtir</span></a>
        <a href="#" class="fx-action"><i class="ri-chat-3-line"></i><span>Comentar</span></a>
        <a href="#" class="fx-action"><i class="ri-repeat-line"></i><span>Repostar</span></a>
        <a href="#" class="fx-action"><i class="ri-share-forward-line"></i><span>Compartilhar</span></a>
      </footer>
    </article>
  `);
  return card;
}

function prependToFeed(node){ if (!feedEl) return; feedEl.firstChild ? feedEl.insertBefore(node, feedEl.firstChild) : feedEl.appendChild(node); }
function appendToFeed(node){ if (!feedEl) return; feedEl.appendChild(node); }
function clearComposer(){ if (composerInput) composerInput.value = ""; }

// ===== Persistência =====
await setPersistence(auth, browserLocalPersistence);

// ===== Auth =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = REDIRECT_LOGIN; return; }
  CURRENT_USER = user;

if (user) {
  renderSuggestions(user);    // ✅ passa o objeto `user` inteiro
}



  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    CURRENT_PUBLIC_DOC = snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Falha ao obter perfil público:", e);
  }

  const displayName =
    CURRENT_PUBLIC_DOC?.displayName ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuário";

  const email     = user.email || "—";
  const initials  = getInitials(displayName || email);
  const photoURL  = user.photoURL || CURRENT_PUBLIC_DOC?.photoURL || null;

// ----- Preenche topbar + selo verificado -----
const isVerified =
  CURRENT_PUBLIC_DOC?.verified === true || CURRENT_PUBLIC_DOC?.isVerified === true;

if (topName) {
  const safeName = escapeHtml(displayName);
  topName.innerHTML = isVerified
    ? `${safeName} <span class="verify" title="Verificado"><i class="ri-verified-badge-fill" aria-hidden="true"></i></span>`
    : safeName;
}

if (topEmail) topEmail.textContent = email;
if (welcome)  welcome.innerHTML    = `Você está logado(a) como <strong>${escapeHtml(displayName)}</strong>.`;

paintAvatarEl(topAvatar,        { initials, uid: user.uid, photoURL });
paintAvatarEl(composerAvatarEl, { initials, uid: user.uid, photoURL });


  // Marca online
  try {
    await setDoc(
      doc(db, "users", user.uid),
      { status: { online: true, lastActiveAt: serverTimestamp() }, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) { console.warn("status online falhou:", e); }

  initFeed();
});

// ===== Logout =====
btnExit?.addEventListener("click", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (user) {
    try {
      await setDoc(doc(db, "users", user.uid), {
        status: { online: false, lastActiveAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) { console.warn("status offline falhou:", e); }
  }
  await signOut(auth);
  window.location.href = REDIRECT_LOGIN;
});

const btnExit2 = document.getElementById('btnExit2');
btnExit2?.addEventListener("click", async (e) =>  {
  e.preventDefault();
  const user = auth.currentUser;
  if (user) {
    try {
      await setDoc(doc(db, "users", user.uid), {
        status: { online: false, lastActiveAt: serverTimestamp() },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) { console.warn("status offline falhou:", e); }
  }
  await signOut(auth);
  window.location.href = REDIRECT_LOGIN;
});

// ===== Composer: publicar =====
composerPublishBtn?.addEventListener("click", async () => {
  if (!CURRENT_USER || !composerInput) return;

  const raw = (composerInput.value || "").trim();
  if (!raw) {
    composerInput.focus();
    composerInput.setCustomValidity("Escreva algo antes de publicar.");
    composerInput.reportValidity();
    setTimeout(() => composerInput.setCustomValidity(""), 1400);
    return;
  }
  if (raw.length > 1000) {
    composerInput.focus();
    composerInput.setCustomValidity("Seu post pode ter no máximo 1000 caracteres.");
    composerInput.reportValidity();
    setTimeout(() => composerInput.setCustomValidity(""), 1600);
    return;
  }

  const displayName =
    CURRENT_PUBLIC_DOC?.displayName ||
    CURRENT_USER.displayName ||
    CURRENT_USER.email?.split("@")[0] ||
    "Usuário";
  const handle = CURRENT_PUBLIC_DOC?.handle || null;

  const payload = {
    uid: CURRENT_USER.uid,
    content: raw,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visibility: "public",
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    author: {
      uid: CURRENT_USER.uid,
      displayName,
      handle,
      photoURL: CURRENT_USER.photoURL || null,
      email: CURRENT_USER.email || null,
    },
    media: null,
  };

  try {
    const ref = await addDoc(collection(db, "posts"), payload);
    try {
      await updateDoc(doc(db, "users", CURRENT_USER.uid), {
        "counts.posts": increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      await setDoc(doc(db, "users", CURRENT_USER.uid), { counts: { posts: 1 } }, { merge: true });
    }
    // Render otimista
    const optimistic = { ...payload, createdAt: new Date() };
    prependToFeed(renderPostCard(ref.id, optimistic));
    clearComposer();
  } catch (e) {
    console.error("Falha ao publicar:", e);
    composerInput.setCustomValidity("Não foi possível publicar. Tente novamente.");
    composerInput.reportValidity();
    setTimeout(() => composerInput.setCustomValidity(""), 1600);
  }
});

// ===== Feed =====
function initFeed(){
  if (!feedEl) return;
  feedEl.innerHTML = "";

  const qFeed = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    qlimit(FEED_LIMIT)
  );

  onSnapshot(qFeed, (snap) => {
    feedEl.innerHTML = "";
    snap.forEach((docSnap) => {
      appendToFeed(renderPostCard(docSnap.id, docSnap.data()));
    });
  }, (err) => console.error("Feed error:", err));
}

// ===== Atalhos de teclado =====
window.addEventListener("keydown", (ev) => {
  const tag = (ev.target && ev.target.tagName) || "";
  const isTyping = tag === "INPUT" || tag === "TEXTAREA" || ev.target.isContentEditable;

  if (ev.key === "/" && !isTyping) {
    ev.preventDefault();
    searchInput?.focus();
    const val = searchInput?.value || "";
    searchInput?.setSelectionRange(val.length, val.length);
  }
  if (ev.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
  }
});

// ===== Fan menu (FAB central) =====
const fabToggle = document.getElementById("fabToggle");
const fanMenu   = document.getElementById("fanMenu");

function openFan(){
  if (!fanMenu || !fabToggle) return;
  fanMenu.hidden = false;
  // força reflow para animação (Safari/iOS)
  // eslint-disable-next-line no-unused-expressions
  fanMenu.offsetHeight;
  fanMenu.classList.add("is-open");
  fabToggle.setAttribute("aria-expanded","true");
}
function closeFan(){
  if (!fanMenu || !fabToggle) return;
  fanMenu.classList.remove("is-open");
  fabToggle.setAttribute("aria-expanded","false");
  // espera a transição e esconde
  setTimeout(()=>{ fanMenu.hidden = true; }, 200);
}

fabToggle?.addEventListener("click", (e)=>{
  e.preventDefault();
  const expanded = fabToggle.getAttribute("aria-expanded") === "true";
  expanded ? closeFan() : openFan();
});

// Fecha ao tocar fora
document.addEventListener("click", (e)=>{
  if (!fanMenu || fanMenu.hidden) return;
  const withinFab = fabToggle?.contains(e.target);
  const withinFan = fanMenu?.contains(e.target);
  if (!withinFab && !withinFan) closeFan();
});

// Fecha no ESC
window.addEventListener("keydown", (e)=>{
  if (e.key === "Escape" && fanMenu && !fanMenu.hidden) closeFan();
});

// (Opcional) ação dos itens
fanMenu?.addEventListener("click", (e)=>{
  const btn = e.target.closest(".fx-fan__item");
  if (!btn) return;
  // aqui você chama a ação (ex.: abrir input de imagem, abrir modal, etc.)
  // console.log("Fan action:", btn.getAttribute("aria-label"));
  closeFan();
});

// Adiciona evento em todos os posts
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".fx-action");
  if (!btn) return;

  // só se for o primeiro .fx-action dentro do footer do post
  const parent = btn.parentElement;
  const index = Array.from(parent.children).indexOf(btn);
  if (index !== 0) return; // não é o primeiro (like)

  e.preventDefault();

  // verifica se já está marcado
  const isLiked = btn.classList.contains("fill");

  if (isLiked) {
    // voltar para o estado original
    btn.innerHTML = `<i class="ri-heart-3-line"></i><span>Curtir</span>`;
    btn.classList.remove("fill");
  } else {
    // marcar como curtido
    btn.innerHTML = `<i class="ri-heart-3-fill"></i><span>Curtido</span>`;
    btn.classList.add("fill");
  }
});

async function getFollowingSet(currentUid) {
  const out = new Set();
  try {
    const snap = await getDocs(collection(db, "follows", currentUid, "following"));
    snap.forEach(d => out.add(d.id));
  } catch (e) {
    console.warn("getFollowingSet:", e);
  }
  return out;
}


// Render sugestões
const followListEl = document.querySelector(".fx-follow");
const emptyStateEl = followListEl?.querySelector("p");

function getFriendshipId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function initialsFrom(nameOrEmail){
  if (!nameOrEmail) return "?";
  const base = (nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail)
    .replace(/[^A-Za-z0-9]+/g," ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
}

async function renderSuggestions(user) {
  if (!followListEl) return;

  // limpa lista
  followListEl.querySelectorAll(".fx-follow__item").forEach(n => n.remove());
  if (emptyStateEl) emptyStateEl.style.display = "block";

  // pega todos os usuários
  const snap = await getDocs(collection(db, "users"));
  const candidates = [];
  snap.forEach(docSnap => {
    const uid = docSnap.id;
    const data = docSnap.data() || {};
    if (uid === user.uid) return; // nunca eu mesmo
    candidates.push({ id: uid, ...data });
  });

  if (candidates.length === 0) return;
  if (emptyStateEl) emptyStateEl.style.display = "none";

  // embaralha e corta em até 5
  const chosen = candidates.sort(() => 0.5 - Math.random()).slice(0, 5);

  const frag = document.createDocumentFragment();

  for (const u of chosen) {
    const li = document.createElement("li");
    li.className = "fx-follow__item";

    li.innerHTML = `
      <div class="fx-avatar"></div>
      <div class="fx-follow__meta verifyFollow">
        <strong>
          ${escapeHtml(u.displayName || "Usuário")}
          ${u.isVerified ? `<span class="fx-verified"><i class="ri-verified-badge-fill"></i></span>` : ""}
        </strong>
        <span class="fx-handle">${u.handle ? "@" + escapeHtml(u.handle) : ""}</span>
      </div>
      <button class="fx-btn fx-btn--soft" data-uid="${u.id}" aria-pressed="false">
        Seguir
      </button>
    `;

    // pinta o avatar
    const avatarEl = li.querySelector(".fx-avatar");
    avatarEl.textContent = initialsFrom(u.displayName || u.email);
    avatarEl.style.background = u.id
      ? gradientFromUid(u.id)
      : "linear-gradient(135deg, var(--flux-blue), var(--flux-violet))";

    frag.appendChild(li);

    // checa estado atual
    (async () => {
      const btn = li.querySelector("button[data-uid]");
      const followRef = doc(db, "follows", user.uid, "following", u.id);
      const followSnap = await getDoc(followRef);

      const otherFollowsMe = (
        await getDoc(doc(db, "follows", u.id, "following", user.uid))
      ).exists();

      if (followSnap.exists() && otherFollowsMe) {
        // amizade
        btn.textContent = "Amigos";
        btn.classList.add("fx-btn--friends");
        btn.setAttribute("aria-pressed", "true");
      } else if (followSnap.exists() && !otherFollowsMe) {
        // só eu sigo
        btn.textContent = "Seguindo";
        btn.setAttribute("aria-pressed", "true");
      } else if (!followSnap.exists() && otherFollowsMe) {
        // só o outro segue → mostrar "Seguir de volta"
        btn.textContent = "Seguir de volta";
        btn.dataset.followBack = "true";
      } else {
        // nenhum segue
        btn.textContent = "Seguir";
      }
    })();
  }

  followListEl.appendChild(frag);

  // listeners
  followListEl.querySelectorAll("button[data-uid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetUid = btn.dataset.uid;
      const followRef = doc(db, "follows", user.uid, "following", targetUid);
      const targetUserRef = doc(db, "users", targetUid);
      const pressed = btn.getAttribute("aria-pressed") === "true";

      try {
        if (pressed) {
          // desfazer follow
          await deleteDoc(followRef);
          btn.textContent = btn.dataset.followBack === "true" ? "Seguir de volta" : "Seguir";
          btn.setAttribute("aria-pressed", "false");
          btn.classList.remove("fx-btn--friends");

          await updateDoc(targetUserRef, { "counts.followers": increment(-1) });

          const otherFollowsMe = (
            await getDoc(doc(db, "follows", targetUid, "following", user.uid))
          ).exists();
          if (!otherFollowsMe) {
            const friendshipId = getFriendshipId(user.uid, targetUid);
            await deleteDoc(doc(db, "friends", friendshipId)).catch(() => {});
          }
        } else {
          // criar follow
          await setDoc(followRef, { createdAt: serverTimestamp() });
          await updateDoc(targetUserRef, { "counts.followers": increment(1) });

          const otherFollowsMe = (
            await getDoc(doc(db, "follows", targetUid, "following", user.uid))
          ).exists();

          if (otherFollowsMe) {
            // amizade
            const friendshipId = getFriendshipId(user.uid, targetUid);
            await setDoc(
              doc(db, "friends", friendshipId),
              { users: [user.uid, targetUid], createdAt: serverTimestamp() },
              { merge: true }
            );
            btn.textContent = "Amigos";
            btn.classList.add("fx-btn--friends");
          } else {
            btn.textContent = "Seguindo";
          }

          btn.setAttribute("aria-pressed", "true");
        }
      } catch (e) {
        console.error("follow toggle:", e);
      }
    });
  });
}



