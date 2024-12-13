// script.js

// 前回までのコードに加え、集計データの蓄積を強化し、
// 過去の記録をローカルストレージに保存する。
// workLogs: [{date:"YYYY-MM-DD", totalWorkSeconds: number}, ...]

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

//////////////////////
// 日付関数
function getTodayDateStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// 日別データ {date, totalWorkSeconds}
// dailyWorkLogは当日分
// workLogsは過去分含む
let dailyWorkLog = { date:getTodayDateStr(), totalWorkSeconds:0 };
let workLogs = [];

function loadWorkLogs(){
  const w = localStorage.getItem('workLogs');
  if(w) {
    workLogs = JSON.parse(w);
  } else {
    workLogs = [];
  }
  // 当日分がなければ追加
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

// タイマー開始/停止時処理
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

// getInitialTimeForMode
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
    // Timer Done Event
    const evt=new Event("timerDone");
    document.getElementById('pomodoro-container').dispatchEvent(evt);
    toggleClock(true);
  }
}

function toggleClock(reset){
  if(reset){
    // リセット時は必ずplay表示, pause非表示
    isClockStopped=true;
    isClockRunning=false;
    clearInterval(timerInterval);
    timerInterval=null;
    currentTimeLeftInSession=getInitialTimeForMode();
    updateTimerDisplay();

    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
    return;
  }

  if(isClockRunning){
    // 一時停止時はplay表示, pause非表示
    isClockRunning=false;
    clearInterval(timerInterval);
    timerInterval=null;

    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
  } else {
    // 開始時はpause表示, play非表示
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


// すでにあるコード+下記変更点のみ抜粋

// タイマー完了時にNotionへ記録する例
document.getElementById('pomodoro-container').addEventListener('timerDone', ()=>{
  if(userSettings.playSound){
    alertSound.currentTime=0;
    alertSound.play();
  }
  if(Notification.permission==='granted'){
    new Notification("Pomodoro Finished!",{body:"Time for a break!"});
  }

  // Notion連携: pomodoro終了時、workSessionStartからの経過時間を記録
  // currentTimerTypeがpomodoroの場合のみ記録
  if(currentTimerType === 'pomodoro' && workSessionStart) {
    const elapsed = Math.floor((Date.now()-workSessionStart)/1000);
    const durationInMin = Math.round(elapsed/60);
    sendSessionToNotion(durationInMin, 'Work', ''); 
    // 'Work'は固定モード名、task名があるなら''にタスク名を入れる
  }
});

// Notion送信用関数
function sendSessionToNotion(duration, mode, task) {
  fetch('/api/record-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      timestamp: new Date().toISOString(),
      duration: duration,
      mode: mode,
      task: task || ''
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


// Radio change
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

// 新たなautoテーマ対応の関数
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

// autoモードで時間帯に応じて背景色を変更
function applyAutoTheme(){
  const bgWrapper = document.getElementById('bg-wrapper');
  const hour = new Date().getHours();
  let color;
  // 3時間毎に区切る
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

// Settings Modal
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
  // toggleClock(true); は呼ばない
});


// Stats Modal
statsBtn.addEventListener('click', ()=>{
  updateStatsModal();
  statsModal.classList.remove('hidden');
});
closeStatsBtn.addEventListener('click',()=>{
  statsModal.classList.add('hidden');
});

// Statsタブ切り替え
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

// Stats表示用関数
function updateStatsModal(){
  // dailyは既に当日分がdailyWorkLogにある
  statsDailyTotal.textContent = formatTime(dailyWorkLog.totalWorkSeconds);
  
  // 過去7日分
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
  result.sort((a,b)=> a.date>b.date?1:-1); // 日付順
  return result;
}

function populateStatsList(container, data){
  container.innerHTML='';
  // max find
  let maxSec = 0;
  data.forEach(d=>{
    if(d.totalWorkSeconds>maxSec) maxSec=d.totalWorkSeconds;
  });
  if(maxSec===0) maxSec=1; // avoid div0

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

document.addEventListener('DOMContentLoaded', ()=>{
  loadWorkLogs();
  loadUserSettings();
  applyTheme(userSettings.theme);
  updateDailyWorkTimeDisplay();
  updateTimerDisplay();

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
