// script.js

let userSettings = {
  pomodoro:25,
  short:5,
  long:10,
  playSound:true,
  theme:"default"
};

let isClockRunning = false;
let isClockStopped = true;
let currentTimeLeftInSession = 25*60;
let timerInterval = null;
let currentTimerType = "pomodoro";

const dailyWorkDisplay = document.getElementById('dailyWorkDisplay');
const timerDisplay = document.getElementById('pomodoro-timer');
const startBtn = document.getElementById('pomodoro-start');
const stopBtn = document.getElementById('pomodoro-stop');
const settingsBtn = document.getElementById('pomodoro-settings');
const statsBtn = document.getElementById('pomodoro-stats');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const themeSelect = document.getElementById('themeSelect');

const statsModal = document.getElementById('statsModal');
const closeStatsBtn = document.getElementById('closeStatsBtn');

// 各種ID要素
const pomodoroLengthInput = document.getElementById('pomodoroLength');
const shortBreakLengthInput = document.getElementById('shortBreakLength');
const longBreakLengthInput = document.getElementById('longBreakLength');
const playSoundCheck = document.getElementById('playSoundCheck');

const statsDailyTotal = document.getElementById('statsDailyTotal');
const statsWeeklyList = document.getElementById('statsWeeklyList');
const statsMonthlyList = document.getElementById('statsMonthlyList');

// Notification request
if(Notification && Notification.permission==='default'){
  Notification.requestPermission();
}

// サウンド
const alertSound = new Audio("https://example.com/chime.mp3");
alertSound.volume = 1.0;

function getTodayDateStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

let dailyWorkLog = { date:getTodayDateStr(), totalWorkSeconds:0 };
let workLogs = [];

function loadWorkLogs(){
  const w = localStorage.getItem('workLogs');
  if(w) {
    workLogs = JSON.parse(w);
  } else {
    workLogs = [];
  }
  const today = getTodayDateStr();
  let todayLog = workLogs.find(l=>l.date===today);
  if(!todayLog) {
    todayLog = {date:today, totalWorkSeconds:0};
    workLogs.push(todayLog);
    saveWorkLogs();
  }
  dailyWorkLog = todayLog;
}

function saveWorkLogs(){
  localStorage.setItem('workLogs', JSON.stringify(workLogs));
}

function updateDailyWorkTimeDisplay(){
  const sec = dailyWorkLog.totalWorkSeconds;
  dailyWorkDisplay.textContent = formatTime(sec);
}

function formatTime(seconds){
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}

let workSessionStart = null;

function onTimerStart(){
  if(currentTimerType === 'pomodoro') {
    workSessionStart = Date.now();
  } else {
    workSessionStart = null;
  }
}

function onTimerStopOrPause(){
  if(workSessionStart && currentTimerType === 'pomodoro'){
    const elapsed = Math.floor((Date.now()-workSessionStart)/1000);
    dailyWorkLog.totalWorkSeconds += elapsed;
    saveWorkLogs();
    updateDailyWorkTimeDisplay();
    workSessionStart = null;
  }
}

function getInitialTimeForMode(){
  const mode = document.querySelector('input[name="timerType"]:checked').value;
  currentTimerType=mode;
  let t = userSettings.pomodoro;
  if(mode==='short') t = userSettings.short;
  if(mode==='long') t = userSettings.long;
  return t*60;
}

function updateTimerDisplay(){
  const min = String(Math.floor(currentTimeLeftInSession/60)).padStart(2,'0');
  const sec = String(currentTimeLeftInSession%60).padStart(2,'0');
  timerDisplay.textContent = `${min}:${sec}`;
}

function tick(){
  currentTimeLeftInSession--;
  updateTimerDisplay();
  if(currentTimeLeftInSession<=0){
    clearInterval(timerInterval);
    timerInterval=null;
    onTimerStopOrPause();
    const evt=new Event("timerDone");
    document.getElementById('pomodoro-container').dispatchEvent(evt);
    toggleClock(true);
  }
}

function toggleClock(reset){
  if(reset){
    isClockStopped=true;
    isClockRunning=false;
    clearInterval(timerInterval);
    timerInterval=null;
    currentTimeLeftInSession=getInitialTimeForMode();
    updateTimerDisplay();
    // リセット時は常にplay表示、pause非表示
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
    return;
  }

  if(isClockRunning){
    // 一時停止: play表示, pause非表示
    isClockRunning=false;
    clearInterval(timerInterval);
    timerInterval=null;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
  } else {
    // 開始: pause表示, play非表示
    if(isClockStopped){
      currentTimeLeftInSession=getInitialTimeForMode();
      updateTimerDisplay();
      isClockStopped=false;
    }
    isClockRunning=true;
    onTimerStart();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    timerInterval=setInterval(tick,1000);
  }
}

// タイマー完了時
document.getElementById('pomodoro-container').addEventListener('timerDone', ()=>{
  // ポモドーロ終了時
  if (userSettings.playSound){
    alertSound.play();
  }

  if (Notification.permission==='granted'){
    new Notification("Pomodoro Finished!",{body:"Time for a break!"});
  }

  // Notionへ記録送信
  const timestamp = new Date().toISOString(); // 今の時刻
  const durationInMin = 25; // ここは実際の経過分数に合わせて計算済みである想定
  const mode = "Work"; // 作業だった場合
  const task = "Coding session"; // ここは適宜変える

  fetch('/api/record-session', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ timestamp, duration: durationInMin, mode, task })
  })
  .then(res=>res.json())
  .then(data=>{
    console.log("Notion記録結果:", data);
  })
  .catch(err=>{
    console.error("Notion記録エラー:", err);
  });


function sendSessionToNotion(durationInMin, mode, task) {
  // Python例に合わせて記録。今度はTask(title), Date(date), Description(rich_text)で行う
  const timestamp = new Date().toISOString();

  fetch('/api/record-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      timestamp: timestamp,
      duration: durationInMin,
      mode: mode,
      task: task || '',
      // ここでPython例と同様Name/Descriptionを使うためにAPI側も変更が必要
    })
  })
  .then(res=>res.json())
  .then(data=>{
    console.log('Notion record success:',data);
  })
  .catch(err=>{
    console.error('Notion record error:',err);
  });
}

const recordNowBtn = document.getElementById('recordNowBtn');
recordNowBtn.addEventListener('click', ()=> {
  // ボタンが押された時点の経過時間を取得し、Notionへ送る処理をここに書く
  nowRecord();
});

function nowRecord() {
  let durationInMin = Math.floor(dailyWorkLog.totalWorkSeconds / 60);
  // あるいは現在セッション中なら(経過中を加算)
  // if (isClockRunning && workSessionStart) {
  //   const elapsed = Math.floor((Date.now()-workSessionStart)/1000);
  //   durationInMin = Math.floor((dailyWorkLog.totalWorkSeconds + elapsed)/60);
  // }

  const timestamp = new Date().toISOString();
  const mode = currentTimerType === 'pomodoro' ? "Work" : currentTimerType;
  const task = "Some Task Name"; // ユーザーが設定で入力できるようにしてもいい

  fetch('/api/record-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ timestamp, duration: durationInMin, mode, task })
  })
  .then(res=>res.json())
  .then(data=>{
    if(data.message==="Success") {
      console.log("Notionへの記録成功");
      // 必要なら画面上に"記録成功"メッセージを表示する処理を追加
    } else {
      console.error("Notion記録失敗:", data);
      // エラーメッセージをUI表示するならここで処理
    }
  })
  .catch(err=>{
    console.error("Notion記録中エラー:", err);
  });
}


// Radioボタン変更でモード切替
const timerTypeInputs = document.querySelectorAll('input[name="timerType"]');
timerTypeInputs.forEach(input=>{
  input.addEventListener('change', ()=>{
    onTimerStopOrPause();
    toggleClock(true);
  });
});

// ボタン操作
startBtn.addEventListener('click', ()=>toggleClock(false));
stopBtn.addEventListener('click', ()=>toggleClock(true));

// 設定読み書き
function loadUserSettings(){
  const s = localStorage.getItem('userSettings');
  if(s) userSettings = JSON.parse(s);
}
function saveUserSettings(){
  localStorage.setItem('userSettings', JSON.stringify(userSettings));
}

function applyTheme(theme){
  const bgWrapper = document.getElementById('bg-wrapper');
  if(theme==='auto'){
    applyAutoTheme();
  } else if(theme==='forest'){
    bgWrapper.style.backgroundColor = '#334f33'; 
  } else if(theme==='cafe'){
    bgWrapper.style.backgroundColor = '#4f3f33'; 
  } else if(theme==='night'){
    bgWrapper.style.backgroundColor = '#3a3a3a';
  } else {
    bgWrapper.style.backgroundColor = '#222';
  }
}

function applyAutoTheme(){
  const bgWrapper = document.getElementById('bg-wrapper');
  const hour = new Date().getHours();
  let color;
  if(hour>=0 && hour<3) color='#2f2f2f';
  else if(hour>=3 && hour<6) color='#33404f';
  else if(hour>=6 && hour<9) color='#8799a1';
  else if(hour>=9 && hour<12) color='#b0bec5';
  else if(hour>=12 && hour<15) color='#cfd8dc';
  else if(hour>=15 && hour<18) color='#d3b89f';
  else if(hour>=18 && hour<21) color='#556a71';
  else color='#3a3a3a';

  bgWrapper.style.backgroundColor = color;
}

// 設定ボタン
settingsBtn.addEventListener('click', ()=>{
  pomodoroLengthInput.value=userSettings.pomodoro;
  shortBreakLengthInput.value=userSettings.short;
  longBreakLengthInput.value=userSettings.long;
  playSoundCheck.checked=userSettings.playSound;
  themeSelect.value=userSettings.theme;
  settingsModal.classList.remove('hidden');
});
saveSettingsBtn.addEventListener('click', ()=>{
  userSettings.pomodoro = parseInt(pomodoroLengthInput.value,10);
  userSettings.short = parseInt(shortBreakLengthInput.value,10);
  userSettings.long = parseInt(longBreakLengthInput.value,10);
  userSettings.playSound = playSoundCheck.checked;
  userSettings.theme = themeSelect.value;
  saveUserSettings();
  applyTheme(userSettings.theme);
  settingsModal.classList.add('hidden');
  // toggleClock(true)は呼ばない
});
closeSettingsBtn.addEventListener('click',()=> settingsModal.classList.add('hidden'));

// Statsボタン
statsBtn.addEventListener('click', ()=>{
  updateStatsModal();
  statsModal.classList.remove('hidden');
});
closeStatsBtn.addEventListener('click',()=> statsModal.classList.add('hidden'));

// Statsタブ切替
const statsTabBtns = document.querySelectorAll('.stats-tab-btn');
const statsTabPanes = document.querySelectorAll('.stats-tab-pane');
statsTabBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    statsTabBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    statsTabPanes.forEach(p=>p.classList.remove('active'));
    document.querySelector(btn.dataset.target).classList.add('active');
  });
});

function updateStatsModal(){
  statsDailyTotal.textContent = formatTime(dailyWorkLog.totalWorkSeconds);
  populateStatsList(statsWeeklyList, getPastDaysData(7));
  populateStatsList(statsMonthlyList, getPastDaysData(30));
}

function getPastDaysData(days){
  const now = new Date();
  let result = [];
  for(let i=0; i<days; i++){
    let d=new Date();
    d.setDate(now.getDate()-i);
    const dateStr = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    let log = workLogs.find(l=>l.date===dateStr);
    if(!log) log={date:dateStr, totalWorkSeconds:0};
    result.push(log);
  }
  result.sort((a,b)=> a.date>b.date?1:-1);
  return result;
}

function populateStatsList(container, data){
  container.innerHTML='';
  let maxSec = 0;
  data.forEach(d=>{ if(d.totalWorkSeconds>maxSec) maxSec=d.totalWorkSeconds; });
  if(maxSec===0) maxSec=1;

  data.forEach(d=>{
    const row = document.createElement('div');
    row.classList.add('day-row');

    const dateSpan = document.createElement('div');
    dateSpan.classList.add('day-date');
    dateSpan.textContent = d.date;

    const timeSpan = document.createElement('div');
    timeSpan.classList.add('day-time');
    timeSpan.textContent = formatTime(d.totalWorkSeconds);

    const barContainer = document.createElement('div');
    barContainer.classList.add('bar-container');

    const bar = document.createElement('div');
    bar.classList.add('bar');
    const pct = (d.totalWorkSeconds/maxSec)*100;
    bar.style.width = pct+'%';

    barContainer.appendChild(bar);

    row.appendChild(dateSpan);
    row.appendChild(timeSpan);
    row.appendChild(barContainer);

    container.appendChild(row);
  });
}

// TodaysWork非表示ボタン
document.addEventListener('DOMContentLoaded', ()=>{
  loadWorkLogs();
  loadUserSettings();
  applyTheme(userSettings.theme);
  updateDailyWorkTimeDisplay();
  updateTimerDisplay();

  // 初期アイコン状態
  playIcon.classList.remove('hidden');
  pauseIcon.classList.add('hidden');

  const toggleDailyWorkBtn = document.getElementById('toggleDailyWork');
  const dailyWorkTime = document.getElementById('daily-work-time');
  let dailyWorkVisible = true;
  toggleDailyWorkBtn.addEventListener('click', ()=>{
    dailyWorkVisible = !dailyWorkVisible;
    dailyWorkTime.style.display = dailyWorkVisible ? 'inline-block' : 'none';
    toggleDailyWorkBtn.innerHTML = dailyWorkVisible ?
    `
    <svg width="24" height="24" stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
    `
    :
    `
    <svg width="24" height="24" stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
      <path d="M2 2l20 20M9.88 9.88a3 3 0 014.24 4.24"/>
      <path d="M1 12s4-7 11-7c2.5 0 4.78.75 6.65 2M23 12s-4 7-11 7c-2.5 0-4.78-.75-6.65-2"/>
    </svg>
    `;
  });
});
