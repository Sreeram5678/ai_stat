import { describe, it, expect, vi } from 'vitest';
import {
  generateBentoSummaryCard,
  downloadSummaryCardPNG,
  copySummaryCardToClipboard
} from '../dashboard/summary-card.js';
import { analyzeWeeklyTrends } from '../shared/trend-analyzer.js';

// Mock Canvas 2D context for Node test environment
function createMockCanvas(width = 800, height = 480) {
  const operations = [];
  const ctx = {
    save: () => operations.push({ op: 'save' }),
    restore: () => operations.push({ op: 'restore' }),
    scale: (sx, sy) => operations.push({ op: 'scale', sx, sy }),
    fillRect: (x, y, w, h) => operations.push({ op: 'fillRect', x, y, w, h, fillStyle: ctx.fillStyle }),
    strokeRect: (x, y, w, h) => operations.push({ op: 'strokeRect', x, y, w, h }),
    fillText: (text, x, y) => operations.push({ op: 'fillText', text, x, y, font: ctx.font, fillStyle: ctx.fillStyle }),
    beginPath: () => operations.push({ op: 'beginPath' }),
    closePath: () => operations.push({ op: 'closePath' }),
    moveTo: (x, y) => operations.push({ op: 'moveTo', x, y }),
    lineTo: (x, y) => operations.push({ op: 'lineTo', x, y }),
    quadraticCurveTo: (cpx, cpy, x, y) => operations.push({ op: 'quadraticCurveTo', cpx, cpy, x, y }),
    arc: (x, y, r, sa, ea) => operations.push({ op: 'arc', x, y, r, sa, ea }),
    fill: () => operations.push({ op: 'fill', fillStyle: ctx.fillStyle }),
    stroke: () => operations.push({ op: 'stroke', strokeStyle: ctx.strokeStyle }),
    clip: () => operations.push({ op: 'clip' }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: (str) => ({ width: (str?.length || 0) * 8 }),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic'
  };

  return {
    width,
    height,
    style: {},
    getContext: (type) => (type === '2d' ? ctx : null),
    toDataURL: (type) => `data:${type || 'image/png'};base64,mockPngData`,
    toBlob: (cb) => {
      // Mock Blob creation callback
      const mockBlob = { size: 1024, type: 'image/png' };
      cb(mockBlob);
    },
    _operations: operations
  };
}

describe('Swiss Bento Summary Card (dashboard/summary-card.js)', () => {
  describe('generateBentoSummaryCard()', () => {
    it('renders a high-DPI canvas with Swiss Bento boxes in dark theme', () => {
      const mockCanvas = createMockCanvas();
      const mockLogs = {
        '2026-08-28': {
          messagesCount: 25,
          platforms: { chatgpt: 15, aisearch: 10 },
          hours: { '14': 20 }
        }
      };

      const result = generateBentoSummaryCard(mockLogs, {
        theme: 'dark',
        targetCanvas: mockCanvas
      });

      expect(result).toBe(mockCanvas);
      // High-DPI canvas dimensions: 1600x960 (2x scale on 800x480)
      expect(mockCanvas.width).toBe(1600);
      expect(mockCanvas.height).toBe(960);
      expect(mockCanvas.style.width).toBe('800px');
      expect(mockCanvas.style.height).toBe('480px');

      // Verify all 4 bento grid boxes and header/footer elements were drawn
      const textsDrawn = mockCanvas._operations
        .filter(op => op.op === 'fillText')
        .map(op => op.text);

      expect(textsDrawn).toContain('AIStat');
      expect(textsDrawn).toContain('WRAPPED');
      expect(textsDrawn).toContain('WEEKLY MESSAGES');
      expect(textsDrawn).toContain('PLATFORM BREAKDOWN');
      expect(textsDrawn).toContain('PRODUCTIVITY PULSE');
      expect(textsDrawn).toContain('TOKENS & COMPUTE VALUE');
    });

    it('renders cleanly in light theme', () => {
      const mockCanvas = createMockCanvas();
      const trends = analyzeWeeklyTrends({});

      const result = generateBentoSummaryCard(trends, {
        theme: 'light',
        targetCanvas: mockCanvas
      });

      expect(result).toBe(mockCanvas);
      expect(mockCanvas._operations.length).toBeGreaterThan(0);
    });

    it('exports as dataURL when format is dataURL', () => {
      const mockCanvas = createMockCanvas();
      const dataUrl = generateBentoSummaryCard({}, {
        format: 'dataURL',
        targetCanvas: mockCanvas
      });

      expect(typeof dataUrl).toBe('string');
      expect(dataUrl.startsWith('data:image/png')).toBe(true);
    });
  });

  describe('Clipboard & Download Actions', () => {
    it('copySummaryCardToClipboard returns a promise and handles clipboard resolution', async () => {
      const mockCanvas = createMockCanvas();
      const copyPromise = copySummaryCardToClipboard(mockCanvas);
      expect(copyPromise).toBeInstanceOf(Promise);
      const res = await copyPromise;
      expect(typeof res).toBe('boolean');
    });
  });
});
