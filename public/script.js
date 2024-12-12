// script.js

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
let currentTimeLeftInSession = 25*60; // 初期値25分
let timerInterval = null;

const timerDisplay = document.getElementById('pomodoro-timer');
const startBtn = document.getElementById('pomodoro-start');
const stopBtn = document.getElementById('pomodoro-stop');
const timerTypeInputs = document.querySelectorAll('input[name="timerType"]');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');

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

function getInitialTimeForMode(){
  // 仮にユーザ設定が無ければ固定時間
  // pomodoro:25分, short:5分, long:10分 例
  let pomodoroTime = 25; // 分
  let shortBreakTime = 5;
  let longBreakTime = 10;

  const mode = document.querySelector('input[name="timerType"]:checked').value;
  let t = 25*60;
  if(mode === 'pomodoro') t = pomodoroTime * 60;
  else if(mode === 'short') t = shortBreakTime * 60;
  else if(mode === 'long') t = longBreakTime * 60;
  return t;
}

// モード変更時
timerTypeInputs.forEach(input => {
  input.addEventListener('change', ()=>{
    const newMode = document.querySelector('input[name="timerType"]:checked').value;
    onTimerModeChange(newMode);
    toggleClock(true); // モード変更で一度リセットして初期時間に変更
  });
});

// タイマー終了イベントが飛んできたら音を鳴らすなど
document.getElementById('pomodoro-container').addEventListener('timerDone', ()=>{
  // ここでサウンド再生や通知など
  console.log("Timer Finished!");
});

// ボタン操作
startBtn.addEventListener('click', ()=>{
  toggleClock(false);
});
stopBtn.addEventListener('click', ()=>{
  toggleClock(true);
});

// ページロード時の処理
document.addEventListener('DOMContentLoaded', ()=>{
  loadDailyWorkLog();
  updateDailyWorkTimeDisplay();
  updateTimerDisplay();
});
