
  // ===== Firebase SDK (CDN, modular) =====
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
  import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile,
    sendEmailVerification,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
  import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

  // ===== Sua config =====
  const firebaseConfig = {
    apiKey: "AIzaSyAzy7pGHF6bpeMe3e-tHGwfjyE2hW4xcu0",
    authDomain: "flux-922f2.firebaseapp.com",
    projectId: "flux-922f2",
    storageBucket: "flux-922f2.firebasestorage.app",
    messagingSenderId: "717404554931",
    appId: "1:717404554931:web:5c31490a074ff2d07712c6"
  };

  // ===== Init =====
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  // ===== Helpers =====
  const $ = (s) => document.querySelector(s);
  const setHint = (id, msg) => { const el = document.getElementById(id); if (el) el.textContent = msg || ""; };

  const parseUTM = () => {
    const p = new URLSearchParams(location.search);
    const keys = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","ref"];
    const out = {};
    keys.forEach(k => { const v = p.get(k); if (v) out[k] = v; });
    return out;
  };

  const genHandle = (name) => {
    // gera um handle básico a partir do nome (sem garantir unicidade)
    return name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"") // remove acentos
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/(^\.|\.$)/g, "")
      .slice(0, 20);
  };

  // ===== UI Refs =====
  const form   = document.querySelector("form.form");
  const btn    = document.getElementById("Signup");
  const pass   = document.getElementById("pass");
  const pass2  = document.getElementById("pass2");
  const nameEl = document.getElementById("name");
  const email  = document.getElementById("email");
  const terms  = document.getElementById("terms");

  // ===== Validação rápida =====
  const validate = () => {
    let ok = true;
    setHint("name-hint","");
    setHint("email-hint","");
    setHint("pass-hint","");
    setHint("pass2-hint","");

    if (!nameEl.value.trim()) {
      setHint("name-hint","Informe seu nome.");
      ok = false;
    }
    if (!email.checkValidity()) {
      setHint("email-hint","E-mail inválido.");
      ok = false;
    }
    if (pass.value.length < 6) {
      setHint("pass-hint","A senha precisa ter ao menos 6 caracteres.");
      ok = false;
    }
    if (pass.value !== pass2.value) {
      setHint("pass2-hint","As senhas não conferem.");
      ok = false;
    }
    if (!terms.checked) {
      // Reaproveita o hint do email pra não criar outro visual aqui
      setHint("email-hint","Você precisa aceitar os termos.");
      ok = false;
    }
    return ok;
  };

  // ===== Erros do Firebase em PT-BR =====
  const fbErrPt = (code) => {
    const map = {
      "auth/email-already-in-use": "Este e-mail já está em uso.",
      "auth/invalid-email": "E-mail inválido.",
      "auth/operation-not-allowed": "Cadastro desativado no projeto.",
      "auth/weak-password": "Senha fraca. Use 6+ caracteres.",
      "auth/network-request-failed": "Falha de rede. Verifique sua conexão.",
      "auth/too-many-requests": "Muitas tentativas. Tente novamente em instantes."
    };
    return map[code] || "Não foi possível concluir o cadastro.";
  };

  // ===== Submit =====
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    btn.disabled = true; btn.style.opacity = .8;

    try {
      const name = nameEl.value.trim();
      const handle = genHandle(name);
      const userCred = await createUserWithEmailAndPassword(auth, email.value.trim(), pass.value);

      // Atualiza displayName
      await updateProfile(userCred.user, { displayName: name });

      // Envia verificação por e-mail (opcional mas recomendado)
      try { await sendEmailVerification(userCred.user); } catch {}

      // Monta payloads
      const utm = parseUTM();
      const nowTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const device = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || null,
        language: navigator.language || "pt-BR",
        timezone: nowTZ || null,
        addedAt: serverTimestamp()
      };

      // Documento público (perfil)
      const publicRef = doc(db, "users", userCred.user.uid);
      await setDoc(publicRef, {
        uid: userCred.user.uid,
        handle,                           // sugestão inicial (pode ser alterado depois)
        displayName: name,
        photoURL: userCred.user.photoURL || null,
        bio: "",
        bannerURL: null,
        location: null,
        website: null,
        isVerified: false,                // para futuro "verificado"
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        counts: {
          followers: 0,
          following: 0,
          posts: 0,
          likes: 0,
          comments: 0,
          reposts: 0
        },
        settings: {
          theme: "system",
          language: navigator.language || "pt-BR",
          privacy: {
            profile: "public",            // public | friends | private
            messages: "friends"
          },
          notifications: {
            email: true,
            push: true
          }
        },
        status: {
          online: false,
          lastActiveAt: serverTimestamp()
        }
      }, { merge: true });

      // Documento privado (dados sensíveis e telemetria mínima)
      const privateRef = doc(db, "users_private", userCred.user.uid);
      await setDoc(privateRef, {
        uid: userCred.user.uid,
        email: userCred.user.email,
        emailVerified: userCred.user.emailVerified || false,
        providers: (userCred.user.providerData || []).map(p => ({ providerId: p.providerId, uid: p.uid })),
        utm: Object.keys(utm).length ? utm : null,
        referral: document.referrer || null,
        deviceFirst: device,
        lastLoginAt: serverTimestamp(),
        security: {
          mfaEnabled: false,
          lastPasswordChange: serverTimestamp()
        }
      }, { merge: true });

      
      setHint("pass2-hint","Cadastro concluído com sucesso!");
      form.reset();
      terms.checked = false;
      
      // Redirecione se quiser (ex.: feed)
      window.location.href = "/app";

    } catch (err) {
      const msg = fbErrPt(err?.code);
      setHint("pass2-hint", msg);
      console.error(err);
    } finally {
      btn.disabled = false; btn.style.opacity = 1;
    }
  });

  // Opcional: observar auth (útil para depurar)
  onAuthStateChanged(auth, (user) => {
    if (user) console.log("AUTH:", user.uid, user.email, user.emailVerified);
  });