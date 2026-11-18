/* Static browser runtime. Test-supplied strings are always rendered with textContent. */
(() => {
  const $ = selector => document.querySelector(selector);
  const cards = [...document.querySelectorAll('#selection-stream > .video-card')];
  const labels = new Map(cards.map(card => [card, JSON.parse(card.dataset.labels)]));
  const filters = [...document.querySelectorAll('[data-filter]')];
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* file:// can deny storage */ } },
  };
  let view = 'gallery';
  document.documentElement.dataset.theme = storage.get('saturday-theme') === 'light' ? 'light' : 'dark';
  $('#theme-btn').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    storage.set('saturday-theme', theme);
  });
  function cell(row, text) {
    const td = document.createElement('td');
    td.textContent = text;
    row.append(td);
    return td;
  }
  function visibleCards() { return cards.filter(card => !card.hidden); }
  function heatmap() {
    const groups = new Map();
    for (const card of visibleCards()) {
      const data = labels.get(card);
      const platform = [data.runner, data.os, data.browser, data.project].filter(Boolean).join(' / ');
      const key = JSON.stringify([card.dataset.suite, platform]);
      if (!groups.has(key)) groups.set(key, { suite: card.dataset.suite, platform, passed: 0, flaky: 0, failed: 0, skipped: 0 });
      const status = ['passed', 'flaky', 'skipped'].includes(data.status) ? data.status : 'failed';
      groups.get(key)[status]++;
    }
    $('#heatmap-body').replaceChildren();
    for (const data of groups.values()) {
      const row = document.createElement('tr');
      cell(row, data.suite); cell(row, data.platform);
      for (const status of ['passed', 'flaky', 'failed', 'skipped']) cell(row, String(data[status]));
      $('#heatmap-body').append(row);
    }
  }
  function inspector() {
    const rail = $('#inspector-rail'), drawer = $('#inspector-drawer');
    rail.replaceChildren(); drawer.replaceChildren();
    function select(card, button) {
      drawer.querySelectorAll('video').forEach(video => video.pause());
      rail.querySelectorAll('button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      const copy = card.cloneNode(true);
      copy.hidden = false;
      drawer.replaceChildren(copy);
    }
    visibleCards().forEach((card, index) => {
      const button = document.createElement('button');
      button.className = 'rail-item';
      button.textContent = `${labels.get(card).status} · ${card.dataset.name}`;
      button.addEventListener('click', () => select(card, button));
      rail.append(button);
      if (index === 0) select(card, button);
    });
  }
  function filter() {
    const query = $('#search').value.trim().toLowerCase();
    for (const card of cards) {
      const data = labels.get(card);
      card.hidden = !filters.every(input => !input.value || data[input.dataset.filter] === input.value) || !card.textContent.toLowerCase().includes(query);
      if (card.hidden) card.querySelectorAll('video').forEach(video => video.pause());
    }
    $('#shown').textContent = `${visibleCards().length} / ${cards.length} tests`;
    $('#empty').hidden = visibleCards().length > 0;
    if (view === 'heatmap') heatmap();
    if (view === 'inspector') inspector();
  }
  function switchView(next) {
    view = next;
    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === view);
      button.setAttribute('aria-pressed', String(button.dataset.view === view));
    });
    $('#selection-stream').hidden = view !== 'gallery';
    $('#heatmap-view').hidden = view !== 'heatmap';
    $('#inspector-view').hidden = view !== 'inspector';
    document.querySelectorAll('video').forEach(video => video.pause());
    filter();
  }
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
  for (const input of [$('#search'), ...filters]) input.addEventListener('input', filter);
  const modal = $('#theater-modal'), player = $('#theater-player');
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.speed) button.closest('.recording').querySelector('video').playbackRate = Number(button.dataset.speed);
    if (button?.dataset.theater) {
      $('#theater-title').textContent = button.dataset.title;
      player.src = button.dataset.theater;
      modal.showModal();
    }
  });
  $('#close-theater').addEventListener('click', () => modal.close());
  modal.addEventListener('close', () => { player.pause(); player.removeAttribute('src'); player.load(); });
  filter();
})();
