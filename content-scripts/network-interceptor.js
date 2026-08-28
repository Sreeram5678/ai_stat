/**
 * AIStat - Main World Network Interceptor
 * Runs ONLY in the top-level window context to catch exact AI prompt submissions.
 */

(function () {
  'use strict';

  // Ensure execution only in the top window context (never inside child iframes)
  if (window.self !== window.top) return;

  if (window.__AI_STAT_INTERCEPTOR_LOADED__) return;
  window.__AI_STAT_INTERCEPTOR_LOADED__ = true;

  const host = window.location.hostname.toLowerCase();
  let platformId = null;

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

  if (!platformId) return;

  let lastInterceptionTime = 0;

  function notifyPromptSent(endpoint) {
    const now = Date.now();
    // 4000ms local debounce on network interception
    if (now - lastInterceptionTime < 4000) return;
    lastInterceptionTime = now;

    try {
      window.postMessage({
        source: 'AISTAT_NET_INTERCEPT',
        platform: platformId,
        endpoint,
        timestamp: now
      }, '*');
    } catch (err) {}
  }

  function isAiChatEndpoint(urlStr, method) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    const url = urlStr.toLowerCase();
    const isPost = String(method || '').toUpperCase() === 'POST';

    // Must be a POST request (or aisearch async queries)
    if (!isPost && platformId !== 'aisearch') return false;

    // 1. ChatGPT: conversation and prompt generation POST requests
    if (platformId === 'chatgpt') {
      const isExcluded = (
        url.includes('/conversations') ||
        url.includes('/bazaar/') ||
        url.includes('/me') ||
        url.includes('/feedback') ||
        url.includes('/synthesize')
      );
      const isPromptEndpoint = url.includes('/conversation') || url.includes('/prompt') || url.includes('/chat');
      return isPost && isPromptEndpoint && !isExcluded;
    }

    // 2. Claude: prompt completion POST requests
    if (platformId === 'claude') {
      return isPost && (
        url.includes('/completion') ||
        url.includes('/retry_completion') ||
        url.includes('/chat_messages') ||
        url.includes('/append_message')
      );
    }

    // 3. Gemini: stream response generation & assistant prompt RPCs
    if (platformId === 'gemini') {
      return isPost && (
        url.includes('bardchatui') ||
        url.includes('streamgenerate') ||
        url.includes('bardfrontendservice') ||
        url.includes('assistant.lamda') ||
        url.includes('batchexecute')
      );
    }

    // 4. DeepSeek: chat completion POST requests
    if (platformId === 'deepseek') {
      return isPost && (
        url.includes('/chat/completion') ||
        url.includes('/chat_completion') ||
        url.includes('/api/v0/chat') ||
        url.includes('/api/v0/chat/completion')
      );
    }

    // 5. Perplexity: query submission POST requests
    if (platformId === 'perplexity') {
      return isPost && (
        url.includes('/rest/queries') ||
        url.includes('/rest/ask') ||
        url.includes('/api/perplexity_ask') ||
        url.includes('/api/query')
      );
    }

    // 6. Google AI Search / AI Overview query endpoints
    if (platformId === 'aisearch') {
      const isExcluded = (
        url.includes('/complete/search') || // Exclude autocomplete search suggestions
        url.includes('/gen_204') ||
        url.includes('/log?') ||
        url.includes('/client_204') ||
        url.includes('/og/_/js') ||
        url.includes('batchexecute') // Exclude generic Google account / log syncs
      );
      if (isExcluded) return false;

      const isAiOverview = url.includes('/async/genai_') || url.includes('/async/ai_') || url.includes('udm=24') || url.includes('udm=14') || url.includes('aimode=1') || url.includes('/aisearch');
      const isAiFollowupPost = isPost && (url.includes('/async/') || url.includes('/search')) && (url.includes('ai_overview') || url.includes('arc-srp'));
      return isAiOverview || isAiFollowupPost;
    }

    return false;
  }

  // 1. Hook window.fetch
  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (resource, init) {
      try {
        let url = '';
        let method = 'GET';

        if (typeof resource === 'string') {
          url = resource;
          method = (init && init.method) ? init.method : 'GET';
        } else if (resource instanceof Request) {
          url = resource.url;
          method = resource.method || (init && init.method) || 'GET';
        } else if (resource && typeof resource.toString === 'function') {
          url = resource.toString();
          method = (init && init.method) ? init.method : 'GET';
        }

        if (isAiChatEndpoint(url, method)) {
          notifyPromptSent(url);
        }
      } catch (err) {}

      return originalFetch.apply(this, arguments);
    };
  }

  // 2. Hook XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this._aistat_method = method;
      this._aistat_url = url;
    } catch (err) {}
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    try {
      if (this._aistat_url && isAiChatEndpoint(this._aistat_url, this._aistat_method)) {
        notifyPromptSent(this._aistat_url);
      }
    } catch (err) {}
    return originalSend.apply(this, arguments);
  };

  console.log(`[AIStat] Network monitor active for ${platformId}`);
})();
