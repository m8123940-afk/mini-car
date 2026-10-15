// Клиент онлайн-гонок (WebSocket). Адрес сервера: впишите свой ниже или укажите в Настройках игры.
// Пример: const SERVER_URL = 'wss://turbo-rivals.onrender.com';
const SERVER_URL = '';

const Net = (() => {
  let ws = null, open = false; const h = {};
  function connect(url, timeoutMs) {
    return new Promise((res, rej) => {
      try { ws = new WebSocket(url); } catch (e) { return rej(e); }
      const to = setTimeout(() => { try { ws.close(); } catch (e) {} rej(new Error('timeout')); }, timeoutMs || 15000);
      ws.onopen = () => { clearTimeout(to); open = true; res(); };
      ws.onerror = () => { clearTimeout(to); rej(new Error('error')); };
      ws.onclose = () => { open = false; if (h.close) h.close(); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } if (h[m.t]) h[m.t](m); };
    });
  }
  // «Будит» бесплатный сервер Render обычным запросом (ответ не нужен)
  const wake = url => {
    try {
      const b = String(url || '').trim().replace(/^ws(s?):\/\//i, 'http$1://').replace(/\/+$/, '');
      if (/^https?:\/\//i.test(b)) fetch(b + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    } catch (e) {}
  };
  return {
    connect, wake,
    send: o => { if (open && ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
    on: (t, f) => { h[t] = f; },
    close: () => { try { ws && ws.close(); } catch (e) {} open = false; },
    isOpen: () => open
  };
})();
