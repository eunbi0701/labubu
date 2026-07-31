/* ============================================================
   장바구니 — 주문서 플랜 → 옵션 모달 → 담기 → 네비 슬라이드 패널

   백엔드가 없으므로 담긴 내용은 이 브라우저의 localStorage에만 남는다.
   index / support / account 세 페이지가 이 파일 하나를 공유한다.
   패널·모달 마크업을 HTML에 두지 않고 여기서 만드는 이유: 둘 다 JS 없이는
   절대 열리지 않는 화면이라, 3개 파일에 복사해 두면 동기화 부담만 는다.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'labubu.cart.v1';
  var ID_KEY = 'labubu.cart.id';        /* Supabase 장바구니 식별자 */
  var TOKEN_KEY = 'labubu.cart.token';  /* 그 장바구니를 열 수 있는 비밀 토큰 */
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ANIM = REDUCE ? 0 : 220;          /* 패널 슬라이드 시간 (ms) */

  /* 배포된 사이트(http/https)에서만 Supabase에 저장한다.
     file:// 로 열었을 때는 출처가 null이라 요청이 CORS에서 막히므로
     그 경우엔 localStorage만 쓰고 조용히 넘어간다. */
  var SB = window.LABUBU_SUPABASE || null;
  var REMOTE = !!(SB && SB.url && SB.key && location.protocol.indexOf('http') === 0);

  /* ── 작은 도구들 ──────────────────────────────────────────── */

  function won(n) { return '₩' + n.toLocaleString('ko-KR'); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;   /* 사용자 입력은 항상 textContent로 */
    return node;
  }

  function svg(paths, size) {
    var s = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" ' +
            'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            paths + '</svg>';
    var wrap = el('span', null);
    wrap.innerHTML = s;                 /* 고정 문자열이라 안전 */
    wrap.setAttribute('aria-hidden', 'true');
    return wrap;
  }

  /* ── 저장소 ──────────────────────────────────────────────── */

  var items = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return [];
      return parsed.items.filter(sane);
    } catch (e) {
      return [];                        /* 사생활 보호 모드거나 값이 깨진 경우 */
    }
  }

  /* 저장된 값은 사용자가 손댈 수 있으므로 그대로 믿지 않는다 */
  function sane(it) {
    return it && typeof it.key === 'string' &&
           typeof it.unit === 'number' && isFinite(it.unit) && it.unit >= 0 &&
           typeof it.qty === 'number' && it.qty > 0 && it.qty <= 99 &&
           Array.isArray(it.models);
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ items: items }));
    } catch (e) {
      /* 용량 초과·쓰기 거부. 화면 상태는 그대로 두고 조용히 넘어간다. */
    }
    push();                             /* 배포 환경이면 Supabase에도 밀어 넣는다 */
  }

  /* ── Supabase 동기화 ──────────────────────────────────────────
     localStorage를 먼저 그리고 원격은 뒤따라 맞추는 구조다.
     네트워크가 느리거나 끊겨도 담기 동작 자체는 즉시 끝난다. */

  var creds = null;                     /* { id, token } */
  var pushTimer = null;

  function rpc(fn, body) {
    return fetch(SB.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': SB.key,
        'Authorization': 'Bearer ' + SB.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      if (!res.ok) throw new Error(fn + ' ' + res.status);
      return res.json();
    });
  }

  function readCreds() {
    try {
      var id = localStorage.getItem(ID_KEY);
      var token = localStorage.getItem(TOKEN_KEY);
      return id && token ? { id: id, token: token } : null;
    } catch (e) { return null; }
  }

  function writeCreds(c) {
    creds = c;
    try {
      localStorage.setItem(ID_KEY, c.id);
      localStorage.setItem(TOKEN_KEY, c.token);
    } catch (e) {}
  }

  /* 새 장바구니를 발급받는다. 내용을 올리는 일은 부르는 쪽이 이어서 한다
     — 여기서 같이 저장하면 곧바로 뒤따르는 push와 겹쳐 두 번 쓰게 된다. */
  function enroll() {
    return rpc('cart_create').then(function (rows) {
      var row = Array.isArray(rows) ? rows[0] : rows;
      if (!row || !row.id || !row.token) throw new Error('cart_create: 응답이 비었다');
      writeCreds(row);
    });
  }

  function push() {
    if (!REMOTE) return;
    clearTimeout(pushTimer);
    /* 수량 버튼을 연타해도 마지막 상태 한 번만 올라가게 묶는다 */
    pushTimer = setTimeout(function () {
      var run = creds ? Promise.resolve() : enroll();
      run.then(function () {
        if (!creds) return;
        return rpc('cart_save', { p_id: creds.id, p_token: creds.token, p_items: items })
          .then(function (ok) {
            /* 행이 사라졌다면(정리됐거나 토큰이 어긋남) 새로 발급받아 다시 올린다 */
            if (ok === false) { creds = null; return enroll(); }
          });
      }).catch(function (err) {
        console.warn('[cart] 저장 실패 — 이 브라우저에는 남아 있습니다.', err);
      });
    }, 450);
  }

  /* 첫 진입: 원격에 저장된 장바구니가 있으면 그것을 정본으로 삼는다.
     다른 기기·다른 브라우저에서 담은 것을 이어받는 통로다. */
  function boot() {
    if (!REMOTE) return;
    creds = readCreds();
    if (!creds) {
      if (items.length) push();         /* 오프라인에서 담아 둔 것을 올린다 */
      return;
    }
    rpc('cart_load', { p_id: creds.id, p_token: creds.token })
      .then(function (remote) {
        if (remote === null) {          /* 토큰이 안 맞거나 행이 없다 */
          creds = null;
          return enroll().then(function () { if (items.length) push(); });
        }
        if (!Array.isArray(remote)) return;
        items = remote.filter(sane);
        try { localStorage.setItem(KEY, JSON.stringify({ items: items })); } catch (e) {}
        paint();
      })
      .catch(function (err) {
        console.warn('[cart] 불러오기 실패 — 이 브라우저에 저장된 내용을 씁니다.', err);
      });
  }

  function count() {
    return items.reduce(function (n, it) { return n + it.qty; }, 0);
  }

  function total() {
    return items.reduce(function (n, it) { return n + it.unit * it.qty; }, 0);
  }

  /* ── 라인업에서 모델 목록을 읽는다 ────────────────────────────
     JS에 모델을 다시 적어 두면 라인업을 고칠 때 두 곳이 어긋난다.
     모델이 없는 페이지(고객센터·마이페이지)에서는 빈 배열이 되고,
     그 페이지에는 주문서도 없으므로 모달을 열 일이 없다. */

  var MODELS = Array.prototype.map.call(
    document.querySelectorAll('.product[data-model]'),
    function (card) {
      var img = card.querySelector('img');
      return {
        id: card.dataset.model,
        name: card.dataset.modelName || '',
        img: img ? img.getAttribute('src') : ''
      };
    }
  );

  /* ── 담기 ────────────────────────────────────────────────── */

  function add(entry) {
    /* 옵션이 완전히 같으면 새 줄을 만들지 않고 수량만 올린다 */
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].key === entry.key) { found = items[i]; break; }
    }
    if (found) found.qty = Math.min(99, found.qty + entry.qty);
    else items.push(entry);
    save();
    paint();
  }

  function setQty(key, next) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].key !== key) continue;
      if (next <= 0) items.splice(i, 1);
      else items[i].qty = Math.min(99, next);
      break;
    }
    save();
    paint();
  }

  function clearAll() {
    items = [];
    save();
    paint();
  }

  /* ── 네비 버튼 뱃지 ───────────────────────────────────────── */

  function paint() {
    var n = count();
    document.querySelectorAll('[data-cart-count]').forEach(function (b) {
      b.textContent = String(n);
      b.hidden = n === 0;
    });
    document.querySelectorAll('[data-cart-open]').forEach(function (b) {
      b.setAttribute('aria-label', n === 0 ? '장바구니 열기 (비어 있음)' : '장바구니 열기 (' + n + '개)');
    });
    if (panel && panel.open) paintPanel();
  }

  /* ── 열고 닫기 (공통) ─────────────────────────────────────── */

  function openDialog(dlg) {
    dlg.showModal();
    if (ANIM) requestAnimationFrame(function () { dlg.classList.add('is-open'); });
    else dlg.classList.add('is-open');
  }

  function closeDialog(dlg, after) {
    dlg.classList.remove('is-open');
    setTimeout(function () {
      if (dlg.open) dlg.close();
      if (after) after();
    }, ANIM);
  }

  /* 바깥(백드롭) 클릭으로 닫기 — dialog 자신이 클릭 대상이면 바깥이다 */
  function closeOnBackdrop(dlg, onClose) {
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) onClose();
    });
    dlg.addEventListener('cancel', function (e) {   /* ESC */
      e.preventDefault();
      onClose();
    });
  }

  /* ── 옵션 모달 ───────────────────────────────────────────── */

  function openOptions(card) {
    var plan = {
      id: card.dataset.plan || '',
      name: card.dataset.planName || '',
      unit: parseInt(card.dataset.price, 10) || 0,
      picks: parseInt(card.dataset.picks, 10) || 0,
      fixed: card.hasAttribute('data-fixed')       /* 플랜 C: 4종 고정 */
    };

    var chosen = plan.fixed ? MODELS.slice() : [];
    var qty = 1;

    var dlg = el('dialog', 'opt');
    dlg.setAttribute('aria-labelledby', 'opt-title');

    var box = el('div', 'opt__box');
    dlg.appendChild(box);

    /* 머리 */
    var head = el('div', 'opt__head');
    var titles = el('div', 'opt__titles');
    titles.appendChild(el('span', 'opt__label', plan.name));
    var h2 = el('h2', 'opt__title', '옵션을 골라 주세요');
    h2.id = 'opt-title';
    titles.appendChild(h2);
    head.appendChild(titles);

    var x = el('button', 'opt__x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', '닫기');
    x.addEventListener('click', function () { closeDialog(dlg, cleanup); });
    head.appendChild(x);
    box.appendChild(head);

    /* 모델 선택 */
    var pickCount = el('span', 'opt__count');
    if (MODELS.length) {
      var fs = el('fieldset', 'opt__field');
      var lg = el('legend', 'opt__legend');
      lg.appendChild(el('span', null, plan.fixed ? '들어가는 모델' : '모델 ' + plan.picks + '종 선택'));
      lg.appendChild(pickCount);
      fs.appendChild(lg);

      var picker = el('div', 'picker');
      MODELS.forEach(function (m) {
        var id = 'opt-m-' + m.id;
        var lab = el('label', 'picker__item');
        lab.htmlFor = id;

        var input = el('input');
        input.type = 'checkbox';
        input.id = id;
        input.className = 'picker__input';
        input.value = m.id;
        if (plan.fixed) { input.checked = true; input.disabled = true; }

        var fig = el('span', 'picker__media');
        if (m.img) {
          var im = el('img');
          im.src = m.img;
          im.alt = '';                        /* 옆의 이름이 이미 설명한다 */
          im.loading = 'lazy';
          fig.appendChild(im);
        }
        fig.appendChild(el('span', 'picker__check', '✓'));

        lab.appendChild(input);
        lab.appendChild(fig);
        lab.appendChild(el('span', 'picker__tag', 'MODEL ' + m.id));
        lab.appendChild(el('span', 'picker__name', m.name));

        input.addEventListener('change', function () {
          if (plan.fixed) return;
          if (input.checked) chosen.push(m);
          else chosen = chosen.filter(function (c) { return c.id !== m.id; });
          syncPicker();
          refresh();
        });

        picker.appendChild(lab);
      });
      fs.appendChild(picker);

      if (plan.fixed) fs.appendChild(el('p', 'opt__hint', '시즌 4종이 모두 들어갑니다. 따로 고르지 않아도 돼요.'));
      box.appendChild(fs);

      var syncPicker = function () {
        var full = chosen.length >= plan.picks;
        picker.querySelectorAll('.picker__input').forEach(function (inp) {
          if (!plan.fixed) inp.disabled = full && !inp.checked;   /* 초과 선택 방지 */
        });
      };
    }

    /* 수량 */
    var qtyRow = el('div', 'opt__row');
    qtyRow.appendChild(el('span', 'opt__rowlabel', '수량'));
    var stepper = el('div', 'stepper');
    var minus = el('button', 'stepper__btn', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', '수량 한 개 줄이기');
    var qtyOut = el('output', 'stepper__value', '1');
    var plus = el('button', 'stepper__btn', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', '수량 한 개 늘리기');
    minus.addEventListener('click', function () { qty = Math.max(1, qty - 1); refresh(); });
    plus.addEventListener('click', function () { qty = Math.min(99, qty + 1); refresh(); });
    stepper.appendChild(minus);
    stepper.appendChild(qtyOut);
    stepper.appendChild(plus);
    qtyRow.appendChild(stepper);
    box.appendChild(qtyRow);

    /* 선물 포장 */
    var giftRow = el('label', 'opt__check');
    var gift = el('input');
    gift.type = 'checkbox';
    giftRow.appendChild(gift);
    var giftText = el('span', 'opt__checktext');
    giftText.appendChild(el('span', 'opt__checkname', '선물 포장'));
    giftText.appendChild(el('span', 'opt__checkdesc', '겉상자를 종이끈으로 묶고 이름표를 답니다. 추가 요금 없음.'));
    giftRow.appendChild(giftText);
    box.appendChild(giftRow);

    /* 손글씨 편지 문구 */
    var noteWrap = el('div', 'opt__note');
    var noteLab = el('label', 'opt__rowlabel', '손글씨 편지에 넣을 문구 (선택)');
    noteLab.htmlFor = 'opt-note';
    var note = el('textarea', 'opt__textarea');
    note.id = 'opt-note';
    note.rows = 2;
    note.maxLength = 40;
    note.placeholder = '예) 생일 축하해, 서연아';
    var noteLeft = el('span', 'opt__left', '0 / 40');
    note.addEventListener('input', function () {
      noteLeft.textContent = note.value.length + ' / 40';
    });
    noteWrap.appendChild(noteLab);
    noteWrap.appendChild(note);
    noteWrap.appendChild(noteLeft);
    box.appendChild(noteWrap);

    /* 발 — 합계와 담기 */
    var foot = el('div', 'opt__foot');
    var sum = el('div', 'opt__sum');
    sum.appendChild(el('span', 'opt__sumlabel', '합계'));
    var sumValue = el('span', 'opt__sumvalue', won(plan.unit));
    sum.appendChild(sumValue);
    foot.appendChild(sum);

    var submit = el('button', 'opt__submit', '장바구니에 담기');
    submit.type = 'button';
    foot.appendChild(submit);

    var warn = el('p', 'opt__warn');
    foot.appendChild(warn);
    box.appendChild(foot);

    submit.addEventListener('click', function () {
      if (!plan.fixed && chosen.length !== plan.picks) return;
      var models = chosen.map(function (m) { return { id: m.id, name: m.name }; });
      var text = note.value.trim();
      add({
        key: [plan.id, models.map(function (m) { return m.id; }).sort().join(','), gift.checked ? 'g' : '', text].join('|'),
        plan: plan.id,
        planName: plan.name,
        unit: plan.unit,
        qty: qty,
        models: models,
        gift: gift.checked,
        note: text
      });
      closeDialog(dlg, function () {
        cleanup();
        toast('장바구니에 담았어요');
        openPanel();
      });
    });

    /* 선택 상태에 따라 합계·버튼·안내를 다시 그린다 */
    function refresh() {
      qtyOut.textContent = String(qty);
      minus.disabled = qty <= 1;
      plus.disabled = qty >= 99;
      sumValue.textContent = won(plan.unit * qty);

      var need = plan.fixed ? 0 : plan.picks - chosen.length;
      if (MODELS.length && !plan.fixed) {
        pickCount.textContent = chosen.length + ' / ' + plan.picks;
        pickCount.classList.toggle('is-done', need === 0);
      }
      submit.disabled = need > 0;
      warn.textContent = need > 0 ? '모델을 ' + need + '종 더 골라 주세요.' : '';
    }

    function cleanup() { dlg.remove(); }

    closeOnBackdrop(dlg, function () { closeDialog(dlg, cleanup); });

    document.body.appendChild(dlg);
    if (MODELS.length && !plan.fixed) syncPicker();
    refresh();
    openDialog(dlg);
  }

  /* ── 장바구니 패널 ───────────────────────────────────────── */

  var panel = null, panelList = null, panelSum = null, panelEmpty = null, panelNotice = null;

  function buildPanel() {
    panel = el('dialog', 'cart');
    panel.setAttribute('aria-labelledby', 'cart-title');

    var head = el('div', 'cart__head');
    var t = el('h2', 'cart__title', '장바구니');
    t.id = 'cart-title';
    head.appendChild(t);
    var x = el('button', 'cart__x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', '장바구니 닫기');
    x.addEventListener('click', closePanel);
    head.appendChild(x);
    panel.appendChild(head);

    panelList = el('ul', 'cart__list');
    panel.appendChild(panelList);

    panelEmpty = el('div', 'cart__empty');
    panelEmpty.appendChild(el('p', 'cart__empty-title', '아직 비어 있어요'));
    panelEmpty.appendChild(el('p', 'cart__empty-desc', '주문서에서 플랜을 고르면 여기에 담깁니다.'));
    panel.appendChild(panelEmpty);

    var foot = el('div', 'cart__foot');
    var sum = el('div', 'cart__sum');
    sum.appendChild(el('span', 'cart__sumlabel', '합계'));
    panelSum = el('span', 'cart__sumvalue', won(0));
    sum.appendChild(panelSum);
    foot.appendChild(sum);

    var go = el('button', 'cart__go', '주문하기');
    go.type = 'button';
    panelNotice = el('p', 'cart__notice');
    panelNotice.setAttribute('role', 'status');
    go.addEventListener('click', function () {
      /* 결제 연동이 없다. 주문이 접수된 것처럼 보이게 하지 않는다. */
      panelNotice.textContent = REMOTE
        ? '결제는 아직 연결돼 있지 않아요. 담아 두신 내용은 저장돼 있으니 다음에 오셔도 그대로입니다.'
        : '결제는 아직 연결돼 있지 않아요. 담긴 내용은 이 브라우저에만 저장됩니다.';
    });
    foot.appendChild(go);
    foot.appendChild(panelNotice);

    var clear = el('button', 'cart__clear', '비우기');
    clear.type = 'button';
    clear.addEventListener('click', function () {
      clearAll();
      panelNotice.textContent = '';
    });
    foot.appendChild(clear);

    panel.appendChild(foot);

    closeOnBackdrop(panel, closePanel);
    document.body.appendChild(panel);
  }

  function paintPanel() {
    panelList.textContent = '';

    items.forEach(function (it) {
      var li = el('li', 'cart__item');

      var top = el('div', 'cart__itemtop');
      top.appendChild(el('span', 'cart__itemname', it.planName));
      top.appendChild(el('span', 'cart__itemprice', won(it.unit * it.qty)));
      li.appendChild(top);

      var models = (it.models || []).map(function (m) { return m.name; }).join(' · ');
      if (models) li.appendChild(el('p', 'cart__itemopt', models));

      var extras = [];
      if (it.gift) extras.push('선물 포장');
      if (it.note) extras.push('편지 “' + it.note + '”');
      if (extras.length) li.appendChild(el('p', 'cart__itemextra', extras.join(' · ')));

      var row = el('div', 'cart__itemrow');
      var stepper = el('div', 'stepper stepper--sm');
      var minus = el('button', 'stepper__btn', '−');
      minus.type = 'button';
      minus.setAttribute('aria-label', it.planName + ' 수량 줄이기');
      minus.addEventListener('click', function () { setQty(it.key, it.qty - 1); });
      var val = el('span', 'stepper__value', String(it.qty));
      var plus = el('button', 'stepper__btn', '+');
      plus.type = 'button';
      plus.setAttribute('aria-label', it.planName + ' 수량 늘리기');
      plus.disabled = it.qty >= 99;
      plus.addEventListener('click', function () { setQty(it.key, it.qty + 1); });
      stepper.appendChild(minus);
      stepper.appendChild(val);
      stepper.appendChild(plus);
      row.appendChild(stepper);

      var del = el('button', 'cart__del', '삭제');
      del.type = 'button';
      del.setAttribute('aria-label', it.planName + ' 장바구니에서 빼기');
      del.addEventListener('click', function () { setQty(it.key, 0); });
      row.appendChild(del);

      li.appendChild(row);
      panelList.appendChild(li);
    });

    var empty = items.length === 0;
    panelEmpty.hidden = !empty;
    panelList.hidden = empty;
    panel.classList.toggle('is-empty', empty);
    panelSum.textContent = won(total());
  }

  function openPanel() {
    if (!panel) buildPanel();
    panelNotice.textContent = '';
    paintPanel();
    openDialog(panel);
  }

  function closePanel() { closeDialog(panel); }

  /* ── 담았어요 알림 ───────────────────────────────────────── */

  var toastNode = null, toastTimer = null;

  function toast(text) {
    if (!toastNode) {
      toastNode = el('div', 'toast');
      toastNode.setAttribute('role', 'status');
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = text;
    toastNode.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastNode.classList.remove('is-on'); }, 2400);
  }

  /* ── 연결 ────────────────────────────────────────────────── */

  document.querySelectorAll('[data-cart-open]').forEach(function (btn) {
    btn.addEventListener('click', openPanel);
  });

  document.querySelectorAll('.plan[data-plan]').forEach(function (card) {
    var cta = card.querySelector('[data-plan-cta]');
    if (!cta) return;
    cta.setAttribute('aria-haspopup', 'dialog');
    cta.addEventListener('click', function (e) {
      e.preventDefault();          /* JS가 없으면 그냥 #order 앵커로 남는다 */
      openOptions(card);
    });
  });

  /* 다른 탭에서 담거나 비웠을 때 이 탭도 따라간다 */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    items = load();
    paint();
  });

  paint();
  boot();
})();
