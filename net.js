<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Turbo Rivals 3D</title>
<link rel="stylesheet" href="style.css">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
<canvas id="c"></canvas>
<div id="fx"></div>

<div id="hud" hidden>
  <div class="stat"><b id="pos">1/6</b><span>место</span></div>
  <div class="stat"><b id="lap">1/3</b><span>круг</span></div>
  <div class="stat"><b id="rc">0</b><span>монеты</span></div>
  <div class="stat right"><b id="spd">0</b><span>км/ч</span></div>
  <div id="nitroBar"><i id="nitro"></i></div>
  <div id="bossTag" hidden></div>
  <button id="quitBtn" title="Выйти">✕</button>
</div>
<button id="fixBtn" hidden>↺ Поправить (R)</button>
<div id="count" hidden></div>
<div id="toast" hidden></div>

<div id="touch" hidden>
  <div class="grp l">
    <button class="tb" data-k="left">◀</button>
    <button class="tb" data-k="right">▶</button>
  </div>
  <div class="grp r">
    <button class="tb nit" data-k="nitro">N</button>
    <button class="tb brk" data-k="brake">▼</button>
    <button class="tb gas" data-k="gas">▲</button>
  </div>
</div>

<div id="auth" class="overlay authscreen">
  <div class="authcard">
    <div class="eyebrow">GLOBAL RACING NETWORK</div>
    <h1 class="authtitle">TURBO<br>RIVALS 3D</h1>
    <p class="sub">Создай аккаунт один раз — прогресс будет доступен на других устройствах.</p>
    <label class="set authset">Имя гонщика<input id="authName" maxlength="14" autocomplete="username" placeholder="Например, TurboFox"></label>
    <label class="set authset">Пароль<input id="authPass" type="password" maxlength="128" autocomplete="current-password" placeholder="Не менее 6 символов"></label>
    <div class="row authactions"><button id="loginBtn" class="btn">Войти</button><button id="registerBtn" class="big sm">Регистрация</button></div>
    <p id="authStatus" class="sub authstatus">Имя: 3–14 букв или цифр. Пароль: от 6 символов.</p>
  </div>
</div>

<div id="menu" class="overlay side" hidden>
  <h1>TURBO<br>RIVALS 3D</h1>
  <p class="sub" id="who"></p>
  <div class="lvl" id="lvlInfo"></div>
  <button id="startBtn" class="big">Карьера</button>
  <div class="grid">
    <button id="trainBtn" class="btn">Тренировка</button>
    <button id="tourBtn" class="btn">Турниры</button>
    <button id="onlineBtn" class="btn">Онлайн</button>
    <button id="garageBtn" class="btn">Гараж и магазин</button>
    <button id="charBtn" class="btn">Персонаж</button>
    <button id="setBtn" class="btn">Настройки</button>
    <button id="helpBtn" class="btn">Как играть</button>
    <button id="adminBtn" class="btn">Админ-панель</button>
  </div>
  <p class="coins">Монеты: <b id="coins">0</b></p>
</div>

<div id="garage" class="panel" hidden>
  <div class="gtop">
    <button class="btn" data-back>← Меню</button>
    <span class="coins"><b id="gCoins">0</b> монет</span>
  </div>
  <div class="gbody">
    <div class="gnav">
      <button id="gPrev" class="btn sq">◀</button>
      <div class="gtitle"><h3 id="gName"></h3><p id="gInfo"></p></div>
      <button id="gNext" class="btn sq">▶</button>
    </div>
    <div id="gStats"></div>
    <div class="row">
      <button id="gMain" class="big sm"></button>
      <button id="gRepair" class="btn"></button>
    </div>
  </div>
</div>

<div id="char" class="panel" hidden>
  <div class="gbody">
    <h3>Персонаж</h3>
    <div class="row"><button id="chBoy" class="btn">Мальчик</button><button id="chGirl" class="btn">Девочка</button></div>
    <p class="sub">Одежда</p><div id="chCols" class="row"></div>
    <p class="sub">Цвет кожи</p><div id="chSkin" class="row"></div>
    <div class="row" style="margin-top:12px"><button id="chDone" class="big sm">Готово</button></div>
  </div>
</div>

<div id="train" class="overlay" hidden>
  <h2>Тренировка</h2>
  <p class="sub">Сложность (новые открываются по уровням карьеры)</p>
  <div id="trDiffs" class="col"></div>
  <p class="sub">Локация</p>
  <div id="trThemes" class="row"></div>
  <div class="row"><button id="trStart" class="big sm">Старт</button><button class="btn" data-back>Назад</button></div>
</div>

<div id="tour" class="overlay" hidden>
  <h2>Турниры</h2>
  <div id="tourList" class="col"></div>
  <button class="btn" data-back>Назад</button>
</div>

<div id="online" class="overlay" hidden>
  <h2>Онлайн</h2>
  <p class="sub" id="onStatus">Подключаемся к общей сети гонщиков…</p>
  <div id="onlinePlayers" class="online-roster"><div class="muted">Здесь появятся игроки в сети.</div></div>
  <div class="row"><button id="onFind" class="big sm">Войти в онлайн</button><button id="onCancel" class="btn">Отключиться</button></div>
  <p class="sub">Одна общая очередь. Как только два гонщика готовы — матч запускается автоматически.</p>
  <button class="btn" data-back>Назад</button>
</div>

<div id="settings" class="overlay" hidden>
  <h2>Настройки</h2>
  <label class="set">Имя <input id="nameIn" maxlength="14" autocomplete="off" readonly></label>
  <label class="set">Звук <button id="sndBtn" class="btn"></button></label>
  <label class="set">Музыка <button id="musBtn" class="btn"></button></label>
  <label class="set">Графика <button id="gfxBtn" class="btn"></button></label>
  <label class="set">Тема меню <button id="themeBtn" class="btn"></button></label>
  <p class="sub settingsnote">Онлайн-сеть: <b>mini-car.onrender.com</b> · подключение и поиск соперника автоматические.</p>
  <button id="logoutBtn" class="btn">Выйти из аккаунта</button>
  <button id="resetBtn" class="btn danger">Сбросить прогресс</button>
  <button id="setBack" class="big sm">Готово</button>
</div>

<div id="help" class="overlay" hidden>
  <h2>Как играть</h2>
  <p class="sub" style="max-width:460px;text-align:left">ПК: стрелки или WASD — руль, газ и тормоз; Пробел — нитро; R — выровнять машину, если застряли.<br><br>
  Телефон: кнопки на экране; если машина застряла больше секунды, появится кнопка «Поправить».<br><br>
  Монеты — валюта магазина. Трамплин даёт +40% скорости. Масло вызывает занос, барьеры ломают машину. Зелёный куб — ремонт, синий цилиндр — нитро.<br><br>
  Карьера: финишируйте в тройке, чтобы открыть следующий уровень. Мини-босс — каждые 10 уровней, босс — каждые 20.</p>
  <button class="btn" data-back>Назад</button>
</div>

<div id="result" class="overlay" hidden>
  <h2 id="resTitle"></h2>
  <p class="sub" id="resSub"></p>
  <div id="resTable"></div>
  <p class="coins">+<b id="resCoins">0</b> монет</p>
  <div class="row">
    <button id="againBtn" class="big"></button>
    <button id="toMenu" class="btn">Меню</button>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="cars.js"></script>
<script src="audio.js"></script>
<script src="net.js"></script>
<script src="game.js"></script>
</body>
</html>
