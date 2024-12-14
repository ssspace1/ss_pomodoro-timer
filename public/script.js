// script.js

// ==========================
// 基本設定・変数定義
// ==========================

let userSettings = {
  pomodoro: 25,
  short: 5,
  long: 10,
  playSound: true,
  theme: "default",
  autoRecordDaily: false,
  dayResetTime: "00:00" // 新規追加
};

let isClockRunning = false;
let isClockStopped = true;
let currentTimerType = "pomodoro";
let currentTimeLeftInSession = userSettings.pomodoro * 60;
let timerInterval = null;

// 実作業ログ管理
let workLogs = [];
let dailyWorkLog = { date: getTodayDateStr(), totalWorkSeconds: 0 };
loadWorkLogs();

// ポモドーロ開始時刻記録用(Workモード時のみ)
let workSessionStart = null;

// 要素取得
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
const pomodoroLengthInput = document.getElementById('pomodoroLength');
const shortBreakLengthInput = document.getElementById('shortBreakLength');
const longBreakLengthInput = document.getElementById('longBreakLength');
const playSoundCheck = document.getElementById('playSoundCheck');
const themeSelect = document.getElementById('themeSelect');
const autoRecordDailyCheck = document.getElementById('autoRecordDailyCheck');
const recordNowBtn = document.getElementById('recordNowBtn');

const statsModal = document.getElementById('statsModal');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const statsDailyTotal = document.getElementById('statsDailyTotal');
const statsWeeklyList = document.getElementById('statsWeeklyList');
const statsMonthlyList = document.getElementById('statsMonthlyList');

// サウンド
const alertSound = new Audio("https://example.com/chime.mp3");
alertSound.volume = 1.0;

// 通知権限要求
if (Notification && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ==========================
// 関数定義
// ==========================

function getTodayDateStr() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}


function getTodayDateStr(){
  // 現在時刻
  const now = new Date();
  // ★dayResetTimeを分解
  const [resetH, resetM] = userSettings.dayResetTime.split(':').map(n=>parseInt(n,10));
  
  // 今日のreset時刻を表すDate
  const resetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), resetH, resetM);
  
  // 現在がreset時刻より前か後かで日付を決める
  // もしnow < resetTodayなら、実質まだ前日の作業日とみなす
  let effectiveDate = new Date(now);
  if (now < resetToday) {
    // 昨日の日付として扱う
    effectiveDate.setDate(effectiveDate.getDate()-1);
  }

  return effectiveDate.getFullYear()+'-'+String(effectiveDate.getMonth()+1).padStart(2,'0')+'-'+String(effectiveDate.getDate()).padStart(2,'0');
}


function loadWorkLogs() {
  const w = localStorage.getItem('workLogs');
  if (w) {
    workLogs = JSON.parse(w);
  } else {
    workLogs = [];
  }
  const today = getTodayDateStr();
  let todayLog = workLogs.find(l => l.date===today);
  if (!todayLog) {
    todayLog = {date:today, totalWorkSeconds:0};
    workLogs.push(todayLog);
    saveWorkLogs();
  }
  dailyWorkLog = todayLog;
}

function saveWorkLogs() {
  localStorage.setItem('workLogs', JSON.stringify(workLogs));
}

function updateDailyWorkTimeDisplay() {
  dailyWorkDisplay.textContent = formatTime(dailyWorkLog.totalWorkSeconds);
}

function formatTime(seconds) {
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}

function updateTimerDisplay() {
  const min = String(Math.floor(currentTimeLeftInSession/60)).padStart(2,'0');
  const sec = String(currentTimeLeftInSession%60).padStart(2,'0');
  timerDisplay.textContent = `${min}:${sec}`;
}

// 1秒ごと呼ばれる
function tick() {
  currentTimeLeftInSession--;
  updateTimerDisplay();
  if (currentTimeLeftInSession <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    onTimerEnd();
  }
}

// タイマー終了処理
function onTimerEnd() {
  // 音
  if (userSettings.playSound) {
    alertSound.currentTime = 0;
    alertSound.play();
  }
  // 通知
  if (Notification.permission === 'granted') {
    new Notification("Pomodoro Finished!", {body:"Time for a break!"});
  }

  // ポモドーロ中ならNotionへ記録
  if (currentTimerType === 'pomodoro' && workSessionStart) {
    const end = Date.now();
    const elapsedSec = Math.floor((end - workSessionStart)/1000);
    addElapsedToDailyLog(elapsedSec);
    updateDailyWorkTimeDisplay();
    workSessionStart = null;

    // duration(分)
    const durationInMin = Math.round(elapsedSec/60);
    const timestamp = new Date().toISOString(); // 終了時刻をtimestampとする

    // mode決定
    let mode = "Work";
    if (currentTimerType === 'short') mode = "Short Break";
    if (currentTimerType === 'long') mode = "Long Break";

    // taskは固定にする(必要ならUI追加可能)
// onTimerEnd()やnowRecordでtask変数に"Pomo Session"をセット
  const task = "Pomo Session";
  sendSessionToNotion(timestamp, durationInMin, mode, task);

  }

  if (currentTimerType === 'short' || currentTimerType === 'long') {
    // 次はpomodoroモードに戻す(自動開始するかリセットして待機するかは要望に応じ調整可能)
    document.querySelector('input[name="timerType"][value="pomodoro"]').checked = true;
    toggleClock(true); // リセット状態に戻す。自動で開始したい場合は別処理
  } else {
    toggleClock(true);
  }
}


function onTimerStart() {
  if (currentTimerType === 'pomodoro') {
    workSessionStart = Date.now();
  } else {
    workSessionStart = null;
  }
}

function onTimerStopOrPause() {
  // 作業中だった場合、その分を加算
  if (workSessionStart && currentTimerType === 'pomodoro') {
    const elapsed = Math.floor((Date.now()-workSessionStart)/1000);
    addElapsedToDailyLog(elapsed);
    updateDailyWorkTimeDisplay();
    workSessionStart = null;
  }
}

function addElapsedToDailyLog(elapsedSec) {
  dailyWorkLog.totalWorkSeconds += elapsedSec;
  saveWorkLogs();
}

// モード切り替え時の初期時間取得
function getInitialTimeForMode() {
  const mode = document.querySelector('input[name="timerType"]:checked').value;
  currentTimerType = mode;
  let t = userSettings.pomodoro;
  if (mode==='short') t = userSettings.short;
  if (mode==='long') t = userSettings.long;
  return t*60;
}

// タイマー開始/停止/リセット
function toggleClock(reset) {
  if (reset) {
    isClockStopped = true;
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    currentTimeLeftInSession = getInitialTimeForMode();
    updateTimerDisplay();
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
    return;
  }

  if (isClockRunning) {
    // 一時停止
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
  } else {
    // 開始
    if (isClockStopped) {
      currentTimeLeftInSession = getInitialTimeForMode();
      updateTimerDisplay();
      isClockStopped = false;
    }
    isClockRunning = true;
    onTimerStart();
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    timerInterval = setInterval(tick,1000);
  }
}

// Notionへ記録送信関数
function sendSessionToNotion(timestamp, durationInMin, mode, task) {
  fetch('/api/record-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ timestamp, duration: durationInMin, mode, task })
  })
  .then(res=>res.json())
  .then(data=>{
    if(data.message==="Success") {
      console.log("Notionへの記録成功:", data);
    } else {
      console.error("Notion記録失敗:", data);
    }
  })
  .catch(err=>{
    console.error("Notion記録中エラー:", err);
  });
}

// Now Record ボタンでの記録処理
recordNowBtn.addEventListener('click', ()=>{
  // ここは注意書きをindex.htmlで追加済みなので、
  // 「動いてるときに押してね」というガイドがユーザーには伝わる。
  // コード上はそのままでもよいが、必要なら変更可。
  if (currentTimerType==='pomodoro' && workSessionStart) {
    const elapsedSec = Math.floor((Date.now()-workSessionStart)/1000);
    const durationInMin = Math.round(elapsedSec/60);
    const timestamp = new Date().toISOString();
    const mode = "Work";
    // ★task名固定
    const task = "Pomo Session";
    sendSessionToNotion(timestamp, durationInMin, mode, task);
  } else {
    console.log("No ongoing work session to record"); // このままでもOK
  }
});



// 統計関連
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

// テーマ適用
function applyTheme(theme) {
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

function loadUserSettings(){
  const s = localStorage.getItem('userSettings');
  if(s) userSettings = JSON.parse(s);
}
function saveUserSettings(){
  localStorage.setItem('userSettings', JSON.stringify(userSettings));
}

// イベントリスナー類
const timerTypeInputs = document.querySelectorAll('input[name="timerType"]');
timerTypeInputs.forEach(input=>{
  input.addEventListener('change', ()=>{
    onTimerStopOrPause();
    toggleClock(true);
  });
});

startBtn.addEventListener('click', ()=>toggleClock(false));
stopBtn.addEventListener('click', ()=>toggleClock(true));

settingsBtn.addEventListener('click', ()=>{
  pomodoroLengthInput.value=userSettings.pomodoro;
  shortBreakLengthInput.value=userSettings.short;
  longBreakLengthInput.value=userSettings.long;
  playSoundCheck.checked=userSettings.playSound;
  themeSelect.value=userSettings.theme;
  autoRecordDailyCheck.checked=userSettings.autoRecordDaily;
  // ★追加
  dayResetTimeInput.value = userSettings.dayResetTime; 

  settingsModal.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', ()=>{
  userSettings.pomodoro = parseInt(pomodoroLengthInput.value,10);
  userSettings.short = parseInt(shortBreakLengthInput.value,10);
  userSettings.long = parseInt(longBreakLengthInput.value,10);
  userSettings.playSound = playSoundCheck.checked;
  userSettings.theme = themeSelect.value;
  userSettings.autoRecordDaily = autoRecordDailyCheck.checked;
  // ★追加
  userSettings.dayResetTime = dayResetTimeInput.value; 
  saveUserSettings();
  applyTheme(userSettings.theme);
  settingsModal.classList.add('hidden');
});

closeSettingsBtn.addEventListener('click',()=> settingsModal.classList.add('hidden'));

statsBtn.addEventListener('click', ()=>{
  updateStatsModal();
  statsModal.classList.remove('hidden');
});
closeStatsBtn.addEventListener('click',()=> statsModal.classList.add('hidden'));

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

document.addEventListener('DOMContentLoaded', ()=>{
  loadUserSettings();
  applyTheme(userSettings.theme);
  updateDailyWorkTimeDisplay();
  updateTimerDisplay();
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
