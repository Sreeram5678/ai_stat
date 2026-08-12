# Chrome Web Store Listing & Technical Specification
## AIStat — AI Usage & Prompt Quality Coach

---

## 1. Extension Overview

- **Name**: AIStat - AI Usage & Prompt Quality Coach
- **Short Description**: Track active time spent with AI, message counts across platforms, and get instant prompt quality coaching.
- **Detailed Description**:
  AIStat is a 100% private, local-first Chrome extension that transforms your daily AI interactions into actionable productivity insights.

  Instead of a basic message counter, AIStat acts as your personal AI Reflection Mirror & Prompt Quality Coach across ChatGPT, Claude, Google Gemini, DeepSeek, and Perplexity.

  ### Key Features:
  1. **Prompt Quality Coach**: Analyzes prompt depth, context, constraints, and iteration patterns on-device to help you craft high-leverage prompts that resolve in 1–2 turns.
  2. **True Active Time Tracking**: Accurately measures time spent composing and reading AI responses, ignoring idle background tabs.
  3. **Multi-Platform Analytics**: Unified daily, weekly, and monthly activity metrics across ChatGPT, Claude, Gemini, DeepSeek, and Perplexity.
  4. **Peak AI Hours Heatmap**: 24-hour visual breakdown showing what times of day you collaborate most with AI.
  5. **100% On-Device Privacy**: Zero external servers, zero tracking scripts, zero cloud telemetry. All data stays strictly in your browser's local storage.

---

## 2. Permissions Justifications

| Permission | Scope | Justification |
| :--- | :--- | :--- |
| `storage` | Browser local storage | Required to persist daily telemetry aggregations, prompt quality metrics, and user preferences locally in `chrome.storage.local`. |
| `alarms` | Background alarms | Required to periodically refresh the extension badge and update the rolling 5-hour rate limit window. |
| `https://chatgpt.com/*` | Host permission | Required to detect prompt submissions and measure active composing/reading time on ChatGPT. |
| `https://chat.openai.com/*` | Host permission | Required for legacy ChatGPT URL support. |
| `https://claude.ai/*` | Host permission | Required to detect prompt submissions, calculate prompt quality, and track the 5-hour message rolling window on Claude. |
| `https://gemini.google.com/*` | Host permission | Required to detect prompt submissions and measure active time on Google Gemini. |
| `https://chat.deepseek.com/*` | Host permission | Required to detect prompt submissions and measure active time on DeepSeek. |
| `https://www.perplexity.ai/*` | Host permission | Required to detect prompt submissions and measure active time on Perplexity. |

---

## 3. Privacy Policy & Data Use Disclosure

- **Single Purpose**: Track and coach personal AI usage and prompt quality.
- **Data Collection**: No personal identifiable information (PII), credentials, passwords, or complete chat conversations are collected or transmitted to any remote server.
- **Data Storage**: 100% local persistence via `chrome.storage.local`.
- **Third-Party Sharing**: No data is sold, transferred, or shared with third parties or advertisers.

---

## 4. Version History

- **v1.0.0** (Initial Release)
  - Multi-platform tracker for ChatGPT, Claude, Gemini, DeepSeek, and Perplexity.
  - On-device prompt quality heuristics engine (1.0 to 10.0 score scale).
  - Active composing vs. reading time measurement.
  - Interactive popup with rate-limit burn-down meter.
  - Full-screen dashboard with SVG charts, subscription ROI calculator, and CSV/JSON export.
