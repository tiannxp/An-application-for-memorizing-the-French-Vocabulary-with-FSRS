import * as fsrs from './node_modules/fsrs.js/dist/fsrs.js.esm.js';

const FOCUS_STORAGE_KEY = 'focusTimerData';
const MOTIVATION_STORAGE_KEY = 'motivationStats.v1';
const DEFAULT_FOCUS_GOAL_MINUTES = 30;
const DEFAULT_REVIEW_GOAL = 30;
const ACTIVE_FOCUS_THRESHOLD_SECONDS = 5 * 60;
const MAX_REVIEW_ELAPSED_MS = 20 * 60 * 1000;
const MIN_REVIEW_ELAPSED_MS = 1500;
const TIMER_QUOTES = [
  '今天不是拼爆发，是把节奏守住。',
  '每一次点击，都在给长期记忆加一道刻痕。',
  '先专注五分钟，大脑就会慢慢进入状态。',
  '稳定复习比偶尔冲刺更强大。',
];
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readJsonStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(key);
    return fallback;
  }
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map((value) => Number(value));
  return new Date(year, (month || 1) - 1, day || 1);
}

function buildRecentDateKeys(days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return getDateKey(date);
  });
}

function formatShortMinutes(seconds) {
  return `${Math.floor(safeNumber(seconds) / 60)}m`;
}

function formatMinuteLabel(seconds) {
  return `${Math.floor(safeNumber(seconds) / 60)} 分钟`;
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(safeNumber(seconds)));
  const minutes = Math.floor(totalSeconds / 60);
  const remainSeconds = totalSeconds % 60;
  return `${minutes}分${remainSeconds}秒`;
}

function formatDateLabel(date = new Date()) {
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${WEEKDAY_LABELS[date.getDay()]}`;
}

function isTypingTarget(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function initializeFocusTimer({ onChange } = {}) {
  const container = document.getElementById('focusTimer');
  if (!container) {
    return {
      getElapsedSeconds: () => 0,
      getTargetMinutes: () => DEFAULT_FOCUS_GOAL_MINUTES,
      subscribe: () => () => {},
    };
  }

  const elapsedTimeElement = container.querySelector('#elapsedTime');
  const tooltipTime = container.querySelector('#tooltipTime');
  const tooltipGoal = container.querySelector('#tooltipGoal');
  const tooltipQuote = container.querySelector('#tooltipQuote');
  const increaseBtn = container.querySelector('#increaseBtn');
  const decreaseBtn = container.querySelector('#decreaseBtn');
  const progressCircle = container.querySelector('.progress-ring-circle');
  const particleContainer = container.querySelector('.particle-container');
  const timerIcon = container.querySelector('.timer-icon i');

  const circleRadius = safeNumber(progressCircle?.getAttribute('r'), 26);
  const circumference = 2 * Math.PI * circleRadius;
  const subscribers = new Set();
  if (typeof onChange === 'function') subscribers.add(onChange);
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const milestoneDefinitions = [
    { key: 'warmup', seconds: 5 * 60, quote: '5 分钟已入轨，节奏开始稳定了。' },
    { key: 'flow', seconds: 15 * 60, quote: '15 分钟到了，注意力已经热起来了。' },
    { key: 'goal30', seconds: 30 * 60, quote: '30 分钟节点达成，这段状态很漂亮。' },
  ];

  let targetMinutes = DEFAULT_FOCUS_GOAL_MINUTES;
  let elapsedSeconds = 0;
  let timerId = null;
  let hoverParticleTimer = null;
  let transientQuote = null;
  let transientQuoteUntil = 0;
  let goalCelebrated = false;
  let isAdjustState = false;
  const triggeredMilestones = new Set();

  if (progressCircle) {
    progressCircle.style.strokeDasharray = `${circumference}`;
    progressCircle.style.strokeDashoffset = `${circumference}`;
  }

  function notify() {
    const snapshot = { dateKey: getDateKey(), targetMinutes, elapsedSeconds };
    subscribers.forEach((listener) => listener(snapshot));
  }

  function save() {
    localStorage.setItem(
      FOCUS_STORAGE_KEY,
      JSON.stringify({
        date: getDateKey(),
        targetMinutes,
        elapsedSeconds,
      }),
    );
  }

  function load() {
    const data = readJsonStorage(FOCUS_STORAGE_KEY, null);
    if (!data) return;

    targetMinutes = safeNumber(data.targetMinutes, DEFAULT_FOCUS_GOAL_MINUTES) || DEFAULT_FOCUS_GOAL_MINUTES;
    elapsedSeconds = data.date === getDateKey() ? safeNumber(data.elapsedSeconds, 0) : 0;
    milestoneDefinitions.forEach((milestone) => {
      if (elapsedSeconds >= milestone.seconds) triggeredMilestones.add(milestone.key);
    });
    goalCelebrated = elapsedSeconds >= targetMinutes * 60;
  }

  function setTransientQuote(message, durationMs = 3200) {
    transientQuote = message;
    transientQuoteUntil = Date.now() + durationMs;
  }

  function createParticle({ burst = false } = {}) {
    if (!particleContainer) return;
    const particle = document.createElement('span');
    particle.className = `particle${burst ? ' burst' : ''}`;
    particle.style.setProperty('--size', `${burst ? 8 + Math.random() * 7 : 6 + Math.random() * 6}px`);
    particle.style.setProperty('--start-x', `${(Math.random() - 0.5) * 22}px`);
    particle.style.setProperty('--start-y', `${burst ? (Math.random() - 0.5) * 10 : 6 + Math.random() * 8}px`);
    particle.style.setProperty('--travel-x', `${(Math.random() - 0.5) * (burst ? 70 : 26)}px`);
    particle.style.setProperty('--travel-y', `${-(burst ? 38 + Math.random() * 36 : 24 + Math.random() * 32)}px`);
    particle.style.setProperty('--duration', `${burst ? 0.8 + Math.random() * 0.25 : 1.45 + Math.random() * 0.5}s`);
    particle.style.setProperty('--opacity', `${burst ? 0.92 : 0.58 + Math.random() * 0.22}`);
    particleContainer.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }

  function startAmbientParticles() {
    container.classList.add('is-awake');
    if (prefersReducedMotion || hoverParticleTimer) return;
    createParticle();
    hoverParticleTimer = window.setInterval(() => createParticle(), 1350);
  }

  function stopAmbientParticles() {
    if (hoverParticleTimer) {
      window.clearInterval(hoverParticleTimer);
      hoverParticleTimer = null;
    }
    if (!isAdjustState) {
      container.classList.remove('is-awake');
    }
  }

  function runMilestonePulse({ burstCount = 7, quote = '' } = {}) {
    if (quote) setTransientQuote(quote);
    if (prefersReducedMotion) return;
    container.classList.remove('milestone-pulse');
    void container.offsetWidth;
    container.classList.add('milestone-pulse');
    window.setTimeout(() => container.classList.remove('milestone-pulse'), 760);
    Array.from({ length: burstCount }).forEach((_, index) => {
      window.setTimeout(() => createParticle({ burst: true }), index * 45);
    });
  }

  function checkMilestones() {
    milestoneDefinitions.forEach((milestone) => {
      if (elapsedSeconds < milestone.seconds || triggeredMilestones.has(milestone.key)) return;
      triggeredMilestones.add(milestone.key);
      runMilestonePulse({
        burstCount: milestone.seconds >= 30 * 60 ? 10 : milestone.seconds >= 15 * 60 ? 8 : 6,
        quote: milestone.quote,
      });
    });

    const reachedGoal = elapsedSeconds >= targetMinutes * 60;
    if (reachedGoal && !goalCelebrated) {
      goalCelebrated = true;
      runMilestonePulse({
        burstCount: 12,
        quote: `今日 ${targetMinutes} 分钟目标已达成，状态很稳。`,
      });
    } else if (!reachedGoal) {
      goalCelebrated = false;
    }
  }

  function syncVisualState(completedRatio) {
    const reachedGoal = completedRatio >= 1;
    container.classList.toggle('goal-reached', reachedGoal);
    if (timerIcon) {
      timerIcon.className = reachedGoal ? 'bi bi-trophy-fill' : 'bi bi-clock';
    }
  }

  function render() {
    const completedRatio = clamp(elapsedSeconds / Math.max(targetMinutes * 60, 1), 0, 1);
    const quoteIndex = Math.min(TIMER_QUOTES.length - 1, Math.floor(completedRatio * TIMER_QUOTES.length));
    const activeQuote = transientQuote && Date.now() < transientQuoteUntil ? transientQuote : TIMER_QUOTES[quoteIndex];

    if (elapsedTimeElement) elapsedTimeElement.textContent = formatShortMinutes(elapsedSeconds);
    if (tooltipTime) tooltipTime.textContent = `已专注：${formatDuration(elapsedSeconds)}`;
    if (tooltipGoal) tooltipGoal.textContent = `今日目标：${targetMinutes} 分钟`;
    if (tooltipQuote) tooltipQuote.textContent = activeQuote;

    if (progressCircle) {
      progressCircle.style.strokeDashoffset = `${circumference * (1 - completedRatio)}`;
    }

    syncVisualState(completedRatio);
  }

  function start() {
    if (timerId) return;
    timerId = window.setInterval(() => {
      elapsedSeconds += 1;
      checkMilestones();
      render();
      save();
      notify();
    }, 1000);
  }

  function setAdjustState(isActive) {
    isAdjustState = Boolean(isActive);
    container.classList.toggle('adjust-state', isAdjustState);
    if (isAdjustState) {
      container.classList.add('is-awake');
    } else if (!hoverParticleTimer) {
      container.classList.remove('is-awake');
    }
  }

  increaseBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    targetMinutes += 5;
    checkMilestones();
    render();
    save();
    notify();
  });

  decreaseBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    targetMinutes = Math.max(5, targetMinutes - 5);
    checkMilestones();
    render();
    save();
    notify();
  });

  container.addEventListener('mouseenter', () => {
    setAdjustState(true);
    startAmbientParticles();
  });
  container.addEventListener('mouseleave', () => {
    setAdjustState(false);
    stopAmbientParticles();
  });
  container.addEventListener('focusin', () => {
    setAdjustState(true);
    startAmbientParticles();
  });
  container.addEventListener('focusout', () => {
    setAdjustState(false);
    stopAmbientParticles();
  });

  load();
  checkMilestones();
  render();
  notify();
  start();

  return {
    getElapsedSeconds: () => elapsedSeconds,
    getTargetMinutes: () => targetMinutes,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      subscribers.add(listener);
      listener({ dateKey: getDateKey(), targetMinutes, elapsedSeconds });
      return () => subscribers.delete(listener);
    },
  };
}

async function main() {
  const { FSRS, Rating, State } = fsrs;
  const scheduler = new FSRS();

  let allCards = [];
  let currentCard = null;
  let dueQueue = [];
  let cardHistory = [];
  let reviewCardsToday = [];
  let cardViewStartedAt = Date.now();

  const reviewGoal = DEFAULT_REVIEW_GOAL;
  const motivationState = readJsonStorage(MOTIVATION_STORAGE_KEY, { days: {} }) || { days: {} };
  const frontExpression = document.getElementById('front-expression');
  const frontContexte = document.getElementById('front-contexte');
  const frontNotes = document.getElementById('front-notes');
  const backExpression = document.getElementById('back-expression');
  const backDefinition = document.getElementById('back-definition');
  const backSynonymes = document.getElementById('back-synonymes');
  const backTraduction = document.getElementById('back-traduction');
  const cardFront = document.getElementById('card-front');
  const cardBack = document.getElementById('card-back');
  const showAnswerBtn = document.getElementById('show-answer-btn');
  const ratingButtons = document.getElementById('rating-buttons');
  const prevCardBtn = document.getElementById('prev-card-btn');
  const cardType = document.getElementById('card-type');
  const progressIndicator = document.getElementById('progress-indicator');
  const examplesOverlay = document.getElementById('examples-overlay');
  const examplesCloseBtn = document.getElementById('examples-close-btn');
  const examplesTitle = document.getElementById('examples-title');
  const examplesContent = document.getElementById('examples-content');
  const showReviewModeBtn = document.getElementById('show-review-mode-btn');
  const reviewModeOverlay = document.getElementById('review-mode-overlay');
  const reviewModeCloseBtn = document.getElementById('review-mode-close-btn');
  const reviewModeTitle = document.getElementById('review-mode-title');
  const reviewList = document.getElementById('review-list-content');
  const reviewListInner = document.querySelector('.review-list-inner');
  const exportButton = document.getElementById('export-archive-button');
  const openAddCardButton = document.getElementById('open-add-card-button');
  const addCardOverlay = document.getElementById('add-card-overlay');
  const addCardBackdrop = addCardOverlay?.querySelector('.add-card-backdrop');
  const closeAddCardButton = document.getElementById('close-add-card-button');
  const addCardToast = document.getElementById('add-card-toast');
  const motivationToggle = document.getElementById('motivation-toggle');
  const motivationShell = document.getElementById('motivation-shell');
  const motivationPrevBtn = document.getElementById('motivation-prev-btn');
  const motivationNextBtn = document.getElementById('motivation-next-btn');
  const motivationDots = Array.from(document.querySelectorAll('.motivation-dot'));
  const motivationTitle = document.getElementById('motivation-title');
  const motivationSubtitle = document.getElementById('motivation-subtitle');
  const streakValue = document.getElementById('streak-value');
  const streakCaption = document.getElementById('streak-caption');
  const focusMinutesValue = document.getElementById('focus-minutes-value');
  const focusMinutesHint = document.getElementById('focus-minutes-hint');
  const reviewCountValue = document.getElementById('review-count-value');
  const reviewCountHint = document.getElementById('review-count-hint');
  const momentumScoreValue = document.getElementById('momentum-score-value');
  const momentumScoreHint = document.getElementById('momentum-score-hint');
  const focusGoalText = document.getElementById('focus-goal-text');
  const reviewGoalText = document.getElementById('review-goal-text');
  const focusGoalBar = document.getElementById('focus-goal-bar');
  const reviewGoalBar = document.getElementById('review-goal-bar');
  const motivationDateLabel = document.getElementById('motivation-date-label');
  const activityStrip = document.getElementById('activity-strip');
  const hudDateLabel = document.getElementById('hud-date-label');
  const hudRing = document.getElementById('hud-ring');
  const hudScoreValue = document.getElementById('hud-score-value');
  const hudScoreCaption = document.getElementById('hud-score-caption');
  const hudTitle = document.getElementById('hud-title');
  const hudSubtitle = document.getElementById('hud-subtitle');
  const hudFocusValue = document.getElementById('hud-focus-value');
  const hudReviewValue = document.getElementById('hud-review-value');
  const hudStreakValue = document.getElementById('hud-streak-value');
  const hudStreakCaption = document.getElementById('hud-streak-caption');
  const hudStreakNumber = document.getElementById('hud-streak-number');
  const hudMetaLabel = document.getElementById('hud-meta-label');
  const hudSparkline = document.getElementById('hud-sparkline');

  let addCardToastTimer = null;
  let motivationPage = 0;
  let motivationTouchStartX = null;
  let reviewFocusIndex = -1;
  let globalRevealState = {
    definition: false,
    context: false,
    translation: false,
  };

  function isMotivationOpen() {
    return document.body.classList.contains('motivation-open');
  }

  function setMotivationOpen(isOpen) {
    document.body.classList.toggle('motivation-open', Boolean(isOpen));
    motivationToggle?.setAttribute('aria-expanded', String(Boolean(isOpen)));
  }

  function toggleMotivationOpen() {
    setMotivationOpen(!isMotivationOpen());
  }

  function setMotivationPage(page) {
    motivationPage = clamp(page, 0, 1);
    motivationShell?.setAttribute('data-page', String(motivationPage));
    motivationPrevBtn && (motivationPrevBtn.disabled = motivationPage === 0);
    motivationNextBtn && (motivationNextBtn.disabled = motivationPage === 1);
    motivationDots.forEach((dot) => {
      const isActive = Number(dot.dataset.page) === motivationPage;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  function shiftMotivationPage(direction) {
    setMotivationPage(motivationPage + direction);
  }

  function saveMotivationState() {
    const dayEntries = Object.entries(motivationState.days || {}).sort((left, right) => left[0].localeCompare(right[0]));
    motivationState.days = Object.fromEntries(dayEntries.slice(-35));
    localStorage.setItem(MOTIVATION_STORAGE_KEY, JSON.stringify(motivationState));
  }

  function ensureMotivationDay(dateKey = getDateKey()) {
    if (!motivationState.days[dateKey]) {
      motivationState.days[dateKey] = {
        focusSeconds: 0,
        reviewCount: 0,
        reviewSeconds: 0,
        targetMinutes: DEFAULT_FOCUS_GOAL_MINUTES,
      };
    }
    return motivationState.days[dateKey];
  }

  function isActiveDay(day) {
    return safeNumber(day?.focusSeconds) >= ACTIVE_FOCUS_THRESHOLD_SECONDS || safeNumber(day?.reviewCount) > 0;
  }

  function calculateStreak() {
    let streak = 0;
    for (const dateKey of buildRecentDateKeys(35).reverse()) {
      const day = motivationState.days[dateKey];
      if (!isActiveDay(day)) {
        if (dateKey === getDateKey()) continue;
        break;
      }
      streak += 1;
    }
    return streak;
  }

  function updateFocusStats(snapshot) {
    const day = ensureMotivationDay(snapshot.dateKey);
    day.focusSeconds = Math.max(safeNumber(day.focusSeconds), safeNumber(snapshot.elapsedSeconds));
    day.targetMinutes = Math.max(5, safeNumber(snapshot.targetMinutes, DEFAULT_FOCUS_GOAL_MINUTES));
    saveMotivationState();
    renderMotivationPanel();
  }

  function mergeReviewSummary(summaryDays = []) {
    summaryDays.forEach((item) => {
      const dateKey = item.day;
      if (!dateKey) return;
      const day = ensureMotivationDay(dateKey);
      day.reviewCount = Math.max(safeNumber(day.reviewCount), safeNumber(item.review_count));
      day.reviewSeconds = Math.max(safeNumber(day.reviewSeconds), Math.round(safeNumber(item.elapsed_ms) / 1000));
    });
    saveMotivationState();
    renderMotivationPanel();
  }

  function syncTodayReviews(cards = []) {
    const todayKey = getDateKey();
    const day = ensureMotivationDay(todayKey);
    const totalReviewSeconds = cards.reduce((sum, card) => sum + Math.round(safeNumber(card.elapsed_ms) / 1000), 0);
    day.reviewCount = Math.max(safeNumber(day.reviewCount), cards.length);
    day.reviewSeconds = Math.max(safeNumber(day.reviewSeconds), totalReviewSeconds);
    saveMotivationState();
    renderMotivationPanel();
  }

  function recordReviewEvent(elapsedMs) {
    const todayKey = getDateKey();
    const day = ensureMotivationDay(todayKey);
    day.reviewCount = safeNumber(day.reviewCount) + 1;
    day.reviewSeconds = safeNumber(day.reviewSeconds) + Math.round(safeNumber(elapsedMs) / 1000);
    saveMotivationState();
    renderMotivationPanel();
  }

  function renderActivityStrip() {
    if (!activityStrip) return;

    const recentKeys = buildRecentDateKeys(7);
    const scores = recentKeys.map((dateKey) => {
      const day = motivationState.days[dateKey] || {};
      const focusScore = clamp(safeNumber(day.focusSeconds) / (DEFAULT_FOCUS_GOAL_MINUTES * 60), 0, 1);
      const reviewScore = clamp(safeNumber(day.reviewCount) / reviewGoal, 0, 1);
      return Math.max((focusScore * 0.55 + reviewScore * 0.45) * 100, isActiveDay(day) ? 16 : 6);
    });
    const maxScore = Math.max(...scores, 20);

    activityStrip.innerHTML = recentKeys
      .map((dateKey, index) => {
        const day = motivationState.days[dateKey] || {};
        const date = dateFromKey(dateKey);
        const isToday = dateKey === getDateKey();
        const active = isActiveDay(day);
        const barHeight = clamp((scores[index] / maxScore) * 100, active ? 16 : 6, 100);
        const classes = ['activity-day'];
        if (active) classes.push('active');
        if (isToday) classes.push('today');
        return `
          <div class="${classes.join(' ')}">
            <div class="activity-bar">
              <div class="activity-bar-track">
                <div class="activity-bar-fill" style="height:${barHeight}%"></div>
              </div>
            </div>
            <div class="activity-day-name">${isToday ? '今天' : WEEKDAY_LABELS[date.getDay()]}</div>
            <div class="activity-day-focus">${formatShortMinutes(day.focusSeconds || 0)}</div>
            <div class="activity-day-words">${safeNumber(day.reviewCount)} 词</div>
          </div>
        `;
      })
      .join('');
  }

  function renderHudSparkline() {
    if (!hudSparkline) return;

    const recentKeys = buildRecentDateKeys(7);
    const scores = recentKeys.map((dateKey) => {
      const day = motivationState.days[dateKey] || {};
      const focusScore = clamp(safeNumber(day.focusSeconds) / (DEFAULT_FOCUS_GOAL_MINUTES * 60), 0, 1);
      const reviewScore = clamp(safeNumber(day.reviewCount) / reviewGoal, 0, 1);
      return Math.max((focusScore * 0.58 + reviewScore * 0.42) * 100, isActiveDay(day) ? 18 : 10);
    });
    const maxScore = Math.max(...scores, 24);

    hudSparkline.innerHTML = recentKeys
      .map((dateKey, index) => {
        const date = dateFromKey(dateKey);
        const day = motivationState.days[dateKey] || {};
        const isToday = dateKey === getDateKey();
        const shortLabel = isToday ? '今天' : WEEKDAY_LABELS[date.getDay()].replace('周', '');
        const barHeight = clamp((scores[index] / maxScore) * 56, 10, 56);
        return `
          <div class="hud-sparkline-day${isToday ? ' today' : ''}">
            <div class="hud-sparkline-rail">
              <div class="hud-sparkline-bar" style="height:${barHeight}px"></div>
            </div>
            <div class="hud-sparkline-label">${shortLabel}</div>
            <div class="hud-sparkline-meta">${Math.floor(safeNumber(day.focusSeconds) / 60)}m</div>
          </div>
        `;
      })
      .join('');
  }

  function renderMotivationPanel() {
    const todayKey = getDateKey();
    const today = ensureMotivationDay(todayKey);
    const focusSeconds = Math.max(safeNumber(today.focusSeconds), focusTimer.getElapsedSeconds());
    const targetMinutes = Math.max(5, focusTimer.getTargetMinutes() || safeNumber(today.targetMinutes, DEFAULT_FOCUS_GOAL_MINUTES));
    const reviewCount = safeNumber(today.reviewCount);
    const reviewSeconds = safeNumber(today.reviewSeconds);
    const focusProgress = clamp(focusSeconds / (targetMinutes * 60), 0, 1);
    const reviewProgress = clamp(reviewCount / reviewGoal, 0, 1);
    const momentumScore = Math.round((focusProgress * 0.52 + reviewProgress * 0.48) * 100);
    const streak = calculateStreak();
    const remainingFocusMinutes = Math.max(targetMinutes - Math.floor(focusSeconds / 60), 0);
    const remainingReviews = Math.max(reviewGoal - reviewCount, 0);
    const hudTitleText = momentumScore >= 100
      ? 'Everything is in place.'
      : streak >= 3
        ? 'Rhythm is settling in.'
        : focusSeconds > 0 || reviewCount > 0
          ? 'Quiet progress, clearly visible.'
          : 'Begin with a calm first step.';
    const hudSubtitleText = `${Math.floor(focusSeconds / 60)}m focus  ·  ${reviewCount} reviews`;
    const hudCaptionText = momentumScore >= 100 ? 'in balance' : streak >= 3 ? 'steady rhythm' : 'quiet rhythm';
    const hudMetaText = momentumScore >= 100
      ? 'A complete day, held with ease.'
      : focusSeconds === 0 && reviewCount === 0
        ? 'Five minutes is enough to warm the line.'
        : remainingFocusMinutes > 0 && remainingReviews > 0
          ? `${remainingFocusMinutes}m more focus or ${remainingReviews} more reviews.`
          : remainingFocusMinutes > 0
            ? `${remainingFocusMinutes}m more focus to settle the ring.`
            : `${remainingReviews} more reviews to settle the ring.`;
    const hudStreakText = streak > 0
      ? `${streak} day${streak === 1 ? '' : 's'} in a row.`
      : 'Your streak begins today.';

    let title = '今天也在稳稳推进法语记忆';
    let subtitle = `已专注 ${formatMinuteLabel(focusSeconds)}，已复习 ${reviewCount} 词。`;
    let momentumHint = '专注和复习双线推进，会更容易坚持。';

    if (focusProgress >= 1 && reviewProgress >= 1) {
      title = '漂亮，今天的双目标已经完成';
      subtitle = `你已经专注 ${formatMinuteLabel(focusSeconds)}，并完成了 ${reviewCount} 词复习。`;
      momentumHint = '可以顺手再巩固几张，把成就感拉满。';
    } else if (reviewCount === 0 && focusSeconds < ACTIVE_FOCUS_THRESHOLD_SECONDS) {
      title = '先拿下第一波 5 分钟，学习状态就会起来';
      subtitle = '开始一轮学习后，这里会实时记录你的专注时长、复习数量和连续学习节奏。';
      momentumHint = '先开始，比开始就完美更重要。';
    } else if (focusProgress >= 1) {
      title = '专注目标已完成，再冲一波复习会很稳';
      momentumHint = `还差 ${Math.max(reviewGoal - reviewCount, 0)} 词，今天的复习目标就能点亮。`;
    } else if (reviewProgress >= 1) {
      title = '复习目标已完成，再多专注一会儿会更扎实';
      momentumHint = `还差 ${Math.max(targetMinutes - Math.floor(focusSeconds / 60), 0)} 分钟，今天的专注目标就达成了。`;
    } else if (reviewCount > 0) {
      title = '节奏已经起来了，继续把今天学满';
      momentumHint = `再专注 ${Math.max(targetMinutes - Math.floor(focusSeconds / 60), 0)} 分钟，或再复习 ${Math.max(reviewGoal - reviewCount, 0)} 词。`;
    }

    if (motivationDateLabel) motivationDateLabel.textContent = formatDateLabel();
    if (motivationTitle) motivationTitle.textContent = title;
    if (motivationSubtitle) motivationSubtitle.textContent = subtitle;
    if (streakValue) streakValue.textContent = String(streak);
    if (streakCaption) {
      streakCaption.textContent = streak > 0
        ? `连续 ${streak} 天有学习动作，保持这个势头。`
        : '从今天开始，把学习热度一点点堆起来。';
    }
    if (focusMinutesValue) focusMinutesValue.textContent = formatMinuteLabel(focusSeconds);
    if (focusMinutesHint) {
      focusMinutesHint.textContent = reviewSeconds > 0
        ? `其中有 ${formatMinuteLabel(reviewSeconds)} 是真实复习操作时长。`
        : '先开始 5 分钟，节奏就会起来。';
    }
    if (reviewCountValue) reviewCountValue.textContent = `${reviewCount} 词`;
    if (reviewCountHint) {
      reviewCountHint.textContent = reviewCount >= reviewGoal
        ? '今日复习目标已经达成，可以继续扩大领先。'
        : `再完成 ${Math.max(reviewGoal - reviewCount, 0)} 词，今日复习目标就会点亮。`;
    }
    if (momentumScoreValue) momentumScoreValue.textContent = `${momentumScore}%`;
    if (momentumScoreHint) momentumScoreHint.textContent = momentumHint;
    if (focusGoalText) focusGoalText.textContent = `${Math.floor(focusSeconds / 60)} / ${targetMinutes} 分钟`;
    if (reviewGoalText) reviewGoalText.textContent = `${reviewCount} / ${reviewGoal} 词`;
    if (focusGoalBar) focusGoalBar.style.width = `${focusProgress * 100}%`;
    if (reviewGoalBar) reviewGoalBar.style.width = `${reviewProgress * 100}%`;
    if (hudDateLabel) hudDateLabel.textContent = formatDateLabel();
    if (hudRing) hudRing.style.setProperty('--hud-progress', `${Math.round(momentumScore * 3.6)}deg`);
    if (hudScoreValue) hudScoreValue.textContent = `${momentumScore}%`;
    if (hudScoreCaption) hudScoreCaption.textContent = hudCaptionText;
    if (hudTitle) hudTitle.textContent = hudTitleText;
    if (hudSubtitle) hudSubtitle.textContent = `专注 ${formatMinuteLabel(focusSeconds)} · 复习 ${reviewCount} 词`;
    if (hudFocusValue) hudFocusValue.textContent = `${Math.floor(focusSeconds / 60)}m`;
    if (hudReviewValue) hudReviewValue.textContent = `${reviewCount}`;
    if (hudStreakValue) hudStreakValue.textContent = `${streak}d`;
    if (hudStreakCaption) hudStreakCaption.textContent = streak > 0 ? `连续 ${streak} 天有学习动作。` : '从今天开始，把节奏一点点堆起来。';
    if (hudStreakNumber) hudStreakNumber.textContent = String(streak);
    if (hudMetaLabel) hudMetaLabel.textContent = momentumHint;

    if (hudSubtitle) hudSubtitle.textContent = hudSubtitleText;
    if (hudStreakCaption) hudStreakCaption.textContent = hudStreakText;
    if (hudMetaLabel) hudMetaLabel.textContent = hudMetaText;

    renderActivityStrip();
    renderHudSparkline();
  }

  let focusTimer = {
    getElapsedSeconds: () => 0,
    getTargetMinutes: () => DEFAULT_FOCUS_GOAL_MINUTES,
  };
  focusTimer = initializeFocusTimer({ onChange: updateFocusStats });

  function hydrateCard(card) {
    const fsrsState = {
      due: card.fsrsState?.due || card.due || null,
      stability: card.fsrsState?.stability ?? card.stability ?? null,
      difficulty: card.fsrsState?.difficulty ?? card.difficulty ?? null,
      reps: card.fsrsState?.reps ?? card.reps ?? 0,
      lapses: card.fsrsState?.lapses ?? card.lapses ?? 0,
      last_review: card.fsrsState?.last_review || card.last_review || null,
      state: card.fsrsState?.state ?? card.state ?? State.New,
    };

    return {
      ...card,
      synonymes: Array.isArray(card.synonymes) ? card.synonymes : [],
      fsrsState: {
        ...fsrsState,
        due: fsrsState.due ? new Date(fsrsState.due) : null,
        last_review: fsrsState.last_review ? new Date(fsrsState.last_review) : null,
      },
    };
  }

  function serializeFsrsState(state) {
    return {
      due: state.due ? state.due.toISOString() : null,
      stability: state.stability ?? null,
      difficulty: state.difficulty ?? null,
      reps: state.reps ?? 0,
      lapses: state.lapses ?? 0,
      last_review: state.last_review ? state.last_review.toISOString() : null,
      state: state.state ?? State.New,
    };
  }

  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  async function refreshMotivationSummary() {
    try {
      const payload = await apiFetch('/api/review/summary?days=7');
      mergeReviewSummary(payload.days || []);
    } catch (error) {
      console.warn('Unable to load review summary:', error);
    }
  }

  function buildDueQueue() {
    const now = new Date();
    const dueReviewCards = allCards.filter(
      (card) => card.fsrsState.state !== State.New && card.fsrsState.due && card.fsrsState.due <= now,
    );
    const newCards = allCards.filter((card) => card.fsrsState.state === State.New);
    dueQueue = [...dueReviewCards, ...newCards];
    dueQueue.sort(() => Math.random() - 0.5);
  }

  function updateProgressIndicator() {
    progressIndicator.textContent = currentCard ? `队列剩余: ${dueQueue.length}` : '队列: 0';
    renderMotivationPanel();
  }

  function updatePrevCardBtn() {
    if (cardHistory.length === 0) {
      prevCardBtn.style.display = 'none';
      return;
    }
    const prevCard = cardHistory[cardHistory.length - 1];
    prevCardBtn.style.display = 'inline-block';
    prevCardBtn.textContent = prevCard.expression || '上一张';
  }

  function showCompletionScreen() {
    cardFront.innerHTML = `
      <h3 class="text-center">Felicitations !</h3>
      <p class="text-center text-muted mt-3">今天这一轮已经学完了，休息一下也很棒。</p>
    `;
    cardFront.style.display = 'block';
    cardBack.style.display = 'none';
    showAnswerBtn.style.display = 'none';
    ratingButtons.style.display = 'none';
    cardType.textContent = '';
    prevCardBtn.style.display = 'none';
    progressIndicator.textContent = '队列: 0';
    currentCard = null;
    renderMotivationPanel();
  }

  function showCard(cardObject, side = 'question') {
    if (!cardObject) return;

    frontExpression.textContent = cardObject.expression || '';
    frontContexte.textContent = cardObject.contexte || '';
    frontNotes.innerHTML = '';

    if (cardObject.notes) {
      const note = document.createElement('p');
      note.textContent = cardObject.notes;
      frontNotes.appendChild(note);
    }

    backExpression.textContent = cardObject.expression || '';
    backDefinition.innerHTML = cardObject.definition_fr || '';
    backSynonymes.innerHTML = (cardObject.synonymes || []).join(', ');
    backTraduction.innerHTML = cardObject.traduction_zh || '';
    cardType.textContent = cardObject.type || '';

    if (side === 'question') {
      cardFront.style.display = 'block';
      cardBack.style.display = 'none';
      showAnswerBtn.style.display = 'block';
      ratingButtons.style.display = 'none';
      cardViewStartedAt = Date.now();
    } else {
      cardFront.style.display = 'none';
      cardBack.style.display = 'block';
      showAnswerBtn.style.display = 'none';
      ratingButtons.style.display = 'flex';
    }
  }

  function displayNextCard() {
    if (currentCard) cardHistory.push(currentCard);
    if (dueQueue.length === 0) {
      showCompletionScreen();
      return;
    }
    currentCard = dueQueue.shift();
    showCard(currentCard, 'question');
    updateProgressIndicator();
    updatePrevCardBtn();
  }

  function goBack() {
    if (cardHistory.length === 0) return;
    if (currentCard) dueQueue.unshift(currentCard);
    currentCard = cardHistory.pop();
    showCard(currentCard, 'question');
    updateProgressIndicator();
    updatePrevCardBtn();
  }

  function openModal(node) {
    node?.classList.add('active');
  }

  function closeModal(node) {
    node?.classList.remove('active');
  }

  function openAddCardPanel() {
    addCardOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAddCardPanel() {
    addCardOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  function toggleAddCardPanel() {
    if (addCardOverlay?.classList.contains('active')) {
      closeAddCardPanel();
    } else {
      openAddCardPanel();
    }
  }

  function closeReviewMode() {
    reviewFocusIndex = -1;
    resetGlobalRevealState();
    reviewListInner.style.transform = 'translateY(0)';
    getReviewItems().forEach((item) => {
      item.classList.remove('focused');
      item.dataset.revealStep = '0';
    });
    closeModal(reviewModeOverlay);
  }

  function showAddCardToast(message) {
    if (!addCardToast) return;
    addCardToast.textContent = message;
    addCardToast.classList.add('active');
    window.clearTimeout(addCardToastTimer);
    addCardToastTimer = window.setTimeout(() => {
      addCardToast.classList.remove('active');
    }, 2200);
  }

  function mergeCreatedCards(cards) {
    const createdCards = (cards || []).map(hydrateCard);
    if (createdCards.length === 0) return 0;

    let added = 0;
    createdCards.forEach((card) => {
      const existingIndex = allCards.findIndex((item) => String(item.id) === String(card.id));
      if (existingIndex >= 0) {
        allCards[existingIndex] = card;
        return;
      }
      allCards.push(card);
      dueQueue.push(card);
      added += 1;
    });

    updateProgressIndicator();
    if (!currentCard && dueQueue.length > 0) {
      displayNextCard();
    }
    return added;
  }

  function getReviewItems() {
    return Array.from(reviewListInner?.querySelectorAll('.review-item') || []);
  }

  function resetGlobalRevealState() {
    globalRevealState = {
      definition: false,
      context: false,
      translation: false,
    };
  }

  function updateReviewView() {
    const allItems = getReviewItems();
    if (!allItems.length) return;

    allItems.forEach((item, index) => {
      item.classList.toggle('focused', index === reviewFocusIndex);
    });

    if (reviewFocusIndex < 0 || !reviewList) {
      reviewListInner.style.transform = 'translateY(0)';
      return;
    }

    const currentItem = allItems[reviewFocusIndex];
    if (!currentItem) return;
    const viewportCenter = reviewList.offsetHeight / 2;
    const itemCenter = currentItem.offsetTop + (currentItem.offsetHeight / 2);
    const maxScroll = Math.max(reviewListInner.offsetHeight - reviewList.offsetHeight, 0);
    const scrollOffset = clamp(itemCenter - viewportCenter, 0, maxScroll);
    reviewListInner.style.transform = `translateY(-${scrollOffset}px)`;
  }

  function moveReviewFocus(direction) {
    const allItems = getReviewItems();
    if (!allItems.length) return;

    const oldFocusIndex = reviewFocusIndex;
    if (reviewFocusIndex < 0) {
      reviewFocusIndex = direction > 0 ? 0 : allItems.length - 1;
    } else {
      reviewFocusIndex = (reviewFocusIndex + direction + allItems.length) % allItems.length;
    }

    const inScanMode = globalRevealState.definition || globalRevealState.context || globalRevealState.translation;
    if (!inScanMode && oldFocusIndex >= 0 && allItems[oldFocusIndex]) {
      allItems[oldFocusIndex].dataset.revealStep = '0';
    }

    updateReviewView();
  }

  function toggleGlobalReveal(mode) {
    const allItems = getReviewItems();
    if (!allItems.length) return;

    const targetStepMap = { definition: 1, context: 2, translation: 3 };
    const targetStep = targetStepMap[mode];
    const nextValue = !globalRevealState[mode];

    resetGlobalRevealState();
    globalRevealState[mode] = nextValue;

    allItems.forEach((item) => {
      item.dataset.revealStep = nextValue ? String(targetStep) : '0';
    });

    updateReviewView();
  }

  function showExamples(cardObject, revealTranslations = true) {
    if (!cardObject) return;

    examplesTitle.textContent = `${cardObject.expression} · 例句`;
    examplesContent.classList.toggle('translations-visible', revealTranslations);
    examplesContent.innerHTML = '';

    const exampleKeys = ['ex1', 'ex2', 'EX1', 'EX2'];
    let hasExamples = false;

    for (const key of exampleKeys) {
      if (!cardObject[key]) continue;
      hasExamples = true;
      const match = String(cardObject[key]).match(/^(.*?)\s*\((.*?)\)\.?$/);
      const frenchPart = match ? match[1].trim() : String(cardObject[key]);
      const chinesePart = match ? match[2].trim() : '';
      const item = document.createElement('div');
      item.className = 'example-item';
      item.innerHTML = `
        <div class="example-french">${frenchPart}</div>
        <div class="example-chinese">${chinesePart}</div>
      `;
      examplesContent.appendChild(item);
    }

    if (!hasExamples) {
      examplesContent.innerHTML = '<p class="text-center text-muted" style="padding:2rem;">这张卡片暂时还没有例句。</p>';
    }

    openModal(examplesOverlay);
  }

  async function loadCards() {
    const payload = await apiFetch('/api/cards/due?limit=200&new_limit=60');
    allCards = (payload.cards || []).map(hydrateCard);
    buildDueQueue();
    displayNextCard();
  }

  async function syncReview(userRating) {
    if (!currentCard) return;

    const now = new Date();
    const rawElapsedMs = now.getTime() - cardViewStartedAt;
    const elapsedMs = clamp(rawElapsedMs, MIN_REVIEW_ELAPSED_MS, MAX_REVIEW_ELAPSED_MS);
    const schedulingCards = scheduler.repeat(currentCard.fsrsState, now);
    const nextState = schedulingCards[userRating].card;

    const payload = await apiFetch(`/api/cards/${currentCard.id}/review`, {
      method: 'POST',
      body: JSON.stringify({
        rating: userRating,
        fsrs_state: serializeFsrsState(nextState),
        reviewed_at: now.toISOString(),
        elapsed_ms: elapsedMs,
      }),
    });

    const updatedCard = hydrateCard(payload.card);
    const index = allCards.findIndex((card) => String(card.id) === String(updatedCard.id));
    if (index >= 0) allCards[index] = updatedCard;
    currentCard = updatedCard;

    if (userRating === Rating.Again) {
      dueQueue.splice(Math.min(dueQueue.length, 3), 0, updatedCard);
    }

    recordReviewEvent(elapsedMs);
    displayNextCard();
  }

  async function loadReviewToday() {
    const payload = await apiFetch('/api/review/today');
    reviewCardsToday = (payload.cards || []).map(hydrateCard);
    syncTodayReviews(reviewCardsToday);
  }

  async function showReviewMode() {
    try {
      await loadReviewToday();
    } catch (error) {
      alert(`加载今日回顾失败：${error.message}`);
      return;
    }

    reviewModeTitle.textContent = `今日回顾 (${reviewCardsToday.length} 张)`;
    const reviewedToday = [...reviewCardsToday].sort(
      (left, right) => safeNumber(right.fsrsState?.difficulty) - safeNumber(left.fsrsState?.difficulty),
    );
    reviewListInner.innerHTML = '';
    reviewFocusIndex = -1;
    resetGlobalRevealState();
    reviewListInner.style.transform = 'translateY(0)';

    reviewModeTitle.textContent = `浠婃棩鍥為【 (${reviewedToday.length} 寮?`;

    reviewModeTitle.textContent = `今日回顾 (${reviewedToday.length} 张)`;

    if (reviewedToday.length === 0) {
      reviewListInner.innerHTML = '<div class="text-center text-muted" style="padding:2rem;">今天还没有复习任何卡片。</div>';
      openModal(reviewModeOverlay);
      return;
    }

    reviewedToday.forEach((card) => {
      const item = document.createElement('div');
      item.className = 'review-item';
      item.dataset.revealStep = '0';
      item.dataset.cardId = String(card.id);
      const difficulty = card.fsrsState.difficulty || 0;

      item.innerHTML = `
        <div class="review-item-main">
          <div class="difficulty-badge">${difficulty.toFixed(2)}</div>
          <div class="review-item-info">
            <div class="review-item-expression">
              <span>${card.expression}</span>
              <span class="word-type">${card.type || ''}</span>
            </div>
            <div class="review-item-details">
              <div class="detail-step detail-definition"><span class="detail-label"><i class="bi bi-book"></i></span><span class="detail-text">${card.definition_fr || ''}</span></div>
              <div class="detail-step detail-context"><span class="detail-label"><i class="bi bi-chat-right-quote"></i></span><span class="detail-text">${card.contexte || ''}</span></div>
              <div class="detail-step detail-translation"><span class="detail-label"><i class="bi bi-translate"></i></span><span class="detail-text">${card.traduction_zh || ''}</span></div>
            </div>
          </div>
        </div>
        <div class="review-item-actions">
          <button class="btn-show-examples">例句</button>
        </div>
      `;

      item.querySelector('.btn-show-examples')?.addEventListener('click', (event) => {
        event.stopPropagation();
        reviewFocusIndex = reviewedToday.findIndex((entry) => String(entry.id) === String(card.id));
        updateReviewView();
        showExamples(card, false);
      });
      item.querySelector('.review-item-info')?.addEventListener('click', () => {
        reviewFocusIndex = reviewedToday.findIndex((entry) => String(entry.id) === String(card.id));
        updateReviewView();
        showExamples(card, false);
      });
      reviewListInner.appendChild(item);
    });

    updateReviewView();
    openModal(reviewModeOverlay);
  }

  async function exportArchive() {
    const originalText = exportButton.textContent;
    exportButton.disabled = true;
    exportButton.textContent = '导出中...';
    try {
      window.location.href = '/api/export/json';
      exportButton.textContent = '导出完成';
    } finally {
      window.setTimeout(() => {
        exportButton.disabled = false;
        exportButton.textContent = originalText;
      }, 1200);
    }
  }

  showAnswerBtn?.addEventListener('click', () => showCard(currentCard, 'answer'));
  prevCardBtn?.addEventListener('click', goBack);
  examplesCloseBtn?.addEventListener('click', () => closeModal(examplesOverlay));
  examplesOverlay?.addEventListener('click', (event) => {
    if (event.target === examplesOverlay) closeModal(examplesOverlay);
  });
  showReviewModeBtn?.addEventListener('click', showReviewMode);
  reviewModeCloseBtn?.addEventListener('click', closeReviewMode);
  reviewModeOverlay?.addEventListener('click', (event) => {
    if (event.target === reviewModeOverlay) closeReviewMode();
  });
  reviewModeOverlay?.addEventListener('wheel', (event) => {
    if (!reviewModeOverlay.classList.contains('active')) return;
    const allItems = getReviewItems();
    if (!allItems.length) return;
    event.preventDefault();
    moveReviewFocus(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  exportButton?.addEventListener('click', exportArchive);
  openAddCardButton?.addEventListener('click', toggleAddCardPanel);
  closeAddCardButton?.addEventListener('click', closeAddCardPanel);
  addCardBackdrop?.addEventListener('click', closeAddCardPanel);
  motivationToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMotivationOpen();
  });
  motivationPrevBtn?.addEventListener('click', () => shiftMotivationPage(-1));
  motivationNextBtn?.addEventListener('click', () => shiftMotivationPage(1));
  motivationDots.forEach((dot) => {
    dot.addEventListener('click', () => setMotivationPage(Number(dot.dataset.page || 0)));
  });

  motivationShell?.addEventListener('touchstart', (event) => {
    motivationTouchStartX = event.touches[0]?.clientX ?? null;
  }, { passive: true });

  motivationShell?.addEventListener('touchend', (event) => {
    if (motivationTouchStartX == null) return;
    const touchEndX = event.changedTouches[0]?.clientX ?? motivationTouchStartX;
    const deltaX = touchEndX - motivationTouchStartX;
    motivationTouchStartX = null;
    if (Math.abs(deltaX) < 42) return;
    shiftMotivationPage(deltaX < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('click', (event) => {
    if (!isMotivationOpen()) return;
    if (motivationShell?.contains(event.target)) return;
    if (motivationToggle?.contains(event.target)) return;
    setMotivationOpen(false);
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'cards-created') return;
    const added = mergeCreatedCards(event.data.cards);
    const count = event.data.count || added;
    showAddCardToast(`已加入 ${count} 张新卡片`);
  });

  Array.from(ratingButtons?.querySelectorAll('button') || []).forEach((button) => {
    button.addEventListener('click', async () => {
      const ratingMapping = {
        again: Rating.Again,
        hard: Rating.Hard,
        good: Rating.Good,
        easy: Rating.Easy,
      };
      const rating = ratingMapping[button.dataset.rating];
      try {
        await syncReview(rating);
      } catch (error) {
        alert(`保存复习结果失败：${error.message}`);
      }
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (isTypingTarget(event.target)) return;

    if (addCardOverlay?.classList.contains('active')) {
      if (event.key === 'Escape' || event.key.toLowerCase() === 'a') {
        event.preventDefault();
        closeAddCardPanel();
      }
      return;
    }

    if (event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (typeof toggleAddCardPanel === 'function') {
        toggleAddCardPanel();
      } else {
        openAddCardPanel();
      }
      return;
    }

    if (examplesOverlay.classList.contains('active')) {
      event.preventDefault();
      if (event.key === 'ArrowRight') {
        examplesContent.classList.toggle('translations-visible');
      } else if (event.key === 'ArrowLeft' || event.key === 'Escape' || event.key.toLowerCase() === 'q') {
        closeModal(examplesOverlay);
      }
      return;
    }

    if (reviewModeOverlay.classList.contains('active')) {
      const allItems = getReviewItems();
      const scanKeyMap = { ',': 'definition', '.': 'context', '/': 'translation' };

      if (scanKeyMap[event.key]) {
        event.preventDefault();
        toggleGlobalReveal(scanKeyMap[event.key]);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) {
        event.preventDefault();
      } else {
        return;
      }

      if (event.key === 'Escape') {
        closeReviewMode();
        return;
      }

      if (!allItems.length) {
        return;
      }

      if (event.key === 'ArrowUp') {
        moveReviewFocus(-1);
        return;
      }

      if (event.key === 'ArrowDown') {
        moveReviewFocus(1);
        return;
      }

      if (reviewFocusIndex < 0) {
        reviewFocusIndex = 0;
        updateReviewView();
      }

      const currentItem = allItems[reviewFocusIndex];
      if (!currentItem) return;

      if (event.key === 'ArrowRight') {
        const currentStep = parseInt(currentItem.dataset.revealStep || '0', 10);
        if (currentStep < 3) {
          currentItem.dataset.revealStep = String(currentStep + 1);
        } else {
          currentItem.dataset.revealStep = '4';
          const cardId = currentItem.dataset.cardId;
          const cardData = allCards.find((card) => String(card.id) === String(cardId));
          if (cardData) showExamples(cardData, false);
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        const currentStep = parseInt(currentItem.dataset.revealStep || '0', 10);
        if (currentStep > 0) {
          currentItem.dataset.revealStep = String(currentStep - 1);
        }
        return;
      }
    }

    if (event.key === 'Escape' && isMotivationOpen()) {
      event.preventDefault();
      setMotivationOpen(false);
      return;
    }

    if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      toggleMotivationOpen();
      return;
    }

    if (isMotivationOpen()) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        shiftMotivationPage(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        shiftMotivationPage(1);
      }
      return;
    }

    if (event.key.toLowerCase() === 'q' && cardBack.style.display === 'block') {
      event.preventDefault();
      showExamples(currentCard, true);
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      if (showAnswerBtn.style.display !== 'none') {
        showAnswerBtn.click();
      } else {
        ratingButtons.querySelector('[data-rating="good"]')?.click();
      }
      return;
    }

    const keyMap = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
    if (ratingButtons.style.display !== 'none' && keyMap[event.key]) {
      event.preventDefault();
      ratingButtons.querySelector(`[data-rating="${keyMap[event.key]}"]`)?.click();
    }
  });

  setMotivationPage(0);
  renderMotivationPanel();
  await refreshMotivationSummary();

  try {
    await Promise.all([loadCards(), loadReviewToday()]);
  } catch (error) {
    console.error(error);
    frontExpression.textContent = '加载卡片失败';
    showAnswerBtn.style.display = 'none';
  }
}

main().catch((error) => {
  console.error('Application bootstrap failed:', error);
});
