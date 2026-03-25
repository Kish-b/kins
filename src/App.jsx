// Clarity — Recovery Tracker
// React + Tailwind CSS conversion of the original HTML
// All Firebase config reads from Vite env vars (VITE_*)
// Delete index.css to avoid conflicts

import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, signOut, updateProfile,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, query, where, orderBy, getDocs,
  serverTimestamp, Timestamp, increment,
} from "firebase/firestore";

// ── FIREBASE INIT (reads from Vite env) ──────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
const gp    = new GoogleAuthProvider();

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
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
  { id:"breathing",   name:"Box Breathing",             dur:300, icon:"🫁", desc:"Inhale 4s · hold 4s · exhale 4s · repeat",       bg:"rgba(36,134,219,.1)",   levels:["low","mid","high"] },
  { id:"grounding",   name:"5-4-3-2-1 Grounding",       dur:180, icon:"🧘", desc:"Name 5 things you see, 4 you touch...",           bg:"rgba(78,205,196,.1)",   levels:["low","mid"] },
  { id:"music",       name:"Listen to Calming Music",   dur:600, icon:"🎵", desc:"Focus only on the sound — nothing else",           bg:"rgba(247,200,115,.15)", levels:["low","mid"] },
  { id:"prayer",      name:"Prayer / Reflection",       dur:300, icon:"🙏", desc:"Quiet prayer or a reflective moment",              bg:"rgba(247,200,115,.12)", levels:["low","mid"] },
  { id:"tea",         name:"Make & Drink Herbal Tea",   dur:600, icon:"🍵", desc:"A slow, warm ritual that resets the mind",         bg:"rgba(168,213,186,.15)", levels:["low","mid"] },
  { id:"exercise",    name:"Physical Exercise",         dur:900, icon:"🏃", desc:"Pushups, burpees, jumping jacks — go hard",        bg:"rgba(168,213,186,.15)", levels:["mid","high"] },
  { id:"walk",        name:"Go for a Walk Outside",     dur:900, icon:"🚶", desc:"Change your environment and breathe fresh air",    bg:"rgba(168,213,186,.12)", levels:["low","mid","high"] },
  { id:"shower",      name:"Cold Shower",               dur:300, icon:"🚿", desc:"Cold water resets your nervous system fast",       bg:"rgba(36,134,219,.1)",   levels:["mid","high"] },
  { id:"stretching",  name:"Full-body Stretching",      dur:600, icon:"🤸", desc:"Stretch every muscle group, slow and deep",        bg:"rgba(36,134,219,.08)",  levels:["low","mid"] },
  { id:"cleaning",    name:"Clean or Organise a Space", dur:900, icon:"🧹", desc:"Physical action with a clear, immediate result",   bg:"rgba(247,200,115,.15)", levels:["mid","high"] },
  { id:"journal",     name:"Journaling",                dur:600, icon:"📝", desc:"Write what you're feeling without filtering",      bg:"rgba(247,200,115,.15)", levels:["low","mid","high"] },
  { id:"gratitude",   name:"Gratitude List",            dur:300, icon:"💛", desc:"Write 5 things you're genuinely grateful for",    bg:"rgba(247,200,115,.12)", levels:["low","mid"] },
  { id:"call",        name:"Call Someone You Trust",    dur:600, icon:"📞", desc:"Connection breaks isolation. Reach out now.",      bg:"rgba(168,213,186,.15)", levels:["mid","high"] },
  { id:"affirmations",name:"Read Your Affirmations",    dur:180, icon:"✨", desc:"Remind yourself who you are and why you fight",    bg:"rgba(36,134,219,.1)",   levels:["low","mid"] },
  { id:"breathwork2", name:"Wim Hof Breathwork",        dur:480, icon:"💨", desc:"Powerful breathing technique for mental reset",    bg:"rgba(36,134,219,.1)",   levels:["mid","high"] },
  { id:"research",    name:"Read about Recovery",       dur:600, icon:"📖", desc:"Science of addiction, dopamine and healing",       bg:"rgba(229,115,115,.08)", levels:["low","mid"] },
  { id:"puzzle",      name:"Solve a Puzzle or Sudoku",  dur:600, icon:"🧩", desc:"Engage your prefrontal cortex on something hard",  bg:"rgba(36,134,219,.07)",  levels:["low","mid"] },
  { id:"cook",        name:"Cook or Prepare Food",      dur:900, icon:"🍳", desc:"Hands-on task that demands full attention",        bg:"rgba(247,200,115,.15)", levels:["mid","high"] },
  { id:"draw",        name:"Sketch or Doodle",          dur:600, icon:"✏️", desc:"No skill needed — just put pen to paper",         bg:"rgba(229,115,115,.06)", levels:["low","mid"] },
  { id:"memorise",    name:"Memorise Something",        dur:600, icon:"🧠", desc:"A quote, poem, or passage — focus the mind",       bg:"rgba(36,134,219,.07)",  levels:["low","mid"] },
];
const IL = ["","Very mild","Mild","Mild","Moderate","Moderate","Strong","Strong","Very strong","Extreme","Overwhelming"];
const BREATHE = ["Breathe in slowly...","Hold...","Breathe out slowly...","Hold..."];
const ENCOUR  = [
  "You are stronger than this urge. Keep going.",
  "Every second you hold on, the urge weakens.",
  "This discomfort is temporary. Your freedom is permanent.",
  "You're choosing differently right now. That's everything.",
  "The craving peaks and then fades. You're already past the worst.",
];
const DN = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const DAYS_OF_WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function iLevel(v) { return v <= 3 ? "low" : v <= 7 ? "mid" : "high"; }
function fmt(s) { return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0"); }
function nextMilestone(d) { return MILESTONES.find(m => m > d) || MILESTONES[MILESTONES.length-1]; }

// ── FIREBASE HELPERS ──────────────────────────────────────────────────────────
function fbErr(code) {
  const map = {
    "auth/email-already-in-use": "This email is already registered. Try logging in.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password. Please try again.",
    "auth/too-many-requests":    "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed":"Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

async function saveUser(uid, fields) {
  if (!uid) return;
  try { await updateDoc(doc(db, "users", uid), fields); } catch(e) { console.error("saveUser:", e); }
}

async function gemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch(e) { return null; }
}

// ── CSS (global styles in <style> tag via useEffect) ─────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Commissioner:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Commissioner', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { border-radius: 2px; }
  .dark ::-webkit-scrollbar-thumb { background: rgba(36,134,219,.24); }
  .light ::-webkit-scrollbar-thumb { background: rgba(36,134,219,.22); }

  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes puls   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.65)} }
  @keyframes loadbar{ 0%{width:0%;margin-left:0} 50%{width:60%;margin-left:20%} 100%{width:0%;margin-left:100%} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  .fade-up { animation: fadeUp 350ms cubic-bezier(.22,1,.36,1) both; }
  .pulse   { animation: puls 1.6s ease-in-out infinite; }
  .pulse-slow { animation: puls 2s ease-in-out infinite; }
  .loadbar { animation: loadbar 1.4s ease-in-out infinite; }

  /* Streak ring progress */
  .streak-ring-fill { transition: stroke-dashoffset 1s cubic-bezier(.22,1,.36,1); }
  .timer-ring-fill  { transition: stroke-dashoffset 1s linear; }

  /* Toggle switch */
  .tog-input { position:absolute; opacity:0; width:100%; height:100%; cursor:pointer; margin:0; }
  .tog-input:checked ~ .tog-track { background: #7ABFA0; }
  .tog-input:checked ~ .tog-thumb { transform: translateX(20px); }
`;

// ── THEME TOKENS ──────────────────────────────────────────────────────────────
function useThemeClasses(dark) {
  return {
    bg:   dark ? "bg-[#181E27]" : "bg-[#F5F7FA]",
    bg2:  dark ? "bg-[#232D3A]" : "bg-white",
    bg3:  dark ? "bg-[#2D3A4A]" : "bg-[#EEF2F7]",
    bg4:  dark ? "bg-[#3A4A5C]" : "bg-[#E0E7F0]",
    card: dark ? "bg-[#232D3A]" : "bg-white",
    brd:  dark ? "border-[rgba(36,134,219,.13)]" : "border-[rgba(36,134,219,.12)]",
    brd2: dark ? "border-[rgba(36,134,219,.24)]" : "border-[rgba(36,134,219,.22)]",
    t1:   dark ? "text-[#EDF2F7]" : "text-[#262E36]",
    t2:   dark ? "text-[#9AACBC]" : "text-[#5A6A7A]",
    t3:   dark ? "text-[#64788C]" : "text-[#959CA3]",
    sh:   dark ? "shadow-[0_2px_8px_rgba(0,0,0,.35)]" : "shadow-[0_1px_4px_rgba(36,134,219,.08),0_2px_8px_rgba(0,0,0,.05)]",
    shmd: dark ? "shadow-[0_4px_20px_rgba(0,0,0,.45)]" : "shadow-[0_4px_16px_rgba(36,134,219,.12),0_2px_6px_rgba(0,0,0,.05)]",
    shlg: dark ? "shadow-[0_8px_32px_rgba(0,0,0,.55)]" : "shadow-[0_8px_32px_rgba(36,134,219,.16),0_4px_12px_rgba(0,0,0,.06)]",
    blue:      dark ? "#5AADE8" : "#2486DB",
    blueText:  dark ? "text-[#5AADE8]" : "text-[#2486DB]",
    greenText: dark ? "text-[#A8D5BA]" : "text-[#7ABFA0]",
  };
}

// ── REUSABLE ATOMS ────────────────────────────────────────────────────────────

function Toast({ msg }) {
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium z-50 whitespace-nowrap shadow-xl transition-all duration-250
      ${msg ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1.5 pointer-events-none"}
      bg-[#262E36] text-white`}>
      {msg}
    </div>
  );
}

function LoadingOverlay({ msg }) {
  return (
    <div className="fixed inset-0 bg-[#F5F7FA] flex flex-col items-center justify-center z-[999]">
      <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-[#2486DB] to-[#4ECDC4] flex items-center justify-center text-2xl mb-4 shadow-[0_4px_20px_rgba(36,134,219,.2)]">🌿</div>
      <div className="text-2xl font-black text-[#2486DB] mb-2">Clarity</div>
      <div className="text-sm text-[#959CA3]">{msg}</div>
      <div className="w-30 h-[3px] bg-[#EEF2F7] rounded-full mt-5 overflow-hidden">
        <div className="h-full bg-[#2486DB] rounded-full loadbar" />
      </div>
    </div>
  );
}

function Modal({ id, open, onClose, title, body, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-[rgba(38,46,54,.55)] z-[200] flex items-center justify-center p-4 backdrop-blur-[4px]"
      onClick={onClose}>
      <div className="bg-white border border-[rgba(36,134,219,.22)] rounded-3xl p-6 w-full max-w-[420px] shadow-[0_8px_32px_rgba(36,134,219,.16),0_4px_12px_rgba(0,0,0,.06)] fade-up"
        onClick={e => e.stopPropagation()}>
        <div className="text-xl font-bold text-[#262E36] mb-1.5">{title}</div>
        <div className="text-[15px] text-[#5A6A7A] leading-relaxed mb-6">{body}</div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, variant = "soft", size = "md", full, disabled, style: sx, className = "" }) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl border-none cursor-pointer transition-all duration-150 whitespace-nowrap";
  const sizes = { lg: "h-12 px-7 text-base rounded-2xl", md: "h-10 px-5 text-[15px]", sm: "h-8 px-3.5 text-[13px] rounded-lg" };
  const variants = {
    primary: "bg-[#2486DB] text-white shadow-[0_2px_10px_rgba(36,134,219,.2)] hover:-translate-y-px hover:bg-[#1E6DB8] hover:shadow-[0_4px_18px_rgba(36,134,219,.2)] active:translate-y-0",
    green:   "bg-[#7ABFA0] text-white shadow-[0_2px_10px_rgba(122,191,160,.3)] hover:brightness-105 hover:-translate-y-px active:translate-y-0",
    danger:  "bg-[#E57373] text-white shadow-[0_4px_18px_rgba(229,115,115,.32)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(229,115,115,.44)] active:translate-y-0",
    soft:    "bg-[#EEF2F7] text-[#5A6A7A] border border-[rgba(36,134,219,.12)] hover:bg-[#E0E7F0] hover:text-[#262E36] hover:border-[rgba(36,134,219,.22)]",
    ghost:   "bg-transparent text-[#2486DB] border border-[rgba(36,134,219,.28)] hover:bg-[rgba(36,134,219,.1)]",
  };
  return (
    <button onClick={onClick} disabled={disabled} style={sx}
      className={`${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
}

function Input({ label, type = "text", value, onChange, placeholder, error, multiline, autoComplete }) {
  const base = "w-full bg-white border border-[rgba(36,134,219,.22)] rounded-xl px-4 py-3 text-[15px] text-[#262E36] outline-none transition-all duration-150 leading-relaxed placeholder:text-[#959CA3] focus:border-[#2486DB] focus:shadow-[0_0_0_3px_rgba(36,134,219,.1)]";
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-semibold text-[#262E36] mb-1.5">{label}</label>}
      {multiline
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3}
            className={`${base} resize-y min-h-[88px] ${error ? "border-[#E57373]" : ""}`} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder}
            autoComplete={autoComplete}
            className={`${base} ${error ? "border-[#E57373]" : ""}`} />}
      {error && <div className="text-[13px] text-[#E57373] mt-1">{error}</div>}
    </div>
  );
}

function InsightBox({ icon, label, text }) {
  return (
    <div className="flex gap-4 bg-[rgba(36,134,219,.1)] border border-[rgba(36,134,219,.28)] rounded-2xl p-4">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-[#2486DB] to-[#4ECDC4] flex items-center justify-center text-[.9rem] shadow-[0_2px_8px_rgba(36,134,219,.2)]">
        {icon}
      </div>
      <div>
        <div className="text-[11px] font-bold tracking-[.05em] uppercase text-[#2486DB] mb-1">{label}</div>
        <div className="text-sm text-[#5A6A7A] leading-relaxed">{text}</div>
      </div>
    </div>
  );
}

function TaskRow({ task, selected, onSelect, topPick }) {
  return (
    <button onClick={onSelect}
      className={`flex items-center gap-4 p-4 rounded-2xl border-[1.5px] w-full text-left transition-all duration-150 shadow-[0_1px_4px_rgba(36,134,219,.08),0_2px_8px_rgba(0,0,0,.05)]
        ${selected
          ? "border-[#2486DB] bg-[rgba(36,134,219,.1)] shadow-[0_4px_16px_rgba(36,134,219,.12)]"
          : "border-[rgba(36,134,219,.12)] bg-white hover:border-[rgba(36,134,219,.28)] hover:bg-[rgba(36,134,219,.1)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(36,134,219,.12)]"}`}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: task.bg }}>
        {task.icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="text-[15px] font-semibold text-[#262E36] mb-0.5">{task.name}</div>
        <div className="text-[13px] text-[#5A6A7A] leading-snug">{Math.floor(task.dur/60)} min · {task.desc}</div>
      </div>
      {topPick && (
        <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-[rgba(247,200,115,.18)] text-[#6B4E0A] border border-[rgba(247,200,115,.4)] shrink-0">
          ✦ Top pick
        </span>
      )}
    </button>
  );
}

function CalStrip({ logs, days }) {
  const today = new Date();
  const dayMap = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate()-i);
    dayMap[d.toDateString()] = "empty";
  }
  dayMap[today.toDateString()] = "now";
  logs.forEach(l => {
    const key = l.date.toDateString();
    if (key in dayMap) {
      if (l.outcome === "relapsed") dayMap[key] = "bad";
      else if (dayMap[key] === "empty") dayMap[key] = "ok";
    }
  });

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {Array.from({ length: days }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate()-(days-1-i));
        const cls = dayMap[d.toDateString()] || "empty";
        const styles = {
          ok:    "bg-[rgba(168,213,186,.15)] border-[rgba(168,213,186,.4)]",
          bad:   "bg-[rgba(229,115,115,.12)] border-[rgba(229,115,115,.28)]",
          now:   "border-[#2486DB] bg-[rgba(36,134,219,.1)] shadow-[0_0_0_2px_rgba(36,134,219,.1)]",
          empty: "bg-[#EEF2F7] border-[rgba(36,134,219,.12)]",
        };
        const dotStyles = {
          ok:    "bg-[#7ABFA0]", bad: "bg-[#E57373]", now: "bg-[#2486DB]", empty: "bg-transparent",
        };
        return (
          <div key={i} className={`shrink-0 w-11 rounded-xl border-[1.5px] py-2 px-1 text-center ${styles[cls]}`}>
            <div className="text-[11px] font-bold uppercase text-[#959CA3]">{DN[d.getDay()]}</div>
            <div className="text-[13px] font-bold text-[#5A6A7A] my-0.5">{d.getDate()}</div>
            <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${dotStyles[cls]}`} />
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div className="relative w-11 h-6 shrink-0">
      <input type="checkbox" checked={checked} onChange={onChange} className="tog-input" />
      <div className={`absolute inset-0 rounded-full transition-colors duration-150 ${checked ? "bg-[#7ABFA0]" : "bg-[#E0E7F0]"}`} />
      <div className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.2)] transition-transform duration-150 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </div>
  );
}

function Badge({ children, variant = "green" }) {
  const styles = {
    green: "bg-[rgba(168,213,186,.15)] text-[#7ABFA0] border border-[rgba(168,213,186,.4)]",
    blue:  "bg-[rgba(36,134,219,.1)] text-[#2486DB] border border-[rgba(36,134,219,.28)]",
    amber: "bg-[rgba(247,200,115,.18)] text-[#6B4E0A] border border-[rgba(247,200,115,.4)]",
    rose:  "bg-[rgba(229,115,115,.12)] text-[#E57373] border border-[rgba(229,115,115,.28)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold ${styles[variant]}`}>
      {children}
    </span>
  );
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
function AuthScreen({ onNav, onToast }) {
  const [tab, setTab]         = useState("signup");
  const [suName, setSuName]   = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass]   = useState("");
  const [liEmail, setLiEmail] = useState("");
  const [liPass, setLiPass]   = useState("");
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);

  async function doSignUp() {
    setErr("");
    if (!suName)  { setErr("Please enter your name."); return; }
    if (!suEmail) { setErr("Please enter your email."); return; }
    if (!suPass || suPass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, suEmail, suPass);
      await updateProfile(cred.user, { displayName: suName });
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid, name: suName, email: suEmail,
        createdAt: serverTimestamp(), onboardingComplete: false,
        addictions: [], streak: 0, bestStreak: 0,
        urgesTotal: 0, resisted: 0, tasksDone: 0, theme: "light",
      });
      onToast("Welcome to Clarity, " + suName + "! 🌿");
    } catch(e) { setErr(fbErr(e.code)); setLoading(false); }
  }

  async function doLogin() {
    setErr("");
    if (!liEmail) { setErr("Please enter your email."); return; }
    if (!liPass)  { setErr("Please enter your password."); return; }
    setLoading(true);
    try { await signInWithEmailAndPassword(auth, liEmail, liPass); }
    catch(e) { setErr(fbErr(e.code)); setLoading(false); }
  }

  async function doGoogle() {
    try {
      const cred = await signInWithPopup(auth, gp);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid, name: cred.user.displayName,
          email: cred.user.email, createdAt: serverTimestamp(),
          onboardingComplete: false, addictions: [], streak: 0,
          bestStreak: 0, urgesTotal: 0, resisted: 0, tasksDone: 0, theme: "light",
        });
      }
    } catch(e) { onToast(fbErr(e.code)); }
  }

  async function doReset() {
    if (!liEmail) { setErr("Enter your email above first, then click Forgot password."); return; }
    try { await sendPasswordResetEmail(auth, liEmail); onToast("Password reset email sent!"); }
    catch(e) { setErr(fbErr(e.code)); }
  }

  const GoogleSVG = () => (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.4 2.9 13.2l7.8 6.1C12.5 13 17.8 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.1-4.5 6.7l7 5.4c4.1-3.8 6.4-9.4 6.4-16.1z"/>
      <path fill="#FBBC05" d="M10.7 28.7c-.6-1.6-.9-3.3-.9-5.2s.3-3.6.9-5.2l-7.8-6.1C1.1 15.4 0 19.6 0 24s1.1 8.6 2.9 11.8l7.8-6.1z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7-5.4c-2 1.3-4.5 2.1-8 2.1-6.2 0-11.5-4.2-13.4-9.8l-7.8 6.1C6.7 42.6 14.7 48 24 48z"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F5F7FA]">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2486DB] to-[#4ECDC4] flex items-center justify-center text-[1.8rem] mx-auto mb-4 shadow-[0_4px_20px_rgba(36,134,219,.2)]">🌿</div>
          <div className="text-[28px] font-black text-[#2486DB] tracking-tight">Clarity</div>
          <div className="text-[15px] text-[#5A6A7A] mt-1">Your private recovery companion</div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#EEF2F7] rounded-full p-1 mb-6">
          {["signup","login"].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }}
              className={`flex-1 h-[38px] rounded-full text-sm font-bold transition-all duration-150
                ${tab===t ? "bg-white text-[#262E36] shadow-[0_1px_4px_rgba(36,134,219,.08)]" : "bg-transparent text-[#5A6A7A]"}`}>
              {t === "signup" ? "Create account" : "Log in"}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[rgba(36,134,219,.12)] p-6 shadow-[0_4px_16px_rgba(36,134,219,.12)]">
          {err && <div className="text-[13px] text-[#E57373] mb-4 bg-[rgba(229,115,115,.08)] border border-[rgba(229,115,115,.28)] rounded-xl px-3 py-2">{err}</div>}

          {tab === "signup" ? (
            <>
              <Input label="Your name" value={suName} onChange={e=>setSuName(e.target.value)} placeholder="How should we call you?" autoComplete="name"/>
              <Input label="Email address" type="email" value={suEmail} onChange={e=>setSuEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/>
              <Input label="Password" type="password" value={suPass} onChange={e=>setSuPass(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password"/>
              <Btn variant="primary" size="lg" full onClick={doSignUp} disabled={loading}>
                {loading ? "Please wait..." : "Create my account →"}
              </Btn>
            </>
          ) : (
            <>
              <Input label="Email address" type="email" value={liEmail} onChange={e=>setLiEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/>
              <Input label="Password" type="password" value={liPass} onChange={e=>setLiPass(e.target.value)} placeholder="Your password" autoComplete="current-password"/>
              <Btn variant="primary" size="lg" full onClick={doLogin} disabled={loading}>
                {loading ? "Please wait..." : "Log in →"}
              </Btn>
              <button onClick={doReset} className="block w-full text-center text-[13px] text-[#2486DB] mt-4 bg-none border-none cursor-pointer">
                Forgot password?
              </button>
            </>
          )}

          <div className="flex items-center gap-2.5 my-4">
            <div className="flex-1 h-px bg-[rgba(36,134,219,.12)]"/>
            <span className="text-[12px] text-[#959CA3]">or</span>
            <div className="flex-1 h-px bg-[rgba(36,134,219,.12)]"/>
          </div>
          <Btn variant="soft" size="lg" full onClick={doGoogle}><GoogleSVG/> Continue with Google</Btn>
          <p className="text-[12px] text-[#959CA3] text-center mt-4 leading-relaxed">Your data is private and never shared.</p>
        </div>
      </div>
    </div>
  );
}

// ── ONBOARDING SCREEN ─────────────────────────────────────────────────────────
function OnboardingScreen({ S, onDone, onToast }) {
  const [step, setStep]   = useState(1);
  const [addictions, setAddictions] = useState([]);
  const [period, setPeriod]         = useState(null);
  const [timing, setTiming]         = useState([]);
  const [triggers, setTriggers]     = useState([]);
  const [relapse, setRelapse]       = useState(null);

  function toggleArr(arr, setArr, v) {
    setArr(a => a.includes(v) ? a.filter(x=>x!==v) : [...a, v]);
  }

  async function finish() {
    if (!relapse) { onToast("Please choose one option"); return; }
    const streak = STREAK_MAP[relapse] || 0;
    const relapseDate = new Date(); relapseDate.setDate(relapseDate.getDate()-streak);
    if (S.uid) {
      await saveUser(S.uid, {
        onboardingComplete: true, addictions, period: period||"", timing,
        triggers, relapse, streak,
        lastRelapseDate: Timestamp.fromDate(relapseDate),
        bestStreak: Math.max(streak, 0),
      });
    }
    onDone({ addictions, streak, best: Math.max(streak,0), lastRelapseDate: relapseDate });
    onToast("Welcome to Clarity, " + S.userName + "! 🌿");
  }

  function next() {
    if (step===1 && !addictions.length) { onToast("Please select at least one option"); return; }
    if (step===2 && !period)            { onToast("Please choose one option"); return; }
    if (step===5) { finish(); return; }
    setStep(s=>s+1);
  }

  const Eyebrow = ({ n, label }) => (
    <div className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[.06em] uppercase text-[#7ABFA0] mb-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[#7ABFA0]"/>Step {n} of 5 · {label}
    </div>
  );

  const SelTaskRow = ({ icon, bg, name, meta, value, checked, onClick }) => (
    <button onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-2xl border-[1.5px] w-full text-left transition-all duration-150
        ${checked
          ? "border-[#2486DB] bg-[rgba(36,134,219,.1)] shadow-[0_4px_16px_rgba(36,134,219,.12)]"
          : "border-[rgba(36,134,219,.12)] bg-white hover:border-[rgba(36,134,219,.28)] hover:bg-[rgba(36,134,219,.1)]"}
        shadow-[0_1px_4px_rgba(36,134,219,.08)]`}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{background:bg}}>{icon}</div>
      <div className="flex-1 text-left">
        <div className="text-[15px] font-semibold text-[#262E36] mb-0.5">{name}</div>
        {meta && <div className="text-[13px] text-[#5A6A7A]">{meta}</div>}
      </div>
    </button>
  );

  const Chip = ({ label, value, checked, onClick }) => (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] text-sm font-medium transition-all duration-150
        ${checked
          ? "bg-[rgba(36,134,219,.1)] border-[#2486DB] text-[#2486DB] font-semibold"
          : "border-[rgba(36,134,219,.22)] bg-[#EEF2F7] text-[#5A6A7A] hover:border-[rgba(36,134,219,.28)] hover:text-[#2486DB] hover:bg-[rgba(36,134,219,.1)]"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA] py-8">
      <div className="max-w-[560px] mx-auto px-6">

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-10">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-colors duration-250 ${i<=step ? "bg-[#7ABFA0]" : "bg-[#E0E7F0]"}`}/>
          ))}
        </div>

        <div className="fade-up">
          {step===1 && (
            <>
              <Eyebrow n={1} label="Getting started"/>
              <div className="text-[28px] font-black text-[#262E36] mb-2 leading-tight">What are you working to overcome?</div>
              <p className="text-[15px] text-[#5A6A7A] mb-6 leading-relaxed">Select everything that applies. This shapes your entire recovery plan — there's no judgment here.</p>
              <div className="flex flex-col gap-3">
                {[{v:"porn",icon:"🔞",bg:"rgba(229,115,115,.12)",name:"Pornography",meta:"Screen-based adult content addiction"},
                  {v:"smoking",icon:"🚬",bg:"rgba(247,200,115,.18)",name:"Smoking / Nicotine",meta:"Cigarettes, vapes, nicotine pouches"},
                  {v:"alcohol",icon:"🍺",bg:"rgba(36,134,219,.1)",name:"Alcohol",meta:"Beer, wine, spirits"},
                  {v:"screen",icon:"📱",bg:"rgba(168,213,186,.15)",name:"Screen / Social media",meta:"Doom-scrolling, gaming, compulsive browsing"},
                ].map(o => <SelTaskRow key={o.v} {...o} checked={addictions.includes(o.v)} onClick={()=>toggleArr(addictions,setAddictions,o.v)}/>)}
              </div>
            </>
          )}

          {step===2 && (
            <>
              <Eyebrow n={2} label="Your history"/>
              <div className="text-[28px] font-black text-[#262E36] mb-2 leading-tight">How long has this been a challenge?</div>
              <p className="text-[15px] text-[#5A6A7A] mb-6 leading-relaxed">Understanding the depth of the pattern helps us calibrate your plan.</p>
              <div className="flex flex-col gap-3">
                {[{v:"lt1y",icon:"📅",name:"Less than a year"},{v:"1to3y",icon:"🗓️",name:"1 – 3 years"},
                  {v:"3to5y",icon:"⏳",name:"3 – 5 years"},{v:"5yp",icon:"🔁",name:"More than 5 years"},
                ].map(o => <SelTaskRow key={o.v} {...o} bg="rgba(36,134,219,.05)" checked={period===o.v} onClick={()=>setPeriod(o.v)}/>)}
              </div>
            </>
          )}

          {step===3 && (
            <>
              <Eyebrow n={3} label="Timing"/>
              <div className="text-[28px] font-black text-[#262E36] mb-2 leading-tight">When do urges tend to hit hardest?</div>
              <p className="text-[15px] text-[#5A6A7A] mb-6 leading-relaxed">Select all that apply. We'll check in with you during these windows.</p>
              <div className="flex flex-wrap gap-2">
                {["🌅 Morning","☀️ Afternoon","🌆 Evening","🌙 Late night","😤 Under stress","😴 When bored","🚶 When alone","🍻 Socially"].map(l => (
                  <Chip key={l} label={l} checked={timing.includes(l)} onClick={()=>toggleArr(timing,setTiming,l)}/>
                ))}
              </div>
            </>
          )}

          {step===4 && (
            <>
              <Eyebrow n={4} label="Triggers"/>
              <div className="text-[28px] font-black text-[#262E36] mb-2 leading-tight">What usually triggers the urge?</div>
              <p className="text-[15px] text-[#5A6A7A] mb-6 leading-relaxed">Knowing your triggers is half the battle. Select everything that resonates.</p>
              <div className="flex flex-wrap gap-2">
                {["😰 Stress","😑 Boredom","😔 Loneliness","😟 Anxiety","😡 Anger","😢 Sadness","🎉 Celebrations","😴 Sleeplessness","💔 Rejection","🔄 Pure habit"].map(l => (
                  <Chip key={l} label={l} checked={triggers.includes(l)} onClick={()=>toggleArr(triggers,setTriggers,l)}/>
                ))}
              </div>
            </>
          )}

          {step===5 && (
            <>
              <Eyebrow n={5} label="Your starting point"/>
              <div className="text-[28px] font-black text-[#262E36] mb-2 leading-tight">When was your last relapse?</div>
              <p className="text-[15px] text-[#5A6A7A] mb-6 leading-relaxed">This starts your streak counter. Honesty makes the app more effective.</p>
              <div className="flex flex-col gap-3">
                {[{v:"today",icon:"📍",bg:"rgba(229,115,115,.12)",name:"Today — starting fresh right now",meta:"Streak begins at 0 days"},
                  {v:"1d",icon:"📆",bg:"rgba(36,134,219,.05)",name:"Yesterday",meta:"Streak begins at 1 day"},
                  {v:"3d",icon:"🌤️",bg:"rgba(36,134,219,.05)",name:"About 3 days ago",meta:"Streak begins at 3 days"},
                  {v:"1w",icon:"💪",bg:"rgba(168,213,186,.15)",name:"About a week ago",meta:"Streak begins at 7 days"},
                  {v:"1m",icon:"🏆",bg:"rgba(168,213,186,.15)",name:"Over a month ago",meta:"Streak begins at 30 days"},
                ].map(o => <SelTaskRow key={o.v} {...o} checked={relapse===o.v} onClick={()=>setRelapse(o.v)}/>)}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          {step>1 && <Btn variant="soft" size="md" onClick={()=>setStep(s=>s-1)}>← Back</Btn>}
          <Btn variant="green" size="lg" full onClick={next}>{step===5 ? "Let's begin →" : "Continue →"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────
function Navbar({ screen, streak, dark, onToggleDark, onNav }) {
  const isApp = !["auth","onboarding"].includes(screen);
  return (
    <nav className="h-16 flex items-center bg-white border-b border-[rgba(36,134,219,.12)] px-6 sticky top-0 z-50 shadow-[0_1px_4px_rgba(36,134,219,.08),0_2px_8px_rgba(0,0,0,.05)]">
      <button onClick={() => onNav("dashboard")} className="flex items-center gap-2.5 shrink-0 opacity-100 hover:opacity-80 transition-opacity">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2486DB] to-[#4ECDC4] flex items-center justify-center text-base shadow-[0_2px_10px_rgba(36,134,219,.2)]">🌿</div>
        <span className="text-xl font-black text-[#2486DB] tracking-tight">Clarity</span>
      </button>
      <div className="flex-1"/>
      <div className="flex items-center gap-2">
        {isApp && (
          <div className="inline-flex items-center gap-1.5 bg-[rgba(168,213,186,.15)] border border-[rgba(168,213,186,.4)] rounded-full px-3.5 py-1.5 text-[13px] font-bold text-[#7ABFA0]">
            🔥 <span>{streak}</span> days
          </div>
        )}
        <NavBtn icon={dark?"🌙":"☀️"} tip="Theme" onClick={onToggleDark}/>
        {isApp && <NavBtn icon="📊" tip="Analytics" active={screen==="analytics"} onClick={()=>onNav("analytics")}/>}
        {isApp && <NavBtn icon="👤" tip="Profile" active={screen==="profile"} onClick={()=>onNav("profile")}/>}
      </div>
    </nav>
  );
}

function NavBtn({ icon, tip, active, onClick }) {
  return (
    <button onClick={onClick} className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-base border-[1.5px] transition-all duration-150
      ${active ? "bg-[rgba(36,134,219,.1)] border-[rgba(36,134,219,.28)] text-[#2486DB]" : "border-transparent text-[#5A6A7A] hover:bg-[#EEF2F7] hover:text-[#262E36] hover:border-[rgba(36,134,219,.12)]"}`}>
      {icon}
      <span className="absolute -bottom-[34px] left-1/2 -translate-x-1/2 bg-[#262E36] text-white text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">{tip}</span>
    </button>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ S, urgelogs, onNav, onToast }) {
  const [quote, setQuote]   = useState(QUOTES[0]);
  const [mood, setMood]     = useState(null);

  useEffect(() => {
    async function fetchQuote() {
      if (GEMINI_API_KEY) {
        const addStr = (S.addictions||[]).join(", ") || "general addiction";
        const q = `You are a compassionate recovery coach. Write ONE short, powerful insight (1-2 sentences) for someone recovering from ${addStr} addiction on day ${S.streak}. Be warm, specific, science-based. No quote marks. Just the insight.`;
        const t = await gemini(q);
        if (t) setQuote(`"${t}"`);
      } else {
        setQuote(QUOTES[Math.floor(Math.random()*QUOTES.length)]);
      }
    }
    fetchQuote();
  }, []);

  function logMood(m) {
    setMood(m);
    if (S.uid) {
      addDoc(collection(db, "users", S.uid, "moods"), {
        mood: m, timestamp: serverTimestamp()
      }).catch(()=>{});
    }
    onToast("Mood logged: " + m);
  }

  const h     = new Date().getHours();
  const greet = h<12?"Good morning ☀️":h<17?"Good afternoon ⛅":h<21?"Good evening 🌆":"Good night 🌙";
  const next  = nextMilestone(S.streak);
  const prev  = MILESTONES[MILESTONES.indexOf(next)-1] || 0;
  const pct   = prev===next ? 100 : Math.round(((S.streak-prev)/(next-prev))*100);

  let chipStyle = "bg-[rgba(168,213,186,.15)] border-[rgba(168,213,186,.4)] text-[#7ABFA0]";
  let chipText  = "🌱 Just getting started";
  if (S.streak === 0) { chipStyle="bg-[rgba(36,134,219,.1)] border-[rgba(36,134,219,.28)] text-[#2486DB]"; chipText="🌱 Day 1 — a fresh start"; }
  else if (S.streak < 7) chipText = "🔥 Building momentum";
  else if (S.streak < 30) chipText = `⚡ On a roll — ${S.streak} days!`;
  else { chipStyle="bg-[rgba(247,200,115,.18)] border-[rgba(247,200,115,.4)] text-[#6B4E0A]"; chipText=`🏆 Incredible — ${S.streak} days!`; }

  const rate = S.urgesTotal ? Math.round((S.resisted/S.urgesTotal)*100) : 0;

  return (
    <div className="max-w-[960px] mx-auto px-6 py-8 pb-16">
      {/* Greeting */}
      <div className="mb-6">
        <div className="text-[13px] font-medium text-[#959CA3] mb-2">{greet}</div>
        <div className="text-2xl font-bold text-[#262E36]">Welcome back, {S.userName} 👋</div>
      </div>

      {/* Streak hero + mini cards */}
      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-8 max-sm:grid-cols-1">
        {/* Main streak card */}
        <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_4px_16px_rgba(36,134,219,.12)] overflow-hidden relative min-h-[200px]">
          {/* Atmospheric bg */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-80 h-80 rounded-full -top-24 -left-20" style={{background:"radial-gradient(circle,rgba(36,134,219,.08),transparent 60%)"}}/>
            <div className="absolute w-56 h-56 rounded-full -bottom-16 right-12" style={{background:"radial-gradient(circle,rgba(168,213,186,.12),transparent 60%)"}}/>
          </div>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[88px] opacity-[.05] select-none leading-none z-[1]">🔥</div>
          <div className="relative z-[2] p-6">
            <div className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[.07em] uppercase text-[#7ABFA0] mb-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7ABFA0] pulse-slow"/>Current streak
            </div>
            <div className="flex items-baseline gap-2.5 leading-none mb-2">
              <span className="text-[80px] font-black tracking-tighter leading-[.88] text-[#2486DB] max-sm:text-[64px]">{S.streak}</span>
              <span className="text-lg font-semibold text-[#5A6A7A] leading-tight">days<br/>clean</span>
            </div>
            <div className="text-sm text-[#5A6A7A] mb-4">Personal best: <strong className="text-[#F7C873] font-bold">{S.best} days</strong></div>
            <div className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full border mb-4 ${chipStyle}`}>{chipText}</div>
            <div className="h-1.5 bg-[#EEF2F7] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#2486DB] to-[#4ECDC4] transition-all duration-[1s]" style={{width:`${Math.min(pct,100)}%`}}/>
            </div>
            <div className="flex justify-between text-[12px] text-[#959CA3] mt-1.5">
              <span>Day {S.streak}</span>
              <span>{S.streak >= next ? `🏆 ${next}-day milestone!` : `Next milestone: ${next} days`}</span>
            </div>
          </div>
        </div>

        {/* Mini cards */}
        <div className="flex flex-col gap-4 max-sm:flex-row">
          <div className="flex-1 bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] p-6">
            <div className="text-[36px] font-black tracking-tight leading-none text-[#2486DB]">{S.urgesTotal}</div>
            <div className="text-[13px] text-[#5A6A7A] mt-1.5">Urges logged</div>
          </div>
          <div className="flex-1 bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] p-6">
            <div className="text-[36px] font-black tracking-tight leading-none text-[#7ABFA0]">{S.urgesTotal ? rate+"%" : "—"}</div>
            <div className="text-[13px] text-[#5A6A7A] mt-1.5">Resistance rate</div>
          </div>
        </div>
      </div>

      {/* Urge CTA */}
      <div className="mb-8 rounded-2xl border-[1.5px] border-[rgba(229,115,115,.28)] p-6 relative overflow-hidden"
        style={{background:"linear-gradient(135deg,rgba(229,115,115,.12),rgba(247,200,115,.06))"}}>
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none" style={{background:"radial-gradient(circle,rgba(229,115,115,.07),transparent 65%)"}}/>
        <div className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[.07em] uppercase text-[#E57373] mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E57373] pulse"/>Right now
        </div>
        <h3 className="text-xl font-bold text-[#262E36] mb-2 leading-tight">Is something trying to break your streak?</h3>
        <p className="text-[15px] text-[#5A6A7A] leading-relaxed mb-5">You don't have to fight this alone. Log the urge and we'll walk you through it — one gentle step at a time.</p>
        <button onClick={() => onNav("urge")}
          className="flex items-center justify-between w-full h-[52px] px-[22px] bg-[#E57373] text-white rounded-2xl text-base font-bold shadow-[0_4px_18px_rgba(229,115,115,.33)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(229,115,115,.45)] transition-all duration-250">
          <span>I'm feeling an urge right now</span>
          <span className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">→</span>
        </button>
      </div>

      {/* AI Insight */}
      <div className="mb-8">
        <InsightBox icon="✨" label="AI Daily Insight" text={quote}/>
      </div>

      {/* Week calendar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold text-[#262E36]">This week</span>
          <button onClick={() => onNav("analytics")} className="text-[13px] text-[#2486DB] font-semibold hover:underline">View all analytics →</button>
        </div>
        <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] p-6">
          <CalStrip logs={urgelogs} days={7}/>
          <div className="flex gap-3 mt-4 text-[12px] text-[#959CA3] font-medium">
            <span>🟢 Resisted</span><span>🔴 Relapsed</span><span>🔵 Today</span>
          </div>
        </div>
      </div>

      {/* Mood check-in */}
      <div>
        <div className="text-base font-bold text-[#262E36] mb-4">How are you feeling today?</div>
        <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] p-6">
          <p className="text-sm text-[#5A6A7A] mb-4">A quick check-in helps us support you better. There are no wrong answers.</p>
          <div className="flex flex-wrap gap-2">
            {["💪 Strong","😌 Calm","😐 Neutral","😰 Struggling","😡 Frustrated"].map(m => (
              <button key={m} onClick={() => logMood(m)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] text-sm font-medium transition-all duration-150
                  ${mood===m
                    ? "bg-[rgba(36,134,219,.1)] border-[#2486DB] text-[#2486DB] font-semibold"
                    : "border-[rgba(36,134,219,.22)] bg-[#EEF2F7] text-[#5A6A7A] hover:border-[rgba(36,134,219,.28)] hover:text-[#2486DB] hover:bg-[rgba(36,134,219,.1)]"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LOG URGE SCREEN ───────────────────────────────────────────────────────────
function UrgeScreen({ S, onNav, onSubmit, customTypes, onAddType, onToast }) {
  const [urgeType, setUrgeType]   = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger]     = useState(null);
  const [otherText, setOtherText] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [addModal, setAddModal]   = useState(false);
  const [cEmoji, setCEmoji]       = useState("");
  const [cName, setCName]         = useState("");

  const IL_BG    = ["","rgba(168,213,186,.15)","rgba(168,213,186,.15)","rgba(168,213,186,.15)","rgba(36,134,219,.1)","rgba(36,134,219,.1)","rgba(247,200,115,.18)","rgba(247,200,115,.18)","rgba(229,115,115,.12)","rgba(229,115,115,.12)","rgba(229,115,115,.12)"];
  const IL_COLOR = ["","#7ABFA0","#7ABFA0","#7ABFA0","#2486DB","#2486DB","#B07D00","#B07D00","#E57373","#E57373","#E57373"];

  async function submit() {
    if (!urgeType) { onToast("Please let us know what type of urge this is"); return; }
    if (!trigger)  { onToast("Please select what triggered this feeling"); return; }
    if (trigger==="other" && !otherText.trim()) { onToast("Please describe what happened"); return; }
    onSubmit({ urgeType, intensity, trigger, otherText: trigger==="other"?otherText:"" });
  }

  const baseTypes = [
    {v:"porn",icon:"🔞",bg:"rgba(229,115,115,.12)",name:"Pornography"},
    {v:"smoking",icon:"🚬",bg:"rgba(247,200,115,.18)",name:"Smoking / Nicotine"},
    {v:"alcohol",icon:"🍺",bg:"rgba(36,134,219,.1)",name:"Alcohol"},
    {v:"screen",icon:"📱",bg:"rgba(168,213,186,.15)",name:"Screen / Social media"},
    ...customTypes,
  ];

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Btn variant="soft" size="sm" onClick={() => onNav("dashboard")}>← Back</Btn>
        <div className="text-xl font-semibold text-[#262E36]">Log this urge</div>
      </div>

      <div className="mb-8">
        <InsightBox icon="🧠" label="You're doing the right thing" text="Logging an urge instead of acting on it is already a win. Let's understand what's happening and find you the right support."/>
      </div>

      {/* Type */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold text-[#262E36]">What type of urge is this?</span>
          <Btn variant="ghost" size="sm" onClick={() => setAddModal(true)}>+ Add custom</Btn>
        </div>
        <div className="flex flex-col gap-2">
          {baseTypes.map(t => (
            <TaskRow key={t.v} task={{...t,id:t.v,desc:"",dur:0,levels:[]}} selected={urgeType===t.v}
              onSelect={() => setUrgeType(t.v)}/>
          ))}
        </div>
      </div>

      {/* Intensity */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-base font-bold text-[#262E36]">How intense does it feel?</span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[13px] font-semibold"
            style={{background:IL_BG[intensity],color:IL_COLOR[intensity]}}>
            {intensity} / 10 · {IL[intensity]}
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1,2,3,4,5,6,7,8,9,10].map(v => (
            <button key={v} onClick={() => setIntensity(v)}
              className={`flex-1 h-11 rounded-xl border-[1.5px] text-sm font-bold transition-all duration-150
                ${intensity===v && v<=7 ? "bg-[rgba(36,134,219,.1)] border-[#2486DB] text-[#2486DB]"
                  : intensity===v && v>7 ? "bg-[rgba(229,115,115,.12)] border-[#E57373] text-[#E57373]"
                  : v>7 ? "border-[rgba(229,115,115,.28)] bg-[#EEF2F7] text-[#5A6A7A] hover:border-[rgba(229,115,115,.28)]"
                  : "border-[rgba(36,134,219,.22)] bg-[#EEF2F7] text-[#5A6A7A] hover:border-[rgba(36,134,219,.28)]"}`}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[13px] font-medium text-[#959CA3] mt-2">
          <span>Mild — I can manage</span><span>Overwhelming</span>
        </div>
      </div>

      {/* Trigger */}
      <div className="mb-8">
        <div className="text-base font-bold text-[#262E36] mb-4">What triggered this feeling?</div>
        <div className="flex flex-wrap gap-2">
          {["😰 Stress","😑 Boredom","😔 Loneliness","😟 Anxiety","😡 Anger","😢 Sadness","🔄 Habit"].map(t => (
            <button key={t} onClick={() => { setTrigger(t); setShowOther(false); }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] text-sm font-medium transition-all duration-150
                ${trigger===t
                  ? "bg-[rgba(36,134,219,.1)] border-[#2486DB] text-[#2486DB] font-semibold"
                  : "border-[rgba(36,134,219,.22)] bg-[#EEF2F7] text-[#5A6A7A] hover:border-[rgba(36,134,219,.28)] hover:text-[#2486DB]"}`}>
              {t}
            </button>
          ))}
          <button onClick={() => { setTrigger("other"); setShowOther(true); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] text-sm font-medium transition-all duration-150
              ${trigger==="other"
                ? "bg-[rgba(36,134,219,.1)] border-[#2486DB] text-[#2486DB] font-semibold"
                : "border-[rgba(36,134,219,.22)] bg-[#EEF2F7] text-[#5A6A7A] hover:border-[rgba(36,134,219,.28)]"}`}>
            💭 Other
          </button>
        </div>
        {showOther && (
          <div className="mt-4 fade-up">
            <div className="mb-3">
              <InsightBox icon="🧠" label="" text="Describe what happened in your own words. The AI will analyse this over time and surface patterns."/>
            </div>
            <textarea value={otherText} onChange={e=>setOtherText(e.target.value)} rows={3}
              placeholder="e.g. I saw an old photo, felt dismissed in a conversation..."
              className="w-full bg-white border border-[rgba(36,134,219,.22)] rounded-xl px-4 py-3 text-[15px] text-[#262E36] outline-none resize-y leading-relaxed placeholder:text-[#959CA3] focus:border-[#2486DB] focus:shadow-[0_0_0_3px_rgba(36,134,219,.1)]"/>
          </div>
        )}
      </div>

      <Btn variant="green" size="lg" full onClick={submit}>Find me a task →</Btn>

      {/* Add custom modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)}
        title="Add a custom urge type"
        body="Give it a name and emoji. It'll appear in your urge log list."
        actions={<>
          <Btn variant="soft" size="md" onClick={() => setAddModal(false)} className="flex-1">Cancel</Btn>
          <Btn variant="primary" size="md" className="flex-1" onClick={() => {
            if (!cName.trim()) { onToast("Please enter a name"); return; }
            onAddType({ v: cName.toLowerCase().replace(/\s/g,"_"), icon: cEmoji||"❓", bg:"rgba(36,134,219,.05)", name: cName.trim() });
            setCEmoji(""); setCName(""); setAddModal(false);
            onToast((cEmoji||"❓")+" "+cName+" added!");
          }}>Add type</Btn>
        </>}>
        <div className="mb-3">
          <label className="block text-sm font-semibold text-[#262E36] mb-1.5">Emoji icon</label>
          <input value={cEmoji} onChange={e=>setCEmoji(e.target.value)} placeholder="e.g. 🎮" maxLength={4}
            className="w-20 text-center text-2xl bg-white border border-[rgba(36,134,219,.22)] rounded-xl px-3 py-2 outline-none focus:border-[#2486DB]"/>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[#262E36] mb-1.5">Name</label>
          <input value={cName} onChange={e=>setCName(e.target.value)} placeholder="e.g. Gaming, Gambling, Shopping..."
            className="w-full bg-white border border-[rgba(36,134,219,.22)] rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#2486DB]"/>
        </div>
      </Modal>
    </div>
  );
}

// ── TASK PICKER ───────────────────────────────────────────────────────────────
function TaskScreen({ S, urgeCtx, onNav, onStart, onToast }) {
  const [selectedId, setSelectedId] = useState(null);
  const [aiRec, setAiRec] = useState("Based on your intensity and trigger, a breathing exercise will interrupt the urge cycle most effectively right now.");

  const lv  = iLevel(urgeCtx.intensity);
  const rec = ALL_TASKS.filter(t => t.levels.includes(lv));
  const oth = ALL_TASKS.filter(t => !t.levels.includes(lv));

  useEffect(() => {
    if (!selectedId) setSelectedId(rec[0]?.id);
    async function fetchRec() {
      if (GEMINI_API_KEY) {
        const q = `You are a recovery coach. Someone has a ${urgeCtx.urgeType} urge at intensity ${urgeCtx.intensity}/10, triggered by ${urgeCtx.trigger}. Write ONE short compassionate recommendation (2 sentences max) for a ${lv}-intensity recovery task. Be specific and warm. Just the recommendation.`;
        const t = await gemini(q);
        if (t) setAiRec(t);
      }
    }
    fetchRec();
  }, []);

  const selTask = ALL_TASKS.find(t => t.id === selectedId) || rec[0];

  const SecLabel = ({ text, color }) => (
    <div className={`flex items-center gap-1.5 text-[12px] font-bold tracking-[.06em] uppercase mb-2.5`} style={{color}}>
      <span className="w-1.5 h-1.5 rounded-full" style={{background:color}}/>
      {text}
    </div>
  );

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8 pb-16">
      <div className="flex items-center gap-3 mb-8">
        <Btn variant="soft" size="sm" onClick={() => onNav("urge")}>← Back</Btn>
        <div className="text-xl font-semibold text-[#262E36]">Choose your task</div>
      </div>

      <div className="mb-6">
        <InsightBox icon="✨" label="AI Recommendation" text={aiRec}/>
      </div>

      <div className="mb-8">
        <SecLabel text={`Best for ${lv==="low"?"mild":lv==="mid"?"moderate":"intense"} urges`} color="#7ABFA0"/>
        <div className="flex flex-col gap-2">
          {rec.map((t,i) => (
            <TaskRow key={t.id} task={t} selected={selectedId===t.id} topPick={i===0}
              onSelect={() => setSelectedId(t.id)}/>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <SecLabel text="Other helpful options" color="#959CA3"/>
        <div className="flex flex-col gap-2">
          {oth.map(t => (
            <TaskRow key={t.id} task={t} selected={selectedId===t.id}
              onSelect={() => setSelectedId(t.id)}/>
          ))}
        </div>
      </div>

      <Btn variant="green" size="lg" full onClick={() => selTask && onStart(selTask)}>Start task →</Btn>
    </div>
  );
}

// ── TIMER SCREEN ──────────────────────────────────────────────────────────────
function TimerScreen({ task, urgeCtx, onQuit, onDone, onToast }) {
  const [rem, setRem]       = useState(task.dur);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase]   = useState(BREATHE[0]);
  const [msg, setMsg]       = useState("Every second you hold on, the urge loses power. You're choosing differently — that's real strength.");
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const total = task.dur;

  useEffect(() => {
    async function fetchMsg() {
      if (GEMINI_API_KEY) {
        const q = `You are a compassionate recovery coach. Someone is doing "${task.name}" to resist a ${urgeCtx.urgeType} urge at intensity ${urgeCtx.intensity}/10. Write ONE ultra-short encouraging message (1 sentence, max 15 words). Be warm and specific. Just the message.`;
        const t = await gemini(q);
        if (t) setMsg(t);
      }
    }
    fetchMsg();
    timerRef.current = setInterval(() => {
      if (!paused) {
        elapsedRef.current++;
        setRem(r => {
          if (r <= 1) { clearInterval(timerRef.current); onDone(); return 0; }
          return r - 1;
        });
        const e = elapsedRef.current;
        setPhase(task.id==="breathing" ? BREATHE[Math.floor(e/4)%4] : ENCOUR[Math.floor(e/60)%ENCOUR.length]);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (paused) clearInterval(timerRef.current);
    else {
      timerRef.current = setInterval(() => {
        elapsedRef.current++;
        setRem(r => {
          if (r <= 1) { clearInterval(timerRef.current); onDone(); return 0; }
          return r - 1;
        });
        const e = elapsedRef.current;
        setPhase(task.id==="breathing" ? BREATHE[Math.floor(e/4)%4] : ENCOUR[Math.floor(e/60)%ENCOUR.length]);
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [paused]);

  const progress = 603 * (rem / total);

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8">
      <div className="mb-3">
        <Btn variant="soft" size="sm" onClick={onQuit}>✕ Stop task</Btn>
      </div>
      <div className="flex flex-col items-center py-12 pt-6">
        <div className="text-[22px] font-bold text-[#262E36] text-center mb-1.5">{task.name}</div>
        <div className="text-sm text-[#5A6A7A] text-center mb-8">Focus. You're doing something powerful right now.</div>

        <div className="relative mb-8">
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="96" fill="none" stroke="#EEF2F7" strokeWidth="8"/>
            <circle cx="110" cy="110" r="96" fill="none" stroke="#2486DB" strokeWidth="8"
              strokeLinecap="round" strokeDasharray="603" strokeDashoffset={progress}
              style={{transformOrigin:"center",transform:"rotate(-90deg)",transition:"stroke-dashoffset 1s linear"}}/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl mb-1">{task.icon}</div>
            <div className="text-[48px] font-black text-[#262E36] tracking-tighter leading-none">{fmt(rem)}</div>
            <div className="text-[13px] text-[#5A6A7A] mt-1 font-medium">{phase}</div>
          </div>
        </div>

        <div className="w-full mb-8">
          <InsightBox icon="💙" label="Stay with it" text={msg}/>
        </div>

        <div className="flex gap-3 w-full">
          <Btn variant="soft" size="lg" className="flex-1" onClick={() => setPaused(p => !p)}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </Btn>
          <Btn variant="green" size="lg" className="flex-1" onClick={onDone}>✓ Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ── FEEDBACK SCREEN ───────────────────────────────────────────────────────────
function FeedbackScreen({ task, onGone, onStill }) {
  const [note, setNote] = useState("");
  return (
    <div className="max-w-[640px] mx-auto px-6 py-8 flex flex-col items-center" style={{paddingTop:"48px"}}>
      <div className="text-5xl mb-4">🎯</div>
      <div className="text-2xl font-bold text-[#262E36] text-center mb-3">You did it!</div>
      <p className="text-[15px] text-[#5A6A7A] text-center max-w-xs mb-8 leading-relaxed">
        You completed <strong className="text-[#262E36]">{task.name}</strong>. That took real strength. How is the urge feeling now?
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-[480px] mb-8 max-sm:grid-cols-1">
        {[
          { cls:"ok",  ico:"✅", title:"It's gone",     sub:"I feel better now",    fn:()=>onGone(note) },
          { cls:"bad", ico:"😰", title:"Still there",   sub:"I need another task",  fn:onStill },
        ].map(o => (
          <button key={o.cls} onClick={o.fn}
            className={`bg-white border-[1.5px] border-[rgba(36,134,219,.12)] rounded-2xl p-6 text-center cursor-pointer transition-all duration-250 shadow-[0_1px_4px_rgba(36,134,219,.08)]
              hover:-translate-y-[3px] hover:shadow-[0_8px_32px_rgba(36,134,219,.16)]
              ${o.cls==="ok" ? "hover:border-[rgba(168,213,186,.4)] hover:bg-[rgba(168,213,186,.15)]" : "hover:border-[rgba(229,115,115,.28)] hover:bg-[rgba(229,115,115,.12)]"}`}>
            <div className="text-4xl mb-2.5">{o.ico}</div>
            <div className="text-base font-bold text-[#262E36] mb-1">{o.title}</div>
            <div className="text-[13px] text-[#5A6A7A]">{o.sub}</div>
          </button>
        ))}
      </div>

      <div className="w-full max-w-[480px]">
        <label className="block text-sm font-semibold text-[#262E36] mb-1.5">Quick note <span className="text-[#959CA3] font-normal">(optional)</span></label>
        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="What helped? Any insight about this experience..."
          className="w-full bg-white border border-[rgba(36,134,219,.22)] rounded-xl px-4 py-3 text-[15px] text-[#262E36] outline-none resize-y min-h-[88px] leading-relaxed placeholder:text-[#959CA3] focus:border-[#2486DB] focus:shadow-[0_0_0_3px_rgba(36,134,219,.1)]"/>
      </div>
    </div>
  );
}

// ── ANALYTICS SCREEN ──────────────────────────────────────────────────────────
function AnalyticsScreen({ S, urgelogs, onToast, onRelapse }) {
  const [insight, setInsight] = useState("Add your Gemini API key to unlock personalised AI insights based on your real data.");
  const [relapseModal, setRelapseModal] = useState(false);

  // Process urgelogs
  const last7 = new Date(); last7.setDate(last7.getDate()-7);
  const logs7  = urgelogs.filter(l => l.date >= last7);

  const barData = Array(7).fill(0);
  const trigCounts = {Stress:0,Boredom:0,Lonely:0,Anxiety:0,Habit:0,Other:0};
  let relapseCount = 0;

  logs7.forEach(l => {
    const dayIdx = Math.min(6, Math.floor((Date.now()-l.date.getTime())/86400000));
    barData[6-dayIdx]++;
    const trig=(l.trigger||"").toLowerCase();
    if(trig.includes("stress"))   trigCounts.Stress++;
    else if(trig.includes("boredom")) trigCounts.Boredom++;
    else if(trig.includes("lone"))    trigCounts.Lonely++;
    else if(trig.includes("anx"))     trigCounts.Anxiety++;
    else if(trig.includes("habit"))   trigCounts.Habit++;
    else                              trigCounts.Other++;
    if(l.outcome==="relapsed") relapseCount++;
  });

  const totalTrigs = Math.max(Object.values(trigCounts).reduce((a,b)=>a+b,0),1);
  const trigData = [
    {n:"Stress",  p:Math.round(trigCounts.Stress/totalTrigs*100),  c:"#E57373"},
    {n:"Boredom", p:Math.round(trigCounts.Boredom/totalTrigs*100), c:"#B07D00"},
    {n:"Lonely",  p:Math.round(trigCounts.Lonely/totalTrigs*100),  c:"#2486DB"},
    {n:"Anxiety", p:Math.round(trigCounts.Anxiety/totalTrigs*100), c:"#7ABFA0"},
    {n:"Habit",   p:Math.round(trigCounts.Habit/totalTrigs*100),   c:"#959CA3"},
  ];
  const effData = [
    {n:"Breathing",  i:"🫁",p:82},{n:"Exercise",i:"🏃",p:76},
    {n:"Cold shower",i:"🚿",p:71},{n:"Journaling",i:"📝",p:65},{n:"Research",i:"📖",p:58}
  ];
  const max = Math.max(...barData,1);

  useEffect(() => {
    async function fetchInsight() {
      if (GEMINI_API_KEY) {
        const tStr = trigData.map(t=>`${t.n}:${t.p}%`).join(", ");
        const eStr = effData.map(e=>`${e.n}:${e.p}%`).join(", ");
        const q = `You are a recovery analytics coach. streak=${S.streak} days, urges resisted=${S.resisted}, total=${S.urgesTotal}. Top triggers: ${tStr}. Task effectiveness: ${eStr}. Write a personalised, actionable 2-sentence insight and one specific recommendation. Be warm and data-driven. No preamble.`;
        const t = await gemini(q);
        if (t) setInsight(t);
      }
    }
    fetchInsight();
  }, []);

  return (
    <div className="max-w-[960px] mx-auto px-6 py-8 pb-16">
      <div className="mb-6">
        <div className="text-2xl font-bold text-[#262E36] mb-2">Your Progress</div>
        <p className="text-sm text-[#5A6A7A]">A clear picture of your recovery journey over time.</p>
      </div>

      <div className="mb-8">
        <InsightBox icon="🧠" label="Weekly AI Insight" text={insight}/>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-sm:grid-cols-1">
        {[
          {val:S.streak, label:"Current streak",      delta:"↑ Personal record",          delta2:"up",  color:"#7ABFA0"},
          {val:S.best,   label:"Best streak ever",     delta:"Personal record",            delta2:"mid", color:"#262E36"},
          {val:S.resisted,label:"Urges resisted",      delta:`↑ ${S.urgesTotal?Math.round(S.resisted/S.urgesTotal*100):0}% success rate`, delta2:"up", color:"#2486DB"},
          {val:relapseCount,label:"Relapses this week",delta:"↓ See trends below",        delta2:"dn",  color:"#E57373"},
        ].map((s,i) => (
          <div key={i} className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl p-6 shadow-[0_1px_4px_rgba(36,134,219,.08)]">
            <div className="text-[40px] font-black tracking-tight leading-none mb-1" style={{color:s.color}}>{s.val}</div>
            <div className="text-sm text-[#5A6A7A] mb-1.5">{s.label}</div>
            <div className={`text-[13px] font-semibold ${s.delta2==="up"?"text-[#7ABFA0]":s.delta2==="dn"?"text-[#E57373]":"text-[#959CA3]"}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="mb-8 bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(36,134,219,.12)]">
          <div className="text-base font-bold text-[#262E36]">Urge frequency</div>
          <div className="text-[13px] text-[#5A6A7A] mt-0.5">Urges logged each day this week</div>
        </div>
        <div className="p-6">
          <div className="flex items-end gap-2.5 h-[130px] pt-2">
            {barData.map((v,i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[12px] font-semibold text-[#5A6A7A]">{v||""}</span>
                <div className="w-full rounded-t-[6px] min-h-1 transition-all duration-700"
                  style={{height:`${Math.round((v/max)*100)}px`, background:v===Math.max(...barData)&&v>0?"#E57373":"#2486DB"}}/>
                <span className="text-[11px] text-[#959CA3] font-medium">{DAYS_OF_WEEK[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Triggers + Effectiveness */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-sm:grid-cols-1">
        <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(36,134,219,.12)] text-base font-bold text-[#262E36]">Top triggers</div>
          <div className="p-6">
            {trigData.map(t => (
              <div key={t.n} className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[13px] text-[#5A6A7A] w-[76px] shrink-0 font-medium">{t.n}</span>
                <div className="flex-1 h-2 bg-[#EEF2F7] rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-700" style={{width:`${t.p}%`,background:t.c}}/>
                </div>
                <span className="text-[12px] font-bold text-[#5A6A7A] w-8 text-right shrink-0">{t.p}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(36,134,219,.12)] text-base font-bold text-[#262E36]">Task effectiveness</div>
          <div className="p-6">
            {effData.map(e => (
              <div key={e.n} className="flex items-center gap-2.5 mb-3">
                <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[.9rem] bg-[#EEF2F7] shrink-0">{e.i}</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[#262E36] mb-1">{e.n}</div>
                  <div className="h-1.5 bg-[#EEF2F7] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#2486DB] transition-all duration-700" style={{width:`${e.p}%`}}/>
                  </div>
                </div>
                <span className="text-[13px] font-bold text-[#5A6A7A] w-8 text-right shrink-0">{e.p}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 14-day calendar */}
      <div className="mb-8 bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[rgba(36,134,219,.12)]">
          <div className="text-base font-bold text-[#262E36]">Last 14 days</div>
          <div className="text-[13px] text-[#5A6A7A] mt-0.5">Green = resisted · Red = relapsed</div>
        </div>
        <div className="p-6"><CalStrip logs={urgelogs} days={14}/></div>
      </div>

      {/* Relapse card */}
      <div className="bg-white border-[1.5px] border-[rgba(229,115,115,.28)] rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-[#E57373] text-[15px] mb-2">Had a relapse?</div>
            <p className="text-sm text-[#5A6A7A]">Logging it resets your streak, but your personal best stays. It helps the AI build a better plan for you.</p>
          </div>
          <Btn variant="danger" size="md" className="shrink-0 ml-6" onClick={() => setRelapseModal(true)}>Log relapse</Btn>
        </div>
      </div>

      <Modal open={relapseModal} onClose={() => setRelapseModal(false)}
        title="Log a relapse"
        body="It takes courage to acknowledge this. Your streak resets to zero, but your personal best stays. The AI uses this to build a better plan — you're not starting over, you're learning."
        actions={<>
          <Btn variant="soft" size="md" className="flex-1" onClick={() => setRelapseModal(false)}>Not yet</Btn>
          <Btn variant="danger" size="md" className="flex-1" onClick={() => { setRelapseModal(false); onRelapse(); }}>Yes, log it</Btn>
        </>}/>
    </div>
  );
}

// ── PROFILE SCREEN ────────────────────────────────────────────────────────────
function ProfileScreen({ S, dark, onToggleDark, onLogout, onToast }) {
  const [resetModal, setResetModal] = useState(false);
  const labelMap = { porn:"🔞 Pornography", smoking:"🚬 Smoking", alcohol:"🍺 Alcohol", screen:"📱 Screen" };

  return (
    <div className="max-w-[960px] mx-auto px-6 py-8 pb-16">
      <div className="text-2xl font-bold text-[#262E36] mb-8">Profile & Settings</div>

      <div className="grid grid-cols-[260px_1fr] gap-6 max-sm:grid-cols-1">
        {/* Left column */}
        <div>
          <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl p-6 text-center shadow-[0_1px_4px_rgba(36,134,219,.08)] mb-4">
            <div className="w-[72px] h-[72px] rounded-full mx-auto mb-4 bg-gradient-to-br from-[#2486DB] to-[#4ECDC4] flex items-center justify-center text-[2rem] shadow-[0_4px_16px_rgba(36,134,219,.2)]">🌿</div>
            <div className="text-xl font-bold text-[#262E36] mb-0.5">{S.userName}</div>
            <div className="text-[13px] text-[#5A6A7A] mt-1 mb-3">{S.email}</div>
            <Badge variant="green">🔥 {S.streak} day streak</Badge>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="bg-[#EEF2F7] rounded-xl p-3 text-center">
                <div className="text-[24px] font-black text-[#2486DB]">{S.resisted}</div>
                <div className="text-[12px] text-[#5A6A7A] mt-0.5">Resisted</div>
              </div>
              <div className="bg-[#EEF2F7] rounded-xl p-3 text-center">
                <div className="text-[24px] font-black text-[#5A6A7A]">{S.urgesTotal}</div>
                <div className="text-[12px] text-[#5A6A7A] mt-0.5">Total urges</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl p-6 shadow-[0_1px_4px_rgba(36,134,219,.08)]">
            <div className="text-sm font-semibold text-[#262E36] mb-3">Tracking</div>
            <div className="flex flex-wrap gap-2">
              {S.addictions.length
                ? S.addictions.map(a => (
                    <span key={a} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-[1.5px] text-sm font-medium bg-[rgba(168,213,186,.15)] border-[rgba(168,213,186,.4)] text-[#7ABFA0]">
                      {labelMap[a]||a}
                    </span>
                  ))
                : <span className="text-sm text-[#959CA3]">Complete onboarding to see this</span>}
            </div>
          </div>
        </div>

        {/* Settings */}
        <div>
          <div className="bg-white border border-[rgba(36,134,219,.12)] rounded-2xl shadow-[0_1px_4px_rgba(36,134,219,.08)] overflow-hidden">
            {[
              { group:"Appearance", rows:[
                { icon:"🌙", iconBg:"rgba(36,134,219,.1)", name:"Dark mode", desc:"Switch between light and dark themes",
                  action:<Toggle checked={dark} onChange={e=>onToggleDark()}/> },
              ]},
              { group:"Notifications", rows:[
                { icon:"🔔", iconBg:"rgba(247,200,115,.18)", name:"Daily check-in reminder", desc:"A gentle nudge at noon every day", action:<Toggle checked={true} onChange={()=>{}}/> },
                { icon:"📊", iconBg:"rgba(168,213,186,.15)", name:"Weekly AI report", desc:"Insights every Sunday morning", action:<Toggle checked={true} onChange={()=>{}}/> },
              ]},
              { group:"AI", rows:[
                { icon:"✨", iconBg:"rgba(36,134,219,.1)", name:"AI encouragement during tasks", desc:"Gemini-powered support while you focus", action:<Toggle checked={true} onChange={()=>{}}/> },
                { icon:"🔑", iconBg:"rgba(36,134,219,.1)", name:"Gemini API key", desc:"Connect your own key for AI features", action:<Btn variant="ghost" size="sm" onClick={()=>onToast("Configure via Vite env vars")}>Configure</Btn> },
              ]},
              { group:"Data & Privacy", rows:[
                { icon:"📤", iconBg:"rgba(36,134,219,.1)", name:"Export my data", desc:"Download everything as a file", action:<Btn variant="soft" size="sm" onClick={()=>onToast("Export coming soon!")}>Export</Btn> },
                { icon:"🗑️", iconBg:"rgba(229,115,115,.12)", name:"Reset all data", desc:"This cannot be undone",
                  action:<Btn variant="soft" size="sm" className="!text-[#E57373]" onClick={()=>setResetModal(true)}>Reset</Btn> },
              ]},
            ].map(g => (
              <div key={g.group}>
                <div className="px-6 py-2.5 text-[12px] font-bold tracking-[.05em] uppercase text-[#959CA3] bg-[#EEF2F7] border-b border-[rgba(36,134,219,.12)]">{g.group}</div>
                {g.rows.map(r => (
                  <div key={r.name} className="flex items-center gap-4 px-6 py-4 border-b border-[rgba(36,134,219,.12)] last:border-b-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{background:r.iconBg}}>{r.icon}</div>
                    <div className="flex-1">
                      <div className="text-[15px] font-medium text-[#262E36]">{r.name}</div>
                      <div className="text-[13px] text-[#5A6A7A] mt-0.5">{r.desc}</div>
                    </div>
                    {r.action}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Btn variant="soft" size="md" full className="mt-4 !text-[#E57373] !border-[rgba(229,115,115,.28)]" onClick={onLogout}>Sign out</Btn>
          <p className="text-sm text-[#959CA3] text-center mt-4">Clarity v1.0 · Firebase + Gemini integrated</p>
        </div>
      </div>

      <Modal open={resetModal} onClose={() => setResetModal(false)}
        title="Reset all data?"
        body="This will permanently remove all your streaks, urge logs, and settings. You can try again tomorrow — but this action cannot be undone."
        actions={<>
          <Btn variant="soft" size="md" className="flex-1" onClick={() => setResetModal(false)}>Keep my data</Btn>
          <Btn variant="danger" size="md" className="flex-1" onClick={() => { setResetModal(false); onToast("Full reset coming with Firebase"); }}>Reset everything</Btn>
        </>}/>
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState("loading");
  const [dark, setDark]       = useState(false);
  const [toast, setToastMsg]  = useState("");
  const [loadMsg, setLoadMsg] = useState("Loading your journey...");

  // User state
  const [S, setS] = useState({
    uid: null, userName: "Champion", email: "", addictions: [],
    streak: 0, best: 0, urgesTotal: 0, resisted: 0, tasksDone: 0,
    lastRelapseDate: null,
  });

  // Flow state
  const [urgeCtx, setUrgeCtx]     = useState({ urgeType:null, intensity:5, trigger:null, otherText:"" });
  const [currentTask, setCurrentTask] = useState(ALL_TASKS[0]);
  const [customTypes, setCustomTypes] = useState([]);
  const [urgelogs, setUrgelogs]   = useState([]);
  const [currentLogId, setCurrentLogId] = useState(null);
  const prevScreen = useRef(null);
  const toastTimer = useRef(null);

  // Inject global CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem("clarity-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme:dark)").matches;
    const isDark = saved ? saved==="dark" : prefersDark;
    setDark(isDark);
  }, []);

  function showToast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }

  function toggleDark() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("clarity-theme", next?"dark":"light");
    if (S.uid) saveUser(S.uid, { theme: next?"dark":"light" }).catch(()=>{});
  }

  function go(id) {
    prevScreen.current = screen;
    setScreen(id);
    window.scrollTo(0,0);
  }

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        setLoadMsg("Loading your data...");
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (!snap.exists()) {
            setS(s=>({...s,uid:user.uid,userName:user.displayName||"Champion",email:user.email}));
            setScreen("onboarding");
            return;
          }
          const d = snap.data();
          let streak = d.streak || 0;
          if (d.lastRelapseDate) {
            const days = Math.floor((Date.now()-d.lastRelapseDate.toDate().getTime())/86400000);
            streak = Math.max(days,0);
          }
          setS({
            uid: user.uid, userName: d.name||user.displayName||"Champion",
            email: user.email||"", addictions: d.addictions||[],
            streak, best: d.bestStreak||0,
            urgesTotal: d.urgesTotal||0, resisted: d.resisted||0,
            tasksDone: d.tasksDone||0,
            lastRelapseDate: d.lastRelapseDate?.toDate()||null,
          });
          if (d.theme) setDark(d.theme==="dark");
          // Load urge logs
          await loadUrgelogs(user.uid);
          setScreen(d.onboardingComplete ? "dashboard" : "onboarding");
        } catch(e) {
          console.error(e);
          setScreen("onboarding");
        }
      } else {
        setScreen("auth");
      }
    });
    return () => unsub();
  }, []);

  async function loadUrgelogs(uid) {
    try {
      const since = new Date(); since.setDate(since.getDate()-14); since.setHours(0,0,0,0);
      const q = query(
        collection(db,"users",uid,"urgelogs"),
        where("timestamp",">=",Timestamp.fromDate(since)),
        orderBy("timestamp","desc")
      );
      const snap = await getDocs(q);
      setUrgelogs(snap.docs.map(d => ({
        id: d.id,
        date: d.data().timestamp.toDate(),
        outcome: d.data().outcome,
        trigger: d.data().trigger,
        urgeType: d.data().urgeType,
        taskUsed: d.data().taskUsed,
      })));
    } catch(e) { console.log("urgelogs fetch:", e); }
  }

  async function handleLogout() {
    await signOut(auth);
    setS({ uid:null,userName:"Champion",email:"",addictions:[],streak:0,best:0,urgesTotal:0,resisted:0,tasksDone:0,lastRelapseDate:null });
    setScreen("auth");
    showToast("You've been logged out.");
  }

  async function handleUrgeSubmit(ctx) {
    setUrgeCtx(ctx);
    let logId = null;
    if (S.uid) {
      try {
        const ref = await addDoc(collection(db,"users",S.uid,"urgelogs"), {
          timestamp: serverTimestamp(), urgeType: ctx.urgeType,
          intensity: ctx.intensity, trigger: ctx.trigger,
          triggerText: ctx.trigger==="other"?ctx.otherText:"",
          outcome: "pending", taskUsed: null,
        });
        logId = ref.id;
        setCurrentLogId(logId);
        await saveUser(S.uid, { urgesTotal: increment(1) });
        setS(s=>({...s, urgesTotal:s.urgesTotal+1}));
      } catch(e) { console.error(e); }
    }
    go("task");
  }

  async function handleStartTask(task) {
    setCurrentTask(task);
    if (S.uid && currentLogId) {
      await updateDoc(doc(db,"users",S.uid,"urgelogs",currentLogId), { taskUsed: task.id }).catch(()=>{});
    }
    go("timer");
  }

  async function handleUrgeGone(note) {
    const newResisted = S.resisted + 1;
    setS(s=>({...s, resisted: newResisted}));
    if (S.uid) {
      await saveUser(S.uid, { resisted: increment(1) }).catch(()=>{});
      if (currentLogId) {
        await updateDoc(doc(db,"users",S.uid,"urgelogs",currentLogId), {
          outcome:"resisted", feedbackNote: note||""
        }).catch(()=>{});
      }
    }
    setCurrentLogId(null);
    await loadUrgelogs(S.uid);
    showToast("Wonderful — urge resisted! 🎉");
    go("dashboard");
  }

  async function handleUrgeStill() {
    if (S.uid && currentLogId) {
      await updateDoc(doc(db,"users",S.uid,"urgelogs",currentLogId), { outcome:"still_there" }).catch(()=>{});
    }
    showToast("That's okay — let's try a different approach");
    go("task");
  }

  async function handleRelapse() {
    const newBest = Math.max(S.streak, S.best);
    const now = new Date();
    setS(s=>({...s, streak:0, best:newBest, lastRelapseDate:now}));
    if (S.uid) {
      await saveUser(S.uid, {
        streak:0, bestStreak:newBest,
        lastRelapseDate: Timestamp.fromDate(now),
      }).catch(()=>{});
      await addDoc(collection(db,"users",S.uid,"urgelogs"), {
        timestamp: serverTimestamp(), urgeType:"relapse",
        outcome:"relapsed", intensity:10,
      }).catch(()=>{});
      await loadUrgelogs(S.uid);
    }
    showToast("Logged. You can try again tomorrow 💙");
    go("dashboard");
  }

  function handleOnboardingDone({ addictions, streak, best, lastRelapseDate }) {
    setS(s=>({...s, addictions, streak, best, lastRelapseDate}));
    go("dashboard");
  }

  const isApp = !["auth","onboarding","loading"].includes(screen);

  if (screen === "loading") return <LoadingOverlay msg={loadMsg}/>;

  return (
    <div className={`font-['Commissioner',sans-serif] bg-[#F5F7FA] min-h-screen`} style={{fontFamily:"Commissioner,sans-serif"}}>
      <Toast msg={toast}/>

      {screen !== "auth" && screen !== "onboarding" && (
        <Navbar screen={screen} streak={S.streak} dark={dark}
          onToggleDark={toggleDark} onNav={go}/>
      )}

      <div className={screen==="auth"||screen==="onboarding" ? "" : "min-h-[calc(100vh-64px)]"}>
        {screen==="auth"       && <AuthScreen onNav={go} onToast={showToast}/>}
        {screen==="onboarding" && <OnboardingScreen S={S} onDone={handleOnboardingDone} onToast={showToast}/>}
        {screen==="dashboard"  && <Dashboard S={S} urgelogs={urgelogs} onNav={go} onToast={showToast}/>}
        {screen==="urge"       && <UrgeScreen S={S} onNav={go} onSubmit={handleUrgeSubmit} customTypes={customTypes}
          onAddType={t=>setCustomTypes(c=>[...c,t])} onToast={showToast}/>}
        {screen==="task"       && <TaskScreen S={S} urgeCtx={urgeCtx} onNav={go} onStart={handleStartTask} onToast={showToast}/>}
        {screen==="timer"      && <TimerScreen task={currentTask} urgeCtx={urgeCtx}
          onQuit={()=>go("task")} onDone={()=>go("feedback")} onToast={showToast}/>}
        {screen==="feedback"   && <FeedbackScreen task={currentTask} onGone={handleUrgeGone} onStill={handleUrgeStill}/>}
        {screen==="analytics"  && <AnalyticsScreen S={S} urgelogs={urgelogs} onToast={showToast} onRelapse={handleRelapse}/>}
        {screen==="profile"    && <ProfileScreen S={S} dark={dark} onToggleDark={toggleDark} onLogout={handleLogout} onToast={showToast}/>}
      </div>
    </div>
  );
}