/**
 * AIStat - Interactive Model Switcher & Arbitrage / ROI Simulator Component
 * Provides real-time client-side interactive arbitrage modeling between AI models & subscription plans.
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
      baselineModel: 'claude-sonnet-5',
      alternativeModel: 'deepseek-v3',
      monthlyPrompts: 500,
      reasoningEffort: 'medium',
      subscriptionPlan: 'chatgpt-plus',
      customInputPrice: null,
      customOutputPrice: null
    };
  }

  /**
   * Initializes simulator in DOM container.
   */
  mount() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.renderSkeleton(container);
    this.attachEventListeners();
    this.update();
  }

  /**
   * Generates simulator markup.
   */
  renderSkeleton(container) {
    const modelOptions = Object.values(MODEL_CATALOG).map(m =>
      `<option value="${m.id}">${m.name} (${m.providerName || m.provider}) - $${m.inputPricePerMillion}/$${m.outputPricePerMillion} per 1M</option>`
    ).join('');

    const subOptions = Object.values(SUBSCRIPTION_PLANS).map(s =>
      `<option value="${s.id}">${s.name} ($${s.monthlyCost}/mo)</option>`
    ).join('');

    container.innerHTML = `
      <div class="roi-simulator-card">
        <div class="roi-header">
          <div class="roi-title-wrap">
            <div class="brand-badge-icon"><i data-lucide="calculator" class="icon-sm"></i></div>
            <div>
              <h4>Model Arbitrage &amp; Subscription ROI Simulator</h4>
              <span class="card-subtitle">Simulate cost differences across LLM providers without sending any data.</span>
            </div>
          </div>
        </div>

        <div class="roi-body-grid">
          <!-- Controls Column -->
          <div class="roi-controls-panel">
            <div class="roi-form-group">
              <label class="control-label">Baseline Model (Current Primary)</label>
              <select id="roi-baseline-select" class="select-input">
                ${modelOptions}
              </select>
            </div>

            <div class="roi-form-group">
              <label class="control-label">Alternative Model (Target Comparison)</label>
              <select id="roi-alternative-select" class="select-input">
                ${modelOptions}
              </select>
            </div>

            <div class="roi-form-group">
              <div class="slider-header flex-between">
                <label class="control-label">Monthly Prompt Volume</label>
                <span id="roi-prompt-count-display" class="slider-value-badge">500 msgs/mo</span>
              </div>
              <input type="range" id="roi-prompt-slider" min="50" max="5000" step="25" value="500" class="range-slider">
            </div>

            <div class="roi-form-group">
              <label class="control-label">Query Reasoning / Token Density</label>
              <div class="pill-toggle-group">
                <button type="button" class="pill-toggle-btn" data-effort="low">Low (~750 tok)</button>
                <button type="button" class="pill-toggle-btn active" data-effort="medium">Med (~2K tok)</button>
                <button type="button" class="pill-toggle-btn" data-effort="high">High (~5K tok)</button>
              </div>
            </div>

            <div class="roi-form-group">
              <label class="control-label">Compare to Subscription</label>
              <select id="roi-subscription-select" class="select-input">
                ${subOptions}
              </select>
            </div>
          </div>

          <!-- Results Display Column -->
          <div class="roi-results-panel">
            <div class="arbitrage-summary-box" id="roi-summary-box">
              <div class="arbitrage-kpi-row">
                <div class="arbitrage-kpi">
                  <span class="kpi-label">Baseline Cost</span>
                  <span class="kpi-number" id="roi-baseline-cost">$0.00</span>
                  <span class="kpi-sub" id="roi-baseline-sub">per month</span>
                </div>
                <div class="arbitrage-arrow">➔</div>
                <div class="arbitrage-kpi">
                  <span class="kpi-label">Alternative Cost</span>
                  <span class="kpi-number highlight" id="roi-alt-cost">$0.00</span>
                  <span class="kpi-sub" id="roi-alt-sub">per month</span>
                </div>
              </div>

              <div class="savings-banner" id="roi-savings-banner">
                <div class="savings-main">
                  <span class="savings-tag">Projected Savings</span>
                  <span class="savings-val" id="roi-savings-val">$0.00 / mo</span>
                  <span class="savings-pct" id="roi-savings-pct">(0%)</span>
                </div>
                <div class="annual-projection" id="roi-annual-savings">
                  Annualized Savings: <strong>$0.00 / yr</strong>
                </div>
              </div>

              <div class="subscription-comparison-box">
                <div class="flex-between">
                  <span class="sub-compare-label">Subscription Break-Even Status:</span>
                  <span class="status-badge" id="roi-sub-status">Calculating...</span>
                </div>
                <p class="sub-insight-text" id="roi-sub-insight">
                  Evaluating monthly API value vs fixed subscription cost.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Set initial select values
    const baseSel = container.querySelector('#roi-baseline-select');
    const altSel = container.querySelector('#roi-alternative-select');
    const subSel = container.querySelector('#roi-subscription-select');
    if (baseSel) baseSel.value = this.state.baselineModel;
    if (altSel) altSel.value = this.state.alternativeModel;
    if (subSel) subSel.value = this.state.subscriptionPlan;
  }

  attachEventListeners() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const baseSel = container.querySelector('#roi-baseline-select');
    const altSel = container.querySelector('#roi-alternative-select');
    const slider = container.querySelector('#roi-prompt-slider');
    const sliderDisplay = container.querySelector('#roi-prompt-count-display');
    const subSel = container.querySelector('#roi-subscription-select');
    const effortBtns = container.querySelectorAll('.pill-toggle-btn');

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
      if (sliderDisplay) sliderDisplay.textContent = `${val.toLocaleString()} msgs/mo`;
      this.update();
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

    // Update DOM
    const baseCostEl = document.getElementById('roi-baseline-cost');
    const altCostEl = document.getElementById('roi-alt-cost');
    const baseSubEl = document.getElementById('roi-baseline-sub');
    const altSubEl = document.getElementById('roi-alt-sub');
    const savingsValEl = document.getElementById('roi-savings-val');
    const savingsPctEl = document.getElementById('roi-savings-pct');
    const annualEl = document.getElementById('roi-annual-savings');
    const bannerEl = document.getElementById('roi-savings-banner');
    const statusEl = document.getElementById('roi-sub-status');
    const insightEl = document.getElementById('roi-sub-insight');

    if (baseCostEl) baseCostEl.textContent = arb.baseline.formattedCost;
    if (altCostEl) altCostEl.textContent = arb.alternative.formattedCost;
    if (baseSubEl) baseSubEl.textContent = `${arb.baseline.name} (~${arb.tokens.formattedTokens} tok)`;
    if (altSubEl) altSubEl.textContent = `${arb.alternative.name} (~${arb.tokens.formattedTokens} tok)`;

    if (savingsValEl) {
      if (arb.isCheaper) {
        savingsValEl.textContent = `+${arb.formattedSavings} / mo`;
        savingsValEl.style.color = '#10b981';
      } else if (arb.estimatedSavings < 0) {
        savingsValEl.textContent = `-${arb.formattedSavings} / mo`;
        savingsValEl.style.color = '#ef4444';
      } else {
        savingsValEl.textContent = '$0.00 / mo';
        savingsValEl.style.color = 'var(--text-primary)';
      }
    }

    if (savingsPctEl) {
      savingsPctEl.textContent = arb.isCheaper ? `(${arb.savingsPercent}% savings)` : `(${Math.abs(arb.savingsPercent)}% difference)`;
    }

    if (annualEl) {
      annualEl.innerHTML = `Annualized Projected Difference: <strong>${arb.formattedAnnualSavings} / yr</strong>`;
    }

    if (statusEl && insightEl) {
      if (roi.status === 'profitable') {
        statusEl.textContent = `Profitable (${roi.formattedRoi} ROI)`;
        statusEl.className = 'status-badge badge-success';
        insightEl.textContent = `At ${this.state.monthlyPrompts} msgs/mo, ${roi.subscriptionName} saves you ${roi.formattedSavings}/mo compared to paying equivalent API rates.`;
      } else if (roi.status === 'breakeven') {
        statusEl.textContent = 'Break-Even';
        statusEl.className = 'status-badge badge-warning';
        insightEl.textContent = `Usage is right at the break-even threshold for ${roi.subscriptionName}.`;
      } else if (roi.status === 'loss') {
        statusEl.textContent = 'Under-Utilized';
        statusEl.className = 'status-badge badge-neutral';
        insightEl.textContent = `At ${this.state.monthlyPrompts} msgs/mo (${arb.baseline.formattedCost} API value), pay-as-you-go API or free tier is more cost-effective than the $${roi.subscriptionCost}/mo subscription.`;
      } else {
        statusEl.textContent = 'Free Tier';
        statusEl.className = 'status-badge badge-info';
        insightEl.textContent = `Estimated API compute value for your volume is ${arb.baseline.formattedCost}/mo.`;
      }
    }

    if (typeof this.onChange === 'function') {
      this.onChange({ arbitrage: arb, roi });
    }
  }
}

export default ROISimulator;
