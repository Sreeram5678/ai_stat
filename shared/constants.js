/**
 * AIStat - Shared Constants
 */

export const PLATFORMS = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    domainMatch: ['chatgpt.com', 'chat.openai.com'],
    color: '#10a37f',
    bgLight: '#e6f7f2'
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    domainMatch: ['claude.ai'],
    color: '#d97706',
    bgLight: '#fef3c7'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    domainMatch: ['gemini.google.com'],
    color: '#3b82f6',
    bgLight: '#eff6ff'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    domainMatch: ['chat.deepseek.com', 'deepseek.com'],
    color: '#6366f1',
    bgLight: '#eef2ff'
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    domainMatch: ['perplexity.ai', 'www.perplexity.ai'],
    color: '#14b8a6',
    bgLight: '#ccfbf1'
  },
  aisearch: {
    id: 'aisearch',
    name: 'Google AI Search',
    domainMatch: ['google.com/search', 'google.com/aisearch'],
    color: '#4285F4',
    bgLight: '#E8F0FE'
  }
};

export const DEFAULT_SETTINGS = {
  badgeDisplay: 'message_count' // 'message_count' or 'none'
};
