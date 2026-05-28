"use client";

import {
  AlertCircle,
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit3,
  File,
  Folder,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import type {
  BoardTask,
  DisplayStatus,
  Filters,
  NavPage,
  Project,
  ProjectDraft,
  RoleEntry,
  TaskDraft,
  TaskStatus,
  UserRole,
  ViewMode,
} from "@/lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────
const DAY_MS = 86400000;
const DEMO_SESSION_KEY = "wrapboard.demo.session";
const DEMO_DATA_KEY   = "wrapboard.demo.data";
const DEMO_ROLES_KEY  = "wrapboard.demo.roles";
const MASTER_EMAIL    = "arinawj@gmail.com";

// ─── Status meta ─────────────────────────────────────────────────────────────
const statusMeta: Record<DisplayStatus, { label: string; bar: string; chip: string; dot: string }> = {
  todo:        { label: "대기",          bar: "#94a3b8", chip: "bg-slate-100 text-slate-600",    dot: "bg-slate-400"   },
  in_progress: { label: "진행중",        bar: "#3b82f6", chip: "bg-blue-100 text-blue-700",      dot: "bg-blue-500"    },
  done:        { label: "완료",          bar: "#10b981", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  warning:     { label: "3일 이내 마감", bar: "#f59e0b", chip: "bg-amber-100 text-amber-700",    dot: "bg-amber-500"   },
  delayed:     { label: "지연",          bar: "#ef4444", chip: "bg-red-100 text-red-700",         dot: "bg-red-500"     },
};

const roleLabels: Record<UserRole, string> = {
  master: "마스터", editor: "편집자", viewer: "뷰어", none: "접근불가",
};

const viewModeLabels: Record<ViewMode, string> = { day: "일", week: "주", month: "월" };

const emptyFilters: Filters = {
  advertiser: "", department: "", assignee: "", status: "", startDate: "", endDate: "",
};

// ─── Utility functions ───────────────────────────────────────────────────────
function cx(...cls: (string | false | null | undefined)[]) { return cls.filter(Boolean).join(" "); }

function toIso(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString().slice(0, 10);
}
function todayIso() { return toIso(new Date()); }
function parse(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d: Date, n: number) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function dayDiff(a: Date, b: Date) {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                     Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}
function sowDate(d: Date) { const r = new Date(d); r.setDate(r.getDate() - (r.getDay() + 6) % 7); r.setHours(12,0,0,0); return r; }
function eowDate(d: Date) { return addDays(sowDate(d), 6); }
function somDate(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1, 12); }
function eomDate(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12); }
function monthDiff(a: Date, b: Date) { return (b.getFullYear()-a.getFullYear())*12 + b.getMonth()-a.getMonth(); }
function makeId() { return typeof crypto!=="undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function fmtDate(v: string) { const d = parse(v); return `${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`; }
function daysLeft(endDate: string) { return dayDiff(parse(todayIso()), parse(endDate)); }
function normalizeEmail(e: string) { return e.trim().toLowerCase(); }

function getDisplayStatus(task: BoardTask): DisplayStatus {
  if (task.status === "done") return "done";
  const left = daysLeft(task.endDate);
  if (left < 0) return "delayed";
  if (left <= 3) return "warning";
  return task.status;
}

// ─── Demo seed ───────────────────────────────────────────────────────────────
function createDemoSeed() {
  const b = parse(todayIso());
  const projects: Project[] = [
    { id:"p1", advertiser:"모드관광", name:"모드관광 3대 랩핑", campaign:"2025 여름 캠페인", vehicleCount:3,
      memo:"외부 광고 랩핑", startDate:toIso(addDays(b,-20)), endDate:toIso(addDays(b,113)), createdAt:toIso(addDays(b,-22)), updatedAt:toIso(b) },
    { id:"p2", advertiser:"직업교육원", name:"직업교육원 트럭캠핑", campaign:"2025 하반기", vehicleCount:1,
      memo:"트럭 캠핑 광고", startDate:toIso(addDays(b,-60)), endDate:toIso(addDays(b,153)), createdAt:toIso(addDays(b,-62)), updatedAt:toIso(b) },
    { id:"p3", advertiser:"아이브릿지", name:"아이브릿지 캠페인", campaign:"2025 시즌", vehicleCount:2,
      memo:"신규 브랜드 캠페인", startDate:toIso(addDays(b,15)), endDate:toIso(addDays(b,76)), createdAt:toIso(addDays(b,-3)), updatedAt:toIso(b) },
  ];
  const tasks: BoardTask[] = [
    // p1
    { id:"t1",projectId:"p1",title:"기사섭외",department:"운영팀",assignee:"홍길동",startDate:toIso(addDays(b,-20)),endDate:toIso(addDays(b,-16)),status:"done",progress:100,memo:"완료",createdAt:toIso(addDays(b,-22)),updatedAt:toIso(b) },
    { id:"t2",projectId:"p1",title:"디자인 작업",department:"디자인팀",assignee:"김디자인",startDate:toIso(addDays(b,-18)),endDate:toIso(addDays(b,5)),status:"in_progress",progress:60,memo:"시안 수정 중",createdAt:toIso(addDays(b,-22)),updatedAt:toIso(b) },
    { id:"t3",projectId:"p1",title:"랩핑 테스트",department:"시공팀",assignee:"이테스트",startDate:toIso(addDays(b,6)),endDate:toIso(addDays(b,12)),status:"todo",progress:0,memo:"",createdAt:toIso(addDays(b,-22)),updatedAt:toIso(b) },
    { id:"t4",projectId:"p1",title:"랩핑 시공",department:"시공팀",assignee:"박시공",startDate:toIso(addDays(b,13)),endDate:toIso(addDays(b,25)),status:"todo",progress:0,memo:"",createdAt:toIso(addDays(b,-22)),updatedAt:toIso(b) },
    // p2
    { id:"t5",projectId:"p2",title:"기사섭외",department:"운영팀",assignee:"홍길동",startDate:toIso(addDays(b,-60)),endDate:toIso(addDays(b,-56)),status:"done",progress:100,memo:"",createdAt:toIso(addDays(b,-62)),updatedAt:toIso(b) },
    { id:"t6",projectId:"p2",title:"디자인 작업",department:"디자인팀",assignee:"김디자인",startDate:toIso(addDays(b,-55)),endDate:toIso(addDays(b,-41)),status:"done",progress:100,memo:"",createdAt:toIso(addDays(b,-62)),updatedAt:toIso(b) },
    { id:"t7",projectId:"p2",title:"랩핑 테스트",department:"시공팀",assignee:"이테스트",startDate:toIso(addDays(b,-40)),endDate:toIso(addDays(b,-31)),status:"in_progress",progress:80,memo:"",createdAt:toIso(addDays(b,-62)),updatedAt:toIso(b) },
    { id:"t8",projectId:"p2",title:"랩핑 시공",department:"시공팀",assignee:"박시공",startDate:toIso(addDays(b,1)),endDate:toIso(addDays(b,20)),status:"in_progress",progress:40,memo:"",createdAt:toIso(addDays(b,-62)),updatedAt:toIso(b) },
    // p3
    { id:"t9",projectId:"p3",title:"기사섭외",department:"운영팀",assignee:"홍길동",startDate:toIso(addDays(b,15)),endDate:toIso(addDays(b,20)),status:"todo",progress:50,memo:"",createdAt:toIso(addDays(b,-3)),updatedAt:toIso(b) },
    { id:"t10",projectId:"p3",title:"디자인 작업",department:"디자인팀",assignee:"김디자인",startDate:toIso(addDays(b,21)),endDate:toIso(addDays(b,45)),status:"todo",progress:0,memo:"",createdAt:toIso(addDays(b,-3)),updatedAt:toIso(b) },
    { id:"t11",projectId:"p3",title:"랩핑 테스트",department:"시공팀",assignee:"이테스트",startDate:toIso(addDays(b,46)),endDate:toIso(addDays(b,52)),status:"todo",progress:0,memo:"",createdAt:toIso(addDays(b,-3)),updatedAt:toIso(b) },
    { id:"t12",projectId:"p3",title:"랩핑 시공",department:"시공팀",assignee:"박시공",startDate:toIso(addDays(b,53)),endDate:toIso(addDays(b,76)),status:"todo",progress:0,memo:"",createdAt:toIso(addDays(b,-3)),updatedAt:toIso(b) },
  ];
  return { projects, tasks };
}

function createDefaultRoles(): RoleEntry[] {
  return [
    { email: MASTER_EMAIL, role: "master" },
    { email: "editor@wrapboard.local", role: "editor" },
    { email: "viewer@wrapboard.local", role: "viewer" },
  ];
}

// ─── Blank drafts ─────────────────────────────────────────────────────────────
function blankProject(): ProjectDraft {
  const today = todayIso();
  return { advertiser:"", name:"", campaign:"", vehicleCount:1, memo:"", startDate:today, endDate:toIso(addDays(parse(today), 90)) };
}
function blankTask(projectId: string): TaskDraft {
  const today = parse(todayIso());
  return { projectId, title:"", department:"", assignee:"", startDate:toIso(today), endDate:toIso(addDays(today,7)), status:"todo", progress:0, memo:"" };
}

// ─── DB row converters ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProject(r: any): Project {
  return { id:r.id, advertiser:r.advertiser, name:r.name, campaign:r.campaign??"", vehicleCount:r.vehicle_count??1,
           memo:r.memo??"", startDate:r.start_date??"", endDate:r.end_date??"", createdAt:r.created_at, updatedAt:r.updated_at };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTask(r: any): BoardTask {
  return { id:r.id, projectId:r.project_id, title:r.title, department:r.department??"", assignee:r.assignee??"",
           startDate:r.start_date, endDate:r.end_date, status:r.status as TaskStatus,
           progress:r.progress??0, memo:r.memo??"", createdAt:r.created_at, updatedAt:r.updated_at };
}

// ─── Timeline builder ─────────────────────────────────────────────────────────
type TimelineUnit = { key:string; label:string; subLabel:string; monthLabel:string; startDate:Date; endDate:Date };

function buildTimeline(tasks: BoardTask[], viewMode: ViewMode): TimelineUnit[] {
  const today = parse(todayIso());
  const dates = tasks.length > 0
    ? tasks.flatMap(t => [parse(t.startDate), parse(t.endDate)])
    : [addDays(today,-14), addDays(today,60)];
  const minD = new Date(Math.min(...dates.map(d=>d.getTime())));
  const maxD = new Date(Math.max(...dates.map(d=>d.getTime())));
  const units: TimelineUnit[] = [];

  if (viewMode === "day") {
    let cur = addDays(minD,-3);
    const end = addDays(maxD,5);
    while (cur <= end) {
      units.push({ key:toIso(cur), label:String(cur.getDate()), subLabel:["일","월","화","수","목","금","토"][cur.getDay()],
                   monthLabel:`${cur.getFullYear()}년 ${cur.getMonth()+1}월`, startDate:new Date(cur), endDate:new Date(cur) });
      cur = addDays(cur,1);
    }
  } else if (viewMode === "week") {
    let cur = sowDate(addDays(minD,-7));
    const end = eowDate(addDays(maxD,14));
    while (cur <= end) {
      const eow = eowDate(cur);
      const m = cur.getMonth()+1;
      units.push({ key:toIso(cur),
                   label:`${m}/${cur.getDate()}`,
                   subLabel:`~${eow.getMonth()+1}/${eow.getDate()}`,
                   monthLabel:`${cur.getFullYear()}년 ${m}월`,
                   startDate:new Date(cur), endDate:eow });
      cur = addDays(cur,7);
    }
  } else {
    let cur = somDate(minD);
    const end = somDate(addMonths(maxD,2));
    while (cur <= end) {
      units.push({ key:`${cur.getFullYear()}-${cur.getMonth()+1}`,
                   label:`${cur.getMonth()+1}월`,
                   subLabel:`${cur.getFullYear()}`,
                   monthLabel:`${cur.getFullYear()}년`,
                   startDate:new Date(cur), endDate:eomDate(cur) });
      cur = addMonths(cur,1);
    }
  }
  return units;
}

function getTaskBar(task: BoardTask, units: TimelineUnit[], viewMode: ViewMode, uw: number) {
  if (units.length === 0) return { left:0, width:uw };
  const tl = units[0].startDate;
  const s = parse(task.startDate);
  const e = parse(task.endDate);
  if (viewMode === "month") {
    const left = monthDiff(somDate(tl), somDate(s));
    const w    = monthDiff(somDate(s), somDate(e)) + 1;
    return { left: Math.max(0,left*uw), width: Math.max(uw*0.6, w*uw) };
  }
  if (viewMode === "week") {
    const left = dayDiff(tl, sowDate(s)) / 7;
    const w    = dayDiff(sowDate(s), sowDate(e)) / 7 + 1;
    return { left: Math.max(0,left*uw), width: Math.max(uw*0.6, w*uw) };
  }
  return { left: Math.max(0, dayDiff(tl,s)*uw), width: Math.max(uw*0.7, (dayDiff(s,e)+1)*uw) };
}

function getTodayPx(units: TimelineUnit[], viewMode: ViewMode, uw: number): number|null {
  if (!units.length) return null;
  const today = parse(todayIso());
  const s = units[0].startDate;
  const e = units[units.length-1].endDate;
  if (today < s || today > e) return null;
  if (viewMode === "month") return monthDiff(somDate(s), somDate(today))*uw + uw/2;
  if (viewMode === "week")  return (dayDiff(s, sowDate(today))/7)*uw + uw/2;
  return dayDiff(s, today)*uw + uw/2;
}

// progress badge
function calcProjectProgress(tasks: BoardTask[]) {
  if (!tasks.length) return 0;
  return Math.round(tasks.reduce((sum,t)=>sum+t.progress,0)/tasks.length);
}

function progressChip(pct: number) {
  if (pct===100) return "bg-emerald-100 text-emerald-700";
  if (pct>=50)   return "bg-blue-100 text-blue-700";
  if (pct>0)     return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

// ─── Small UI components ───────────────────────────────────────────────────────
function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold", className)}>{children}</span>;
}

function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-500 mb-1">{children}</label>;
}

function Btn({ children, onClick, tone="neutral", icon:Icon, type="button", disabled, small }:
  { children?:ReactNode; onClick?:()=>void; tone?:"primary"|"neutral"|"danger"|"ghost"; icon?:LucideIcon; type?:"button"|"submit"; disabled?:boolean; small?:boolean }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition border";
  const sz   = small ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  const styles = {
    primary: "bg-brand-700 border-brand-700 text-white hover:bg-brand-800",
    neutral: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
    danger:  "bg-white border-red-200 text-red-600 hover:bg-red-50",
    ghost:   "bg-transparent border-transparent text-slate-600 hover:bg-slate-100",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cx(base, sz, styles[tone], disabled && "opacity-40 pointer-events-none")}>
      {Icon && <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

function IconBtn({ icon:Icon, label, onClick, tone="neutral", disabled, small }:
  { icon:LucideIcon; label:string; onClick?:()=>void; tone?:"neutral"|"danger"|"primary"; disabled?:boolean; small?:boolean }) {
  const styles = {
    neutral: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
    danger:  "border-red-200 bg-white text-red-500 hover:bg-red-50",
    primary: "border-brand-700 bg-brand-700 text-white hover:bg-brand-800",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={cx("inline-flex items-center justify-center rounded-md border transition", small?"h-7 w-7":"h-8 w-8", styles[tone], disabled && "opacity-40")}>
      <Icon className={small?"h-3 w-3":"h-3.5 w-3.5"} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type DialogState = "project"|"task"|"roles"|null;

export default function Home() {
  const [ready,        setReady]        = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [authEmail,    setAuthEmail]    = useState(MASTER_EMAIL);
  const [password,     setPassword]     = useState("");
  const [authError,    setAuthError]    = useState("");
  const [notice,       setNotice]       = useState("");
  const [userEmail,    setUserEmail]    = useState("");
  const [role,         setRole]         = useState<UserRole>("none");
  const [roles,        setRoles]        = useState<RoleEntry[]>([]);
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [tasks,        setTasks]        = useState<BoardTask[]>([]);
  const [selectedPid,  setSelectedPid]  = useState("");
  const [collapsed,    setCollapsed]    = useState<string[]>([]);
  const [filters,      setFilters]      = useState<Filters>(emptyFilters);
  const [viewMode,     setViewMode]     = useState<ViewMode>("week");
  const [dialog,       setDialog]       = useState<DialogState>(null);
  const [projDraft,    setProjDraft]    = useState<ProjectDraft>(()=>blankProject());
  const [taskDraft,    setTaskDraft]    = useState<TaskDraft>(()=>blankTask(""));
  const [roleDraft,    setRoleDraft]    = useState<RoleEntry>({ email:"", role:"viewer" });
  const [formError,    setFormError]    = useState("");
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [activePage,   setActivePage]   = useState<NavPage>("gantt");
  const [detailTab,    setDetailTab]    = useState<"info"|"history"|"memo">("info");
  const [calMonth,     setCalMonth]     = useState<Date>(()=>{ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1); });

  const canEdit       = role==="master"||role==="editor";
  const canManage     = role==="master";
  const isDemoMode    = !hasSupabaseConfig;

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      const sr = window.localStorage.getItem(DEMO_ROLES_KEY);
      const sd = window.localStorage.getItem(DEMO_DATA_KEY);
      const seed = createDemoSeed();
      setRoles(sr ? JSON.parse(sr) : createDefaultRoles());
      if (sd) { const p=JSON.parse(sd); setProjects(p.projects); setTasks(p.tasks); }
      else { setProjects(seed.projects); setTasks(seed.tasks); }
      setUserEmail(window.localStorage.getItem(DEMO_SESSION_KEY)??"");
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => { setUserEmail(data.session?.user.email??""); setReady(true); });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_,s) => setUserEmail(s?.user.email??""));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (ready && !supabase) window.localStorage.setItem(DEMO_ROLES_KEY, JSON.stringify(roles)); }, [ready, roles]);
  useEffect(() => { if (ready && !supabase) window.localStorage.setItem(DEMO_DATA_KEY, JSON.stringify({projects,tasks})); }, [ready, projects, tasks]);

  useEffect(() => {
    if (!ready || supabase || !userEmail) return;
    setRole(roles.find(r=>r.email===normalizeEmail(userEmail))?.role??"none");
  }, [ready, roles, userEmail]);

  useEffect(() => {
    if (!ready || !supabase || !userEmail) return;
    void loadWorkspace(userEmail);
  }, [ready, userEmail]);

  useEffect(() => {
    if (!projects.some(p=>p.id===selectedPid)) setSelectedPid(projects[0]?.id??"");
  }, [projects, selectedPid]);

  // ─── Supabase load ───────────────────────────────────────────────────────
  async function loadWorkspace(email: string) {
    if (!supabase) return;
    setLoading(true);
    const { data:own } = await supabase.from("user_roles").select("email,role").eq("email",normalizeEmail(email)).maybeSingle();
    const nextRole = (own?.role as UserRole|undefined)??"none";
    setRole(nextRole);
    if (nextRole==="none") { setLoading(false); return; }
    const [{ data:pr },{ data:tr }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at",{ascending:true}),
      supabase.from("tasks").select("*").order("start_date",{ascending:true}),
    ]);
    setProjects((pr??[]).map(rowToProject));
    setTasks((tr??[]).map(rowToTask));
    if (nextRole==="master") {
      const { data:rr } = await supabase.from("user_roles").select("email,role").order("email");
      if (rr) setRoles(rr as RoleEntry[]);
    }
    setLoading(false);
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────
  async function handleLogin(e: FormEvent) {
    e.preventDefault(); setAuthError(""); setNotice("");
    const email = normalizeEmail(authEmail);
    if (!email) { setAuthError("이메일을 입력해주세요."); return; }
    if (!supabase) { window.localStorage.setItem(DEMO_SESSION_KEY, email); setUserEmail(email); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setAuthError(error.message);
  }

  async function handleGoogleLogin() {
    if (!supabase) { setNotice("데모 모드에서는 Google 로그인을 사용할 수 없습니다."); return; }
    const { error } = await supabase.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.origin }});
    if (error) setAuthError(error.message);
  }

  async function handleLogout() {
    if (supabase) { await supabase.auth.signOut(); setProjects([]); setTasks([]); }
    else window.localStorage.removeItem(DEMO_SESSION_KEY);
    setUserEmail(""); setRole("none");
  }

  // ─── Project CRUD ─────────────────────────────────────────────────────────
  function openNewProject() { setProjDraft(blankProject()); setFormError(""); setDialog("project"); }
  function openEditProject(p: Project) {
    setProjDraft({ id:p.id, advertiser:p.advertiser, name:p.name, campaign:p.campaign, vehicleCount:p.vehicleCount,
                   memo:p.memo, startDate:p.startDate, endDate:p.endDate });
    setFormError(""); setDialog("project");
  }

  async function saveProject(e: FormEvent) {
    e.preventDefault();
    const { advertiser:adv, name, campaign, vehicleCount:vc, memo, startDate:sd, endDate:ed } = projDraft;
    if (!adv.trim()||!name.trim()) { setFormError("광고주와 프로젝트명은 필수입니다."); return; }
    if (supabase) {
      setLoading(true);
      const payload = { advertiser:adv.trim(), name:name.trim(), campaign:campaign.trim(),
                        vehicle_count:vc, memo:memo.trim(), start_date:sd, end_date:ed };
      if (projDraft.id) {
        const { data,error } = await supabase.from("projects").update(payload).eq("id",projDraft.id).select("*").single();
        setLoading(false);
        if (error) { setFormError(error.message); return; }
        setProjects(cur=>cur.map(p=>p.id===projDraft.id?rowToProject(data):p));
      } else {
        const { data,error } = await supabase.from("projects").insert(payload).select("*").single();
        setLoading(false);
        if (error) { setFormError(error.message); return; }
        const np=rowToProject(data); setProjects(cur=>[...cur,np]); setSelectedPid(np.id);
      }
    } else {
      const now = new Date().toISOString();
      if (projDraft.id) {
        setProjects(cur=>cur.map(p=>p.id===projDraft.id
          ? {...p,advertiser:adv.trim(),name:name.trim(),campaign:campaign.trim(),vehicleCount:vc,memo:memo.trim(),startDate:sd,endDate:ed,updatedAt:now}:p));
      } else {
        const np:Project = { id:makeId(),advertiser:adv.trim(),name:name.trim(),campaign:campaign.trim(),vehicleCount:vc,memo:memo.trim(),startDate:sd,endDate:ed,createdAt:now,updatedAt:now };
        setProjects(cur=>[...cur,np]); setSelectedPid(np.id);
      }
    }
    setDialog(null);
  }

  async function deleteProject(p: Project) {
    if (!canEdit||!window.confirm(`"${p.name}" 프로젝트를 삭제할까요?`)) return;
    if (supabase) { const {error}=await supabase.from("projects").delete().eq("id",p.id); if(error){setNotice(error.message);return;} }
    setProjects(cur=>cur.filter(x=>x.id!==p.id));
    setTasks(cur=>cur.filter(t=>t.projectId!==p.id));
  }

  // ─── Task CRUD ─────────────────────────────────────────────────────────────
  function openNewTask(pid=selectedPid) {
    setTaskDraft(blankTask(pid||projects[0]?.id||"")); setFormError(""); setDialog("task");
  }
  function openEditTask(t: BoardTask) {
    setTaskDraft({ id:t.id,projectId:t.projectId,title:t.title,department:t.department,assignee:t.assignee,
                   startDate:t.startDate,endDate:t.endDate,status:t.status,progress:t.progress,memo:t.memo });
    setFormError(""); setDialog("task");
  }

  async function saveTask(e: FormEvent) {
    e.preventDefault();
    const { title, department, assignee, startDate, endDate, status, progress, memo, projectId } = taskDraft;
    if (!projectId||!title.trim()||!startDate||!endDate) { setFormError("프로젝트, 업무명, 시작일, 종료일은 필수입니다."); return; }
    if (parse(startDate)>parse(endDate)) { setFormError("종료일은 시작일 이후여야 합니다."); return; }
    const payload = { project_id:projectId, title:title.trim(), department:department.trim(), assignee:assignee.trim(),
                      start_date:startDate, end_date:endDate, status, progress, memo:memo.trim() };
    if (supabase) {
      setLoading(true);
      if (taskDraft.id) {
        const { data,error } = await supabase.from("tasks").update(payload).eq("id",taskDraft.id).select("*").single();
        setLoading(false);
        if (error) { setFormError(error.message); return; }
        setTasks(cur=>cur.map(t=>t.id===taskDraft.id?rowToTask(data):t));
      } else {
        const { data,error } = await supabase.from("tasks").insert(payload).select("*").single();
        setLoading(false);
        if (error) { setFormError(error.message); return; }
        setTasks(cur=>[...cur,rowToTask(data)]);
      }
    } else {
      const now = new Date().toISOString();
      if (taskDraft.id) {
        setTasks(cur=>cur.map(t=>t.id===taskDraft.id
          ?{...t,...taskDraft,projectId,title:title.trim(),department:department.trim(),assignee:assignee.trim(),memo:memo.trim(),updatedAt:now}:t));
      } else {
        setTasks(cur=>[...cur,{id:makeId(),projectId,title:title.trim(),department:department.trim(),assignee:assignee.trim(),startDate,endDate,status,progress,memo:memo.trim(),createdAt:now,updatedAt:now}]);
      }
    }
    setDialog(null);
  }

  async function deleteTask(t: BoardTask) {
    if (!canEdit||!window.confirm(`"${t.title}" 업무를 삭제할까요?`)) return;
    if (supabase) { const {error}=await supabase.from("tasks").delete().eq("id",t.id); if(error){setNotice(error.message);return;} }
    setTasks(cur=>cur.filter(x=>x.id!==t.id));
  }

  // ─── Role management ──────────────────────────────────────────────────────
  async function saveRole(e: FormEvent) {
    e.preventDefault();
    const email = normalizeEmail(roleDraft.email);
    if (!email) { setFormError("이메일을 입력해주세요."); return; }
    const entry: RoleEntry = { email, role:roleDraft.role };
    if (supabase) { const {error}=await supabase.from("user_roles").upsert(entry); if(error){setFormError(error.message);return;} }
    setRoles(cur => { const ex=cur.some(r=>r.email===email); return ex?cur.map(r=>r.email===email?entry:r):[...cur,entry].sort((a,b)=>a.email.localeCompare(b.email)); });
    setRoleDraft({email:"",role:"viewer"}); setFormError("");
  }

  async function deleteRole(entry: RoleEntry) {
    if (entry.email===userEmail) { setFormError("자신의 권한은 삭제할 수 없습니다."); return; }
    if (supabase) { const {error}=await supabase.from("user_roles").delete().eq("email",entry.email); if(error){setFormError(error.message);return;} }
    setRoles(cur=>cur.filter(r=>r.email!==entry.email));
  }

  // ─── Derived data ─────────────────────────────────────────────────────────
  const projMap = useMemo(()=>new Map(projects.map(p=>[p.id,p])),[projects]);

  const visibleTasks = useMemo(()=>tasks.filter(t=>{
    const p=projMap.get(t.projectId);
    if(!p) return false;
    if(filters.advertiser && p.advertiser!==filters.advertiser) return false;
    if(filters.department && t.department!==filters.department) return false;
    if(filters.assignee   && t.assignee!==filters.assignee)     return false;
    if(filters.status) {
      if(getDisplayStatus(t)!==filters.status) return false;
    }
    if(filters.startDate && parse(t.endDate)<parse(filters.startDate))   return false;
    if(filters.endDate   && parse(t.startDate)>parse(filters.endDate))   return false;
    return true;
  }),[tasks,projMap,filters]);

  const visibleProjects = useMemo(()=>projects.filter(p=>{
    if(filters.advertiser && p.advertiser!==filters.advertiser) return false;
    if(filters.department||filters.assignee||filters.status||filters.startDate||filters.endDate)
      return visibleTasks.some(t=>t.projectId===p.id);
    return true;
  }),[projects,visibleTasks,filters]);

  const tasksByProj = useMemo(()=>{
    const m=new Map<string,BoardTask[]>();
    for(const t of visibleTasks) m.set(t.projectId,[...(m.get(t.projectId)??[]),t]);
    return m;
  },[visibleTasks]);

  const filterOpts = useMemo(()=>({
    advertisers:[...new Set(projects.map(p=>p.advertiser))],
    departments:[...new Set(tasks.map(t=>t.department).filter(Boolean))],
    assignees:  [...new Set(tasks.map(t=>t.assignee).filter(Boolean))],
  }),[projects,tasks]);

  const dashboard = useMemo(()=>{
    const today=todayIso(); const td=parse(today); const thr=addDays(td,3);
    const active=visibleTasks.filter(t=>t.status!=="done");
    return {
      todayDue:      active.filter(t=>t.endDate===today).length,
      delayed:       active.filter(t=>parse(t.endDate)<td).length,
      dueSoon:       active.filter(t=>{ const e=parse(t.endDate); return e>td&&e<=thr; }).length,
      construction:  active.filter(t=>{ const isc=t.department.includes("시공")||t.title.includes("시공");
                                         const sw=sowDate(td); const ew=eowDate(td);
                                         return isc&&(parse(t.startDate)<=ew&&parse(t.endDate)>=sw); }).length,
      progress:      visibleTasks.length?Math.round(visibleTasks.reduce((s,t)=>s+t.progress,0)/visibleTasks.length):0,
    };
  },[visibleTasks]);

  // Gantt
  const units    = useMemo(()=>buildTimeline(visibleTasks,viewMode),[visibleTasks,viewMode]);
  const uw       = viewMode==="day"?40:viewMode==="week"?88:112;
  const tlW      = units.length*uw;
  const todayPx  = getTodayPx(units,viewMode,uw);
  const leftW    = 480; // gantt left panel width

  // Selected project
  const selProject = projMap.get(selectedPid);
  const selTasks   = tasks.filter(t=>t.projectId===selectedPid);

  // Notifications count (delayed + due soon)
  const alertCount = dashboard.delayed + dashboard.dueSoon;

  // ─── Calendar derived ────────────────────────────────────────────────────
  const calYear  = calMonth.getFullYear();
  const calMon   = calMonth.getMonth();
  const calOffset = (new Date(calYear, calMon, 1).getDay() + 6) % 7;
  const calDays   = new Date(calYear, calMon + 1, 0).getDate();
  const calCells: (number|null)[] = [
    ...Array(calOffset).fill(null),
    ...Array.from({ length: calDays }, (_, i) => i + 1),
  ];
  while (calCells.length % 7 !== 0) calCells.push(null);
  const calMonPad = String(calMon + 1).padStart(2, "0");
  const calTaskMap = new Map<string, BoardTask[]>();
  tasks.forEach(t => {
    if (t.endDate.slice(0, 7) === `${calYear}-${calMonPad}`) {
      calTaskMap.set(t.endDate, [...(calTaskMap.get(t.endDate) ?? []), t]);
    }
  });

  // ─── Render: loading ──────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <div className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-slate-600 shadow-soft">
          운영보드를 준비하는 중입니다...
        </div>
      </div>
    );
  }

  // ─── Render: login ────────────────────────────────────────────────────────
  if (!userEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
        <section className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 shadow-soft">
              <Truck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">랩핑 프로젝트 운영보드</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isDemoMode ? "데모 모드 · Supabase 미연결" : "Google 계정으로 로그인"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            {/* Google OAuth button */}
            <button type="button" onClick={handleGoogleLogin}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google 계정으로 로그인
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"/></div>
              <div className="relative flex justify-center text-xs text-slate-400"><span className="bg-white px-2">또는 이메일로 로그인</span></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label>이메일</Label>
                <input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} type="email" placeholder="name@example.com"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"/>
              </div>
              {supabase && (
                <div>
                  <Label>비밀번호</Label>
                  <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="비밀번호"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition"/>
                </div>
              )}
              {authError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>}
              {notice    && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600">{notice}</p>}
              <Btn type="submit" tone="primary" disabled={loading} icon={ShieldCheck}>
                {loading?"로그인 중...":"로그인"}
              </Btn>
            </form>

            {isDemoMode && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold text-slate-400">데모 계정으로 빠른 로그인</p>
                <div className="space-y-1.5">
                  {createDefaultRoles().map(r=>(
                    <button key={r.email} type="button" onClick={()=>setAuthEmail(r.email)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50 transition">
                      <span className="font-medium text-slate-700">{r.email}</span>
                      <Chip className={{ master:"bg-brand-100 text-brand-700", editor:"bg-emerald-100 text-emerald-700", viewer:"bg-sky-100 text-sky-700", none:"bg-red-100 text-red-700" }[r.role]}>
                        {roleLabels[r.role]}
                      </Chip>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ─── Render: no access ────────────────────────────────────────────────────
  if (role==="none") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-soft text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-500"/>
          </div>
          <h2 className="text-lg font-bold text-slate-900">접근 권한이 없습니다</h2>
          <p className="mt-2 text-sm text-slate-500">{userEmail}</p>
          <p className="mt-3 text-sm text-slate-600">마스터에게 권한 등록을 요청해주세요.</p>
          <div className="mt-5"><Btn onClick={handleLogout} icon={LogOut}>로그아웃</Btn></div>
        </section>
      </div>
    );
  }

  // ─── Render: main board ───────────────────────────────────────────────────
  const navItems: { page:NavPage; icon:LucideIcon; label:string }[] = [
    { page:"dashboard", icon:LayoutDashboard, label:"대시보드" },
    { page:"gantt",     icon:BarChart3,        label:"간트차트" },
    { page:"board",     icon:ClipboardList,    label:"업무보드" },
    { page:"calendar",  icon:Calendar,         label:"캘린더" },
    { page:"alerts",    icon:Bell,             label:"알림" },
    { page:"reports",   icon:File,             label:"보고서" },
    { page:"files",     icon:Folder,           label:"파일" },
    { page:"settings",  icon:Settings,         label:"설정" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-brand-50">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={cx(
        "flex flex-col bg-sidebar text-white transition-all duration-200 shrink-0",
        sidebarOpen ? "w-56" : "w-16"
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500">
            <Truck className="h-5 w-5 text-white"/>
          </div>
          {sidebarOpen && (
            <span className="text-sm font-bold leading-tight">
              랩핑 프로젝트<br/>
              <span className="text-brand-300 text-xs font-semibold">운영보드</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navItems.map(item=>(
            <button key={item.page} type="button" onClick={()=>setActivePage(item.page)}
              title={!sidebarOpen?item.label:undefined}
              className={cx(
                "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition",
                activePage===item.page
                  ? "bg-brand-600 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}>
              <item.icon className="h-4 w-4 shrink-0"/>
              {sidebarOpen && (
                <span className="truncate">{item.label}</span>
              )}
              {sidebarOpen && item.page==="alerts" && alertCount>0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold px-1">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* New project button */}
        <div className="px-2 py-3 border-t border-white/10">
          <button type="button" onClick={openNewProject} disabled={!canEdit}
            className={cx(
              "flex w-full items-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-brand-500",
              !canEdit && "opacity-40 pointer-events-none"
            )}>
            <Plus className="h-4 w-4 shrink-0"/>
            {sidebarOpen && "새 프로젝트"}
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-card">
          <div className="flex items-center gap-3">
            <button type="button" onClick={()=>setSidebarOpen(v=>!v)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition">
              <Menu className="h-5 w-5"/>
            </button>
            <h2 className="text-sm font-bold text-slate-800">
              {navItems.find(n=>n.page===activePage)?.label ?? "간트차트"}
            </h2>
            {isDemoMode && (
              <Chip className="bg-amber-100 text-amber-700">데모 DB</Chip>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Btn icon={Plus} tone="primary" small onClick={openNewProject}>프로젝트</Btn>
            )}
            {canEdit && projects.length>0 && (
              <Btn icon={Plus} tone="neutral" small onClick={()=>openNewTask()}>업무</Btn>
            )}
            {canManage && (
              <IconBtn icon={Users} label="권한 관리" onClick={()=>{setFormError("");setDialog("roles");}}/>
            )}
            {/* Bell */}
            <div className="relative">
              <IconBtn icon={Bell} label="알림"/>
              {alertCount>0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {alertCount}
                </span>
              )}
            </div>
            {/* User */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[120px] truncate text-xs font-semibold text-slate-700">{userEmail}</span>
              <Chip className={{ master:"bg-brand-100 text-brand-700", editor:"bg-emerald-100 text-emerald-700", viewer:"bg-sky-100 text-sky-700", none:"bg-red-100 text-red-700" }[role]}>
                {roleLabels[role]}
              </Chip>
            </div>
            <IconBtn icon={LogOut} label="로그아웃" onClick={handleLogout}/>
          </div>
        </header>

        {/* Content area */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Notices */}
          {(notice||authError) && (
            <div className={cx("mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm", notice?"bg-blue-50 text-blue-700 border border-blue-200":"bg-red-50 text-red-700 border border-red-200")}>
              {notice||authError}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              대시보드 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="dashboard" && (
            <div className="flex-1 overflow-auto thin-scroll p-4 space-y-4">
              {/* 5 big metric cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                {[
                  { icon:Calendar,    label:"오늘 마감",        value:dashboard.todayDue,     unit:"건", color:"text-blue-600",   bg:"bg-blue-50",    border:"border-blue-200"    },
                  { icon:AlertCircle, label:"지연 업무",         value:dashboard.delayed,      unit:"건", color:"text-red-600",    bg:"bg-red-50",     border:"border-red-200"     },
                  { icon:AlertCircle, label:"3일 이내 마감",    value:dashboard.dueSoon,      unit:"건", color:"text-amber-600",  bg:"bg-amber-50",   border:"border-amber-200"   },
                  { icon:Truck,       label:"이번주 시공 예정", value:dashboard.construction, unit:"건", color:"text-brand-600",  bg:"bg-brand-50",   border:"border-brand-200"   },
                  { icon:BarChart3,   label:"전체 진행률",      value:dashboard.progress,     unit:"%",  color:"text-emerald-600",bg:"bg-emerald-50", border:"border-emerald-200" },
                ].map(c=>(
                  <div key={c.label} className={cx("rounded-xl border bg-white p-5 shadow-card", c.border)}>
                    <div className={cx("mb-3 flex h-11 w-11 items-center justify-center rounded-xl", c.bg)}>
                      <c.icon className={cx("h-6 w-6", c.color)}/>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">{c.label}</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">{c.value}<span className="ml-1 text-base font-semibold text-slate-500">{c.unit}</span></p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {/* Project status table */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">프로젝트 현황</h3>
                    {canEdit && <Btn small icon={Plus} tone="primary" onClick={openNewProject}>새 프로젝트</Btn>}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {projects.length===0 && <p className="p-4 text-sm text-slate-400">프로젝트가 없습니다.</p>}
                    {projects.map(p=>{
                      const pt=tasks.filter(t=>t.projectId===p.id);
                      const prog=calcProjectProgress(pt);
                      const doneCnt=pt.filter(t=>t.status==="done").length;
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                             onClick={()=>{setSelectedPid(p.id);setActivePage("gantt");}}>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.advertiser} · {pt.length}개 업무 · 완료 {doneCnt}개</p>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200">
                              <div className="h-1.5 rounded-full bg-brand-600 transition-all" style={{width:`${prog}%`}}/>
                            </div>
                          </div>
                          <Chip className={progressChip(prog)}>{prog}%</Chip>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Attention required */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">주의 필요 업무</h3>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[340px] overflow-auto thin-scroll">
                    {tasks.filter(t=>getDisplayStatus(t)==="delayed"||getDisplayStatus(t)==="warning").length===0 && (
                      <p className="p-4 text-sm text-slate-400">주의가 필요한 업무가 없습니다.</p>
                    )}
                    {tasks.filter(t=>getDisplayStatus(t)==="delayed"||getDisplayStatus(t)==="warning")
                      .sort((a,b)=>a.endDate.localeCompare(b.endDate))
                      .map(t=>{
                        const ds=getDisplayStatus(t);
                        const p=projMap.get(t.projectId);
                        return (
                          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                            <span className={cx("h-2 w-2 shrink-0 rounded-full", statusMeta[ds].dot)}/>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                              <p className="text-xs text-slate-400">{p?.name} · {t.assignee||"미배정"}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <Chip className={statusMeta[ds].chip}>{statusMeta[ds].label}</Chip>
                              <p className="mt-0.5 text-[10px] text-slate-400">{t.endDate}</p>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              </div>

              {/* Department workload */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">부서별 업무 현황</h3>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {[...new Set(tasks.map(t=>t.department).filter(Boolean))].map(dept=>{
                    const dTasks=tasks.filter(t=>t.department===dept);
                    const dDone=dTasks.filter(t=>t.status==="done").length;
                    const dProg=Math.round(dTasks.reduce((s,t)=>s+t.progress,0)/(dTasks.length||1));
                    return (
                      <div key={dept} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs font-bold text-slate-700">{dept}</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{dTasks.length}<span className="text-xs font-normal text-slate-400">개</span></p>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200">
                          <div className="h-1.5 rounded-full bg-brand-500" style={{width:`${dProg}%`}}/>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">완료 {dDone}개 · {dProg}%</p>
                      </div>
                    );
                  })}
                  {[...new Set(tasks.map(t=>t.department).filter(Boolean))].length===0 && (
                    <p className="col-span-4 text-sm text-slate-400 p-2">데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              간트차트 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="gantt" && (<>
          {/* ── Dashboard cards ──────────────────────────────────────────── */}
          <div className="shrink-0 grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 xl:grid-cols-5">
            {[
              { icon:Calendar,    label:"오늘 마감",        value:dashboard.todayDue,    unit:"건", color:"text-blue-600",   bg:"bg-blue-50"   },
              { icon:AlertCircle, label:"지연 업무",         value:dashboard.delayed,     unit:"건", color:"text-red-600",    bg:"bg-red-50"    },
              { icon:AlertCircle, label:"3일 이내 마감",    value:dashboard.dueSoon,     unit:"건", color:"text-amber-600",  bg:"bg-amber-50"  },
              { icon:Truck,       label:"이번주 시공 예정", value:dashboard.construction,unit:"건", color:"text-brand-600",  bg:"bg-brand-50"  },
              { icon:BarChart3,   label:"전체 진행률",      value:dashboard.progress,    unit:"%",  color:"text-emerald-600",bg:"bg-emerald-50"},
            ].map(c=>(
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{c.label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-slate-900">{c.value}<span className="ml-0.5 text-sm font-semibold">{c.unit}</span></p>
                  </div>
                  <div className={cx("flex h-9 w-9 items-center justify-center rounded-lg", c.bg)}>
                    <c.icon className={cx("h-5 w-5", c.color)}/>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Filter bar ───────────────────────────────────────────────── */}
          <div className="shrink-0 mx-4 mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            {/* Filters */}
            {[
              { key:"advertiser" as const, label:"광고주", opts:filterOpts.advertisers },
              { key:"department" as const, label:"부서",   opts:filterOpts.departments },
              { key:"assignee"   as const, label:"담당자", opts:filterOpts.assignees   },
            ].map(f=>(
              <div key={f.key} className="min-w-[100px]">
                <Label>{f.label}</Label>
                <select value={filters[f.key]} onChange={e=>setFilters(c=>({...c,[f.key]:e.target.value}))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-brand-500 transition">
                  <option value="">전체</option>
                  {f.opts.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            ))}
            <div className="min-w-[88px]">
              <Label>상태</Label>
              <select value={filters.status} onChange={e=>setFilters(c=>({...c,status:e.target.value as Filters["status"]}))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-brand-500 transition">
                <option value="">전체</option>
                {(Object.keys(statusMeta) as DisplayStatus[]).map(s=><option key={s} value={s}>{statusMeta[s].label}</option>)}
              </select>
            </div>
            <div>
              <Label>기간</Label>
              <div className="flex items-center gap-1">
                <input type="date" value={filters.startDate} onChange={e=>setFilters(c=>({...c,startDate:e.target.value}))}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-brand-500 transition"/>
                <span className="text-xs text-slate-400">~</span>
                <input type="date" value={filters.endDate} onChange={e=>setFilters(c=>({...c,endDate:e.target.value}))}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-brand-500 transition"/>
              </div>
            </div>
            <Btn small onClick={()=>setFilters(emptyFilters)}>초기화</Btn>

            <div className="ml-auto flex items-end gap-2">
              {/* View mode toggle */}
              <div>
                <Label>보기</Label>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {(["day","week","month"] as ViewMode[]).map(m=>(
                    <button key={m} type="button" onClick={()=>setViewMode(m)}
                      className={cx("h-8 rounded-md px-3 text-xs font-semibold transition",
                        viewMode===m?"bg-white text-slate-900 shadow-card":"text-slate-500 hover:text-slate-800")}>
                      {viewModeLabels[m]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Gantt + project list ──────────────────────────────────────── */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden mx-4 mt-3 mb-4 rounded-xl border border-slate-200 bg-white shadow-card">
            {/* Gantt header row */}
            <div className="shrink-0 flex border-b border-slate-200 bg-slate-50">
              {/* Left header */}
              <div className="shrink-0 flex text-xs font-bold text-slate-500 uppercase tracking-wide" style={{width:leftW}}>
                <div className="flex-1 flex items-center px-4 py-3 border-r border-slate-200">프로젝트 / 업무</div>
                <div className="w-20 flex items-center justify-center border-r border-slate-200">담당자</div>
                <div className="w-20 flex items-center justify-center border-r border-slate-200">진행률</div>
                <div className="w-32 flex items-center justify-center">기간</div>
              </div>
              {/* Right header - scrollable month+week labels */}
              <div className="flex-1 overflow-hidden border-l border-slate-200">
                <div className="overflow-x-auto gantt-scroll">
                  <div className="flex" style={{width:tlW}}>
                    {units.map(u=>(
                      <div key={u.key} className="shrink-0 flex flex-col items-center justify-center border-r border-slate-100 py-2"
                           style={{width:uw}}>
                        <span className="text-[11px] font-bold text-slate-700">{u.label}</span>
                        <span className="text-[10px] text-slate-400">{u.subLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Gantt body */}
            <div className="flex flex-1 min-h-0">
              {/* Left panel (fixed) */}
              <div className="shrink-0 flex flex-col overflow-y-auto thin-scroll border-r border-slate-200" style={{width:leftW}}>
                {visibleProjects.length===0 && (
                  <p className="p-6 text-sm text-slate-400">프로젝트가 없습니다.</p>
                )}
                {visibleProjects.map(p=>{
                  const ptasks = tasksByProj.get(p.id)??[];
                  const prog   = calcProjectProgress(tasks.filter(t=>t.projectId===p.id));
                  const col    = collapsed.includes(p.id);
                  const isSelected = selectedPid===p.id;
                  return (
                    <div key={p.id}>
                      {/* Project row */}
                      <div className={cx("flex items-center border-b border-slate-100 min-h-[48px] cursor-pointer group",
                                          isSelected?"bg-brand-50":"hover:bg-slate-50")}
                           onClick={()=>setSelectedPid(p.id)}>
                        <div className="flex flex-1 items-center gap-2 px-3 min-w-0">
                          <button type="button" onClick={e=>{e.stopPropagation();setCollapsed(c=>c.includes(p.id)?c.filter(x=>x!==p.id):[...c,p.id]);}}
                            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-brand-400">
                            {col?<ChevronRight className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}
                          </button>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-800">{p.name}</p>
                            <p className="truncate text-[10px] text-slate-400">{p.advertiser}</p>
                          </div>
                        </div>
                        <div className="w-20 flex items-center justify-center shrink-0">
                          <span className="text-xs text-slate-400">{ptasks.length}개</span>
                        </div>
                        <div className="w-20 flex items-center justify-center shrink-0">
                          <Chip className={progressChip(prog)}>{prog}%</Chip>
                        </div>
                        <div className="w-32 flex items-center justify-center shrink-0 text-[10px] text-slate-500">
                          {p.startDate?fmtDate(p.startDate):""} ~ {p.endDate?fmtDate(p.endDate):""}
                        </div>
                        {/* Edit/delete on hover */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1 transition" onClick={e=>e.stopPropagation()}>
                          {canEdit && <IconBtn icon={Edit3} label="수정" onClick={()=>openEditProject(p)} small/>}
                          {canEdit && <IconBtn icon={Trash2} label="삭제" tone="danger" onClick={()=>void deleteProject(p)} small/>}
                        </div>
                      </div>
                      {/* Task rows */}
                      {!col && ptasks.map((t,i)=>{
                        const ds = getDisplayStatus(t);
                        return (
                          <div key={t.id} className="flex items-center border-b border-slate-100 min-h-[44px] hover:bg-slate-50 group">
                            <div className="flex flex-1 items-center gap-2 px-3 pl-8 min-w-0">
                              <span className="shrink-0 text-[10px] font-bold text-slate-400">{i+1}</span>
                              <span className="min-w-0 truncate text-xs font-medium text-slate-700">{t.title}</span>
                            </div>
                            <div className="w-20 flex items-center justify-center shrink-0">
                              <span className="text-[11px] text-slate-500 truncate px-1">{t.assignee||"-"}</span>
                            </div>
                            <div className="w-20 flex items-center justify-center shrink-0">
                              <Chip className={progressChip(t.progress)}>{t.progress}%</Chip>
                            </div>
                            <div className="w-32 flex items-center justify-center shrink-0 text-[10px] text-slate-500">
                              {fmtDate(t.startDate)} ~ {fmtDate(t.endDate)}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1 transition" onClick={e=>e.stopPropagation()}>
                              {canEdit && <IconBtn icon={Edit3} label="수정" onClick={()=>openEditTask(t)} small/>}
                              {canEdit && <IconBtn icon={Trash2} label="삭제" tone="danger" onClick={()=>void deleteTask(t)} small/>}
                            </div>
                            {/* Status indicator */}
                            <span className={cx("mr-1 h-2 w-2 shrink-0 rounded-full", statusMeta[ds].dot)}/>
                          </div>
                        );
                      })}
                      {!col && ptasks.length===0 && (
                        <div className="flex min-h-[40px] items-center border-b border-slate-100 pl-12 text-xs text-slate-400">
                          업무 없음
                          {canEdit && (
                            <button type="button" onClick={()=>openNewTask(p.id)} className="ml-2 text-brand-600 hover:underline text-xs">+ 업무 추가</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right panel (scrollable timeline) */}
              <div className="flex-1 min-w-0 overflow-auto gantt-scroll relative" id="gantt-right">
                <div className="relative" style={{width:tlW, minHeight:"100%"}}>
                  {/* TODAY line */}
                  {todayPx!==null && (
                    <div className="pointer-events-none absolute top-0 bottom-0 z-30 border-l-2 border-dashed border-red-400" style={{left:todayPx}}>
                      <span className="absolute -left-6 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">TODAY</span>
                    </div>
                  )}
                  {/* Grid columns */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {units.map(u=>(
                      <div key={u.key} className="h-full shrink-0 border-r border-slate-100" style={{width:uw}}/>
                    ))}
                  </div>

                  {/* Task bars */}
                  {visibleProjects.map(p=>{
                    const ptasks = tasksByProj.get(p.id)??[];
                    const col    = collapsed.includes(p.id);
                    const projRowH = 48;
                    const taskRowH = 44;
                    return (
                      <div key={p.id}>
                        {/* Project row placeholder */}
                        <div style={{height:projRowH}} className="border-b border-slate-100"/>
                        {/* Task rows with bars */}
                        {!col && ptasks.map(t=>{
                          const ds  = getDisplayStatus(t);
                          const bar = getTaskBar(t,units,viewMode,uw);
                          return (
                            <div key={t.id} className="relative border-b border-slate-100" style={{height:taskRowH}}>
                              <div className="absolute inset-0 flex">
                                {units.map(u=>(
                                  <div key={u.key} className="h-full shrink-0 border-r border-slate-100" style={{width:uw}}/>
                                ))}
                              </div>
                              <div
                                className="absolute top-2.5 z-10 flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold text-white shadow-sm cursor-pointer hover:opacity-90 transition"
                                style={{ left:bar.left, width:bar.width, backgroundColor:statusMeta[ds].bar }}
                                title={`${t.title} · ${t.startDate} ~ ${t.endDate} · ${statusMeta[ds].label}`}
                                onClick={()=>{ setSelectedPid(t.projectId); openEditTask(t); }}
                              >
                                <span className="truncate">{t.title}</span>
                                {bar.width>70 && <span className="ml-auto shrink-0 pl-2 opacity-80 text-[10px]">{statusMeta[ds].label}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {!col && ptasks.length===0 && <div style={{height:taskRowH}} className="border-b border-slate-100"/>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="shrink-0 flex items-center gap-4 border-t border-slate-100 px-4 py-2">
              {(Object.entries(statusMeta) as [DisplayStatus, typeof statusMeta[DisplayStatus]][]).map(([k,v])=>(
                <div key={k} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{backgroundColor:v.bar}}/>
                  <span className="text-[11px] text-slate-500">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Project detail panel ─────────────────────────────────────── */}
          {selProject && (
            <div className="shrink-0 mx-4 mb-4 rounded-xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900">{selProject.name}</span>
                  <Chip className={progressChip(calcProjectProgress(selTasks))}>
                    {calcProjectProgress(selTasks)}%
                  </Chip>
                  {selTasks.every(t=>t.status==="done") && selTasks.length>0
                    ? <Chip className="bg-emerald-100 text-emerald-700">완료</Chip>
                    : <Chip className="bg-blue-100 text-blue-700">진행중</Chip>
                  }
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && <Btn small icon={Edit3} tone="neutral" onClick={()=>openEditProject(selProject)}>수정</Btn>}
                  {canEdit && <Btn small icon={Plus} tone="primary" onClick={()=>openNewTask(selProject.id)}>업무 추가</Btn>}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-0 border-b border-slate-100">
                {(["info","history","memo"] as const).map(tab=>(
                  <button key={tab} type="button" onClick={()=>setDetailTab(tab)}
                    className={cx("px-4 py-2.5 text-xs font-semibold transition border-b-2",
                      detailTab===tab?"border-brand-600 text-brand-700":"border-transparent text-slate-500 hover:text-slate-700")}>
                    {tab==="info"?"상세정보":tab==="history"?"업무 히스토리":"메모"}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {detailTab==="info" && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
                    {/* Left: project info */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm content-start">
                      {[
                        ["광고주", selProject.advertiser],
                        ["캠페인", selProject.campaign||"-"],
                        ["차량 대수", `${selProject.vehicleCount}대`],
                        ["시작일", selProject.startDate||"-"],
                        ["마감일", selProject.endDate||"-"],
                        ["남은 기간", selProject.endDate ? `D-${daysLeft(selProject.endDate)}일` : "-"],
                      ].map(([k,v])=>(
                        <div key={k}>
                          <p className="text-xs text-slate-400">{k}</p>
                          <p className={cx("font-semibold text-slate-800",
                            k==="남은 기간" && daysLeft(selProject.endDate??"")<0 ? "text-red-600" :
                            k==="남은 기간" && daysLeft(selProject.endDate??"")<4  ? "text-amber-600" : "")}>{v}</p>
                        </div>
                      ))}
                      {/* progress bar */}
                      <div className="col-span-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400">전체 진행률</span>
                          <span className="font-bold text-brand-700">{calcProjectProgress(selTasks)}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200">
                          <div className="h-2 rounded-full bg-brand-600 transition-all" style={{width:`${calcProjectProgress(selTasks)}%`}}/>
                        </div>
                      </div>
                    </div>

                    {/* Right: task table */}
                    <div className="overflow-auto thin-scroll">
                      <table className="w-full min-w-[600px] border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-slate-500">
                            {["업무","부서","담당자","시작일","종료일","진행률","상태","남은기간"].map(h=>(
                              <th key={h} className="py-2 pr-3 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selTasks.map(t=>{
                            const ds = getDisplayStatus(t);
                            const left = daysLeft(t.endDate);
                            return (
                              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-2 pr-3 font-medium text-slate-800">{t.title}</td>
                                <td className="py-2 pr-3 text-slate-500">{t.department||"-"}</td>
                                <td className="py-2 pr-3 text-slate-500">{t.assignee||"-"}</td>
                                <td className="py-2 pr-3 text-slate-500">{t.startDate}</td>
                                <td className="py-2 pr-3 text-slate-500">{t.endDate}</td>
                                <td className="py-2 pr-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-16 rounded-full bg-slate-200">
                                      <div className={cx("h-1.5 rounded-full", progressChip(t.progress).includes("emerald")?"bg-emerald-500":progressChip(t.progress).includes("blue")?"bg-blue-500":"bg-amber-500")} style={{width:`${t.progress}%`}}/>
                                    </div>
                                    <span className="font-bold" style={{color:statusMeta[ds].bar}}>{t.progress}%</span>
                                  </div>
                                </td>
                                <td className="py-2 pr-3">
                                  <Chip className={statusMeta[ds].chip}>{statusMeta[ds].label}</Chip>
                                </td>
                                <td className={cx("py-2 pr-3 font-semibold", left<0?"text-red-600":left<=3?"text-amber-600":"text-slate-600")}>
                                  {t.status==="done"?"-":`D-${left}`}
                                </td>
                              </tr>
                            );
                          })}
                          {selTasks.length===0 && (
                            <tr><td colSpan={8} className="py-4 text-center text-slate-400">업무가 없습니다.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailTab==="memo" && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap min-h-[60px]">{selProject.memo||"메모 없음"}</p>
                )}

                {detailTab==="history" && (
                  <p className="text-sm text-slate-400">업무 히스토리 기능은 2차 업데이트에서 제공됩니다.</p>
                )}
              </div>
            </div>
          )}
          </>)}
          {/* end gantt page */}

          {/* ════════════════════════════════════════════════════════════════
              업무보드 (칸반) 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="board" && (
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              <div className="mb-3 flex items-center gap-2">
                {canEdit && <Btn small icon={Plus} tone="primary" onClick={()=>openNewTask()}>업무 추가</Btn>}
                <span className="text-xs text-slate-400">총 {tasks.length}개 업무</span>
              </div>
              <div className="flex flex-1 gap-4 overflow-x-auto thin-scroll">
                {([
                  { status:"todo"        as const, label:"대기",   border:"border-slate-300",  head:"bg-slate-100 text-slate-700" },
                  { status:"in_progress" as const, label:"진행중", border:"border-blue-300",   head:"bg-blue-50 text-blue-700"   },
                  { status:"done"        as const, label:"완료",   border:"border-emerald-300",head:"bg-emerald-50 text-emerald-700" },
                ]).map(col=>{
                  const colTasks=tasks.filter(t=>t.status===col.status);
                  return (
                    <div key={col.status} className={cx("flex w-72 shrink-0 flex-col rounded-xl border-2 bg-white shadow-card", col.border)}>
                      <div className={cx("flex items-center justify-between rounded-t-xl px-3 py-2.5", col.head)}>
                        <span className="text-sm font-bold">{col.label}</span>
                        <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold">{colTasks.length}</span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 overflow-y-auto thin-scroll p-2">
                        {colTasks.map(t=>{
                          const p=projMap.get(t.projectId);
                          const ds=getDisplayStatus(t);
                          return (
                            <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-card hover:shadow-soft transition cursor-pointer"
                                 onClick={()=>canEdit&&openEditTask(t)}>
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800 leading-snug">{t.title}</p>
                                <Chip className={statusMeta[ds].chip}>{statusMeta[ds].label}</Chip>
                              </div>
                              <p className="text-xs text-slate-400 truncate">{p?.name||"-"}</p>
                              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                                <span>{t.department||"-"} · {t.assignee||"미배정"}</span>
                                <span className={daysLeft(t.endDate)<0?"text-red-500":daysLeft(t.endDate)<=3?"text-amber-500":""}>
                                  {t.status==="done"?"완료":`D-${daysLeft(t.endDate)}`}
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                                <div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{width:`${t.progress}%`}}/>
                              </div>
                              <p className="mt-0.5 text-right text-[10px] text-slate-400">{t.progress}%</p>
                            </div>
                          );
                        })}
                        {colTasks.length===0 && (
                          <p className="mt-2 text-center text-xs text-slate-300">업무 없음</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              캘린더 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="calendar" && (
            <div className="flex-1 overflow-auto thin-scroll p-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <button type="button" onClick={()=>setCalMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1))}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">← 이전</button>
                  <h3 className="text-sm font-bold text-slate-800">{calYear}년 {calMon+1}월</h3>
                  <button type="button" onClick={()=>setCalMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1))}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">다음 →</button>
                </div>
                {/* Weekday labels */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {["월","화","수","목","금","토","일"].map(d=>(
                    <div key={d} className={cx("py-2 text-center text-xs font-bold",
                      d==="일"?"text-red-400":d==="토"?"text-blue-400":"text-slate-500")}>{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7">
                  {calCells.map((day,i)=>{
                    if (!day) return <div key={i} className="min-h-[90px] border-b border-r border-slate-100 bg-slate-50"/>;
                    const iso = `${calYear}-${calMonPad}-${String(day).padStart(2,"0")}`;
                    const dayTasks = calTaskMap.get(iso) ?? [];
                    const isToday  = iso === todayIso();
                    const colIdx   = i % 7;
                    return (
                      <div key={i} className={cx("min-h-[90px] border-b border-r border-slate-100 p-1.5",
                        isToday ? "bg-brand-50" : "hover:bg-slate-50")}>
                        <span className={cx("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                          isToday?"bg-brand-700 text-white":colIdx===6?"text-red-400":colIdx===5?"text-blue-400":"text-slate-700")}>
                          {day}
                        </span>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0,3).map(t=>{
                            const ds=getDisplayStatus(t);
                            return (
                              <div key={t.id}
                                className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white cursor-pointer"
                                style={{backgroundColor:statusMeta[ds].bar}}
                                title={t.title}
                                onClick={()=>canEdit&&openEditTask(t)}>
                                {t.title}
                              </div>
                            );
                          })}
                          {dayTasks.length>3 && <p className="text-[10px] text-slate-400">+{dayTasks.length-3}개</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              알림 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="alerts" && (
            <div className="flex-1 overflow-auto thin-scroll p-4 space-y-4">
              {(["delayed","warning","todo"] as const).map(dsKey=>{
                const label={ delayed:"🔴 지연 업무", warning:"🟠 마감 임박 (3일 이내)", todo:"🔵 오늘 마감" }[dsKey];
                const filtered = dsKey==="todo"
                  ? tasks.filter(t=>t.endDate===todayIso()&&t.status!=="done")
                  : tasks.filter(t=>getDisplayStatus(t)===dsKey);
                if(filtered.length===0) return null;
                return (
                  <div key={dsKey} className="rounded-xl border border-slate-200 bg-white shadow-card">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800">{label} <span className="ml-1 text-brand-700">({filtered.length})</span></h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {filtered.map(t=>{
                        const ds=getDisplayStatus(t);
                        const p=projMap.get(t.projectId);
                        const left=daysLeft(t.endDate);
                        return (
                          <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                            <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", statusMeta[ds].dot)}/>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                              <p className="text-xs text-slate-400">{p?.name} · {t.department||"-"} · {t.assignee||"미배정"}</p>
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              <Chip className={statusMeta[ds].chip}>{statusMeta[ds].label}</Chip>
                              <p className={cx("text-xs font-bold", left<0?"text-red-600":left<=3?"text-amber-600":"text-slate-500")}>
                                {left<0?`${Math.abs(left)}일 초과`:`D-${left}`} · {t.endDate}
                              </p>
                            </div>
                            {canEdit && <IconBtn icon={Edit3} label="수정" onClick={()=>openEditTask(t)}/>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {dashboard.delayed===0&&dashboard.dueSoon===0&&dashboard.todayDue===0 && (
                <div className="flex flex-1 items-center justify-center py-20">
                  <div className="text-center">
                    <Bell className="mx-auto h-12 w-12 text-slate-200"/>
                    <p className="mt-3 text-sm font-semibold text-slate-400">알림이 없습니다</p>
                    <p className="text-xs text-slate-300">모든 업무가 정상 진행 중입니다.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              보고서 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="reports" && (
            <div className="flex-1 overflow-auto thin-scroll p-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Project progress */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">프로젝트별 진행률</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {projects.map(p=>{
                      const pt=tasks.filter(t=>t.projectId===p.id);
                      const prog=calcProjectProgress(pt);
                      const doneCnt=pt.filter(t=>t.status==="done").length;
                      return (
                        <div key={p.id} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                              <p className="text-xs text-slate-400">{p.advertiser} · {pt.length}개 업무 · 완료 {doneCnt}개</p>
                            </div>
                            <span className="text-lg font-bold text-brand-700">{prog}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-brand-600 transition-all" style={{width:`${prog}%`}}/>
                          </div>
                        </div>
                      );
                    })}
                    {projects.length===0 && <p className="p-4 text-sm text-slate-400">프로젝트가 없습니다.</p>}
                  </div>
                </div>

                {/* Status distribution */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">상태별 업무 분포</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {(["todo","in_progress","done","warning","delayed"] as DisplayStatus[]).map(ds=>{
                      const cnt = ds==="warning"||ds==="delayed"
                        ? tasks.filter(t=>getDisplayStatus(t)===ds).length
                        : tasks.filter(t=>t.status===ds).length;
                      const pct = tasks.length ? Math.round(cnt/tasks.length*100) : 0;
                      return (
                        <div key={ds}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-700">{statusMeta[ds].label}</span>
                            <span className="text-slate-500">{cnt}개 ({pct}%)</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-200">
                            <div className="h-2 rounded-full transition-all" style={{width:`${pct}%`, backgroundColor:statusMeta[ds].bar}}/>
                          </div>
                        </div>
                      );
                    })}
                    {tasks.length===0 && <p className="text-sm text-slate-400">업무가 없습니다.</p>}
                  </div>
                </div>

                {/* Department stats */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card lg:col-span-2">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">부서별 업무 분포</h3>
                  </div>
                  <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[...new Set(tasks.map(t=>t.department).filter(Boolean))].map(dept=>{
                      const dt=tasks.filter(t=>t.department===dept);
                      const done=dt.filter(t=>t.status==="done").length;
                      const prog=Math.round(dt.reduce((s,t)=>s+t.progress,0)/(dt.length||1));
                      return (
                        <div key={dept} className="rounded-xl border border-slate-200 p-4">
                          <p className="text-xs font-bold text-slate-500 uppercase">{dept}</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{dt.length}<span className="text-sm font-normal text-slate-400">개</span></p>
                          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                            <div className="h-1.5 rounded-full bg-brand-500" style={{width:`${prog}%`}}/>
                          </div>
                          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                            <span>완료 {done}개</span><span>{prog}%</span>
                          </div>
                        </div>
                      );
                    })}
                    {[...new Set(tasks.map(t=>t.department).filter(Boolean))].length===0 && (
                      <p className="text-sm text-slate-400 col-span-4">데이터가 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              파일 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="files" && (
            <div className="flex flex-1 items-center justify-center p-4">
              <div className="text-center">
                <Folder className="mx-auto h-16 w-16 text-slate-200"/>
                <h3 className="mt-4 text-base font-bold text-slate-600">첨부파일 기능</h3>
                <p className="mt-2 text-sm text-slate-400">2차 업데이트에서 Google Drive 또는<br/>Supabase Storage 연동이 제공될 예정입니다.</p>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              설정 페이지
          ════════════════════════════════════════════════════════════════ */}
          {activePage==="settings" && (
            <div className="flex-1 overflow-auto thin-scroll p-4">
              <div className="mx-auto max-w-2xl space-y-4">
                {/* My info */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">내 계정 정보</h3>
                  </div>
                  <div className="p-4 flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white">
                      {userEmail.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{userEmail}</p>
                      <Chip className={{ master:"bg-brand-100 text-brand-700", editor:"bg-emerald-100 text-emerald-700", viewer:"bg-sky-100 text-sky-700", none:"bg-red-100 text-red-700" }[role]}>
                        {roleLabels[role]}
                      </Chip>
                      {isDemoMode && <Chip className="ml-1 bg-amber-100 text-amber-700">데모 DB</Chip>}
                    </div>
                    <div className="ml-auto">
                      <Btn icon={LogOut} tone="danger" small onClick={handleLogout}>로그아웃</Btn>
                    </div>
                  </div>
                </div>

                {/* Role management inline */}
                {canManage && (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800">사용자 권한 관리</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <form onSubmit={saveRole} className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
                        <div><Label>이메일</Label>
                          <input type="email" value={roleDraft.email} onChange={e=>setRoleDraft(c=>({...c,email:e.target.value}))}
                            placeholder="name@example.com"
                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                        <div><Label>권한</Label>
                          <select value={roleDraft.role} onChange={e=>setRoleDraft(c=>({...c,role:e.target.value as UserRole}))}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
                            {(Object.keys(roleLabels) as UserRole[]).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}
                          </select></div>
                        <Btn type="submit" tone="primary" icon={Save}>추가</Btn>
                      </form>
                      {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
                      <div className="space-y-2">
                        {roles.map(r=>(
                          <div key={r.email} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                            <p className="truncate text-sm font-medium text-slate-800">{r.email}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              <Chip className={{ master:"bg-brand-100 text-brand-700", editor:"bg-emerald-100 text-emerald-700", viewer:"bg-sky-100 text-sky-700", none:"bg-red-100 text-red-700" }[r.role]}>
                                {roleLabels[r.role]}
                              </Chip>
                              <IconBtn icon={Edit3} label="수정" onClick={()=>setRoleDraft(r)}/>
                              <IconBtn icon={Trash2} label="삭제" tone="danger" onClick={()=>void deleteRole(r)}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* System info */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-card">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">시스템 정보</h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["버전",      "v1.0.0 MVP"],
                      ["DB 모드",   isDemoMode?"데모 (로컬)":"Supabase 연결"],
                      ["총 프로젝트",`${projects.length}개`],
                      ["총 업무",   `${tasks.length}개`],
                    ].map(([k,v])=>(
                      <div key={k}>
                        <p className="text-xs text-slate-400">{k}</p>
                        <p className="font-semibold text-slate-700">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      {/* Project dialog */}
      {dialog==="project" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{projDraft.id?"프로젝트 수정":"프로젝트 생성"}</h2>
              <IconBtn icon={X} label="닫기" onClick={()=>setDialog(null)}/>
            </div>
            <form onSubmit={saveProject} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>광고주 *</Label>
                  <input value={projDraft.advertiser} onChange={e=>setProjDraft(c=>({...c,advertiser:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>프로젝트명 *</Label>
                  <input value={projDraft.name} onChange={e=>setProjDraft(c=>({...c,name:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>캠페인명</Label>
                  <input value={projDraft.campaign} onChange={e=>setProjDraft(c=>({...c,campaign:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>차량 대수</Label>
                  <input type="number" min={1} value={projDraft.vehicleCount} onChange={e=>setProjDraft(c=>({...c,vehicleCount:Number(e.target.value)}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>시작일</Label>
                  <input type="date" value={projDraft.startDate} onChange={e=>setProjDraft(c=>({...c,startDate:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>종료일</Label>
                  <input type="date" value={projDraft.endDate} onChange={e=>setProjDraft(c=>({...c,endDate:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
              </div>
              <div><Label>메모</Label>
                <textarea value={projDraft.memo} onChange={e=>setProjDraft(c=>({...c,memo:e.target.value}))} rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 resize-none"/></div>
              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Btn onClick={()=>setDialog(null)}>취소</Btn>
                <Btn type="submit" tone="primary" icon={Save} disabled={loading}>저장</Btn>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Task dialog */}
      {dialog==="task" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <section className="thin-scroll max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{taskDraft.id?"업무 수정":"업무 생성"}</h2>
              <IconBtn icon={X} label="닫기" onClick={()=>setDialog(null)}/>
            </div>
            <form onSubmit={saveTask} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>프로젝트 *</Label>
                  <select value={taskDraft.projectId} onChange={e=>setTaskDraft(c=>({...c,projectId:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
                    {projects.map(p=><option key={p.id} value={p.id}>{p.advertiser} · {p.name}</option>)}
                  </select></div>
                <div><Label>업무명 *</Label>
                  <input value={taskDraft.title} onChange={e=>setTaskDraft(c=>({...c,title:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>상태</Label>
                  <select value={taskDraft.status} onChange={e=>setTaskDraft(c=>({...c,status:e.target.value as TaskStatus}))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
                    <option value="todo">대기</option>
                    <option value="in_progress">진행중</option>
                    <option value="done">완료</option>
                  </select></div>
                <div><Label>부서</Label>
                  <input value={taskDraft.department} onChange={e=>setTaskDraft(c=>({...c,department:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>담당자</Label>
                  <input value={taskDraft.assignee} onChange={e=>setTaskDraft(c=>({...c,assignee:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>시작일 *</Label>
                  <input type="date" value={taskDraft.startDate} onChange={e=>setTaskDraft(c=>({...c,startDate:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div><Label>종료일 *</Label>
                  <input type="date" value={taskDraft.endDate} onChange={e=>setTaskDraft(c=>({...c,endDate:e.target.value}))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
                <div className="col-span-2">
                  <Label>진행률 ({taskDraft.progress}%)</Label>
                  <input type="range" min={0} max={100} value={taskDraft.progress} onChange={e=>setTaskDraft(c=>({...c,progress:Number(e.target.value)}))}
                    className="w-full accent-brand-600"/>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
              </div>
              <div><Label>메모</Label>
                <textarea value={taskDraft.memo} onChange={e=>setTaskDraft(c=>({...c,memo:e.target.value}))} rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 resize-none"/></div>
              {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Btn onClick={()=>setDialog(null)}>취소</Btn>
                <Btn type="submit" tone="primary" icon={Save} disabled={loading}>저장</Btn>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Roles dialog */}
      {dialog==="roles" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <section className="thin-scroll max-h-[92vh] w-full max-w-xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">권한 관리</h2>
              <IconBtn icon={X} label="닫기" onClick={()=>setDialog(null)}/>
            </div>
            <form onSubmit={saveRole} className="mb-5 grid grid-cols-[1fr_140px_auto] gap-2 items-end">
              <div><Label>이메일</Label>
                <input type="email" value={roleDraft.email} onChange={e=>setRoleDraft(c=>({...c,email:e.target.value}))}
                  placeholder="name@example.com"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"/></div>
              <div><Label>권한</Label>
                <select value={roleDraft.role} onChange={e=>setRoleDraft(c=>({...c,role:e.target.value as UserRole}))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500">
                  {(Object.keys(roleLabels) as UserRole[]).map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}
                </select></div>
              <Btn type="submit" tone="primary" icon={Save}>저장</Btn>
            </form>
            {formError && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
            <div className="space-y-2">
              {roles.map(r=>(
                <div key={r.email} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-slate-800">{r.email}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Chip className={{ master:"bg-brand-100 text-brand-700", editor:"bg-emerald-100 text-emerald-700", viewer:"bg-sky-100 text-sky-700", none:"bg-red-100 text-red-700" }[r.role]}>
                      {roleLabels[r.role]}
                    </Chip>
                    <IconBtn icon={Edit3} label="수정" onClick={()=>setRoleDraft(r)}/>
                    <IconBtn icon={Trash2} label="삭제" tone="danger" onClick={()=>void deleteRole(r)}/>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
