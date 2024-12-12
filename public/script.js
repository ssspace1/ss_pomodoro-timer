// script.js

// ===== 追加部分 開始 =====
let userSettings = {
  pomodoro:25,
  short:5,
  long:10,
  playSound:true,
  theme:"default"
};

const alertSound = new Audio("https://example.com/chime.mp3"); // 簡易音源URL
alertSound.volume = 1.0;

// 設定をローカルストレージへ保存/読み込み
function loadUserSettings(){
  const s = localStorage.getItem('userSettings');
  if(s){
    userSettings = JSON.parse(s);
  }
}
function saveUserSettings(){
  localStorage.setItem('userSettings', JSON.stringify(userSettings));
}

// 背景テーマ適用
function applyTheme(theme){
  const bg = document.getElementById('bg-image');
  if(theme === 'forest'){
    bg.src = "https://example.com/forest.jpg";
  } else if(theme==='cafe'){
    bg.src = "https://example.com/cafe.jpg";
  } else if(theme==='night'){
    bg.src = "https://example.com/night.jpg";
  } else {
    bg.src = "https://example.com/default.jpg";
  }
}
// ===== 追加部分 終了 =====


// ====== デイリー作業時間集計ロジック ======
function getTodayDateStr(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

window.dailyWorkLog = { date:getTodayDateStr(), totalWorkSeconds:0 };
window.workSessionStart = null; 
window.currentTimerType = "pomodoro"; 

function loadDailyWorkLog(){
  const saved = localStorage.getItem('dailyWorkLog');
  const today = getTodayDateStr();
  if(saved){
    const data = JSON.parse(saved);
    if(data.date === today) {
      window.dailyWorkLog = data;
    } else {
      window.dailyWorkLog = { date:today, totalWorkSeconds:0 };
      saveDailyWorkLog();
    }
  } else {
    saveDailyWorkLog();
  }
}

function saveDailyWorkLog(){
  localStorage.setItem('dailyWorkLog', JSON.stringify(window.dailyWorkLog));
}

function updateDailyWorkTimeDisplay(){
  const sec = window.dailyWorkLog.totalWorkSeconds;
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  const str = [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
  document.getElementById('dailyWorkDisplay').textContent = str;
}

function onTimerStart(){
  if(window.currentTimerType === 'pomodoro'){
    window.workSessionStart = Date.now();
  } else {
    window.workSessionStart = null;
  }
}

function onTimerStopOrPause(){
  if(window.workSessionStart && window.currentTimerType === 'pomodoro'){
    const elapsed = Math.floor((Date.now() - window.workSessionStart)/1000);
    window.dailyWorkLog.totalWorkSeconds += elapsed;
    saveDailyWorkLog();
    updateDailyWorkTimeDisplay();
    window.workSessionStart = null;
  }
}

function onTimerModeChange(newMode){
  onTimerStopOrPause();
  window.currentTimerType = newMode;
}

// ====== ポモドーロタイマーロジック（簡易版） ======
let isClockRunning = false;
let isClockStopped = true;
let currentTimeLeftInSession = 25*60; // 初期値（後でユーザ設定で上書き）

let timerInterval = null;

const timerDisplay = document.getElementById('pomodoro-timer');
const startBtn = document.getElementById('pomodoro-start');
const stopBtn = document.getElementById('pomodoro-stop');
const timerTypeInputs = document.querySelectorAll('input[name="timerType"]');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

// getInitialTimeForModeをユーザー設定値を使うように修正
function getInitialTimeForMode(){
  const mode = document.querySelector('input[name="timerType"]:checked').value;
  let t = userSettings.pomodoro; // default pomodoro
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
  if(currentTimeLeftInSession <= 0){
    // タイマー終了
    clearInterval(timerInterval);
    timerInterval = null;
    onTimerStopOrPause(); // 計測更新
    const event = new Event("timerDone");
    document.getElementById('pomodoro-container').dispatchEvent(event);
    toggleClock(true);
  }
}

function toggleClock(reset){
  if(reset){
    // リセット
    isClockStopped = true;
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    currentTimeLeftInSession = getInitialTimeForMode();
    updateTimerDisplay();
    // アイコンをstart表示
    if(playIcon.classList.contains('hidden')) playIcon.classList.remove('hidden');
    if(!pauseIcon.classList.contains('hidden')) pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
    return;
  }

  // スタート/一時停止トグル
  if(isClockRunning){
    // 一時停止
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    // アイコンをstartに
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    onTimerStopOrPause();
  } else {
    // 開始
    if(isClockStopped){
      currentTimeLeftInSession = getInitialTimeForMode();
      updateTimerDisplay();
      isClockStopped = false;
    }
    isClockRunning = true;
    onTimerStart();
    // アイコンをpauseに
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    timerInterval = setInterval(tick, 1000);
  }
}

// モード変更時
timerTypeInputs.forEach(input => {
  input.addEventListener('change', ()=>{
    const newMode = document.querySelector('input[name="timerType"]:checked').value;
    onTimerModeChange(newMode);
    toggleClock(true); // モード変更で一度リセット
  });
});

// タイマー終了イベントで音と通知
document.getElementById('pomodoro-container').addEventListener('timerDone', ()=>{
  if(userSettings.playSound){
    alertSound.currentTime = 0;
    alertSound.play();
  }
  // 通知表示（許可されている場合）
  if(Notification.permission==='granted'){
    new Notification("Pomodoro Finished!", {body:"Time to take a break!"});
  }
});

// ボタン操作
startBtn.addEventListener('click', ()=>{
  toggleClock(false);
});
stopBtn.addEventListener('click', ()=>{
  toggleClock(true);
});

// 設定モーダル制御
const settingsModal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('pomodoro-settings');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

settingsBtn.addEventListener('click', ()=>{
  // 現行設定値を入力欄へ反映
  document.getElementById('pomodoroLength').value = userSettings.pomodoro;
  document.getElementById('shortBreakLength').value = userSettings.short;
  document.getElementById('longBreakLength').value = userSettings.long;
  document.getElementById('playSoundCheck').checked = userSettings.playSound;
  document.getElementById('themeSelect').value = userSettings.theme;
  
  settingsModal.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', ()=>{
  userSettings.pomodoro = parseInt(document.getElementById('pomodoroLength').value,10);
  userSettings.short = parseInt(document.getElementById('shortBreakLength').value,10);
  userSettings.long = parseInt(document.getElementById('longBreakLength').value,10);
  userSettings.playSound = document.getElementById('playSoundCheck').checked;
  userSettings.theme = document.getElementById('themeSelect').value;
  saveUserSettings();
  applyTheme(userSettings.theme);
  settingsModal.classList.add('hidden');
  // タイマーリセット
  toggleClock(true);
});

closeSettingsBtn.addEventListener('click', ()=>{
  settingsModal.classList.add('hidden');
});

// ページロード時
document.addEventListener('DOMContentLoaded', ()=>{
  loadDailyWorkLog();
  updateDailyWorkTimeDisplay();
  loadUserSettings();
  applyTheme(userSettings.theme);
  updateTimerDisplay();
  // 通知許可要求（必要なら）
  if(Notification && Notification.permission==='default'){
    Notification.requestPermission();
  }
});
