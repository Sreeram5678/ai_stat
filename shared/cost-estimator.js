/**
 * AIStat - Estimated Token, Cost & Arbitrage Simulator Engine
 * Normalized multi-provider model catalog, custom pricing overrides, arbitrage calculator,
 * reasoning effort calibration, and subscription ROI modeling.
 */

export const PRICING_SCHEMA_VERSION = 1;

// ── Standard Multi-Provider Model Catalog ─────────────────────
export const DEFAULT_MODEL_CATALOG = {
  // Google
  'gemini-3.7-flash': {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'gemini',
    providerName: 'Google',
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 3.75,
    currency: 'USD',
    effectiveDate: '2025-02-01',
    source: 'Google Cloud Pricing',
    isDefault: true,
    isCustom: false
  },
  'gemini-3.1-pro': {
    id: 'gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'gemini',
    providerName: 'Google',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 12.00,
    currency: 'USD',
    effectiveDate: '2025-02-01',
    source: 'Google Cloud Pricing',
    isDefault: false,
    isCustom: false
  },

  // OpenAI
  'gpt-5.6': {
    id: 'gpt-5.6',
    name: 'GPT-5.6',
    provider: 'chatgpt',
    providerName: 'OpenAI',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    currency: 'USD',
    effectiveDate: '2025-01-15',
    source: 'OpenAI API Pricing',
    isDefault: true,
    isCustom: false
  },
  'gpt-5.6-mini': {
    id: 'gpt-5.6-mini',
    name: 'GPT-5.6 Mini',
    provider: 'chatgpt',
    providerName: 'OpenAI',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.20,
    currency: 'USD',
    effectiveDate: '2025-01-15',
    source: 'OpenAI API Pricing',
    isDefault: false,
    isCustom: false
  },
  'o3': {
    id: 'o3',
    name: 'o3',
    provider: 'chatgpt',
    providerName: 'OpenAI',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 8.00,
    currency: 'USD',
    effectiveDate: '2025-01-15',
    source: 'OpenAI API Pricing',
    isDefault: false,
    isCustom: false
  },
  'o3-mini': {
    id: 'o3-mini',
    name: 'o3-mini',
    provider: 'chatgpt',
    providerName: 'OpenAI',
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    currency: 'USD',
    effectiveDate: '2025-01-15',
    source: 'OpenAI API Pricing',
    isDefault: false,
    isCustom: false
  },

  // Anthropic
  'claude-sonnet-5': {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'claude',
    providerName: 'Anthropic',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    currency: 'USD',
    effectiveDate: '2025-02-01',
    source: 'Anthropic API Pricing',
    isDefault: true,
    isCustom: false
  },
  'claude-fable-5': {
    id: 'claude-fable-5',
    name: 'Claude Fable 5',
    provider: 'claude',
    providerName: 'Anthropic',
    inputPricePerMillion: 1.50,
    outputPricePerMillion: 7.50,
    currency: 'USD',
    effectiveDate: '2025-02-01',
    source: 'Anthropic API Pricing',
    isDefault: false,
    isCustom: false
  },
  'claude-3.7-sonnet': {
    id: 'claude-3.7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'claude',
    providerName: 'Anthropic',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'Anthropic API Pricing',
    isDefault: false,
    isCustom: false
  },

  // DeepSeek
  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    inputPricePerMillion: 0.27,
    outputPricePerMillion: 1.10,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'DeepSeek Open Platform',
    isDefault: true,
    isCustom: false
  },
  'deepseek-r1': {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'DeepSeek Open Platform',
    isDefault: false,
    isCustom: false
  },
  'deepseek-coder-v2': {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'DeepSeek Open Platform',
    isDefault: false,
    isCustom: false
  },
  'deepseek-math-7b': {
    id: 'deepseek-math-7b',
    name: 'DeepSeek Math 7B',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.20,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'DeepSeek Open Platform',
    isDefault: false,
    isCustom: false
  },
  'deepseek-vl2': {
    id: 'deepseek-vl2',
    name: 'DeepSeek-VL2',
    provider: 'deepseek',
    providerName: 'DeepSeek',
    inputPricePerMillion: 0.20,
    outputPricePerMillion: 0.40,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'DeepSeek Open Platform',
    isDefault: false,
    isCustom: false
  },

  // Perplexity
  'sonar-pro': {
    id: 'sonar-pro',
    name: 'Sonar Pro',
    provider: 'perplexity',
    providerName: 'Perplexity',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'Perplexity API',
    isDefault: true,
    isCustom: false
  },
  'sonar-2': {
    id: 'sonar-2',
    name: 'Sonar 2',
    provider: 'perplexity',
    providerName: 'Perplexity',
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 3.00,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'Perplexity API',
    isDefault: false,
    isCustom: false
  },
  'sonar-deep-research': {
    id: 'sonar-deep-research',
    name: 'Sonar Deep Research',
    provider: 'perplexity',
    providerName: 'Perplexity',
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 25.00,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'Perplexity API',
    isDefault: false,
    isCustom: false
  },

  // Google AI Search
  'google-ai-search': {
    id: 'google-ai-search',
    name: 'Google AI Search / AI Mode',
    provider: 'aisearch',
    providerName: 'Google',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 2.00,
    currency: 'USD',
    effectiveDate: '2025-01-01',
    source: 'Estimated Query Equivalent',
    isDefault: true,
    isCustom: false
  }
};

// Active mutable catalog with custom user overrides
export let MODEL_CATALOG = { ...DEFAULT_MODEL_CATALOG };

// ── Default Model by Platform ─────────────────────────────────
export const DEFAULT_MODELS = {
  gemini: 'gemini-3.7-flash',
  chatgpt: 'gpt-5.6',
  claude: 'claude-sonnet-5',
  deepseek: 'deepseek-v3',
  perplexity: 'sonar-pro',
  aisearch: 'google-ai-search',
  'google-ai-search': 'google-ai-search'
};

// ── Reasoning Effort Configurations ───────────────────────────
export const REASONING_EFFORTS = {
  low: {
    id: 'low',
    name: 'Low (Direct Answer)',
    description: 'Standard direct answer (~400 in, ~350 out, 0 reasoning tokens)',
    inputTokens: 400,
    outputTokens: 350,
    reasoningTokens: 0,
    totalOutputTokens: 350,
    totalTokens: 750
  },
  medium: {
    id: 'medium',
    name: 'Medium (Balanced Thinking)',
    description: 'Balanced thinking (~800 in, ~600 out + 600 reasoning = 1,200 out)',
    inputTokens: 800,
    outputTokens: 600,
    reasoningTokens: 600,
    totalOutputTokens: 1200,
    totalTokens: 2000
  },
  high: {
    id: 'high',
    name: 'High (Deep Research / Coding)',
    description: 'Deep research / complex coding (~1,500 in, ~1,000 out + 2,500 reasoning = 3,500 out)',
    inputTokens: 1500,
    outputTokens: 1000,
    reasoningTokens: 2500,
    totalOutputTokens: 3500,
    totalTokens: 5000
  }
};

// ── Common Subscription Plans & Tiers ─────────────────────────
export const SUBSCRIPTION_PLANS = {
  'free': {
    id: 'free',
    name: 'Free Tier / Pay-As-You-Go',
    monthlyCost: 0,
    platform: null
  },
  'chatgpt-plus': {
    id: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    monthlyCost: 20,
    platform: 'chatgpt'
  },
  'chatgpt-pro': {
    id: 'chatgpt-pro',
    name: 'ChatGPT Pro',
    monthlyCost: 200,
    platform: 'chatgpt'
  },
  'claude-pro': {
    id: 'claude-pro',
    name: 'Claude Pro',
    monthlyCost: 20,
    platform: 'claude'
  },
  'gemini-advanced': {
    id: 'gemini-advanced',
    name: 'Gemini Advanced (Google One AI)',
    monthlyCost: 20,
    platform: 'gemini'
  },
  'perplexity-pro': {
    id: 'perplexity-pro',
    name: 'Perplexity Pro',
    monthlyCost: 20,
    platform: 'perplexity'
  },
  'deepseek-api': {
    id: 'deepseek-api',
    name: 'DeepSeek Pay-as-you-go',
    monthlyCost: 0,
    platform: 'deepseek'
  }
};

/**
 * Registers or overrides a model pricing configuration.
 *
 * @param {object} modelConfig Normalized pricing object
 * @returns {object} Registered model configuration
 */
export function registerCustomModel(modelConfig = {}) {
  if (!modelConfig || !modelConfig.id) {
    throw new Error('Model configuration must include a unique "id"');
  }

  const modelId = String(modelConfig.id).trim();
  const normalized = {
    id: modelId,
    name: modelConfig.name || modelId,
    provider: modelConfig.provider || 'custom',
    providerName: modelConfig.providerName || 'Custom Provider',
    inputPricePerMillion: Math.max(0, Number(modelConfig.inputPricePerMillion) || 0),
    outputPricePerMillion: Math.max(0, Number(modelConfig.outputPricePerMillion) || 0),
    currency: modelConfig.currency || 'USD',
    effectiveDate: modelConfig.effectiveDate || new Date().toISOString().slice(0, 10),
    source: modelConfig.source || 'User Custom Override',
    isDefault: false,
    isCustom: true
  };

  MODEL_CATALOG[modelId] = normalized;
  return normalized;
}

/**
 * Resets all model pricing to standard defaults.
 */
export function resetModelPricing() {
  MODEL_CATALOG = { ...DEFAULT_MODEL_CATALOG };
  return MODEL_CATALOG;
}

/**
 * Helper to retrieve a model configuration object.
 */
export function getModelConfig(platformId, modelKey) {
  if (modelKey && MODEL_CATALOG[modelKey]) {
    return MODEL_CATALOG[modelKey];
  }
  if (platformId && DEFAULT_MODELS[platformId] && MODEL_CATALOG[DEFAULT_MODELS[platformId]]) {
    return MODEL_CATALOG[DEFAULT_MODELS[platformId]];
  }
  return MODEL_CATALOG['gemini-3.7-flash'] || Object.values(MODEL_CATALOG)[0];
}

/**
 * Returns an array of available models for a given platform.
 */
export function getModelsForPlatform(platformId) {
  if (!platformId) return Object.values(MODEL_CATALOG);
  const cleanId = platformId === 'aisearch' ? 'aisearch' : platformId;
  return Object.values(MODEL_CATALOG).filter(m => m.provider === cleanId || (cleanId === 'aisearch' && m.id === 'google-ai-search'));
}

/**
 * Calculates token counts and estimated API equivalent cost for a given message count.
 *
 * @param {number} messageCount Number of user messages/prompts
 * @param {string} platformId Platform identifier ('chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity', 'aisearch')
 * @param {string} [modelKey] Specific model ID (e.g. 'gpt-5.6', 'claude-sonnet-5')
 * @param {string} [reasoningEffort='low'] 'low' | 'medium' | 'high'
 * @returns {object} Token breakdown, costs, and formatted values
 */
export function calculateMessageTokens(messageCount, platformId, modelKey, reasoningEffort = 'low') {
  const count = typeof messageCount === 'number' && !isNaN(messageCount) ? Math.max(0, Math.floor(messageCount)) : 0;
  const model = getModelConfig(platformId, modelKey);
  const effort = REASONING_EFFORTS[reasoningEffort] || REASONING_EFFORTS.low;

  const inputTokens = count * effort.inputTokens;
  const outputTokens = count * effort.outputTokens;
  const reasoningTokens = count * effort.reasoningTokens;
  const totalOutputTokens = outputTokens + reasoningTokens;
  const totalTokens = inputTokens + totalOutputTokens;

  // Cost calculation: (tokens / 1,000,000) * pricePerMillion
  const inputCost = Number(((inputTokens / 1_000_000) * model.inputPricePerMillion).toFixed(6));
  const outputCost = Number(((totalOutputTokens / 1_000_000) * model.outputPricePerMillion).toFixed(6));
  const totalCost = Number((inputCost + outputCost).toFixed(6));

  return {
    messageCount: count,
    platformId: platformId || model.provider,
    modelKey: model.id,
    modelName: model.name,
    reasoningEffort: effort.id,
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalOutputTokens,
    totalTokens,
    inputCost,
    outputCost,
    totalCost,
    formattedTokens: formatTokens(totalTokens),
    formattedCost: formatCost(totalCost)
  };
}

/**
 * Arbitrage / Model Savings Calculator.
 * Compares the cost of running a prompt workload on a baseline model vs an alternative model.
 *
 * @param {object} params
 * @param {string} params.baselineModel Model key for baseline (e.g. 'claude-sonnet-5')
 * @param {string} params.alternativeModel Model key for alternative (e.g. 'deepseek-v3')
 * @param {number} [params.monthlyPrompts=500] Estimated monthly prompt volume
 * @param {number} [params.avgInputTokens] Custom average input tokens per prompt (optional)
 * @param {number} [params.avgOutputTokens] Custom average output tokens per prompt (optional)
 * @param {string} [params.reasoningEffort='medium'] 'low' | 'medium' | 'high'
 * @param {object} [params.customPricing] Optional pricing override map
 * @returns {object} Arbitrage metrics including savings, percentage, and annual projections
 */
export function calculateArbitrageSavings({
  baselineModel = 'claude-sonnet-5',
  alternativeModel = 'deepseek-v3',
  monthlyPrompts = 500,
  avgInputTokens,
  avgOutputTokens,
  reasoningEffort = 'medium',
  customPricing = {}
} = {}) {
  const prompts = Math.max(0, parseInt(monthlyPrompts, 10) || 0);
  const effort = REASONING_EFFORTS[reasoningEffort] || REASONING_EFFORTS.medium;

  const inTokens = typeof avgInputTokens === 'number' && avgInputTokens >= 0 ? avgInputTokens : effort.inputTokens;
  const outTokens = typeof avgOutputTokens === 'number' && avgOutputTokens >= 0 ? avgOutputTokens : effort.totalOutputTokens;

  const totalInTokens = prompts * inTokens;
  const totalOutTokens = prompts * outTokens;
  const totalTokens = totalInTokens + totalOutTokens;

  const baseConfig = customPricing[baselineModel] || getModelConfig(null, baselineModel);
  const altConfig = customPricing[alternativeModel] || getModelConfig(null, alternativeModel);

  const baselineInputCost = (totalInTokens / 1_000_000) * baseConfig.inputPricePerMillion;
  const baselineOutputCost = (totalOutTokens / 1_000_000) * baseConfig.outputPricePerMillion;
  const baselineCost = Number((baselineInputCost + baselineOutputCost).toFixed(2));

  const altInputCost = (totalInTokens / 1_000_000) * altConfig.inputPricePerMillion;
  const altOutputCost = (totalOutTokens / 1_000_000) * altConfig.outputPricePerMillion;
  const alternativeCost = Number((altInputCost + altOutputCost).toFixed(2));

  const estimatedSavings = Number((baselineCost - alternativeCost).toFixed(2));
  const annualSavings = Number((estimatedSavings * 12).toFixed(2));

  let savingsPercent = 0;
  if (baselineCost > 0) {
    savingsPercent = Number(((estimatedSavings / baselineCost) * 100).toFixed(1));
  } else if (baselineCost === 0 && alternativeCost === 0) {
    savingsPercent = 0;
  } else if (baselineCost === 0 && alternativeCost > 0) {
    savingsPercent = -100;
  }

  const isCheaper = estimatedSavings > 0;
  const costRatio = alternativeCost > 0 ? Number((baselineCost / alternativeCost).toFixed(2)) : (baselineCost > 0 ? Infinity : 1);

  return {
    monthlyPrompts: prompts,
    baseline: {
      modelId: baseConfig.id,
      name: baseConfig.name,
      provider: baseConfig.providerName || baseConfig.provider,
      inputPrice: baseConfig.inputPricePerMillion,
      outputPrice: baseConfig.outputPricePerMillion,
      monthlyCost: baselineCost,
      annualCost: Number((baselineCost * 12).toFixed(2)),
      formattedCost: formatCost(baselineCost)
    },
    alternative: {
      modelId: altConfig.id,
      name: altConfig.name,
      provider: altConfig.providerName || altConfig.provider,
      inputPrice: altConfig.inputPricePerMillion,
      outputPrice: altConfig.outputPricePerMillion,
      monthlyCost: alternativeCost,
      annualCost: Number((alternativeCost * 12).toFixed(2)),
      formattedCost: formatCost(alternativeCost)
    },
    tokens: {
      avgInputPerPrompt: inTokens,
      avgOutputPerPrompt: outTokens,
      totalMonthlyTokens: totalTokens,
      formattedTokens: formatTokens(totalTokens)
    },
    estimatedSavings,
    annualSavings,
    savingsPercent,
    isCheaper,
    costRatio,
    formattedSavings: formatCost(Math.abs(estimatedSavings)),
    formattedAnnualSavings: formatCost(Math.abs(annualSavings))
  };
}

/**
 * Calculates aggregated cost and token metrics across daily logs for a given period.
 *
 * @param {object} dailyLogs Map of daily telemetry records { 'YYYY-MM-DD': { messagesCount, platforms: { ... } } }
 * @param {number|string} [periodDays=30] 7, 30, 90, or 'all'
 * @param {object} [modelSelections={}] Map of selected model keys per platform { [platformId]: modelKey }
 * @param {string} [reasoningEffort='low'] 'low' | 'medium' | 'high'
 * @param {string|object} [activeSubscription='free'] Subscription identifier or object { type, monthlyCost }
 * @returns {object} Aggregated token & cost results with platform breakdowns and ROI metrics
 */
export function calculateTotalCostAndTokens(
  dailyLogs = {},
  periodDays = 30,
  modelSelections = {},
  reasoningEffort = 'low',
  activeSubscription = 'free'
) {
  const logs = dailyLogs && typeof dailyLogs === 'object' ? dailyLogs : {};
  const dateKeys = Object.keys(logs).sort();

  // Filter dates if periodDays is specified and numeric
  let filteredDates = dateKeys;
  if (typeof periodDays === 'number' && periodDays > 0) {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - periodDays + 1);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    filteredDates = dateKeys.filter(date => date >= cutoffStr);
  }

  // Aggregate message counts per platform
  const platformCounts = {};
  let totalMessages = 0;

  filteredDates.forEach(date => {
    const day = logs[date];
    if (!day) return;

    if (day.platforms && typeof day.platforms === 'object') {
      Object.entries(day.platforms).forEach(([platformId, count]) => {
        const validCount = typeof count === 'number' && !isNaN(count) ? Math.max(0, Math.floor(count)) : 0;
        platformCounts[platformId] = (platformCounts[platformId] || 0) + validCount;
        totalMessages += validCount;
      });
    } else if (typeof day.messagesCount === 'number' && day.messagesCount > 0) {
      const defaultPlatform = 'chatgpt';
      const validCount = Math.max(0, Math.floor(day.messagesCount));
      platformCounts[defaultPlatform] = (platformCounts[defaultPlatform] || 0) + validCount;
      totalMessages += validCount;
    }
  });

  // Calculate tokens & costs per platform
  const platforms = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalReasoningTokens = 0;
  let totalOverallTokens = 0;
  let totalInputCost = 0;
  let totalOutputCost = 0;
  let totalCost = 0;

  Object.entries(platformCounts).forEach(([platformId, count]) => {
    const selectedModel = modelSelections[platformId] || DEFAULT_MODELS[platformId];
    const calc = calculateMessageTokens(count, platformId, selectedModel, reasoningEffort);

    platforms[platformId] = calc;
    totalInputTokens += calc.inputTokens;
    totalOutputTokens += calc.outputTokens;
    totalReasoningTokens += calc.reasoningTokens;
    totalOverallTokens += calc.totalTokens;
    totalInputCost += calc.inputCost;
    totalOutputCost += calc.outputCost;
    totalCost += calc.totalCost;
  });

  totalInputCost = Number(totalInputCost.toFixed(6));
  totalOutputCost = Number(totalOutputCost.toFixed(6));
  totalCost = Number(totalCost.toFixed(6));

  // Calculate Subscription ROI
  const roi = calculateSubscriptionROI(totalCost, activeSubscription);

  return {
    periodDays,
    totalMessages,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    reasoningTokens: totalReasoningTokens,
    totalOutputTokens: totalOutputTokens + totalReasoningTokens,
    totalTokens: totalOverallTokens,
    inputCost: totalInputCost,
    outputCost: totalOutputCost,
    totalCost,
    formattedTokens: formatTokens(totalOverallTokens),
    formattedCost: formatCost(totalCost),
    platforms,
    roi
  };
}

/**
 * Calculates Return on Investment (ROI) and net savings for a given API equivalent value vs Subscription cost.
 *
 * @param {number} apiEquivalentCost The estimated cost if using pay-as-you-go APIs
 * @param {string|object} subscriptionType Plan ID (e.g. 'chatgpt-plus') or subscription object
 * @param {number} [customMonthlyCost] Custom monthly cost if subscriptionType is 'custom' or overridden
 * @returns {object} ROI analytics including percentage, savings, break-even status, and formatted labels
 */
export function calculateSubscriptionROI(apiEquivalentCost, subscriptionType = 'free', customMonthlyCost) {
  const apiCost = typeof apiEquivalentCost === 'number' && !isNaN(apiEquivalentCost)
    ? Math.max(0, apiEquivalentCost)
    : 0;

  let planId = 'free';
  let planName = 'Free Tier / Pay-As-You-Go';
  let monthlyCost = 0;

  if (typeof subscriptionType === 'string') {
    planId = subscriptionType;
    if (SUBSCRIPTION_PLANS[subscriptionType]) {
      planName = SUBSCRIPTION_PLANS[subscriptionType].name;
      monthlyCost = SUBSCRIPTION_PLANS[subscriptionType].monthlyCost;
    } else if (subscriptionType === 'custom') {
      planName = 'Custom Plan';
      monthlyCost = 0;
    }
  } else if (subscriptionType && typeof subscriptionType === 'object') {
    planId = subscriptionType.id || subscriptionType.type || 'custom';
    planName = subscriptionType.name || 'Custom Plan';
    monthlyCost = typeof subscriptionType.monthlyCost === 'number' ? subscriptionType.monthlyCost : 0;
  }

  if (typeof customMonthlyCost === 'number' && !isNaN(customMonthlyCost)) {
    monthlyCost = Math.max(0, customMonthlyCost);
  }

  const netSavings = Number((apiCost - monthlyCost).toFixed(2));
  const isProfitable = apiCost > monthlyCost;
  const isBreakEven = apiCost >= monthlyCost;

  let roiPercentage = 0;
  let savingsPercentage = 0;

  if (monthlyCost > 0) {
    roiPercentage = (apiCost / monthlyCost) * 100;
    savingsPercentage = ((apiCost - monthlyCost) / monthlyCost) * 100;
  } else if (monthlyCost === 0 && apiCost > 0) {
    roiPercentage = Infinity;
    savingsPercentage = 100;
  }

  let status = 'free_tier';
  if (monthlyCost > 0) {
    if (netSavings > 0) {
      status = 'profitable';
    } else if (netSavings === 0) {
      status = 'breakeven';
    } else {
      status = 'loss';
    }
  }

  // Estimated Break-Even Usage: Number of prompts needed per month at average cost (~$0.003/msg) to break even
  const avgCostPerPrompt = 0.004;
  const estimatedBreakEvenUsage = monthlyCost > 0 ? Math.ceil(monthlyCost / avgCostPerPrompt) : 0;

  return {
    apiEquivalentCost: apiCost,
    subscriptionCost: monthlyCost,
    subscriptionType: planId,
    subscriptionName: planName,
    netSavings,
    isProfitable,
    isBreakEven,
    estimatedBreakEvenUsage,
    roiPercentage: Number.isFinite(roiPercentage) ? Number(roiPercentage.toFixed(2)) : roiPercentage,
    savingsPercentage: Number.isFinite(savingsPercentage) ? Number(savingsPercentage.toFixed(2)) : savingsPercentage,
    formattedRoi: Number.isFinite(roiPercentage) ? `${Math.round(roiPercentage)}%` : (monthlyCost === 0 && apiCost > 0 ? '∞ (Free)' : '0%'),
    formattedSavings: formatCost(Math.abs(netSavings)),
    status
  };
}

/**
 * Formats a currency amount into a clean, human-readable USD string.
 */
export function formatCost(amount) {
  if (amount == null || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return '$0.00';
  }

  if (amount > 0 && amount < 0.01) {
    return '<$0.01';
  }

  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formats an integer or float token count into compact human-readable notation.
 */
export function formatTokens(count) {
  if (count == null || typeof count !== 'number' || isNaN(count) || count <= 0) {
    return '0';
  }

  const rounded = Math.round(count);

  if (rounded < 1000) {
    return String(rounded);
  }

  if (rounded < 1_000_000) {
    const k = rounded / 1000;
    const formatted = k % 1 === 0 ? k.toString() : Number(k.toFixed(1)).toString();
    return `${formatted}K`;
  }

  if (rounded < 1_000_000_000) {
    const m = rounded / 1_000_000;
    const formatted = m % 1 === 0 ? m.toString() : Number(m.toFixed(1)).toString();
    return `${formatted}M`;
  }

  const b = rounded / 1_000_000_000;
  const formatted = b % 1 === 0 ? b.toString() : Number(b.toFixed(1)).toString();
  return `${formatted}B`;
}

export default {
  PRICING_SCHEMA_VERSION,
  MODEL_CATALOG,
  DEFAULT_MODEL_CATALOG,
  DEFAULT_MODELS,
  REASONING_EFFORTS,
  SUBSCRIPTION_PLANS,
  registerCustomModel,
  resetModelPricing,
  getModelConfig,
  getModelsForPlatform,
  calculateMessageTokens,
  calculateArbitrageSavings,
  calculateTotalCostAndTokens,
  calculateSubscriptionROI,
  formatCost,
  formatTokens
};
