// script.js

// ==========================
// 基本的な設定・変数定義
// ==========================

// ユーザー設定(初期値)
let userSettings = {
  pomodoro: 25,     // ポモドーロ時間(分)
  short: 5,         // ショートブレイク時間(分)
  long: 10,         // ロングブレイク時間(分)
  playSound: true,  // 終了時に音を鳴らす
  theme: "default",
  autoRecordDaily: false // デイリーを自動記録するか(オプション)
};

// 今のモードとタイマー状態を表す変数
let isClockRunning = false;   // タイマーが動いているか
let isClockStopped = true;    // タイマーが停止中か(リセット状態)
let currentTimerType = "pomodoro"; // 今のモード(pomodoro, short, long)

// タイマー残り秒数
let currentTimeLeftInSession = userSettings.pomodoro * 60;
// タイマーを進めるintervalのID
let timerInterval = null;

// 作業時間計測用(一日の合計作業時間を記録)
let workLogs = []; 
let dailyWorkLog = { date:getTodayDateStr(), totalWorkSeconds:0 };
loadWorkLogs();

// 実際の作業開始時間を記録(ポモドーロモード中のみ)
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

// セッティングモーダル関連
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

// 統計モーダル関連
const statsModal = document.getElementById('statsModal');
const closeStatsBtn = document.getElementById('closeStatsBtn');
const statsDailyTotal = document.getElementById('statsDailyTotal');
const statsWeeklyList = document.getElementById('statsWeeklyList');
const statsMonthlyList = document.getElementById('statsMonthlyList');

// サウンド
const alertSound = new Audio("https://example.com/chime.mp3");
alertSound.volume = 1.0;

// Notification 許可要求(初回のみ)
if(Notification && Notification.permission === 'default'){
  Notification.requestPermission();
}

// ==========================
// 関数定義
// ==========================

// 今日の日付文字列(YYYY-MM-DD)を返す
function getTodayDateStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ローカルストレージから作業ログ読み込み
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

// ローカルストレージに作業ログ保存
function saveWorkLogs(){
  localStorage.setItem('workLogs', JSON.stringify(workLogs));
}

// デイリー作業表示更新
function updateDailyWorkTimeDisplay(){
  dailyWorkDisplay.textContent = formatTime(dailyWorkLog.totalWorkSeconds);
}

// 秒→HH:MM:SS形式の文字列に変換
function formatTime(seconds){
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}

// タイマー表示を更新
function updateTimerDisplay(){
  const min = String(Math.floor(currentTimeLeftInSession/60)).padStart(2,'0');
  const sec = String(currentTimeLeftInSession%60).padStart(2,'0');
  timerDisplay.textContent = `${min}:${sec}`;
}

// タイマーが1秒進むたびに呼ばれる
function tick(){
  currentTimeLeftInSession--;
  updateTimerDisplay();
  if(currentTimeLeftInSession <= 0){
    clearInterval(timerInterval);
    timerInterval = null;
    onTimerEnd(); // タイマー終了時の処理
  }
}

// タイマー終了時処理
function onTimerEnd(){
  // 音を鳴らす
  if(userSettings.playSound){
    alertSound.currentTime = 0;
    alertSound.play();
  }

  // 通知送る
  if(Notification.permission==='granted'){
    new Notification("Pomodoro Finished!", {body:"Time for a break!"});
  }

  // ポモドーロ中だった場合、Notionに記録を送る
  if(currentTimerType === 'pomodoro' && workSessionStart) {
    const elapsed = Math.floor((Date.now()-workSessionStart)/1000); // 経過秒
    addElapsedToDailyLog(elapsed); // 合計作業時間に追加
    updateDailyWorkTimeDisplay();
    workSessionStart = null; 
    const durationInMin = Math.round(elapsed/60);
    sendSessionToNotion(durationInMin, "Work", "My Task");
  }

  // タイマー停止状態にする
  toggleClock(true);
}

// ポモドーロ開始時（resume時）に呼ぶ処理
function onTimerStart(){
  if(currentTimerType === 'pomodoro') {
    // 作業セッション開始時間を記録
    workSessionStart = Date.now();
  } else {
    workSessionStart = null;
  }
}

// タイマー一時停止や停止、リセット時に呼ぶ処理
function onTimerStopOrPause(){
  // ポモドーロ中でworkSessionStartがある場合のみ、elapsedを計算
  if(workSessionStart && currentTimerType === 'pomodoro'){
    const elapsed = Math.floor((Date.now()-workSessionStart)/1000);
    addElapsedToDailyLog(elapsed);
    updateDailyWorkTimeDisplay();
    workSessionStart = null;
  }
}

// 日ごとの合計時間に経過秒数を追加
function addElapsedToDailyLog(elapsedSec){
  dailyWorkLog.totalWorkSeconds += elapsedSec;
  saveWorkLogs();
}

// モード切替時にタイマー時間を再設定
function getInitialTimeForMode(){
  const mode = document.querySelector('input[name="timerType"]:checked').value;
  currentTimerType = mode;
  let t = userSettings.pomodoro;
  if(mode==='short') t = userSettings.short;
  if(mode==='long') t = userSettings.long;
  return t*60;
}

// タイマーの開始/一時停止/リセット管理
function toggleClock(reset){
  if(reset){
    // リセット処理
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

  if(isClockRunning){
    // 一時停止
    isClockRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
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
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    timerInterval = setInterval(tick, 1000);
  }
}

// 現在の作業状態をNotionへ記録(POSTする)
function sendSessionToNotion(durationInMin, mode, task) {
  const timestamp = new Date().toISOString();
  fetch('/api/record-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ timestamp, duration: durationInMin, mode, task })
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

// 手動で"Now Record"を押したときの処理
function nowRecord() {
  // いままでの合計作業秒数(dailyWorkLog)から分を計算
  const durationInMin = Math.floor(dailyWorkLog.totalWorkSeconds / 60);
  const mode = (currentTimerType === 'pomodoro') ? "Work" : "Break";
  const task = "Some Task Name"; // 必要に応じてUIから入力可能に
  sendSessionToNotion(durationInMin, mode, task);
}

// 統計情報更新
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

// ユーザー設定の保存/読み込み
function loadUserSettings(){
  const s = localStorage.getItem('userSettings');
  if(s) userSettings = JSON.parse(s);
}
function saveUserSettings(){
  localStorage.setItem('userSettings', JSON.stringify(userSettings));
}

// ==========================
// イベントリスナー登録
// ==========================

// タイマーモード切り替え
const timerTypeInputs = document.querySelectorAll('input[name="timerType"]');
timerTypeInputs.forEach(input=>{
  input.addEventListener('change', ()=>{
    onTimerStopOrPause();
    toggleClock(true);
  });
});

// 開始/一時停止ボタン
startBtn.addEventListener('click', ()=>toggleClock(false));

// リセットボタン
stopBtn.addEventListener('click', ()=>toggleClock(true));

// 設定ボタン
settingsBtn.addEventListener('click', ()=>{
  pomodoroLengthInput.value=userSettings.pomodoro;
  shortBreakLengthInput.value=userSettings.short;
  longBreakLengthInput.value=userSettings.long;
  playSoundCheck.checked=userSettings.playSound;
  themeSelect.value=userSettings.theme;
  autoRecordDailyCheck.checked=userSettings.autoRecordDaily;
  settingsModal.classList.remove('hidden');
});

saveSettingsBtn.addEventListener('click', ()=>{
  userSettings.pomodoro = parseInt(pomodoroLengthInput.value,10);
  userSettings.short = parseInt(shortBreakLengthInput.value,10);
  userSettings.long = parseInt(longBreakLengthInput.value,10);
  userSettings.playSound = playSoundCheck.checked;
  userSettings.theme = themeSelect.value;
  userSettings.autoRecordDaily = autoRecordDailyCheck.checked;
  saveUserSettings();
  applyTheme(userSettings.theme);
  settingsModal.classList.add('hidden');
});

closeSettingsBtn.addEventListener('click',()=> settingsModal.classList.add('hidden'));

// "Now Record"ボタンで手動記録
recordNowBtn.addEventListener('click', ()=> nowRecord());

// スタッツボタン
statsBtn.addEventListener('click', ()=>{
  updateStatsModal();
  statsModal.classList.remove('hidden');
});
closeStatsBtn.addEventListener('click',()=> statsModal.classList.add('hidden'));

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

// Today's Work表示非表示切り替え
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
    // アイコンを切り替え(例: 目のアイコン)
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
