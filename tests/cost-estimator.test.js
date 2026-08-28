import { describe, it, expect } from 'vitest';
import costEstimatorDefault, {
  MODEL_CATALOG,
  DEFAULT_MODELS,
  REASONING_EFFORTS,
  SUBSCRIPTION_PLANS,
  getModelConfig,
  getModelsForPlatform,
  calculateMessageTokens,
  calculateTotalCostAndTokens,
  calculateSubscriptionROI,
  formatCost,
  formatTokens
} from '../shared/cost-estimator.js';

describe('AIStat Cost & Token Estimator Engine', () => {

  describe('Model Catalog & Platform Catalog', () => {
    it('contains all required providers and models with exact pricing', () => {
      // Google Models
      expect(MODEL_CATALOG['gemini-3.7-flash']).toBeDefined();
      expect(MODEL_CATALOG['gemini-3.7-flash'].inputPricePerMillion).toBe(0.75);
      expect(MODEL_CATALOG['gemini-3.7-flash'].outputPricePerMillion).toBe(3.75);
      expect(MODEL_CATALOG['gemini-3.7-flash'].isDefault).toBe(true);

      expect(MODEL_CATALOG['gemini-3.1-pro']).toBeDefined();
      expect(MODEL_CATALOG['gemini-3.1-pro'].inputPricePerMillion).toBe(2.00);
      expect(MODEL_CATALOG['gemini-3.1-pro'].outputPricePerMillion).toBe(12.00);

      // OpenAI Models
      expect(MODEL_CATALOG['gpt-5.6']).toBeDefined();
      expect(MODEL_CATALOG['gpt-5.6'].inputPricePerMillion).toBe(2.50);
      expect(MODEL_CATALOG['gpt-5.6'].outputPricePerMillion).toBe(10.00);
      expect(MODEL_CATALOG['gpt-5.6'].isDefault).toBe(true);

      expect(MODEL_CATALOG['gpt-5.6-mini']).toBeDefined();
      expect(MODEL_CATALOG['gpt-5.6-mini'].inputPricePerMillion).toBe(0.25);
      expect(MODEL_CATALOG['gpt-5.6-mini'].outputPricePerMillion).toBe(1.20);

      expect(MODEL_CATALOG['o3']).toBeDefined();
      expect(MODEL_CATALOG['o3'].inputPricePerMillion).toBe(2.00);
      expect(MODEL_CATALOG['o3'].outputPricePerMillion).toBe(8.00);

      expect(MODEL_CATALOG['o3-mini']).toBeDefined();
      expect(MODEL_CATALOG['o3-mini'].inputPricePerMillion).toBe(1.10);
      expect(MODEL_CATALOG['o3-mini'].outputPricePerMillion).toBe(4.40);

      // Anthropic Models
      expect(MODEL_CATALOG['claude-sonnet-5']).toBeDefined();
      expect(MODEL_CATALOG['claude-sonnet-5'].inputPricePerMillion).toBe(3.00);
      expect(MODEL_CATALOG['claude-sonnet-5'].outputPricePerMillion).toBe(15.00);
      expect(MODEL_CATALOG['claude-sonnet-5'].isDefault).toBe(true);

      expect(MODEL_CATALOG['claude-fable-5']).toBeDefined();
      expect(MODEL_CATALOG['claude-fable-5'].inputPricePerMillion).toBe(1.50);
      expect(MODEL_CATALOG['claude-fable-5'].outputPricePerMillion).toBe(7.50);

      expect(MODEL_CATALOG['claude-3.7-sonnet']).toBeDefined();
      expect(MODEL_CATALOG['claude-3.7-sonnet'].inputPricePerMillion).toBe(3.00);
      expect(MODEL_CATALOG['claude-3.7-sonnet'].outputPricePerMillion).toBe(15.00);

      // DeepSeek Models
      expect(MODEL_CATALOG['deepseek-v3']).toBeDefined();
      expect(MODEL_CATALOG['deepseek-v3'].inputPricePerMillion).toBe(0.27);
      expect(MODEL_CATALOG['deepseek-v3'].outputPricePerMillion).toBe(1.10);
      expect(MODEL_CATALOG['deepseek-v3'].isDefault).toBe(true);

      expect(MODEL_CATALOG['deepseek-r1']).toBeDefined();
      expect(MODEL_CATALOG['deepseek-r1'].inputPricePerMillion).toBe(0.55);
      expect(MODEL_CATALOG['deepseek-r1'].outputPricePerMillion).toBe(2.19);

      expect(MODEL_CATALOG['deepseek-coder-v2']).toBeDefined();
      expect(MODEL_CATALOG['deepseek-coder-v2'].inputPricePerMillion).toBe(0.14);
      expect(MODEL_CATALOG['deepseek-coder-v2'].outputPricePerMillion).toBe(0.28);

      expect(MODEL_CATALOG['deepseek-math-7b']).toBeDefined();
      expect(MODEL_CATALOG['deepseek-math-7b'].inputPricePerMillion).toBe(0.10);
      expect(MODEL_CATALOG['deepseek-math-7b'].outputPricePerMillion).toBe(0.20);

      expect(MODEL_CATALOG['deepseek-vl2']).toBeDefined();
      expect(MODEL_CATALOG['deepseek-vl2'].inputPricePerMillion).toBe(0.20);
      expect(MODEL_CATALOG['deepseek-vl2'].outputPricePerMillion).toBe(0.40);

      // Perplexity Models
      expect(MODEL_CATALOG['sonar-pro']).toBeDefined();
      expect(MODEL_CATALOG['sonar-pro'].inputPricePerMillion).toBe(3.00);
      expect(MODEL_CATALOG['sonar-pro'].outputPricePerMillion).toBe(15.00);
      expect(MODEL_CATALOG['sonar-pro'].isDefault).toBe(true);

      expect(MODEL_CATALOG['sonar-2']).toBeDefined();
      expect(MODEL_CATALOG['sonar-2'].inputPricePerMillion).toBe(1.00);
      expect(MODEL_CATALOG['sonar-2'].outputPricePerMillion).toBe(3.00);

      expect(MODEL_CATALOG['sonar-deep-research']).toBeDefined();
      expect(MODEL_CATALOG['sonar-deep-research'].inputPricePerMillion).toBe(5.00);
      expect(MODEL_CATALOG['sonar-deep-research'].outputPricePerMillion).toBe(25.00);

      // Google AI Search / AI Mode
      expect(MODEL_CATALOG['google-ai-search']).toBeDefined();
      expect(MODEL_CATALOG['google-ai-search'].inputPricePerMillion).toBe(0.50);
      expect(MODEL_CATALOG['google-ai-search'].outputPricePerMillion).toBe(2.00);
    });

    it('maps default models correctly for each platform', () => {
      expect(DEFAULT_MODELS.gemini).toBe('gemini-3.7-flash');
      expect(DEFAULT_MODELS.chatgpt).toBe('gpt-5.6');
      expect(DEFAULT_MODELS.claude).toBe('claude-sonnet-5');
      expect(DEFAULT_MODELS.deepseek).toBe('deepseek-v3');
      expect(DEFAULT_MODELS.perplexity).toBe('sonar-pro');
      expect(DEFAULT_MODELS['google-ai-search']).toBe('google-ai-search');
    });

    it('retrieves model configuration and platform lists correctly', () => {
      const gpt = getModelConfig('chatgpt', 'gpt-5.6');
      expect(gpt.id).toBe('gpt-5.6');
      expect(gpt.provider).toBe('chatgpt');

      const claudeDefault = getModelConfig('claude');
      expect(claudeDefault.id).toBe('claude-sonnet-5');

      const unknownDefault = getModelConfig('unknown-provider');
      expect(unknownDefault).toBeDefined();

      const deepseekList = getModelsForPlatform('deepseek');
      expect(deepseekList.length).toBe(5);
      expect(deepseekList.map(m => m.id)).toContain('deepseek-v3');
      expect(deepseekList.map(m => m.id)).toContain('deepseek-r1');

      const allModels = getModelsForPlatform(null);
      expect(allModels.length).toBe(Object.keys(MODEL_CATALOG).length);
    });

    it('exports all utilities via default export', () => {
      expect(costEstimatorDefault.MODEL_CATALOG).toBeDefined();
      expect(costEstimatorDefault.calculateMessageTokens).toBeTypeOf('function');
      expect(costEstimatorDefault.calculateTotalCostAndTokens).toBeTypeOf('function');
      expect(costEstimatorDefault.calculateSubscriptionROI).toBeTypeOf('function');
      expect(costEstimatorDefault.formatCost).toBeTypeOf('function');
      expect(costEstimatorDefault.formatTokens).toBeTypeOf('function');
    });
  });

  describe('Reasoning Effort Configurations', () => {
    it('defines accurate token ratios for low, medium, and high efforts', () => {
      // Low effort: standard direct answer (~400 in, ~350 out, 0 reasoning tokens)
      expect(REASONING_EFFORTS.low.inputTokens).toBe(400);
      expect(REASONING_EFFORTS.low.outputTokens).toBe(350);
      expect(REASONING_EFFORTS.low.reasoningTokens).toBe(0);
      expect(REASONING_EFFORTS.low.totalOutputTokens).toBe(350);
      expect(REASONING_EFFORTS.low.totalTokens).toBe(750);

      // Medium effort: balanced thinking (~800 in, ~600 out + 600 reasoning = 1,200 out)
      expect(REASONING_EFFORTS.medium.inputTokens).toBe(800);
      expect(REASONING_EFFORTS.medium.outputTokens).toBe(600);
      expect(REASONING_EFFORTS.medium.reasoningTokens).toBe(600);
      expect(REASONING_EFFORTS.medium.totalOutputTokens).toBe(1200);
      expect(REASONING_EFFORTS.medium.totalTokens).toBe(2000);

      // High effort: deep research / complex coding (~1,500 in, ~1,000 out + 2,500 reasoning = 3,500 out)
      expect(REASONING_EFFORTS.high.inputTokens).toBe(1500);
      expect(REASONING_EFFORTS.high.outputTokens).toBe(1000);
      expect(REASONING_EFFORTS.high.reasoningTokens).toBe(2500);
      expect(REASONING_EFFORTS.high.totalOutputTokens).toBe(3500);
      expect(REASONING_EFFORTS.high.totalTokens).toBe(5000);
    });
  });

  describe('calculateMessageTokens Computation', () => {
    it('computes exact tokens and costs for low effort', () => {
      // 1,000 messages on GPT-5.6 ($2.50 in, $10.00 out)
      // Low effort: 400 in, 350 out (0 reasoning)
      // Total in: 400,000 tokens -> (400,000 / 1,000,000) * 2.50 = $1.00
      // Total out: 350,000 tokens -> (350,000 / 1,000,000) * 10.00 = $3.50
      // Total cost = $4.50
      const result = calculateMessageTokens(1000, 'chatgpt', 'gpt-5.6', 'low');

      expect(result.messageCount).toBe(1000);
      expect(result.inputTokens).toBe(400000);
      expect(result.outputTokens).toBe(350000);
      expect(result.reasoningTokens).toBe(0);
      expect(result.totalOutputTokens).toBe(350000);
      expect(result.totalTokens).toBe(750000);
      expect(result.inputCost).toBe(1.00);
      expect(result.outputCost).toBe(3.50);
      expect(result.totalCost).toBe(4.50);
      expect(result.formattedCost).toBe('$4.50');
      expect(result.formattedTokens).toBe('750K');
    });

    it('computes exact tokens and costs for medium effort', () => {
      // 1,000 messages on Gemini 3.7 Flash ($0.75 in, $3.75 out)
      // Medium effort: 800 in, 600 regular out + 600 reasoning out = 1,200 out
      // Total in: 800,000 tokens -> 0.8 * 0.75 = $0.60
      // Total out: 1,200,000 tokens -> 1.2 * 3.75 = $4.50
      // Total cost = $5.10
      const result = calculateMessageTokens(1000, 'gemini', 'gemini-3.7-flash', 'medium');

      expect(result.inputTokens).toBe(800000);
      expect(result.outputTokens).toBe(600000);
      expect(result.reasoningTokens).toBe(600000);
      expect(result.totalOutputTokens).toBe(1200000);
      expect(result.totalTokens).toBe(2000000);
      expect(result.inputCost).toBe(0.60);
      expect(result.outputCost).toBe(4.50);
      expect(result.totalCost).toBe(5.10);
      expect(result.formattedCost).toBe('$5.10');
      expect(result.formattedTokens).toBe('2M');
    });

    it('computes exact tokens and costs for high effort', () => {
      // 500 messages on Claude Sonnet 5 ($3.00 in, $15.00 out)
      // High effort: 1,500 in, 1,000 out + 2,500 reasoning = 3,500 total out
      // Total in: 500 * 1,500 = 750,000 tokens -> 0.75 * $3.00 = $2.25
      // Total out: 500 * 3,500 = 1,750,000 tokens -> 1.75 * $15.00 = $26.25
      // Total cost = $28.50
      const result = calculateMessageTokens(500, 'claude', 'claude-sonnet-5', 'high');

      expect(result.inputTokens).toBe(750000);
      expect(result.outputTokens).toBe(500000);
      expect(result.reasoningTokens).toBe(1250000);
      expect(result.totalOutputTokens).toBe(1750000);
      expect(result.totalTokens).toBe(2500000);
      expect(result.inputCost).toBe(2.25);
      expect(result.outputCost).toBe(26.25);
      expect(result.totalCost).toBe(28.50);
      expect(result.formattedCost).toBe('$28.50');
      expect(result.formattedTokens).toBe('2.5M');
    });

    it('computes across all model families accurately', () => {
      // DeepSeek-V3 ($0.27 in / $1.10 out)
      const ds = calculateMessageTokens(1000, 'deepseek', 'deepseek-v3', 'low');
      expect(ds.inputCost).toBeCloseTo(0.108, 3);
      expect(ds.outputCost).toBeCloseTo(0.385, 3);
      expect(ds.totalCost).toBeCloseTo(0.493, 3);

      // Perplexity Sonar Pro ($3.00 in / $15.00 out)
      const px = calculateMessageTokens(100, 'perplexity', 'sonar-pro', 'low');
      expect(px.totalTokens).toBe(75000);
      expect(px.totalCost).toBeCloseTo(0.645, 3);

      // Google AI Search ($0.50 in / $2.00 out)
      const gSearch = calculateMessageTokens(100, 'google-ai-search', 'google-ai-search', 'low');
      expect(gSearch.inputCost).toBeCloseTo(0.02, 2);
      expect(gSearch.outputCost).toBeCloseTo(0.07, 2);
      expect(gSearch.totalCost).toBeCloseTo(0.09, 2);
    });

    it('handles zero, negative, NaN, null, and extreme message counts gracefully', () => {
      // Zero messages
      const zero = calculateMessageTokens(0, 'chatgpt');
      expect(zero.messageCount).toBe(0);
      expect(zero.totalTokens).toBe(0);
      expect(zero.totalCost).toBe(0);
      expect(zero.formattedCost).toBe('$0.00');
      expect(zero.formattedTokens).toBe('0');

      // Negative count
      const negative = calculateMessageTokens(-50, 'claude');
      expect(negative.messageCount).toBe(0);
      expect(negative.totalTokens).toBe(0);
      expect(negative.totalCost).toBe(0);

      // NaN / null / undefined
      expect(calculateMessageTokens(NaN, 'gemini').messageCount).toBe(0);
      expect(calculateMessageTokens(null, 'gemini').messageCount).toBe(0);
      expect(calculateMessageTokens(undefined, 'gemini').messageCount).toBe(0);

      // Extreme counts (1,000,000 messages)
      const extreme = calculateMessageTokens(1_000_000, 'chatgpt', 'gpt-5.6-mini', 'low');
      expect(extreme.totalTokens).toBe(750_000_000);
      expect(extreme.formattedTokens).toBe('750M');
      expect(extreme.totalCost).toBeGreaterThan(0);
    });
  });

  describe('Subscription ROI Modeling', () => {
    it('calculates exact ROI and net savings ($20 plan vs $35 API value = 175% ROI)', () => {
      const roi = calculateSubscriptionROI(35, 'chatgpt-plus');

      expect(roi.apiEquivalentCost).toBe(35);
      expect(roi.subscriptionCost).toBe(20);
      expect(roi.netSavings).toBe(15);
      expect(roi.isProfitable).toBe(true);
      expect(roi.isBreakEven).toBe(true);
      expect(roi.roiPercentage).toBe(175);
      expect(roi.savingsPercentage).toBe(75);
      expect(roi.formattedRoi).toBe('175%');
      expect(roi.formattedSavings).toBe('$15.00');
      expect(roi.status).toBe('profitable');
    });

    it('handles break-even, loss, free tier, and custom subscriptions correctly', () => {
      // Break-even: $20 API value on $20 plan -> 100% ROI, $0 net savings
      const breakeven = calculateSubscriptionROI(20, 'claude-pro');
      expect(breakeven.roiPercentage).toBe(100);
      expect(breakeven.netSavings).toBe(0);
      expect(breakeven.isBreakEven).toBe(true);
      expect(breakeven.isProfitable).toBe(false);
      expect(breakeven.status).toBe('breakeven');

      // Loss: $10 API value on $20 plan -> 50% ROI, -$10 net savings
      const loss = calculateSubscriptionROI(10, 'gemini-advanced');
      expect(loss.roiPercentage).toBe(50);
      expect(loss.netSavings).toBe(-10);
      expect(loss.isBreakEven).toBe(false);
      expect(loss.isProfitable).toBe(false);
      expect(loss.status).toBe('loss');

      // Free tier ($0 plan, $25 API value)
      const free = calculateSubscriptionROI(25, 'free');
      expect(free.subscriptionCost).toBe(0);
      expect(free.netSavings).toBe(25);
      expect(free.status).toBe('free_tier');

      // Free tier with $0 API value
      const zeroFree = calculateSubscriptionROI(0, 'free');
      expect(zeroFree.roiPercentage).toBe(0);
      expect(zeroFree.formattedRoi).toBe('0%');

      // Custom monthly cost ($15/mo)
      const custom = calculateSubscriptionROI(30, 'custom', 15);
      expect(custom.subscriptionCost).toBe(15);
      expect(custom.roiPercentage).toBe(200);
      expect(custom.netSavings).toBe(15);
      expect(custom.status).toBe('profitable');

      // Object subscription configuration
      const subObj = calculateSubscriptionROI(50, { id: 'team', name: 'Team Plan', monthlyCost: 25 });
      expect(subObj.subscriptionCost).toBe(25);
      expect(subObj.roiPercentage).toBe(200);

      // String unrecognized plan
      const unk = calculateSubscriptionROI(30, 'unknown-plan');
      expect(unk.subscriptionCost).toBe(0);
    });
  });

  describe('calculateTotalCostAndTokens Aggregation', () => {
    it('aggregates daily logs accurately across platforms and periods', () => {
      const today = new Date();
      const d1 = new Date(today);
      d1.setDate(today.getDate() - 1);
      const d1Str = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}-${String(d1.getDate()).padStart(2, '0')}`;
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const dailyLogs = {
        [d1Str]: {
          messagesCount: 150,
          platforms: {
            chatgpt: 100,
            claude: 50
          }
        },
        [todayStr]: {
          messagesCount: 200,
          platforms: {
            chatgpt: 100,
            gemini: 100
          }
        }
      };

      const modelSelections = {
        chatgpt: 'gpt-5.6',
        claude: 'claude-sonnet-5',
        gemini: 'gemini-3.7-flash'
      };

      const result = calculateTotalCostAndTokens(
        dailyLogs,
        7,
        modelSelections,
        'low',
        'chatgpt-plus'
      );

      expect(result.totalMessages).toBe(350);
      expect(result.platforms.chatgpt.messageCount).toBe(200);
      expect(result.platforms.claude.messageCount).toBe(50);
      expect(result.platforms.gemini.messageCount).toBe(100);

      // Total tokens: 350 * 750 (low effort) = 262,500
      expect(result.totalTokens).toBe(262500);
      expect(result.formattedTokens).toBe('262.5K');
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.roi).toBeDefined();
      expect(result.roi.subscriptionCost).toBe(20);
    });

    it('handles fallback when day.platforms is missing', () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const logs = {
        [todayStr]: {
          messagesCount: 20
        }
      };

      const result = calculateTotalCostAndTokens(logs, 7);
      expect(result.totalMessages).toBe(20);
      expect(result.platforms.chatgpt.messageCount).toBe(20);
    });

    it('handles empty or null dailyLogs gracefully', () => {
      const result = calculateTotalCostAndTokens(null);
      expect(result.totalMessages).toBe(0);
      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  describe('Formatting Utilities', () => {
    it('formatCost formats various price points accurately', () => {
      expect(formatCost(12.45)).toBe('$12.45');
      expect(formatCost(0.04)).toBe('$0.04');
      expect(formatCost(0.004)).toBe('<$0.01');
      expect(formatCost(0.0001)).toBe('<$0.01');
      expect(formatCost(0)).toBe('$0.00');
      expect(formatCost(-10)).toBe('$0.00');
      expect(formatCost(null)).toBe('$0.00');
      expect(formatCost(undefined)).toBe('$0.00');
      expect(formatCost(1234.56)).toBe('$1,234.56');
    });

    it('formatTokens formats small, medium, large, and zero token counts', () => {
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(-500)).toBe('0');
      expect(formatTokens(null)).toBe('0');
      expect(formatTokens(850)).toBe('850');
      expect(formatTokens(24500)).toBe('24.5K');
      expect(formatTokens(24000)).toBe('24K');
      expect(formatTokens(450000)).toBe('450K');
      expect(formatTokens(1200000)).toBe('1.2M');
      expect(formatTokens(1000000)).toBe('1M');
      expect(formatTokens(1000000000)).toBe('1B');
      expect(formatTokens(1500000000)).toBe('1.5B');
    });
  });

});
