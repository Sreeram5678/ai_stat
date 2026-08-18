# Contributing to AIStat

Thank you for your interest in contributing to AIStat. This document outlines the guidelines and workflow for submitting contributions, reporting bugs, and proposing architectural enhancements.

---

## Code of Conduct

All contributors and maintainers are expected to maintain a professional, collaborative, and inclusive environment. Please ensure all communication remains constructive, respectful, and focused on technical excellence.

---

## Development Setup

### Prerequisites
- Google Chrome (version 114 or higher) or any Chromium-based browser supporting Manifest V3
- Git 2.30+

### Loading the Extension Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/Sreeram5678/ai_stat.git
   cd ai_stat
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the upper-right corner.
4. Click **Load unpacked** and select the root `ai_stat` project directory.
5. Verify that the AIStat extension appears in your installed extensions list and pins to the toolbar.

---

## Branching Strategy & Workflow

1. Fork the repository and create your branch from `main`.
2. Name your branch using standard prefixes:
   - `feature/<description>` for new capabilities
   - `fix/<description>` for bug resolutions
   - `docs/<description>` for documentation updates
   - `refactor/<description>` for internal code improvements
3. Ensure your commits follow the Conventional Commits specification:
   - `feat(scope): add new feature`
   - `fix(scope): resolve bug`
   - `docs(scope): update documentation`
   - `chore(scope): maintain build or tools`
4. Open a Pull Request against the `main` branch with a clear description of your changes and test coverage.

---

## Privacy and Architectural Invariants

When submitting code changes, the following core invariants must be strictly preserved:

1. **Zero Remote Telemetry**: No user prompts, chat messages, or analytics metrics may ever leave the client. All storage operations must target `chrome.storage.local`.
2. **Execution Context Isolation**: Heavy interception logic must run in the top window context only (`window.self === window.top`) to avoid duplicate event capture in embedded iframes.
3. **No External Network Dependencies**: Extension assets (scripts, styles, icons) must be self-contained within the extension bundle without relying on third-party CDNs.

---

## How to Add Support for a New AI Platform (Step-by-Step Tutorial)

Adding a new AI conversation platform is one of the most accessible and impactful ways to contribute to AIStat. The integration requires updating three files:

### Step 1: Declare Host Permissions & Match Patterns
In [`manifest.json`](./manifest.json), add the platform domain to both `host_permissions` and `content_scripts.matches`:

```json
"host_permissions": [
  "https://chat.mistral.ai/*"
],
"content_scripts": [
  {
    "matches": [
      "https://chat.mistral.ai/*"
    ],
    "js": ["content-scripts/network-interceptor.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }
]
```

### Step 2: Register Platform Taxonomy
In [`shared/constants.js`](./shared/constants.js), register the platform identifier, brand display name, and color theme tokens:

```javascript
mistral: {
  id: 'mistral',
  name: 'Mistral Le Chat',
  domainMatch: ['chat.mistral.ai'],
  color: '#f97316',
  bgLight: '#ffedd5'
}
```

### Step 3: Configure Network Interception Endpoint
In [`content-scripts/network-interceptor.js`](./content-scripts/network-interceptor.js):
1. Add domain matching inside the self-executing function:
   ```javascript
   } else if (host.includes('mistral.ai')) {
     platformId = 'mistral';
   }
   ```
2. Add the endpoint filter in `isAiChatEndpoint()`:
   ```javascript
   if (platformId === 'mistral') {
     return url.includes('/api/chat') && isPost;
   }
   ```

### Step 4: Verify and Submit
1. Reload the unpacked extension in `chrome://extensions`.
2. Navigate to the new platform, send a test prompt, and verify that the counter increments in the popup and dashboard.
3. Open a Pull Request referencing the corresponding issue.

---

## Testing Changes

Before opening a pull request:
1. Test prompt detection across all supported platforms.
2. Validate that the service worker badge updates correctly without throwing background alarm exceptions.
3. Verify that the analytics dashboard renders all time filters (Today, 7 Days, 30 Days, All-Time) without console errors.
4. Test data export (both CSV and JSON) to ensure schema consistency.

---

## Contributor Recognition

Every contributor who submits a merged pull request is credited in the project repository and release changelogs. Thank you for helping build a better, privacy-first AI telemetry tool.
