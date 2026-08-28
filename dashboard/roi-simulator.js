/**
 * AIStat - Interactive Model Switcher & Arbitrage / ROI Simulator Component
 * Redesigned with intuitive visual hierarchy, side-by-side model cards,
 * clear savings/cost-increase indicators, and a visual subscription break-even gauge.
 */

import {
  MODEL_CATALOG,
  SUBSCRIPTION_PLANS,
  calculateArbitrageSavings,
  calculateSubscriptionROI,
  formatCost,
  formatTokens
} from '../shared/cost-estimator.js';

export class ROISimulator {
  constructor({ containerId = 'roi-simulator-container', onChange } = {}) {
    this.containerId = containerId;
    this.onChange = onChange;

    this.state = {
      baselineModel: 'gemini-3.7-flash',
      alternativeModel: 'claude-sonnet-5',
      monthlyPrompts: 1500,
      reasoningEffort: 'medium',
      subscriptionPlan: 'chatgpt-plus'
    };
  }

  /**
   * Initializes simulator in DOM container.
   */
  mount() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.render(container);
    this.attachEventListeners();
    this.update();
  }

  /**
   * Generates clean, well-structured simulator markup.
   */
  render(container) {
    const modelOptions = Object.values(MODEL_CATALOG).map(m =>
      `<option value="${m.id}">${m.name} (${m.providerName || m.provider}) — $${m.inputPricePerMillion}/$${m.outputPricePerMillion} per 1M</option>`
    ).join('');

    const subOptions = Object.values(SUBSCRIPTION_PLANS).map(s =>
      `<option value="${s.id}">${s.name} ($${s.monthlyCost}/mo)</option>`
    ).join('');

    container.innerHTML = `
      <div class="roi-simulator-card roi-simulator-v2">
        <!-- 1. Global Workload Config Card -->
        <div class="roi-section-card workload-config-card">
          <div class="roi-section-header">
            <div class="header-icon-wrap">
              <i data-lucide="sliders" class="icon-sm"></i>
            </div>
            <div>
              <h5>1. Configure Your Monthly Workload</h5>
              <p class="section-desc">Estimate monthly prompt volume and typical prompt length to model real-world API costs.</p>
            </div>
          </div>

          <div class="workload-controls-grid">
            <div class="control-box">
              <div class="control-box-header">
                <span class="control-box-label">Monthly Prompt Volume</span>
                <span id="roi-prompt-count-display" class="volume-badge">1,500 msgs / mo</span>
              </div>
              <input type="range" id="roi-prompt-slider" min="50" max="5000" step="50" value="1500" class="range-slider-v2">
              <div class="slider-ticks">
                <span class="tick-btn" data-val="300">300 (Light)</span>
                <span class="tick-btn active" data-val="1500">1,500 (Moderate)</span>
                <span class="tick-btn" data-val="3000">3,000 (Heavy)</span>
                <span class="tick-btn" data-val="5000">5,000 (Pro)</span>
              </div>
            </div>

            <div class="control-box">
              <div class="control-box-header">
                <span class="control-box-label">Average Prompt &amp; Reasoning Depth</span>
              </div>
              <div class="effort-toggle-grid">
                <button type="button" class="effort-btn" data-effort="low">
                  <span class="effort-name">⚡ Quick Lookups</span>
                  <span class="effort-tok">~750 tokens / msg</span>
                </button>
                <button type="button" class="effort-btn active" data-effort="medium">
                  <span class="effort-name">📝 Standard Work</span>
                  <span class="effort-tok">~2,000 tokens / msg</span>
                </button>
                <button type="button" class="effort-btn" data-effort="high">
                  <span class="effort-name">🧠 Deep Code &amp; Reasoning</span>
                  <span class="effort-tok">~5,000 tokens / msg</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Model vs Model Arbitrage Comparison Card -->
        <div class="roi-section-card model-comparison-card">
          <div class="roi-section-header">
            <div class="header-icon-wrap">
              <i data-lucide="arrow-left-right" class="icon-sm"></i>
            </div>
            <div>
              <h5>2. Model vs. Model Arbitrage</h5>
              <p class="section-desc">See the exact monthly and annual cost difference if you switch between AI models.</p>
            </div>
          </div>

          <div class="model-cards-comparison-grid">
            <!-- Model A Card -->
            <div class="model-side-card baseline-side">
              <div class="side-card-tag">MODEL A (CURRENT)</div>
              <select id="roi-baseline-select" class="select-input-v2">
                ${modelOptions}
              </select>
              <div class="model-pricing-pill" id="roi-baseline-rate">$0.75 / $3.75 per 1M tokens</div>
              <div class="model-cost-display">
                <span class="cost-currency">$</span>
                <span class="cost-number" id="roi-baseline-cost">0.00</span>
                <span class="cost-period">/ month</span>
              </div>
              <div class="model-token-summary" id="roi-baseline-sub">~3.0M total tokens</div>
            </div>

            <!-- VS Divider & Outcome Banner -->
            <div class="comparison-center-divider">
              <div class="vs-circle">VS</div>
            </div>

            <!-- Model B Card -->
            <div class="model-side-card alternative-side">
              <div class="side-card-tag">MODEL B (COMPARISON)</div>
              <select id="roi-alternative-select" class="select-input-v2">
                ${modelOptions}
              </select>
              <div class="model-pricing-pill" id="roi-alt-rate">$3.00 / $15.00 per 1M tokens</div>
              <div class="model-cost-display">
                <span class="cost-currency">$</span>
                <span class="cost-number" id="roi-alt-cost">0.00</span>
                <span class="cost-period">/ month</span>
              </div>
              <div class="model-token-summary" id="roi-alt-sub">~3.0M total tokens</div>
            </div>
          </div>

          <!-- Dynamic Arbitrage Summary Banner -->
          <div class="arbitrage-verdict-banner" id="roi-arbitrage-banner">
            <div class="verdict-icon" id="roi-verdict-icon">💡</div>
            <div class="verdict-content">
              <div class="verdict-headline" id="roi-verdict-headline">Evaluating Model Cost Difference...</div>
              <div class="verdict-details" id="roi-verdict-details">Select two models above to view cost comparison.</div>
            </div>
            <div class="verdict-annual-badge" id="roi-annual-savings">
              Annual: $0.00 / yr
            </div>
          </div>
        </div>

        <!-- 3. Subscription Break-Even & ROI Card -->
        <div class="roi-section-card subscription-roi-card">
          <div class="roi-section-header">
            <div class="header-icon-wrap">
              <i data-lucide="badge-percent" class="icon-sm"></i>
            </div>
            <div>
              <h5>3. Subscription Value vs. Pay-As-You-Go API</h5>
              <p class="section-desc">Determine whether paying a fixed $20/month subscription is cheaper than paying raw API usage for Model A.</p>
            </div>
          </div>

          <div class="subscription-roi-grid">
            <div class="sub-selection-panel">
              <label class="control-box-label">Your Active or Target Subscription Plan</label>
              <select id="roi-subscription-select" class="select-input-v2">
                ${subOptions}
              </select>
              <div class="sub-cost-badge" id="roi-sub-cost-badge">Plan Cost: $20.00 / month</div>
            </div>

            <div class="sub-verdict-panel" id="roi-sub-verdict-panel">
              <div class="flex-between" style="align-items: center; margin-bottom: 8px;">
                <span class="sub-verdict-title">Subscription Efficiency Verdict:</span>
                <span class="status-badge" id="roi-sub-status">Calculating...</span>
              </div>
              <p class="sub-insight-text" id="roi-sub-insight">
                Evaluating your monthly volume against subscription pricing.
              </p>
              <div class="sub-break-even-meter">
                <div class="meter-bar-track">
                  <div class="meter-bar-fill" id="roi-meter-fill" style="width: 50%;"></div>
                </div>
                <div class="meter-labels flex-between">
                  <span>0 msgs (Pay-As-You-Go API Better)</span>
                  <span id="roi-meter-breakeven-lbl">Break-Even ~1,400 msgs</span>
                  <span>5,000+ msgs (Subscription Highly Profitable)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const baseSel = container.querySelector('#roi-baseline-select');
    const altSel = container.querySelector('#roi-alternative-select');
    const subSel = container.querySelector('#roi-subscription-select');
    if (baseSel) baseSel.value = this.state.baselineModel;
    if (altSel) altSel.value = this.state.alternativeModel;
    if (subSel) subSel.value = this.state.subscriptionPlan;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  attachEventListeners() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const baseSel = container.querySelector('#roi-baseline-select');
    const altSel = container.querySelector('#roi-alternative-select');
    const slider = container.querySelector('#roi-prompt-slider');
    const sliderDisplay = container.querySelector('#roi-prompt-count-display');
    const subSel = container.querySelector('#roi-subscription-select');
    const effortBtns = container.querySelectorAll('.effort-btn');
    const tickBtns = container.querySelectorAll('.tick-btn');

    baseSel?.addEventListener('change', (e) => {
      this.state.baselineModel = e.target.value;
      this.update();
    });

    altSel?.addEventListener('change', (e) => {
      this.state.alternativeModel = e.target.value;
      this.update();
    });

    slider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.state.monthlyPrompts = val;
      if (sliderDisplay) sliderDisplay.textContent = `${val.toLocaleString()} msgs / mo`;

      tickBtns.forEach(t => {
        const tVal = parseInt(t.getAttribute('data-val'), 10);
        t.classList.toggle('active', Math.abs(tVal - val) < 200);
      });

      this.update();
    });

    tickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-val'), 10);
        this.state.monthlyPrompts = val;
        if (slider) slider.value = String(val);
        if (sliderDisplay) sliderDisplay.textContent = `${val.toLocaleString()} msgs / mo`;

        tickBtns.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        this.update();
      });
    });

    subSel?.addEventListener('change', (e) => {
      this.state.subscriptionPlan = e.target.value;
      this.update();
    });

    effortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        effortBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.reasoningEffort = btn.getAttribute('data-effort') || 'medium';
        this.update();
      });
    });
  }

  update() {
    const arb = calculateArbitrageSavings({
      baselineModel: this.state.baselineModel,
      alternativeModel: this.state.alternativeModel,
      monthlyPrompts: this.state.monthlyPrompts,
      reasoningEffort: this.state.reasoningEffort
    });

    const roi = calculateSubscriptionROI(arb.baseline.monthlyCost, this.state.subscriptionPlan);

    // Elements
    const baseCostEl = document.getElementById('roi-baseline-cost');
    const altCostEl = document.getElementById('roi-alt-cost');
    const baseRateEl = document.getElementById('roi-baseline-rate');
    const altRateEl = document.getElementById('roi-alt-rate');
    const baseSubEl = document.getElementById('roi-baseline-sub');
    const altSubEl = document.getElementById('roi-alt-sub');
    const bannerEl = document.getElementById('roi-arbitrage-banner');
    const verdictIconEl = document.getElementById('roi-verdict-icon');
    const verdictHeadlineEl = document.getElementById('roi-verdict-headline');
    const verdictDetailsEl = document.getElementById('roi-verdict-details');
    const annualEl = document.getElementById('roi-annual-savings');

    const subCostBadge = document.getElementById('roi-sub-cost-badge');
    const statusEl = document.getElementById('roi-sub-status');
    const insightEl = document.getElementById('roi-sub-insight');
    const meterFill = document.getElementById('roi-meter-fill');
    const meterLbl = document.getElementById('roi-meter-breakeven-lbl');

    if (baseCostEl) baseCostEl.textContent = arb.baseline.monthlyCost.toFixed(2);
    if (altCostEl) altCostEl.textContent = arb.alternative.monthlyCost.toFixed(2);

    if (baseRateEl) baseRateEl.textContent = `$${arb.baseline.inputPrice} / $${arb.baseline.outputPrice} per 1M tokens`;
    if (altRateEl) altRateEl.textContent = `$${arb.alternative.inputPrice} / $${arb.alternative.outputPrice} per 1M tokens`;

    if (baseSubEl) baseSubEl.textContent = `~${arb.tokens.formattedTokens} compute tokens / mo`;
    if (altSubEl) altSubEl.textContent = `~${arb.tokens.formattedTokens} compute tokens / mo`;

    // Format Arbitrage Verdict
    if (bannerEl) {
      if (arb.isCheaper && arb.estimatedSavings > 0.005) {
        bannerEl.className = 'arbitrage-verdict-banner banner-savings';
        if (verdictIconEl) verdictIconEl.textContent = '🎉';
        if (verdictHeadlineEl) {
          verdictHeadlineEl.innerHTML = `Switching to <strong>${arb.alternative.name}</strong> saves <strong>+${arb.formattedSavings} / month</strong> (${arb.savingsPercent}% cheaper)`;
        }
        if (verdictDetailsEl) {
          verdictDetailsEl.textContent = `You reduce your monthly AI compute bill from ${arb.baseline.formattedCost} down to ${arb.alternative.formattedCost}.`;
        }
        if (annualEl) {
          annualEl.className = 'verdict-annual-badge badge-green';
          annualEl.textContent = `Annual Savings: +${arb.formattedAnnualSavings} / yr`;
        }
      } else if (arb.estimatedSavings < -0.005) {
        const costIncrease = Math.abs(arb.estimatedSavings);
        const increasePct = arb.baseline.monthlyCost > 0
          ? Math.round((costIncrease / arb.baseline.monthlyCost) * 100)
          : 100;

        bannerEl.className = 'arbitrage-verdict-banner banner-increase';
        if (verdictIconEl) verdictIconEl.textContent = '⚠️';
        if (verdictHeadlineEl) {
          verdictHeadlineEl.innerHTML = `Switching to <strong>${arb.alternative.name}</strong> costs <strong>+${formatCost(costIncrease)} / month more</strong> (+${increasePct}% cost)`;
        }
        if (verdictDetailsEl) {
          verdictDetailsEl.textContent = `Your monthly AI compute increases from ${arb.baseline.formattedCost} up to ${arb.alternative.formattedCost} for this prompt volume.`;
        }
        if (annualEl) {
          annualEl.className = 'verdict-annual-badge badge-orange';
          annualEl.textContent = `Annual Extra Cost: +${formatCost(costIncrease * 12)} / yr`;
        }
      } else {
        bannerEl.className = 'arbitrage-verdict-banner banner-neutral';
        if (verdictIconEl) verdictIconEl.textContent = '⚖️';
        if (verdictHeadlineEl) {
          verdictHeadlineEl.innerHTML = `Both models have identical estimated cost (<strong>${arb.baseline.formattedCost} / month</strong>)`;
        }
        if (verdictDetailsEl) {
          verdictDetailsEl.textContent = `No cost difference detected for the selected pricing rates.`;
        }
        if (annualEl) {
          annualEl.className = 'verdict-annual-badge badge-neutral';
          annualEl.textContent = `Annual Difference: $0.00 / yr`;
        }
      }
    }

    // Format Subscription ROI
    if (subCostBadge) subCostBadge.textContent = `Plan Cost: $${roi.subscriptionCost}.00 / month`;

    if (statusEl && insightEl) {
      const breakEvenPrompts = roi.estimatedBreakEvenUsage || 1000;
      const meterPercent = Math.min(100, Math.max(5, Math.round((this.state.monthlyPrompts / (breakEvenPrompts * 2)) * 100)));

      if (meterFill) {
        meterFill.style.width = `${meterPercent}%`;
        meterFill.style.background = roi.status === 'profitable' ? '#10b981' : (roi.status === 'breakeven' ? '#f59e0b' : '#64748b');
      }

      if (meterLbl) {
        meterLbl.textContent = `Break-Even Threshold: ~${breakEvenPrompts.toLocaleString()} msgs / mo`;
      }

      if (roi.status === 'profitable') {
        statusEl.textContent = `Highly Cost-Effective (${roi.formattedRoi} ROI)`;
        statusEl.className = 'status-badge badge-success';
        insightEl.innerHTML = `At <strong>${this.state.monthlyPrompts.toLocaleString()} msgs/mo</strong>, you consume <strong>${arb.baseline.formattedCost}</strong> worth of raw API compute for just <strong>$${roi.subscriptionCost}/mo</strong>. Your subscription saves you <strong>${roi.formattedSavings}/month</strong>.`;
      } else if (roi.status === 'breakeven') {
        statusEl.textContent = 'Break-Even Usage';
        statusEl.className = 'status-badge badge-warning';
        insightEl.innerHTML = `Your usage of <strong>${this.state.monthlyPrompts.toLocaleString()} msgs/mo</strong> roughly matches the <strong>$${roi.subscriptionCost}/mo</strong> subscription cost.`;
      } else if (roi.status === 'loss') {
        statusEl.textContent = 'Under-Utilized (Overpaying)';
        statusEl.className = 'status-badge badge-neutral';
        const wasted = Math.abs(roi.netSavings);
        insightEl.innerHTML = `At <strong>${this.state.monthlyPrompts.toLocaleString()} msgs/mo</strong>, you only consume <strong>${arb.baseline.formattedCost}</strong> in API compute. Paying the <strong>$${roi.subscriptionCost}/mo</strong> subscription means overpaying by <strong>${formatCost(wasted)}/mo</strong> compared to Pay-As-You-Go API or free tier.`;
      } else {
        statusEl.textContent = 'Free Tier / Pay-As-You-Go';
        statusEl.className = 'status-badge badge-info';
        insightEl.innerHTML = `Your estimated API compute value is <strong>${arb.baseline.formattedCost}/mo</strong>. Free tier or pay-as-you-go is optimal.`;
      }
    }

    if (typeof this.onChange === 'function') {
      this.onChange({ arbitrage: arb, roi });
    }
  }
}

export default ROISimulator;
