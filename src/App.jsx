import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
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
} from "firebase/firestore";

// ─── Firebase config from Vite env vars ───────────────────────
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

// ─── Constants ─────────────────────────────────────────────────
const STREAK_MAP = { today: 0, "1d": 1, "3d": 3, "1w": 7, "1m": 30 };
const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];
const QUOTES = [
  "Every urge you resist rewires your brain toward freedom. You are changing at the cellular level.",
  "The urge will pass. It always does. Hold on for just 10 more minutes.",
  "You are not your addiction. You are the person who wakes up every morning and chooses to fight it.",
  "Recovery is not a straight line. Every day you try is a day that counts.",
  "Your brain is plastic. Every choice you make today is reshaping who you are tomorrow.",
];
const ALL_TASKS = [
  { id: "breathing",   name: "Box Breathing",             dur: 300,  icon: "🫁", desc: "Inhale 4s · hold 4s · exhale 4s · repeat",     bg: "rgba(36,134,219,.1)",   levels: ["low","mid","high"] },
  { id: "grounding",   name: "5-4-3-2-1 Grounding",       dur: 180,  icon: "🧘", desc: "Name 5 things you see, 4 you touch...",          bg: "rgba(78,205,196,.1)",   levels: ["low","mid"] },
  { id: "music",       name: "Listen to Calming Music",    dur: 600,  icon: "🎵", desc: "Focus only on the sound — nothing else",         bg: "rgba(247,200,115,.15)", levels: ["low","mid"] },
  { id: "prayer",      name: "Prayer / Reflection",        dur: 300,  icon: "🙏", desc: "Quiet prayer or a reflective moment",            bg: "rgba(247,200,115,.12)", levels: ["low","mid"] },
  { id: "tea",         name: "Make & Drink Herbal Tea",    dur: 600,  icon: "🍵", desc: "A slow, warm ritual that resets the mind",       bg: "rgba(168,213,186,.15)", levels: ["low","mid"] },
  { id: "exercise",    name: "Physical Exercise",          dur: 900,  icon: "🏃", desc: "Pushups, burpees, jumping jacks — go hard",      bg: "rgba(168,213,186,.15)", levels: ["mid","high"] },
  { id: "walk",        name: "Go for a Walk Outside",      dur: 900,  icon: "🚶", desc: "Change your environment and breathe fresh air",   bg: "rgba(168,213,186,.12)", levels: ["low","mid","high"] },
  { id: "shower",      name: "Cold Shower",                dur: 300,  icon: "🚿", desc: "Cold water resets your nervous system fast",     bg: "rgba(36,134,219,.1)",   levels: ["mid","high"] },
  { id: "stretching",  name: "Full-body Stretching",       dur: 600,  icon: "🤸", desc: "Stretch every muscle group, slow and deep",      bg: "rgba(36,134,219,.08)",  levels: ["low","mid"] },
  { id: "cleaning",    name: "Clean or Organise a Space",  dur: 900,  icon: "🧹", desc: "Physical action with a clear, immediate result", bg: "rgba(247,200,115,.15)", levels: ["mid","high"] },
  { id: "journal",     name: "Journaling",                 dur: 600,  icon: "📝", desc: "Write what you're feeling without filtering",    bg: "rgba(247,200,115,.15)", levels: ["low","mid","high"] },
  { id: "gratitude",   name: "Gratitude List",             dur: 300,  icon: "💛", desc: "Write 5 things you're genuinely grateful for",   bg: "rgba(247,200,115,.12)", levels: ["low","mid"] },
  { id: "call",        name: "Call Someone You Trust",     dur: 600,  icon: "📞", desc: "Connection breaks isolation. Reach out now.",    bg: "rgba(168,213,186,.15)", levels: ["mid","high"] },
  { id: "affirmations",name: "Read Your Affirmations",     dur: 180,  icon: "✨", desc: "Remind yourself who you are and why you fight",  bg: "rgba(36,134,219,.1)",   levels: ["low","mid"] },
  { id: "breathwork2", name: "Wim Hof Breathwork",         dur: 480,  icon: "💨", desc: "Powerful breathing technique for mental reset",   bg: "rgba(36,134,219,.1)",   levels: ["mid","high"] },
  { id: "research",    name: "Read about Recovery",        dur: 600,  icon: "📖", desc: "Science of addiction, dopamine and healing",     bg: "rgba(229,115,115,.08)", levels: ["low","mid"] },
  { id: "puzzle",      name: "Solve a Puzzle or Sudoku",   dur: 600,  icon: "🧩", desc: "Engage your prefrontal cortex on something hard",bg: "rgba(36,134,219,.07)",  levels: ["low","mid"] },
  { id: "cook",        name: "Cook or Prepare Food",       dur: 900,  icon: "🍳", desc: "Hands-on task that demands full attention",      bg: "rgba(247,200,115,.15)", levels: ["mid","high"] },
  { id: "draw",        name: "Sketch or Doodle",           dur: 600,  icon: "✏️", desc: "No skill needed — just put pen to paper",        bg: "rgba(229,115,115,.06)", levels: ["low","mid"] },
  { id: "memorise",    name: "Memorise Something",         dur: 600,  icon: "🧠", desc: "A quote, poem, or passage — focus the mind",     bg: "rgba(36,134,219,.07)",  levels: ["low","mid"] },
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
const DN = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function iLevel(v) { return v <= 3 ? "low" : v <= 7 ? "mid" : "high"; }
function nextMilestone(d) { return MILESTONES.find(m => m > d) || MILESTONES[MILESTONES.length - 1]; }
function fmt(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }

// ─── Gemini helper ─────────────────────────────────────────────
async function gemini(prompt) {
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

// ─── CSS Variables injected once ───────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Commissioner:wght@300;400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;-webkit-font-smoothing:antialiased}
body{font-family:'Commissioner',sans-serif;min-height:100vh;transition:background .25s,color .25s}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(36,134,219,.28);border-radius:2px}

:root{
  --blue:#2486DB;--blue-d:#1E6DB8;--blue-bg:rgba(36,134,219,.10);--blue-bd:rgba(36,134,219,.28);--blue-glow:rgba(36,134,219,.20);
  --navy:#262E36;--green:#A8D5BA;--green-d:#7ABFA0;--green-bg:rgba(168,213,186,.15);--green-bd:rgba(168,213,186,.4);
  --amber:#F7C873;--amber-bg:rgba(247,200,115,.18);--amber-bd:rgba(247,200,115,.4);
  --rose:#E57373;--rose-bg:rgba(229,115,115,.12);--rose-bd:rgba(229,115,115,.28);
  --teal:#4ECDC4;--teal-bg:rgba(78,205,196,.12);--gray-mid:#959CA3;
}
[data-theme="light"]{--bg:#F5F7FA;--bg2:#FFFFFF;--bg3:#EEF2F7;--bg4:#E0E7F0;--card:#FFFFFF;--brd:rgba(36,134,219,.12);--brd2:rgba(36,134,219,.22);--t1:#262E36;--t2:#5A6A7A;--t3:#959CA3;--sh:0 1px 4px rgba(36,134,219,.08),0 2px 8px rgba(0,0,0,.05);--sh-md:0 4px 16px rgba(36,134,219,.12),0 2px 6px rgba(0,0,0,.05);--sh-lg:0 8px 32px rgba(36,134,219,.16),0 4px 12px rgba(0,0,0,.06)}
[data-theme="dark"]{--bg:#181E27;--bg2:#232D3A;--bg3:#2D3A4A;--bg4:#3A4A5C;--card:#232D3A;--brd:rgba(36,134,219,.13);--brd2:rgba(36,134,219,.24);--t1:#EDF2F7;--t2:#9AACBC;--t3:#64788C;--sh:0 2px 8px rgba(0,0,0,.35);--sh-md:0 4px 20px rgba(0,0,0,.45);--sh-lg:0 8px 32px rgba(0,0,0,.55)}

@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes puls{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.65)}}
@keyframes loadbar{0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%}}
@keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}

.screen-enter{animation:fadeUp .35s cubic-bezier(.22,1,.36,1) both}
.pulse-dot{animation:puls 1.6s ease-in-out infinite}
.streak-dot{animation:puls 2s ease-in-out infinite}
.loadbar-anim{animation:loadbar 1.4s ease-in-out infinite}
`;

// ─── Reusable UI primitives ────────────────────────────────────

function Card({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: "var(--card)", border: "1px solid var(--brd)", boxShadow: "var(--sh)", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid var(--brd)" }}>
      <div>
        <div className="font-bold" style={{ color: "var(--t1)", fontSize: 16 }}>{title}</div>
        {subtitle && <div className="text-sm mt-0.5" style={{ color: "var(--t2)" }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

function Btn({ children, variant = "primary", size = "md", full = false, className = "", style = {}, ...props }) {
  const sizes = { sm: "h-8 px-3.5 text-sm rounded-lg", md: "h-10 px-5 text-[15px] rounded-xl", lg: "h-12 px-7 text-base rounded-2xl" };
  const variants = {
    primary: { background: "var(--blue)", color: "#fff", boxShadow: "0 2px 10px var(--blue-glow)" },
    green:   { background: "var(--green-d)", color: "#fff", boxShadow: "0 2px 10px rgba(122,191,160,.3)" },
    danger:  { background: "var(--rose)", color: "#fff", boxShadow: "0 4px 18px rgba(229,115,115,.32)" },
    soft:    { background: "var(--bg3)", color: "var(--t2)", border: "1.5px solid var(--brd)" },
    ghost:   { background: "transparent", color: "var(--blue)", border: "1.5px solid var(--blue-bd)" },
  };
  return (
    <button className={`inline-flex items-center justify-center gap-2 font-semibold cursor-pointer transition-all duration-150 ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
      style={{ border: "none", ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  );
}

function InsightBox({ icon, label, text }) {
  return (
    <div className="flex gap-4 p-4 rounded-2xl" style={{ background: "var(--blue-bg)", border: "1px solid var(--blue-bd)" }}>
      <div className="text-2xl flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--blue)" }}>{label}</div>
        <div className="text-sm leading-relaxed" style={{ color: "var(--t2)" }}>{text}</div>
      </div>
    </div>
  );
}

function TaskRow({ task, selected, onSelect, topPick }) {
  return (
    <button onClick={onSelect}
      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-150 cursor-pointer"
      style={{
        background: selected ? "var(--blue-bg)" : "var(--bg)",
        border: selected ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
        marginBottom: 8,
      }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: task.bg }}>{task.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: "var(--t1)" }}>{task.name}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--t2)" }}>{Math.floor(task.dur / 60)} min · {task.desc}</div>
      </div>
      {topPick && (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: "var(--green-bg)", color: "var(--green-d)", border: "1px solid var(--green-bd)" }}>
          ✦ Top pick
        </span>
      )}
    </button>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" style={{ width: 44, height: 24 }}>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div className="w-full h-full rounded-full transition-all duration-200"
        style={{ background: checked ? "var(--blue)" : "var(--bg4)" }} />
      <div className="absolute w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
        style={{ left: checked ? 22 : 2, top: 2 }} />
    </label>
  );
}

// ─── Toast ─────────────────────────────────────────────────────
function Toast({ msg, visible }) {
  if (!visible && !msg) return null;
  return (
    <div className="fixed bottom-8 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl"
      style={{
        transform: "translateX(-50%)",
        background: "var(--navy)",
        animation: visible ? "toastIn .25s ease both" : "none",
        opacity: visible ? 1 : 0,
        transition: "opacity .3s",
        pointerEvents: "none",
        maxWidth: "90vw",
        whiteSpace: "nowrap",
      }}>
      {msg}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────
function Modal({ open, onClose, title, body, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl screen-enter"
        style={{ background: "var(--card)", border: "1px solid var(--brd2)" }}>
        <div className="text-lg font-bold mb-2" style={{ color: "var(--t1)" }}>{title}</div>
        <div className="text-sm leading-relaxed mb-6" style={{ color: "var(--t2)" }}>{body}</div>
        <div className="flex gap-3">{actions}</div>
      </div>
    </div>
  );
}

// ─── Loading Overlay ───────────────────────────────────────────
function LoadingOverlay({ msg }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "var(--bg)" }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
        style={{ background: "linear-gradient(135deg,var(--blue),var(--teal))", boxShadow: "0 4px 20px var(--blue-glow)" }}>
        🌿
      </div>
      <div className="text-2xl font-black mb-2" style={{ color: "var(--blue)" }}>Clarity</div>
      <div className="text-sm mb-5" style={{ color: "var(--t3)" }}>{msg}</div>
      <div className="w-32 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg3)" }}>
        <div className="h-full rounded-full loadbar-anim" style={{ background: "var(--blue)" }} />
      </div>
    </div>
  );
}

// ─── Navbar ────────────────────────────────────────────────────
function Navbar({ screen, streak, onNav, onTheme, theme }) {
  const showApp = !["auth", "onboarding"].includes(screen);
  return (
    <nav className="sticky top-0 z-40 h-16 flex items-center px-6"
      style={{ background: "var(--bg2)", borderBottom: "1px solid var(--brd)", boxShadow: "var(--sh)" }}>
      <button onClick={() => onNav("dashboard")}
        className="flex items-center gap-2.5 flex-shrink-0 transition-opacity hover:opacity-80">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
          style={{ background: "linear-gradient(135deg,var(--blue),var(--teal))", boxShadow: "0 2px 10px var(--blue-glow)" }}>
          🌿
        </div>
        <span className="text-xl font-black" style={{ color: "var(--blue)", letterSpacing: "-.01em" }}>Clarity</span>
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {showApp && (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold"
            style={{ background: "var(--green-bg)", border: "1px solid var(--green-bd)", color: "var(--green-d)" }}>
            🔥 {streak} days
          </div>
        )}
        <button onClick={onTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 text-base"
          style={{ color: "var(--t2)", border: "1.5px solid transparent" }}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        {showApp && (
          <>
            <button onClick={() => onNav("analytics")}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all duration-150"
              style={{
                background: screen === "analytics" ? "var(--blue-bg)" : "transparent",
                border: screen === "analytics" ? "1.5px solid var(--blue-bd)" : "1.5px solid transparent",
                color: screen === "analytics" ? "var(--blue)" : "var(--t2)"
              }}>📊</button>
            <button onClick={() => onNav("profile")}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all duration-150"
              style={{
                background: screen === "profile" ? "var(--blue-bg)" : "transparent",
                border: screen === "profile" ? "1.5px solid var(--blue-bd)" : "1.5px solid transparent",
                color: screen === "profile" ? "var(--blue)" : "var(--t2)"
              }}>👤</button>
          </>
        )}
      </div>
    </nav>
  );
}

// ─── Auth Screen ───────────────────────────────────────────────
function AuthScreen({ onDone }) {
  const [tab, setTab] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const fbErr = code => ({
    "auth/email-already-in-use": "This email is already registered. Try logging in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
  }[code] || "Something went wrong. Please try again.");

  async function doSignUp() {
    setErr(""); if (!name) { setErr("Please enter your name."); return; }
    if (!email) { setErr("Please enter your email."); return; }
    if (!pass || pass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "users", cred.user.uid), {
        name, email, streak: 0, bestStreak: 0, urgesTotal: 0,
        resisted: 0, tasksDone: 0, onboardingComplete: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) { setErr(fbErr(e.code)); setLoading(false); }
  }

  async function doLogin() {
    setErr(""); if (!email) { setErr("Please enter your email."); return; }
    if (!pass) { setErr("Please enter your password."); return; }
    setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, pass); }
    catch (e) { setErr(fbErr(e.code)); setLoading(false); }
  }

  async function doGoogle() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          name: cred.user.displayName || "Champion", email: cred.user.email,
          streak: 0, bestStreak: 0, urgesTotal: 0, resisted: 0, tasksDone: 0,
          onboardingComplete: false, createdAt: serverTimestamp(),
        });
      }
    } catch (e) { setErr(fbErr(e.code)); setLoading(false); }
  }

  async function doReset() {
    if (!email) { setErr("Enter your email above first, then click Forgot password."); return; }
    try { await sendPasswordResetEmail(auth, email); setErr("Password reset email sent — check your inbox."); }
    catch (e) { setErr(fbErr(e.code)); }
  }

  const inp = "w-full h-12 px-4 rounded-xl text-sm font-medium outline-none transition-all duration-150 mb-4";
  const inpStyle = { background: "var(--bg3)", border: "1.5px solid var(--brd)", color: "var(--t1)", fontFamily: "inherit" };
  const inpFocus = e => { e.target.style.borderColor = "var(--blue)"; e.target.style.boxShadow = "0 0 0 3px var(--blue-bg)"; };
  const inpBlur  = e => { e.target.style.borderColor = "var(--brd)"; e.target.style.boxShadow = "none"; };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-[420px] screen-enter">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
            style={{ background: "linear-gradient(135deg,var(--blue),var(--teal))", boxShadow: "0 4px 20px var(--blue-glow)" }}>
            🌿
          </div>
          <div className="text-3xl font-black tracking-tight" style={{ color: "var(--blue)" }}>Clarity</div>
          <div className="text-sm mt-1" style={{ color: "var(--t2)" }}>Your private recovery companion</div>
        </div>

        {/* Tab switcher */}
        <div className="flex p-1 rounded-full mb-6" style={{ background: "var(--bg3)" }}>
          {["signup","login"].map(t => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }}
              className="flex-1 h-10 rounded-full text-sm font-bold transition-all duration-150"
              style={{
                background: tab === t ? "var(--card)" : "transparent",
                color: tab === t ? "var(--t1)" : "var(--t2)",
                boxShadow: tab === t ? "var(--sh)" : "none",
                border: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}>
              {t === "signup" ? "Create account" : "Log in"}
            </button>
          ))}
        </div>

        {err && <div className="text-sm mb-4 px-4 py-3 rounded-xl" style={{ color: "var(--rose)", background: "var(--rose-bg)", border: "1px solid var(--rose-bd)" }}>{err}</div>}

        {tab === "signup" ? (
          <>
            <input className={inp} style={inpStyle} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} />
            <input className={inp} style={inpStyle} placeholder="you@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} />
            <input className={inp} style={inpStyle} placeholder="At least 6 characters" type="password" value={pass} onChange={e => setPass(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} />
            <Btn variant="primary" size="lg" full onClick={doSignUp} disabled={loading} className="mb-4">
              {loading ? "Please wait..." : "Create my account →"}
            </Btn>
          </>
        ) : (
          <>
            <input className={inp} style={inpStyle} placeholder="you@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} />
            <input className={inp} style={inpStyle} placeholder="Your password" type="password" value={pass} onChange={e => setPass(e.target.value)} onFocus={inpFocus} onBlur={inpBlur} />
            <Btn variant="primary" size="lg" full onClick={doLogin} disabled={loading} className="mb-2">
              {loading ? "Please wait..." : "Log in →"}
            </Btn>
            <button onClick={doReset} className="block w-full text-center text-sm mb-4" style={{ color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Forgot password?
            </button>
          </>
        )}

        <div className="flex items-center gap-2 my-4">
          <div className="flex-1 h-px" style={{ background: "var(--brd)" }} />
          <span className="text-xs" style={{ color: "var(--t3)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "var(--brd)" }} />
        </div>

        <Btn variant="soft" size="lg" full onClick={doGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.8 2.5 30.3 0 24 0 14.7 0 6.7 5.4 2.9 13.2l7.8 6.1C12.5 13 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.1-4.5 6.7l7 5.4c4.1-3.8 6.4-9.4 6.4-16.1z"/>
            <path fill="#FBBC05" d="M10.7 28.7c-.6-1.6-.9-3.3-.9-5.2s.3-3.6.9-5.2l-7.8-6.1C1.1 15.4 0 19.6 0 24s1.1 8.6 2.9 11.8l7.8-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7-5.4c-2 1.3-4.5 2.1-8 2.1-6.2 0-11.5-4.2-13.4-9.8l-7.8 6.1C6.7 42.6 14.7 48 24 48z"/>
          </svg>
          Continue with Google
        </Btn>
        <p className="text-xs text-center mt-4" style={{ color: "var(--t3)" }}>Your data is private and never shared.</p>
      </div>
    </div>
  );
}

// ─── Onboarding Screen ────────────────────────────────────────
function OnboardingScreen({ user, onDone, toast }) {
  const [step, setStep] = useState(1);
  const [addictions, setAddictions] = useState([]);
  const [period, setPeriod] = useState(null);
  const [timing, setTiming] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [relapse, setRelapse] = useState(null);

  const ADDICTION_OPTS = [
    { v: "porn",    icon: "🔞", name: "Pornography",          meta: "Screen-based adult content addiction",        bg: "var(--rose-bg)" },
    { v: "smoking", icon: "🚬", name: "Smoking / Nicotine",   meta: "Cigarettes, vapes, nicotine pouches",         bg: "var(--amber-bg)" },
    { v: "alcohol", icon: "🍺", name: "Alcohol",              meta: "Beer, wine, spirits",                         bg: "var(--blue-bg)" },
    { v: "screen",  icon: "📱", name: "Screen / Social media",meta: "Doom-scrolling, gaming, compulsive browsing", bg: "var(--green-bg)" },
  ];
  const PERIOD_OPTS = [
    { v: "lt1y",  icon: "📅", name: "Less than a year" },
    { v: "1to3y", icon: "🗓️", name: "1 – 3 years" },
    { v: "3to5y", icon: "⏳", name: "3 – 5 years" },
    { v: "5yp",   icon: "🔁", name: "More than 5 years" },
  ];
  const TIMING_CHIPS = ["🌅 Morning","☀️ Afternoon","🌆 Evening","🌙 Late night","😤 Under stress","😴 When bored","🚶 When alone","🍻 Socially"];
  const TRIGGER_CHIPS = ["😰 Stress","😑 Boredom","😔 Loneliness","😟 Anxiety","😡 Anger","😢 Sadness","🎉 Celebrations","😴 Sleeplessness","💔 Rejection","🔄 Pure habit"];
  const RELAPSE_OPTS = [
    { v: "today", icon: "📍", name: "Today — starting fresh right now", meta: "Streak begins at 0 days", bg: "var(--rose-bg)" },
    { v: "1d",    icon: "📆", name: "Yesterday",                        meta: "Streak begins at 1 day",  bg: "var(--bg3)" },
    { v: "3d",    icon: "🌤️", name: "About 3 days ago",                meta: "Streak begins at 3 days", bg: "var(--bg3)" },
    { v: "1w",    icon: "💪", name: "About a week ago",                 meta: "Streak begins at 7 days", bg: "var(--green-bg)" },
    { v: "1m",    icon: "🏆", name: "Over a month ago",                 meta: "Streak begins at 30 days",bg: "var(--green-bg)" },
  ];

  async function finish() {
    const relapseDate = new Date();
    relapseDate.setDate(relapseDate.getDate() - (STREAK_MAP[relapse] || 0));
    const streak = STREAK_MAP[relapse] || 0;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        onboardingComplete: true, addictions, period,
        timing, triggers, relapse,
        lastRelapseDate: Timestamp.fromDate(relapseDate),
        streak, bestStreak: streak,
      });
      onDone({ addictions, streak, best: streak, lastRelapseDate: relapseDate });
    } catch (e) { console.error(e); }
  }

  function obNext() {
    if (step === 1 && !addictions.length) { toast("Please select at least one option"); return; }
    if (step === 2 && !period) { toast("Please choose one option"); return; }
    if (step === 5) { if (!relapse) { toast("Please choose one option"); return; } finish(); return; }
    setStep(s => s + 1);
  }

  const stepsLabels = ["Addiction", "History", "Timing", "Triggers", "Starting point"];

  const rowSel = (list, val) => list.includes(val);
  const toggleList = (list, setList, val) =>
    setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-xl mx-auto px-6 py-10">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex-1 h-1.5 rounded-full transition-all duration-300"
              style={{ background: i <= step ? "var(--blue)" : "var(--bg4)" }} />
          ))}
        </div>

        <div className="screen-enter" key={step}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--blue)" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--t3)" }}>
              Step {step} of 5 · {stepsLabels[step - 1]}
            </span>
          </div>

          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--t1)" }}>What are you working to overcome?</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--t2)" }}>Select everything that applies. This shapes your entire recovery plan — there's no judgment here.</p>
              {ADDICTION_OPTS.map(o => (
                <button key={o.v} onClick={() => toggleList(addictions, setAddictions, o.v)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl mb-3 text-left transition-all duration-150 cursor-pointer"
                  style={{
                    background: addictions.includes(o.v) ? "var(--blue-bg)" : "var(--bg)",
                    border: addictions.includes(o.v) ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                  }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: o.bg }}>{o.icon}</div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--t1)" }}>{o.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--t2)" }}>{o.meta}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--t1)" }}>How long has this been a challenge?</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--t2)" }}>Understanding the depth of the pattern helps us calibrate your plan.</p>
              {PERIOD_OPTS.map(o => (
                <button key={o.v} onClick={() => setPeriod(o.v)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl mb-3 text-left transition-all duration-150 cursor-pointer"
                  style={{
                    background: period === o.v ? "var(--blue-bg)" : "var(--bg)",
                    border: period === o.v ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                  }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: "var(--bg4)" }}>{o.icon}</div>
                  <div className="font-semibold text-sm" style={{ color: "var(--t1)" }}>{o.name}</div>
                </button>
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--t1)" }}>When do urges tend to hit hardest?</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--t2)" }}>Select all that apply. We'll check in with you during these windows.</p>
              <div className="flex flex-wrap gap-2">
                {TIMING_CHIPS.map(c => (
                  <button key={c} onClick={() => toggleList(timing, setTiming, c)}
                    className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer"
                    style={{
                      background: timing.includes(c) ? "var(--blue-bg)" : "var(--bg3)",
                      border: timing.includes(c) ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                      color: timing.includes(c) ? "var(--blue)" : "var(--t2)",
                      fontFamily: "inherit",
                    }}>{c}</button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--t1)" }}>What usually triggers the urge?</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--t2)" }}>Knowing your triggers is half the battle. Select everything that resonates.</p>
              <div className="flex flex-wrap gap-2">
                {TRIGGER_CHIPS.map(c => (
                  <button key={c} onClick={() => toggleList(triggers, setTriggers, c)}
                    className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer"
                    style={{
                      background: triggers.includes(c) ? "var(--blue-bg)" : "var(--bg3)",
                      border: triggers.includes(c) ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                      color: triggers.includes(c) ? "var(--blue)" : "var(--t2)",
                      fontFamily: "inherit",
                    }}>{c}</button>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--t1)" }}>When was your last relapse?</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--t2)" }}>This starts your streak counter. Honesty makes the app more effective — it's just between you and Clarity.</p>
              {RELAPSE_OPTS.map(o => (
                <button key={o.v} onClick={() => setRelapse(o.v)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl mb-3 text-left transition-all duration-150 cursor-pointer"
                  style={{
                    background: relapse === o.v ? "var(--blue-bg)" : "var(--bg)",
                    border: relapse === o.v ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                  }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: o.bg }}>{o.icon}</div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--t1)" }}>{o.name}</div>
                    {o.meta && <div className="text-xs mt-0.5" style={{ color: "var(--t2)" }}>{o.meta}</div>}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="flex gap-3 mt-8">
          {step > 1 && <Btn variant="soft" size="md" onClick={() => setStep(s => s - 1)}>← Back</Btn>}
          <Btn variant="green" size="lg" full onClick={obNext}>
            {step === 5 ? "Let's begin →" : "Continue →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar strip helper ─────────────────────────────────────
function CalendarStrip({ uid, days }) {
  const [dayMap, setDayMap] = useState({});

  useEffect(() => {
    const today = new Date();
    const map = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      map[d.toDateString()] = "empty";
    }
    map[today.toDateString()] = "now";
    setDayMap({ ...map });

    if (!uid) return;
    const since = new Date(today); since.setDate(today.getDate() - days + 1); since.setHours(0,0,0,0);
    getDocs(query(collection(db, "users", uid, "urgelogs"),
      where("timestamp", ">=", Timestamp.fromDate(since)), orderBy("timestamp", "desc")))
      .then(snap => {
        const m = { ...map };
        snap.forEach(d2 => {
          const d = d2.data().timestamp?.toDate();
          if (!d) return;
          const key = d.toDateString();
          if (!(key in m)) return;
          if (d2.data().outcome === "relapsed") m[key] = "bad";
          else if (m[key] === "empty") m[key] = "ok";
        });
        setDayMap(m);
      }).catch(() => {});
  }, [uid, days]);

  const today = new Date();
  const arr = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    arr.push({ d, key: d.toDateString(), status: dayMap[d.toDateString()] || "empty" });
  }

  const dotColor = { ok: "var(--green-d)", bad: "var(--rose)", now: "var(--blue)", empty: "var(--bg4)" };
  const bg = { ok: "var(--green-bg)", bad: "var(--rose-bg)", now: "var(--blue-bg)", empty: "var(--bg3)" };

  return (
    <div className="flex gap-1 flex-wrap">
      {arr.map(({ d, key, status }) => (
        <div key={key} className="flex flex-col items-center gap-1 flex-1 min-w-[36px] py-2 rounded-xl"
          style={{ background: bg[status] }}>
          <div className="text-xs font-bold" style={{ color: "var(--t3)" }}>{DN[d.getDay()]}</div>
          <div className="text-sm font-bold" style={{ color: "var(--t1)" }}>{d.getDate()}</div>
          <div className="w-2 h-2 rounded-full" style={{ background: dotColor[status] }} />
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Screen ──────────────────────────────────────────
function DashboardScreen({ state, onNav, toast, uid }) {
  const { streak, best, urgesTotal, resisted, userName, addictions } = state;
  const [quote, setQuote] = useState(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [mood, setMood] = useState(null);

  useEffect(() => {
    gemini(`You are a compassionate recovery coach. Write ONE short, powerful, emotionally supportive insight (1-2 sentences max) for someone recovering from ${addictions.join(", ") || "general addiction"} addiction who is on day ${streak} of their streak. Be warm, specific, and science-based. No quote marks needed. Respond with just the insight text.`)
      .then(t => { if (t) setQuote(t); });
  }, []);

  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning ☀️" : h < 17 ? "Good afternoon ⛅" : h < 21 ? "Good evening 🌆" : "Good night 🌙";
  const rate = urgesTotal ? Math.round((resisted / urgesTotal) * 100) : 0;
  const next = nextMilestone(streak);
  const prev = MILESTONES[MILESTONES.indexOf(next) - 1] || 0;
  const pct  = prev === next ? 100 : Math.min(Math.round(((streak - prev) / (next - prev)) * 100), 100);

  const streakChip = streak === 0
    ? { text: "🌱 Day 1 — a fresh start", bg: "var(--blue-bg)", border: "var(--blue-bd)", color: "var(--blue)" }
    : streak < 7
    ? { text: "🔥 Building momentum", bg: "var(--green-bg)", border: "var(--green-bd)", color: "var(--green-d)" }
    : streak < 30
    ? { text: `⚡ On a roll — ${streak} days!`, bg: "var(--green-bg)", border: "var(--green-bd)", color: "var(--green-d)" }
    : { text: `🏆 Incredible — ${streak} days!`, bg: "var(--amber-bg)", border: "var(--amber-bd)", color: "#6B4E0A" };

  const moods = ["💪 Strong","😌 Calm","😐 Neutral","😰 Struggling","😡 Frustrated"];

  function logMood(m) {
    setMood(m);
    if (uid) addDoc(collection(db, "users", uid, "moods"), { mood: m, timestamp: serverTimestamp() }).catch(() => {});
    toast("Mood logged: " + m);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-20 screen-enter">
      {/* Greeting */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--t3)" }}>{greeting}</div>
        <div className="text-2xl font-bold" style={{ color: "var(--t1)" }}>Welcome back, {userName} 👋</div>
      </div>

      {/* Streak hero */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="rounded-3xl overflow-hidden relative min-h-[200px]"
          style={{ background: "var(--card)", border: "1px solid var(--brd)", boxShadow: "var(--sh-md)" }}>
          {/* Atmospheric bg */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute rounded-full" style={{ width: 320, height: 320, top: -100, left: -80, background: "radial-gradient(circle, rgba(36,134,219,.08) 0%, transparent 60%)" }} />
            <div className="absolute rounded-full" style={{ width: 220, height: 220, bottom: -70, right: 60, background: "radial-gradient(circle, rgba(168,213,186,.12) 0%, transparent 60%)" }} />
          </div>
          <div className="absolute right-5 text-8xl opacity-5 select-none" style={{ top: "50%", transform: "translateY(-50%)", lineHeight: 1 }}>🔥</div>
          <div className="relative z-10 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full streak-dot" style={{ background: "var(--green-d)" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--green-d)" }}>Current streak</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2" style={{ lineHeight: 1 }}>
              <span className="font-black" style={{ fontSize: 72, letterSpacing: "-.04em", color: "var(--blue)", lineHeight: .88 }}>{streak}</span>
              <span className="text-lg font-semibold" style={{ color: "var(--t2)" }}>days<br/>clean</span>
            </div>
            <div className="text-sm mb-3" style={{ color: "var(--t2)" }}>Personal best: <strong style={{ color: "var(--t1)" }}>{best} days</strong></div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
              style={{ background: streakChip.bg, border: `1px solid ${streakChip.border}`, color: streakChip.color }}>
              {streakChip.text}
            </div>
            <div className="h-1.5 rounded-full mb-1 overflow-hidden" style={{ background: "var(--bg4)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--blue),var(--teal))" }} />
            </div>
            <div className="flex justify-between text-xs font-medium mt-1" style={{ color: "var(--t3)" }}>
              <span>Day {streak}</span>
              <span>{streak >= next ? `🏆 ${next}-day milestone!` : `Next milestone: ${next} days`}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {[{ val: urgesTotal, lbl: "Urges logged", color: "var(--blue)" }, { val: rate + "%", lbl: "Resistance rate", color: "var(--green-d)" }].map(x => (
            <div key={x.lbl} className="flex-1 rounded-2xl flex flex-col items-center justify-center p-4"
              style={{ background: "var(--card)", border: "1px solid var(--brd)", boxShadow: "var(--sh)" }}>
              <div className="text-3xl font-black" style={{ color: x.color }}>{x.val}</div>
              <div className="text-xs font-semibold mt-1 text-center" style={{ color: "var(--t2)" }}>{x.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Urge CTA */}
      <div className="rounded-3xl p-6 mb-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,var(--rose-bg) 0%,rgba(247,200,115,.06) 100%)", border: "1.5px solid var(--rose-bd)" }}>
        <div className="absolute rounded-full pointer-events-none" style={{ width: 180, height: 180, top: -50, right: -50, background: "radial-gradient(circle,rgba(229,115,115,.07),transparent 65%)" }} />
        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: "var(--rose)" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--rose)" }}>Right now</span>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: "var(--t1)" }}>Is something trying to break your streak?</h3>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--t2)" }}>You don't have to fight this alone. Log the urge and we'll walk you through it — one gentle step at a time.</p>
        <button onClick={() => onNav("urge")}
          className="w-full h-14 flex items-center justify-between px-6 rounded-2xl font-bold text-base cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "var(--rose)", color: "#fff", border: "none", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(229,115,115,.33)" }}>
          <span>I'm feeling an urge right now</span>
          <span className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,.2)" }}>→</span>
        </button>
      </div>

      {/* AI Insight */}
      <div className="mb-6">
        <InsightBox icon="✨" label="AI Daily Insight" text={quote} />
      </div>

      {/* Week calendar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold" style={{ color: "var(--t1)" }}>This week</div>
          <button onClick={() => onNav("analytics")} className="text-sm font-semibold" style={{ color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>View all analytics →</button>
        </div>
        <Card>
          <div className="p-5">
            <CalendarStrip uid={uid} days={7} />
            <div className="flex gap-4 mt-3 text-xs font-medium" style={{ color: "var(--t3)" }}>
              <span>🟢 Resisted</span><span>🔴 Relapsed</span><span>🔵 Today</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Mood */}
      <div className="mb-6">
        <div className="text-base font-bold mb-3" style={{ color: "var(--t1)" }}>How are you feeling today?</div>
        <Card>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: "var(--t2)" }}>A quick check-in helps us support you better. There are no wrong answers.</p>
            <div className="flex flex-wrap gap-2">
              {moods.map(m => (
                <button key={m} onClick={() => logMood(m)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: mood === m ? "var(--blue-bg)" : "var(--bg3)",
                    border: mood === m ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                    color: mood === m ? "var(--blue)" : "var(--t2)",
                    fontFamily: "inherit",
                  }}>{m}</button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Log relapse */}
      <Card style={{ borderColor: "var(--rose-bd)" }}>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="font-bold mb-1" style={{ color: "var(--rose)", fontSize: 15 }}>Had a relapse?</div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--t2)" }}>Logging it resets your streak, but your personal best stays. It helps the AI build a better plan.</p>
          </div>
          <Btn variant="danger" size="md" style={{ flexShrink: 0 }} onClick={() => onNav("relapse-modal")}>Log relapse</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Urge Screen ───────────────────────────────────────────────
function UrgeScreen({ state, setState, onNav, toast, uid }) {
  const [urgeType, setUrgeType] = useState(null);
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState(null);
  const [otherText, setOtherText] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [customModal, setCustomModal] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const [customName, setCustomName] = useState("");
  const [customTypes, setCustomTypes] = useState([]);

  const IL_LABELS = ["","Very mild","Mild","Mild","Moderate","Moderate","Strong","Strong","Very strong","Extreme","Overwhelming"];
  const IL_COLORS = ["","var(--green-d)","var(--green-d)","var(--green-d)","var(--blue)","var(--blue)","#B07D00","#B07D00","var(--rose)","var(--rose)","var(--rose)"];
  const IL_BG     = ["","var(--green-bg)","var(--green-bg)","var(--green-bg)","var(--blue-bg)","var(--blue-bg)","var(--amber-bg)","var(--amber-bg)","var(--rose-bg)","var(--rose-bg)","var(--rose-bg)"];

  const URGE_TYPES = [
    { v: "porn",    icon: "🔞", name: "Pornography",           bg: "var(--rose-bg)" },
    { v: "smoking", icon: "🚬", name: "Smoking / Nicotine",    bg: "var(--amber-bg)" },
    { v: "alcohol", icon: "🍺", name: "Alcohol",               bg: "var(--blue-bg)" },
    { v: "screen",  icon: "📱", name: "Screen / Social media", bg: "var(--green-bg)" },
    ...customTypes,
  ];
  const TRIGGER_CHIPS = ["😰 Stress","😑 Boredom","😔 Loneliness","😟 Anxiety","😡 Anger","😢 Sadness","🔄 Habit"];

  async function submit() {
    if (!urgeType) { toast("Please let us know what type of urge this is"); return; }
    if (!trigger)  { toast("Please select what triggered this feeling"); return; }
    if (trigger === "other" && !otherText.trim()) { toast("Please describe what happened in a few words"); return; }

    let logId = null;
    if (uid) {
      try {
        const ref = await addDoc(collection(db, "users", uid, "urgelogs"), {
          timestamp: serverTimestamp(), urgeType, intensity,
          trigger, triggerText: trigger === "other" ? otherText : "",
          outcome: "pending", taskUsed: null,
        });
        await updateDoc(doc(db, "users", uid), { urgesTotal: increment(1) });
        logId = ref.id;
      } catch {}
    }
    setState(s => ({ ...s, urgeType, intensity, trigger, currentUrgeLogId: logId, urgesTotal: s.urgesTotal + 1 }));
    onNav("task");
  }

  function addCustom() {
    if (!customName.trim()) { toast("Please enter a name for this type"); return; }
    const t = { v: customName.toLowerCase().replace(/\s/g,"_"), icon: customEmoji||"❓", name: customName, bg: "var(--bg3)" };
    setCustomTypes(c => [...c, t]);
    setCustomEmoji(""); setCustomName(""); setCustomModal(false);
    toast((customEmoji||"❓") + " " + customName + " added!");
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8 pb-20 screen-enter">
      <div className="flex items-center gap-3 mb-6">
        <Btn variant="soft" size="sm" onClick={() => onNav("dashboard")}>← Back</Btn>
        <div className="text-xl font-bold" style={{ color: "var(--t1)" }}>Log this urge</div>
      </div>

      <InsightBox icon="🧠" label="You're doing the right thing"
        text="Logging an urge instead of acting on it is already a win. Let's understand what's happening and find you the right support." />

      {/* Type */}
      <div className="mt-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold" style={{ color: "var(--t1)" }}>What type of urge is this?</div>
          <Btn variant="ghost" size="sm" onClick={() => setCustomModal(true)}>+ Add custom</Btn>
        </div>
        {URGE_TYPES.map(o => (
          <button key={o.v} onClick={() => setUrgeType(o.v)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl mb-2 text-left cursor-pointer transition-all duration-150"
            style={{
              background: urgeType === o.v ? "var(--blue-bg)" : "var(--bg)",
              border: urgeType === o.v ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
              fontFamily: "inherit",
            }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: o.bg }}>{o.icon}</div>
            <div className="font-semibold text-sm" style={{ color: "var(--t1)" }}>{o.name}</div>
          </button>
        ))}
      </div>

      {/* Intensity */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-bold" style={{ color: "var(--t1)" }}>How intense does it feel?</div>
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: IL_BG[intensity], color: IL_COLORS[intensity] }}>
            {intensity} / 10 · {IL_LABELS[intensity]}
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1,2,3,4,5,6,7,8,9,10].map(v => (
            <button key={v} onClick={() => setIntensity(v)}
              className="flex-1 h-10 rounded-xl text-sm font-bold cursor-pointer transition-all duration-150"
              style={{
                background: intensity === v ? (v >= 8 ? "var(--rose)" : v >= 5 ? "var(--amber)" : "var(--blue)") : "var(--bg3)",
                color: intensity === v ? "#fff" : "var(--t2)",
                border: intensity === v ? "none" : "1px solid var(--brd)",
                fontFamily: "inherit",
              }}>{v}</button>
          ))}
        </div>
        <div className="flex justify-between text-xs mt-2 font-medium" style={{ color: "var(--t3)" }}>
          <span>Mild — I can manage</span><span>Overwhelming</span>
        </div>
      </div>

      {/* Trigger */}
      <div className="mb-8">
        <div className="text-base font-bold mb-3" style={{ color: "var(--t1)" }}>What triggered this feeling?</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {TRIGGER_CHIPS.map(c => (
            <button key={c} onClick={() => { setTrigger(c); setShowOther(false); }}
              className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-all duration-150"
              style={{
                background: trigger === c ? "var(--blue-bg)" : "var(--bg3)",
                border: trigger === c ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
                color: trigger === c ? "var(--blue)" : "var(--t2)",
                fontFamily: "inherit",
              }}>{c}</button>
          ))}
          <button onClick={() => { setTrigger("other"); setShowOther(true); }}
            className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-all duration-150"
            style={{
              background: trigger === "other" ? "var(--blue-bg)" : "var(--bg3)",
              border: trigger === "other" ? "1.5px solid var(--blue-bd)" : "1.5px solid var(--brd)",
              color: trigger === "other" ? "var(--blue)" : "var(--t2)",
              fontFamily: "inherit",
            }}>💭 Other</button>
        </div>
        {showOther && (
          <div className="screen-enter">
            <InsightBox icon="🧠" label="" text="Describe what happened in your own words. The AI will analyse this over time and surface patterns in your analytics." />
            <textarea className="w-full mt-3 p-4 rounded-2xl text-sm resize-none outline-none transition-all duration-150"
              style={{ background: "var(--bg3)", border: "1.5px solid var(--brd)", color: "var(--t1)", fontFamily: "inherit", lineHeight: 1.6, minHeight: 80 }}
              rows={3} placeholder="e.g. I saw an old photo, felt dismissed in a conversation..."
              value={otherText} onChange={e => setOtherText(e.target.value)} />
          </div>
        )}
      </div>

      <Btn variant="green" size="lg" full onClick={submit}>Find me a task →</Btn>

      {/* Custom modal */}
      <Modal open={customModal} onClose={() => setCustomModal(false)}
        title="Add a custom urge type"
        body="Give it a name and emoji. It'll appear in your urge log list."
        actions={<>
          <Btn variant="soft" size="md" full onClick={() => setCustomModal(false)}>Cancel</Btn>
          <Btn variant="primary" size="md" full onClick={addCustom}>Add type</Btn>
        </>}>
        <div className="mb-4">
          <label className="text-xs font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--t3)" }}>Emoji</label>
          <input className="w-20 h-12 rounded-xl text-center text-2xl outline-none"
            style={{ background: "var(--bg3)", border: "1.5px solid var(--brd)", fontFamily: "inherit" }}
            maxLength={4} value={customEmoji} onChange={e => setCustomEmoji(e.target.value)} placeholder="🎮" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--t3)" }}>Name</label>
          <input className="w-full h-12 px-4 rounded-xl text-sm outline-none"
            style={{ background: "var(--bg3)", border: "1.5px solid var(--brd)", color: "var(--t1)", fontFamily: "inherit" }}
            placeholder="e.g. Gaming, Gambling..." value={customName} onChange={e => setCustomName(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

// ─── Task Picker Screen ───────────────────────────────────────
function TaskScreen({ state, setState, onNav, toast }) {
  const lv = iLevel(state.intensity);
  const rec   = ALL_TASKS.filter(t => t.levels.includes(lv));
  const other = ALL_TASKS.filter(t => !t.levels.includes(lv));
  const [selected, setSelected] = useState(rec[0]?.id || "breathing");
  const [aiRec, setAiRec] = useState("Based on your intensity and trigger, a breathing exercise will interrupt the urge cycle most effectively right now.");

  useEffect(() => {
    setState(s => ({ ...s, task: rec[0] || ALL_TASKS[0] }));
    gemini(`You are a recovery coach. Someone is experiencing a ${state.urgeType} urge at intensity ${state.intensity}/10, triggered by ${state.trigger}. Write ONE short, compassionate recommendation (2 sentences max) for which type of recovery task would help most right now. Be specific and warm. Just the recommendation, no preamble.`)
      .then(t => { if (t) setAiRec(t); });
  }, []);

  function selectTask(t) {
    setSelected(t.id);
    setState(s => ({ ...s, task: t }));
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8 pb-20 screen-enter">
      <div className="flex items-center gap-3 mb-6">
        <Btn variant="soft" size="sm" onClick={() => onNav("urge")}>← Back</Btn>
        <div className="text-xl font-bold" style={{ color: "var(--t1)" }}>Choose your task</div>
      </div>

      <InsightBox icon="✨" label="AI Recommendation" text={aiRec} />

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "var(--green-d)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green-d)" }} />
          Best for {lv === "low" ? "mild" : lv === "mid" ? "moderate" : "intense"} urges
        </div>
        {rec.map((t, i) => (
          <TaskRow key={t.id} task={t} selected={selected === t.id} onSelect={() => selectTask(t)} topPick={i === 0} />
        ))}
      </div>

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: "var(--t3)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--t3)" }} />
          Other helpful options
        </div>
        {other.map(t => (
          <TaskRow key={t.id} task={t} selected={selected === t.id} onSelect={() => selectTask(t)} />
        ))}
      </div>

      <div className="mt-8">
        <Btn variant="green" size="lg" full onClick={() => onNav("timer")}>Start task →</Btn>
      </div>
    </div>
  );
}

// ─── Timer Screen ─────────────────────────────────────────────
function TimerScreen({ state, setState, onNav, toast, uid }) {
  const task = state.task || ALL_TASKS[0];
  const [rem, setRem] = useState(task.dur);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState(BREATHE[0]);
  const [timerMsg, setTimerMsg] = useState("Every second you hold on, the urge loses power. You're choosing differently — that's real strength.");
  const totalRef = useRef(task.dur);
  const remRef = useRef(task.dur);
  const elapsed = useRef(0);
  const intRef = useRef(null);

  useEffect(() => {
    gemini(`You are a compassionate recovery coach. Someone is currently doing a "${task.name}" task to resist a ${state.urgeType} urge at intensity ${state.intensity}/10. Write ONE ultra-short encouraging message (1 sentence, max 15 words) to keep them going. Be warm and specific. Just the message.`)
      .then(t => { if (t) setTimerMsg(t); });

    if (state.uid && state.currentUrgeLogId) {
      updateDoc(doc(db, "users", state.uid, "urgelogs", state.currentUrgeLogId), { taskUsed: task.id }).catch(() => {});
    }

    intRef.current = setInterval(() => {
      if (paused) return;
      remRef.current--;
      elapsed.current++;
      setRem(remRef.current);
      const e = elapsed.current;
      if (task.id === "breathing") setPhase(BREATHE[Math.floor(e / 4) % 4]);
      else setPhase(ENCOUR[Math.floor(e / 60) % ENCOUR.length]);
      if (remRef.current <= 0) { clearInterval(intRef.current); finish(); }
    }, 1000);

    return () => clearInterval(intRef.current);
  }, []);

  function finish() {
    if (uid) updateDoc(doc(db, "users", uid), { tasksDone: increment(1) }).catch(() => {});
    setState(s => ({ ...s, tasksDone: s.tasksDone + 1 }));
    onNav("feedback");
  }

  const total = totalRef.current;
  const dashoffset = 603 * (rem / total);

  return (
    <div className="max-w-xl mx-auto px-6 py-8 pb-20 screen-enter">
      <div className="mb-4">
        <Btn variant="soft" size="sm" onClick={() => { clearInterval(intRef.current); onNav("task"); }}>✕ Stop task</Btn>
      </div>

      <div className="flex flex-col items-center">
        <div className="text-2xl font-bold mb-1 text-center" style={{ color: "var(--t1)" }}>{task.name}</div>
        <div className="text-sm mb-8 text-center" style={{ color: "var(--t2)" }}>Focus. You're doing something powerful right now.</div>

        <div className="relative mb-8" style={{ width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="96" fill="none" stroke="var(--bg3)" strokeWidth="8" />
            <circle cx="110" cy="110" r="96" fill="none" stroke="var(--blue)" strokeWidth="8"
              strokeLinecap="round" strokeDasharray="603" strokeDashoffset={dashoffset}
              style={{ transformOrigin: "center", transform: "rotate(-90deg)", transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl mb-1">{task.icon}</div>
            <div className="text-3xl font-black tabular-nums" style={{ color: "var(--t1)" }}>{fmt(rem)}</div>
            <div className="text-sm mt-1 text-center px-4" style={{ color: "var(--t2)" }}>{phase}</div>
          </div>
        </div>

        <div className="w-full mb-8">
          <InsightBox icon="💙" label="Stay with it" text={timerMsg} />
        </div>

        <div className="flex gap-3 w-full">
          <Btn variant="soft" size="lg" full onClick={() => setPaused(p => !p)}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </Btn>
          <Btn variant="green" size="lg" full onClick={() => { clearInterval(intRef.current); finish(); }}>✓ Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Feedback Screen ──────────────────────────────────────────
function FeedbackScreen({ state, setState, onNav, toast, uid }) {
  const [note, setNote] = useState("");

  async function urgeGone() {
    setState(s => ({ ...s, resisted: s.resisted + 1 }));
    if (uid) {
      await updateDoc(doc(db, "users", uid), { resisted: increment(1) }).catch(() => {});
      if (state.currentUrgeLogId) {
        await updateDoc(doc(db, "users", uid, "urgelogs", state.currentUrgeLogId), { outcome: "resisted", feedbackNote: note }).catch(() => {});
      }
    }
    setState(s => ({ ...s, currentUrgeLogId: null }));
    toast("Wonderful — urge resisted! 🎉");
    onNav("dashboard");
  }

  function urgeStill() {
    if (uid && state.currentUrgeLogId) {
      updateDoc(doc(db, "users", uid, "urgelogs", state.currentUrgeLogId), { outcome: "still_there" }).catch(() => {});
    }
    toast("That's okay — let's try a different approach");
    onNav("task");
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16 pb-20 flex flex-col items-center screen-enter">
      <div className="text-5xl mb-4">🎯</div>
      <div className="text-2xl font-bold text-center mb-3" style={{ color: "var(--t1)" }}>You did it!</div>
      <p className="text-sm text-center leading-relaxed mb-8" style={{ color: "var(--t2)", maxWidth: "36ch" }}>
        You completed <strong style={{ color: "var(--t1)" }}>{state.task?.name || "the task"}</strong>. That took real strength. How is the urge feeling now?
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
        {[
          { icon: "✅", title: "It's gone", sub: "I feel better now", onClick: urgeGone, border: "var(--green-bd)", bg: "var(--green-bg)", col: "var(--green-d)" },
          { icon: "😰", title: "Still there", sub: "I need another task", onClick: urgeStill, border: "var(--rose-bd)", bg: "var(--rose-bg)", col: "var(--rose)" },
        ].map(x => (
          <button key={x.title} onClick={x.onClick}
            className="flex flex-col items-center p-6 rounded-3xl cursor-pointer transition-all duration-150 hover:-translate-y-1"
            style={{ background: x.bg, border: `2px solid ${x.border}`, fontFamily: "inherit" }}>
            <div className="text-4xl mb-2">{x.icon}</div>
            <div className="font-bold text-base" style={{ color: x.col }}>{x.title}</div>
            <div className="text-xs mt-1" style={{ color: "var(--t2)" }}>{x.sub}</div>
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm">
        <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--t3)" }}>
          Quick note <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea className="w-full p-4 rounded-2xl text-sm resize-none outline-none"
          style={{ background: "var(--bg3)", border: "1.5px solid var(--brd)", color: "var(--t1)", fontFamily: "inherit", lineHeight: 1.6, minHeight: 80 }}
          placeholder="What helped? Any insight about this experience..."
          value={note} onChange={e => setNote(e.target.value)} />
      </div>
    </div>
  );
}

// ─── Analytics Screen ─────────────────────────────────────────
function AnalyticsScreen({ state, onNav, toast, uid }) {
  const { streak, best, resisted, urgesTotal } = state;
  const [aiInsight, setAiInsight] = useState("Your urges peak on Wednesday evenings — likely midweek stress. Your most effective tool has been Breathing (82% success). Try sleeping 30 min earlier on weekdays to cut your late-night vulnerability window.");
  const [barData, setBarData] = useState([0,0,0,0,0,0,0]);
  const [trigData, setTrigData] = useState([
    { n: "Stress", p: 0, c: "var(--rose)" }, { n: "Boredom", p: 0, c: "#B07D00" },
    { n: "Lonely", p: 0, c: "var(--blue)" }, { n: "Anxiety", p: 0, c: "var(--green-d)" },
    { n: "Habit",  p: 0, c: "var(--t3)" },
  ]);
  const [relapses, setRelapses] = useState(0);

  useEffect(() => {
    if (!uid) return;
    const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0,0,0,0);
    getDocs(query(collection(db, "users", uid, "urgelogs"),
      where("timestamp", ">=", Timestamp.fromDate(since)), orderBy("timestamp", "asc")))
      .then(snap => {
        const bars = [0,0,0,0,0,0,0];
        const tc = { Stress:0, Boredom:0, Lonely:0, Anxiety:0, Habit:0, Other:0 };
        let rel = 0;
        snap.forEach(d => {
          const da = d.data();
          const date = da.timestamp?.toDate(); if (!date) return;
          const idx = Math.min(6, Math.floor((Date.now() - date.getTime()) / 86400000));
          bars[6 - idx]++;
          const t = (da.trigger || "").toLowerCase();
          if (t.includes("stress")) tc.Stress++;
          else if (t.includes("boredom")) tc.Boredom++;
          else if (t.includes("lone")) tc.Lonely++;
          else if (t.includes("anx")) tc.Anxiety++;
          else if (t.includes("habit")) tc.Habit++;
          else tc.Other++;
          if (da.outcome === "relapsed") rel++;
        });
        setBarData(bars);
        setRelapses(rel);
        const total = Math.max(Object.values(tc).reduce((a,b)=>a+b,0), 1);
        const td = [
          { n:"Stress", p:Math.round(tc.Stress/total*100), c:"var(--rose)" },
          { n:"Boredom",p:Math.round(tc.Boredom/total*100),c:"#B07D00" },
          { n:"Lonely", p:Math.round(tc.Lonely/total*100), c:"var(--blue)" },
          { n:"Anxiety",p:Math.round(tc.Anxiety/total*100),c:"var(--green-d)" },
          { n:"Habit",  p:Math.round(tc.Habit/total*100),  c:"var(--t3)" },
        ];
        setTrigData(td);
        const effData = [
          { n:"Breathing",i:"🫁",p:82},{n:"Exercise",i:"🏃",p:76},
          { n:"Cold shower",i:"🚿",p:71},{n:"Journaling",i:"📝",p:65},
          { n:"Research",i:"📖",p:58}
        ];
        gemini(`You are a recovery analytics coach. User stats: streak=${streak} days, urges resisted=${resisted}, total urges=${urgesTotal}. Top triggers: ${td.map(t=>`${t.n}:${t.p}%`).join(", ")}. Task effectiveness: ${effData.map(e=>`${e.n}:${e.p}%success`).join(", ")}. Write a personalised, actionable 2-sentence insight and one specific recommendation. Be warm and data-driven. No preamble.`)
          .then(t => { if (t) setAiInsight(t); });
      }).catch(() => {});
  }, [uid]);

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const maxBar = Math.max(...barData, 1);

  const effData = [
    { n:"Breathing",i:"🫁",p:82},{n:"Exercise",i:"🏃",p:76},
    { n:"Cold shower",i:"🚿",p:71},{n:"Journaling",i:"📝",p:65},
    { n:"Research",i:"📖",p:58}
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-20 screen-enter">
      <div className="mb-6">
        <div className="text-2xl font-bold mb-1" style={{ color: "var(--t1)" }}>Your Progress</div>
        <p className="text-sm" style={{ color: "var(--t2)" }}>A clear picture of your recovery journey over time.</p>
      </div>

      <div className="mb-6">
        <InsightBox icon="🧠" label="Weekly AI Insight" text={aiInsight} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { num: streak, lbl: "Current streak", color: "var(--green-d)", delta: "↑ Building momentum", up: true },
          { num: best, lbl: "Best streak ever", color: "var(--t1)", delta: "Personal record", up: null },
          { num: resisted, lbl: "Urges resisted", color: "var(--blue)", delta: urgesTotal ? `↑ ${Math.round(resisted/urgesTotal*100)}% success rate` : "—", up: true },
          { num: relapses, lbl: "Relapses this month", color: "var(--rose)", delta: "Logged this week", up: false },
        ].map(s => (
          <Card key={s.lbl}>
            <div className="p-5">
              <div className="text-4xl font-black mb-1" style={{ color: s.color }}>{s.num}</div>
              <div className="text-xs font-semibold mb-2" style={{ color: "var(--t2)" }}>{s.lbl}</div>
              <div className="text-xs font-medium" style={{ color: s.up === true ? "var(--green-d)" : s.up === false ? "var(--rose)" : "var(--t3)" }}>{s.delta}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      <div className="mb-6">
        <Card>
          <CardHeader title="Urge frequency" subtitle="Urges logged each day this week" />
          <div className="p-5">
            <div className="flex items-end gap-2 h-32">
              {barData.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold" style={{ color: "var(--t2)" }}>{v || ""}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{ height: Math.max((v / maxBar) * 100, v > 0 ? 4 : 0), background: v === Math.max(...barData) && v > 0 ? "var(--rose)" : "var(--blue)", minHeight: 0 }} />
                  <span className="text-xs font-medium" style={{ color: "var(--t3)" }}>{days[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Triggers + effectiveness */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader title="Top triggers" />
          <div className="p-5 space-y-3">
            {trigData.map(t => (
              <div key={t.n} className="flex items-center gap-3">
                <div className="w-16 text-xs font-semibold" style={{ color: "var(--t2)" }}>{t.n}</div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg4)" }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${t.p}%`, background: t.c }} />
                </div>
                <div className="w-8 text-xs font-bold text-right" style={{ color: "var(--t2)" }}>{t.p}%</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Task effectiveness" />
          <div className="p-5 space-y-3">
            {effData.map(e => (
              <div key={e.n} className="flex items-center gap-3">
                <span className="text-base">{e.i}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold mb-1" style={{ color: "var(--t1)" }}>{e.n}</div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg4)" }}>
                    <div className="h-full rounded-full" style={{ width: `${e.p}%`, background: "var(--blue)" }} />
                  </div>
                </div>
                <div className="w-8 text-xs font-bold text-right" style={{ color: "var(--blue)" }}>{e.p}%</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 14-day calendar */}
      <div className="mb-6">
        <Card>
          <CardHeader title="Last 14 days" subtitle="Green = resisted · Red = relapsed" />
          <div className="p-5">
            <CalendarStrip uid={uid} days={14} />
          </div>
        </Card>
      </div>

      {/* Relapse CTA */}
      <Card style={{ borderColor: "var(--rose-bd)" }}>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="font-bold mb-1" style={{ color: "var(--rose)", fontSize: 15 }}>Had a relapse?</div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--t2)" }}>Logging it resets your streak, but your personal best stays. It helps the AI build a better plan for you.</p>
          </div>
          <Btn variant="danger" size="md" style={{ flexShrink: 0 }} onClick={() => onNav("relapse-modal")}>Log relapse</Btn>
        </div>
      </Card>
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
function ProfileScreen({ state, setState, onNav, toast, user, theme, setTheme }) {
  const { streak, resisted, urgesTotal, userName, addictions } = state;
  const ADDICTION_LABELS = { porn: "🔞 Pornography", smoking: "🚬 Smoking", alcohol: "🍺 Alcohol", screen: "📱 Screen" };

  const [darkMode, setDarkMode] = useState(theme === "dark");

  function toggleDark(v) {
    setDarkMode(v);
    setTheme(v ? "dark" : "light");
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-20 screen-enter">
      <div className="text-2xl font-bold mb-8" style={{ color: "var(--t1)" }}>Profile & Settings</div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: profile card */}
        <div className="space-y-4">
          <Card>
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-4"
                style={{ background: "linear-gradient(135deg,var(--blue),var(--teal))", boxShadow: "0 4px 20px var(--blue-glow)" }}>
                🌿
              </div>
              <div className="text-xl font-bold mb-1" style={{ color: "var(--t1)" }}>{userName}</div>
              <div className="text-sm mb-3" style={{ color: "var(--t2)" }}>{user?.email || ""}</div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold"
                style={{ background: "var(--green-bg)", border: "1px solid var(--green-bd)", color: "var(--green-d)" }}>
                🔥 {streak} day streak
              </div>
              <div className="grid grid-cols-2 gap-4 mt-5 w-full">
                {[{ v: resisted, k: "Resisted" }, { v: urgesTotal, k: "Total urges", muted: true }].map(x => (
                  <div key={x.k} className="text-center">
                    <div className="text-2xl font-black" style={{ color: x.muted ? "var(--t2)" : "var(--t1)" }}>{x.v}</div>
                    <div className="text-xs font-semibold mt-0.5" style={{ color: "var(--t3)" }}>{x.k}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5">
              <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--t3)" }}>Tracking</div>
              <div className="flex flex-wrap gap-2">
                {addictions.length
                  ? addictions.map(a => (
                      <span key={a} className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{ background: "var(--green-bg)", border: "1px solid var(--green-bd)", color: "var(--green-d)" }}>
                        {ADDICTION_LABELS[a] || a}
                      </span>
                    ))
                  : <span className="text-sm" style={{ color: "var(--t2)" }}>Complete onboarding to see this</span>
                }
              </div>
            </div>
          </Card>
        </div>

        {/* Right: settings */}
        <div className="space-y-4">
          <Card>
            <div className="p-5">
              {[
                {
                  group: "Appearance",
                  items: [
                    { icon: "🌙", bg: "var(--blue-bg)", name: "Dark mode", desc: "Switch between light and dark themes",
                      right: <Toggle checked={darkMode} onChange={e => toggleDark(e.target.checked)} /> }
                  ]
                },
                {
                  group: "Notifications",
                  items: [
                    { icon: "🔔", bg: "var(--amber-bg)", name: "Daily check-in reminder", desc: "A gentle nudge at noon every day", right: <Toggle checked={true} onChange={() => {}} /> },
                    { icon: "📊", bg: "var(--green-bg)", name: "Weekly AI report", desc: "Insights every Sunday morning", right: <Toggle checked={true} onChange={() => {}} /> }
                  ]
                },
                {
                  group: "AI",
                  items: [
                    { icon: "✨", bg: "var(--blue-bg)", name: "AI encouragement during tasks", desc: "Gemini-powered support while you focus", right: <Toggle checked={true} onChange={() => {}} /> },
                    { icon: "🔑", bg: "var(--blue-bg)", name: "Gemini API key", desc: "Connect your own key for AI features",
                      right: <Btn variant="ghost" size="sm" onClick={() => toast("Configure in .env file: VITE_GEMINI_API_KEY")}>Configure</Btn> }
                  ]
                },
                {
                  group: "Data & Privacy",
                  items: [
                    { icon: "📤", bg: "var(--blue-bg)", name: "Export my data", desc: "Download everything as a file",
                      right: <Btn variant="soft" size="sm" onClick={() => toast("Export coming soon!")}>Export</Btn> },
                    { icon: "🗑️", bg: "var(--rose-bg)", name: "Reset all data", desc: "This cannot be undone",
                      right: <Btn variant="soft" size="sm" style={{ color: "var(--rose)" }} onClick={() => onNav("reset-modal")}>Reset</Btn> }
                  ]
                },
              ].map(section => (
                <div key={section.group}>
                  <div className="text-xs font-bold uppercase tracking-widest py-3" style={{ color: "var(--t3)", borderTop: "1px solid var(--brd)" }}>{section.group}</div>
                  {section.items.map(item => (
                    <div key={item.name} className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid var(--brd)" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: item.bg }}>{item.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: "var(--t1)" }}>{item.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--t2)" }}>{item.desc}</div>
                      </div>
                      {item.right}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>

          <Btn variant="soft" size="md" full
            style={{ color: "var(--rose)", borderColor: "var(--rose-bd)" }}
            onClick={async () => { await signOut(auth); toast("You've been logged out."); }}>
            Sign out
          </Btn>
          <p className="text-xs text-center" style={{ color: "var(--t3)" }}>Clarity v1.0 · Firebase + Gemini integrated</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("clarity-theme");
    return saved || (window.matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  });
  const [screen, setScreen] = useState("loading");
  const [user, setUser]     = useState(null);
  const [loadMsg, setLoadMsg] = useState("Loading your journey...");
  const [toast, setToast]   = useState({ msg: "", visible: false });
  const toastTimer = useRef(null);

  const [state, setState] = useState({
    uid: null, userName: "Champion",
    addictions: [], streak: 0, best: 0,
    urgesTotal: 0, resisted: 0, tasksDone: 0,
    lastRelapseDate: null,
    urgeType: null, trigger: null, intensity: 5,
    task: ALL_TASKS[0],
    currentUrgeLogId: null,
  });

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clarity-theme", theme);
    document.body.style.background = "var(--bg)";
    document.body.style.color = "var(--t1)";
    document.body.style.fontFamily = "'Commissioner', sans-serif";
  }, [theme]);

  function showToast(msg) {
    clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2800);
  }

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (u) {
        setUser(u);
        setState(s => ({ ...s, uid: u.uid }));
        setLoadMsg("Loading your data...");
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (!snap.exists()) {
            setState(s => ({ ...s, userName: u.displayName || "Champion" }));
            setScreen("onboarding");
          } else {
            const d = snap.data();
            let streak = d.streak || 0;
            let lastRelapseDate = null;
            if (d.lastRelapseDate) {
              lastRelapseDate = d.lastRelapseDate.toDate();
              streak = Math.max(Math.floor((Date.now() - lastRelapseDate.getTime()) / 86400000), 0);
            }
            setState(s => ({
              ...s, uid: u.uid,
              userName: d.name || u.displayName || "Champion",
              addictions: d.addictions || [],
              streak, best: d.bestStreak || 0,
              urgesTotal: d.urgesTotal || 0,
              resisted: d.resisted || 0,
              tasksDone: d.tasksDone || 0,
              lastRelapseDate,
            }));
            setScreen(d.onboardingComplete ? "dashboard" : "onboarding");
          }
        } catch {
          setScreen("onboarding");
        }
      } else {
        setUser(null);
        setScreen("auth");
      }
    });
  }, []);

  function navigate(to) {
    if (to === "relapse-modal") { setShowRelapse(true); return; }
    if (to === "reset-modal")   { setShowReset(true); return; }
    setScreen(to);
    window.scrollTo(0, 0);
  }

  const [showRelapse, setShowRelapse] = useState(false);
  const [showReset,   setShowReset]   = useState(false);

  async function confirmRelapse() {
    setShowRelapse(false);
    const best2 = Math.max(state.streak, state.best);
    const now = new Date();
    setState(s => ({ ...s, streak: 0, best: best2, lastRelapseDate: now }));
    if (state.uid) {
      await updateDoc(doc(db, "users", state.uid), {
        streak: 0, bestStreak: best2, lastRelapseDate: Timestamp.fromDate(now),
      }).catch(() => {});
      addDoc(collection(db, "users", state.uid, "urgelogs"), {
        timestamp: serverTimestamp(), urgeType: "relapse", outcome: "relapsed", intensity: 10,
      }).catch(() => {});
    }
    showToast("Logged. You can try again tomorrow 💙");
    setScreen("dashboard");
  }

  const isApp = !["auth","onboarding","loading"].includes(screen);

  return (
    <>
      <style>{CSS}</style>

      {screen === "loading" && <LoadingOverlay msg={loadMsg} />}

      {screen !== "loading" && (
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--t1)" }}>
          <Navbar screen={screen} streak={state.streak} onNav={navigate}
            onTheme={() => setTheme(t => t === "dark" ? "light" : "dark")} theme={theme} />

          {screen === "auth"        && <AuthScreen onDone={() => {}} />}
          {screen === "onboarding"  && <OnboardingScreen user={user} toast={showToast}
            onDone={({ addictions, streak, best, lastRelapseDate }) => {
              setState(s => ({ ...s, addictions, streak, best, lastRelapseDate }));
              showToast("Welcome to Clarity! 🌿");
              setScreen("dashboard");
            }} />}
          {screen === "dashboard"   && <DashboardScreen state={state} onNav={navigate} toast={showToast} uid={state.uid} />}
          {screen === "urge"        && <UrgeScreen state={state} setState={setState} onNav={navigate} toast={showToast} uid={state.uid} />}
          {screen === "task"        && <TaskScreen state={state} setState={setState} onNav={navigate} toast={showToast} />}
          {screen === "timer"       && <TimerScreen state={state} setState={setState} onNav={navigate} toast={showToast} uid={state.uid} />}
          {screen === "feedback"    && <FeedbackScreen state={state} setState={setState} onNav={navigate} toast={showToast} uid={state.uid} />}
          {screen === "analytics"   && <AnalyticsScreen state={state} onNav={navigate} toast={showToast} uid={state.uid} />}
          {screen === "profile"     && <ProfileScreen state={state} setState={setState} onNav={navigate} toast={showToast} user={user} theme={theme} setTheme={t => { setTheme(t); if (state.uid) updateDoc(doc(db,"users",state.uid),{theme:t}).catch(()=>{}); }} />}
        </div>
      )}

      {/* Relapse Modal */}
      <Modal open={showRelapse} onClose={() => setShowRelapse(false)}
        title="Log a relapse"
        body="It takes courage to acknowledge this. Your streak resets to zero, but your personal best stays. The AI uses this to build a better plan — you're not starting over, you're learning."
        actions={<>
          <Btn variant="soft" size="md" full onClick={() => setShowRelapse(false)}>Not yet</Btn>
          <Btn variant="danger" size="md" full onClick={confirmRelapse}>Yes, log it</Btn>
        </>}
      />

      {/* Reset Modal */}
      <Modal open={showReset} onClose={() => setShowReset(false)}
        title="Reset all data?"
        body="This will permanently remove all your streaks, urge logs, and settings. You can try again tomorrow — but this action cannot be undone."
        actions={<>
          <Btn variant="soft" size="md" full onClick={() => setShowReset(false)}>Keep my data</Btn>
          <Btn variant="danger" size="md" full onClick={() => { setShowReset(false); showToast("Full reset coming with Firebase"); }}>Reset everything</Btn>
        </>}
      />

      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  );
}