// ===== Firebase SDK (CDN) =====
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
  import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
  import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

  // ===== SUA CONFIG DO PROJETO =====
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

  // ===== Helpers UI =====
  const $ = (s) => document.querySelector(s);
  const setHint = (id, msg) => { const el = document.getElementById(id); if (el) el.textContent = msg || ""; };

  const form  = document.querySelector("form.form");
  const btn   = document.getElementById("Login");
  const email = document.getElementById("email");
  const pass  = document.getElementById("pass");
  const forgot = document.getElementById("forgot");

  // ===== Map de erros em PT-BR =====
  const fbErrPt = (code) => ({
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-disabled": "Usuário desativado.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente em instantes.",
    "auth/network-request-failed": "Falha de rede. Verifique sua conexão."
  }[code] || "Não foi possível entrar. Verifique os dados e tente novamente.");

  // ===== Persistência (permanece logado) =====
  await setPersistence(auth, browserLocalPersistence);

  // ===== Se já estiver autenticado, pode redirecionar direto =====
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "./app";
    }
  });

  // ===== Esqueci a senha =====
  forgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    setHint("email-hint", "");
    if (!email.value.trim()) {
      setHint("email-hint", "Digite seu e-mail para recuperar a senha.");
      email.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.value.trim());
      setHint("email-hint", "Enviamos um link de redefinição para o seu e-mail.");
    } catch (err) {
      setHint("email-hint", fbErrPt(err?.code));
      console.error(err);
    }
  });

  // ===== Login =====
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setHint("email-hint", "");
    setHint("pass-hint", "");

    if (!email.checkValidity()) {
      setHint("email-hint", "E-mail inválido.");
      return;
    }
    if (pass.value.length < 6) {
      setHint("pass-hint", "A senha precisa ter ao menos 6 caracteres.");
      return;
    }

    btn.disabled = true; btn.style.opacity = .8;

    try {
      const cred = await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);

      // Atualiza telemetria mínima e status
      const uid = cred.user.uid;

      // users_private: último login
      await setDoc(doc(db, "users_private", uid), {
        lastLoginAt: serverTimestamp(),
        emailVerified: cred.user.emailVerified
      }, { merge: true });

      // users: status online + lastActive
      await setDoc(doc(db, "users", uid), {
        status: {
          online: true,
          lastActiveAt: serverTimestamp()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Redireciona para o app/feed (ajuste a rota)
      window.location.href = "./app"; // <-- troque para sua rota real

    } catch (err) {
      const msg = fbErrPt(err?.code);
      setHint("pass-hint", msg);
      console.error(err);
    } finally {
      btn.disabled = false; btn.style.opacity = 1;
    }
  });

  // ===== (Opcional) toggle mostrar/ocultar senha sem mexer no HTML =====
  // Cria um ícone clicável ao lado do input de senha
  (() => {
    const group = pass?.closest(".input-group");
    if (!group) return;
    const wrap = document.createElement("div");
    wrap.style.position = "relative";
    group.replaceChild(wrap, pass);
    wrap.appendChild(pass);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.setAttribute("aria-label", "Mostrar ou ocultar senha");
    toggle.className = "btn-eye";
    toggle.innerHTML = '<i class="ri-eye-line" aria-hidden="true"></i>';
    Object.assign(toggle.style, {
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "transparent",
      border: "0",
      cursor: "pointer",
      padding: "6px",
      color: "#b9c3e6"
    });
    wrap.appendChild(toggle);

    toggle.addEventListener("click", () => {
      const isPwd = pass.type === "password";
      pass.type = isPwd ? "text" : "password";
      toggle.innerHTML = isPwd ? '<i class="ri-eye-off-line" aria-hidden="true"></i>'
                               : '<i class="ri-eye-line" aria-hidden="true"></i>';
    });
  })();