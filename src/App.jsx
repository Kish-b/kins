import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  Timestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ════════════════════════════════════════════════
   FIREBASE CONFIG — uses Vite env vars
════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const db   = getFirestore(firebaseApp);

/* ════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════ */
const STREAK_MAP = { today: 0, "1d": 1, "3d": 3, "1w": 7, "1m": 30 };
const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];
const QUOTES = [
  '"Every urge you resist rewires your brain toward freedom. You are changing at the cellular level."',
  '"The urge will pass. It always does. Hold on for just 10 more minutes."',
  '"You are not your addiction. You are the person who wakes up every morning and chooses to fight it."',
  '"Recovery is not a straight line. Every day you try is a day that counts."',
  '"Your brain is plastic. Every choice you make today is reshaping who you are tomorrow."',
];
const ALL_TASKS = [
  { id:"breathing",   name:"Box Breathing",              dur:300, icon:"🫁", desc:"Inhale 4s · hold 4s · exhale 4s · repeat",      bg:"rgba(36,134,219,.1)",  levels:["low","mid","high"] },
  { id:"grounding",   name:"5-4-3-2-1 Grounding",        dur:180, icon:"🧘", desc:"Name 5 things you see, 4 you touch...",          bg:"rgba(78,205,196,.1)",  levels:["low","mid"] },
  { id:"music",       name:"Listen to Calming Music",     dur:600, icon:"🎵", desc:"Focus only on the sound — nothing else",          bg:"rgba(247,200,115,.15)",levels:["low","mid"] },
  { id:"prayer",      name:"Prayer / Reflection",         dur:300, icon:"🙏", desc:"Quiet prayer or a reflective moment",             bg:"rgba(247,200,115,.12)",levels:["low","mid"] },
  { id:"tea",         name:"Make & Drink Herbal Tea",     dur:600, icon:"🍵", desc:"A slow, warm ritual that resets the mind",        bg:"rgba(168,213,186,.15)",levels:["low","mid"] },
  { id:"exercise",    name:"Physical Exercise",           dur:900, icon:"🏃", desc:"Pushups, burpees, jumping jacks — go hard",       bg:"rgba(168,213,186,.15)",levels:["mid","high"] },
  { id:"walk",        name:"Go for a Walk Outside",       dur:900, icon:"🚶", desc:"Change your environment and breathe fresh air",    bg:"rgba(168,213,186,.12)",levels:["low","mid","high"] },
  { id:"shower",      name:"Cold Shower",                 dur:300, icon:"🚿", desc:"Cold water resets your nervous system fast",      bg:"rgba(36,134,219,.1)",  levels:["mid","high"] },
  { id:"stretching",  name:"Full-body Stretching",        dur:600, icon:"🤸", desc:"Stretch every muscle group, slow and deep",       bg:"rgba(36,134,219,.08)", levels:["low","mid"] },
  { id:"cleaning",    name:"Clean or Organise a Space",   dur:900, icon:"🧹", desc:"Physical action with a clear, immediate result",  bg:"rgba(247,200,115,.15)",levels:["mid","high"] },
  { id:"journal",     name:"Journaling",                  dur:600, icon:"📝", desc:"Write what you're feeling without filtering",     bg:"rgba(247,200,115,.15)",levels:["low","mid","high"] },
  { id:"gratitude",   name:"Gratitude List",              dur:300, icon:"💛", desc:"Write 5 things you're genuinely grateful for",    bg:"rgba(247,200,115,.12)",levels:["low","mid"] },
  { id:"call",        name:"Call Someone You Trust",      dur:600, icon:"📞", desc:"Connection breaks isolation. Reach out now.",     bg:"rgba(168,213,186,.15)",levels:["mid","high"] },
  { id:"affirmations",name:"Read Your Affirmations",      dur:180, icon:"✨", desc:"Remind yourself who you are and why you fight",   bg:"rgba(36,134,219,.1)",  levels:["low","mid"] },
  { id:"breathwork2", name:"Wim Hof Breathwork",          dur:480, icon:"💨", desc:"Powerful breathing technique for mental reset",    bg:"rgba(36,134,219,.1)",  levels:["mid","high"] },
  { id:"research",    name:"Read about Recovery",         dur:600, icon:"📖", desc:"Science of addiction, dopamine and healing",      bg:"rgba(229,115,115,.08)",levels:["low","mid"] },
  { id:"puzzle",      name:"Solve a Puzzle or Sudoku",    dur:600, icon:"🧩", desc:"Engage your prefrontal cortex on something hard", bg:"rgba(36,134,219,.07)", levels:["low","mid"] },
  { id:"cook",        name:"Cook or Prepare Food",        dur:900, icon:"🍳", desc:"Hands-on task that demands full attention",       bg:"rgba(247,200,115,.15)",levels:["mid","high"] },
  { id:"draw",        name:"Sketch or Doodle",            dur:600, icon:"✏️", desc:"No skill needed — just put pen to paper",         bg:"rgba(229,115,115,.06)",levels:["low","mid"] },
  { id:"memorise",    name:"Memorise Something",          dur:600, icon:"🧠", desc:"A quote, poem, or passage — focus the mind",      bg:"rgba(36,134,219,.07)", levels:["low","mid"] },
];
const BREATHE = ["Breathe in slowly...", "Hold...", "Breathe out slowly...", "Hold..."];
const ENCOUR  = [
  "You are stronger than this urge. Keep going.",
  "Every second you hold on, the urge weakens.",
  "This discomfort is temporary. Your freedom is permanent.",
  "You're choosing differently right now. That's everything.",
  "The craving peaks and then fades. You're already past the worst.",
];
const IL = ["","Very mild","Mild","Mild","Moderate","Moderate","Strong","Strong","Very strong","Extreme","Overwhelming"];
const IC = ["","var(--green-d)","var(--green-d)","var(--green-d)","var(--blue)","var(--blue)","#B07D00","#B07D00","var(--rose)","var(--rose)","var(--rose)"];
const IB = ["","var(--green-bg)","var(--green-bg)","var(--green-bg)","var(--blue-bg)","var(--blue-bg)","var(--amber-bg)","var(--amber-bg)","var(--rose-bg)","var(--rose-bg)","var(--rose-bg)"];
const DN = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function iLevel(v) { return v <= 3 ? "low" : v <= 7 ? "mid" : "high"; }
function fmt(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function nextMilestone(d) { return MILESTONES.find(m => m > d) || MILESTONES[MILESTONES.length - 1]; }
function fbErr(code) {
  const map = {
    "auth/email-already-in-use": "This email is already registered. Try logging in.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password. Please try again.",
    "auth/too-many-requests":    "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

/* ════════════════════════════════════════════════
   CSS — injected as a style tag
════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Commissioner:wght@300;400;500;600;700;800;900&display=swap');
:root{--f:'Commissioner',sans-serif;--blue:#2486DB;--blue-d:#1E6DB8;--blue-bg:rgba(36,134,219,.10);--blue-bd:rgba(36,134,219,.28);--blue-glow:rgba(36,134,219,.20);--navy:#262E36;--navy-light:#3D4E5E;--green:#A8D5BA;--green-d:#7ABFA0;--green-bg:rgba(168,213,186,.15);--green-bd:rgba(168,213,186,.4);--amber:#F7C873;--amber-bg:rgba(247,200,115,.18);--amber-bd:rgba(247,200,115,.4);--rose:#E57373;--rose-bg:rgba(229,115,115,.12);--rose-bd:rgba(229,115,115,.28);--teal:#4ECDC4;--teal-bg:rgba(78,205,196,.12);--gray-mid:#959CA3;--r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-2xl:24px;--r-full:9999px;--sp1:4px;--sp2:8px;--sp3:16px;--sp4:24px;--sp5:32px;--sp6:48px;--sp7:64px;--tf:150ms ease;--tn:250ms ease;--tc:350ms cubic-bezier(.22,1,.36,1)}
[data-theme="light"]{--bg:#F5F7FA;--bg2:#FFFFFF;--bg3:#EEF2F7;--bg4:#E0E7F0;--card:#FFFFFF;--brd:rgba(36,134,219,.12);--brd2:rgba(36,134,219,.22);--t1:#262E36;--t2:#5A6A7A;--t3:#959CA3;--sh:0 1px 4px rgba(36,134,219,.08),0 2px 8px rgba(0,0,0,.05);--sh-md:0 4px 16px rgba(36,134,219,.12),0 2px 6px rgba(0,0,0,.05);--sh-lg:0 8px 32px rgba(36,134,219,.16),0 4px 12px rgba(0,0,0,.06)}
[data-theme="dark"]{--bg:#181E27;--bg2:#232D3A;--bg3:#2D3A4A;--bg4:#3A4A5C;--card:#232D3A;--brd:rgba(36,134,219,.13);--brd2:rgba(36,134,219,.24);--t1:#EDF2F7;--t2:#9AACBC;--t3:#64788C;--sh:0 2px 8px rgba(0,0,0,.35);--sh-md:0 4px 20px rgba(0,0,0,.45);--sh-lg:0 8px 32px rgba(0,0,0,.55)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
body{font-family:var(--f);background:var(--bg);color:var(--t1);min-height:100vh;line-height:1.6;transition:background var(--tn),color var(--tn)}
button,input,textarea,select{font-family:var(--f)}
button{cursor:pointer;border:none;background:none;color:inherit}
a{text-decoration:none;color:inherit}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--brd2);border-radius:2px}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes puls{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.65)}}
@keyframes loadbar{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}
.screen-anim{animation:fadeUp var(--tc) both}
.app{display:flex;flex-direction:column;min-height:100vh}
.page{flex:1;width:100%;max-width:960px;margin:0 auto;padding:var(--sp5) var(--sp4) var(--sp7)}
.page.narrow{max-width:640px}
.nav{height:64px;display:flex;align-items:center;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 var(--sp4);position:sticky;top:0;z-index:100;box-shadow:var(--sh)}
.nav-logo{display:flex;align-items:center;gap:10px;cursor:pointer;flex-shrink:0;transition:opacity var(--tf)}
.nav-logo:hover{opacity:.8}
.nav-logo-mark{width:36px;height:36px;border-radius:var(--r-md);background:linear-gradient(135deg,var(--blue),var(--teal));display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 2px 10px var(--blue-glow);flex-shrink:0}
.nav-logo-text{font-size:20px;font-weight:800;color:var(--blue);letter-spacing:-.01em}
[data-theme="dark"] .nav-logo-text{color:#5AADE8}
.nav-gap{flex:1}
.nav-right{display:flex;align-items:center;gap:var(--sp2)}
.streak-pill{display:inline-flex;align-items:center;gap:6px;background:var(--green-bg);border:1px solid var(--green-bd);border-radius:var(--r-full);padding:6px 14px;font-size:13px;font-weight:700;color:var(--green-d)}
[data-theme="dark"] .streak-pill{color:#A8D5BA}
.nav-btn{width:40px;height:40px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:1rem;color:var(--t2);border:1.5px solid transparent;transition:all var(--tf);position:relative}
.nav-btn:hover{background:var(--bg3);color:var(--t1);border-color:var(--brd)}
.nav-btn.on{background:var(--blue-bg);border-color:var(--blue-bd);color:var(--blue)}
[data-theme="dark"] .nav-btn.on{color:#5AADE8}
.nav-tip{position:absolute;bottom:-34px;left:50%;transform:translateX(-50%);background:var(--navy);color:#fff;font-size:11px;font-weight:500;padding:3px 8px;border-radius:6px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity var(--tf);z-index:10}
[data-theme="dark"] .nav-tip{background:var(--bg4);color:var(--t1)}
.nav-btn:hover .nav-tip{opacity:1}
.card{background:var(--card);border:1px solid var(--brd);border-radius:var(--r-lg);box-shadow:var(--sh);overflow:hidden}
.card-p{padding:var(--sp4)}
.card-hd{padding:var(--sp3) var(--sp4);border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between}
.card-ttl{font-size:16px;font-weight:700;color:var(--t1)}
.card-sub{font-size:13px;color:var(--t2);margin-top:2px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;border-radius:var(--r-md);border:none;cursor:pointer;transition:all var(--tf);white-space:nowrap}
.btn-lg{height:48px;padding:0 28px;font-size:16px;border-radius:var(--r-lg)}
.btn-md{height:40px;padding:0 20px;font-size:15px}
.btn-sm{height:32px;padding:0 14px;font-size:13px;border-radius:var(--r-sm)}
.btn-fw{width:100%}
.btn-primary{background:var(--blue);color:#fff;box-shadow:0 2px 10px var(--blue-glow)}
.btn-primary:hover{background:var(--blue-d);transform:translateY(-1px);box-shadow:0 4px 18px var(--blue-glow)}
.btn-primary:active{transform:none}
.btn-green{background:var(--green-d);color:#fff;box-shadow:0 2px 10px rgba(122,191,160,.3)}
.btn-green:hover{filter:brightness(1.05);transform:translateY(-1px)}
.btn-green:active{transform:none}
.btn-danger{background:var(--rose);color:#fff;box-shadow:0 4px 18px rgba(229,115,115,.32)}
.btn-danger:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(229,115,115,.44)}
.btn-danger:active{transform:none}
.btn-soft{background:var(--bg3);color:var(--t2);border:1.5px solid var(--brd)}
.btn-soft:hover{background:var(--bg4);color:var(--t1);border-color:var(--brd2)}
.btn-ghost{background:transparent;color:var(--blue);border:1.5px solid var(--blue-bd)}
.btn-ghost:hover{background:var(--blue-bg)}
[data-theme="dark"] .btn-ghost{color:#5AADE8;border-color:rgba(90,173,232,.3)}
.btn:disabled{opacity:.6;cursor:not-allowed;transform:none!important}
.urge-cta{background:linear-gradient(135deg,var(--rose-bg) 0%,rgba(247,200,115,.06) 100%);border:1.5px solid var(--rose-bd);border-radius:var(--r-xl);padding:var(--sp4);position:relative;overflow:hidden}
.urge-cta::after{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(229,115,115,.07),transparent 65%);pointer-events:none}
.urge-label{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--rose);margin-bottom:var(--sp2)}
.urge-pulse{width:7px;height:7px;border-radius:50%;background:var(--rose);animation:puls 1.6s ease-in-out infinite}
.urge-cta h3{font-size:20px;font-weight:700;color:var(--t1);margin-bottom:var(--sp2);line-height:1.3}
.urge-cta p{font-size:15px;color:var(--t2);margin-bottom:var(--sp4);line-height:1.65;max-width:none}
.urge-main-btn{display:flex;align-items:center;justify-content:space-between;width:100%;height:52px;padding:0 22px;background:var(--rose);color:#fff;border:none;cursor:pointer;border-radius:var(--r-lg);font-size:16px;font-weight:700;box-shadow:0 4px 18px rgba(229,115,115,.33);transition:all var(--tn)}
.urge-main-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(229,115,115,.45)}
.urge-arrow{width:32px;height:32px;background:rgba(255,255,255,.2);border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center}
.streak-grid{display:grid;grid-template-columns:2fr 1fr;gap:var(--sp3)}
.streak-card{background:var(--card);border:1px solid var(--brd);border-radius:var(--r-xl);box-shadow:var(--sh-md);overflow:hidden;position:relative;min-height:200px}
.streak-bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.streak-bg::before{content:'';position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(36,134,219,.08) 0%,transparent 60%);top:-100px;left:-80px}
.streak-bg::after{content:'';position:absolute;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(168,213,186,.12) 0%,transparent 60%);bottom:-70px;right:60px}
.streak-wm{position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:88px;opacity:.05;user-select:none;z-index:1;line-height:1}
.streak-inner{position:relative;z-index:2;padding:var(--sp4)}
.streak-eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--green-d);margin-bottom:10px}
[data-theme="dark"] .streak-eyebrow{color:var(--green)}
.streak-dot{width:7px;height:7px;border-radius:50%;background:var(--green-d);animation:puls 2s ease-in-out infinite}
[data-theme="dark"] .streak-dot{background:var(--green)}
.streak-row{display:flex;align-items:baseline;gap:10px;line-height:1;margin-bottom:8px}
.streak-num{font-size:80px;font-weight:900;letter-spacing:-.04em;line-height:.88;color:var(--blue)}
[data-theme="dark"] .streak-num{color:#5AADE8}
.streak-unit{font-size:18px;font-weight:600;color:var(--t2);line-height:1.3}
.streak-best{font-size:14px;color:var(--t2);margin-bottom:var(--sp3)}
.streak-best strong{color:var(--amber);font-weight:700}
.streak-chip{display:inline-flex;align-items:center;gap:5px;background:var(--green-bg);border:1px solid var(--green-bd);color:var(--green-d);font-size:13px;font-weight:700;padding:4px 12px;border-radius:var(--r-full);margin-bottom:var(--sp3)}
[data-theme="dark"] .streak-chip{color:var(--green)}
.streak-prog-track{height:6px;background:var(--bg3);border-radius:3px;overflow:hidden}
.streak-prog-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--blue),var(--teal));transition:width 1s var(--tc)}
.streak-prog-lbls{display:flex;justify-content:space-between;font-size:12px;color:var(--t3);margin-top:5px}
.mini-col{display:flex;flex-direction:column;gap:var(--sp3)}
.mini-card{flex:1;background:var(--card);border:1px solid var(--brd);border-radius:var(--r-xl);box-shadow:var(--sh);padding:var(--sp4)}
.mini-val{font-size:36px;font-weight:800;letter-spacing:-.03em;line-height:1}
.mini-lbl{font-size:13px;color:var(--t2);margin-top:5px}
.sec{margin-bottom:var(--sp5)}
.sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp3)}
.sec-ttl{font-size:16px;font-weight:700;color:var(--t1)}
.sec-lnk{font-size:13px;color:var(--blue);font-weight:600;cursor:pointer}
.sec-lnk:hover{text-decoration:underline}
[data-theme="dark"] .sec-lnk{color:#5AADE8}
.divider{height:1px;background:var(--brd);margin:0}
.vstack{display:flex;flex-direction:column;gap:var(--sp3)}
.insight{display:flex;gap:var(--sp3);background:var(--blue-bg);border:1px solid var(--blue-bd);border-radius:var(--r-lg);padding:var(--sp3)}
.insight-ico{width:36px;height:36px;flex-shrink:0;border-radius:var(--r-md);background:linear-gradient(135deg,var(--blue),var(--teal));display:flex;align-items:center;justify-content:center;font-size:.9rem;box-shadow:0 2px 8px var(--blue-glow)}
.insight-lbl{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--blue);margin-bottom:4px}
[data-theme="dark"] .insight-lbl{color:#5AADE8}
.insight-txt{font-size:14px;color:var(--t2);line-height:1.65}
.chip-row{display:flex;flex-wrap:wrap;gap:var(--sp2)}
.chip{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r-full);border:1.5px solid var(--brd2);background:var(--bg3);font-size:14px;font-weight:500;color:var(--t2);cursor:pointer;transition:all var(--tf)}
.chip:hover{border-color:var(--blue-bd);color:var(--blue);background:var(--blue-bg)}
.chip.on{background:var(--blue-bg);border-color:var(--blue);color:var(--blue);font-weight:600}
[data-theme="dark"] .chip.on{color:#5AADE8;border-color:rgba(90,173,232,.35)}
.chip.on-green{background:var(--green-bg);border-color:var(--green-bd);color:var(--green-d)}
[data-theme="dark"] .chip.on-green{color:var(--green)}
.fgroup{margin-bottom:var(--sp3)}
.flabel{display:block;font-size:14px;font-weight:600;color:var(--t1);margin-bottom:6px}
.finput{width:100%;background:var(--bg2);border:1.5px solid var(--brd2);border-radius:var(--r-md);padding:12px 16px;font-size:15px;color:var(--t1);outline:none;transition:border-color var(--tf),box-shadow var(--tf);line-height:1.5;font-family:var(--f)}
.finput:focus{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-bg)}
.finput::placeholder{color:var(--t3)}
textarea.finput{resize:vertical;min-height:88px;line-height:1.6}
.int-row{display:flex;gap:6px}
.int-btn{flex:1;height:44px;border-radius:var(--r-md);border:1.5px solid var(--brd2);background:var(--bg3);font-size:14px;font-weight:700;color:var(--t2);transition:all var(--tf)}
.int-btn:hover{border-color:var(--blue-bd);color:var(--blue)}
.int-btn.on{background:var(--blue-bg);border-color:var(--blue);color:var(--blue)}
.int-btn.hi{border-color:var(--rose-bd)}
.int-btn.hi.on{background:var(--rose-bg);border-color:var(--rose);color:var(--rose)}
.int-badge{display:inline-flex;align-items:center;padding:4px 12px;border-radius:var(--r-full);font-size:13px;font-weight:600}
.tog{position:relative;width:44px;height:24px;flex-shrink:0}
.tog input{position:absolute;opacity:0;width:100%;height:100%;cursor:pointer;margin:0}
.tog-track{position:absolute;inset:0;border-radius:12px;background:var(--bg4);transition:background var(--tf)}
.tog-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.2);transition:transform var(--tf)}
.tog input:checked~.tog-track{background:var(--green-d)}
.tog input:checked~.tog-thumb{transform:translateX(20px)}
.task-list{display:flex;flex-direction:column;gap:var(--sp2)}
.task-row{display:flex;align-items:center;gap:var(--sp3);padding:16px;border-radius:var(--r-lg);border:1.5px solid var(--brd);background:var(--card);cursor:pointer;transition:all var(--tf);box-shadow:var(--sh);width:100%;text-align:left}
.task-row:hover{border-color:var(--blue-bd);background:var(--blue-bg);transform:translateY(-1px);box-shadow:var(--sh-md)}
.task-row.on{border-color:var(--blue);background:var(--blue-bg);box-shadow:var(--sh-md)}
.task-ico{width:48px;height:48px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0}
.task-name{font-size:15px;font-weight:600;color:var(--t1);margin-bottom:2px}
.task-meta{font-size:13px;color:var(--t2);line-height:1.4}
.task-info{flex:1;text-align:left}
.task-bdg{font-size:12px;font-weight:700;padding:3px 10px;border-radius:var(--r-full);background:var(--amber-bg);color:#6B4E0A;border:1px solid var(--amber-bd);flex-shrink:0}
.ob-wrap{max-width:560px;margin:0 auto;padding:var(--sp5) 0}
.ob-prog{display:flex;gap:6px;margin-bottom:var(--sp5)}
.ob-seg{flex:1;height:4px;border-radius:2px;background:var(--bg4);transition:background var(--tn)}
.ob-seg.done{background:var(--green-d)}
.ob-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--green-d);margin-bottom:10px}
[data-theme="dark"] .ob-eyebrow{color:var(--green)}
.ob-eyebrow-dot{width:6px;height:6px;border-radius:50%;background:var(--green-d)}
[data-theme="dark"] .ob-eyebrow-dot{background:var(--green)}
.ob-title{font-size:28px;font-weight:800;color:var(--t1);margin-bottom:var(--sp2);line-height:1.15;letter-spacing:-.01em}
.ob-sub{font-size:15px;color:var(--t2);margin-bottom:var(--sp4);line-height:1.7;max-width:46ch}
.ob-nav{display:flex;gap:var(--sp2);margin-top:var(--sp4)}
.cal-strip{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
.cal-day{flex-shrink:0;width:44px;border-radius:var(--r-md);border:1.5px solid var(--brd);background:var(--bg3);padding:8px 4px;text-align:center;transition:all var(--tf)}
.cal-day.ok{background:var(--green-bg);border-color:var(--green-bd)}
.cal-day.bad{background:var(--rose-bg);border-color:var(--rose-bd)}
.cal-day.now{background:var(--blue-bg);border-color:var(--blue-bd)}
.cal-dn{font-size:11px;font-weight:600;color:var(--t3);margin-bottom:3px}
.cal-dd{font-size:15px;font-weight:700;color:var(--t1)}
.cal-dot{width:6px;height:6px;border-radius:50%;background:var(--brd2);margin:4px auto 0}
.cal-day.ok .cal-dot{background:var(--green-d)}
.cal-day.bad .cal-dot{background:var(--rose)}
.cal-day.now .cal-dot{background:var(--blue)}
.bar-chart{display:flex;align-items:flex-end;gap:10px;height:120px;padding-top:16px}
.bar-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:6px}
.bar-val{font-size:12px;font-weight:700;color:var(--t2)}
.bar-fill{width:100%;min-height:4px;border-radius:4px 4px 0 0;transition:height .6s var(--tc)}
.bar-lbl{font-size:11px;color:var(--t3);font-weight:500}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--sp3)}
.stat-card{background:var(--card);border:1px solid var(--brd);border-radius:var(--r-xl);padding:var(--sp4);box-shadow:var(--sh)}
.stat-num{font-size:40px;font-weight:900;letter-spacing:-.04em;line-height:1}
.stat-lbl{font-size:13px;color:var(--t2);margin-top:4px;margin-bottom:6px}
.stat-delta{font-size:12px;font-weight:600}
.stat-delta.up{color:var(--green-d)} .stat-delta.dn{color:var(--rose)} .stat-delta.col-muted{color:var(--t3)}
.trig-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.trig-name{font-size:13px;font-weight:600;color:var(--t1);width:64px;flex-shrink:0}
.trig-track{flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden}
.trig-fill{height:100%;border-radius:4px;transition:width .8s var(--tc)}
.trig-pct{font-size:12px;font-weight:700;color:var(--t2);width:32px;text-align:right;flex-shrink:0}
.eff-row{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.eff-ico{width:30px;height:30px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0;background:var(--bg3)}
.eff-info{flex:1}
.eff-name{font-size:13px;font-weight:600;color:var(--t1);margin-bottom:4px}
.eff-track{height:6px;background:var(--bg3);border-radius:3px;overflow:hidden}
.eff-fill{height:100%;border-radius:3px;background:var(--blue);transition:width .8s var(--tc)}
.eff-pct{font-size:13px;font-weight:700;color:var(--t2);width:34px;text-align:right;flex-shrink:0}
.timer-wrap{display:flex;flex-direction:column;align-items:center;padding:var(--sp6) 0 var(--sp4)}
.timer-ring-pos{position:relative;margin-bottom:var(--sp4)}
.timer-ring-txt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.timer-ico{font-size:2rem;margin-bottom:4px}
.timer-dig{font-size:48px;font-weight:900;color:var(--t1);letter-spacing:-.04em;line-height:1}
.timer-phase{font-size:13px;color:var(--t2);margin-top:4px;font-weight:500}
.timer-name{font-size:22px;font-weight:700;color:var(--t1);text-align:center;margin-bottom:6px}
.timer-sub{font-size:14px;color:var(--t2);text-align:center;margin-bottom:var(--sp4)}
.fb-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp3);margin:var(--sp4) 0}
.fb-card{background:var(--card);border:1.5px solid var(--brd);border-radius:var(--r-xl);padding:var(--sp4);text-align:center;cursor:pointer;transition:all var(--tn);box-shadow:var(--sh)}
.fb-card:hover{transform:translateY(-3px);box-shadow:var(--sh-lg)}
.fb-card.ok:hover{border-color:var(--green-bd);background:var(--green-bg)}
.fb-card.bad:hover{border-color:var(--rose-bd);background:var(--rose-bg)}
.fb-ico{font-size:2.5rem;margin-bottom:10px}
.fb-title{font-size:16px;font-weight:700;color:var(--t1);margin-bottom:4px}
.fb-sub{font-size:13px;color:var(--t2)}
.profile-layout{display:grid;grid-template-columns:260px 1fr;gap:var(--sp4)}
.profile-av-card{background:var(--card);border:1px solid var(--brd);border-radius:var(--r-xl);padding:var(--sp4);text-align:center;box-shadow:var(--sh);margin-bottom:var(--sp3)}
.av-ring{width:72px;height:72px;border-radius:50%;margin:0 auto var(--sp3);background:linear-gradient(135deg,var(--blue),var(--teal));display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 4px 16px var(--blue-glow)}
.prof-name{font-size:20px;font-weight:700;color:var(--t1);margin-bottom:2px}
.prof-since{font-size:13px;color:var(--t2)}
.prof-stats{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp2);margin-top:var(--sp3)}
.ps-item{background:var(--bg3);border-radius:var(--r-md);padding:12px;text-align:center}
.ps-val{font-size:24px;font-weight:800;color:var(--blue)}
[data-theme="dark"] .ps-val{color:#5AADE8}
.ps-key{font-size:12px;color:var(--t2);margin-top:2px}
.settings-card{background:var(--card);border:1px solid var(--brd);border-radius:var(--r-xl);box-shadow:var(--sh);overflow:hidden}
.settings-grp-lbl{padding:10px var(--sp4);font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);background:var(--bg3);border-bottom:1px solid var(--brd)}
.setting-row{display:flex;align-items:center;gap:var(--sp3);padding:16px var(--sp4);border-bottom:1px solid var(--brd)}
.setting-row:last-child{border-bottom:none}
.setting-ico{width:36px;height:36px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.setting-info{flex:1}
.setting-name{font-size:15px;font-weight:500;color:var(--t1)}
.setting-desc{font-size:13px;color:var(--t2);margin-top:1px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--r-full);font-size:12px;font-weight:700}
.badge-green{background:var(--green-bg);color:var(--green-d);border:1px solid var(--green-bd)}
[data-theme="dark"] .badge-green{color:var(--green)}
.modal-bg{position:fixed;inset:0;background:rgba(38,46,54,.55);z-index:200;display:none;align-items:center;justify-content:center;padding:var(--sp3);backdrop-filter:blur(4px)}
.modal-bg.open{display:flex}
.modal-box{background:var(--card);border:1px solid var(--brd2);border-radius:var(--r-2xl);padding:var(--sp4);width:100%;max-width:420px;box-shadow:var(--sh-lg);animation:fadeUp var(--tn) both}
.modal-ttl{font-size:20px;font-weight:700;color:var(--t1);margin-bottom:6px}
.modal-body{font-size:15px;color:var(--t2);line-height:1.65;margin-bottom:var(--sp4)}
.modal-actions{display:flex;gap:var(--sp2)}
#toast-el{position:fixed;top:80px;left:50%;transform:translateX(-50%) translateY(-6px);background:var(--navy);color:#fff;border-radius:var(--r-full);padding:10px 20px;font-size:14px;font-weight:500;box-shadow:var(--sh-lg);z-index:500;opacity:0;pointer-events:none;white-space:nowrap;transition:all var(--tn)}
[data-theme="dark"] #toast-el{background:var(--bg4);color:var(--t1)}
#toast-el.show{opacity:1;transform:translateX(-50%) translateY(0)}
.task-sec-lbl{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;gap:6px;margin-bottom:10px}
.task-sec-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.flex{display:flex}.ic{align-items:center}.jb{justify-content:space-between}
.g2{gap:8px}.g3{gap:12px}.g4{gap:16px}
.w100{width:100%}
.mt2{margin-top:8px}.mt3{margin-top:12px}.mt4{margin-top:16px}.mt5{margin-top:20px}.mt6{margin-top:24px}
.mb3{margin-bottom:12px}.mb4{margin-bottom:16px}.mb5{margin-bottom:20px}.mb6{margin-bottom:24px}
.col-blue{color:var(--blue)} [data-theme="dark"] .col-blue{color:#5AADE8}
.col-green{color:var(--green-d)} [data-theme="dark"] .col-green{color:var(--green)}
.col-muted{color:var(--t2)}
.text-center{text-align:center}
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp3)}
@media(max-width:720px){.streak-grid{grid-template-columns:1fr;gap:var(--sp3)}.mini-col{flex-direction:row}.profile-layout{grid-template-columns:1fr}.stats-grid{grid-template-columns:1fr 1fr}.dash-grid{grid-template-columns:1fr}.page{padding:var(--sp4) var(--sp3) var(--sp7)}.streak-num{font-size:64px}}
@media(max-width:480px){.int-row{flex-wrap:wrap}.int-btn{min-width:40px}.fb-grid{grid-template-columns:1fr}.ob-title{font-size:24px}.stats-grid{grid-template-columns:1fr}}
`;

/* ════════════════════════════════════════════════
   GOOGLE ICON SVG
════════════════════════════════════════════════ */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.4 2.9 13.2l7.8 6.1C12.5 13 17.8 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.1-4.5 6.7l7 5.4c4.1-3.8 6.4-9.4 6.4-16.1z"/>
    <path fill="#FBBC05" d="M10.7 28.7c-.6-1.6-.9-3.3-.9-5.2s.3-3.6.9-5.2l-7.8-6.1C1.1 15.4 0 19.6 0 24s1.1 8.6 2.9 11.8l7.8-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7-5.4c-2 1.3-4.5 2.1-8 2.1-6.2 0-11.5-4.2-13.4-9.8l-7.8 6.1C6.7 42.6 14.7 48 24 48z"/>
  </svg>
);

/* ════════════════════════════════════════════════
   GEMINI HELPERS
════════════════════════════════════════════════ */
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

/* ════════════════════════════════════════════════
   CALENDAR HELPER
════════════════════════════════════════════════ */
async function buildCalendarData(uid, days) {
  const today = new Date();
  const dayMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    dayMap[d.toDateString()] = "empty";
  }
  dayMap[today.toDateString()] = "now";

  if (uid) {
    try {
      const since = new Date(today); since.setDate(today.getDate() - days + 1); since.setHours(0,0,0,0);
      const snap = await getDocs(
        query(collection(db, "users", uid, "urgelogs"),
          where("timestamp", ">=", Timestamp.fromDate(since)),
          orderBy("timestamp", "desc"))
      );
      snap.forEach(d => {
        const date = d.data().timestamp.toDate();
        const key = date.toDateString();
        if (key in dayMap) {
          if (d.data().outcome === "relapsed") dayMap[key] = "bad";
          else if (dayMap[key] === "empty") dayMap[key] = "ok";
        }
      });
    } catch {}
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    result.push({ dn: DN[d.getDay()], dd: d.getDate(), cls: dayMap[d.toDateString()] || "empty" });
  }
  return result;
}

/* ════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════ */
export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("clarity-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  const [screen, setScreen] = useState("loading");
  const [prevScreen, setPrevScreen] = useState("dashboard");
  const [toast, setToast] = useState({ msg: "", show: false });
  const [modal, setModal] = useState(null); // "relapse" | "reset" | "addType"

  // User state
  const [uid, setUid] = useState(null);
  const [userName, setUserName] = useState("Champion");
  const [userEmail, setUserEmail] = useState("");
  const [addictions, setAddictions] = useState([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [urgesTotal, setUrgesTotal] = useState(0);
  const [resisted, setResisted] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const [lastRelapseDate, setLastRelapseDate] = useState(null);

  // Onboarding
  const [obStep, setObStep] = useState(1);
  const [obAddictions, setObAddictions] = useState([]);
  const [obPeriod, setObPeriod] = useState(null);
  const [obTiming, setObTiming] = useState([]);
  const [obTriggersOb, setObTriggersOb] = useState([]);
  const [obRelapse, setObRelapse] = useState(null);

  // Urge log
  const [urgeType, setUrgeType] = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState(null);
  const [otherText, setOtherText] = useState("");
  const [customTypes, setCustomTypes] = useState([]);
  const [currentUrgeLogId, setCurrentUrgeLogId] = useState(null);

  // Task
  const [selectedTask, setSelectedTask] = useState(ALL_TASKS[0]);
  const [aiRec, setAiRec] = useState("Based on your intensity and trigger, a breathing exercise will interrupt the urge cycle most effectively right now.");

  // Timer
  const [timerRem, setTimerRem] = useState(300);
  const [timerTotal, setTimerTotal] = useState(300);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerPhase, setTimerPhase] = useState("Breathe in slowly...");
  const [timerMsg, setTimerMsg] = useState("Every second you hold on, the urge loses power. You're choosing differently — that's real strength.");
  const timerRef = useRef(null);
  const timerElapsed = useRef(0);

  // Feedback
  const [fbNote, setFbNote] = useState("");

  // Dashboard
  const [dashQuote, setDashQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [dashCal, setDashCal] = useState([]);

  // Analytics
  const [aBars, setABars] = useState([]);
  const [aTrigs, setATrigs] = useState([]);
  const [aEff, setAEff] = useState([]);
  const [aCal, setACal] = useState([]);
  const [aiWeekly, setAiWeekly] = useState("Add your Gemini API key to unlock personalised AI insights.");
  const [aRelapseCount, setARelapseCount] = useState(0);

  // Custom type modal inputs
  const [customEmoji, setCustomEmoji] = useState("");
  const [customName, setCustomName] = useState("");

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clarity-theme", theme);
  }, [theme]);

  // Inject CSS
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setUid(user.uid);
        setUserEmail(user.email || "");
        await loadUserData(user);
      } else {
        setScreen("auth");
      }
    });
    return unsub;
  }, []);

  const showToast = useCallback((msg) => {
    setToast({ msg, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2800);
  }, []);

  const go = useCallback((id) => {
    setPrevScreen(s => s);
    setScreen(prev => { setPrevScreen(prev); return id; });
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => {
    setScreen(prev => { setScreen(prevScreen); return prevScreen; });
  }, [prevScreen]);

  async function saveUser(uid, fields) {
    if (!uid) return;
    try { await updateDoc(doc(db, "users", uid), fields); } catch {}
  }

  async function loadUserData(user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        setUserName(user.displayName || "Champion");
        setScreen("onboarding");
        return;
      }
      const d = snap.data();
      setUserName(d.name || user.displayName || "Champion");
      setAddictions(d.addictions || []);
      setBest(d.bestStreak || 0);
      setUrgesTotal(d.urgesTotal || 0);
      setResisted(d.resisted || 0);
      setTasksDone(d.tasksDone || 0);
      let computedStreak = d.streak || 0;
      if (d.lastRelapseDate) {
        const lrd = d.lastRelapseDate.toDate();
        computedStreak = Math.max(Math.floor((Date.now() - lrd.getTime()) / 86400000), 0);
        setLastRelapseDate(lrd);
      }
      setStreak(computedStreak);
      if (!d.onboardingComplete) setScreen("onboarding");
      else setScreen("dashboard");
    } catch {
      setScreen("onboarding");
    }
  }

  // ─── AUTH ───────────────────────────────────────
  async function doSignUp(name, email, pass, setBtnLoading, setErr) {
    if (!name) { setErr("Please enter your name."); return; }
    if (!email) { setErr("Please enter your email."); return; }
    if (!pass || pass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBtnLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, name, email,
        createdAt: serverTimestamp(), onboardingComplete: false,
        addictions: [], streak: 0, bestStreak: 0,
        urgesTotal: 0, resisted: 0, tasksDone: 0, theme: "light",
      });
      setUid(cred.user.uid); setUserName(name);
      showToast("Welcome to Clarity, " + name + "! 🌿");
      setScreen("onboarding");
    } catch (e) { setErr(fbErr(e.code)); setBtnLoading(false); }
  }

  async function doLogin(email, pass, setBtnLoading, setErr) {
    if (!email) { setErr("Please enter your email."); return; }
    if (!pass) { setErr("Please enter your password."); return; }
    setBtnLoading(true);
    try { await signInWithEmailAndPassword(auth, email, pass); }
    catch (e) { setErr(fbErr(e.code)); setBtnLoading(false); }
  }

  async function doGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid, name: cred.user.displayName, email: cred.user.email,
          createdAt: serverTimestamp(), onboardingComplete: false,
          addictions: [], streak: 0, bestStreak: 0, urgesTotal: 0, resisted: 0, tasksDone: 0, theme: "light",
        });
      }
    } catch (e) { showToast(fbErr(e.code)); }
  }

  async function doReset(email, setErr) {
    if (!email) { setErr("Enter your email above first, then click Forgot password."); return; }
    try { await sendPasswordResetEmail(auth, email); showToast("Password reset email sent — check your inbox."); }
    catch (e) { setErr(fbErr(e.code)); }
  }

  async function doLogout() {
    await signOut(auth); setUid(null); setScreen("auth"); showToast("You've been logged out.");
  }

  // ─── ONBOARDING ─────────────────────────────────
  async function finishOb() {
    const relapseDate = new Date();
    relapseDate.setDate(relapseDate.getDate() - (STREAK_MAP[obRelapse] || 0));
    const s = STREAK_MAP[obRelapse] || 0;
    setStreak(s); setLastRelapseDate(relapseDate);
    if (uid) {
      await saveUser(uid, {
        onboardingComplete: true, addictions: obAddictions,
        period: obPeriod, timing: obTiming, triggers: obTriggersOb, relapse: obRelapse,
        lastRelapseDate: Timestamp.fromDate(relapseDate),
        streak: s, bestStreak: Math.max(s, best),
      });
    }
    showToast("Welcome to Clarity, " + userName + "! 🌿");
    initDashboard(s, best, urgesTotal, resisted, uid);
    setScreen("dashboard");
  }

  // ─── DASHBOARD ──────────────────────────────────
  async function initDashboard(s = streak, b = best, ut = urgesTotal, r = resisted, u = uid) {
    const txt = await callGemini(
      `You are a compassionate recovery coach. Write ONE short, powerful, emotionally supportive insight (1-2 sentences max) for someone recovering from ${(addictions.join(", ") || "general addiction")} addiction who is on day ${s} of their streak. Be warm, specific, and science-based. No quotes marks needed. Respond with just the insight text.`
    );
    if (txt) setDashQuote('"' + txt + '"');
    const cal = await buildCalendarData(u, 7);
    setDashCal(cal);
  }

  useEffect(() => {
    if (screen === "dashboard") initDashboard();
  }, [screen === "dashboard"]);

  // ─── URGE LOG ───────────────────────────────────
  async function submitUrge() {
    if (!urgeType) { showToast("Please let us know what type of urge this is"); return; }
    if (!trigger) { showToast("Please select what triggered this feeling"); return; }
    if (trigger === "other" && !otherText.trim()) { showToast("Please describe what happened in a few words"); return; }

    if (uid) {
      try {
        const ref = await addDoc(collection(db, "users", uid, "urgelogs"), {
          timestamp: serverTimestamp(), urgeType, intensity, trigger,
          triggerText: trigger === "other" ? otherText : "",
          outcome: "pending", taskUsed: null,
        });
        setCurrentUrgeLogId(ref.id);
        await saveUser(uid, { urgesTotal: increment(1) });
        setUrgesTotal(t => t + 1);
      } catch {}
    }

    // AI rec
    const rec = await callGemini(
      `You are a recovery coach. Someone is experiencing a ${urgeType} urge at intensity ${intensity}/10, triggered by ${trigger}. Write ONE short, compassionate recommendation (2 sentences max) for which type of recovery task would help most right now (${iLevel(intensity)} intensity). Be specific and warm. Just the recommendation, no preamble.`
    );
    if (rec) setAiRec(rec);
    renderTasks();
    setScreen("task");
  }

  // ─── TASKS ──────────────────────────────────────
  function renderTasks() {
    const lv = iLevel(intensity);
    const rec = ALL_TASKS.filter(t => t.levels.includes(lv));
    if (rec.length) setSelectedTask({ ...rec[0] });
  }

  useEffect(() => { if (screen === "task") renderTasks(); }, [screen === "task", intensity]);

  // ─── TIMER ──────────────────────────────────────
  async function startTask() {
    setTimerRem(selectedTask.dur);
    setTimerTotal(selectedTask.dur);
    setTimerPaused(false);
    timerElapsed.current = 0;
    setTimerPhase(BREATHE[0]);

    if (uid && currentUrgeLogId) {
      try { await updateDoc(doc(db, "users", uid, "urgelogs", currentUrgeLogId), { taskUsed: selectedTask.id }); } catch {}
    }

    const enc = await callGemini(
      `You are a compassionate recovery coach. Someone is currently doing a "${selectedTask.name}" task to resist a ${urgeType} urge at intensity ${intensity}/10. Write ONE ultra-short encouraging message (1 sentence, max 15 words) to keep them going. Be warm and specific. Just the message.`
    );
    if (enc) setTimerMsg(enc);

    setScreen("timer");
    runTimer(selectedTask.dur);
  }

  function runTimer(total) {
    clearInterval(timerRef.current);
    let rem = total;
    timerRef.current = setInterval(() => {
      setTimerPaused(p => {
        if (p) return p;
        rem--;
        timerElapsed.current++;
        const e = timerElapsed.current;
        setTimerRem(rem);
        if (selectedTask.id === "breathing") setTimerPhase(BREATHE[Math.floor(e / 4) % 4]);
        else setTimerPhase(ENCOUR[Math.floor(e / 60) % ENCOUR.length]);
        if (rem <= 0) { clearInterval(timerRef.current); finishTimer(); }
        return p;
      });
    }, 1000);
  }

  async function finishTimer() {
    setTasksDone(t => t + 1);
    if (uid) { try { await saveUser(uid, { tasksDone: increment(1) }); } catch {} }
    setScreen("feedback");
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ─── FEEDBACK ───────────────────────────────────
  async function urgeGone() {
    setResisted(r => r + 1);
    if (uid) {
      try { await saveUser(uid, { resisted: increment(1) }); } catch {}
      if (currentUrgeLogId) {
        try { await updateDoc(doc(db, "users", uid, "urgelogs", currentUrgeLogId), { outcome: "resisted", feedbackNote: fbNote }); } catch {}
      }
    }
    setCurrentUrgeLogId(null); setFbNote("");
    showToast("Wonderful — urge resisted! 🎉");
    setScreen("dashboard");
  }

  function urgeStill() {
    if (uid && currentUrgeLogId) {
      try { updateDoc(doc(db, "users", uid, "urgelogs", currentUrgeLogId), { outcome: "still_there" }); } catch {}
    }
    showToast("That's okay — let's try a different approach");
    renderTasks(); setScreen("task");
  }

  // ─── RELAPSE ────────────────────────────────────
  async function confirmRelapse() {
    setModal(null);
    const newBest = streak > best ? streak : best;
    setBest(newBest); setStreak(0);
    const now = new Date(); setLastRelapseDate(now);
    if (uid) {
      try {
        await saveUser(uid, { streak: 0, bestStreak: newBest, lastRelapseDate: Timestamp.fromDate(now) });
        await addDoc(collection(db, "users", uid, "urgelogs"), {
          timestamp: serverTimestamp(), urgeType: "relapse", outcome: "relapsed", intensity: 10,
        });
      } catch {}
    }
    showToast("Logged. You can try again tomorrow 💙");
    setScreen("dashboard");
  }

  // ─── ANALYTICS ──────────────────────────────────
  async function initAnalytics() {
    const barData = [0,0,0,0,0,0,0];
    const trigCounts = { Stress:0, Boredom:0, Lonely:0, Anxiety:0, Habit:0, Other:0 };
    let relapseCount = 0;

    if (uid) {
      try {
        const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0,0,0,0);
        const snap = await getDocs(
          query(collection(db, "users", uid, "urgelogs"),
            where("timestamp", ">=", Timestamp.fromDate(since)),
            orderBy("timestamp", "asc"))
        );
        snap.forEach(d => {
          const data = d.data();
          const date = data.timestamp.toDate();
          const dayIdx = Math.min(6, Math.floor((Date.now() - date.getTime()) / 86400000));
          barData[6 - dayIdx] = (barData[6 - dayIdx] || 0) + 1;
          const tr = (data.trigger || "").toLowerCase();
          if (tr.includes("stress")) trigCounts.Stress++;
          else if (tr.includes("boredom")) trigCounts.Boredom++;
          else if (tr.includes("lone")) trigCounts.Lonely++;
          else if (tr.includes("anx")) trigCounts.Anxiety++;
          else if (tr.includes("habit")) trigCounts.Habit++;
          else trigCounts.Other++;
          if (data.outcome === "relapsed") relapseCount++;
        });
        setARelapseCount(relapseCount);
      } catch {}
    }

    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const max = Math.max(...barData, 1);
    setABars(barData.map((v, i) => ({ v, label: days[i], max, isMax: v === Math.max(...barData) && v > 0 })));

    const totalTrigs = Object.values(trigCounts).reduce((a, b) => a + b, 1);
    const tdata = [
      { n:"Stress",  p:Math.round(trigCounts.Stress/totalTrigs*100),  c:"var(--rose)" },
      { n:"Boredom", p:Math.round(trigCounts.Boredom/totalTrigs*100), c:"#B07D00" },
      { n:"Lonely",  p:Math.round(trigCounts.Lonely/totalTrigs*100),  c:"var(--blue)" },
      { n:"Anxiety", p:Math.round(trigCounts.Anxiety/totalTrigs*100), c:"var(--green-d)" },
      { n:"Habit",   p:Math.round(trigCounts.Habit/totalTrigs*100),   c:"var(--t3)" },
    ];
    setATrigs(tdata);
    const edata = [
      { n:"Breathing",i:"🫁",p:82 },{ n:"Exercise",i:"🏃",p:76 },
      { n:"Cold shower",i:"🚿",p:71 },{ n:"Journaling",i:"📝",p:65 },{ n:"Research",i:"📖",p:58 },
    ];
    setAEff(edata);

    const insight = await callGemini(
      `You are a recovery analytics coach. User stats: streak=${streak} days, urges resisted=${resisted}, total urges=${urgesTotal}. Top triggers: ${tdata.map(t=>`${t.n}:${t.p}%`).join(", ")}. Task effectiveness: ${edata.map(t=>`${t.n}:${t.p}%success`).join(", ")}. Write a personalised, actionable 2-sentence insight and one specific recommendation. Be warm and data-driven. No preamble.`
    );
    if (insight) setAiWeekly(insight);

    const cal = await buildCalendarData(uid, 14);
    setACal(cal);
  }

  useEffect(() => { if (screen === "analytics") initAnalytics(); }, [screen === "analytics"]);

  // ─── MOOD ────────────────────────────────────────
  async function logMood(mood) {
    if (uid) {
      try { await addDoc(collection(db, "users", uid, "moods"), { mood, timestamp: serverTimestamp() }); } catch {}
    }
    showToast("Mood logged: " + mood);
  }

  // ─── ADD CUSTOM TYPE ────────────────────────────
  function addCustomType() {
    const emoji = customEmoji.trim() || "❓";
    const name = customName.trim();
    if (!name) { showToast("Please enter a name for this type"); return; }
    setCustomTypes(prev => [...prev, { emoji, name, id: name.toLowerCase().replace(/\s/g, "_") }]);
    setCustomEmoji(""); setCustomName(""); setModal(null);
    showToast(emoji + " " + name + " added!");
  }

  // ─── HELPERS ─────────────────────────────────────
  const streakChip = () => {
    if (streak === 0) return { txt: "🌱 Day 1 — a fresh start", style: { background:"var(--blue-bg)", borderColor:"var(--blue-bd)", color:"var(--blue)" } };
    if (streak < 7) return { txt: "🔥 Building momentum", style: {} };
    if (streak < 30) return { txt: `⚡ On a roll — ${streak} days!`, style: {} };
    return { txt: `🏆 Incredible — ${streak} days!`, style: { background:"var(--amber-bg)", borderColor:"var(--amber-bd)", color:"#6B4E0A" } };
  };

  const dashGreet = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning ☀️" : h < 17 ? "Good afternoon ⛅" : h < 21 ? "Good evening 🌆" : "Good night 🌙";
  };

  const resistRate = urgesTotal ? Math.round((resisted / urgesTotal) * 100) : 0;
  const next = nextMilestone(streak);
  const prev = MILESTONES[MILESTONES.indexOf(next) - 1] || 0;
  const streakPct = prev === next ? 100 : Math.min(Math.round(((streak - prev) / (next - prev)) * 100), 100);

  const lv = iLevel(intensity);
  const recTasks = ALL_TASKS.filter(t => t.levels.includes(lv));
  const otherTasks = ALL_TASKS.filter(t => !t.levels.includes(lv));
  const ringOffset = 603 * (timerRem / timerTotal);

  /* ════════════ RENDER ════════════ */
  return (
    <>
      {/* Toast */}
      <div id="toast-el" className={toast.show ? "show" : ""}>{toast.msg}</div>

      {/* Modals */}
      <div className={`modal-bg ${modal === "addType" ? "open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="modal-box">
          <div className="modal-ttl">Add a custom urge type</div>
          <div className="modal-body">Give it a name and emoji. It'll appear in your urge log list.</div>
          <div className="fgroup">
            <label className="flabel">Emoji icon</label>
            <input className="finput" placeholder="e.g. 🎮" maxLength={4} style={{ fontSize:"1.4rem", textAlign:"center", width:80 }} value={customEmoji} onChange={e => setCustomEmoji(e.target.value)} />
          </div>
          <div className="fgroup">
            <label className="flabel">Name</label>
            <input className="finput" placeholder="e.g. Gaming, Gambling, Shopping..." value={customName} onChange={e => setCustomName(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-soft btn-md" style={{ flex:1 }} onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-md" style={{ flex:1 }} onClick={addCustomType}>Add type</button>
          </div>
        </div>
      </div>

      <div className={`modal-bg ${modal === "relapse" ? "open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="modal-box">
          <div className="modal-ttl">Log a relapse</div>
          <div className="modal-body">It takes courage to acknowledge this. Your streak resets to zero, but your personal best stays. The AI uses this to build a better plan — you're not starting over, you're learning.</div>
          <div className="modal-actions">
            <button className="btn btn-soft btn-md" style={{ flex:1 }} onClick={() => setModal(null)}>Not yet</button>
            <button className="btn btn-danger btn-md" style={{ flex:1 }} onClick={confirmRelapse}>Yes, log it</button>
          </div>
        </div>
      </div>

      <div className={`modal-bg ${modal === "reset" ? "open" : ""}`} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
        <div className="modal-box">
          <div className="modal-ttl">Reset all data?</div>
          <div className="modal-body">This will permanently remove all your streaks, urge logs, and settings. You can try again tomorrow — but this action cannot be undone.</div>
          <div className="modal-actions">
            <button className="btn btn-soft btn-md" style={{ flex:1 }} onClick={() => setModal(null)}>Keep my data</button>
            <button className="btn btn-danger btn-md" style={{ flex:1 }} onClick={() => showToast("Full reset coming with Firebase")}>Reset everything</button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {screen === "loading" && (
        <div style={{ position:"fixed", inset:0, background:"var(--bg)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:999 }}>
          <div style={{ width:52, height:52, borderRadius:"var(--r-lg)", background:"linear-gradient(135deg,var(--blue),var(--teal))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.6rem", marginBottom:16, boxShadow:"0 4px 20px var(--blue-glow)" }}>🌿</div>
          <div style={{ fontSize:22, fontWeight:900, color:"var(--blue)", marginBottom:8 }}>Clarity</div>
          <div style={{ fontSize:13, color:"var(--t3)" }}>Loading your journey...</div>
          <div style={{ width:120, height:3, background:"var(--bg3)", borderRadius:2, marginTop:20, overflow:"hidden" }}>
            <div style={{ height:"100%", background:"var(--blue)", borderRadius:2, animation:"loadbar 1.4s ease-in-out infinite" }}></div>
          </div>
        </div>
      )}

      <div className="app" style={{ display: screen === "loading" ? "none" : "flex" }}>

        {/* ── AUTH ── */}
        {screen === "auth" && <AuthScreen doSignUp={doSignUp} doLogin={doLogin} doGoogle={doGoogle} doReset={doReset} />}

        {/* ── NAV ── */}
        {!["auth","onboarding","loading"].includes(screen) && (
          <nav className="nav">
            <div className="nav-logo" onClick={() => setScreen("dashboard")}>
              <div className="nav-logo-mark">🌿</div>
              <span className="nav-logo-text">Clarity</span>
            </div>
            <div className="nav-gap" />
            <div className="nav-right">
              <div className="streak-pill">🔥 <span>{streak}</span> days</div>
              <button className="nav-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
                {theme === "dark" ? "🌙" : "☀️"}<span className="nav-tip">Theme</span>
              </button>
              <button className={`nav-btn ${screen === "analytics" ? "on" : ""}`} onClick={() => setScreen("analytics")}>
                📊<span className="nav-tip">Analytics</span>
              </button>
              <button className={`nav-btn ${screen === "profile" ? "on" : ""}`} onClick={() => setScreen("profile")}>
                👤<span className="nav-tip">Profile</span>
              </button>
            </div>
          </nav>
        )}

        {/* ── ONBOARDING ── */}
        {screen === "onboarding" && (
          <OnboardingScreen
            obStep={obStep} setObStep={setObStep}
            obAddictions={obAddictions} setObAddictions={setObAddictions}
            obPeriod={obPeriod} setObPeriod={setObPeriod}
            obTiming={obTiming} setObTiming={setObTiming}
            obTriggersOb={obTriggersOb} setObTriggersOb={setObTriggersOb}
            obRelapse={obRelapse} setObRelapse={setObRelapse}
            finishOb={finishOb} showToast={showToast}
          />
        )}

        {/* ── DASHBOARD ── */}
        {screen === "dashboard" && (
          <div className="screen-anim">
            <div className="page">
              <div className="sec" style={{ marginBottom:"var(--sp4)" }}>
                <div className="t-micro col-muted mb3" style={{ fontSize:13, fontWeight:500 }}>{dashGreet()}</div>
                <div style={{ fontSize:24, fontWeight:700, color:"var(--t1)" }}>Welcome back, {userName} 👋</div>
              </div>
              <div className="sec streak-grid">
                <div className="streak-card">
                  <div className="streak-bg"></div>
                  <div className="streak-wm">🔥</div>
                  <div className="streak-inner">
                    <div className="streak-eyebrow"><span className="streak-dot"></span> Current streak</div>
                    <div className="streak-row">
                      <div className="streak-num">{streak}</div>
                      <div className="streak-unit">days<br/>clean</div>
                    </div>
                    <div className="streak-best">Personal best: <strong>{best} days</strong></div>
                    <div className="streak-chip" style={streakChip().style}>{streakChip().txt}</div>
                    <div className="streak-prog-track mt3">
                      <div className="streak-prog-fill" style={{ width: streakPct + "%" }}></div>
                    </div>
                    <div className="streak-prog-lbls">
                      <span>Day {streak}</span>
                      <span>{streak >= next ? `🏆 ${next}-day milestone!` : `Next milestone: ${next} days`}</span>
                    </div>
                  </div>
                </div>
                <div className="mini-col">
                  <div className="mini-card">
                    <div className="mini-val col-blue">{urgesTotal}</div>
                    <div className="mini-lbl">Urges logged</div>
                  </div>
                  <div className="mini-card">
                    <div className="mini-val col-green">{urgesTotal ? resistRate + "%" : "—"}</div>
                    <div className="mini-lbl">Resistance rate</div>
                  </div>
                </div>
              </div>
              <div className="sec urge-cta">
                <div className="urge-label"><span className="urge-pulse"></span> Right now</div>
                <h3>Is something trying to break your streak?</h3>
                <p className="mt3">You don't have to fight this alone. Log the urge and we'll walk you through it — one gentle step at a time.</p>
                <button className="urge-main-btn" onClick={() => setScreen("urge")}>
                  <span>I'm feeling an urge right now</span>
                  <span className="urge-arrow">→</span>
                </button>
              </div>
              <div className="sec">
                <div className="insight">
                  <div className="insight-ico">✨</div>
                  <div>
                    <div className="insight-lbl">AI Daily Insight</div>
                    <div className="insight-txt">{dashQuote}</div>
                  </div>
                </div>
              </div>
              <div className="sec">
                <div className="sec-hd">
                  <div className="sec-ttl">This week</div>
                  <span className="sec-lnk" onClick={() => setScreen("analytics")}>View all analytics →</span>
                </div>
                <div className="card">
                  <div className="card-p">
                    <div className="cal-strip">
                      {dashCal.map((d, i) => (
                        <div key={i} className={`cal-day ${d.cls}`}>
                          <div className="cal-dn">{d.dn}</div>
                          <div className="cal-dd">{d.dd}</div>
                          <div className="cal-dot"></div>
                        </div>
                      ))}
                    </div>
                    <div className="flex g3 mt4" style={{ fontSize:12, color:"var(--t3)", fontWeight:500 }}>
                      <span>🟢 Resisted</span><span>🔴 Relapsed</span><span>🔵 Today</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="sec">
                <div className="sec-hd"><div className="sec-ttl">How are you feeling today?</div></div>
                <div className="card card-p">
                  <p className="t-caption mb4" style={{ fontSize:14, color:"var(--t2)", maxWidth:"none" }}>A quick check-in helps us support you better. There are no wrong answers.</p>
                  <div className="chip-row">
                    {["💪 Strong","😌 Calm","😐 Neutral","😰 Struggling","😡 Frustrated"].map(m => (
                      <button key={m} className="chip" onClick={() => logMood(m)}>{m}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG URGE ── */}
        {screen === "urge" && (
          <div className="screen-anim">
            <div className="page narrow">
              <div className="flex ic g3 mb6">
                <button className="btn btn-soft btn-sm" onClick={() => setScreen("dashboard")}>← Back</button>
                <div style={{ fontSize:20, fontWeight:700, color:"var(--t1)" }}>Log this urge</div>
              </div>
              <div className="insight mb6">
                <div className="insight-ico">🧠</div>
                <div>
                  <div className="insight-lbl">You're doing the right thing</div>
                  <div className="insight-txt">Logging an urge instead of acting on it is already a win. Let's understand what's happening and find you the right support.</div>
                </div>
              </div>
              <div className="sec">
                <div className="sec-hd">
                  <div className="sec-ttl">What type of urge is this?</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setModal("addType")}>+ Add custom</button>
                </div>
                <div className="vstack">
                  {[
                    { v:"porn", ico:"🔞", name:"Pornography", bg:"var(--rose-bg)" },
                    { v:"smoking", ico:"🚬", name:"Smoking / Nicotine", bg:"var(--amber-bg)" },
                    { v:"alcohol", ico:"🍺", name:"Alcohol", bg:"var(--blue-bg)" },
                    { v:"screen", ico:"📱", name:"Screen / Social media", bg:"var(--green-bg)" },
                    ...customTypes.map(c => ({ v:c.id, ico:c.emoji, name:c.name, bg:"var(--bg3)" })),
                  ].map(t => (
                    <button key={t.v} className={`task-row ${urgeType === t.v ? "on" : ""}`} onClick={() => setUrgeType(t.v)}>
                      <div className="task-ico" style={{ background: t.bg }}>{t.ico}</div>
                      <div className="task-info"><div className="task-name">{t.name}</div></div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="sec">
                <div className="flex ic jb mb3">
                  <div className="sec-ttl">How intense does it feel?</div>
                  <span className="int-badge" style={{ background:IB[intensity], color:IC[intensity] }}>{intensity} / 10 · {IL[intensity]}</span>
                </div>
                <div className="int-row">
                  {[1,2,3,4,5,6,7,8,9,10].map(v => (
                    <button key={v} className={`int-btn ${intensity === v ? "on" : ""} ${v >= 8 ? "hi" : ""}`} onClick={() => setIntensity(v)}>{v}</button>
                  ))}
                </div>
                <div className="flex jb mt2" style={{ fontSize:13, fontWeight:500, color:"var(--t2)" }}>
                  <span>Mild — I can manage</span><span>Overwhelming</span>
                </div>
              </div>
              <div className="sec">
                <div className="sec-ttl mb3">What triggered this feeling?</div>
                <div className="chip-row">
                  {["😰 Stress","😑 Boredom","😔 Loneliness","😟 Anxiety","😡 Anger","😢 Sadness","🔄 Habit"].map(t => (
                    <button key={t} className={`chip ${trigger === t ? "on" : ""}`}
                      onClick={() => { setTrigger(t); }}>
                      {t}
                    </button>
                  ))}
                  <button className={`chip ${trigger === "other" ? "on" : ""}`} onClick={() => setTrigger("other")}>💭 Other</button>
                </div>
                {trigger === "other" && (
                  <div style={{ marginTop:"var(--sp3)" }}>
                    <div className="insight mb3">
                      <div className="insight-ico" style={{ fontSize:".8rem" }}>🧠</div>
                      <div className="insight-txt">Describe what happened in your own words. The AI will analyse this over time and surface patterns in your analytics.</div>
                    </div>
                    <textarea className="finput" rows={3} placeholder="e.g. I saw an old photo, felt dismissed in a conversation..." value={otherText} onChange={e => setOtherText(e.target.value)} />
                  </div>
                )}
              </div>
              <button className="btn btn-green btn-lg w100" onClick={submitUrge}>Find me a task →</button>
            </div>
          </div>
        )}

        {/* ── TASK PICKER ── */}
        {screen === "task" && (
          <div className="screen-anim">
            <div className="page narrow">
              <div className="flex ic g3 mb6">
                <button className="btn btn-soft btn-sm" onClick={() => setScreen("urge")}>← Back</button>
                <div style={{ fontSize:20, fontWeight:700, color:"var(--t1)" }}>Choose your task</div>
              </div>
              <div className="insight mb5">
                <div className="insight-ico">✨</div>
                <div>
                  <div className="insight-lbl">AI Recommendation</div>
                  <div className="insight-txt">{aiRec}</div>
                </div>
              </div>
              <div>
                <div className="task-sec-lbl" style={{ color:"var(--green-d)" }}>
                  <span className="task-sec-dot" style={{ background:"var(--green-d)" }}></span>
                  Best for {lv === "low" ? "mild" : lv === "mid" ? "moderate" : "intense"} urges
                </div>
                <div className="task-list mb6">
                  {recTasks.map((t, i) => (
                    <button key={t.id} className={`task-row ${selectedTask.id === t.id ? "on" : ""}`} onClick={() => setSelectedTask({ ...t })}>
                      <div className="task-ico" style={{ background:t.bg }}>{t.icon}</div>
                      <div className="task-info">
                        <div className="task-name">{t.name}</div>
                        <div className="task-meta">{Math.floor(t.dur / 60)} min · {t.desc}</div>
                      </div>
                      {i === 0 && <span className="task-bdg">✦ Top pick</span>}
                    </button>
                  ))}
                </div>
                <div className="task-sec-lbl" style={{ color:"var(--t3)" }}>
                  <span className="task-sec-dot" style={{ background:"var(--t3)" }}></span>
                  Other helpful options
                </div>
                <div className="task-list">
                  {otherTasks.map(t => (
                    <button key={t.id} className={`task-row ${selectedTask.id === t.id ? "on" : ""}`} onClick={() => setSelectedTask({ ...t })}>
                      <div className="task-ico" style={{ background:t.bg }}>{t.icon}</div>
                      <div className="task-info">
                        <div className="task-name">{t.name}</div>
                        <div className="task-meta">{Math.floor(t.dur / 60)} min · {t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-green btn-lg w100 mt6" onClick={startTask}>Start task →</button>
            </div>
          </div>
        )}

        {/* ── TIMER ── */}
        {screen === "timer" && (
          <div className="screen-anim">
            <div className="page narrow">
              <div className="mb3">
                <button className="btn btn-soft btn-sm" onClick={() => { clearInterval(timerRef.current); setScreen("task"); }}>✕ Stop task</button>
              </div>
              <div className="timer-wrap">
                <div className="timer-name">{selectedTask.name}</div>
                <div className="timer-sub t-caption mt2">Focus. You're doing something powerful right now.</div>
                <div className="timer-ring-pos">
                  <svg width="220" height="220" viewBox="0 0 220 220">
                    <circle cx="110" cy="110" r="96" fill="none" stroke="var(--bg3)" strokeWidth="8"/>
                    <circle cx="110" cy="110" r="96" fill="none" stroke="var(--blue)" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray="603" strokeDashoffset={ringOffset}
                      style={{ transformOrigin:"center", transform:"rotate(-90deg)", transition:"stroke-dashoffset 1s linear" }}/>
                  </svg>
                  <div className="timer-ring-txt">
                    <div className="timer-ico">{selectedTask.icon}</div>
                    <div className="timer-dig">{fmt(timerRem)}</div>
                    <div className="timer-phase">{timerPhase}</div>
                  </div>
                </div>
                <div className="insight w100 mb6">
                  <div className="insight-ico">💙</div>
                  <div>
                    <div className="insight-lbl">Stay with it</div>
                    <div className="insight-txt">{timerMsg}</div>
                  </div>
                </div>
                <div className="flex g3 w100">
                  <button className="btn btn-soft btn-lg" style={{ flex:1 }}
                    onClick={() => setTimerPaused(p => !p)}>
                    {timerPaused ? "▶ Resume" : "⏸ Pause"}
                  </button>
                  <button className="btn btn-green btn-lg" style={{ flex:1 }} onClick={() => { clearInterval(timerRef.current); finishTimer(); }}>✓ Done</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FEEDBACK ── */}
        {screen === "feedback" && (
          <div className="screen-anim">
            <div className="page narrow" style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:"var(--sp6)" }}>
              <div style={{ fontSize:"3rem", marginBottom:"var(--sp3)" }}>🎯</div>
              <div style={{ fontSize:24, fontWeight:700, color:"var(--t1)", textAlign:"center", marginBottom:12 }}>You did it!</div>
              <p style={{ fontSize:15, color:"var(--t2)", textAlign:"center", maxWidth:"36ch" }}>You completed <strong style={{ color:"var(--t1)" }}>{selectedTask.name}</strong>. That took real strength. How is the urge feeling now?</p>
              <div className="fb-grid w100" style={{ maxWidth:480 }}>
                <button className="fb-card ok" onClick={urgeGone}>
                  <div className="fb-ico">✅</div>
                  <div className="fb-title">It's gone</div>
                  <div className="fb-sub">I feel better now</div>
                </button>
                <button className="fb-card bad" onClick={urgeStill}>
                  <div className="fb-ico">😰</div>
                  <div className="fb-title">Still there</div>
                  <div className="fb-sub">I need another task</div>
                </button>
              </div>
              <div className="w100" style={{ maxWidth:480 }}>
                <div className="flabel">Quick note <span className="col-muted" style={{ fontWeight:400 }}>(optional)</span></div>
                <textarea className="finput" placeholder="What helped? Any insight about this experience..." value={fbNote} onChange={e => setFbNote(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {screen === "analytics" && (
          <div className="screen-anim">
            <div className="page">
              <div className="sec" style={{ marginBottom:"var(--sp4)" }}>
                <div style={{ fontSize:24, fontWeight:700, color:"var(--t1)", marginBottom:12 }}>Your Progress</div>
                <p style={{ fontSize:14, color:"var(--t2)" }}>A clear picture of your recovery journey over time.</p>
              </div>
              <div className="sec">
                <div className="insight">
                  <div className="insight-ico">🧠</div>
                  <div>
                    <div className="insight-lbl">Weekly AI Insight</div>
                    <div className="insight-txt">{aiWeekly}</div>
                  </div>
                </div>
              </div>
              <div className="sec stats-grid">
                {[
                  { num:streak, lbl:"Current streak", delta:"↑ +3 days vs last month", cls:"up", color:"var(--green-d)" },
                  { num:best, lbl:"Best streak ever", delta:"Personal record", cls:"col-muted", color:"var(--t1)" },
                  { num:resisted, lbl:"Urges resisted", delta:`↑ ${resistRate}% success rate`, cls:"up", color:"var(--blue)" },
                  { num:aRelapseCount, lbl:"Relapses this month", delta:"↓ Down from last month", cls:"dn", color:"var(--rose)" },
                ].map((s, i) => (
                  <div key={i} className="stat-card">
                    <div className="stat-num" style={{ color:s.color }}>{s.num}</div>
                    <div className="stat-lbl">{s.lbl}</div>
                    <div className={`stat-delta ${s.cls}`}>{s.delta}</div>
                  </div>
                ))}
              </div>
              <div className="sec">
                <div className="card">
                  <div className="card-hd"><div><div className="card-ttl">Urge frequency</div><div className="card-sub">Urges logged each day this week</div></div></div>
                  <div className="card-p">
                    <div className="bar-chart">
                      {aBars.map((b, i) => (
                        <div key={i} className="bar-col">
                          <div className="bar-val">{b.v}</div>
                          <div className="bar-fill" style={{ height: Math.round((b.v / b.max) * 100), background: b.isMax ? "var(--rose)" : "var(--blue)" }}></div>
                          <div className="bar-lbl">{b.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="sec dash-grid">
                <div className="card">
                  <div className="card-hd"><div className="card-ttl">Top triggers</div></div>
                  <div className="card-p">
                    {aTrigs.map(t => (
                      <div key={t.n} className="trig-row">
                        <div className="trig-name">{t.n}</div>
                        <div className="trig-track"><div className="trig-fill" style={{ width:t.p+"%", background:t.c }}></div></div>
                        <div className="trig-pct">{t.p}%</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <div className="card-hd"><div className="card-ttl">Task effectiveness</div></div>
                  <div className="card-p">
                    {aEff.map(e => (
                      <div key={e.n} className="eff-row">
                        <div className="eff-ico">{e.i}</div>
                        <div className="eff-info">
                          <div className="eff-name">{e.n}</div>
                          <div className="eff-track"><div className="eff-fill" style={{ width:e.p+"%" }}></div></div>
                        </div>
                        <div className="eff-pct">{e.p}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sec">
                <div className="card">
                  <div className="card-hd"><div><div className="card-ttl">Last 14 days</div><div className="card-sub">Green = resisted · Red = relapsed</div></div></div>
                  <div className="card-p">
                    <div className="cal-strip">
                      {aCal.map((d, i) => (
                        <div key={i} className={`cal-day ${d.cls}`}>
                          <div className="cal-dn">{d.dn}</div>
                          <div className="cal-dd">{d.dd}</div>
                          <div className="cal-dot"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="sec card card-p" style={{ borderColor:"var(--rose-bd)" }}>
                <div className="flex ic jb">
                  <div>
                    <div style={{ fontWeight:700, color:"var(--rose)", fontSize:15, marginBottom:12 }}>Had a relapse?</div>
                    <p style={{ fontSize:14, color:"var(--t2)", maxWidth:"none" }}>Logging it resets your streak, but your personal best stays. It helps the AI build a better plan for you.</p>
                  </div>
                  <button className="btn btn-danger btn-md" style={{ flexShrink:0, marginLeft:"var(--sp4)" }} onClick={() => setModal("relapse")}>Log relapse</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {screen === "profile" && (
          <div className="screen-anim">
            <div className="page">
              <div style={{ fontSize:24, fontWeight:700, color:"var(--t1)", marginBottom:"var(--sp6)" }}>Profile & Settings</div>
              <div className="profile-layout">
                <div>
                  <div className="profile-av-card">
                    <div className="av-ring">🌿</div>
                    <div className="prof-name">{userName}</div>
                    <div className="prof-since mt2" style={{ fontSize:13, color:"var(--t2)" }}>{userEmail}</div>
                    <div className="mt3"><span className="badge badge-green">🔥 {streak} day streak</span></div>
                    <div className="prof-stats">
                      <div className="ps-item"><div className="ps-val">{resisted}</div><div className="ps-key">Resisted</div></div>
                      <div className="ps-item"><div className="ps-val" style={{ color:"var(--t2)" }}>{urgesTotal}</div><div className="ps-key">Total urges</div></div>
                    </div>
                  </div>
                  <div className="card card-p">
                    <div className="flabel mb3" style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:12 }}>Tracking</div>
                    <div className="chip-row">
                      {addictions.length
                        ? addictions.map(a => <span key={a} className="chip on-green">{{ porn:"🔞 Pornography", smoking:"🚬 Smoking", alcohol:"🍺 Alcohol", screen:"📱 Screen" }[a] || a}</span>)
                        : <span style={{ fontSize:14, color:"var(--t2)" }}>Complete onboarding to see this</span>}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="settings-card">
                    <div className="settings-grp-lbl">Appearance</div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--blue-bg)" }}>🌙</div>
                      <div className="setting-info"><div className="setting-name">Dark mode</div><div className="setting-desc">Switch between light and dark themes</div></div>
                      <label className="tog" style={{ position:"relative" }}>
                        <input type="checkbox" checked={theme === "dark"} onChange={e => setTheme(e.target.checked ? "dark" : "light")} />
                        <div className="tog-track"></div><div className="tog-thumb"></div>
                      </label>
                    </div>
                    <div className="settings-grp-lbl">Notifications</div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--amber-bg)" }}>🔔</div>
                      <div className="setting-info"><div className="setting-name">Daily check-in reminder</div><div className="setting-desc">A gentle nudge at noon every day</div></div>
                      <label className="tog" style={{ position:"relative" }}><input type="checkbox" defaultChecked /><div className="tog-track"></div><div className="tog-thumb"></div></label>
                    </div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--green-bg)" }}>📊</div>
                      <div className="setting-info"><div className="setting-name">Weekly AI report</div><div className="setting-desc">Insights every Sunday morning</div></div>
                      <label className="tog" style={{ position:"relative" }}><input type="checkbox" defaultChecked /><div className="tog-track"></div><div className="tog-thumb"></div></label>
                    </div>
                    <div className="settings-grp-lbl">AI</div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--blue-bg)" }}>✨</div>
                      <div className="setting-info"><div className="setting-name">AI encouragement during tasks</div><div className="setting-desc">Gemini-powered support while you focus</div></div>
                      <label className="tog" style={{ position:"relative" }}><input type="checkbox" defaultChecked /><div className="tog-track"></div><div className="tog-thumb"></div></label>
                    </div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--blue-bg)" }}>🔑</div>
                      <div className="setting-info"><div className="setting-name">Gemini API key</div><div className="setting-desc">Connect your own key for AI features</div></div>
                      <button className="btn btn-ghost btn-sm" onClick={() => showToast("Set VITE_GEMINI_API_KEY in your .env file")}>Configure</button>
                    </div>
                    <div className="settings-grp-lbl">Data & Privacy</div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--blue-bg)" }}>📤</div>
                      <div className="setting-info"><div className="setting-name">Export my data</div><div className="setting-desc">Download everything as a file</div></div>
                      <button className="btn btn-soft btn-sm" onClick={() => showToast("Export coming soon!")}>Export</button>
                    </div>
                    <div className="setting-row">
                      <div className="setting-ico" style={{ background:"var(--rose-bg)" }}>🗑️</div>
                      <div className="setting-info"><div className="setting-name">Reset all data</div><div className="setting-desc">This cannot be undone</div></div>
                      <button className="btn btn-soft btn-sm" style={{ color:"var(--rose)" }} onClick={() => setModal("reset")}>Reset</button>
                    </div>
                  </div>
                  <button className="btn btn-soft btn-md btn-fw mt4" onClick={doLogout} style={{ color:"var(--rose)", borderColor:"var(--rose-bd)" }}>Sign out</button>
                  <p style={{ fontSize:14, color:"var(--t2)", textAlign:"center", marginTop:"var(--sp4)" }}>Clarity v1.0 · Firebase + Gemini integrated</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════
   AUTH SCREEN
════════════════════════════════════════════════ */
function AuthScreen({ doSignUp, doLogin, doGoogle, doReset }) {
  const [tab, setTab] = useState("signup");
  const [suName, setSuName] = useState(""); const [suEmail, setSuEmail] = useState(""); const [suPass, setSuPass] = useState("");
  const [liEmail, setLiEmail] = useState(""); const [liPass, setLiPass] = useState("");
  const [suErr, setSuErr] = useState(""); const [liErr, setLiErr] = useState("");
  const [suLoading, setSuLoading] = useState(false); const [liLoading, setLiLoading] = useState(false);

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"var(--sp4)" }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:"var(--sp5)" }}>
          <div style={{ width:56, height:56, borderRadius:"var(--r-lg)", background:"linear-gradient(135deg,var(--blue),var(--teal))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.8rem", margin:"0 auto var(--sp3)", boxShadow:"0 4px 20px var(--blue-glow)" }}>🌿</div>
          <div style={{ fontSize:28, fontWeight:900, color:"var(--blue)", letterSpacing:"-.02em" }}>Clarity</div>
          <div style={{ fontSize:15, color:"var(--t2)", marginTop:4 }}>Your private recovery companion</div>
        </div>
        <div style={{ display:"flex", background:"var(--bg3)", borderRadius:"var(--r-full)", padding:4, marginBottom:"var(--sp4)" }}>
          <button onClick={() => setTab("signup")} style={{ flex:1, height:38, borderRadius:"var(--r-full)", fontSize:14, fontWeight:tab==="signup"?700:600, background:tab==="signup"?"var(--card)":"transparent", color:tab==="signup"?"var(--t1)":"var(--t2)", boxShadow:tab==="signup"?"var(--sh)":"none", border:"none", cursor:"pointer", transition:"all var(--tf)" }}>Create account</button>
          <button onClick={() => setTab("login")} style={{ flex:1, height:38, borderRadius:"var(--r-full)", fontSize:14, fontWeight:tab==="login"?700:600, background:tab==="login"?"var(--card)":"transparent", color:tab==="login"?"var(--t1)":"var(--t2)", boxShadow:tab==="login"?"var(--sh)":"none", border:"none", cursor:"pointer", transition:"all var(--tf)" }}>Log in</button>
        </div>
        {tab === "signup" ? (
          <div>
            <div className="fgroup"><label className="flabel">Your name</label><input className="finput" type="text" placeholder="How should we call you?" value={suName} onChange={e => setSuName(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Email address</label><input className="finput" type="email" placeholder="you@example.com" value={suEmail} onChange={e => setSuEmail(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Password</label><input className="finput" type="password" placeholder="At least 6 characters" value={suPass} onChange={e => setSuPass(e.target.value)} /></div>
            {suErr && <div style={{ fontSize:13, color:"var(--rose)", marginBottom:"var(--sp3)" }}>{suErr}</div>}
            <button className="btn btn-primary btn-lg btn-fw" disabled={suLoading} onClick={() => doSignUp(suName, suEmail, suPass, setSuLoading, setSuErr)}>{suLoading ? "Please wait..." : "Create my account →"}</button>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"var(--sp3) 0" }}><div style={{ flex:1, height:1, background:"var(--brd)" }}></div><span style={{ fontSize:12, color:"var(--t3)" }}>or</span><div style={{ flex:1, height:1, background:"var(--brd)" }}></div></div>
            <button className="btn btn-soft btn-lg btn-fw" onClick={doGoogle}><GoogleIcon />Continue with Google</button>
            <p style={{ fontSize:12, color:"var(--t3)", textAlign:"center", marginTop:"var(--sp3)", lineHeight:1.5 }}>Your data is private and never shared.</p>
          </div>
        ) : (
          <div>
            <div className="fgroup"><label className="flabel">Email address</label><input className="finput" type="email" placeholder="you@example.com" value={liEmail} onChange={e => setLiEmail(e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Password</label><input className="finput" type="password" placeholder="Your password" value={liPass} onChange={e => setLiPass(e.target.value)} /></div>
            {liErr && <div style={{ fontSize:13, color:"var(--rose)", marginBottom:"var(--sp3)" }}>{liErr}</div>}
            <button className="btn btn-primary btn-lg btn-fw" disabled={liLoading} onClick={() => doLogin(liEmail, liPass, setLiLoading, setLiErr)}>{liLoading ? "Please wait..." : "Log in →"}</button>
            <button onClick={() => doReset(liEmail, setLiErr)} style={{ display:"block", width:"100%", textAlign:"center", fontSize:13, color:"var(--blue)", marginTop:"var(--sp3)", background:"none", border:"none", cursor:"pointer" }}>Forgot password?</button>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"var(--sp3) 0" }}><div style={{ flex:1, height:1, background:"var(--brd)" }}></div><span style={{ fontSize:12, color:"var(--t3)" }}>or</span><div style={{ flex:1, height:1, background:"var(--brd)" }}></div></div>
            <button className="btn btn-soft btn-lg btn-fw" onClick={doGoogle}><GoogleIcon />Continue with Google</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   ONBOARDING SCREEN
════════════════════════════════════════════════ */
function OnboardingScreen({ obStep, setObStep, obAddictions, setObAddictions, obPeriod, setObPeriod, obTiming, setObTiming, obTriggersOb, setObTriggersOb, obRelapse, setObRelapse, finishOb, showToast }) {
  function toggleMulti(val, state, setState) {
    setState(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  }

  function obNext() {
    if (obStep === 1 && !obAddictions.length) { showToast("Please select at least one option"); return; }
    if (obStep === 2 && !obPeriod) { showToast("Please choose one option"); return; }
    if (obStep === 5) { if (!obRelapse) { showToast("Please choose one option"); return; } finishOb(); return; }
    setObStep(s => s + 1);
  }

  return (
    <div className="screen-anim">
      <div className="page narrow">
        <div className="ob-wrap">
          <div className="ob-prog">
            {[1,2,3,4,5].map(i => <div key={i} className={`ob-seg ${i <= obStep ? "done" : ""}`}></div>)}
          </div>

          {obStep === 1 && (
            <div>
              <div className="ob-eyebrow"><span className="ob-eyebrow-dot"></span>Step 1 of 5 · Getting started</div>
              <div className="ob-title">What are you working to overcome?</div>
              <div className="ob-sub">Select everything that applies. This shapes your entire recovery plan — there's no judgment here.</div>
              <div className="vstack">
                {[{v:"porn",ico:"🔞",name:"Pornography",meta:"Screen-based adult content addiction",bg:"var(--rose-bg)"},
                  {v:"smoking",ico:"🚬",name:"Smoking / Nicotine",meta:"Cigarettes, vapes, nicotine pouches",bg:"var(--amber-bg)"},
                  {v:"alcohol",ico:"🍺",name:"Alcohol",meta:"Beer, wine, spirits",bg:"var(--blue-bg)"},
                  {v:"screen",ico:"📱",name:"Screen / Social media",meta:"Doom-scrolling, gaming, compulsive browsing",bg:"var(--green-bg)"},
                ].map(t => (
                  <button key={t.v} className={`task-row ${obAddictions.includes(t.v) ? "on" : ""}`} onClick={() => toggleMulti(t.v, obAddictions, setObAddictions)}>
                    <div className="task-ico" style={{ background:t.bg }}>{t.ico}</div>
                    <div className="task-info"><div className="task-name">{t.name}</div><div className="task-meta">{t.meta}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {obStep === 2 && (
            <div>
              <div className="ob-eyebrow"><span className="ob-eyebrow-dot"></span>Step 2 of 5 · Your history</div>
              <div className="ob-title">How long has this been a challenge?</div>
              <div className="ob-sub">Understanding the depth of the pattern helps us calibrate your plan.</div>
              <div className="vstack">
                {[{v:"lt1y",ico:"📅",name:"Less than a year"},{v:"1to3y",ico:"🗓️",name:"1 – 3 years"},{v:"3to5y",ico:"⏳",name:"3 – 5 years"},{v:"5yp",ico:"🔁",name:"More than 5 years"}].map(t => (
                  <button key={t.v} className={`task-row ${obPeriod === t.v ? "on" : ""}`} onClick={() => setObPeriod(t.v)}>
                    <div className="task-ico" style={{ background:"var(--bg4)" }}>{t.ico}</div>
                    <div className="task-info"><div className="task-name">{t.name}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {obStep === 3 && (
            <div>
              <div className="ob-eyebrow"><span className="ob-eyebrow-dot"></span>Step 3 of 5 · Timing</div>
              <div className="ob-title">When do urges tend to hit hardest?</div>
              <div className="ob-sub">Select all that apply. We'll check in with you during these windows.</div>
              <div className="chip-row">
                {[{v:"morning",l:"🌅 Morning"},{v:"afternoon",l:"☀️ Afternoon"},{v:"evening",l:"🌆 Evening"},{v:"night",l:"🌙 Late night"},
                  {v:"stressed",l:"😤 Under stress"},{v:"bored",l:"😴 When bored"},{v:"alone",l:"🚶 When alone"},{v:"social",l:"🍻 Socially"}].map(c => (
                  <button key={c.v} className={`chip ${obTiming.includes(c.v) ? "on" : ""}`} onClick={() => toggleMulti(c.v, obTiming, setObTiming)}>{c.l}</button>
                ))}
              </div>
            </div>
          )}

          {obStep === 4 && (
            <div>
              <div className="ob-eyebrow"><span className="ob-eyebrow-dot"></span>Step 4 of 5 · Triggers</div>
              <div className="ob-title">What usually triggers the urge?</div>
              <div className="ob-sub">Knowing your triggers is half the battle. Select everything that resonates.</div>
              <div className="chip-row">
                {[{v:"stress",l:"😰 Stress"},{v:"boredom",l:"😑 Boredom"},{v:"lonely",l:"😔 Loneliness"},{v:"anxiety",l:"😟 Anxiety"},
                  {v:"anger",l:"😡 Anger"},{v:"sadness",l:"😢 Sadness"},{v:"celebration",l:"🎉 Celebrations"},
                  {v:"insomnia",l:"😴 Sleeplessness"},{v:"rejection",l:"💔 Rejection"},{v:"habit",l:"🔄 Pure habit"}].map(c => (
                  <button key={c.v} className={`chip ${obTriggersOb.includes(c.v) ? "on" : ""}`} onClick={() => toggleMulti(c.v, obTriggersOb, setObTriggersOb)}>{c.l}</button>
                ))}
              </div>
            </div>
          )}

          {obStep === 5 && (
            <div>
              <div className="ob-eyebrow"><span className="ob-eyebrow-dot"></span>Step 5 of 5 · Your starting point</div>
              <div className="ob-title">When was your last relapse?</div>
              <div className="ob-sub">This starts your streak counter. Honesty makes the app more effective — it's just between you and Clarity.</div>
              <div className="vstack">
                {[
                  {v:"today",ico:"📍",name:"Today — starting fresh right now",meta:"Streak begins at 0 days",bg:"var(--rose-bg)"},
                  {v:"1d",ico:"📆",name:"Yesterday",meta:"Streak begins at 1 day",bg:"var(--bg3)"},
                  {v:"3d",ico:"🌤️",name:"About 3 days ago",meta:"Streak begins at 3 days",bg:"var(--bg3)"},
                  {v:"1w",ico:"💪",name:"About a week ago",meta:"Streak begins at 7 days",bg:"var(--green-bg)"},
                  {v:"1m",ico:"🏆",name:"Over a month ago",meta:"Streak begins at 30 days",bg:"var(--green-bg)"},
                ].map(t => (
                  <button key={t.v} className={`task-row ${obRelapse === t.v ? "on" : ""}`} onClick={() => setObRelapse(t.v)}>
                    <div className="task-ico" style={{ background:t.bg }}>{t.ico}</div>
                    <div className="task-info"><div className="task-name">{t.name}</div><div className="task-meta">{t.meta}</div></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="ob-nav">
            {obStep > 1 && <button className="btn btn-soft btn-md" onClick={() => setObStep(s => s - 1)}>← Back</button>}
            <button className="btn btn-green btn-lg w100" onClick={obNext}>{obStep === 5 ? "Let's begin →" : "Continue →"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}