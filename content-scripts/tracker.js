/**
 * AIStat - Universal AI Message Counter (Content Script)
 * Runs in the isolated extension world (top window only).
 * Combines network interception with real-time UI event capture.
 */

(function () {
  'use strict';

  // Ensure execution ONLY in the top window context (never inside iframes)
  if (window.self !== window.top) return;

  // 1. Identify Platform
  const host = window.location.hostname.toLowerCase();
  let platformId = 'general';

  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
    platformId = 'chatgpt';
  } else if (host.includes('claude.ai')) {
    platformId = 'claude';
  } else if (host.includes('gemini.google.com')) {
    platformId = 'gemini';
  } else if (host.includes('deepseek.com')) {
    platformId = 'deepseek';
  } else if (host.includes('perplexity.ai')) {
    platformId = 'perplexity';
  } else if (host.includes('google.com') && (window.location.pathname.includes('/search') || window.location.pathname.includes('/aisearch'))) {
    platformId = 'aisearch';
  }

  console.log(`[AIStat] Content tracker active on ${platformId}`);

  let isContextActive = true;
  let lastSentTimestamp = 0;
  let lastKnownText = '';
  let lastTextTime = 0;

  function isExtensionValid() {
    if (!isContextActive) return false;
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        isContextActive = false;
        return false;
      }
      return true;
    } catch (e) {
      isContextActive = false;
      return false;
    }
  }

  function safeSendMessage(message) {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage(message, () => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          if (errMsg.includes('context invalidated') || errMsg.includes('Receiving end does not exist')) {
            isContextActive = false;
          }
        }
      });
    } catch (err) {
      if (String(err).includes('context invalidated')) {
        isContextActive = false;
      }
    }
  }

  // Core recording function (debounced 4000ms)
  function recordMessage(source = '') {
    if (!isExtensionValid()) return;

    const now = Date.now();
    if (now - lastSentTimestamp < 4000) return;
    lastSentTimestamp = now;

    const text = (lastKnownText || getAnyPromptInputText() || '').trim();

    console.log(`[AIStat] Prompt recorded on ${platformId} (via ${source})`);

    safeSendMessage({
      type: 'RECORD_PROMPT',
      data: {
        platform: platformId,
        timestamp: now,
        queryText: text.slice(0, 150),
        source
      }
    });

    lastKnownText = '';
  }

  // ── LAYER 1: Network Interceptor Bridge ──────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.source === 'AISTAT_NET_INTERCEPT') {
      recordMessage(`network:${event.data.endpoint || ''}`);
    }
  }, false);

  // ── LAYER 2: Text Extraction & Caching ──────────────────────
  function getAnyPromptInputText() {
    // Google AI Search / Search input or URL param
    if (platformId === 'aisearch') {
      const searchBox = document.querySelector('textarea[name="q"], input[name="q"]');
      if (searchBox) {
        const txt = (searchBox.value || searchBox.innerText || '').trim();
        if (txt) return txt;
      }
      try {
        const urlQ = new URLSearchParams(window.location.search).get('q');
        if (urlQ && urlQ.trim()) return urlQ.trim();
      } catch (e) {}
    }

    // ChatGPT: #prompt-textarea (ProseMirror contenteditable)
    const chatGptBox = document.getElementById('prompt-textarea');
    if (chatGptBox) {
      const txt = (chatGptBox.innerText || chatGptBox.value || '').trim();
      if (txt) return txt;
    }

    // Claude: ProseMirror contenteditable
    const claudeBox = document.querySelector('div[contenteditable="true"].ProseMirror, fieldset div[contenteditable="true"]');
    if (claudeBox) {
      const txt = (claudeBox.innerText || '').trim();
      if (txt) return txt;
    }

    // Gemini: rich-textarea
    const geminiBox = document.querySelector('rich-textarea div[contenteditable="true"], rich-textarea .ql-editor');
    if (geminiBox) {
      const txt = (geminiBox.innerText || '').trim();
      if (txt) return txt;
    }

    // Active Element
    const active = document.activeElement;
    if (active) {
      const txt = (active.value || active.innerText || '').trim();
      if (txt) return txt;
    }

    // Universal Textarea / Contenteditable
    const anyTextarea = document.querySelector('textarea, div[contenteditable="true"]');
    if (anyTextarea) {
      const txt = (anyTextarea.value || anyTextarea.innerText || '').trim();
      if (txt) return txt;
    }

    return '';
  }

  function trackTyping(e) {
    try {
      const direct = getAnyPromptInputText();
      if (direct) {
        lastKnownText = direct;
        lastTextTime = Date.now();
        return;
      }

      const target = e.target;
      if (!target) return;
      let text = '';
      if (target.value !== undefined) {
        text = target.value;
      } else if (target.innerText !== undefined) {
        text = target.innerText;
      }
      if (text && text.trim().length > 0) {
        lastKnownText = text.trim();
        lastTextTime = Date.now();
      }
    } catch (err) {}
  }

  ['input', 'beforeinput', 'keyup', 'change'].forEach(evtName => {
    window.addEventListener(evtName, trackTyping, { capture: true, passive: true });
  });

  function isChatInputElement(el) {
    if (!el) return false;
    if (platformId === 'aisearch') {
      if (el.name === 'q' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
      if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search' || !el.type)) return true;
    }
    if (el.tagName === 'INPUT' && (el.type === 'search' || el.placeholder?.toLowerCase().includes('search') || el.id?.toLowerCase().includes('search'))) {
      return false;
    }
    if (el.id === 'prompt-textarea' || (el.closest && el.closest('#prompt-textarea'))) return true;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT' && (el.type === 'text' || !el.type)) return true;
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
    if (el.closest && el.closest('#prompt-textarea, rich-textarea, .ProseMirror, [contenteditable="true"]')) return true;
    return false;
  }

  function isSendButton(el) {
    if (!el) return false;
    const btn = el.closest('button, [role="button"], [type="submit"]');
    if (!btn) return false;

    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const className = (btn.className || '').toLowerCase();
    const jsname = (btn.getAttribute('jsname') || '').toLowerCase();
    const text = (btn.innerText || '').toLowerCase().trim();

    const isExplicitSend = (
      ariaLabel.includes('send') ||
      ariaLabel.includes('submit') ||
      testId.includes('send') ||
      testId.includes('submit') ||
      id.includes('send-button') ||
      id === 'send' ||
      className.includes('send-button') ||
      className.includes('submit-button') ||
      jsname.includes('send') ||
      text === 'send' ||
      text === 'submit' ||
      text === 'ask' ||
      btn.type === 'submit'
    );

    if (!isExplicitSend) return false;

    if (
      ariaLabel.includes('attach') ||
      ariaLabel.includes('upload') ||
      ariaLabel.includes('voice') ||
      ariaLabel.includes('mic') ||
      ariaLabel.includes('canvas') ||
      ariaLabel.includes('model') ||
      ariaLabel.includes('tool') ||
      ariaLabel.includes('gem') ||
      testId.includes('attach') ||
      testId.includes('voice')
    ) {
      return false;
    }

    return true;
  }

  // ── LAYER 3: UI Event Handlers ──────────────────────────────
  window.addEventListener('keydown', (e) => {
    try {
      if (!isExtensionValid()) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        const target = e.target;
        if (isChatInputElement(target) || isChatInputElement(document.activeElement)) {
          const currentText = getAnyPromptInputText() || (target?.value || target?.innerText || '').trim();
          const hasRecentText = (lastKnownText.length > 0 && (Date.now() - lastTextTime < 300000));
          if (currentText.length > 0 || hasRecentText) {
            recordMessage('enter_key');
          }
        }
      }
    } catch (err) {}
  }, true);

  // Capture text on pointerdown before React / Svelte clears it on click
  window.addEventListener('pointerdown', (e) => {
    try {
      if (!isExtensionValid()) return;
      if (isSendButton(e.target)) {
        const currentText = getAnyPromptInputText();
        const hasRecentText = (lastKnownText.length > 0 && (Date.now() - lastTextTime < 300000));
        if (currentText.length > 0 || hasRecentText) {
          recordMessage('send_button_pointerdown');
        }
      }
    } catch (err) {}
  }, true);

  window.addEventListener('click', (e) => {
    try {
      if (!isExtensionValid()) return;
      if (isSendButton(e.target)) {
        const currentText = getAnyPromptInputText();
        const hasRecentText = (lastKnownText.length > 0 && (Date.now() - lastTextTime < 300000));
        if (currentText.length > 0 || hasRecentText) {
          recordMessage('send_button_click');
        }
      }
    } catch (err) {}
  }, true);

  window.addEventListener('submit', () => {
    try {
      if (!isExtensionValid()) return;
      const currentText = getAnyPromptInputText();
      const hasRecentText = (lastKnownText.length > 0 && (Date.now() - lastTextTime < 300000));
      if (currentText.length > 0 || hasRecentText) {
        recordMessage('form_submit');
      }
    } catch (err) {}
  }, true);

})();

// [EXPERIMENTAL] Hook for tracking interactive sessions in Claude Artifact views
