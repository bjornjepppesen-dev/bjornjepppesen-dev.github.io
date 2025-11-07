// Simple passwordless user management using localStorage
// Dansk kommentarer
(function(){
  const USERS_KEY = 'jp_users';
  const CURRENT_KEY = 'jp_currentUser';

  function readUsers(){
    try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }catch(e){ return []; }
  }
  function writeUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  function saveCurrent(user){ localStorage.setItem(CURRENT_KEY, JSON.stringify(user)); }
  function getCurrent(){ try{return JSON.parse(localStorage.getItem(CURRENT_KEY));}catch(e){return null;} }
  function logout(){ localStorage.removeItem(CURRENT_KEY); renderUserArea(); }

  function ensureUser(username, role){
    username = (username||'').trim(); if(!username) return null;
    const users = readUsers();
    let u = users.find(x=>x.name===username);
    if(!u){ u = {name: username, role: role||'elev', created_at: new Date().toISOString()}; users.push(u); writeUsers(users); }
    return u;
  }

  function renderUserArea(){
    const area = document.getElementById('user-area');
    area.innerHTML = '';
    const current = getCurrent();
    if(current){
      const el = document.createElement('div');
      el.className = 'current-user';
      el.innerHTML = `<strong>${escapeHtml(current.name)}</strong> (${escapeHtml(current.role)}) <button id="logout-btn">Log ud</button> <button id="open-dashboard">Mit space</button>`;
      area.appendChild(el);
      document.getElementById('logout-btn').addEventListener('click', logout);
      document.getElementById('open-dashboard').addEventListener('click', openDashboard);
    } else {
      const btn = document.createElement('button'); btn.textContent = 'Log ind / Opret bruger'; btn.addEventListener('click', showLogin);
      area.appendChild(btn);
    }
  }

  function openDashboard(){
    const user = getCurrent();
    if(!user) return showLogin();
    // Simple dashboard: show submissions for this user
    const submissions = loadSubmissions(user.name);
    let html = `<h3>Mit space — ${escapeHtml(user.name)}</h3>`;
    if(!submissions || submissions.length===0) html += '<p>Ingen afleveringer endnu.</p>';
    else{
      submissions.forEach((s, i)=>{
        html += `<div class="submission"><h4>Aflevering ${i+1} — ${s.timestamp}</h4>`;
        s.answers.forEach(a=>{
          html += `<div class="sub-q"><strong>Spørgsmål:</strong> ${escapeHtml(a.qid)}<br>`+
                  `<strong>Elevens svar:</strong> <pre>${escapeHtml(a.answer||'')}</pre><br>`+
                  `<strong>Point:</strong> ${a.score||0}<br>`+
                  `<strong>LLM-feedback:</strong> <div class="llm-feedback">${escapeHtml(a.llmFeedback||'')}</div><br>`+
                  `<strong>Lærerkommentar:</strong> <div class="teacher-comment">${escapeHtml(a.teacherComment||'')}</div></div>`;
        });
        html += '</div>';
      });
    }
    const w = window.open('','_blank'); w.document.write(`<html><head><title>Space: ${escapeHtml(user.name)}</title><link rel="stylesheet" href="/assets/css/quiz-auth.css"></head><body>${html}</body></html>`);
  }

  function showLogin(){
    const div = document.createElement('div'); div.className='login-modal';
    div.innerHTML = `
      <div class="login-box">
        <h3>Log ind / Opret bruger</h3>
        <label>Brugernavn: <input id="login-username"></label>
        <label>Rolle: <select id="login-role"><option value="elev">Elev</option><option value="laerer">Lærer</option></select></label>
        <div class="login-actions">
          <button id="login-submit">Log ind</button>
          <button id="login-cancel">Annuller</button>
        </div>
        <p class="note">Ingen adgangskode — vælg dit brugernavn. Brug ansvarligt.</p>
      </div>`;
    document.body.appendChild(div);
    document.getElementById('login-cancel').addEventListener('click', ()=>div.remove());
    document.getElementById('login-submit').addEventListener('click', ()=>{
      const name = document.getElementById('login-username').value;
      const role = document.getElementById('login-role').value;
      const u = ensureUser(name, role);
      if(u){ saveCurrent(u); div.remove(); renderUserArea(); updateTeacherSelect(); }
    });
  }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>\\"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'\u0027'}[c]||c;}); }

  // Submissions storage helpers used by quiz-enhancements.js as global helpers
  window.jp_users_read = readUsers;
  window.jp_users_write = writeUsers;
  window.jp_getCurrentUser = getCurrent;
  window.jp_saveSubmission = function(username, submission){
    if(!username) return;
    const key = `jp_submissions_${username}`;
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.unshift(submission); // latest first
    localStorage.setItem(key, JSON.stringify(arr));
  };
  window.jp_loadSubmissions = function(username){
    if(!username) return [];
    const key = `jp_submissions_${username}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  // Populate teacher select on start
  function updateTeacherSelect(){
    const sel = document.getElementById('teacher-student-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- vælg elev --</option>';
    const users = readUsers().filter(u=>u.role==='elev');
    users.forEach(u=>{ const o = document.createElement('option'); o.value = u.name; o.textContent = u.name; sel.appendChild(o); });
  }
  window.jp_updateTeacherSelect = updateTeacherSelect;

  // Init
  document.addEventListener('DOMContentLoaded', ()=>{
    renderUserArea(); updateTeacherSelect();
  });
})();