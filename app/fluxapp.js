import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp,
  collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Config
const firebaseConfig = {
  apiKey: "AIzaSyAzy7pGHF6bpeMe3e-tHGwfjyE2hW4xcu0",
  authDomain: "flux-922f2.firebaseapp.com",
  projectId: "flux-922f2",
  storageBucket: "flux-922f2.firebasestorage.app",
  messagingSenderId: "717404554931",
  appId: "1:717404554931:web:5c31490a074ff2d07712c6",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// trocar abas
document.querySelectorAll(".pf-tabs button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".pf-tabs button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".pf-tab").forEach(tab=>tab.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
  });
});

onAuthStateChanged(auth, async (user)=>{
  if(!user) return location.href="../";

  function gradientFromUid(uid){
  let h=0; for (let i=0;i<uid.length;i++) h=(h*31 + uid.charCodeAt(i))>>>0;
  const a = h % 360, b = (h*7)%360;
  return `linear-gradient(135deg, hsl(${a} 80% 55%), hsl(${b} 72% 55%))`;
}

  document.getElementById("logoutBtn").onclick=()=>signOut(auth);

  // pega uid do perfil (da URL ou o próprio)
  const urlParams = new URLSearchParams(window.location.search);
  const profileUid = urlParams.get("uid") || user.uid;

  const snap = await getDoc(doc(db,"users",profileUid));
  if(!snap.exists()){ alert("Usuário não encontrado!"); return; }
  const u = snap.data();

  // preencher UI
  document.getElementById("profileName").innerHTML = u.displayName + (u.isVerified?` <i id="verifyBadge" class="ri-checkbox-circle-fill"></i>`:"");
  document.getElementById("profileHandle").textContent = "@"+u.handle;
  document.getElementById("profileBio").textContent = u.bio||"Not bio yet.";
  document.getElementById("profileAvatar").textContent = (u.displayName||"?").split(" ").map(p=>p[0]).join("").slice(0,2);
  document.getElementById("profileAvatar").style.background = profileUid ? gradientFromUid(profileUid) : "linear-gradient(135deg,var(--flux-blue),var(--flux-violet))";

  // mostrar botoes
  if(profileUid===user.uid){
    document.getElementById("editBtn").hidden=false;
  } else {
    const followBtn = document.getElementById("followBtn");
    followBtn.hidden=false;

    const followRef = doc(db,"follows",user.uid,"following",profileUid);
    const isFollowing = (await getDoc(followRef)).exists();

    followBtn.textContent = isFollowing?"Seguindo":"Seguir";
    followBtn.setAttribute("aria-pressed",isFollowing);

    followBtn.onclick=async()=>{
      if(followBtn.getAttribute("aria-pressed")==="true"){
        await deleteDoc(followRef);
        followBtn.textContent="Seguir";
        followBtn.setAttribute("aria-pressed","false");
      } else {
        await setDoc(followRef,{createdAt:serverTimestamp()});
        followBtn.textContent="Seguindo";
        followBtn.setAttribute("aria-pressed","true");
      }
    };
  }

  // posts
  const postsQ = query(collection(db,"posts"), where("uid","==",profileUid));
  onSnapshot(postsQ,(snap)=>{
    const list = document.getElementById("postsList");
    list.innerHTML="";
    snap.forEach(docSnap=>{
      const p = docSnap.data();
      const li=document.createElement("li");
      li.textContent=p.content;
      list.appendChild(li);
    });
    document.getElementById("postsCount").textContent=snap.size;
  });
});
