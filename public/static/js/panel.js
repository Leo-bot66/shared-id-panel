/* 共享 Apple ID 面板 —— 前端交互
 * 设计要点：首页 HTML 不含明文密码，点击「显示密码 / 复制密码」时才向后端按需请求。 */
(function () {
  'use strict';

  /* ------------------------------ 工具函数 ------------------------------ */

  function toast(message) {
    var el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 1800);
  }

  /** 复制文本：优先 Clipboard API，失败则回退到 execCommand（兼容 http 环境） */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  /* ------------------------------ 密码获取 ------------------------------ */

  var passwordCache = new Map();

  function fetchPassword(id) {
    if (passwordCache.has(id)) {
      return Promise.resolve(passwordCache.get(id));
    }
    return fetch('/api/accounts/' + encodeURIComponent(id) + '/password', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var pwd = json && json.data ? json.data.password : '';
        if (!pwd) throw new Error('empty password');
        passwordCache.set(id, pwd);
        return pwd;
      });
  }

  /* ------------------------------ 事件处理 ------------------------------ */

  document.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;

    var card = button.closest('[data-account-card]');
    if (!card) return;

    var id = card.getAttribute('data-account-id');

    /* 显示密码 */
    if (button.matches('[data-reveal]')) {
      var secretEl = card.querySelector('.credential-secret');
      if (button.getAttribute('aria-expanded') === 'true') {
        secretEl.textContent = '••••••••••';
        button.setAttribute('aria-expanded', 'false');
        button.textContent = '显示密码';
        return;
      }
      button.disabled = true;
      fetchPassword(id)
        .then(function (pwd) {
          secretEl.textContent = pwd;
          button.setAttribute('aria-expanded', 'true');
          button.textContent = '隐藏密码';
        })
        .catch(function () {
          toast('密码获取失败，请稍后重试');
        })
        .finally(function () {
          button.disabled = false;
        });
      return;
    }

    /* 复制账号 */
    var email = button.getAttribute('data-copy');
    if (email) {
      copyText(email)
        .then(function () {
          toast('账号已复制');
        })
        .catch(function () {
          toast('复制失败，请手动选择');
        });
      return;
    }

    /* 复制密码 */
    if (button.hasAttribute('data-copy-password')) {
      button.disabled = true;
      fetchPassword(id)
        .then(copyText)
        .then(function () {
          var secretEl = card.querySelector('.credential-secret');
          if (secretEl) secretEl.textContent = passwordCache.get(id);
          var revealBtn = card.querySelector('[data-reveal]');
          if (revealBtn) {
            revealBtn.setAttribute('aria-expanded', 'true');
            revealBtn.textContent = '隐藏密码';
          }
          toast('密码已复制');
        })
        .catch(function () {
          toast('密码获取失败，请稍后重试');
        })
        .finally(function () {
          button.disabled = false;
        });
    }
  });
})();
