"use strict";

/* ==========================================================================
   Configuration
   Single place for values that are likely to change.
   ========================================================================== */

const CONFIG = Object.freeze({
  currency: "BRL",
  locale: "pt-BR",
  marginRate: 0.15, // 15% business margin
});

/* ==========================================================================
   Formatting helpers
   ========================================================================== */

const currencyFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: "currency",
  currency: CONFIG.currency,
});

const percentFormatter = new Intl.NumberFormat(CONFIG.locale, {
  style: "percent",
  maximumFractionDigits: 2,
});

const formatMoney = (amount) => currencyFormatter.format(amount);

/* ==========================================================================
   Pricing logic (pure functions, no DOM access)
   ========================================================================== */

const Pricing = {
  /*
- Converts text typed by the user into a non-negative number.
- Brazilian format: "1.234,50" (dot = thousands, comma = decimal).
- Also accepts "12.5" when no comma is present.
- Invalid or empty input becomes 0.
   */
  parseDecimal(rawValue) {
    const text = String(rawValue).trim();
    const normalised = text.includes(",")
      ? text.replace(/\./g, "").replace(",", ".")
      : text;
    const number = Number.parseFloat(normalised);
    return Number.isFinite(number) && number > 0 ? number : 0;
  },

  parseInteger(rawValue) {
    const number = Number.parseInt(String(rawValue).trim(), 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
  },

  sumMaterials(costs) {
    const totalCents = costs.reduce(
      (sum, cost) => sum + Math.round(cost * 100),
      0
    );
    return totalCents / 100;
  },

  /*
- Converts the hours and minutes pickers into decimal hours.
- Example: 1 hour and 30 minutes becomes 1.5.
   */
  toDecimalHours(wholeHours, minutes) {
    return wholeHours + minutes / 60;
  },

  /*
- Base Cost   = (hours * rate) + materials
- Margin      = Base Cost * marginRate
- Total Price = Base Cost + Margin
   *
- Calculation runs in whole cents so that Total always equals Pay + Stash
- exactly, with no floating-point drift on screen.
   */
  calculate({ hours, rate, materials }) {
    const baseCents = Math.round((hours * rate + materials) * 100);
    const marginCents = Math.round(baseCents * CONFIG.marginRate);

    return {
      base: baseCents / 100,
      margin: marginCents / 100,
      total: (baseCents + marginCents) / 100,
    };
  },
};

/* ==========================================================================
   Calculator view
   ========================================================================== */

const CalculatorView = {
  init() {
    this.form = document.getElementById("pricing-form");
    this.inputs = {
      hours: document.getElementById("input-hours"),
      minutes: document.getElementById("input-minutes"),
      rate: document.getElementById("input-rate"),
    };
    this.materialsList = document.getElementById("materials-list");
    this.materialTemplate = document.getElementById("material-row-template");
    this.addMaterialButton = document.getElementById("add-material");
    this.outputs = {
      total: document.getElementById("output-total"),
      pay: document.getElementById("output-pay"),
      stash: document.getElementById("output-stash"),
    };

    document.getElementById("margin-percent").textContent =
      percentFormatter.format(CONFIG.marginRate);

    /* Recalculate on every keystroke so no "Calculate" button is needed. */
    this.form.addEventListener("input", () => this.update());

    this.addMaterialButton.addEventListener("click", () => this.addMaterialRow());
    this.materialsList.addEventListener("click", (event) => {
      const removeButton = event.target.closest('[data-action="remove"]');
      if (!removeButton) return;
      removeButton.closest("[data-material-row]")?.remove();
      this.update();
    });

    /* The keyboard's Enter/Done key closes the keyboard instead of reloading. */
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      document.activeElement?.blur();
    });

    this.update();
  },

  addMaterialRow() {
    const fragment = this.materialTemplate.content.cloneNode(true);
    const nameInput = fragment.querySelector('[data-field="name"]');
    this.materialsList.appendChild(fragment);
    nameInput?.focus();
    this.update();
  },

  /* Reads the raw values from the inputs. Time comes from two pickers. */
  readInputs() {
    const wholeHours = Pricing.parseInteger(this.inputs.hours.value);
    const minutes = Pricing.parseInteger(this.inputs.minutes.value);
    const materialInputs = this.materialsList.querySelectorAll('[data-field="cost"]');
    const materialCosts = Array.from(materialInputs, (input) =>
      Pricing.parseDecimal(input.value)
    );

    return {
      hours: Pricing.toDecimalHours(wholeHours, minutes),
      rate: Pricing.parseDecimal(this.inputs.rate.value),
      materials: Pricing.sumMaterials(materialCosts),
    };
  },

  /* Recalculates and paints the three results. */
  update() {
    const { base, margin, total } = Pricing.calculate(this.readInputs());

    this.outputs.total.textContent = formatMoney(total);
    this.outputs.pay.textContent = formatMoney(base);
    this.outputs.stash.textContent = formatMoney(margin);
  },
};

/* ==========================================================================
   Service worker registration (offline support)
   Requires HTTPS or localhost.
   ========================================================================== */

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

/* ==========================================================================
   Bootstrap
   ========================================================================== */

CalculatorView.init();
registerServiceWorker();