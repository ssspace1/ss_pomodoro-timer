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

let isClockRunning=false;
let isClockStopped=true;
let currentTimeLeftInSession=25*60;
let timerInterval=null;
let currentTimerType="pomodoro";

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
alertSound.volume=1.0;

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
  if(currentTimerType==='pomodoro') {
    workSessionStart = Date.now();
  } else {
    workSessionStart=null;
  }
}

function onTimerStopOrPause(){
  if(workSessionStart && currentTimerType==='pomodoro'){
    const elapsed = Math.floor((Date.now()-workSessionStart)/1000);
    dailyWorkLog.totalWorkSeconds += elapsed;
    saveWorkLogs();
    updateDailyWorkTimeDisplay();
    workSessionStart=null;
  }
}

// getInitialTimeForMode
function getInitialTimeForMode(){
  const mode = document.querySelector('input[name="timerType"]:checked').value;
  currentTimerType=mode;
  let t= userSettings.pomodoro;
  if(mode==='short') t=userSettings.short;
  if(mode==='long') t=userSettings.long;
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
    isClockStopped=true;
    isClockRunning=false;
    clearInterval(timerInterval);
    timerInterval=null;
    currentTimeLeftInSession=getInitialTimeForMode();
    updateTimerDisplay();
    // アイコン戻す
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
    return;
  }

  if(isClockRunning){
    // Pause
    isClockRunning=false;
    clearInterval(timerInterval);
    timerInterval=null;
    // アイコン戻す
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
  } else {
    // Start
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

// タイマー完了時処理
document.getElementById('pomodoro-container').addEventListener('timerDone', ()=>{
  if(userSettings.playSound){
    alertSound.currentTime=0;
    alertSound.play();
  }
  if(Notification.permission==='granted'){
    new Notification("Pomodoro Finished!",{body:"Time for a break!"});
  }
});

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
function applyTheme(theme){
  const bg = document.getElementById('bg-image');
  if(theme==='forest') bg.src="https://example.com/forest.jpg";
  else if(theme==='cafe') bg.src="https://example.com/cafe.jpg";
  else if(theme==='night') bg.src="https://example.com/night.jpg";
  else bg.src="https://example.com/default.jpg";
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
  userSettings.pomodoro=parseInt(pomodoroLengthInput.value,10);
  userSettings.short=parseInt(shortBreakLengthInput.value,10);
  userSettings.long=parseInt(longBreakLengthInput.value,10);
  userSettings.playSound=playSoundCheck.checked;
  userSettings.theme=themeSelect.value;
  saveUserSettings();
  applyTheme(userSettings.theme);
  settingsModal.classList.add('hidden');
  toggleClock(true);
});
closeSettingsBtn.addEventListener('click',()=>{
  settingsModal.classList.add('hidden');
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


// 初期読み込み
document.addEventListener('DOMContentLoaded', ()=>{
  loadWorkLogs();
  loadUserSettings();
  applyTheme(userSettings.theme);
  updateDailyWorkTimeDisplay();
  updateTimerDisplay();
});

