import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://ypyadenyrsgyxbltkisk.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlweWFkZW55cnNneXhibHRraXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjc5NDMsImV4cCI6MjA4Nzg0Mzk0M30.MsMevv6qsZ1Il3DSMw0rsAE0ugejE6ePaTnFnM217HE";
const supabase = createClient(SUPA_URL, SUPA_KEY);

// ── SEED DATA ────────────────────────────────────────────────────────────────
const SEED = [
  {
    id:"p1", name:"Riverside Aquatic Center", slug:"riverside-aquatic",
    type:"tournament", status:"active", color:"#1B2A4A", accent:"#d96b52",
    responses:142, created:"2024-10-12", isTemplate:true,
    description:"Help us prioritize features for the new aquatic center.",
    demoEnabled:true, showResults:true, kioskMode:false, captcha:false,
    options:[
      {id:"o1",name:"Lap Pool (50m)",        desc:"Olympic-size lanes",img:null},
      {id:"o2",name:"Leisure Pool & Slides", desc:"Family fun",img:null},
      {id:"o3",name:"Hot Tubs & Spa",        desc:"Therapeutic pools",img:null},
      {id:"o4",name:"Kids Splash Pad",       desc:"Zero-depth play area",img:null},
      {id:"o5",name:"Diving Boards",         desc:"1m and 3m springboards",img:null},
    ],
    demographics:[
      {id:"d1",type:"zipcode",label:"ZIP Code"},
      {id:"d2",type:"age",    label:"Age Range"},
    ],
    mockScores:{o1:48,o2:41,o3:29,o4:33,o5:22},
  },
  {
    id:"p2", name:"Maplewood Library Programs", slug:"maplewood-library",
    type:"roundrobin", status:"active", color:"#d96b52", accent:"#1a3328",
    responses:89, created:"2024-11-01", isTemplate:true,
    description:"Which library programs should we expand next year?",
    demoEnabled:false, showResults:true, kioskMode:true, captcha:false,
    options:[
      {id:"o1",name:"After-School Tutoring", desc:"Free homework help K-12",img:null},
      {id:"o2",name:"Maker Space",           desc:"3D printing, laser cutting",img:null},
      {id:"o3",name:"Story Time",            desc:"Early literacy ages 0-5",img:null},
      {id:"o4",name:"Job Skills Workshops",  desc:"Resume and interview prep",img:null},
    ],
    demographics:[],
    mockScores:{o1:22,o2:18,o3:25,o4:12},
  },
];

const MOCK_USERS = [
  {id:"u1",name:"Sarah Chen",    org:"Riverside Consulting", email:"sarah@riversidecg.com",  plan:"Bundle of 3",credits:2,status:"active"},
  {id:"u2",name:"Marcus Webb",   org:"City of Portland",     email:"mwebb@portland.gov",     plan:"Bundle of 6",credits:5,status:"active"},
  {id:"u3",name:"Aisha Kamara",  org:"Freelance",            email:"aisha@placemaking.co",   plan:"Single",     credits:0,status:"active"},
  {id:"u4",name:"Tom Brannigan", org:"Park Associates LLC",  email:"tom@parkassoc.com",      plan:"Bundle of 3",credits:1,status:"suspended"},
];

// ── VOTING LOGIC ─────────────────────────────────────────────────────────────

// ROUND ROBIN: every option vs every other → full ranked list
function buildRR(opts) {
  const pairs = [];
  for (let i = 0; i < opts.length; i++)
    for (let j = i + 1; j < opts.length; j++)
      pairs.push([opts[i], opts[j]]);
  return pairs;
}

function calcRR(opts, votes) {
  const wins = {};
  opts.forEach(o => { wins[o.id] = 0; });
  votes.forEach(id => { if (wins[id] !== undefined) wins[id]++; });
  return [...opts].map(o => ({...o, score: wins[o.id]||0})).sort((a,b) => b.score - a.score);
}

// TOURNAMENT: real single-elimination bracket → top-3 podium
function initTournament(opts) {
  let pool = [...opts];
  let size = 1;
  while (size < pool.length) size *= 2;
  while (pool.length < size) pool.push(null); // byes

  const matchups = [], autoAdvance = [];
  for (let i = 0; i < pool.length; i += 2) {
    if (pool[i] && pool[i+1]) matchups.push([pool[i], pool[i+1]]);
    else if (pool[i]) autoAdvance.push(pool[i]);
  }
  return { matchups, matchIdx:0, roundWinners:[...autoAdvance], allWinners:[], losers:[], done:false };
}

function tournamentVote(state, winnerId) {
  const {matchups, matchIdx, roundWinners, allWinners, losers} = state;
  const [a, b] = matchups[matchIdx];
  const winner = a.id === winnerId ? a : b;
  const loser  = a.id === winnerId ? b : a;
  const newRW = [...roundWinners, winner];
  const newLosers = [...losers, loser];
  const nextIdx = matchIdx + 1;

  if (nextIdx < matchups.length)
    return {...state, matchIdx:nextIdx, roundWinners:newRW, losers:newLosers};

  // Round complete
  if (newRW.length === 1)
    return {matchups:[], matchIdx:0, roundWinners:[], allWinners:[...allWinners, newRW[0]], losers:newLosers, done:true};

  // Build next round
  const nextMatchups = [], nextAuto = [];
  for (let i = 0; i < newRW.length; i += 2) {
    if (newRW[i+1]) nextMatchups.push([newRW[i], newRW[i+1]]);
    else nextAuto.push(newRW[i]);
  }
  return {matchups:nextMatchups, matchIdx:0, roundWinners:[...nextAuto], allWinners, losers:newLosers, done:false};
}

function tDone(s) { return s.done; }
function tTop3(s) {
  const champ = s.allWinners[0] || s.roundWinners[0];
  return [champ, ...[...s.losers].reverse().slice(0,2)].filter(Boolean);
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Inter:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --f:#1B2A4A;--fm:#243660;--fp:rgba(27,42,74,.06);
  --c:#d96b52;--ch:#c45c44;
  --bg:#f2f3f5;--sur:#fff;--sub:#f7f8fa;--ins:#e8eaed;
  --bd:#e2e4e8;--bdm:#c8ccd4;
  --i1:#111318;--i2:#3c4049;--i3:#6b7280;--i4:#9ca3af;
  --gn:#16a34a;--gnb:#f0fdf4;--gnr:#bbf7d0;
  --am:#d97706;--amb:#fffbeb;--amr:#fde68a;
  --rd:#dc2626;--rdb:#fef2f2;--rdr:#fecaca;
  --r1:6px;--r2:8px;--r3:12px;--r4:16px;
  --s1:0 1px 2px rgba(0,0,0,.05);
  --s3:0 4px 6px rgba(0,0,0,.05),0 2px 4px rgba(0,0,0,.04);
  --s5:0 20px 25px rgba(0,0,0,.07),0 8px 10px rgba(0,0,0,.04);
  --e:cubic-bezier(.4,0,.2,1);
  --fd:'Fraunces',Georgia,serif;--fb:'Inter',system-ui,sans-serif;
}
body{font-family:var(--fb);background:var(--bg);color:var(--i1);line-height:1.5;-webkit-font-smoothing:antialiased;font-size:14px;}
h1,h2,h3{font-family:var(--fd);}

/* nav */
.nav{position:sticky;top:0;z-index:100;height:56px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:rgba(242,243,245,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd);}
.logo{font-family:var(--fd);font-size:19px;font-weight:400;color:var(--f);display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;}
.logo em{color:var(--c);font-style:italic;}

/* buttons */
.btn{font-family:var(--fb);font-weight:500;font-size:13px;border:none;border-radius:var(--r2);cursor:pointer;transition:all .15s var(--e);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}
.bxs{padding:4px 10px;font-size:11px;border-radius:var(--r1);}
.bsm{padding:7px 14px;}
.bmd{padding:9px 18px;}
.blg{padding:12px 28px;font-size:15px;border-radius:var(--r3);}
.bp{background:var(--f);color:#fff;}.bp:hover{background:var(--fm);}
.bc{background:var(--c);color:#fff;}.bc:hover{background:var(--ch);}
.bo{background:var(--sur);color:var(--i2);border:1px solid var(--bd);}.bo:hover{border-color:var(--bdm);background:var(--sub);}
.bg{background:transparent;color:var(--i3);}.bg:hover{background:var(--sub);color:var(--i1);}
.bdr{background:var(--rdb);color:var(--rd);border:1px solid var(--rdr);}
.btn:disabled{opacity:.4;cursor:not-allowed;}

/* cards */
.card{background:var(--sur);border-radius:var(--r3);border:1px solid var(--bd);box-shadow:var(--s1);}
.hov:hover{box-shadow:var(--s3);border-color:var(--bdm);transform:translateY(-1px);transition:all .15s var(--e);}

/* badges */
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:500;font-family:var(--fb);}
.bgg{background:var(--gnb);color:var(--gn);border:1px solid var(--gnr);}
.bgy{background:var(--sub);color:var(--i3);border:1px solid var(--bd);}
.bga{background:var(--amb);color:var(--am);border:1px solid var(--amr);}

/* forms */
.fi{display:flex;flex-direction:column;gap:5px;}
.lbl{font-size:11px;font-weight:500;color:var(--i3);letter-spacing:.04em;text-transform:uppercase;}
.inp,.ta,.sel{font-family:var(--fb);font-size:13px;background:var(--sur);border:1px solid var(--bd);border-radius:var(--r2);color:var(--i1);transition:all .14s;width:100%;}
.inp{padding:8px 12px;}.ta{padding:8px 12px;resize:vertical;min-height:72px;}.sel{padding:8px 12px;cursor:pointer;}
.inp:focus,.ta:focus,.sel:focus{outline:none;border-color:var(--f);box-shadow:0 0 0 3px var(--fp);}
.inp::placeholder{color:var(--i4);}

/* toggle */
.togw{display:flex;align-items:flex-start;gap:10px;cursor:pointer;user-select:none;}
.tog{position:relative;width:36px;height:20px;background:var(--ins);border-radius:99px;transition:all .18s;flex-shrink:0;margin-top:2px;border:1px solid var(--bdm);}
.tog.on{background:var(--f);border-color:var(--f);}
.tog::after{content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:white;top:2px;left:2px;transition:all .18s;box-shadow:0 1px 2px rgba(0,0,0,.15);}
.tog.on::after{transform:translateX(16px);}

/* tabs */
.tline{display:flex;border-bottom:1px solid var(--bd);margin-bottom:24px;}
.tl{padding:9px 16px;font-size:13px;color:var(--i3);cursor:pointer;border:none;background:transparent;font-family:var(--fb);border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .13s;}
.tl:hover{color:var(--i2);}.tl.on{color:var(--i1);font-weight:500;border-bottom-color:var(--f);}
.tpill{display:flex;gap:1px;background:var(--sub);border-radius:var(--r2);padding:3px;margin-bottom:20px;border:1px solid var(--bd);}
.tp{flex:1;padding:6px 8px;border-radius:6px;font-size:12px;color:var(--i3);cursor:pointer;transition:all .13s;text-align:center;border:none;background:transparent;font-family:var(--fb);}
.tp.on{background:var(--sur);color:var(--i1);font-weight:500;box-shadow:var(--s1);}

/* layout */
.dash{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 56px);}
.sb{background:var(--sur);border-right:1px solid var(--bd);padding:16px 8px;display:flex;flex-direction:column;gap:1px;}
.sbsec{font-size:11px;font-weight:500;color:var(--i4);padding:12px 10px 4px;letter-spacing:.05em;text-transform:uppercase;}
.sbit{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--r1);font-size:13px;color:var(--i3);cursor:pointer;transition:all .12s;border:none;background:none;font-family:var(--fb);width:100%;text-align:left;}
.sbit:hover{background:var(--sub);color:var(--i2);}.sbit.on{background:var(--sub);color:var(--i1);font-weight:500;}
.main{padding:32px 36px;overflow-y:auto;max-height:calc(100vh - 56px);}
.ph{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;}
.pt{font-size:24px;font-weight:300;letter-spacing:-.02em;margin-bottom:2px;}
.pst{font-size:13px;color:var(--i3);}

/* hero */
.hero{background:var(--f);padding:96px 28px 88px;text-align:center;color:white;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 80% -10%,rgba(217,107,82,.22) 0%,transparent 50%);}
.hero::after{content:'';position:absolute;bottom:-1px;left:0;right:0;height:48px;background:var(--bg);clip-path:ellipse(55% 100% at 50% 100%);}
.hpill{display:inline-flex;align-items:center;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.85);font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;padding:4px 14px;border-radius:99px;margin-bottom:22px;}
.hero h1{font-size:clamp(34px,5.5vw,60px);line-height:1.06;margin-bottom:18px;font-weight:300;letter-spacing:-.02em;}
.hero h1 em{color:#e8a090;font-style:italic;}
.hero p{font-size:17px;opacity:.72;max-width:480px;margin:0 auto 32px;font-weight:300;}

/* vote page */
.vpage{min-height:100vh;background:var(--bg);display:flex;flex-direction:column;}
.vhdr{padding:14px 20px;background:var(--sur);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:12px;}
.vhdr-accent{height:4px;width:100%;flex-shrink:0;}
.vbody{flex:1;padding:32px 20px 56px;max-width:640px;margin:0 auto;width:100%;}
.vpb{height:4px;background:var(--ins);border-radius:99px;margin-bottom:8px;overflow:hidden;}
.vpf{height:100%;border-radius:99px;transition:width .4s var(--e);}
.vprog{display:flex;align-items:center;gap:10px;margin-bottom:28px;}
.vprogtxt{font-size:11px;color:var(--i4);font-weight:500;white-space:nowrap;}
.vq{text-align:center;font-family:var(--vfh,var(--fd));font-size:clamp(20px,3.5vw,28px);margin-bottom:28px;line-height:1.3;font-weight:400;color:var(--i1);}
.vgrid{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;}
.vc{background:var(--sur);border:1.5px solid var(--bd);border-radius:var(--r4);padding:28px 18px 22px;text-align:center;cursor:pointer;transition:all .18s var(--e);display:flex;flex-direction:column;align-items:center;gap:12px;min-height:180px;justify-content:center;position:relative;overflow:hidden;}
.vc::before{content:"";position:absolute;inset:0;background:var(--vca,var(--f));opacity:0;transition:opacity .18s;}
.vc:hover{border-color:var(--vca,var(--f));box-shadow:0 12px 24px rgba(0,0,0,.08);transform:translateY(-3px);}
.vc:hover::before{opacity:.04;}
.vc.sel{border-color:var(--vca,var(--f));box-shadow:0 0 0 4px var(--vcap,rgba(27,42,74,.15));background:var(--fp);}
.vc.sel::before{opacity:.06;}
.vcimg{width:100%;height:150px;object-fit:contain;border-radius:var(--r2);background:var(--sub);padding:4px;}
.vcn{font-family:var(--vfb,var(--fb));font-weight:600;font-size:15px;line-height:1.3;position:relative;}
.vcd{font-size:12px;color:var(--i3);line-height:1.5;position:relative;}
.vschip{width:40px;height:40px;border-radius:50%;background:var(--sur);border:1.5px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--i3);flex-shrink:0;box-shadow:var(--s1);}
.vtrust{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:20px;font-size:11px;color:var(--i4);}
.vrestart{background:none;border:none;font-size:11px;color:var(--i4);cursor:pointer;text-decoration:underline;margin-top:10px;display:block;margin-left:auto;margin-right:auto;padding:4px 8px;}
.vrestart:hover{color:var(--i2);}
.vintro-banner{width:100%;height:160px;object-fit:cover;border-radius:var(--r3);margin-bottom:20px;}
.vintro-org{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--i4);margin-bottom:6px;}

/* results */
.podium{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:20px 0 28px;}
.pcol{display:flex;flex-direction:column;align-items:center;gap:8px;}
.pbar{border-radius:8px 8px 0 0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:9px;font-family:var(--fd);font-size:20px;color:white;}
.pg{background:#d4a820;height:100px;width:76px;}
.psi{background:#9aaab8;height:78px;width:68px;}
.pb2{background:#c07848;height:60px;width:60px;}
.pname{font-size:11px;font-weight:500;text-align:center;max-width:80px;line-height:1.3;color:var(--i2);}
.rrow{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--sur);border:1px solid var(--bd);border-radius:var(--r2);margin-bottom:6px;}
.rrnk{width:24px;height:24px;border-radius:50%;background:var(--sub);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--i3);flex-shrink:0;}
.rbar{height:6px;background:var(--ins);border-radius:99px;overflow:hidden;margin-top:5px;}
.rfill{height:100%;border-radius:99px;transition:width 1s var(--e);}

/* stats */
.srow{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;}
.sc{padding:16px 18px;}.sv{font-family:var(--fd);font-size:28px;color:var(--f);line-height:1;font-weight:300;}.sl{font-size:12px;color:var(--i3);margin-top:3px;}

/* data table */
.dtwrap{overflow-x:auto;border-radius:var(--r3);border:1px solid var(--bd);}
.dt{width:100%;border-collapse:collapse;font-size:12px;}
.dt th{padding:9px 14px;text-align:left;font-size:11px;font-weight:500;color:var(--i3);background:var(--sub);border-bottom:1px solid var(--bd);white-space:nowrap;position:sticky;top:0;z-index:2;}
.dt td{padding:9px 14px;border-bottom:1px solid var(--bd);color:var(--i2);vertical-align:middle;white-space:nowrap;}
.dt tr:last-child td{border-bottom:none;}
.dt tbody tr:hover td{background:var(--sub);}
.dt tr.selr td{background:var(--fp) !important;}

/* modal */
.mov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.35);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;}
.modal{background:var(--sur);border-radius:var(--r4);box-shadow:var(--s5);border:1px solid var(--bd);width:100%;max-width:540px;max-height:92vh;overflow-y:auto;}
.mh{padding:20px 22px 0;display:flex;justify-content:space-between;align-items:center;}
.mb{padding:16px 22px 22px;}
.mf{padding:12px 22px;border-top:1px solid var(--bd);display:flex;gap:8px;justify-content:flex-end;}

/* misc */
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--sub);border:1px solid var(--bd);border-radius:99px;font-size:12px;color:var(--i2);}
.divider{height:1px;background:var(--bd);margin:14px 0;}
.kbar{background:var(--f);color:rgba(255,255,255,.9);text-align:center;padding:7px 16px;font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:14px;}
.aler{padding:10px 14px;border-radius:var(--r2);font-size:13px;display:flex;gap:9px;align-items:flex-start;line-height:1.5;}
.alw{background:var(--amb);border:1px solid var(--amr);color:#854d0e;}
.ali{background:var(--gnb);border:1px solid var(--gnr);color:#14532d;}
.oth{width:40px;height:40px;border-radius:var(--r1);background:var(--sub);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;overflow:hidden;cursor:pointer;position:relative;border:1px solid var(--bd);}
.oth img{width:100%;height:100%;object-fit:cover;}
.othlbl{position:absolute;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;font-size:10px;color:white;border-radius:var(--r1);}
.oth:hover .othlbl{display:flex;}

/* export */
.exlay{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 56px);}
.exsb{background:var(--sur);border-right:1px solid var(--bd);padding:24px;display:flex;flex-direction:column;gap:16px;}
.exmain{padding:32px;overflow-y:auto;}
.exrep{max-width:660px;margin:0 auto;}
.rephdr{border-radius:var(--r4);padding:28px 32px;color:white;margin-bottom:20px;}
.repsec{background:var(--sur);border:1px solid var(--bd);border-radius:var(--r4);padding:24px;margin-bottom:16px;}

/* super admin */
.supanel{background:var(--f);color:white;padding:48px 28px;}
.sutbl{width:100%;border-collapse:collapse;font-size:13px;}
.sutbl th{padding:8px 12px;text-align:left;font-size:11px;font-weight:500;color:rgba(255,255,255,.5);border-bottom:1px solid rgba(255,255,255,.12);letter-spacing:.04em;text-transform:uppercase;}
.sutbl td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.85);}
.sutbl tr:last-child td{border-bottom:none;}
.sutbl tr:hover td{background:rgba(255,255,255,.04);}

/* animations */
.toast{position:fixed;bottom:20px;right:20px;z-index:999;background:var(--i1);color:white;padding:10px 18px;border-radius:var(--r2);font-size:13px;box-shadow:var(--s5);animation:fuA .2s var(--e);}
.toast.s{background:#15803d;}
@keyframes fuA{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
@keyframes slI{from{opacity:0;transform:scale(.97);}to{opacity:1;transform:scale(1);}}
.fai{animation:fuA .25s var(--e) forwards;}
.sli{animation:slI .2s var(--e) forwards;}
@media(max-width:768px){
  .dash{grid-template-columns:1fr;}.sb{display:none;}
  .vgrid{grid-template-columns:1fr;}.vschip{display:none;}
  .exlay{grid-template-columns:1fr;}.exsb{display:none;}
}
`;

// ── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Logo({size=24,light=false}){
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill={light?"rgba(255,255,255,.12)":"#1a3328"}/>
      <path d="M8 21L14 8L20 21" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="9.5" y1="17" x2="18.5" y2="17" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="14" cy="8" r="2" fill="#d96b52"/>
    </svg>
  );
}

function NavLogo({onClick,light}){
  return (
    <div className="logo" style={light?{color:"rgba(255,255,255,.9)"}:{}} onClick={onClick}>
      <Logo light={light}/><span>Civic<em>Sort</em></span>
    </div>
  );
}

function LangPicker({lang,setLang}){
  const [open,setOpen]=useState(false);
  const opts=[{c:"en",f:"🇺🇸",l:"English"},{c:"es",f:"🇪🇸",l:"Español"},{c:"fr",f:"🇫🇷",l:"Français"},{c:"zh",f:"🇨🇳",l:"中文"},{c:"vi",f:"🇻🇳",l:"Tiếng Việt"},{c:"ar",f:"🇸🇦",l:"العربية"},{c:"so",f:"🇸🇴",l:"Somali"},{c:"pt",f:"🇧🇷",l:"Português"},{c:"ko",f:"🇰🇷",l:"한국어"},{c:"ru",f:"🇷🇺",l:"Русский"}];
  const cur=opts.find(o=>o.c===lang)||opts[0];
  return (
    <div style={{position:"relative"}}>
      <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:"var(--r1)",background:"var(--sub)",border:"1px solid var(--bd)",fontSize:12,color:"var(--i2)",cursor:"pointer",fontFamily:"var(--fb)"}} onClick={()=>setOpen(o=>!o)}>
        {cur.f} {cur.l} ▾
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"var(--sur)",borderRadius:"var(--r2)",boxShadow:"var(--s5)",border:"1px solid var(--bd)",minWidth:168,zIndex:50,overflow:"hidden"}}>
          {opts.map(o=>(
            <div key={o.c} onClick={()=>{setLang(o.c);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 12px",fontSize:13,cursor:"pointer",background:lang===o.c?"var(--sub)":"transparent",color:lang===o.c?"var(--f)":"var(--i1)",fontWeight:lang===o.c?500:400}}>
              {o.f} {o.l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DB HELPERS ────────────────────────────────────────────────────────────────
// Convert DB row (snake_case) → app project (camelCase)
function dbToProject(row){
  return {
    id: row.id,
    name: row.name,
    slug: row.slug||"",
    type: row.type,
    status: row.status,
    color: row.color,
    accent: row.accent||"#d96b52",
    description: row.description||"",
    introText: row.intro_text||"",
    introBanner: row.intro_banner||null,
    vsLabel: row.vs_label||"VS",
    vsPrompt: row.vs_prompt||"",
    font: row.font||"default",
    resultView: row.result_view||"bars",
    demoEnabled: row.demo_enabled||false,
    showResults: row.show_results!==false,
    kioskMode: row.kiosk_mode||false,
    captcha: row.captcha||false,
    logo: row.logo||null,
    options: row.options||[],
    demographics: row.demographics||[],
    responses: row.responses||0,
    isTemplate: row.is_template||false,
    created: row.created_at?row.created_at.split("T")[0]:"",
    mockScores: {},
  };
}
// Convert app project → DB row (snake_case)
function projectToDb(p, userId){
  return {
    user_id: userId,
    name: p.name,
    slug: p.slug||"",
    type: p.type,
    status: p.status||"draft",
    color: p.color,
    accent: p.accent||"#d96b52",
    description: p.description||"",
    intro_text: p.introText||"",
    intro_banner: p.introBanner||null,
    vs_label: p.vsLabel||"VS",
    vs_prompt: p.vsPrompt||"",
    font: p.font||"default",
    result_view: p.resultView||"bars",
    demo_enabled: p.demoEnabled||false,
    show_results: p.showResults!==false,
    kiosk_mode: p.kioskMode||false,
    captcha: p.captcha||false,
    logo: p.logo||null,
    options: p.options||[],
    demographics: p.demographics||[],
    responses: p.responses||0,
    is_template: p.isTemplate||false,
  };
}

// ── ROOT ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [view,setView]=useState("loading");
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [tab,setTab]=useState("projects");
  const [projects,setProjects]=useState([]);
  const [editP,setEditP]=useState(null);
  const [showModal,setShowModal]=useState(false);
  const [toast,setToast]=useState(null);
  const [vs,setVS]=useState(null);
  const [exportP,setExportP]=useState(null);
  const [superOpen,setSuperOpen]=useState(false);
  const [confirmDel,setConfirmDel]=useState(null);
  const [loading,setLoading]=useState(false);

  const notify=(msg,type)=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){
        setUser(session.user);
        loadProfile(session.user.id);
        loadProjects(session.user.id);
        setView("dashboard");
      } else {
        setView("landing");
      }
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      // Don't auto-redirect on signup — wait for email confirmation or explicit login
      if(event==="SIGNED_IN" && session?.user){
        setUser(session.user);
        loadProfile(session.user.id);
        loadProjects(session.user.id);
        setView("dashboard");
      } else if(event==="SIGNED_OUT"){
        setUser(null);setProfile(null);setProjects([]);
        setView("landing");
      }
      // INITIAL_SESSION handled by getSession above
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const loadProfile=async(uid)=>{
    const {data}=await supabase.from("profiles").select("*").eq("id",uid).single();
    if(data) setProfile(data);
  };

  const loadProjects=async(uid)=>{
    const {data,error}=await supabase.from("projects").select("*").eq("user_id",uid).order("created_at",{ascending:false});
    if(data) setProjects(data.map(dbToProject));
    if(error) console.error("loadProjects:",error);
  };

  // ── Auth actions ───────────────────────────────────────────────────────────
  const handleLogin=async(email,pass)=>{
    setLoading(true);
    const {error}=await supabase.auth.signInWithPassword({email,password:pass});
    setLoading(false);
    if(error) return error.message;
    return null;
  };

  const handleSignup=async(email,pass,name,org)=>{
    setLoading(true);
    const {data,error}=await supabase.auth.signUp({email,password:pass,options:{data:{name,org}}});
    setLoading(false);
    if(error) return error.message;
    // If email confirmation is off, session is immediately available
    if(data?.session?.user){
      setUser(data.session.user);
      loadProfile(data.session.user.id);
      loadProjects(data.session.user.id);
      setView("dashboard");
      return null;
    }
    // Email confirmation required — show message
    return "confirm";
  };

  const handleLogout=async()=>{
    await supabase.auth.signOut();
  };

  // ── Vote launch ────────────────────────────────────────────────────────────
  const launchVote=async p=>{
    let ip="unknown";
    try{const r=await fetch("https://api.ipify.org?format=json");const d=await r.json();ip=d.ip;}catch(e){}
    if(p.type==="tournament"){
      const tState=initTournament(p.options);
      setVS({project:p,mode:"tournament",tState,rrPairs:[],rrIdx:0,rrVotes:[],step:"intro",demo:{},lang:"en",capDone:false,isPreview:true,ip});
    } else {
      const rrPairs=buildRR(p.options);
      setVS({project:p,mode:"roundrobin",tState:null,rrPairs,rrIdx:0,rrVotes:[],step:"intro",demo:{},lang:"en",capDone:false,isPreview:true,ip});
    }
    setView("voting");
  };

  // ── Save project ───────────────────────────────────────────────────────────
  const saveProject=async(data)=>{
    if(!user){notify("Not logged in","e");return;}
    setLoading(true);
    if(data.id && !data.id.startsWith("p")){
      // Existing DB project — update
      const {error}=await supabase.from("projects").update(projectToDb(data,user.id)).eq("id",data.id);
      if(error){notify("Save failed","e");setLoading(false);return;}
      setProjects(ps=>ps.map(p=>p.id===data.id?data:p));
      notify("Saved","s");
    } else {
      // New project — insert
      const {data:row,error}=await supabase.from("projects").insert(projectToDb(data,user.id)).select().single();
      if(error){notify("Create failed","e");setLoading(false);return;}
      setProjects(ps=>[dbToProject(row),...ps]);
      notify("Created","s");
    }
    setLoading(false);
    setShowModal(false);setEditP(null);
  };

  // ── Delete project ────────────────────────────────────────────────────────
  const deleteProject=async(id)=>{
    if(!user) return;
    await supabase.from("projects").delete().eq("id",id);
    setProjects(ps=>ps.filter(p=>p.id!==id));
    setConfirmDel(null);
    notify("Deleted","s");
  };

  // ── Duplicate project ─────────────────────────────────────────────────────
  const duplicateProject=async(p)=>{
    if(!user) return;
    const copy=projectToDb({...p,name:p.name+" (copy)",status:"draft",responses:0,isTemplate:false},user.id);
    delete copy.id;
    const {data:row,error}=await supabase.from("projects").insert(copy).select().single();
    if(error){notify("Duplicate failed","e");return;}
    setProjects(ps=>[dbToProject(row),...ps]);
    notify("Duplicated","s");
  };

  // ── Toggle launch/close ───────────────────────────────────────────────────
  const toggleStatus=async(p)=>{
    const newStatus=p.status==="active"?"closed":"active";
    await supabase.from("projects").update({status:newStatus}).eq("id",p.id);
    setProjects(ps=>ps.map(x=>x.id===p.id?{...x,status:newStatus}:x));
  };

  if(view==="loading") return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:13,color:"var(--i4)"}}>Loading…</div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      {view==="landing" && <Landing onLogin={()=>setView("login")} onDash={()=>setView("login")} onDemo={()=>launchVote(SEED[0])} superOpen={superOpen} setSuperOpen={setSuperOpen}/>}
      {view==="login"   && <Login onLogin={handleLogin} onSignup={handleSignup} onBack={()=>setView("landing")} loading={loading}/>}
      {view==="dashboard" && <Dashboard tab={tab} setTab={setTab} projects={projects} user={user} profile={profile} onLogout={handleLogout} onBack={()=>setView("landing")} onVote={launchVote} onResults={p=>{setExportP(p);setView("export");}} onNew={()=>{setEditP(null);setShowModal(true);}} onEdit={p=>{setEditP(p);setShowModal(true);}} onDelete={id=>setConfirmDel(id)} onDuplicate={duplicateProject} onToggleStatus={toggleStatus}/>}
      {view==="voting"  && vs && <VotePage vs={vs} setVS={setVS} onExit={()=>setView("dashboard")}/>}
      {view==="export"  && exportP && <ExportPage project={exportP} projects={projects} onBack={()=>setView("dashboard")}/>}
      {showModal && <ProjectModal project={editP} onSave={saveProject} onClose={()=>{setShowModal(false);setEditP(null);}}/>}
      {confirmDel&&(
        <div className="mov" onClick={()=>setConfirmDel(null)}>
          <div className="card sli" style={{padding:28,maxWidth:360,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:"var(--fb)",fontWeight:500,fontSize:17,marginBottom:6,marginTop:4}}>Delete this project?</h3>
            <p style={{fontSize:13,color:"var(--i3)",marginBottom:20,lineHeight:1.6}}>This cannot be undone. All responses and settings will be lost.</p>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button className="btn bo bsm" onClick={()=>setConfirmDel(null)}>Cancel</button>
              <button className="btn bdr bsm" onClick={()=>deleteProject(confirmDel)}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className={`toast${toast.type==="s"?" s":""}`}>{toast.msg}</div>}
    </>
  );
}

// ── LANDING ──────────────────────────────────────────────────────────────────
function Landing({onLogin,onDash,onDemo,superOpen,setSuperOpen}){
  return (
    <div>
      <nav className="nav">
        <NavLogo/>
        <div style={{display:"flex",gap:8}}>
          <button className="btn bg bsm" onClick={onLogin}>Log in</button>
          <button className="btn bp bsm" onClick={onDash}>Get started</button>
        </div>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div style={{position:"relative",zIndex:1,maxWidth:680,margin:"0 auto"}}>
          <h1 style={{marginBottom:16}}>A simple way to rank<br/><em>competing priorities.</em></h1>
          <p style={{fontSize:18,lineHeight:1.7,opacity:.8,marginBottom:10}}>CivicSort is a structured pairwise voting tool that helps groups evaluate trade-offs and produce a clear order of priority.</p>
          <p style={{fontSize:15,lineHeight:1.7,opacity:.6,marginBottom:32}}>Use it in workshops, open houses, stakeholder sessions, or as a standalone digital exercise.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn bc blg" onClick={onDemo}>Try the demo</button>
            <button className="btn blg" style={{background:"rgba(255,255,255,.09)",color:"rgba(255,255,255,.85)",border:"1px solid rgba(255,255,255,.2)"}} onClick={onDash}>Get started →</button>
          </div>
        </div>
      </div>

      {/* TWO MODES */}
      <div style={{padding:"72px 28px",maxWidth:900,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:48}}>
          <p style={{fontSize:11,fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",color:"var(--c)",marginBottom:10}}>Two ways to clarify what rises to the top</p>
          <h2 style={{fontSize:"clamp(22px,3vw,34px)",fontWeight:300,letterSpacing:"-.02em"}}>Choose the format that fits your process.</h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:20}}>
          <div className="card" style={{padding:32,borderTop:`3px solid ${`var(--c)`}`}}>
            <h3 style={{fontSize:18,fontWeight:400,marginBottom:10,letterSpacing:"-.01em"}}>Bracket Mode</h3>
            <p style={{color:"var(--i2)",fontSize:14,lineHeight:1.7,marginBottom:16}}>Head-to-head comparisons in a tournament format. Quickly narrow up to 20 options down to the highest priorities.</p>
            <p style={{fontSize:13,color:"var(--c)",fontWeight:500}}>Best when you need energy, speed, and a clear short list.</p>
          </div>
          <div className="card" style={{padding:32,borderTop:`3px solid ${`var(--f)`}`}}>
            <h3 style={{fontSize:18,fontWeight:400,marginBottom:10,letterSpacing:"-.01em"}}>Ranking Mode</h3>
            <p style={{color:"var(--i2)",fontSize:14,lineHeight:1.7,marginBottom:16}}>Every option compared against every other. Generate a complete ranked list when sequencing and trade-offs matter.</p>
            <p style={{fontSize:13,color:"var(--f)",fontWeight:500}}>Best when you need depth and defensible ordering.</p>
          </div>
        </div>
      </div>

      {/* DESIGNED FOR REAL WORLD */}
      <div style={{background:"var(--sur)",borderTop:"1px solid var(--bd)",borderBottom:"1px solid var(--bd)"}}>
        <div style={{padding:"72px 28px",maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <p style={{fontSize:11,fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",color:"var(--c)",marginBottom:10}}>Designed for real-world decision making</p>
            <h2 style={{fontSize:"clamp(20px,3vw,32px)",fontWeight:300,letterSpacing:"-.02em",maxWidth:600,margin:"0 auto"}}>Everything you need for a professional exercise.</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
            {[
              {i:"01",t:"Kiosk-ready",d:"Auto-resets for shared devices at events and open houses."},
              {i:"02",t:"Multilingual by default",d:"Voters choose their language. AI translates option names instantly."},
              {i:"03",t:"Visual comparison",d:"Upload images per option to support photo-based decision making."},
              {i:"04",t:"Branded results report",d:"Download a clean, presentation-ready report with your logo and colors."},
            ].map(f=>(
              <div key={f.t} className="card" style={{padding:22}}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:".06em",color:"var(--c)",marginBottom:10,textTransform:"uppercase"}}>{f.i}</div>
                <h3 style={{fontSize:13,fontWeight:600,marginBottom:5,fontFamily:"var(--fb)"}}>{f.t}</h3>
                <p style={{color:"var(--i3)",fontSize:13,lineHeight:1.6}}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TRY BEFORE YOU COMMIT */}
      <div style={{padding:"72px 28px",maxWidth:680,margin:"0 auto",textAlign:"center"}}>
        <p style={{fontSize:11,fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",color:"var(--c)",marginBottom:10}}>Try before you commit</p>
        <h2 style={{fontSize:"clamp(20px,3vw,32px)",fontWeight:300,letterSpacing:"-.02em",marginBottom:14}}>Create and preview at no cost.</h2>
        <p style={{color:"var(--i3)",fontSize:15,lineHeight:1.7,marginBottom:28}}>Build your exercise, refine it internally, share a preview with colleagues. Only pay when you decide to launch it publicly.</p>
        <button className="btn bc blg" onClick={onDash}>Get started for free →</button>
      </div>

      {/* PRICING */}
      <div style={{background:"var(--sur)",borderTop:"1px solid var(--bd)",borderBottom:"1px solid var(--bd)"}}>
        <div style={{padding:"72px 28px",maxWidth:860,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <p style={{fontSize:11,fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",color:"var(--c)",marginBottom:10}}>Pricing</p>
            <h2 style={{fontSize:"clamp(22px,3vw,32px)",fontWeight:300,letterSpacing:"-.02em"}}>Pay per exercise.</h2>
            <p style={{color:"var(--i3)",marginTop:8,fontSize:14}}>Three months of access starts when you <strong>launch</strong> — not when you purchase.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:16,marginBottom:24}}>
            {[
              {l:"Single Exercise",p:"$990",s:"Up to 5,000 responses · Three months of access",feat:false},
              {l:"Bundle of 3",p:"$2,500",s:"Save $470 · best for active agencies",feat:true},
              {l:"Bundle of 6",p:"$4,500",s:"Save $1,440 · large firms",feat:false},
            ].map(pr=>(
              <div key={pr.l} className="card" style={pr.feat?{padding:26,background:"var(--f)",border:"1px solid var(--f)"}:{padding:26}}>
                <div className="badge" style={pr.feat?{background:"rgba(255,255,255,.12)",color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.15)"}:{}}>{pr.l}</div>
                <div style={{fontFamily:"var(--fd)",fontSize:44,fontWeight:300,marginTop:14,color:pr.feat?"white":"var(--f)",letterSpacing:"-.02em"}}>{pr.p}</div>
                <div style={{fontSize:12,color:pr.feat?"rgba(255,255,255,.55)":"var(--i3)",marginTop:3,marginBottom:16}}>{pr.s}</div>
                <button className={`btn bmd ${pr.feat?"bc":"bp"}`} style={{width:"100%",justifyContent:"center"}} onClick={onDash}>Get started</button>
              </div>
            ))}
          </div>
          <p style={{textAlign:"center",fontSize:13,color:"var(--i3)"}}>Custom pricing available for consultants and firms managing multiple projects. <span style={{color:"var(--f)",cursor:"pointer",fontWeight:500}}>Get in touch →</span></p>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{padding:"20px 28px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid var(--bd)",flexWrap:"wrap",gap:12}}>
        <NavLogo onClick={()=>{}}/>
        <p style={{fontSize:12,color:"var(--i4)"}}>© 2025 CivicSort · civicsort.com</p>
        <button className="btn bg bxs" style={{fontSize:10,color:"var(--i4)",opacity:.5}} onClick={()=>setSuperOpen(o=>!o)}>
          {superOpen?"▲ Admin":"▾ Admin"}
        </button>
      </div>

      {superOpen && <SuperPanel/>}
    </div>
  );
}

// ── SUPER ADMIN ───────────────────────────────────────────────────────────────
function SuperPanel(){
  const [users,setUsers]=useState(MOCK_USERS);
  const [stab,setStab]=useState("users");
  const upd=(id,patch)=>setUsers(us=>us.map(u=>u.id===id?{...u,...patch}:u));
  return (
    <div className="supanel">
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div>
            <h2 style={{fontFamily:"var(--fd)",fontWeight:300,fontSize:22,color:"white"}}>Super Admin</h2>
            <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:2}}>Manage users, accounts, and platform settings</p>
          </div>
        </div>
        <div style={{display:"flex",gap:2,marginBottom:24}}>
          {["users","settings","plans"].map(t=>(
            <button key={t} onClick={()=>setStab(t)} style={{padding:"7px 16px",borderRadius:"var(--r1)",border:"none",fontFamily:"var(--fb)",fontSize:13,cursor:"pointer",textTransform:"capitalize",background:stab===t?"rgba(255,255,255,.15)":"transparent",color:stab===t?"white":"rgba(255,255,255,.5)",fontWeight:stab===t?500:400,transition:"all .14s"}}>{t}</button>
          ))}
        </div>

        {stab==="users"&&(
          <div style={{overflowX:"auto",borderRadius:"var(--r3)",border:"1px solid rgba(255,255,255,.12)"}}>
            <table className="sutbl">
              <thead><tr><th>Name</th><th>Org</th><th>Email</th><th>Plan</th><th>Credits</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id}>
                    <td style={{fontWeight:500}}>{u.name}</td>
                    <td>{u.org}</td>
                    <td style={{fontFamily:"monospace",fontSize:12,color:"rgba(255,255,255,.55)"}}>{u.email}</td>
                    <td>
                      <select value={u.plan} onChange={e=>upd(u.id,{plan:e.target.value})} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"white",borderRadius:"var(--r1)",padding:"4px 8px",fontSize:12,fontFamily:"var(--fb)",cursor:"pointer"}}>
                        {["Single","Bundle of 3","Bundle of 6"].map(p=><option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <button onClick={()=>upd(u.id,{credits:Math.max(0,u.credits-1)})} style={{width:22,height:22,borderRadius:4,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.08)",color:"white",cursor:"pointer",fontFamily:"var(--fb)"}}>−</button>
                        <span style={{minWidth:16,textAlign:"center"}}>{u.credits}</span>
                        <button onClick={()=>upd(u.id,{credits:u.credits+1})} style={{width:22,height:22,borderRadius:4,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.08)",color:"white",cursor:"pointer",fontFamily:"var(--fb)"}}>+</button>
                      </div>
                    </td>
                    <td>
                      <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:99,fontSize:11,fontWeight:500,background:u.status==="active"?"rgba(22,163,74,.25)":"rgba(220,38,38,.25)",color:u.status==="active"?"#86efac":"#fca5a5",border:`1px solid ${u.status==="active"?"rgba(22,163,74,.4)":"rgba(220,38,38,.4)"}`}}>{u.status}</span>
                    </td>
                    <td>
                      <button onClick={()=>upd(u.id,{status:u.status==="active"?"suspended":"active"})} style={{padding:"4px 10px",borderRadius:"var(--r1)",border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.8)",fontSize:12,fontFamily:"var(--fb)",cursor:"pointer"}}>
                        {u.status==="active"?"Suspend":"Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {stab==="settings"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
            {[["Platform name","CivicSort"],["Support email","support@civicsort.com"],["Max options — Full Ranking","8"],["Max options — Quick Prioritization","20"],["Default response cap","5000"],["Exercise window (days)","90"]].map(([lbl,val])=>(
              <div key={lbl} style={{display:"flex",flexDirection:"column",gap:5}}>
                <label style={{fontSize:11,fontWeight:500,color:"rgba(255,255,255,.5)",letterSpacing:".04em",textTransform:"uppercase"}}>{lbl}</label>
                <input defaultValue={val} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"white",borderRadius:"var(--r1)",padding:"8px 12px",fontSize:13,fontFamily:"var(--fb)"}}/>
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}><button className="btn bc bsm">Save settings</button></div>
          </div>
        )}

        {stab==="plans"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
            {[{name:"Single",price:990,responses:5000,days:90},{name:"Bundle of 3",price:2500,responses:5000,days:90},{name:"Bundle of 6",price:4500,responses:5000,days:90}].map(pl=>(
              <div key={pl.name} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:"var(--r3)",padding:20}}>
                <div style={{fontFamily:"var(--fd)",fontSize:15,marginBottom:14,color:"white"}}>{pl.name}</div>
                {[["Price ($)",pl.price],["Response cap",pl.responses],["Window (days)",pl.days]].map(([lbl,val])=>(
                  <div key={lbl} style={{marginBottom:10}}>
                    <label style={{fontSize:11,color:"rgba(255,255,255,.4)",display:"block",marginBottom:3}}>{lbl}</label>
                    <input defaultValue={val} style={{background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"white",borderRadius:"var(--r1)",padding:"6px 10px",fontSize:13,fontFamily:"var(--fb)",width:"100%"}}/>
                  </div>
                ))}
                <button style={{padding:"4px 10px",borderRadius:"var(--r1)",border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.8)",fontSize:12,fontFamily:"var(--fb)",cursor:"pointer",marginTop:4}}>Update</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({onLogin,onSignup,onBack,loading}){
  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [org,setOrg]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [info,setInfo]=useState("");

  const submit=async()=>{
    setErr("");setInfo("");
    if(!email.trim()){setErr("Email is required.");return;}
    if(!pass.trim()||pass.length<6){setErr("Password must be at least 6 characters.");return;}
    if(mode==="signup"&&!name.trim()){setErr("Name is required.");return;}
    if(mode==="login"){
      const e=await onLogin(email,pass);
      if(e) setErr(e);
    } else {
      const e=await onSignup(email,pass,name,org);
      if(e==="confirm") setInfo("Check your email to confirm your account, then sign in.");
      else if(e) setErr(e);
      // if null, signup succeeded with immediate session — App handles redirect
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:"var(--bg)"}}>
      <NavLogo onClick={onBack}/>
      <div className="card" style={{width:"100%",maxWidth:400,padding:32,marginTop:24}}>
        <h2 style={{fontSize:20,marginBottom:2,fontWeight:300}}>{mode==="login"?"Welcome back":"Create your account"}</h2>
        <p style={{fontSize:13,color:"var(--i3)",marginBottom:24}}>{mode==="login"?"Sign in to your CivicSort account":"Free to set up. Pay only when you launch."}</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {mode==="signup"&&<div className="fi"><label className="lbl">Your name</label><input className="inp" placeholder="Jane Smith" value={name} onChange={e=>setName(e.target.value)}/></div>}
          {mode==="signup"&&<div className="fi"><label className="lbl">Organisation <span style={{color:"var(--i4)"}}>(optional)</span></label><input className="inp" placeholder="City of Springfield" value={org} onChange={e=>setOrg(e.target.value)}/></div>}
          <div className="fi"><label className="lbl">Email</label><input className="inp" type="email" placeholder="you@agency.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          <div className="fi"><label className="lbl">Password</label><input className="inp" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          {err&&<p style={{fontSize:12,color:"var(--rd)",margin:0}}>{err}</p>}
          {info&&<p style={{fontSize:12,color:"var(--gn)",margin:0}}>{info}</p>}
          <button className="btn bp bmd" style={{justifyContent:"center",marginTop:4}} onClick={submit} disabled={loading}>
            {loading?"Please wait…":mode==="login"?"Sign in →":"Create account →"}
          </button>
        </div>
        <p style={{fontSize:12,color:"var(--i3)",textAlign:"center",marginTop:16}}>
          {mode==="login"?<>New? <span style={{color:"var(--f)",cursor:"pointer",fontWeight:500}} onClick={()=>{setMode("signup");setErr("");setInfo("");}}>Create an account</span></>
          :<>Already have an account? <span style={{color:"var(--f)",cursor:"pointer",fontWeight:500}} onClick={()=>{setMode("login");setErr("");setInfo("");}}>Sign in</span></>}
        </p>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({tab,setTab,projects,user,profile,onLogout,onBack,onVote,onResults,onNew,onEdit,onDelete,onDuplicate,onToggleStatus}){
  const items=[{id:"projects",lbl:"Projects"},{id:"analytics",lbl:"Analytics"},{id:"account",lbl:"Account"}];
  return (
    <div>
      <nav className="nav">
        <NavLogo onClick={onBack}/>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:12,color:"var(--i3)",padding:"5px 10px",background:"var(--sub)",borderRadius:"var(--r1)",border:"1px solid var(--bd)"}}>Riverside Consulting</span>
          <button className="btn bg bsm" onClick={onBack}>← Home</button>
        </div>
      </nav>
      <div className="dash">
        <aside className="sb">
          <div className="sbsec">Workspace</div>
          {items.map(i=><button key={i.id} className={`sbit${tab===i.id?" on":""}`} onClick={()=>setTab(i.id)}>{i.lbl}</button>)}
        </aside>
        <main className="main">
          {tab==="projects"  && <ProjectsView projects={projects} onNew={onNew} onVote={onVote} onResults={onResults} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} onToggleStatus={onToggleStatus}/>}
          {tab==="analytics" && <AnalyticsView projects={projects}/>}
          {tab==="account"   && <AccountView/>}
        </main>
      </div>
    </div>
  );
}

function ProjectsView({projects,onNew,onVote,onResults,onEdit,onDelete,onDuplicate,onToggleStatus}){
  return (
    <div className="fai">
      <div className="ph">
        <div><h1 className="pt">Projects</h1><p className="pst">{projects.length} exercise{projects.length!==1?"s":""}</p></div>
        <button className="btn bp bsm" onClick={onNew}>+ New project</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(296px,1fr))",gap:16}}>
        {projects.map(p=>(
          <div key={p.id} className="card hov" style={{padding:20}}>
            <div style={{height:3,borderRadius:99,background:p.color,marginBottom:16}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
              <h3 style={{fontSize:14,fontWeight:500,fontFamily:"var(--fb)"}}>{p.name}</h3>
<>{p.isTemplate&&<span className="badge bga" style={{marginRight:4}}>Template</span>}<span className={`badge ${p.status==="active"?"bgg":p.status==="closed"?"bdr":"bgy"}`}>{p.status}</span></>
            </div>
            <p style={{fontSize:12,color:"var(--i3)",lineHeight:1.5,marginBottom:12}}>{p.description}</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
              <span className="chip">{p.responses} responses</span>
              <span className="chip">{p.type==="roundrobin"?"Full Ranking":"Quick Prioritization"}</span>
              {p.kioskMode&&<span className="chip">Kiosk</span>}
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <button className="btn bp bsm" onClick={()=>onVote(p)}>Preview</button>
              <button className="btn bo bsm" onClick={()=>onResults(p)}>Results</button>
              <button className="btn bo bsm" onClick={()=>onEdit(p)}>Edit</button>
              <button className={`btn bsm ${p.status==="active"?"bga":"bgg"}`} onClick={()=>onToggleStatus?onToggleStatus(p):null}>{p.status==="active"?"Close":"Launch"}</button>
              <button className="btn bg bsm" title="Duplicate" onClick={()=>onDuplicate(p)} style={{marginLeft:"auto"}}>⧉ Copy</button>
              <button className="btn bg bsm" style={{color:"var(--rd)"}} onClick={()=>onDelete(p.id)}>✕</button>
            </div>
            <div style={{marginTop:12,padding:"7px 10px",background:"var(--sub)",borderRadius:"var(--r1)",border:"1px solid var(--bd)",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"var(--f)",fontWeight:500}}>civicsort.com/{p.slug}</span>
            </div>
          </div>
        ))}
        <div className="card" style={{padding:24,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,border:"1.5px dashed var(--bd)",background:"transparent",cursor:"pointer",minHeight:180}} onClick={onNew}>
          <span style={{fontSize:24,color:"var(--bdm)"}}>+</span>
          <span style={{fontSize:13,color:"var(--i3)"}}>New project</span>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({projects}){
  const total=projects.reduce((a,p)=>a+p.responses,0);
  return (
    <div className="fai">
      <div className="ph"><div><h1 className="pt">Analytics</h1><p className="pst">Across all projects</p></div></div>
      <div className="srow">
        {[{v:total,l:"Total responses"},{v:projects.filter(p=>p.status==="active").length,l:"Active"},{v:projects.length,l:"Total projects"},{v:"98%",l:"Completion rate"}].map(s=>(
          <div key={s.l} className="card sc"><div className="sv">{s.v}</div><div className="sl">{s.l}</div></div>
        ))}
      </div>
      {projects.map(p=>(
        <div key={p.id} className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{p.name}</div><div style={{fontSize:12,color:"var(--i3)"}}>{p.type==="roundrobin"?"Full Ranking":"Quick Prioritization"}</div></div>
          <div style={{fontFamily:"var(--fd)",fontSize:24,color:"var(--f)",fontWeight:300}}>{p.responses}</div>
          <div style={{width:80}}><div style={{height:4,background:"var(--ins)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,(p.responses/150)*100)}%`,background:p.color,borderRadius:99}}/></div></div>
        </div>
      ))}
    </div>
  );
}

function AccountView(){
  return (
    <div className="fai">
      <div className="ph"><div><h1 className="pt">Account</h1></div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
        <div className="card" style={{padding:22}}>
          <h3 style={{fontSize:14,fontWeight:500,fontFamily:"var(--fb)",marginBottom:12}}>Credits</h3>
          <div style={{padding:14,background:"var(--sub)",borderRadius:"var(--r2)",border:"1px solid var(--bd)"}}>
            <div style={{fontFamily:"var(--fd)",fontSize:32,color:"var(--f)",fontWeight:300}}>2</div>
            <div style={{fontSize:12,color:"var(--i3)",marginTop:2}}>exercises remaining · Bundle of 3</div>
          </div>
          <button className="btn bp bsm" style={{marginTop:12}}>Buy more</button>
        </div>
        <div className="card" style={{padding:22}}>
          <h3 style={{fontSize:14,fontWeight:500,fontFamily:"var(--fb)",marginBottom:12}}>Profile</h3>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div className="fi"><label className="lbl">Organization</label><input className="inp" defaultValue="Riverside Consulting Group"/></div>
            <div className="fi"><label className="lbl">Email</label><input className="inp" type="email" defaultValue="admin@riversidecg.com"/></div>
            <button className="btn bp bsm" style={{alignSelf:"flex-start"}}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EXPORT / RESULTS ──────────────────────────────────────────────────────────
function ExportPage({project,projects,onBack}){
  const [selId,setSelId]=useState(project.id);
  const [rTab,setRTab]=useState("summary");
  const [orgName,setOrgName]=useState("Riverside Consulting Group");
  const [rawData,setRawData]=useState(()=>genRaw(project));
  const [selected,setSelected]=useState(new Set());
  const [reportColor,setReportColor]=useState(project.color);

  const p=projects.find(x=>x.id===selId)||project;
  useEffect(()=>{setRawData(genRaw(p));setSelected(new Set());setReportColor(p.color);},[selId,p]);

  const results=[...p.options].map(o=>({...o,score:p.mockScores[o.id]||0})).sort((a,b)=>b.score-a.score);
  const maxScore=results[0]?.score||1;
  const total=results.reduce((a,r)=>a+r.score,0);
  const visible=rawData.filter(r=>!r.deleted);
  const allChk=visible.length>0&&visible.every(r=>selected.has(r.id));
  const toggle=id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const del=()=>{setRawData(d=>d.map(r=>selected.has(r.id)?{...r,deleted:true}:r));setSelected(new Set());};

  return (
    <div>
      <nav className="nav">
        <NavLogo/>
        <div style={{display:"flex",gap:8}}>
          <button className="btn bg bsm" onClick={onBack}>← Dashboard</button>
          <button className="btn bc bsm" onClick={()=>window.print()}>Export PDF</button>
        </div>
      </nav>
      <div className="exlay">
        <div className="exsb">
          <div className="fi"><label className="lbl">Project</label>
            <select className="sel" value={selId} onChange={e=>setSelId(e.target.value)}>
              {projects.map(px=><option key={px.id} value={px.id}>{px.name}</option>)}
            </select>
          </div>
          <div className="fi"><label className="lbl">Org name</label><input className="inp" value={orgName} onChange={e=>setOrgName(e.target.value)}/></div>
          <div>
            <div className="lbl" style={{marginBottom:6}}>Report color</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="color" value={reportColor} onChange={e=>setReportColor(e.target.value)} style={{width:36,height:36,border:"1px solid var(--bd)",borderRadius:"var(--r1)",cursor:"pointer",padding:2,background:"var(--sur)"}}/>
              <input className="inp" value={reportColor} onChange={e=>/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)&&setReportColor(e.target.value)} style={{fontFamily:"monospace",fontSize:13,width:96}} maxLength={7} placeholder="#1B2A4A"/>
              <div style={{width:28,height:28,borderRadius:"var(--r1)",background:reportColor,border:"1px solid var(--bd)",flexShrink:0}}/>
            </div>
          </div>
          <div className="divider"/>
          <button className="btn bp bmd" style={{justifyContent:"center"}} onClick={()=>window.print()}>Export PDF</button>
        </div>
        <div className="exmain">
          <div className="exrep">
            <div className="tline">
              {["summary","raw data"].map(t=><button key={t} className={`tl${rTab===t?" on":""}`} onClick={()=>setRTab(t)} style={{textTransform:"capitalize"}}>{t}</button>)}
            </div>

            {rTab==="summary"&&(
              <div>
                <div className="rephdr" style={{background:reportColor}}>
                  <h2 style={{fontFamily:"var(--fd)",fontSize:22,fontWeight:300,marginBottom:4}}>{p.name}</h2>
                  <div style={{fontSize:13,opacity:.7}}>{orgName}</div>
                  <div style={{fontSize:12,opacity:.55,marginTop:3}}>{p.type==="roundrobin"?"Full Ranking":"Quick Prioritization"} · {p.options.length} options · {p.responses} responses</div>
                </div>
                {results.length>=3&&(
                  <div className="repsec" style={{background:"var(--f)",borderColor:"var(--f)"}}>
                    <div style={{fontSize:11,fontWeight:500,letterSpacing:".08em",textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:18,textAlign:"center"}}>
                      {p.type==="tournament"?"Quick Prioritization — Top 3":"Full Ranking — Top 3"}
                    </div>
                    <div className="podium">
                      <div className="pcol"><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:"var(--i4)",marginBottom:4}}>2nd</div><div className="pbar psi">2</div><div className="pname" style={{color:"rgba(255,255,255,.7)"}}>{results[1]?.name}</div></div>
                      <div className="pcol"><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:"var(--i4)",marginBottom:4}}>1st</div><div className="pbar pg">1</div><div className="pname" style={{color:"white",fontWeight:600}}>{results[0]?.name}</div></div>
                      <div className="pcol"><div style={{fontSize:11,fontWeight:700,letterSpacing:".04em",color:"var(--i4)",marginBottom:4}}>3rd</div><div className="pbar pb2">3</div><div className="pname" style={{color:"rgba(255,255,255,.7)"}}>{results[2]?.name}</div></div>
                    </div>
                  </div>
                )}
                <div className="repsec">
                  <div style={{fontSize:11,fontWeight:500,color:"var(--i3)",marginBottom:14,letterSpacing:".04em",textTransform:"uppercase"}}>All Rankings</div>
                  {results.map((r,i)=>(
                    <div key={r.id} className="rrow">
                      <div className="rrnk" style={i<3?{background:[reportColor+"22","var(--sub)","var(--ins)"][i],color:[reportColor,"var(--i2)","var(--i3)"][i],fontWeight:700}:{}}>{i+1}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:13,fontWeight:500}}>{r.name}</span><span style={{fontSize:12,color:"var(--i3)"}}>{total>0?Math.round((r.score/total)*100):0}%</span></div>
                        <div className="rbar"><div className="rfill" style={{width:`${(r.score/maxScore)*100}%`,background:reportColor}}/></div>
                      </div>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--i3)",width:36,textAlign:"right"}}>{r.score}</div>
                    </div>
                  ))}
                </div>
                <div style={{textAlign:"center",fontSize:11,color:"var(--i4)",padding:"12px 0",borderTop:"1px solid var(--bd)"}}>Generated with <strong style={{color:"var(--f)"}}>CivicSort</strong> · {orgName}</div>
              </div>
            )}

            {rTab==="raw data"&&(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{visible.length} responses</div><div style={{fontSize:12,color:"var(--i3)"}}>{rawData.filter(r=>r.deleted).length} deleted</div></div>
                  {selected.size>0&&<button className="btn bdr bsm" onClick={del}>Delete {selected.size} row{selected.size!==1?"s":""}</button>}
                  <button className="btn bo bsm">↓ CSV</button>
                </div>
                {selected.size>0&&<div className="aler alw" style={{marginBottom:12,fontSize:12}}>⚠ Deleted rows are excluded from rankings. Cannot be undone.</div>}
                <div className="dtwrap">
                  <table className="dt">
                    <thead>
                      <tr>
                        <th style={{width:32}}><input type="checkbox" checked={allChk} onChange={()=>setSelected(allChk?new Set():new Set(visible.map(r=>r.id)))} style={{accentColor:"var(--f)"}}/></th>
                        <th>#</th><th>Timestamp</th><th>Top Choice</th><th>ZIP</th><th>Age</th><th>Device</th><th>IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row,i)=>(
                        <tr key={row.id} className={selected.has(row.id)?"selr":""} onClick={()=>toggle(row.id)} style={{cursor:"pointer"}}>
                          <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selected.has(row.id)} onChange={()=>toggle(row.id)} style={{accentColor:"var(--f)"}}/></td>
                          <td style={{color:"var(--i4)"}}>{i+1}</td>
                          <td style={{fontFamily:"monospace",fontSize:11,color:"var(--i3)"}}>{new Date(row.ts).toLocaleDateString()} {new Date(row.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</td>
                          <td style={{fontWeight:500}}>{row.topChoice}</td>
                          <td style={{color:"var(--i3)"}}>{row.zip||"—"}</td>
                          <td style={{color:"var(--i3)"}}>{row.age||"—"}</td>
                          <td style={{color:"var(--i3)",textTransform:"capitalize"}}>{row.device}</td>
                          <td style={{fontFamily:"monospace",fontSize:11,color:"var(--i4)"}}>{row.ip||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{fontSize:11,color:"var(--i4)",marginTop:8,textAlign:"right"}}>Click rows to select · Deleted rows excluded from results</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function genRaw(project){
  if(!project.responses||project.responses===0) return [];
  const zips=["97201","97202","97203","97204","97205"];
  const ages=["18-24","25-34","35-44","45-54","55-64","65+"];
  const devices=["mobile","tablet","desktop"];
  const ips=["73.162.44.12","24.5.68.201","98.207.34.11","67.180.12.99","47.221.55.180","76.94.200.31"];
  return Array.from({length:project.responses},(_,i)=>{
    const ts=new Date(Date.now()-Math.random()*7*86400000);
    const opt=project.options[Math.floor(Math.random()*project.options.length)];
    return {id:"r"+(i+1),ts:ts.toISOString(),topChoice:opt.name,zip:Math.random()>.3?zips[Math.floor(Math.random()*zips.length)]:"",age:Math.random()>.4?ages[Math.floor(Math.random()*ages.length)]:"",device:devices[Math.floor(Math.random()*devices.length)],ip:ips[Math.floor(Math.random()*ips.length)],deleted:false};
  });
}

// ── PROJECT MODAL ─────────────────────────────────────────────────────────────
function ProjectModal({project,onSave,onClose}){
  const isNew=!project;
  const [form,setForm]=useState(project||{name:"",slug:"",type:"roundrobin",status:"draft",color:"#1B2A4A",accent:"#d96b52",description:"",introText:"",introBanner:null,vsLabel:"VS",font:"default",resultView:"bars",demoEnabled:false,showResults:true,kioskMode:false,captcha:false,logo:null,options:[{id:"o1",name:"Option A",desc:"",img:null},{id:"o2",name:"Option B",desc:"",img:null}],demographics:[],mockScores:{}});
  const [iTab,setITab]=useState("basics");
  const [newOpt,setNewOpt]=useState({name:"",desc:"",img:null});
  const [dragIdx,setDragIdx]=useState(null);
  const handleLogo=file=>{
    if(!file)return;
    const r=new FileReader();
    r.onload=e=>setForm(f=>({...f,logo:e.target.result}));
    r.readAsDataURL(file);
  };
  const handleBanner=file=>{
    if(!file)return;
    resizeImg(file,src=>setForm(f=>({...f,introBanner:src})),1200,500);
  };
  const MAX=form.type==="roundrobin"?8:20;

  const resizeImg=(file,cb,maxW=800,maxH=600)=>{
    const r=new FileReader();
    r.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.width,maxH/img.height);
        const canvas=document.createElement("canvas");
        canvas.width=img.width*scale; canvas.height=img.height*scale;
        canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
        cb(canvas.toDataURL("image/jpeg",.85));
      };
      img.src=e.target.result;
    };
    r.readAsDataURL(file);
  };
  const handleImg=(id,file)=>{
    if(!file)return;
    resizeImg(file,src=>setForm(f=>({...f,options:f.options.map(o=>o.id===id?{...o,img:src}:o)})));
  };
  const handleNewImg=file=>{
    if(!file)return;
    resizeImg(file,src=>setNewOpt(n=>({...n,img:src})));
  };
  const addOpt=()=>{
    if(!newOpt.name.trim()||form.options.length>=MAX)return;
    setForm(f=>({...f,options:[...f.options,{id:"o"+Date.now(),...newOpt}]}));
    setNewOpt({name:"",desc:"",img:null});
  };

  return (
    <div className="mov" onClick={onClose}>
      <div className="modal sli" onClick={e=>e.stopPropagation()}>
        <div className="mh">
          <h3 style={{fontSize:15,fontWeight:500,fontFamily:"var(--fb)"}}>{isNew?"New project":"Edit project"}</h3>
          <button className="btn bg bxs" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:"12px 22px 0"}}>
          <div className="tpill">
            {["basics","options","demographics","branding","settings"].map(t=><button key={t} className={`tp${iTab===t?" on":""}`} onClick={()=>setITab(t)} style={{textTransform:"capitalize"}}>{t}</button>)}
          </div>
        </div>
        <div className="mb">

          {iTab==="basics"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div className="fi"><label className="lbl">Project name *</label>
                <input className="inp" placeholder="e.g. Westside Park Master Plan" value={form.name}
                  onChange={e=>setForm({...form,name:e.target.value,slug:e.target.value.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")})}/>
              </div>
              <div className="fi"><label className="lbl">URL slug</label>
                <div style={{display:"flex",borderRadius:"var(--r2)",overflow:"hidden",border:"1px solid var(--bd)"}}>
                  <span style={{padding:"8px 10px",background:"var(--sub)",fontSize:12,color:"var(--i3)",whiteSpace:"nowrap",borderRight:"1px solid var(--bd)",fontFamily:"monospace"}}>civicsort.com/</span>
                  <input className="inp" style={{border:"none",borderRadius:0}} placeholder="my-project" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/>
                </div>
              </div>
              <div className="fi"><label className="lbl">Description</label>
                <textarea className="ta" placeholder="Shown to participants before voting. Explain the purpose, context, any tradeoffs they should consider…" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{minHeight:120}}/>
              <div style={{fontSize:11,color:"var(--i4)",textAlign:"right",marginTop:2}}>{form.description.length} characters</div>
              <div className="fi" style={{marginTop:8}}>
                <label className="lbl">Vote prompt <span style={{color:"var(--i4)"}}>(the question shown during voting)</span></label>
                <input className="inp" placeholder="Which matters more to you?" value={form.vsPrompt||""} onChange={e=>setForm({...form,vsPrompt:e.target.value})}/>
              </div>
              <div className="fi" style={{marginTop:8}}>
                <label className="lbl">Intro text <span style={{color:"var(--i4)"}}>(optional — shown below description)</span></label>
                <textarea className="ta" placeholder="Add context, framing, or instructions for participants…" value={form.introText||""} onChange={e=>setForm({...form,introText:e.target.value})} style={{minHeight:72}}/>
              </div>
              <div style={{marginTop:8}}>
                <div className="lbl" style={{marginBottom:6}}>Intro banner image <span style={{color:"var(--i4)"}}>(optional)</span></div>
                <label htmlFor="banner-upload" style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:form.introBanner?120:60,borderRadius:"var(--r2)",border:"1.5px dashed var(--bd)",background:"var(--sub)",cursor:"pointer",overflow:"hidden"}}>
                  {form.introBanner?<img src={form.introBanner} alt="Banner" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{textAlign:"center"}}><div style={{fontSize:11,fontWeight:600,opacity:.3,marginBottom:4}}>IMG</div><div style={{fontSize:11,color:"var(--i4)"}}>Upload banner (1200×500 recommended)</div></div>}
                  <input id="banner-upload" type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleBanner(e.target.files[0])}/>
                </label>
                {form.introBanner&&<button className="btn bg bxs" style={{marginTop:4,color:"var(--rd)"}} onClick={()=>setForm(f=>({...f,introBanner:null}))}>Remove banner</button>}
              </div>
              </div>
              <div className="fi"><label className="lbl">Voting method</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{v:"roundrobin",t:"Full Ranking",d:"Every vs every · max 8 · complete list"},{v:"tournament",t:"Quick Prioritization",d:"Bracket · max 20 · top-3 podium"}].map(m=>(
                    <div key={m.v} onClick={()=>setForm({...form,type:m.v})} style={{padding:12,borderRadius:"var(--r2)",border:`1.5px solid ${form.type===m.v?"var(--f)":"var(--bd)"}`,background:form.type===m.v?"var(--fp)":"var(--sur)",cursor:"pointer",transition:"all .13s"}}>
                      <div style={{fontWeight:500,fontSize:13,color:form.type===m.v?"var(--f)":"var(--i1)"}}>{m.t}</div>
                      <div style={{fontSize:11,color:"var(--i3)",marginTop:2}}>{m.d}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="lbl" style={{marginBottom:6}}>Project color</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} style={{width:36,height:36,border:"1px solid var(--bd)",borderRadius:"var(--r1)",cursor:"pointer",padding:2,background:"var(--sur)"}}/>
                  <input className="inp" value={form.color} onChange={e=>/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)&&setForm({...form,color:e.target.value})} style={{fontFamily:"monospace",fontSize:13,width:96}} maxLength={7} placeholder="#1B2A4A"/>
                  <div style={{width:28,height:28,borderRadius:"var(--r1)",background:form.color,border:"1px solid var(--bd)",flexShrink:0}}/>
                </div>
              </div>
            </div>
          )}

          {iTab==="options"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:12,color:"var(--i3)"}}>{form.options.length} / {MAX}</span>
                {form.options.length>=MAX&&<span className="badge bga">Max {MAX} reached</span>}
              </div>
              {form.options.map((o,oi)=>(
                <div key={o.id} draggable onDragStart={()=>setDragIdx(oi)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragIdx===null||dragIdx===oi)return;const opts=[...form.options];const[moved]=opts.splice(dragIdx,1);opts.splice(oi,0,moved);setForm(f=>({...f,options:opts}));setDragIdx(null);}} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"10px 12px",background:dragIdx===oi?"var(--fp)":"var(--sur)",border:`1.5px solid ${dragIdx===oi?"var(--f)":"var(--bd)"}`,borderRadius:"var(--r2)",marginBottom:7,transition:"all .13s"}}>
                  <div style={{color:"var(--i4)",fontSize:16,cursor:"grab",paddingTop:10,flexShrink:0}} title="Drag to reorder">⠿</div>
                  <label htmlFor={`img-${o.id}`} className="oth" style={{cursor:"pointer",flexShrink:0}} aria-label={`Upload image for ${o.name}`} title="Click to upload image">
                    {o.img?<img src={o.img} alt={o.altText||o.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:11,opacity:.35,fontWeight:600}}>IMG</span>}
                    
                    <input id={`img-${o.id}`} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImg(o.id,e.target.files[0])}/>
                  </label>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:500,fontSize:13}}>{o.name}</div>
                    {o.desc&&<div style={{fontSize:12,color:"var(--i3)"}}>{o.desc}</div>}
                    {o.img&&<input className="inp" style={{fontSize:11,padding:"4px 8px",marginTop:3}} placeholder="Alt text for screen readers" value={o.altText||""} onChange={e=>setForm(f=>({...f,options:f.options.map(x=>x.id===o.id?{...x,altText:e.target.value}:x)}))} aria-label="Image alt text"/>}
                  </div>
                  <button className="btn bg bxs" style={{color:"var(--i4)"}} aria-label={`Remove ${o.name}`} onClick={()=>setForm(f=>({...f,options:f.options.filter(x=>x.id!==o.id)}))}>✕</button>
                </div>
              ))}
              <p style={{fontSize:11,color:"var(--i4)",marginBottom:10}}>Click thumbnail to upload a photo. Recommended: 800×600px, landscape. Images are auto-resized on upload.</p>
              {form.options.length<MAX&&(
                <div style={{background:"var(--sub)",borderRadius:"var(--r2)",padding:12,border:"1px solid var(--bd)",display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:11,fontWeight:500,color:"var(--i3)",textTransform:"uppercase",letterSpacing:".05em"}}>Add option</div>
                  <div style={{display:"flex",gap:7,alignItems:"center"}}>
                    <label htmlFor="noi" className="oth" style={{cursor:"pointer",flexShrink:0}} aria-label="Upload image for new option">
                      {newOpt.img?<img src={newOpt.img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"var(--r1)"}}/>:<span style={{fontSize:11,opacity:.35,fontWeight:600}}>IMG</span>}
                      
                      <input id="noi" type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleNewImg(e.target.files[0])}/>
                    </label>
                    <input className="inp" placeholder="Option name *" value={newOpt.name} onChange={e=>setNewOpt({...newOpt,name:e.target.value})} style={{flex:1}}/>
                  </div>
                  <input className="inp" placeholder="Short description (optional)" value={newOpt.desc} onChange={e=>setNewOpt({...newOpt,desc:e.target.value})}/>
                  <button className="btn bp bsm" style={{alignSelf:"flex-start"}} onClick={addOpt}>+ Add</button>
                </div>
              )}
            </div>
          )}

          {iTab==="demographics"&&(
            <div>
              <div className="togw" style={{marginBottom:16}} onClick={()=>setForm({...form,demoEnabled:!form.demoEnabled})}>
                <div className={`tog${form.demoEnabled?" on":""}`}/>
                <div><div style={{fontSize:13,fontWeight:500}}>Enable demographics screen</div><div style={{fontSize:12,color:"var(--i3)"}}>Shown after voting — all fields optional</div></div>
              </div>
              {form.demoEnabled&&(
                <div>
                  {form.demographics.map(d=>(
                    <div key={d.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",background:"var(--sur)",border:"1px solid var(--bd)",borderRadius:"var(--r2)",marginBottom:6}}>
                      <span style={{flex:1,fontSize:13}}>{d.label}</span>
                      <span className="badge bgy">{d.type}</span>
                      <button className="btn bg bxs" onClick={()=>setForm(f=>({...f,demographics:f.demographics.filter(x=>x.id!==d.id)}))}>✕</button>
                    </div>
                  ))}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:8}}>
                    {[{type:"email",label:"Email Address"},{type:"zipcode",label:"ZIP Code"},{type:"age",label:"Age Range"},{type:"gender",label:"Gender"},{type:"neighborhood",label:"Neighborhood"}].map(d=>(
                      <button key={d.type} className="btn bo bsm" style={{justifyContent:"flex-start"}} onClick={()=>setForm(f=>({...f,demographics:[...f.demographics,{id:"d"+Date.now(),...d}]}))}>+ {d.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {iTab==="branding"&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="lbl" style={{marginBottom:6}}>Exercise logo</div>
                <p style={{fontSize:12,color:"var(--i3)",marginBottom:10,lineHeight:1.6}}>Shown at the top of the voting screen. Recommended: PNG with transparent background, at least 200×80px.</p>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <label htmlFor="logo-upload" style={{display:"flex",alignItems:"center",justifyContent:"center",width:120,height:56,borderRadius:"var(--r2)",border:"1.5px dashed var(--bd)",background:"var(--sub)",cursor:"pointer",overflow:"hidden",flexShrink:0}}>
                    {form.logo?<img src={form.logo} alt="Logo" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:<div style={{textAlign:"center"}}><div style={{fontSize:10,fontWeight:600,opacity:.3,marginBottom:2}}>LOGO</div><div style={{fontSize:10,color:"var(--i4)"}}>Upload</div></div>}
                    <input id="logo-upload" type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleLogo(e.target.files[0])}/>
                  </label>
                  {form.logo&&<button className="btn bg bxs" style={{color:"var(--rd)"}} onClick={()=>setForm(f=>({...f,logo:null}))}>Remove logo</button>}
                </div>
              </div>
              <div>
                <div className="lbl" style={{marginBottom:6}}>Project color</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} style={{width:36,height:36,border:"1px solid var(--bd)",borderRadius:"var(--r1)",cursor:"pointer",padding:2,background:"var(--sur)"}}/>
                  <input className="inp" value={form.color} onChange={e=>/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)&&setForm({...form,color:e.target.value})} style={{fontFamily:"monospace",fontSize:13,width:96}} maxLength={7} placeholder="#1B2A4A"/>
                  <div style={{width:28,height:28,borderRadius:"var(--r1)",background:form.color,border:"1px solid var(--bd)",flexShrink:0}}/>
                </div>
              </div>
              <div>
                <div className="lbl" style={{marginBottom:6}}>Comparison label</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {["VS","or","/","·"].map(v=>(
                    <button key={v} className={`btn bsm ${form.vsLabel===v?"bp":"bo"}`} onClick={()=>setForm({...form,vsLabel:v})}>{v}</button>
                  ))}
                  <input className="inp" style={{width:80,fontSize:13}} placeholder="Custom…" value={["VS","or","/","·"].includes(form.vsLabel)?"":form.vsLabel||""} onChange={e=>setForm({...form,vsLabel:e.target.value})}/>
                </div>
              </div>
              <div>
                <div className="lbl" style={{marginBottom:8}}>Font style</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {[
                    {id:"default",label:"Default",head:"Fraunces",body:"Inter"},
                    {id:"modern",label:"Modern",head:"DM Sans",body:"DM Sans"},
                    {id:"editorial",label:"Editorial",head:"Playfair Display",body:"Source Sans 3"},
                    {id:"civic",label:"Civic",head:"Libre Baskerville",body:"Open Sans"},
                    {id:"clean",label:"Clean",head:"Plus Jakarta Sans",body:"Plus Jakarta Sans"},
                  ].map(f=>(
                    <div key={f.id} onClick={()=>setForm(fm=>({...fm,font:f.id}))} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:"var(--r2)",border:`1.5px solid ${form.font===f.id?"var(--f)":"var(--bd)"}`,background:form.font===f.id?"var(--fp)":"var(--sur)",cursor:"pointer",transition:"all .13s"}}>
                      <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${form.font===f.id?"var(--f)":"var(--bd)"}`,background:form.font===f.id?"var(--f)":"transparent",flexShrink:0}}/>
                      <div>
                        <div style={{fontFamily:`'${f.head}',serif`,fontSize:14,fontWeight:400}}>{f.label}</div>
                        <div style={{fontSize:11,color:"var(--i4)"}}>{f.head} + {f.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {iTab==="settings"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[{k:"showResults",t:"Show results after voting",s:"Participants see the ranked results after submitting"},{k:"kioskMode",t:"Kiosk mode",s:"Auto-resets after each submission. For shared iPads at meetings."},{k:"captcha",t:"Require CAPTCHA",s:"Checkbox verification. Recommended for online-only exercises."},{k:"randomize",t:"Randomize option order",s:"Shuffles options differently for each voter to reduce position bias."}].map(s=>(
                <div key={s.k}>
                  <div className="togw" onClick={()=>setForm({...form,[s.k]:!form[s.k]})}>
                    <div className={`tog${form[s.k]?" on":""}`}/>
                    <div><div style={{fontSize:13,fontWeight:500}}>{s.t}</div><div style={{fontSize:12,color:"var(--i3)",marginTop:2}}>{s.s}</div></div>
                  </div>
                  <div className="divider"/>
                </div>
              ))}
            </div>
          )}

        </div>
        <div className="mf">
          <button className="btn bg bsm" onClick={onClose}>Cancel</button>
          <button className="btn bp bsm" onClick={()=>onSave(form)}>{isNew?"Create project":"Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

// ── VOTE PAGE ─────────────────────────────────────────────────────────────────
function VotePage({vs,setVS,onExit}){
  const {project,mode,tState,rrPairs,rrIdx,rrVotes,step,demo,lang,capDone,isPreview}=vs;
  const holdRef=useRef(null);
  const [exitConfirm,setExitConfirm]=useState(false);
  const [previewMode,setPreviewMode]=useState("desktop");
  const fontVars={
    default:{h:"'Fraunces',serif",b:"'Inter',sans-serif"},
    modern:{h:"'DM Sans',sans-serif",b:"'DM Sans',sans-serif"},
    editorial:{h:"'Playfair Display',serif",b:"'Source Sans 3',sans-serif"},
    civic:{h:"'Libre Baskerville',serif",b:"'Open Sans',sans-serif"},
    clean:{h:"'Plus Jakarta Sans',sans-serif",b:"'Plus Jakarta Sans',sans-serif"},
  };
  const fv=fontVars[project.font]||fontVars.default;


  const rrTotal=rrPairs.length||1;
  const tTotal=tState?.matchups?.length||1;
  const progress=mode==="roundrobin"?(rrIdx/rrTotal)*100:(tState?((tState.matchIdx||0)/tTotal)*100:0);
  const currentPair=mode==="roundrobin"?rrPairs[rrIdx]:tState&&!tDone(tState)?tState.matchups[tState.matchIdx]:null;

  const handleVote=winnerId=>{
    if(mode==="roundrobin"){
      const newVotes=[...rrVotes,winnerId];
      const newIdx=rrIdx+1;
      if(newIdx<rrPairs.length){
        setVS({...vs,rrVotes:newVotes,rrIdx:newIdx});
      } else {
        const next=project.captcha&&!capDone?"captcha":project.demoEnabled?"demo":project.showResults?"results":"thanks";
        setVS({...vs,rrVotes:newVotes,step:next});
      }
    } else {
      const newT=tournamentVote(tState,winnerId);
      if(tDone(newT)){
        const next=project.captcha&&!capDone?"captcha":project.demoEnabled?"demo":project.showResults?"results":"thanks";
        setVS({...vs,tState:newT,step:next});
      } else {
        setVS({...vs,tState:newT});
      }
    }
  };

  const handleDone=()=>{
    if(project.kioskMode) setVS({...vs,step:"intro",tState:mode==="tournament"?initTournament(project.options):null,rrIdx:0,rrVotes:[],demo:{},capDone:false});
    else onExit();
  };

  const rrResults=calcRR(project.options,rrVotes);
  const tResultsLive=tState?tTop3(tState):[];
  const mockFallback=[...project.options].map(o=>({...o,score:project.mockScores[o.id]||0})).sort((a,b)=>b.score-a.score);
  const tResults=tResultsLive.length>0?tResultsLive:mockFallback;

  return (
    <div className="vpage" style={{"--vfh":fv.h,"--vfb":fv.b,"--vca":project.color,"--vcap":project.color+"22"}}>
      {project.kioskMode&&(
        <div className="kbar">
          Kiosk Mode — auto-resets after each vote
          {isPreview&&<button className="btn bxs" style={{background:"rgba(255,255,255,.12)",color:"rgba(255,255,255,.8)",border:"1px solid rgba(255,255,255,.2)",fontSize:10}}
            onMouseDown={()=>{holdRef.current=setTimeout(()=>setExitConfirm(true),2000);}}
            onMouseUp={()=>clearTimeout(holdRef.current)}
            onTouchStart={()=>{holdRef.current=setTimeout(()=>setExitConfirm(true),2000);}}
            onTouchEnd={()=>clearTimeout(holdRef.current)}>
            Hold 2s to exit
          </button>}
        </div>
      )}

      {exitConfirm&&(
        <div className="mov" onClick={()=>setExitConfirm(false)}>
          <div className="card sli" style={{padding:24,maxWidth:300,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:"var(--fb)",fontWeight:500,fontSize:17,marginBottom:6,marginTop:4}}>Exit kiosk mode?</h3>
            <p style={{fontSize:13,color:"var(--i3)",marginBottom:18}}>Returns to admin dashboard.</p>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button className="btn bo bsm" onClick={()=>setExitConfirm(false)}>Cancel</button>
              <button className="btn bp bsm" onClick={onExit}>Exit</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview toggle — always outside frame, at top of page */}
      {isPreview&&<div style={{display:"flex",gap:6,justifyContent:"center",padding:"8px 0",borderBottom:"1px solid var(--bd)",background:"var(--sub)",flexShrink:0}}>
        {[{id:"mobile",label:"📱 Mobile"},{id:"tablet",label:"⬜ Tablet"},{id:"desktop",label:"🖥 Desktop"}].map(m=>(
          <button key={m.id} className={`btn bxs ${previewMode===m.id?"bp":"bg"}`} onClick={()=>setPreviewMode(m.id)}>{m.label}</button>
        ))}
      </div>}

      {/* Outer scroll area — grey bg on mobile/tablet */}
      <div style={{background:isPreview&&previewMode!=="desktop"?"#e8eaed":"var(--bg)",flex:1,overflow:"auto",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:isPreview&&previewMode==="mobile"?"32px 0":isPreview&&previewMode==="tablet"?"28px 0":"0"}}>

        {/* Device frame — wraps header + content together */}
        <div style={
          isPreview&&previewMode==="mobile"
            ? {width:390,flexShrink:0,borderRadius:44,overflow:"hidden",border:"10px solid #1B2A4A",boxShadow:"0 0 0 3px #0a1628, 0 32px 64px rgba(0,0,0,.4)",background:"var(--sur)",display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 100px)"}
            : isPreview&&previewMode==="tablet"
            ? {width:820,flexShrink:0,borderRadius:20,overflow:"hidden",border:"8px solid #1B2A4A",boxShadow:"0 0 0 2px #0a1628, 0 20px 40px rgba(0,0,0,.25)",background:"var(--sur)",display:"flex",flexDirection:"column",maxHeight:"calc(100vh - 80px)"}
            : {width:"100%",maxWidth:800,display:"flex",flexDirection:"column"}
        }>
          {/* Vote header — inside frame on all modes */}
          <div className="vhdr" style={{borderBottom:`2px solid ${project.color}`,flexShrink:0}}>
            {project.logo&&<img src={project.logo} alt="Logo" style={{height:30,maxWidth:110,objectFit:"contain",flexShrink:0,marginRight:4}}/>}
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500,lineHeight:1.2}}>{project.name}</div>
              <div style={{fontSize:11,color:"var(--i3)"}}>{project.type==="roundrobin"?"Full Ranking":"Quick Prioritization"}</div>
            </div>
            <LangPicker lang={lang} setLang={l=>setVS({...vs,lang:l})}/>
            {!project.kioskMode&&<button className="btn bg bsm" onClick={onExit} style={{marginLeft:6}}>✕</button>}
          </div>

          {/* Scrollable content area */}
          <div className="vbody" style={{flex:1,overflowY:"auto"}}>
            {step==="intro"&&<VoteIntro project={project} pairCount={mode==="roundrobin"?rrPairs.length:tState?.matchups?.length||0} onStart={()=>setVS({...vs,step:"voting"})}/>}
            {step==="voting"&&currentPair&&<VoteStep project={project} pair={currentPair} progress={progress} onVote={handleVote} isMobile={isPreview&&previewMode==="mobile"} onRestart={()=>setVS({...vs,step:"intro",tState:mode==="tournament"?initTournament(project.options):null,rrIdx:0,rrVotes:[]})}/>}
            {step==="voting"&&!currentPair&&<div style={{textAlign:"center",padding:32,color:"var(--i3)"}}>Loading…</div>}
            {step==="captcha"&&<CaptchaStep onPass={()=>setVS({...vs,capDone:true,step:project.demoEnabled?"demo":project.showResults?"results":"thanks"})}/>}
            {step==="demo"&&<DemoStep project={project} demo={demo} setDemo={d=>setVS({...vs,demo:d})} onNext={()=>setVS({...vs,step:project.showResults?"results":"thanks"})}/>}
            {step==="results"&&<ResultsStep project={project} results={mode==="roundrobin"?rrResults:tResults} mode={mode} onDone={handleDone}/>}
            {step==="thanks"&&<ThanksStep kioskMode={project.kioskMode} onDone={handleDone}/>}
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteIntro({project,pairCount,onStart}){
  const hex=project.color||"#1B2A4A";
  const r=parseInt(hex.slice(1,3),16);
  const g=parseInt(hex.slice(3,5),16);
  const b=parseInt(hex.slice(5,7),16);
  const gradientBg=`linear-gradient(180deg, rgba(${r},${g},${b},0.06) 0%, rgba(${r},${g},${b},0) 340px)`;
  return (
    <div style={{background:gradientBg,paddingBottom:48,minHeight:"60vh"}}>
      {project.introBanner?(
        <div style={{position:"relative",marginBottom:24}}>
          <img src={project.introBanner} alt="" style={{width:"100%",height:180,objectFit:"cover",display:"block"}}/>
          {project.logo&&<img src={project.logo} alt="Logo" style={{position:"absolute",bottom:-20,left:20,height:40,maxWidth:140,objectFit:"contain",background:"white",borderRadius:"var(--r2)",padding:"4px 8px",boxShadow:"var(--s2)"}}/>}
        </div>
      ):(
        project.logo&&<div style={{textAlign:"center",paddingTop:28,marginBottom:16}}>
          <img src={project.logo} alt="Logo" style={{height:52,maxWidth:200,objectFit:"contain"}}/>
        </div>
      )}
      <div style={{textAlign:"center",padding:project.introBanner?"32px 20px 0":"20px 20px 0"}}>
        {project.org&&<div className="vintro-org">{project.org}</div>}
        <h2 style={{fontFamily:"var(--vfh,var(--fd))",fontSize:"clamp(22px,4vw,30px)",marginBottom:10,fontWeight:400,lineHeight:1.2}}>{project.name}</h2>
        {project.description&&<p style={{color:"var(--i2)",fontSize:14,lineHeight:1.75,maxWidth:480,margin:"0 auto 12px"}}>{project.description}</p>}
        {project.introText&&<p style={{color:"var(--i3)",fontSize:13,lineHeight:1.7,maxWidth:460,margin:"0 auto 16px",padding:"12px 16px",background:"rgba(255,255,255,.7)",borderRadius:"var(--r2)",borderLeft:`3px solid ${project.color}`,textAlign:"left"}}>{project.introText}</p>}
        <div style={{display:"flex",gap:8,justifyContent:"center",margin:"16px 0 24px",flexWrap:"wrap"}}>
          <div className="chip">~{Math.max(1,Math.ceil(pairCount*0.3))} min</div>
          <div className="chip">{pairCount} comparisons</div>
          <div className="chip">{project.type==="roundrobin"?"Full Ranking":"Quick Prioritization"}</div>
        </div>
        <button className="btn blg" style={{background:project.color,color:"white",fontFamily:"var(--vfb,var(--fb))"}} onClick={onStart}>Start voting →</button>
        <div className="vtrust" style={{marginTop:16}}>
          <span style={{fontSize:10,fontWeight:700,letterSpacing:".06em",opacity:.4}}>PRIVATE</span><span>Anonymous · No account required</span>
        </div>
      </div>
    </div>
  );
}

function VoteStep({project,pair,progress,onVote,isMobile=false,onRestart}){
  const [sel,setSel]=useState(null);
  const [a,b]=pair;
  const pick=opt=>{setSel(opt.id);setTimeout(()=>{onVote(opt.id);setSel(null);},260);};
  return (
    <div className="fai">
      {progress>0&&(
        <div className="vprog">
          <div className="vpb" style={{flex:1}}><div className="vpf" style={{width:`${progress}%`,background:project.color}}/></div>
          <span className="vprogtxt" style={{color:project.color}}>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="vq">{project.vsPrompt||"Which matters more to you?"}</div>
      <div className="vgrid" style={isMobile?{gridTemplateColumns:"1fr",gap:8}:{}}>
        <div className={`vc${sel===a.id?" sel":""}`} onClick={()=>pick(a)} role="button" aria-label={`Vote for ${a.name}`} tabIndex={0} onKeyDown={e=>e.key==="Enter"&&pick(a)} style={{...(sel===a.id?{borderColor:project.color}:{}),minHeight:isMobile?110:160,padding:isMobile?"20px 16px":"24px 14px 20px"}}>
          {a.img&&<img src={a.img} alt={a.altText||a.name} className="vcimg"/>}
          <div className="vcn" style={{fontSize:a.img?"":"clamp(16px,2.5vw,20px)",fontWeight:a.img?500:700}}>{a.name}</div>
          {a.desc&&<div className="vcd">{a.desc}</div>}
        </div>
        {!isMobile&&<div className="vschip">{project.vsLabel||"VS"}</div>}
        {isMobile&&<div style={{textAlign:"center",fontSize:11,fontWeight:700,color:"var(--i4)",letterSpacing:".08em",padding:"8px 0"}}>{project.vsLabel||"VS"}</div>}
        <div className={`vc${sel===b.id?" sel":""}`} onClick={()=>pick(b)} role="button" aria-label={`Vote for ${b.name}`} tabIndex={0} onKeyDown={e=>e.key==="Enter"&&pick(b)} style={{...(sel===b.id?{borderColor:project.color}:{}),minHeight:isMobile?110:160,padding:isMobile?"20px 16px":"24px 14px 20px"}}>
          {b.img&&<img src={b.img} alt={b.altText||b.name} className="vcimg"/>}
          <div className="vcn" style={{fontSize:b.img?"":"clamp(16px,2.5vw,20px)",fontWeight:b.img?500:700}}>{b.name}</div>
          {b.desc&&<div className="vcd">{b.desc}</div>}
        </div>
      </div>
      <div style={{textAlign:"center",marginTop:12}}>
        <div className="vtrust"><span style={{fontSize:10,fontWeight:700,letterSpacing:".06em",opacity:.4}}>PRIVATE</span><span>Anonymous response</span></div>
        {progress>0&&<button className="vrestart" onClick={()=>onRestart()}>↩ Start over</button>}
      </div>
    </div>
  );
}

function CaptchaStep({onPass}){
  const [checked,setChecked]=useState(false);
  return (
    <div className="fai" style={{paddingTop:32}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <h2 style={{fontSize:20,marginBottom:5,fontWeight:300}}>One quick check</h2>
        <p style={{color:"var(--i3)",fontSize:13}}>Please confirm you are a real person.</p>
      </div>
      <div style={{border:"1px solid var(--bd)",borderRadius:"var(--r2)",padding:"14px 16px",display:"flex",alignItems:"center",gap:12,background:"var(--sub)",margin:"14px 0"}}>
        <div onClick={()=>setChecked(c=>!c)} style={{width:22,height:22,borderRadius:"var(--r1)",border:`1.5px solid ${checked?"var(--gn)":"var(--bdm)"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:checked?"var(--gn)":"var(--sur)",flexShrink:0,transition:"all .14s"}}>
          {checked&&<span style={{color:"white",fontSize:12,fontWeight:700}}>✓</span>}
        </div>
        <div style={{fontSize:13,fontWeight:500}}>I am not a robot</div>
      </div>
      <button className="btn bp blg" style={{width:"100%",justifyContent:"center"}} disabled={!checked} onClick={onPass}>Continue →</button>
    </div>
  );
}

function DemoStep({project,demo,setDemo,onNext}){
  return (
    <div className="fai">
      <div style={{textAlign:"center",marginBottom:20}}>
        <h2 style={{fontSize:20,marginBottom:4,fontWeight:300}}>A few quick questions</h2>
        <p style={{color:"var(--i3)",fontSize:13}}>All fields are optional.</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {project.demographics.map(d=>(
          <div key={d.id} className="fi">
            <label className="lbl">{d.label}</label>
            {d.type==="age"?(
              <select className="sel" value={demo[d.id]||""} onChange={e=>setDemo({...demo,[d.id]:e.target.value})}>
                <option value="">Prefer not to say</option>
                {["Under 18","18–24","25–34","35–44","45–54","55–64","65+"].map(a=><option key={a}>{a}</option>)}
              </select>
            ):(
              <input className="inp" type={d.type==="email"?"email":"text"} placeholder={d.type==="zipcode"?"e.g. 97201":""} value={demo[d.id]||""} onChange={e=>setDemo({...demo,[d.id]:e.target.value})}/>
            )}
          </div>
        ))}
      </div>
      <button className="btn bp blg" style={{width:"100%",justifyContent:"center",marginTop:20}} onClick={onNext}>Submit</button>
      <button className="btn bg bsm" style={{width:"100%",justifyContent:"center",marginTop:6,color:"var(--i3)"}} onClick={onNext}>Skip</button>
    </div>
  );
}

function ResultsStep({project,results,mode,onDone}){
  const [view,setView]=useState(project.resultView||"bars");
  const maxScore=results[0]?.score||1;
  const total=results.reduce((a,r)=>a+r.score,0);
  const pct=r=>total>0?Math.round((r.score/total)*100):0;
  const color=project.color||"#1B2A4A";
  const hex=color; const r2=parseInt(hex.slice(1,3),16); const g2=parseInt(hex.slice(3,5),16); const b2=parseInt(hex.slice(5,7),16);
  const fade=`rgba(${r2},${g2},${b2},0.08)`;
  return (
    <div style={{paddingBottom:32}}>
      {/* Header with gradient */}
      <div style={{background:`linear-gradient(160deg,${color} 0%,${color}cc 100%)`,borderRadius:"var(--r3)",padding:"24px 20px 28px",marginBottom:24,color:"white",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.04)",backgroundImage:"radial-gradient(circle at 20% 50%, rgba(255,255,255,.06) 0%, transparent 60%)",opacity:1}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",opacity:.7,marginBottom:6}}>Results</div>
          <h2 style={{fontFamily:"var(--vfh,var(--fd))",fontSize:"clamp(20px,4vw,26px)",fontWeight:400,marginBottom:4,lineHeight:1.2}}>{project.name}</h2>
          {mode==="roundrobin"&&<p style={{fontSize:12,opacity:.7,marginBottom:0}}>Ranked by community votes</p>}
          {results[0]&&<div style={{marginTop:16,display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.15)",borderRadius:99,padding:"6px 14px"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"white"}}/>
            <span style={{fontSize:13,fontWeight:500}}>{results[0].name}</span>
            <span style={{fontSize:11,opacity:.8}}>ranked #1</span>
          </div>}
        </div>
      </div>

      {/* View toggle */}
      <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:20}}>
        {[{id:"bars",label:"Bar chart"},{id:"podium",label:"Podium"}].map(v=>(
          <button key={v.id} className={`btn bsm ${view===v.id?"bp":"bo"}`} onClick={()=>setView(v.id)}>{v.label}</button>
        ))}
      </div>

      {/* Bar chart view */}
      {view==="bars"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {results.map((r,i)=>(
            <div key={r.id} style={{background:i===0?fade:"var(--sur)",border:`1.5px solid ${i===0?color:"var(--bd)"}`,borderRadius:"var(--r3)",padding:"14px 16px",transition:"all .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:i===0?color:"var(--sub)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:i===0?"white":"var(--i3)",flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,fontWeight:i===0?600:500,fontSize:14,color:"var(--i1)",lineHeight:1.3}}>{r.name}</div>
                <div style={{fontSize:14,fontWeight:700,color:i===0?color:"var(--i2)",minWidth:36,textAlign:"right"}}>{pct(r)}%</div>
              </div>
              <div style={{height:6,background:"var(--ins)",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,background:i===0?color:`${color}55`,width:`${(r.score/maxScore)*100}%`,transition:"width 1s var(--e)"}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Podium view */}
      {view==="podium"&&results.length>=2&&(
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:8,marginBottom:20,paddingTop:16}}>
            {[results[1],results[0],results[2]].filter(Boolean).map((r,i)=>{
              const heights=[72,100,56]; const isFirst=r===results[0];
              const rank=results.indexOf(r)+1;
              return (
                <div key={r.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1,maxWidth:120}}>
                  <div style={{fontSize:11,fontWeight:600,color:isFirst?color:"var(--i3)",letterSpacing:".04em"}}>{rank === 1?"1st":rank===2?"2nd":"3rd"}</div>
                  <div style={{width:"100%",height:heights[i],background:isFirst?color:`${color}44`,borderRadius:"6px 6px 0 0",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:8,fontSize:16,fontWeight:700,color:isFirst?"white":color}}>{rank}</div>
                  <div style={{fontSize:11,fontWeight:500,textAlign:"center",lineHeight:1.3,color:"var(--i2)",maxWidth:90}}>{r.name}</div>
                  <div style={{fontSize:11,color:"var(--i4)"}}>{pct(r)}%</div>
                </div>
              );
            })}
          </div>
          {results.slice(3).map((r,i)=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:"var(--r2)",marginBottom:4}}>
              <div style={{width:20,fontSize:11,fontWeight:600,color:"var(--i4)",textAlign:"center"}}>{i+4}</div>
              <div style={{flex:1,fontSize:13,color:"var(--i2)"}}>{r.name}</div>
              <div style={{fontSize:12,color:"var(--i3)"}}>{pct(r)}%</div>
            </div>
          ))}
        </div>
      )}

      <button className="btn bmd" style={{width:"100%",justifyContent:"center",background:color,color:"white",border:"none"}} onClick={onDone}>Done</button>
    </div>
  );
}

function ThanksStep({kioskMode,onDone}){
  useEffect(()=>{if(kioskMode){const t=setTimeout(onDone,5000);return()=>clearTimeout(t);}},[kioskMode,onDone]);
  return (
    <div className="fai" style={{textAlign:"center",paddingTop:48}}>
      <div style={{width:56,height:56,borderRadius:"50%",background:"var(--gn)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
      <h2 style={{fontSize:24,marginBottom:8,fontWeight:300}}>Thank you!</h2>
      <p style={{color:"var(--i3)",fontSize:14,maxWidth:360,margin:"0 auto 28px",lineHeight:1.6}}>Your priorities have been recorded. Results will help shape future planning decisions.</p>
      {kioskMode?<p style={{fontSize:13,color:"var(--i4)"}}>Resetting in 5 seconds…</p>:<button className="btn bp blg" onClick={onDone}>Done</button>}
    </div>
  );
}
