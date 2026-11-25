const status = document.querySelector('[data-server-status]');

if (status && 'WebSocket' in window) {
  const browser = document.querySelector('[data-server-browser]');
  const capacity = document.querySelector('[data-server-capacity]');
  const refreshDelay = 30_000;
  let socket;
  let timeout;
  let refresh;

  function stop() {
    clearTimeout(timeout);
    clearTimeout(refresh);
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      socket = null;
    }
  }

  function check() {
    stop();
    if (document.hidden) return;

    function finish(online, max) {
      stop();
      status.dataset.state = online === undefined ? 'unavailable' : 'online';
      if (browser) browser.dataset.state = status.dataset.state;
      if (capacity) capacity.textContent = online === undefined ? '— / —'
        : `${online.toLocaleString()} / ${Number.isSafeInteger(max) && max >= online ? max.toLocaleString() : '—'}`;
      status.textContent = online === undefined
        ? 'Status unavailable · Retrying soon'
        : `Online · ${online.toLocaleString()} ${online === 1 ? 'player' : 'players'}`;
      refresh = setTimeout(check, refreshDelay);
    }

    try {
      socket = new WebSocket('wss://bagelcraft.net');
      timeout = setTimeout(() => finish(), 8_000);
      socket.onopen = () => socket.send('Accept: MOTD');
      socket.onmessage = ({ data }) => {
        // The query may also send a binary icon; only the MOTD JSON is needed.
        if (typeof data !== 'string') return;
        try {
          const response = JSON.parse(data);
          const online = response.data?.online;
          if (response.type === 'motd' && Number.isSafeInteger(online) && online >= 0) {
            finish(online, response.data.max);
          }
        } catch {
          // Leave the timeout active if an unrelated or malformed message arrives.
        }
      };
      socket.onerror = socket.onclose = () => finish();
    } catch {
      finish();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else check();
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', event => {
    if (event.persisted) check();
  });
  check();
}
