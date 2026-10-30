// Demo front end: all activity is simulated in this browser until a backend is connected.
const STORAGE_KEY = 'taskline-demo-runs-v2';
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const taskDialog = document.querySelector('#task-dialog');
const artifactDialog = document.querySelector('#artifact-dialog');
const helpDialog = document.querySelector('#help-dialog');
const confirmDialog = document.querySelector('#confirm-dialog');
const commandDialog = document.querySelector('#command-dialog');
const agentClass = { NAVIGATOR: 'nav', DATA_FILE: 'data', DOCKER: 'docker', REPORT: 'report' };
const tabs = [ ['overview','Overview'], ['audit','Audit log'], ['artifacts','Artifacts'], ['report','Final report'] ];
let currentPage = 'overview';
let selectedRunId = null;
let selectedTab = 'overview';
let timers = new Map();
let auditFilter = 'ALL';
let auditAgent = 'ALL';
let auditSearch = '';
let historySearch = '';
let historyFilter = 'ALL';
let toastTimer;

const seed = [
  makeSeedRun(42, 'Compare the top 3 note-taking apps and give me a report with a pricing chart', 'RUNNING', 68, '2026-10-30T09:20:00.000Z'),
  makeSeedRun(41, 'Find a quiet weekend getaway within two hours of the city', 'DONE', 100, '2026-10-29T16:10:00.000Z'),
  makeSeedRun(40, 'Summarize the latest renewable energy incentives for small businesses', 'DONE', 100, '2026-10-27T11:35:00.000Z'),
];

function makeSeedRun(id, title, status, progress, createdAt) {
  const running = status === 'RUNNING';
  const tasks = [
    { id: id * 10 + 1, seq: 1, agent: 'NAVIGATOR', title: 'Gather source information', description: 'Visit relevant public sources and collect evidence for the objective.', dependsOn: [], status: 'DONE', attempts: 1, result: 'Collected and summarized source material from public webpages.', error: null },
    { id: id * 10 + 2, seq: 2, agent: 'DATA_FILE', title: 'Organize the findings', description: 'Structure source notes and prepare data for downstream tasks.', dependsOn: [id * 10 + 1], status: 'DONE', attempts: 1, result: 'Findings grouped into a clear comparison table.', error: null },
    { id: id * 10 + 3, seq: 3, agent: 'DOCKER', title: 'Create supporting files', description: 'Generate a chart or other files required for the final response.', dependsOn: [id * 10 + 2], status: 'DONE', attempts: 1, result: 'Created a pricing comparison chart and source data file.', error: null },
    { id: id * 10 + 4, seq: 4, agent: 'REPORT', title: 'Write the final report', description: 'Turn the reviewed evidence into a concise report for the user.', dependsOn: [id * 10 + 2, id * 10 + 3], status: running ? 'RUNNING' : 'DONE', attempts: running ? 1 : 1, result: running ? null : 'Final report is ready to review.', error: null },
  ];
  return { id, title, status, progress, createdAt, tasks,
    events: [
      event('Run created', 'The objective was accepted and the team plan is ready.', 'REPORT', '09:20'),
      event('Task completed', 'Gathered source information from public webpages.', 'NAVIGATOR', '09:21'),
      event('Task completed', 'Organized the findings for the report.', 'DATA_FILE', '09:22'),
      event('Tool call denied', 'A request to access a restricted local path was blocked.', 'NAVIGATOR', '09:22', 'DENIED'),
      event('Task completed', 'Created a pricing comparison chart.', 'DOCKER', '09:23'),
      event(running ? 'Report in progress' : 'Run completed', running ? 'The final report is being prepared.' : 'All tasks finished and the final report is ready.', 'REPORT', running ? 'Now' : '09:24'),
    ],
    audit: [
      audit(1,'NAVIGATOR','browser.fetch','https://example.com/pricing','ALLOWED',null,'200 OK · 18 KB','09:21'),
      audit(2,'NAVIGATOR','filesystem.read','../../etc/passwd','DENIED','Path is outside the permitted workspace.','Blocked by Tool Gateway','09:22'),
      audit(3,'NAVIGATOR','browser.fetch','http://localhost','DENIED','Local network access is not permitted for this task.','Blocked by Tool Gateway','09:22'),
      audit(4,'DATA_FILE','file.write','research_notes.csv','ALLOWED',null,'CSV created · 12 rows','09:22'),
      audit(5,'DOCKER','file.write','pricing_chart.svg','ALLOWED',null,'Chart created · 1.8 KB','09:23'),
    ]
  };
}
function event(title, message, agent, time, decision='') { return { title, message, agent, time, decision }; }
function audit(id, agent, tool, args, decision, reason, outputSummary, ts) { return { id, agent, tool, args, decision, reason, outputSummary, ts }; }
function loadRuns() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (Array.isArray(saved) && saved.length) return saved; } catch (_) { /* start with the examples below */ }
  return seed;
}
let runs = loadRuns();
function saveRuns() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs)); } catch (_) { /* the page still works if storage is disabled */ } }
function esc(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function timeAgo(value) {
  if (!value) return 'Just now';
  const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value);
  const mins = Math.max(0, Math.floor((Date.now()-date.getTime())/60000));
  if (mins < 1) return 'Just now'; if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins/60); if (hours < 24) return `${hours} hr${hours===1?'':'s'} ago`;
  return date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function statusBadge(status) { const value = status || 'PENDING'; const label=value==='RUNNING'?'IN PROGRESS':value==='STOPPED'?'STOPPED':value; return `<span class="status ${value.toLowerCase()}">${esc(label)}</span>`; }
function tags(agents) { return `<div class="agent-list">${agents.map(a=>`<span class="agent-tag ${agentClass[a]||''}">${esc(a.replace('_',' '))}</span>`).join('')}</div>`; }
function currentRun() { return runs.find(r=>r.id===selectedRunId) || runs[0]; }
function notify(message) { toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2800); }
function celebrate() {
  const burst=document.createElement('div');burst.className='celebration';burst.setAttribute('aria-hidden','true');
  burst.innerHTML=Array.from({length:18},(_,i)=>`<i style="--i:${i};--x:${(i-8)*9}px;--y:${-34-(i%5)*10}px">${i%3===0?'✦':i%3===1?'✧':'·'}</i>`).join('');
  document.body.append(burst);setTimeout(()=>burst.remove(),1100);
}
function openHelp() {
  helpDialog.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">A 30-SECOND TOUR</div><h2>Welcome to your agent workspace</h2><p>Think of this as the control room for your MCI project.</p></div><button class="close-button" data-close-dialog="help-dialog" aria-label="Close">×</button></div><div class="dialog-body help-body"><div class="help-step"><span>1</span><div><b>Give the team a goal</b><p>Write what you want done. The demo turns it into four pretend tasks.</p></div></div><div class="help-step"><span>2</span><div><b>Follow the work</b><p>Open a run to inspect the plan, task cards, and activity feed.</p></div></div><div class="help-step"><span>3</span><div><b>Check the record</b><p>The audit tab shows allowed and blocked tool attempts. Artifacts and the report are examples.</p></div></div><div class="demo-notice"><b>Demo mode:</b> no real agents or AI are running yet. This page is the front end; the Java MCI system must be connected before it can do real work.</div><button class="button primary help-action" data-command="new-run">Try a demo goal <span>→</span></button></div>`;
  helpDialog.showModal();
}
function commandItems(query='') {
  const actions=[{id:'overview',icon:'▦',name:'Go to overview',hint:'View the dashboard'},{id:'history',icon:'◷',name:'Open run history',hint:'Search all objectives'},{id:'new-run',icon:'＋',name:'Start a new run',hint:'Enter a new goal'},{id:'help',icon:'?',name:'Show the quick tour',hint:'What does this page do?'}];
  const recent=runs.slice(0,4).map(r=>({id:`run:${r.id}`,icon:'↗',name:r.title,hint:`Run #${r.id} · ${r.status==='RUNNING'?'In progress':r.status==='DONE'?'Completed':r.status}`}));
  return [...actions,...recent].filter(x=>`${x.name} ${x.hint}`.toLowerCase().includes(query.toLowerCase())).map(x=>`<button class="command-item" data-command="${esc(x.id)}"><span class="command-icon">${esc(x.icon)}</span><span class="command-copy"><b>${esc(x.name)}</b><small>${esc(x.hint)}</small></span><span class="command-arrow">↵</span></button>`).join('')||'<div class="empty-state">No matching actions. Try another search.</div>';
}
function openCommands() {
  if(commandDialog.open){commandDialog.querySelector('#command-search')?.focus();return;}
  commandDialog.innerHTML=`<div class="command-heading"><div><span class="brand-mark">✳</span><b>What would you like to do?</b></div><button class="close-button" data-close-dialog="command-dialog" aria-label="Close">×</button></div><label class="sr-only" for="command-search">Search actions</label><input id="command-search" class="command-search" placeholder="Search actions or recent runs…" autocomplete="off"><div id="command-items" class="command-items">${commandItems()}</div><div class="command-foot"><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>`;
  commandDialog.showModal(); commandDialog.querySelector('#command-search').focus();
}
function runCommand(command) {
  commandDialog.close(); if(helpDialog.open)helpDialog.close();
  if(command==='overview'){currentPage='overview';renderHome();return;}
  if(command==='history'){currentPage='runs';renderHistory();return;}
  if(command==='new-run'){currentPage='overview';renderHome();document.querySelector('#objective')?.focus();return;}
  if(command==='help'){openHelp();return;}
  if(command.startsWith('run:')){selectedRunId=Number(command.split(':')[1]);selectedTab='overview';currentPage='detail';renderRun();}
}
function askStopRun() {
  const run=currentRun();
  confirmDialog.innerHTML=`<div class="dialog-head"><div><div class="eyebrow">DEMO CONTROL</div><h2>Stop this demo run?</h2><p>Run #${run.id}</p></div><button class="close-button" data-close-dialog="confirm-dialog" aria-label="Close">×</button></div><div class="dialog-body"><p>The simulated progress will stop. This does not affect any real agent or computer task.</p><div class="dialog-actions"><button class="button" data-close-dialog="confirm-dialog">Keep it running</button><button class="button danger" data-confirm-stop="${run.id}">Stop demo</button></div></div>`;
  confirmDialog.showModal();
}
function sidebar(active) {
  return `<aside class="sidebar"><a class="brand" href="#home" data-action="home"><span class="brand-mark">✳</span><span>taskline</span></a>
    <div class="side-label">WORKSPACE</div><nav class="nav-group" aria-label="Workspace">
      <button class="nav-button ${active==='overview'?'active':''}" data-action="home"><span class="nav-icon">▦</span><span class="nav-text">Overview</span></button>
      <button class="nav-button ${active==='runs'?'active':''}" data-action="runs"><span class="nav-icon">◷</span><span class="nav-text">Run history</span></button>
    </nav>
    <div class="side-label">SYSTEM</div><div class="sidebar-status"><div class="online-line"><i class="pulse"></i> Demo environment</div><p>Runs, events, and tool calls are simulated in this browser.</p></div>
    <div class="sidebar-bottom"><div class="avatar">JD</div><div><div class="profile-name">Jamie Davis</div><div class="profile-role">Personal workspace</div></div><span class="profile-menu">···</span></div></aside>`;
}
function shell(content, active='overview', crumb='Overview') {
  app.innerHTML = `${sidebar(active)}<main class="main"><header class="topbar"><div class="crumb">Workspace <span>/</span> <strong>${esc(crumb)}</strong></div><div class="top-actions"><button class="quick-button" data-action="commands" aria-label="Open quick actions"><span>⌕</span><b>Quick actions</b><kbd>Ctrl K</kbd></button><span class="demo-pill"><i></i> DEMO MODE</span><button class="icon-button" aria-label="About this demo" data-action="about">?</button></div></header>${content}<footer class="footer-note"><span class="brand-mark">✳</span> Agent operations, with every step in view <span style="margin-left:auto">Frontend demo · Sample data</span></footer></main>`;
}
function renderHome() {
  currentPage='overview';
  const done=runs.filter(r=>r.status==='DONE').length, running=runs.filter(r=>r.status==='RUNNING').length;
  shell(`<section class="page"><section class="hero"><div class="hero-grid"><div><div class="hero-kicker">AGENT OPERATIONS, MADE VISIBLE</div><h1>Big goals. Clear progress.</h1><p>Give your agent team a goal. Watch the plan unfold, inspect every tool call, and collect the work at the finish line.</p><div class="hero-metrics"><div class="hero-metric"><b>${runs.length}</b><span>Total runs</span></div><div class="hero-metric"><b>${running}</b><span>In progress</span></div><div class="hero-metric"><b>${done}</b><span>Completed</span></div></div></div>
    <form class="compose" id="run-form"><label class="sr-only" for="objective">Describe your objective</label><textarea id="objective" placeholder="What should your team accomplish?\nTry: Compare three project tools and make a short report." required></textarea><div class="compose-foot"><span>↳ Plan first. Follow every step.</span><button class="button primary" type="submit">Start a run <span>↗</span></button></div></form></div></section>
    <div class="stats-grid"><div class="card stat-card"><span class="stat-icon purple">◎</span><div><div class="stat-label">Tasks completed</div><div class="stat-value">${runs.reduce((n,r)=>n+r.tasks.filter(t=>t.status==='DONE').length,0)}</div></div></div><div class="card stat-card"><span class="stat-icon green">✓</span><div><div class="stat-label">Allowed tool calls</div><div class="stat-value">${runs.reduce((n,r)=>n+r.audit.filter(a=>a.decision==='ALLOWED').length,0)}</div></div></div><div class="card stat-card"><span class="stat-icon blue">⛨</span><div><div class="stat-label">Blocked safely</div><div class="stat-value">${runs.reduce((n,r)=>n+r.audit.filter(a=>a.decision==='DENIED').length,0)}</div></div></div><div class="card stat-card"><span class="stat-icon amber">◷</span><div><div class="stat-label">Agent roles</div><div class="stat-value">4</div></div></div></div>
    <div class="section-heading"><div><h2>Recent runs</h2><p>Your team's latest objectives and outcomes.</p></div><button class="link-button" data-action="runs">View run history →</button></div><section class="run-list">${runs.slice(0,4).map(runCard).join('')}</section></section>`, 'overview','Overview');
}
function runCard(run) {
  return `<article class="card run-card" role="button" tabindex="0" data-open-run="${run.id}" aria-label="Open run ${run.id}: ${esc(run.title)}"><div class="run-line"><div><div class="run-title">${esc(run.title)}</div><div class="run-sub"><span>Run #${run.id}</span><span>·</span><span>${timeAgo(run.createdAt)}</span><span>·</span><span>${run.tasks.filter(t=>t.status==='DONE').length}/${run.tasks.length} tasks</span></div></div>${statusBadge(run.status)}</div>${run.status==='RUNNING'?`<div class="progress"><span style="width:${run.progress}%"></span></div>`:''}<div class="run-footer">${tags(['NAVIGATOR','DATA_FILE','DOCKER','REPORT'])}<span class="link-button">Open run →</span></div></article>`;
}
function renderHistory() {
  currentPage='runs';
  const visible=runs.filter(r=>(historyFilter==='ALL'||r.status===historyFilter)&&r.title.toLowerCase().includes(historySearch.toLowerCase()));
  shell(`<section class="page"><div class="page-head"><div><div class="eyebrow">WORKSPACE / RUN HISTORY</div><h1>Every run, one place.</h1><p>Search past objectives and revisit what your agent team did.</p></div><div class="head-actions"><button class="button primary" data-action="new-run">＋ New run</button></div></div>
    <div class="card panel"><div class="audit-toolbar"><input class="search-input" id="history-search" value="${esc(historySearch)}" placeholder="Search objectives…" aria-label="Search run history"><select class="select-input" id="history-filter" aria-label="Filter runs"><option value="ALL" ${historyFilter==='ALL'?'selected':''}>All statuses</option><option value="RUNNING" ${historyFilter==='RUNNING'?'selected':''}>In progress</option><option value="DONE" ${historyFilter==='DONE'?'selected':''}>Completed</option><option value="FAILED" ${historyFilter==='FAILED'?'selected':''}>Failed</option><option value="STOPPED" ${historyFilter==='STOPPED'?'selected':''}>Stopped</option></select><span class="task-count">${visible.length} run${visible.length===1?'':'s'}</span></div><section class="run-list">${visible.length?visible.map(runCard).join(''):'<div class="empty-state">No runs match that search. Try another phrase or status.</div>'}</section></div></section>`, 'runs','Run history');
}
function renderRun() {
  const run=currentRun(); if(!run){renderHome();return;}
  currentPage='detail';
  const tabContent=selectedTab==='overview'?renderOverviewTab(run):selectedTab==='audit'?renderAuditTab(run):selectedTab==='artifacts'?renderArtifactsTab(run):renderReportTab(run);
  shell(`<section class="page"><div class="detail-top"><button class="back-link" data-action="home">← Back to overview</button><div class="detail-title-row"><div><h1 class="detail-title">${esc(run.title)}</h1><div class="detail-meta"><span>RUN #${run.id}</span><span>·</span><span>${timeAgo(run.createdAt)}</span><span>·</span>${statusBadge(run.status)}</div></div><div class="detail-actions"><button class="button" data-action="copy-objective">⧉ Copy goal</button>${run.status==='RUNNING'?'<button class="button danger" data-action="stop-run">■ Stop demo</button>':''}</div></div></div>
    <nav class="tab-bar" aria-label="Run details">${tabs.map(([key,label])=>`<button class="tab-button ${selectedTab===key?'active':''}" data-tab="${key}">${label}${key==='audit'?`<span>${run.audit.length}</span>`:''}${key==='artifacts'?`<span>3</span>`:''}</button>`).join('')}</nav>${tabContent}</section>`, 'overview',`Run #${run.id}`);
}
function renderOverviewTab(run) {
  const completed=run.tasks.filter(t=>t.status==='DONE').length;
  const recent=run.events.slice(-4).reverse();
  return `<div class="detail-grid"><section class="card panel"><div class="panel-head"><div><h2>Execution plan</h2><p>Tasks connect through their dependencies. Select one to inspect its work.</p></div><span class="task-count">${completed} of ${run.tasks.length} done</span></div><div class="plan">${run.tasks.map(task=>`<article class="task-card" role="button" tabindex="0" data-task="${task.id}"><div class="task-top"><span class="task-agent">${esc(task.agent)}</span>${statusBadge(task.status)}</div><h3>${esc(task.title)}</h3><p>${esc(task.description)}</p><div class="task-bottom"><span>Step ${task.seq}</span><span>${task.dependsOn.length?`Depends on ${task.dependsOn.map(id=>`#${id}`).join(', ')}`:'No dependencies'}</span></div></article>`).join('')}</div><div class="activity-panel"><div class="panel-head" style="margin:17px 0 3px"><div><h2>Live activity</h2><p>What the team is doing right now.</p></div><button class="link-button" data-tab="audit">Open audit log →</button></div><div class="activity-list">${recent.map(activityItem).join('')}</div></div></section>
    <aside class="card panel"><div class="panel-head"><div><h2>Run health</h2><p>A quick view of this execution.</p></div>${statusBadge(run.status)}</div><div class="progress-large"><span style="width:${run.progress}%"></span></div><div class="progress-caption"><span>${completed} of ${run.tasks.length} tasks complete</span><b>${run.progress}%</b></div><div class="section-heading" style="margin:19px 0 8px"><div><h2 style="font-size:9px">Safety audit</h2></div><button class="link-button" data-tab="audit">View all</button></div>${run.audit.slice(0,3).map(a=>`<div class="activity-item"><span class="activity-symbol ${a.decision==='DENIED'?'denied':''}">${a.decision==='DENIED'?'⊘':'✓'}</span><div class="activity-copy"><b>${esc(a.agent)}</b> · ${esc(a.tool)}<span class="activity-time">${esc(a.ts)} · ${esc(a.decision)}</span></div></div>`).join('')}<div class="section-heading" style="margin:18px 0 7px"><div><h2 style="font-size:9px">Your deliverables</h2></div><button class="link-button" data-tab="artifacts">Open</button></div><div class="activity-item"><span class="activity-symbol">▧</span><div class="activity-copy"><b>3 artifacts</b><span class="activity-time">Report, chart, and source data</span></div></div></aside></div>`;
}
function activityItem(item) { return `<div class="activity-row"><span class="activity-symbol ${item.decision==='DENIED'?'denied':''}">${item.decision==='DENIED'?'⊘':item.title.includes('completed')?'✓':'✦'}</span><div class="activity-row-text"><b>${esc(item.agent)}</b> ${esc(item.title.toLowerCase())}<br>${esc(item.message)}</div><time>${esc(item.time)}</time></div>`; }
function renderAuditTab(run) {
  let entries=run.audit.filter(a=>(auditFilter==='ALL'||a.decision===auditFilter)&&(auditAgent==='ALL'||a.agent===auditAgent)&&(`${a.tool} ${a.args} ${a.agent} ${a.decision} ${a.reason||''}`).toLowerCase().includes(auditSearch.toLowerCase()));
  return `<section class="card panel"><div class="panel-head"><div><h2>Tool call audit</h2><p>Every tool attempt is recorded. Denied requests are highlighted with the reason.</p></div><span class="task-count">${entries.length} entries</span></div><div class="audit-toolbar"><input class="search-input" id="audit-search" value="${esc(auditSearch)}" placeholder="Search tool, agent, or path…" aria-label="Search audit events"><select class="select-input" id="audit-decision" aria-label="Filter by decision"><option value="ALL" ${auditFilter==='ALL'?'selected':''}>All decisions</option><option value="ALLOWED" ${auditFilter==='ALLOWED'?'selected':''}>Allowed</option><option value="DENIED" ${auditFilter==='DENIED'?'selected':''}>Denied</option></select><select class="select-input" id="audit-agent" aria-label="Filter by agent"><option value="ALL" ${auditAgent==='ALL'?'selected':''}>All agents</option>${['NAVIGATOR','DATA_FILE','DOCKER','REPORT'].map(a=>`<option value="${a}" ${auditAgent===a?'selected':''}>${a.replace('_',' ')}</option>`).join('')}</select></div><div class="audit-wrap"><table class="audit-table"><thead><tr><th>Time</th><th>Agent</th><th>Tool</th><th>Decision</th><th>Result</th></tr></thead><tbody>${entries.length?entries.map(a=>`<tr class="${a.decision==='DENIED'?'denied-row':''}" data-audit-row="${a.id}"><td>${esc(a.ts)}</td><td>${esc(a.agent)}</td><td><code>${esc(a.tool)}</code><div class="audit-detail" id="audit-detail-${a.id}"><b>Arguments</b><br>${esc(a.args)}${a.reason?`<br><b>Reason</b><br>${esc(a.reason)}`:''}</div></td><td><span class="decision ${a.decision.toLowerCase()}">${esc(a.decision)}</span></td><td>${esc(a.outputSummary)}</td></tr>`).join(''):'<tr><td colspan="5">No audit entries match these filters.</td></tr>'}</tbody></table></div><p class="task-count" style="margin:12px 0 0">Select a row to expand its arguments and decision reason.</p></section>`;
}
function artifactsFor(run) {
  return [
    {id:'report',name:'final_report.md',type:'Markdown report',size:'4.2 KB',kind:'report-preview',icon:'▤'},
    {id:'chart',name:'comparison_chart.svg',type:'Chart · SVG image',size:'18 KB',kind:'chart',icon:'▥'},
    {id:'data',name:'source_notes.csv',type:'Comma-separated values',size:'2.1 KB',kind:'',icon:'▦'},
  ];
}
function renderArtifactsTab(run) {
  return `<section class="card panel"><div class="panel-head"><div><h2>Files from this run</h2><p>Preview a deliverable or download the demo file to your computer.</p></div><span class="task-count">3 files</span></div><div class="artifact-grid">${artifactsFor(run).map(a=>`<article class="artifact-card"><div class="artifact-preview ${a.kind}">${a.id==='chart'?'<div class="mini-chart"><i></i><i></i><i></i></div>':`<span class="file-icon">${a.icon}</span>`}</div><div class="artifact-info"><div class="artifact-name">${a.name}</div><div class="artifact-meta">${a.type} · ${a.size}</div><div class="artifact-actions"><button class="button" data-preview="${a.id}">Preview</button><button class="button" data-download="${a.id}">↓ Download</button></div></div></article>`).join('')}</div></section>`;
}
function reportHtml(run) {
  return `<article class="card report-card"><div class="report-label">AGENT TEAM · FINAL REPORT</div><h2>${esc(run.title)}</h2><p class="report-intro">This is a workflow preview, not research about your objective. The connected backend will supply the actual report.</p><h3>Run summary</h3><p>The team completed ${run.tasks.filter(t=>t.status==='DONE').length} of ${run.tasks.length} planned tasks. The task table below shows the current demo results. Every attempted tool call appears in the audit log, including requests the safety gateway denied.</p><h3>Task results</h3><table class="report-table"><thead><tr><th>Agent</th><th>Step</th><th>Status</th><th>Result</th></tr></thead><tbody>${run.tasks.map(t=>`<tr><td>${esc(t.agent)}</td><td>${esc(t.title)}</td><td>${esc(t.status)}</td><td>${esc(t.result||t.error||'Not completed in this demo yet.')}</td></tr>`).join('')}</tbody></table><h3>Safety and artifacts</h3><ul><li>${run.audit.filter(a=>a.decision==='ALLOWED').length} tool calls allowed and ${run.audit.filter(a=>a.decision==='DENIED').length} denied in this demo run.</li><li>Open the Artifacts tab to preview or download the example files.</li></ul><p><b>Demo note:</b> Example events and files illustrate how the interface works; they are not agent-generated findings.</p></article>`;
}
function renderReportTab(run) {
  return `<div class="section-heading"><div><h2>Final report</h2><p>Review the assembled result or save a Markdown copy.</p></div><button class="button" data-download="report">↓ Download report</button></div>${reportHtml(run)}`;
}
function render() { if(currentPage==='runs')renderHistory(); else if(currentPage==='detail')renderRun(); else renderHome(); }
function addEvent(run, title, message, agent, decision='') {
  const stamp=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  run.events.push(event(title,message,agent,stamp,decision));
}
function addAudit(run, agent, tool, args, decision, reason, output) {
  run.audit.push(audit(Date.now()+Math.floor(Math.random()*1000),agent,tool,args,decision,reason,output,new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
}
function startRun(title) {
  const id=Math.max(0,...runs.map(r=>Number(r.id)||0))+1;
  const run={id,title,status:'RUNNING',progress:0,createdAt:new Date().toISOString(),tasks:[
    {id:id*10+1,seq:1,agent:'NAVIGATOR',title:'Gather source information',description:'Search permitted public sources and collect useful evidence.',dependsOn:[],status:'RUNNING',attempts:1,result:null,error:null},
    {id:id*10+2,seq:2,agent:'DATA_FILE',title:'Organize the findings',description:'Structure notes and create reusable data for the next steps.',dependsOn:[id*10+1],status:'PENDING',attempts:0,result:null,error:null},
    {id:id*10+3,seq:3,agent:'DOCKER',title:'Create supporting files',description:'Prepare a chart and data files from the findings.',dependsOn:[id*10+2],status:'PENDING',attempts:0,result:null,error:null},
    {id:id*10+4,seq:4,agent:'REPORT',title:'Write the final report',description:'Summarize the work and assemble the final response.',dependsOn:[id*10+2,id*10+3],status:'PENDING',attempts:0,result:null,error:null},
  ],events:[event('Run created','Objective accepted. The team is beginning with a dependency-aware plan.','REPORT','Now')],audit:[]};
  runs.unshift(run); selectedRunId=id; selectedTab='overview'; currentPage='detail'; auditFilter='ALL';auditAgent='ALL';auditSearch=''; saveRuns(); render(); notify(`Run #${id} started — Navigator is gathering information.`); simulateRun(id);
}
function simulateRun(id) {
  if(timers.has(id))clearInterval(timers.get(id));
  let step=0;
  const timer=setInterval(()=>{
    const run=runs.find(r=>r.id===id); if(!run||run.status!=='RUNNING'){clearInterval(timer);timers.delete(id);return;}
    step+=1;
    if(step===1){run.progress=20;run.tasks[0].status='DONE';run.tasks[0].result='Gathered source notes from permitted public webpages.';run.tasks[1].status='RUNNING';run.tasks[1].attempts=1;addEvent(run,'Task completed','Collected public source notes.','NAVIGATOR');addAudit(run,'NAVIGATOR','browser.fetch','https://example.com/research','ALLOWED',null,'200 OK · 18 KB');notify('Navigator finished gathering information.');}
    if(step===2){run.progress=44;addEvent(run,'Tool call denied','A request to open a restricted local path was blocked safely.','NAVIGATOR','DENIED');addAudit(run,'NAVIGATOR','filesystem.read','../../etc/passwd','DENIED','Path is outside the permitted workspace.','Blocked by Tool Gateway');addAudit(run,'NAVIGATOR','browser.fetch','http://localhost','DENIED','Local network access is not permitted.','Blocked by Tool Gateway');notify('Safety check: 2 restricted requests were blocked and recorded.');}
    if(step===3){run.progress=65;run.tasks[1].status='DONE';run.tasks[1].result='Notes grouped into a comparison table.';run.tasks[2].status='RUNNING';run.tasks[2].attempts=1;addEvent(run,'Task completed','Organized source notes into a comparison table.','DATA_FILE');addAudit(run,'DATA_FILE','file.write','source_notes.csv','ALLOWED',null,'CSV created · 12 rows');notify('Data File organized the findings.');}
    if(step===4){run.progress=83;run.tasks[2].status='DONE';run.tasks[2].result='Created the comparison chart and source data file.';run.tasks[3].status='RUNNING';run.tasks[3].attempts=1;addEvent(run,'Artifact created','The comparison chart and source data are ready.','DOCKER');addAudit(run,'DOCKER','file.write','comparison_chart.svg','ALLOWED',null,'Chart created · 18 KB');notify('Supporting files are ready. Report is in progress.');}
    if(step>=5){run.progress=100;run.tasks[3].status='DONE';run.tasks[3].result='Final report assembled. Review the report tab for the demo result.';run.status='DONE';addEvent(run,'Run completed','All tasks are complete. Review the report and artifacts.','REPORT');addAudit(run,'REPORT','report.write','final_report.md','ALLOWED',null,'Markdown report created · 4.2 KB');clearInterval(timer);timers.delete(id);notify('Run complete. Your demo deliverables are ready.');celebrate();}
    saveRuns(); render();
  },1900);
  timers.set(id,timer);
}
function stopRun(id) {
  const run=runs.find(r=>r.id===id); if(!run||run.status!=='RUNNING')return;
  const timer=timers.get(id);if(timer)clearInterval(timer);timers.delete(id);
  run.status='STOPPED';run.tasks.forEach(t=>{if(t.status==='RUNNING'){t.status='SKIPPED';t.error='Stopped from the demo interface.';}});
  addEvent(run,'Demo run stopped','The local progress simulation was stopped by the user.','REPORT');saveRuns();render();notify('Demo run stopped.');
}
function openTask(id) {
  const run=currentRun(),task=run.tasks.find(t=>t.id===Number(id));if(!task)return;
  taskDialog.innerHTML=`<div class="dialog-head"><div><h2>${esc(task.title)}</h2><p>${esc(task.agent)} · Task ${task.seq} · Run #${run.id}</p></div><button class="close-button" data-close-dialog="task-dialog" aria-label="Close">×</button></div><div class="dialog-body"><div>${statusBadge(task.status)}</div><p>${esc(task.description)}</p><div class="dialog-stat"><div>Attempts<b>${task.attempts}</b></div><div>Dependencies<b>${task.dependsOn.length?task.dependsOn.map(x=>`#${x}`).join(', '):'None'}</b></div></div><p><b>Result</b><br>${esc(task.result||task.error||(task.status==='PENDING'?'Waiting for its dependencies to finish.':'Work is in progress.'))}</p></div>`;
  taskDialog.showModal();
}
function downloadFile(id) {
  const run=currentRun(); let name='',content='',type='text/plain;charset=utf-8';
  if(id==='data'){name='source_notes.csv';type='text/csv;charset=utf-8';content='source,topic,summary\nExample public source,Overview,Illustrative demo source note\nExample pricing page,Cost,Illustrative pricing note\n';}
  if(id==='report'){name='final_report.md';content=`# ${run.title}\n\n> Demo report. Illustrative content; not real research.\n\n## Summary\nThe demo completed ${run.tasks.filter(t=>t.status==='DONE').length} of ${run.tasks.length} tasks.\n\n## Safety\n${run.audit.filter(a=>a.decision==='DENIED').length} denied tool calls are visible in the audit log.\n`;}
  if(id==='chart'){name='comparison_chart.svg';type='image/svg+xml';content='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" rx="24" fill="#f6f4ff"/><text x="42" y="54" font-family="Arial" font-size="22" fill="#252641">Illustrative comparison</text><path d="M130 280V190h80v90M270 280V120h80v160M410 280V155h80v125" fill="#7d6af0"/><path d="M270 280V120h80v160" fill="#31aa82"/><path d="M80 280h450" stroke="#c7c4d8" stroke-width="2"/><text x="135" y="315" font-family="Arial" font-size="16" fill="#555">A</text><text x="275" y="315" font-family="Arial" font-size="16" fill="#555">B</text><text x="415" y="315" font-family="Arial" font-size="16" fill="#555">C</text></svg>';}
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);notify(`${name} downloaded.`);
}
function previewArtifact(id) {
  const run=currentRun();let body='';
  if(id==='chart')body='<div class="artifact-preview chart" style="height:220px"><div class="mini-chart" style="height:125px;gap:22px"><i style="width:35px"></i><i style="width:35px"></i><i style="width:35px"></i></div></div><p>Illustrative chart preview. The connected backend will provide the real artifact.</p>';
  else if(id==='data')body='<div class="audit-wrap"><table class="report-table"><thead><tr><th>source</th><th>topic</th><th>summary</th></tr></thead><tbody><tr><td>Example public source</td><td>Overview</td><td>Illustrative demo source note</td></tr><tr><td>Example pricing page</td><td>Cost</td><td>Illustrative pricing note</td></tr></tbody></table></div>';
  else body=`<h3>${esc(run.title)}</h3><p>Demo report preview. Illustrative content, not real research. Open the Final report tab for the complete preview.</p>`;
  artifactDialog.innerHTML=`<div class="dialog-head"><div><h2>${id==='chart'?'comparison_chart.svg':id==='data'?'source_notes.csv':'final_report.md'}</h2><p>Artifact preview · Run #${run.id}</p></div><button class="close-button" data-close-dialog="artifact-dialog" aria-label="Close">×</button></div><div class="dialog-body">${body}<button class="button" data-download="${id}">↓ Download file</button></div>`;artifactDialog.showModal();
}
function handleAction(action, target) {
  if(action==='home'){currentPage='overview';selectedRunId=null;renderHome();}
  if(action==='runs'){currentPage='runs';renderHistory();}
  if(action==='new-run'){currentPage='overview';renderHome();document.querySelector('#objective')?.focus();}
  if(action==='about')openHelp();
  if(action==='commands')openCommands();
  if(action==='copy-objective'){const run=currentRun();navigator.clipboard?.writeText(run.title).then(()=>notify('Goal copied.')).catch(()=>notify('Select and copy the goal text from the heading.'));}
  if(action==='stop-run')askStopRun();
  if(action==='close-dialog'){document.getElementById(target.dataset.closeDialog)?.close();}
}
app.addEventListener('click',e=>{
  const actionEl=e.target.closest('[data-action]');if(actionEl){e.preventDefault();handleAction(actionEl.dataset.action,actionEl);return;}
  const card=e.target.closest('[data-open-run]');if(card){selectedRunId=Number(card.dataset.openRun);selectedTab='overview';currentPage='detail';renderRun();return;}
  const tab=e.target.closest('[data-tab]');if(tab){selectedTab=tab.dataset.tab;if(currentPage!=='detail')return;renderRun();return;}
  const task=e.target.closest('[data-task]');if(task){openTask(task.dataset.task);return;}
  const auditRow=e.target.closest('[data-audit-row]');if(auditRow){document.querySelector(`#audit-detail-${auditRow.dataset.auditRow}`)?.classList.toggle('open');return;}
  const preview=e.target.closest('[data-preview]');if(preview){previewArtifact(preview.dataset.preview);return;}
  const download=e.target.closest('[data-download]');if(download){downloadFile(download.dataset.download);return;}
});
app.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open-run],[data-task]')){e.preventDefault();e.target.click();}});
app.addEventListener('submit',e=>{
  if(e.target.id!=='run-form')return;e.preventDefault();const field=e.target.querySelector('#objective');const title=field.value.trim();if(!title)return;startRun(title);
});
app.addEventListener('input',e=>{
  if(e.target.id==='objective'){e.target.style.height='auto';e.target.style.height=`${Math.min(e.target.scrollHeight,180)}px`;e.target.style.overflowY=e.target.scrollHeight>180?'auto':'hidden';}
  if(e.target.id==='audit-search'){auditSearch=e.target.value;const pos=e.target.selectionStart;renderRun();const field=document.querySelector('#audit-search');field?.focus();field?.setSelectionRange(pos,pos);}
  if(e.target.id==='history-search'){historySearch=e.target.value;const pos=e.target.selectionStart;renderHistory();const field=document.querySelector('#history-search');field?.focus();field?.setSelectionRange(pos,pos);}
});
app.addEventListener('change',e=>{
  if(e.target.id==='audit-decision'){auditFilter=e.target.value;renderRun();}
  if(e.target.id==='audit-agent'){auditAgent=e.target.value;renderRun();}
  if(e.target.id==='history-filter'){historyFilter=e.target.value;renderHistory();}
});
document.addEventListener('click',e=>{
  const close=e.target.closest('[data-close-dialog]');if(close)document.getElementById(close.dataset.closeDialog)?.close();
  const command=e.target.closest('[data-command]');if(command){runCommand(command.dataset.command);return;}
  const confirm=e.target.closest('[data-confirm-stop]');if(confirm){confirmDialog.close();stopRun(Number(confirm.dataset.confirmStop));return;}
  const download=e.target.closest('[data-download]');if(download&&!app.contains(download))downloadFile(download.dataset.download);
});
document.addEventListener('input',e=>{if(e.target.id==='command-search'){const items=commandDialog.querySelector('#command-items');if(items)items.innerHTML=commandItems(e.target.value);}});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommands();return;}
  if(e.key==='Enter'&&e.target.id==='command-search'){e.preventDefault();commandDialog.querySelector('[data-command]')?.click();}
});
render();
