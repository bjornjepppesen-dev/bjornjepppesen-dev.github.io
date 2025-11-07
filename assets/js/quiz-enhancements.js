// Quiz enhancements: reveal modes, submission handling, LLM fallback evaluation and teacher panel
(function(){
  const form = document.getElementById('quiz-form');
  const revealSelect = document.getElementById('reveal-mode');
  const resultsSection = document.getElementById('results');
  const perQuestion = document.getElementById('per-question-results');
  const scoreEl = document.getElementById('score');
  const teacherPanel = document.getElementById('teacher-panel');
  const teacherStudentSelect = document.getElementById('teacher-student-select');
  const teacherSubmissionList = document.getElementById('teacher-submission-list');

  function getQuestions(){ return Array.from(form.querySelectorAll('.question')); }

  function readAnswer(q){
    const type = q.dataset.type || 'text';
    const qid = q.dataset.qid;
    if(type==='mc'){ 
      const checked = q.querySelector('input[type=radio]:checked');
      return checked ? checked.value : '';
    } else {
      const ta = q.querySelector('textarea, input');
      return ta ? ta.value.trim() : '';
    }
  }

  async function evaluateQuestion(q, answer){
    const type = q.dataset.type || 'text';
    if(type==='mc'){
      const correct = q.querySelector('[data-correct]');
      const isCorrect = correct && (answer === correct.value);
      return {score: isCorrect?1:0, correctAnswer: correct?correct.value:'', llmFeedback: isCorrect? 'Korrekt.':'Forkert.'};
    }
    // Free text: try LLM if api key set
    const correctText = q.dataset.correct || '';
    const evalUsingLLM = window.JP_LLM_API_KEY && window.JP_LLM_ENDPOINT;
    if(evalUsingLLM){
      try{
        const res = await evaluateWithLLM(answer, correctText, q.dataset.type);
        return {score: res.score, llmFeedback: res.feedback, correctAnswer: correctText};
      }catch(e){
        // fallback
      }
    }
    // Fallback heuristic: token overlap
    const score = heuristicScore(answer, correctText);
    const feedback = score>=0.7 ? 'Godt svar (heuristisk match)' : (score>0.3? 'Delvist svar' : 'Mangelfuldt svar');
    return {score: score>=0.7?1:0, llmFeedback: feedback, correctAnswer: correctText};
  }

  function heuristicScore(a,b){
    if(!a || !b) return 0;
    a = a.toLowerCase(); b = b.toLowerCase();
    const aw = a.split(/[^
\w]+/).filter(Boolean); const bw = b.split(/[^
\w]+/).filter(Boolean);
    if(aw.length===0 || bw.length===0) return 0;
    const setB = new Set(bw);
    const common = aw.filter(x=>setB.has(x)).length;
    return common/Math.max(bw.length,1);
  }

  async function evaluateWithLLM(answer, correctText, qtype){
    // This function expects a server-compatible OpenAI-like endpoint stored in window.JP_LLM_ENDPOINT
    // and an API key in window.JP_LLM_API_KEY. If not provided it will throw.
    if(!window.JP_LLM_ENDPOINT || !window.JP_LLM_API_KEY) throw new Error('LLM not configured');
    const prompt = `Du er en dansk lærer. Evaluer elevsvar for en opgave av typen ${qtype}. Svar skal vurderes om de er korrekte. Giv score 1 eller 0 og kort feedback.\nCORRECT ANSWER: ${correctText}\nELEV ANSWER: ${answer}`;
    const body = {model: 'gpt-4o-mini', messages:[{role:'user', content:prompt}], max_tokens:200};
    const r = await fetch(window.JP_LLM_ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+window.JP_LLM_API_KEY}, body: JSON.stringify(body)});
    const data = await r.json();
    // Try to parse assistant text for score and feedback
    const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || JSON.stringify(data);
    // Basic parse: look for leading 1 or 0 else heuristic
    const score = /\b1\b/.test(text) ? 1 : (/0/.test(text) ? 0 : (heuristicScore(answer, correctText)>=0.7?1:0));
    return {score, feedback: text};
  }

  function showInlineFeedback(q, evalResult){
    const fb = q.querySelector('.feedback');
    fb.innerHTML = `<div class="auto-feedback">${escapeHtml(evalResult.llmFeedback||'')}</div>`;
    if(revealSelect.value==='inline') fb.style.display = 'block';
  }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>\\"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'\u0027'}[c]||c;}); }

  // If reveal mode inline, attach change listeners to show immediate feedback for MC; for free text we won't evaluate on each keystroke to avoid costs
  document.addEventListener('change', async (e)=>{
    if(revealSelect.value !== 'inline') return;
    const q = e.target.closest('.question'); if(!q) return;
    const answer = readAnswer(q);
    const r = await evaluateQuestion(q, answer);
    showInlineFeedback(q, r);
  });

  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const user = window.jp_getCurrentUser();
    if(!user){ alert('Du skal logge ind før afsendelse.'); return; }
    const questions = getQuestions();
    const submission = {quizId: form.dataset.quizId||'quiz-1', timestamp: new Date().toLocaleString(), answers: []};
    let total = 0, points = 0;
    for(const q of questions){
      const qid = q.dataset.qid;
      const answer = readAnswer(q);
      const evalRes = await evaluateQuestion(q, answer);
      const qscore = evalRes.score || 0;
      total += 1; points += qscore;
      submission.answers.push({qid, answer, score: qscore, llmFeedback: evalRes.llmFeedback, teacherComment: '' , correctAnswer: evalRes.correctAnswer});
    }
    // Save submission per-user
    window.jp_saveSubmission(user.name, submission);

    // Show results to student according to reveal mode
    resultsSection.hidden = false;
    scoreEl.textContent = `Score: ${points}/${total}`;
    perQuestion.innerHTML = '';
    submission.answers.forEach((a, idx)=>{
      let line = `<div class="result-q"><strong>Spørgsmål ${idx+1} (${escapeHtml(a.qid)}):</strong><br>`+
                 `<strong>Dit svar:</strong> <pre>${escapeHtml(a.answer||'')}</pre><br>`+
                 `<strong>Point:</strong> ${a.score}<br>`+
                 `<strong>Feedback:</strong> <div class="llm-feedback">${escapeHtml(a.llmFeedback||'')}</div>`;
      if(revealSelect.value === 'after'){
        line += `<br><strong>Korrekt svar:</strong> ${escapeHtml(a.correctAnswer||'')}</div>`;
      } else if(revealSelect.value === 'inline'){
        // For inline we already showed feedback per question; show correct answer only if question was MC and wrong
        if(a.correctAnswer && a.score===0) line += `<br><strong>Korrekt svar:</strong> ${escapeHtml(a.correctAnswer)}</div>`;
        else line += `</div>`;
      } else {
        line += `</div>`;
      }
      perQuestion.innerHTML += line;
    });

    // If current user is teacher, show teacher panel controls
    if(user.role === 'laerer'){
      teacherPanel.hidden = false;
      // Populate teacher student select
      window.jp_updateTeacherSelect();
    }
  });

  // Teacher panel behaviour: when teacher picks a student, load latest submission and allow adding comments per-answer
  teacherStudentSelect && teacherStudentSelect.addEventListener('change', (e)=>{
    const student = e.target.value; teacherSubmissionList.innerHTML = '';
    if(!student) return;
    const subs = window.jp_loadSubmissions(student);
    if(!subs || subs.length===0) { teacherSubmissionList.innerHTML = '<p>Ingen afleveringer fra denne elev.</p>'; return; }
    // For simplicity show latest
    const sub = subs[0];
    const container = document.createElement('div');
    container.innerHTML = `<h3>Aflevering: ${sub.timestamp}</h3>`;
    sub.answers.forEach((a, idx)=>{
      const el = document.createElement('div'); el.className='teacher-q';
      el.innerHTML = `<p><strong>Spørgsmål ${idx+1} (${escapeHtml(a.qid)})</strong></p>`+
                     `<p><strong>Elevens svar:</strong> <pre>${escapeHtml(a.answer||'')}</pre></p>`+
                     `<p><strong>Korrekt svar:</strong> ${escapeHtml(a.correctAnswer||'')}</p>`+
                     `<p><strong>Point:</strong> ${a.score}</p>`+
                     `<label>Kommentar til elev:<textarea class="teacher-comment-input" data-idx="${idx}">${escapeHtml(a.teacherComment||'')}</textarea></label>`;
      container.appendChild(el);
    });
    const saveBtn = document.createElement('button'); saveBtn.textContent='Gem kommentarer';
    saveBtn.addEventListener('click', ()=>{
      const inputs = container.querySelectorAll('.teacher-comment-input');
      inputs.forEach(inp=>{
        const idx = Number(inp.dataset.idx); sub.answers[idx].teacherComment = inp.value;
      });
      // Save back to student's submissions
      const key = `jp_submissions_${student}`;
      const all = JSON.parse(localStorage.getItem(key) || '[]');
      if(all.length>0){ all[0] = sub; localStorage.setItem(key, JSON.stringify(all)); alert('Kommentarer gemt.'); }
    });
    teacherSubmissionList.appendChild(container); teacherSubmissionList.appendChild(saveBtn);
  });

  // On load: show teacher panel if current user is teacher
  document.addEventListener('DOMContentLoaded', ()=>{
    const u = window.jp_getCurrentUser && window.jp_getCurrentUser();
    if(u && u.role==='laerer'){ teacherPanel.hidden = false; window.jp_updateTeacherSelect(); }
  });
})();