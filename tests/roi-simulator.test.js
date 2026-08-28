import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateArbitrageSavings,
  registerCustomModel,
  resetModelPricing,
  calculateSubscriptionROI,
  MODEL_CATALOG,
  formatCost,
  formatTokens
} from '../shared/cost-estimator.js';
import { ROISimulator } from '../dashboard/roi-simulator.js';

describe('Model Arbitrage & ROI Simulator Suite', () => {
  beforeEach(() => {
    resetModelPricing();
    document.body.innerHTML = '<div id="roi-simulator-container"></div>';
  });

  describe('calculateArbitrageSavings()', () => {
    it('calculates savings accurately when alternative is cheaper', () => {
      // Claude Sonnet 5 ($3/$15) vs DeepSeek-V3 ($0.27/$1.10)
      const res = calculateArbitrageSavings({
        baselineModel: 'claude-sonnet-5',
        alternativeModel: 'deepseek-v3',
        monthlyPrompts: 1000,
        avgInputTokens: 800,
        avgOutputTokens: 1200
      });

      expect(res.monthlyPrompts).toBe(1000);
      expect(res.baseline.monthlyCost).toBeGreaterThan(res.alternative.monthlyCost);
      expect(res.isCheaper).toBe(true);
      expect(res.estimatedSavings).toBeGreaterThan(0);
      expect(res.savingsPercent).toBeGreaterThan(80);
      expect(res.annualSavings).toBeCloseTo(res.estimatedSavings * 12, 1);
    });

    it('handles zero monthly prompt volume safely', () => {
      const res = calculateArbitrageSavings({
        baselineModel: 'claude-sonnet-5',
        alternativeModel: 'deepseek-v3',
        monthlyPrompts: 0
      });

      expect(res.baseline.monthlyCost).toBe(0);
      expect(res.alternative.monthlyCost).toBe(0);
      expect(res.estimatedSavings).toBe(0);
      expect(res.savingsPercent).toBe(0);
    });

    it('supports custom pricing overrides', () => {
      const customPricing = {
        'custom-local-llm': {
          id: 'custom-local-llm',
          name: 'Local Ollama LLM',
          inputPricePerMillion: 0,
          outputPricePerMillion: 0
        }
      };

      const res = calculateArbitrageSavings({
        baselineModel: 'gpt-5.6',
        alternativeModel: 'custom-local-llm',
        monthlyPrompts: 500,
        customPricing
      });

      expect(res.alternative.monthlyCost).toBe(0);
      expect(res.estimatedSavings).toBe(res.baseline.monthlyCost);
      expect(res.savingsPercent).toBe(100);
    });
  });

  describe('registerCustomModel() and pricing management', () => {
    it('registers a custom user-defined model into catalog', () => {
      const custom = registerCustomModel({
        id: 'mistral-large-3',
        name: 'Mistral Large 3',
        provider: 'mistral',
        inputPricePerMillion: 2.0,
        outputPricePerMillion: 6.0
      });

      expect(custom.id).toBe('mistral-large-3');
      expect(MODEL_CATALOG['mistral-large-3']).toBeDefined();
      expect(MODEL_CATALOG['mistral-large-3'].inputPricePerMillion).toBe(2.0);

      // Reset pricing
      resetModelPricing();
      expect(MODEL_CATALOG['mistral-large-3']).toBeUndefined();
    });

    it('rejects invalid model configuration missing id', () => {
      expect(() => registerCustomModel({})).toThrow(/unique "id"/);
    });
  });

  describe('calculateSubscriptionROI() edge cases', () => {
    it('calculates ROI for profitable subscription usage', () => {
      // $50 of API value on a $20/mo ChatGPT Plus subscription
      const roi = calculateSubscriptionROI(50.0, 'chatgpt-plus');
      expect(roi.status).toBe('profitable');
      expect(roi.netSavings).toBe(30.0);
      expect(roi.roiPercentage).toBe(250);
      expect(roi.isProfitable).toBe(true);
      expect(roi.estimatedBreakEvenUsage).toBe(5000);
    });

    it('identifies under-utilized subscription where API is cheaper', () => {
      // $5 of API value on a $20/mo subscription
      const roi = calculateSubscriptionROI(5.0, 'claude-pro');
      expect(roi.status).toBe('loss');
      expect(roi.netSavings).toBe(-15.0);
      expect(roi.isProfitable).toBe(false);
    });

    it('handles exact break-even point', () => {
      const roi = calculateSubscriptionROI(20.0, 'gemini-advanced');
      expect(roi.status).toBe('breakeven');
      expect(roi.netSavings).toBe(0);
      expect(roi.isBreakEven).toBe(true);
    });

    it('handles custom subscription plan objects', () => {
      const customPlan = {
        id: 'team-plan',
        name: 'Enterprise Team Plan',
        monthlyCost: 35
      };
      const roi = calculateSubscriptionROI(70.0, customPlan);
      expect(roi.subscriptionName).toBe('Enterprise Team Plan');
      expect(roi.netSavings).toBe(35.0);
      expect(roi.roiPercentage).toBe(200);
    });
  });

  describe('ROISimulator DOM Component', () => {
    it('mounts into DOM and updates reactively on user interaction', () => {
      let changeFired = false;
      const sim = new ROISimulator({
        containerId: 'roi-simulator-container',
        onChange: () => { changeFired = true; }
      });

      sim.mount();
      expect(document.querySelector('.roi-simulator-card')).not.toBeNull();
      expect(changeFired).toBe(true);

      const slider = document.getElementById('roi-prompt-slider');
      expect(slider).not.toBeNull();

      // Simulate slider input
      slider.value = '1000';
      slider.dispatchEvent(new Event('input'));

      expect(sim.state.monthlyPrompts).toBe(1000);
      const savingsVal = document.getElementById('roi-savings-val');
      expect(savingsVal.textContent).toContain('/ mo');
    });
  });
});
