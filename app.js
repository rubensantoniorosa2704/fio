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
   * Converts text typed by the user into a non-negative number.
   * Brazilian format: "1.234,50" (dot = thousands, comma = decimal).
   * Also accepts "12.5" when no comma is present.
   * Invalid or empty input becomes 0.
   */
  parseDecimal(rawValue) {
    const text = String(rawValue).trim();
    const normalised = text.includes(",")
      ? text.replace(/\./g, "").replace(",", ".")
      : text;
    const number = Number.parseFloat(normalised);
    return Number.isFinite(number) && number > 0 ? number : 0;
  },

  /*
   * Converts the hours and minutes pickers into decimal hours.
   * Example: 1 hour and 30 minutes becomes 1.5.
   */
  toDecimalHours(wholeHours, minutes) {
    return wholeHours + minutes / 60;
  },

  /*
   * Base Cost   = (hours * rate) + materials
   * Margin      = Base Cost * marginRate
   * Total Price = Base Cost + Margin
   *
   * Calculation runs in whole cents so that Total always equals Pay + Stash
   * exactly, with no floating-point drift on screen.
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
      hours: document.getElementById("select-hours"),
      minutes: document.getElementById("select-minutes"),
      rate: document.getElementById("input-rate"),
      materials: document.getElementById("input-materials"),
    };
    this.outputs = {
      total: document.getElementById("output-total"),
      pay: document.getElementById("output-pay"),
      stash: document.getElementById("output-stash"),
    };

    document.getElementById("margin-percent").textContent =
      percentFormatter.format(CONFIG.marginRate);

    /* Recalculate on every keystroke so no "Calculate" button is needed. */
    this.form.addEventListener("input", () => this.update());

    /* The keyboard's Enter/Done key closes the keyboard instead of reloading. */
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      document.activeElement?.blur();
    });

    this.update();
  },

  /* Reads the raw values from the inputs. Time comes from two pickers. */
  readInputs() {
    const wholeHours = Number.parseInt(this.inputs.hours.value, 10);
    const minutes = Number.parseInt(this.inputs.minutes.value, 10);

    return {
      hours: Pricing.toDecimalHours(wholeHours, minutes),
      rate: Pricing.parseDecimal(this.inputs.rate.value),
      materials: Pricing.parseDecimal(this.inputs.materials.value),
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
