/**
 * render.js — Pure DOM construction from validated analysis data.
 * Uses textContent / createElement throughout — never innerHTML with AI content.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create an element with optional class and text content.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Create a question chip element (safely).
 * @param {string} question
 * @returns {HTMLElement | null}
 */
function makeQuestionChip(question) {
  if (!question) return null;
  const chip = el('div', 'question-chip');
  const icon = el('span', 'question-chip__icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '↳';
  const text = el('span', 'question-chip__text', question);
  chip.appendChild(icon);
  chip.appendChild(text);
  return chip;
}

/**
 * Create a finding card element.
 * @param {object} finding - { title, explanation, why_it_matters, question_to_explore }
 * @param {number} index - for animation stagger delay
 * @returns {HTMLElement}
 */
function makeFindingCard(finding, index) {
  const card = el('article', 'finding-card');
  card.style.setProperty('--card-delay', `${index * 60}ms`);
  card.setAttribute('role', 'article');

  const title = el('h3', 'finding-card__title', finding.title);
  card.appendChild(title);

  if (finding.explanation) {
    const explanation = el('p', 'finding-card__explanation', finding.explanation);
    card.appendChild(explanation);
  }

  if (finding.why_it_matters) {
    const whyBlock = el('div', 'finding-card__why');
    const whyLabel = el('span', 'finding-card__why-label', 'Why it matters');
    const whyText = el('p', 'finding-card__why-text', finding.why_it_matters);
    whyBlock.appendChild(whyLabel);
    whyBlock.appendChild(whyText);
    card.appendChild(whyBlock);
  }

  if (finding.question_to_explore) {
    const chip = makeQuestionChip(finding.question_to_explore);
    if (chip) card.appendChild(chip);
  }

  return card;
}

/**
 * Create a reasoning pattern card.
 * @param {object} pattern - { title, explanation, why_it_matters }
 * @param {number} index
 * @returns {HTMLElement}
 */
function makePatternCard(pattern, index) {
  const card = el('article', 'pattern-card');
  card.style.setProperty('--card-delay', `${index * 60}ms`);

  const header = el('div', 'pattern-card__title');
  const tag = el('span', 'pattern-card__tag', 'Possible pattern');
  tag.setAttribute('aria-hidden', 'true');
  const titleText = el('span', '', pattern.title);
  header.appendChild(titleText);
  header.appendChild(tag);
  card.appendChild(header);

  if (pattern.explanation) {
    card.appendChild(el('p', 'pattern-card__explanation', pattern.explanation));
  }
  if (pattern.why_it_matters) {
    card.appendChild(el('p', 'pattern-card__why', pattern.why_it_matters));
  }

  return card;
}

/**
 * Build a full X-Ray panel with header and cards.
 * @param {object} opts
 * @returns {HTMLElement}
 */
function makeXRayPanel({ panelClass, icon, title, items, makeCard, emptyText, startIndex = 0 }) {
  const panel = el('div', `xray-panel ${panelClass}`);

  // Header
  const header = el('div', 'xray-panel__header');
  const iconEl = el('span', 'xray-panel__icon');
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;
  const titleEl = el('h2', 'xray-panel__title', title);
  const count = el('span', 'xray-panel__count', String(items.length));
  header.appendChild(iconEl);
  header.appendChild(titleEl);
  header.appendChild(count);
  panel.appendChild(header);

  if (items.length === 0) {
    const empty = el('div', 'empty-state');
    const emptyIcon = el('div', 'empty-state__icon');
    emptyIcon.setAttribute('aria-hidden', 'true');
    emptyIcon.textContent = '·';
    const emptyText_ = el('p', 'empty-state__text', emptyText);
    empty.appendChild(emptyIcon);
    empty.appendChild(emptyText_);
    panel.appendChild(empty);
  } else {
    items.forEach((item, i) => {
      panel.appendChild(makeCard(item, startIndex + i));
    });
  }

  return panel;
}

// ─── Public Render Functions ──────────────────────────────────────────────────

/**
 * Render the full Reasoning X-Ray section.
 * @param {object} analysis - validated analysis object
 * @param {HTMLElement} container - target DOM element
 */
export function renderXRay(analysis, container) {
  container.innerHTML = '';

  // Decision summary
  const xrayHeader = document.getElementById('xray-header');
  if (xrayHeader && analysis.decision_summary) {
    const summaryEl = document.getElementById('xray-decision-summary');
    if (summaryEl) summaryEl.textContent = `"${analysis.decision_summary}"`;
  }

  const grid = el('div', 'xray-grid');
  grid.setAttribute('role', 'region');
  grid.setAttribute('aria-label', 'Reasoning X-Ray Analysis');

  // ── Row 1: Blind Spots + Assumptions ──
  grid.appendChild(makeXRayPanel({
    panelClass: 'xray-panel--blind-spot',
    icon: '◎',
    title: 'Blind Spots',
    items: analysis.blind_spots,
    makeCard: makeFindingCard,
    emptyText: 'No obvious blind spots identified in this analysis.',
    startIndex: 0,
  }));

  grid.appendChild(makeXRayPanel({
    panelClass: 'xray-panel--assumption',
    icon: '△',
    title: 'Assumptions',
    items: analysis.assumptions,
    makeCard: makeFindingCard,
    emptyText: 'No clear assumptions surfaced.',
    startIndex: analysis.blind_spots.length,
  }));

  // ── Row 2: Missing Info + Trade-offs ──
  grid.appendChild(makeXRayPanel({
    panelClass: 'xray-panel--missing',
    icon: '□',
    title: 'Missing Information',
    items: analysis.missing_information,
    makeCard: makeFindingCard,
    emptyText: 'No critical missing information identified.',
    startIndex: analysis.blind_spots.length + analysis.assumptions.length,
  }));

  grid.appendChild(makeXRayPanel({
    panelClass: 'xray-panel--tradeoff',
    icon: '⇌',
    title: 'Trade-offs',
    items: analysis.tradeoffs,
    makeCard: makeFindingCard,
    emptyText: 'No significant trade-offs identified.',
    startIndex: analysis.blind_spots.length + analysis.assumptions.length + analysis.missing_information.length,
  }));

  // ── Row 3: Contradictions (full width if items, else half) ──
  const hasContradictions = analysis.contradictions.length > 0;
  const contradictionPanel = makeXRayPanel({
    panelClass: `xray-panel--contradiction${hasContradictions ? '' : ''}`,
    icon: '⚡',
    title: 'Contradictions',
    items: analysis.contradictions,
    makeCard: makeFindingCard,
    emptyText: 'No internal contradictions detected.',
    startIndex: analysis.blind_spots.length + analysis.assumptions.length + analysis.missing_information.length + analysis.tradeoffs.length,
  });

  // ── Patterns ──
  const patternPanel = makeXRayPanel({
    panelClass: 'xray-panel--pattern',
    icon: '≋',
    title: 'Possible Reasoning Patterns',
    items: analysis.possible_reasoning_patterns,
    makeCard: makePatternCard,
    emptyText: 'No notable reasoning patterns identified.',
    startIndex: 0,
  });

  grid.appendChild(contradictionPanel);
  grid.appendChild(patternPanel);

  container.appendChild(grid);
}

/**
 * Render the Reflection section.
 * @param {object} analysis
 * @param {HTMLElement} container
 */
export function renderReflection(analysis, container) {
  container.innerHTML = '';

  // ── Questions to Explore ──
  if (analysis.questions_to_explore.length > 0) {
    const section = el('div', 'reflection-block');

    const heading = el('h2', 'reflection-block__title');
    heading.textContent = 'Questions Worth Exploring';
    section.appendChild(heading);

    const subtitle = el('p', 'reflection-block__subtitle',
      'These questions may help you investigate areas your current reasoning leaves open.');
    section.appendChild(subtitle);

    const list = el('ol', 'question-list');
    list.setAttribute('aria-label', 'Questions to explore');
    analysis.questions_to_explore.forEach(q => {
      const item = el('li', 'question-list__item', q);
      list.appendChild(item);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  // ── Evidence to Seek ──
  if (analysis.evidence_to_seek.length > 0) {
    const section = el('div', 'reflection-block');

    const heading = el('h2', 'reflection-block__title');
    heading.textContent = 'Evidence Worth Seeking';
    section.appendChild(heading);

    const subtitle = el('p', 'reflection-block__subtitle',
      'Information you could actively look for before finalising your reasoning.');
    section.appendChild(subtitle);

    const list = el('div', 'evidence-list');
    analysis.evidence_to_seek.forEach(item => {
      const card = el('div', 'evidence-item');
      card.appendChild(el('div', 'evidence-item__title', item.title));
      if (item.description) card.appendChild(el('p', 'evidence-item__text', item.description));
      list.appendChild(card);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  // ── What Could Change My Mind? ──
  if (analysis.what_could_change_my_mind.length > 0) {
    const section = el('div', 'reflection-block');

    const heading = el('h2', 'reflection-block__title');
    heading.textContent = 'What Could Change Your Mind?';
    section.appendChild(heading);

    const subtitle = el('p', 'reflection-block__subtitle',
      'Intellectual flexibility is a strength. Here are conditions that might reasonably shift this reasoning.');
    section.appendChild(subtitle);

    const accordion = el('div', 'accordion');
    accordion.setAttribute('role', 'list');

    analysis.what_could_change_my_mind.forEach((item, i) => {
      const accordionItem = el('div', 'accordion__item');
      accordionItem.setAttribute('role', 'listitem');

      const trigger = el('button', 'accordion__trigger');
      trigger.setAttribute('type', 'button');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', `wcmm-body-${i}`);
      trigger.id = `wcmm-trigger-${i}`;

      const triggerText = el('span', '', item.belief || `Condition ${i + 1}`);
      const chevron = el('span', 'accordion__chevron');
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▾';
      trigger.appendChild(triggerText);
      trigger.appendChild(chevron);

      const body = el('div', 'accordion__body');
      body.id = `wcmm-body-${i}`;
      body.setAttribute('role', 'region');
      body.setAttribute('aria-labelledby', `wcmm-trigger-${i}`);

      const card = el('div', 'wcmm-card');

      if (item.assumption_supporting_it) {
        const row = el('div', 'wcmm-card__row');
        row.appendChild(el('span', 'wcmm-card__label', 'Assumption supporting it'));
        row.appendChild(el('p', 'wcmm-card__text', item.assumption_supporting_it));
        card.appendChild(row);
      }

      if (item.evidence_that_could_shift_it) {
        const row = el('div', 'wcmm-card__row');
        row.appendChild(el('span', 'wcmm-card__label', 'Evidence that could shift it'));
        row.appendChild(el('p', 'wcmm-card__text', item.evidence_that_could_shift_it));
        card.appendChild(row);
      }

      body.appendChild(card);
      accordionItem.appendChild(trigger);
      accordionItem.appendChild(body);
      accordion.appendChild(accordionItem);

      // Accordion toggle
      trigger.addEventListener('click', () => {
        const isOpen = accordionItem.classList.contains('is-open');
        accordionItem.classList.toggle('is-open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });
    });

    section.appendChild(accordion);
    container.appendChild(section);
  }

  // Fallback if reflection is empty
  if (container.children.length === 0) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('p', 'empty-state__text', 'No reflection content was generated for this analysis.'));
    container.appendChild(empty);
  }
}
