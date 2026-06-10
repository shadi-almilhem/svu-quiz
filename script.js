document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const quizContainer = document.getElementById("quiz-container");
  const resultContainer = document.getElementById("result-container");
  const resetBtn = document.getElementById("reset-btn");
  const actionsBar = document.querySelector(".actions");
  const fileStatus = document.getElementById("file-status");
  const filePickerLabel = document.getElementById("file-picker-label");
  const slidesShell = document.getElementById("slides-shell");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const finishBtn = document.getElementById("finish-btn");
  const progressText = document.getElementById("progress-text");
  const progressFill = document.getElementById("progress-fill");
  const progressMeter = document.querySelector(".progress .meter");
  const shortcutsBar = document.getElementById("shortcuts-bar");
  const submitConfirmDialog = document.getElementById("submit-confirm");
  const submitConfirmText = document.getElementById(
    "submit-confirm-text",
  );
  const confirmSubmitBtn = document.getElementById("confirm-submit-btn");
  const cancelSubmitBtn = document.getElementById("cancel-submit-btn");
  const heroTitle = document.getElementById("hero-title");

  let quizData = null;
  let polls = [];
  let currentIndex = 0;
  let userAnswers = []; // For single-select: number or null; For multi-select: array of numbers or null
  let isSubmitted = false;
  let currentFileName = "";
  let currentSubject = "الاختبار"; // Default subject name for share
  let instantFeedbackEnabled = false; // Show correct answer immediately
  let feedbackShownForQuestion = []; // Track which questions have shown instant feedback
  let bookmarkedQuestionIds = [];
  let studyQueueIndices = null;

  // LocalStorage configuration
  const STORAGE_KEY = "quizProgress";
  const CHAPTER_STORAGE_KEY = "chapterProgress";
  const SCORE_HISTORY_KEY = "quizScoreHistory";
  const EXPIRY_DAYS = 7;
  const MAX_SCORE_HISTORY = 10;

  // =============================================
  // GAMIFICATION STATE
  // =============================================
  const QUESTIONS_PER_CHAPTER = 50;
  const TIMER_DURATION = 30; // seconds

  let timerInterval = null;
  let timerSeconds = TIMER_DURATION;
  let timerPaused = false;
  let questionsAnsweredInSession = 0;
  let lastMilestoneShown = 0;
  let chapterProgress = {}; // { chapterNum: { answered: [], completed: false } }

  // Chapter colors
  const CHAPTER_COLORS = {
    1: "#7c3aed",
    2: "#3b82f6",
    3: "#22c55e",
    4: "#f59e0b",
    5: "#ec4899",
    6: "#06b6d4",
    7: "#10b981",
  };

  // Chapter motivations (Arabic)
  const CHAPTER_MOTIVATIONS = [
    { emoji: "🚀", text: "انطلق بقوة! البداية هي نصف النجاح" },
    { emoji: "💪", text: "أنت في الطريق الصحيح! استمر" },
    { emoji: "🔥", text: "حماسك رائع! النصف الأول اكتمل تقريباً" },
    { emoji: "⭐", text: "نجم ساطع! تجاوزت النصف" },
    { emoji: "🏆", text: "قريب من القمة! لا تستسلم الآن" },
    { emoji: "👑", text: "لقد اقتربت من النهاية! أنت بطل" },
    { emoji: "🎉", text: "بقي لك القليل!" },
  ];

  // Milestone messages (Arabic)
  const MILESTONE_MESSAGES = {
    50: {
      emoji: "🔥",
      title: "50 سؤال متتالي!",
      subtitle: "عمل رائع! استمر بهذا المستوى",
    },
    100: {
      emoji: "💯",
      title: "100 سؤال!",
      subtitle: "أنت نجم! نصف الطريق اكتمل",
    },
    150: { emoji: "🌟", title: "150 سؤال!", subtitle: "لا يمكن إيقافك!" },
    200: {
      emoji: "🏆",
      title: "200 سؤال!",
      subtitle: "أسطورة! تقترب من النهاية",
    },
    250: { emoji: "👑", title: "250 سؤال!", subtitle: "ملك الاختبارات!" },
    300: { emoji: "🎯", title: "أكملت الجميع!", subtitle: "إنجاز خارق!" },
  };

  function saveProgress() {
    if (!polls.length) return;

    const state = {
      quizData: quizData,
      polls: polls,
      currentIndex: currentIndex,
      userAnswers: userAnswers,
      isSubmitted: isSubmitted,
      fileName: currentFileName,
      currentSubject: currentSubject,
      timestamp: Date.now(),
      // Gamification state
      questionsAnsweredInSession: questionsAnsweredInSession,
      lastMilestoneShown: lastMilestoneShown,
      // New features state
      instantFeedbackEnabled: instantFeedbackEnabled,
      feedbackShownForQuestion: feedbackShownForQuestion,
      bookmarkedQuestionIds: bookmarkedQuestionIds,
      studyQueueIndices: studyQueueIndices,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save quiz progress:", e);
    }
  }

  function saveChapterProgress() {
    try {
      localStorage.setItem(
        CHAPTER_STORAGE_KEY,
        JSON.stringify(chapterProgress),
      );
    } catch (e) {
      console.warn("Failed to save chapter progress:", e);
    }
  }

  function loadChapterProgress() {
    try {
      const saved = localStorage.getItem(CHAPTER_STORAGE_KEY);
      if (saved) {
        chapterProgress = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to load chapter progress:", e);
      chapterProgress = {};
    }
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return (hash >>> 0).toString(36);
  }

  function getQuestionId(questionIndex) {
    const poll = polls[questionIndex]?.poll;
    if (!poll) return `q-${questionIndex}`;

    const answers = (poll.answers || [])
      .map((answer) => answer?.text || "")
      .join("|");
    return `q-${hashString(`${poll.question || ""}|${answers}`)}`;
  }

  function isQuestionBookmarked(questionIndex) {
    return bookmarkedQuestionIds.includes(getQuestionId(questionIndex));
  }

  function toggleBookmark(questionIndex) {
    const questionId = getQuestionId(questionIndex);
    if (bookmarkedQuestionIds.includes(questionId)) {
      bookmarkedQuestionIds = bookmarkedQuestionIds.filter(
        (id) => id !== questionId,
      );
    } else {
      bookmarkedQuestionIds = [...bookmarkedQuestionIds, questionId];
    }
    saveProgress();
    renderSlide();
  }

  function hasActiveStudyQueue() {
    return Array.isArray(studyQueueIndices) && studyQueueIndices.length > 0;
  }

  function getAllQuestionIndices() {
    return polls.map((_, index) => index);
  }

  function getActiveQuestionIndices() {
    if (!hasActiveStudyQueue()) return getAllQuestionIndices();

    return studyQueueIndices.filter(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < polls.length,
    );
  }

  function getActiveQuestionPosition(questionIndex) {
    const activeIndices = getActiveQuestionIndices();
    const position = activeIndices.indexOf(questionIndex);
    return position === -1 ? 0 : position;
  }

  function getNextActiveQuestionIndex(direction) {
    const activeIndices = getActiveQuestionIndices();
    const position = activeIndices.indexOf(currentIndex);
    const nextIndex = activeIndices[position + direction];
    return Number.isInteger(nextIndex) ? nextIndex : -1;
  }

  function hasUserAnswer(questionIndex) {
    const selectedAnswer = userAnswers[questionIndex];
    return Array.isArray(selectedAnswer)
      ? selectedAnswer.length > 0
      : selectedAnswer !== null;
  }

  function getBookmarkedQuestionNumbers() {
    const numbers = [];
    for (let i = 0; i < polls.length; i++) {
      if (isQuestionBookmarked(i)) numbers.push(i + 1);
    }
    return numbers;
  }

  function loadScoreHistory() {
    try {
      const saved = localStorage.getItem(SCORE_HISTORY_KEY);
      const history = saved ? JSON.parse(saved) : [];
      return Array.isArray(history) ? history : [];
    } catch (e) {
      console.warn("Failed to load score history:", e);
      return [];
    }
  }

  function saveScoreHistory(summary) {
    try {
      const entry = {
        subject: currentSubject || currentFileName || "الاختبار",
        score: summary.score,
        total: summary.total,
        percentage: summary.percentage,
        answered: summary.answeredCount,
        wrong: summary.incorrectCount,
        unanswered: summary.unansweredCount,
        timestamp: Date.now(),
      };
      const history = [entry, ...loadScoreHistory()].slice(
        0,
        MAX_SCORE_HISTORY,
      );
      localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn("Failed to save score history:", e);
    }
  }

  function formatHistoryDate(timestamp) {
    try {
      return new Intl.DateTimeFormat("ar", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(timestamp));
    } catch (e) {
      return "";
    }
  }

  function buildScoreHistoryHtml() {
    const history = loadScoreHistory();
    if (!history.length) return "";

    const rows = history
      .map(
        (entry) => `
          <li class="history-item">
            <div>
              <span class="history-subject">${escapeHtml(entry.subject)}</span>
              <span class="history-date">${formatHistoryDate(entry.timestamp)}</span>
            </div>
            <strong>${entry.percentage}%</strong>
            <span>${entry.score} / ${entry.total}</span>
          </li>
        `,
      )
      .join("");

    return `
      <section class="score-history" aria-label="آخر المحاولات">
        <h3>آخر المحاولات</h3>
        <ol>${rows}</ol>
      </section>
    `;
  }

  // =============================================
  // TIMER SYSTEM
  // =============================================

  // Reset timer to initial value but keep paused state
  function resetTimer() {
    stopTimer();
    timerSeconds = TIMER_DURATION;
    updateTimerDisplay();

    // Start the interval but it will only count if not paused
    timerInterval = setInterval(() => {
      if (!timerPaused && !isSubmitted) {
        timerSeconds--;
        updateTimerDisplay();

        if (timerSeconds <= 0) {
          // Time's up - auto advance to next question
          stopTimer();
          const nextIndex = getNextActiveQuestionIndex(1);
          if (nextIndex !== -1) {
            goTo(nextIndex);
          }
        }
      }
    }, 1000);
  }

  // Start timer fresh (unpaused)
  function startTimer() {
    timerPaused = false;
    updateTimerPauseButton(); // Sync button visual with paused state
    resetTimer();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function toggleTimerPause() {
    timerPaused = !timerPaused;
    updateTimerPauseButton();
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById("question-timer");
    if (!timerEl) return;

    const seconds = Math.max(0, timerSeconds);
    timerEl.textContent = seconds + "ث";

    // Update color based on time
    timerEl.classList.remove("warning", "danger");
    if (seconds <= 5) {
      timerEl.classList.add("danger");
    } else if (seconds <= 15) {
      timerEl.classList.add("warning");
    }
  }

  function updateTimerPauseButton() {
    const pauseBtn = document.getElementById("timer-pause-btn");
    if (!pauseBtn) return;

    pauseBtn.classList.toggle("paused", timerPaused);
    pauseBtn.innerHTML = timerPaused
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    pauseBtn.title = timerPaused ? "استئناف" : "إيقاف مؤقت";
  }

  // Pause timer when user navigates away
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && timerInterval && !timerPaused) {
      timerPaused = true;
      updateTimerPauseButton();
    }
  });

  // =============================================
  // CHAPTER SYSTEM
  // =============================================
  function getChapterForQuestion(questionIndex) {
    return Math.floor(questionIndex / QUESTIONS_PER_CHAPTER) + 1;
  }

  function getChapterRange(chapterNum) {
    const start = (chapterNum - 1) * QUESTIONS_PER_CHAPTER;
    const end = Math.min(
      start + QUESTIONS_PER_CHAPTER - 1,
      polls.length - 1,
    );
    return { start, end };
  }

  function getTotalChapters() {
    return Math.ceil(polls.length / QUESTIONS_PER_CHAPTER);
  }

  function getCurrentChapter() {
    return getChapterForQuestion(currentIndex);
  }

  function getChapterColor(chapterNum) {
    return CHAPTER_COLORS[chapterNum] || CHAPTER_COLORS[1];
  }

  function isChapterCompleted(chapterNum) {
    const { start, end } = getChapterRange(chapterNum);
    for (let i = start; i <= end; i++) {
      if (userAnswers[i] === null) return false;
    }
    return true;
  }

  function renderChapterProgress() {
    const container = document.getElementById(
      "chapter-progress-container",
    );
    if (!container) return;

    const totalChapters = getTotalChapters();
    const currentChapter = getCurrentChapter();

    let html = "";
    for (let i = 1; i <= totalChapters; i++) {
      const isActive = i === currentChapter;
      const isCompleted = isChapterCompleted(i);
      const { start, end } = getChapterRange(i);
      const answeredInChapter = userAnswers
        .slice(start, end + 1)
        .filter((a) => a !== null).length;
      const totalInChapter = end - start + 1;

      html += `
        <button type="button" 
                class="chapter-dot ${isActive ? "active" : ""} ${
                  isCompleted ? "completed" : ""
                }" 
                data-chapter="${i}"
                onclick="window.jumpToChapter(${i})"
                title="الفصل ${i}: ${answeredInChapter}/${totalInChapter}">
          ${i}
        </button>
      `;
    }
    container.innerHTML = html;
  }

  function renderChapterMotivation() {
    const container = document.getElementById(
      "chapter-motivation-container",
    );
    if (!container) return;

    const currentChapter = getCurrentChapter();
    const motivation =
      CHAPTER_MOTIVATIONS[currentChapter - 1] || CHAPTER_MOTIVATIONS[0];
    const chapterColor = getChapterColor(currentChapter);

    container.innerHTML = `
      <span class="motivation-emoji">${motivation.emoji}</span>
      <span class="motivation-text">
        <span class="chapter-label" style="color: ${chapterColor}">الفصل ${currentChapter}</span>
        - ${motivation.text}
      </span>
      <label class="toggle-container" title="عند التفعيل، يظهر الإجابة الصحيحة مباشرة بعد الاختيار">
        <span class="toggle-label">عرض النتيجة فوراً</span>
        <input type="checkbox" class="toggle-switch" id="instant-feedback-toggle" ${
          instantFeedbackEnabled ? "checked" : ""
        }>
      </label>
    `;
    container.style.borderColor = chapterColor + "40";

    // Add toggle event listener
    const toggle = container.querySelector("#instant-feedback-toggle");
    if (toggle) {
      toggle.addEventListener("change", (e) => {
        instantFeedbackEnabled = e.target.checked;
        saveProgress();
      });
    }
  }

  // Global function for chapter navigation
  window.jumpToChapter = function (chapterNum) {
    const { start } = getChapterRange(chapterNum);
    if (start < polls.length) {
      // If in review mode, stay in review mode
      goTo(start);
    }
  };

  // =============================================
  // MILESTONE SYSTEM
  // =============================================
  function checkMilestone() {
    const milestones = [50, 100, 150, 200, 250, 300];

    for (const milestone of milestones) {
      if (
        questionsAnsweredInSession >= milestone &&
        lastMilestoneShown < milestone
      ) {
        lastMilestoneShown = milestone;

        // Skip milestone notification if chapter completion will also trigger
        // (to avoid showing two overlapping dialogs)
        const currentChapter = getCurrentChapter();
        const willTriggerChapterComplete =
          isChapterCompleted(currentChapter) &&
          !chapterProgress[currentChapter]?.completed;

        if (!willTriggerChapterComplete) {
          showMilestoneNotification(milestone);
          triggerMilestoneConfetti();
        }

        updateProgressBarGlow();
        break;
      }
    }
  }

  function showMilestoneNotification(milestone) {
    const msg = MILESTONE_MESSAGES[milestone] || MILESTONE_MESSAGES[50];

    const notification = document.createElement("div");
    notification.className = "milestone-notification";
    notification.innerHTML = `
      <span class="milestone-emoji">${msg.emoji}</span>
      <div class="milestone-title">${msg.title}</div>
      <div class="milestone-subtitle">${msg.subtitle}</div>
    `;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 400);
    }, 3000);
  }

  function updateProgressBarGlow() {
    if (!progressMeter) return;
    const currentChapter = getCurrentChapter();
    const color = getChapterColor(currentChapter);

    progressMeter.classList.add("milestone-glow");
    progressMeter.style.color = color;

    setTimeout(() => {
      progressMeter.classList.remove("milestone-glow");
    }, 2000);
  }

  // =============================================
  // CONFETTI ANIMATIONS
  // =============================================

  // Basic confetti cannon - used for milestones
  function triggerMilestoneConfetti() {
    if (typeof confetti !== "function") return;

    // Basic cannon from https://www.kirilv.com/canvas-confetti/#basic
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }

  // Basic confetti for chapter completion
  function triggerChapterCompleteConfetti() {
    if (typeof confetti !== "function") return;

    // Simple basic cannon burst
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
    });
  }

  // Fireworks animation for exam completion - runs for 3 seconds
  // Based on https://www.kirilv.com/canvas-confetti/#fireworks
  function triggerExamCompleteFireworks() {
    if (typeof confetti !== "function") return;

    const duration = 3 * 1000; // 3 seconds
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
    };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Shoot confetti from two sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  }

  // =============================================
  // CHAPTER COMPLETION
  // =============================================
  function checkChapterCompletion(previousIndex) {
    const prevChapter = getChapterForQuestion(previousIndex);

    // Check if we just completed a chapter
    if (
      isChapterCompleted(prevChapter) &&
      !chapterProgress[prevChapter]?.completed
    ) {
      markChapterComplete(prevChapter);
    }
  }

  // Check if current chapter is completed (called when answering a question)
  function checkCurrentChapterCompletion() {
    const currentChapter = getCurrentChapter();

    if (
      isChapterCompleted(currentChapter) &&
      !chapterProgress[currentChapter]?.completed
    ) {
      markChapterComplete(currentChapter);
    }
  }

  function markChapterComplete(chapterNum) {
    if (!chapterProgress[chapterNum]) {
      chapterProgress[chapterNum] = { answered: [], completed: false };
    }
    chapterProgress[chapterNum].completed = true;
    saveChapterProgress();
    showChapterCompleteBanner(chapterNum);
    triggerChapterCompleteConfetti();
  }

  function showChapterCompleteBanner(chapterNum) {
    let banner = document.getElementById("chapter-complete-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "chapter-complete-banner";
      banner.className = "chapter-complete-banner";
      document.body.appendChild(banner);
    }

    const color = getChapterColor(chapterNum);
    const { start, end } = getChapterRange(chapterNum);
    const totalInChapter = end - start + 1;
    const totalChapters = getTotalChapters();

    // Color variations for dark accents
    const colorDark = {
      "#7c3aed": "#5b21b6",
      "#3b82f6": "#1d4ed8",
      "#22c55e": "#15803d",
      "#f59e0b": "#d97706",
      "#ec4899": "#be185d",
      "#06b6d4": "#0891b2",
      "#10b981": "#047857",
    };

    // Celebration messages based on progress
    const messages = [
      "🚀 بداية رائعة! استمر بهذا الحماس",
      "💪 أنت في الطريق الصحيح! لا تتوقف",
      "🔥 نصف الطريق! أنت نجم",
      "⭐ أداء مذهل! القمة قريبة",
      "🏆 شبه منتهي! أنت أسطورة",
      "👑 الفصل الأخير! ملك الاختبارات",
      "🎯 رائع! استمر",
    ];
    const message = messages[chapterNum - 1] || messages[6];

    // Set CSS custom properties for chapter colors
    banner.style.setProperty("--chapter-accent", color);
    banner.style.setProperty(
      "--chapter-accent-dark",
      colorDark[color] || color,
    );
    banner.style.setProperty("--chapter-bg", color + "20");
    banner.style.setProperty("--chapter-shadow", color + "50");
    banner.style.setProperty("--chapter-glow", color + "60");

    banner.innerHTML = `
      <div class="banner-header">
        <span class="complete-emoji">🎉</span>
        <span class="chapter-badge">الفصل ${chapterNum} من ${totalChapters}</span>
        <h2>أكملت الفصل بنجاح!</h2>
      </div>
      <div class="banner-body">
        <div class="stats-mini">
          <div class="stat-item">
            <span class="stat-num">${totalInChapter}</span>
            <span class="stat-label">سؤال مكتمل</span>
          </div>
          <div class="stat-item">
            <span class="stat-num">${totalChapters - chapterNum}</span>
            <span class="stat-label">فصول متبقية</span>
          </div>
        </div>
        <p class="motivation-text">${message}</p>
        <button type="button" class="continue-btn" onclick="document.getElementById('chapter-complete-banner').classList.remove('show')">
          متابعة للفصل التالي ←
        </button>
      </div>
    `;

    requestAnimationFrame(() => {
      banner.classList.add("show");
    });

    // Auto hide after 6 seconds
    setTimeout(() => {
      banner.classList.remove("show");
    }, 6000);
  }

  function loadProgress() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return false;

      const state = JSON.parse(saved);

      // Check if expired (7 days)
      const now = Date.now();
      const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (now - state.timestamp > expiryMs) {
        clearProgress();
        return false;
      }

      // Validate data
      if (
        !state.quizData ||
        !state.polls ||
        !Array.isArray(state.polls) ||
        !Array.isArray(state.userAnswers)
      ) {
        clearProgress();
        return false;
      }

      // Restore state
      quizData = state.quizData;
      polls = state.polls;
      currentIndex = state.currentIndex || 0;
      userAnswers = state.userAnswers;
      isSubmitted = state.isSubmitted || false;
      currentFileName = state.fileName || "";
      currentSubject = state.currentSubject || state.fileName || "الاختبار";

      // Restore gamification state
      questionsAnsweredInSession = state.questionsAnsweredInSession || 0;
      lastMilestoneShown = state.lastMilestoneShown || 0;

      // Restore new features state
      instantFeedbackEnabled = state.instantFeedbackEnabled || false;
      feedbackShownForQuestion =
        state.feedbackShownForQuestion ||
        new Array(polls.length).fill(false);
      bookmarkedQuestionIds = Array.isArray(state.bookmarkedQuestionIds)
        ? state.bookmarkedQuestionIds
        : [];
      studyQueueIndices = Array.isArray(state.studyQueueIndices)
        ? state.studyQueueIndices.filter(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < polls.length,
          )
        : null;
      if (Array.isArray(studyQueueIndices) && !studyQueueIndices.length) {
        studyQueueIndices = null;
      }
      if (
        hasActiveStudyQueue() &&
        !studyQueueIndices.includes(currentIndex)
      ) {
        currentIndex = studyQueueIndices[0];
      }

      // Load chapter progress
      loadChapterProgress();

      // Update UI
      fileStatus.textContent = currentFileName || "تم استعادة التقدم";
      if (filePickerLabel) filePickerLabel.classList.add("has-file");

      // Hide hero title
      if (heroTitle) {
        heroTitle.classList.add("hidden");
      }

      // Show slides UI
      slidesShell.style.display = "block";
      setShortcutsVisible(true);

      if (isSubmitted) {
        finishBtn.style.display = "none";
        resetBtn.style.display = "block";
        // Re-run evaluation to show results
        evaluateQuizWithoutSave();
      } else {
        finishBtn.style.display = "inline-flex";
        resetBtn.style.display = "none";
        // Start timer for current question
        startTimer();
      }

      syncActionsVisibility();
      renderSlide();

      // Show notification
      showRestoreNotification();

      return true;
    } catch (e) {
      console.warn("Failed to load quiz progress:", e);
      clearProgress();
      return false;
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CHAPTER_STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear quiz progress:", e);
    }
  }

  function showRestoreNotification() {
    const notification = document.createElement("div");
    notification.className = "restore-notification";
    notification.textContent = "تم استعادة التقدم السابق ✓";
    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  const loadGistBtn = document.getElementById("load-gist-btn");
  const gistBtnText = document.getElementById("gist-btn-text");
  const subjectSelectDialog = document.getElementById(
    "subject-select-dialog",
  );

  // CORS proxy for Pastebin URLs
  const CORS_PROXY = "https://api.allorigins.win/raw?url=";

  // Subjects configuration with primary (Gist) and fallback (Pastebin) URLs
  const SUBJECTS = {
    SDE601: {
      name: "SDE601",
      displayName: "SDE601 - هندسة البرمجيات",
      gistUrl:
        "https://gist.githubusercontent.com/shadi-almilhem/d91dfcd5675574ba6cae5b25bab74850/raw/34b96471e00ecd7e3d069e203f947a98a75c489e/sde601-quiz.json",
      pastebinUrl:
        CORS_PROXY +
        encodeURIComponent("https://pastebin.com/raw/iqtRyraD"),
    },
    DNL601: {
      name: "DNL601",
      displayName: "DNL601 - قواعد البيانات",
      gistUrl:
        "https://gist.githubusercontent.com/shadi-almilhem/9227deedd357197d0c38ad619c832856/raw/9b907c3a5497a8ebc0cb5a819bbefee728a93b08/dnl601-quiz.json",
      pastebinUrl:
        CORS_PROXY +
        encodeURIComponent("https://pastebin.com/raw/2SCYhaNw"),
    },
    SDB601: {
      name: "SDB601",
      displayName: "SDB601 - قواعد البيانات 2",
      gistUrl:
        "https://gist.githubusercontent.com/shadi-almilhem/e196e16c4532b3170632c768f06f2935/raw/0d73dc8b97f3a023504cbc64a41e40f186783c26/SDB601-quiz.json",
      pastebinUrl:
        CORS_PROXY +
        encodeURIComponent("https://pastebin.com/raw/UQ2zW3SR"),
    },
    DPD601: {
      name: "DPD601",
      displayName: "DPD601 - برمجة خاصة بعلم البيانات",
      gistUrl:
        "https://gist.githubusercontent.com/shadi-almilhem/16e019cb54cd1045e9553f3a3184e44f/raw/2656198e92de9f6de9e27f1513336838b9e06cdb/dpd601-quiz.json",
      pastebinUrl:
        CORS_PROXY +
        encodeURIComponent("https://pastebin.com/raw/MdYuYwqz"),
    },
    BIS601: {
      name: "BIS601",
      displayName: "BIS601 - برمجة أمن نظم المعلومات",
      gistUrl:
        "https://gist.githubusercontent.com/shadi-almilhem/3e148c489e72e8b907930d7ad658f71e/raw/de4c4c21cbfb9e57554d946e67f1dd4cda452bf7/BIS601-quiz.json",
      pastebinUrl:
        CORS_PROXY +
        encodeURIComponent("https://pastebin.com/raw/pqLdA6Jh"),
    },
    DDV601: {
      name: "DDV601",
      displayName: "DDV601 - التمثيل المرئي للبيانات",
      gistUrl:
        "https://gist.githubusercontent.com/shadi-almilhem/9196da9dc544ff886308eb4f0e5b90f8/raw/df316060cd71f90ca16066b2e6f18771d3315b98/DDV601-quiz.json",
      pastebinUrl:
        CORS_PROXY +
        encodeURIComponent("https://pastebin.com/raw/cqpu3Uuv"),
    },
  };

  fileInput.addEventListener("change", handleFileSelect);
  // Allow selecting the same file again to re-trigger "change" (and reshuffle).
  fileInput.addEventListener("click", () => {
    fileInput.value = "";
  });

  // Fetch with timeout helper
  function fetchWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("Request timeout"));
      }, timeoutMs);

      fetch(url, { signal: controller.signal })
        .then((response) => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Fetch with fallback - tries primary URL, falls back to secondary on failure/timeout
  async function fetchWithFallback(
    primaryUrl,
    fallbackUrl,
    timeoutMs = 20000,
  ) {
    try {
      console.log("Trying primary URL...");
      const response = await fetchWithTimeout(primaryUrl, timeoutMs);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return { response, usedFallback: false };
    } catch (primaryError) {
      console.warn("Primary URL failed:", primaryError.message);
      console.log("Trying fallback URL...");

      try {
        const response = await fetchWithTimeout(fallbackUrl, timeoutMs);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return { response, usedFallback: true };
      } catch (fallbackError) {
        console.error("Fallback URL also failed:", fallbackError.message);
        throw new Error("Both primary and fallback URLs failed");
      }
    }
  }

  // Show subject selection dialog
  loadGistBtn.addEventListener("click", () => {
    if (loadGistBtn.disabled) return;
    subjectSelectDialog.showModal();
  });

  // Handle subject selection
  async function loadSubject(subjectKey) {
    const subject = SUBJECTS[subjectKey];
    if (!subject) return;

    // Close dialog
    subjectSelectDialog.close();

    // Show loading state
    loadGistBtn.disabled = true;
    const originalText = gistBtnText.textContent;
    gistBtnText.innerHTML = " جاري التحميل...";

    try {
      const { response, usedFallback } = await fetchWithFallback(
        subject.gistUrl,
        subject.pastebinUrl,
        20000, // 20 seconds timeout
      );
      const data = await response.json();

      // Clear any existing saved progress when loading from gist
      clearProgress();
      quizData = data;
      currentFileName = `تم تحميل ${subject.name}`;
      currentSubject = subject.name;
      fileStatus.textContent = currentFileName;
      if (filePickerLabel) filePickerLabel.classList.add("has-file");
      loadQuiz();
      resetBtn.style.display = "none";
      syncActionsVisibility();

      // Show success notification
      const successMsg = usedFallback
        ? `تم تحميل أسئلة ${subject.name} من المصدر البديل ✓`
        : `تم تحميل أسئلة ${subject.name} بنجاح ✓`;
      showGistLoadNotification(successMsg);
    } catch (error) {
      console.error("Failed to load quiz data:", error);
      showGistLoadNotification("فشل تحميل الأسئلة. حاول مرة أخرى.", true);
    } finally {
      // Restore button state
      loadGistBtn.disabled = false;
      gistBtnText.textContent = originalText;
    }
  }

  // Make loadSubject available globally for dialog buttons
  window.loadSubject = loadSubject;

  // Download subject JSON file
  async function downloadSubjectJson(subjectKey) {
    const subject = SUBJECTS[subjectKey];
    if (!subject) return;

    try {
      const { response } = await fetchWithFallback(
        subject.gistUrl,
        subject.pastebinUrl,
        20000,
      );
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${subjectKey.toLowerCase()}-quiz.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showGistLoadNotification(`✅ تم تنزيل ملف ${subjectKey}`);
    } catch (error) {
      console.error("Download failed:", error);
      showGistLoadNotification(`❌ فشل تنزيل ملف ${subjectKey}`, true);
    }
  }

  // Make downloadSubjectJson available globally
  window.downloadSubjectJson = downloadSubjectJson;

  // Copy JSON template to clipboard
  async function copyJsonTemplate(btn) {
    const pre = btn.closest("pre");
    const code = pre.querySelector("code");
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code.textContent);
      btn.classList.add("copied");
      btn.querySelector("span").textContent = "تم النسخ ✓";

      setTimeout(() => {
        btn.classList.remove("copied");
        btn.querySelector("span").textContent = "نسخ";
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  // Make copyJsonTemplate available globally
  window.copyJsonTemplate = copyJsonTemplate;

  // Cancel subject selection
  document
    .getElementById("cancel-subject-btn")
    ?.addEventListener("click", () => {
      subjectSelectDialog.close();
    });

  function showGistLoadNotification(message, isError = false) {
    const notification = document.createElement("div");
    notification.className = "restore-notification";
    notification.textContent = message;
    if (isError) {
      notification.style.borderColor = "rgba(239, 68, 68, 0.4)";
      notification.style.background = "rgba(239, 68, 68, 0.15)";
      notification.style.color = "var(--danger)";
    }
    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function shuffleInPlace(arr) {
    // Fisher–Yates
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Escape HTML entities to prevent XSS and render text like <class 'list'> correctly
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function syncActionsVisibility() {
    if (!actionsBar) return;
    const hasVisibleChild = Array.from(actionsBar.children).some(
      (child) =>
        child instanceof HTMLElement &&
        window.getComputedStyle(child).display !== "none",
    );
    actionsBar.style.display = hasVisibleChild ? "flex" : "none";
  }

  syncActionsVisibility();

  function setShortcutsVisible(visible) {
    if (!shortcutsBar) return;
    shortcutsBar.hidden = !visible;
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          // Clear any existing saved progress when loading new file
          clearProgress();
          quizData = JSON.parse(e.target.result);
          currentFileName = `تم تحميل الملف: ${file.name}`;
          // Extract subject from filename (e.g., "sde601-quiz.json" -> "SDE601")
          const subjectMatch = file.name.match(/([a-zA-Z]{3}\d{3})/i);
          currentSubject = subjectMatch
            ? subjectMatch[1].toUpperCase()
            : file.name.replace(/\.json$/i, "");
          fileStatus.textContent = file.name;
          if (filePickerLabel) filePickerLabel.classList.add("has-file");
          loadQuiz();
          resetBtn.style.display = "none";
          syncActionsVisibility();
        } catch (error) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    }
  }

  function loadQuiz() {
    // Hide hero title
    if (heroTitle) {
      heroTitle.classList.add("hidden");
    }

    quizContainer.innerHTML = "";
    resultContainer.innerHTML = "";
    resultContainer.style.display = "none";

    polls = (quizData?.messages || []).filter((e) => e.poll);
    shuffleInPlace(polls);
    if (!polls.length) {
      slidesShell.style.display = "none";
      setShortcutsVisible(false);
      quizContainer.innerHTML =
        '<div class="question"><h2>لا يوجد أسئلة (Polls) في هذا الملف.</h2><p class="hint">تأكد أن ملف JSON يحتوي على messages[].poll</p></div>';
      return;
    }

    // Init slides state
    currentIndex = 0;
    userAnswers = new Array(polls.length).fill(null);
    isSubmitted = false;

    // Reset gamification state for new quiz
    questionsAnsweredInSession = 0;
    lastMilestoneShown = 0;
    chapterProgress = {};

    // Reset new features state
    feedbackShownForQuestion = new Array(polls.length).fill(false);
    bookmarkedQuestionIds = [];
    studyQueueIndices = null;
    // Keep instantFeedbackEnabled as user preference

    // Show slides UI and scoring button
    slidesShell.style.display = "block";
    setShortcutsVisible(true);
    resetBtn.style.display = "none";
    syncActionsVisibility();
    finishBtn.style.display = "inline-flex";

    renderSlide();
    startTimer(); // Start the timer for the first question
  }

  function getCorrectAnswerIndex(questionIndex) {
    return polls[questionIndex]?.poll?.answers?.findIndex(
      (a) => a.chosen || a.correct,
    );
  }

  // Get all correct answer indices for a question (for multi-select)
  function getAllCorrectAnswerIndices(questionIndex) {
    const answers = polls[questionIndex]?.poll?.answers || [];
    const correctIndices = [];
    answers.forEach((a, idx) => {
      if (a.chosen || a.correct) {
        correctIndices.push(idx);
      }
    });
    return correctIndices;
  }

  // Check if a question is multi-select (has multiple correct answers)
  function isMultiSelectQuestion(questionIndex) {
    const correctIndices = getAllCorrectAnswerIndices(questionIndex);
    return correctIndices.length > 1;
  }

  function getAnswerText(questionIndex, answerIndex) {
    const q = polls[questionIndex];
    if (!q) return "";
    const ans = q.poll?.answers?.[answerIndex];
    return ans?.text || "";
  }

  function renderSlide() {
    if (!polls.length) return;

    const total = polls.length;
    const activeIndices = getActiveQuestionIndices();
    const activePosition = getActiveQuestionPosition(currentIndex);
    const activeTotal = activeIndices.length || total;
    const isStudyMode = hasActiveStudyQueue();
    const q = polls[currentIndex];
    const isMultiSelect = isMultiSelectQuestion(currentIndex);
    const selectedAnswer = userAnswers[currentIndex]; // number for single, array for multi, or null
    const correctAnswerIndex = getCorrectAnswerIndex(currentIndex);
    const allCorrectIndices = getAllCorrectAnswerIndices(currentIndex);
    const currentChapter = getCurrentChapter();
    const chapterColor = getChapterColor(currentChapter);
    const feedbackShown = feedbackShownForQuestion[currentIndex] || false;
    const isBookmarked = isQuestionBookmarked(currentIndex);

    progressText.textContent = isStudyMode
      ? `تدريب ${activePosition + 1} / ${activeTotal}`
      : `سؤال ${currentIndex + 1} / ${total}`;
    progressFill.style.width = `${Math.round(
      ((isStudyMode ? activePosition + 1 : currentIndex + 1) /
        (isStudyMode ? activeTotal : total)) *
        100,
    )}%`;
    progressFill.style.background = chapterColor;

    // Update nav button states (review-only navigation when submitted)
    if (isSubmitted) {
      const reviewable = getReviewableQuestions();
      const currentPosInReview = reviewable.indexOf(currentIndex);
      prevBtn.disabled = currentPosInReview <= 0;
      nextBtn.disabled =
        currentPosInReview >= reviewable.length - 1 ||
        currentPosInReview === -1;
      // Update progress text for review mode
      if (reviewable.length > 0) {
        const posInReview =
          currentPosInReview !== -1 ? currentPosInReview + 1 : 1;
        progressText.textContent = `مراجعة ${posInReview} / ${reviewable.length}`;
      }
    } else {
      prevBtn.disabled = getNextActiveQuestionIndex(-1) === -1;
      nextBtn.disabled = getNextActiveQuestionIndex(1) === -1;
    }

    quizContainer.innerHTML = "";

    // Render chapter progress dots
    renderChapterProgress();

    // Render chapter motivation
    renderChapterMotivation();

    const questionEl = document.createElement("div");
    questionEl.className = "question slide-enter";

    // Check if answer is correct for styling
    const hasAnswer = isMultiSelect
      ? Array.isArray(selectedAnswer) && selectedAnswer.length > 0
      : selectedAnswer !== null;

    let isAnswerCorrect = false;
    if (hasAnswer && allCorrectIndices.length > 0) {
      if (isMultiSelect && Array.isArray(selectedAnswer)) {
        // For multi-select: check if arrays match exactly
        const sortedSelected = [...selectedAnswer].sort((a, b) => a - b);
        const sortedCorrect = [...allCorrectIndices].sort(
          (a, b) => a - b,
        );
        isAnswerCorrect =
          sortedSelected.length === sortedCorrect.length &&
          sortedSelected.every((v, i) => v === sortedCorrect[i]);
      } else if (!isMultiSelect) {
        isAnswerCorrect = selectedAnswer === correctAnswerIndex;
      }
    }

    if (isSubmitted || feedbackShown) {
      if (!hasAnswer) {
        questionEl.classList.add("unanswered-question");
      } else if (allCorrectIndices.length === 0) {
        questionEl.classList.add("unanswered-question");
      } else if (isAnswerCorrect) {
        questionEl.classList.add("correct-question");
      } else {
        questionEl.classList.add("incorrect-question");
      }
    }

    if (feedbackShown && !isSubmitted) {
      questionEl.classList.add("feedback-locked");
    }

    // Timer HTML (only show when not submitted)
    const timerHtml = !isSubmitted
      ? `
      <div class="timer-container">
        <span class="timer-display" id="question-timer">${timerSeconds}ث</span>
        <button type="button" class="timer-btn ${
          timerPaused ? "paused" : ""
        }" id="timer-pause-btn" title="${
          timerPaused ? "استئناف" : "إيقاف مؤقت"
        }">
          ${
            timerPaused
              ? '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
          }
        </button>
      </div>
    `
      : "";

    // Multi-select badge
    const multiSelectBadge = isMultiSelect
      ? `<span class="multi-select-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          متعدد الاختيارات
         </span>`
      : "";
    const studyModeBadge = isStudyMode
      ? `<span class="study-mode-badge">تدريب الأخطاء</span>`
      : "";

    // Status text
    let statusText = "يمكنك تخطي السؤال";
    if (feedbackShown) {
      statusText = isAnswerCorrect ? "✓ إجابة صحيحة" : "✗ إجابة خاطئة";
    } else if (hasAnswer) {
      statusText = isMultiSelect
        ? `تم اختيار ${
            Array.isArray(selectedAnswer) ? selectedAnswer.length : 0
          } إجابات`
        : "تم اختيار إجابة";
    }

    questionEl.innerHTML = `
      <div class="question-meta">
        <div class="meta-badges">
          <span class="chapter-info-badge" data-chapter="${currentChapter}">الفصل ${currentChapter}</span>
          <span class="badge"><strong>${
            currentIndex + 1
          }</strong> / ${total}</span>
          ${multiSelectBadge}
          ${studyModeBadge}
        </div>
        <div class="meta-status">
          <span class="question-status">${statusText}</span>
          <button
            type="button"
            class="bookmark-btn ${isBookmarked ? "active" : ""}"
            id="bookmark-question-btn"
            aria-pressed="${isBookmarked ? "true" : "false"}"
            title="${isBookmarked ? "إزالة من المحفوظات" : "حفظ السؤال"}"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4.75C6 3.78 6.78 3 7.75 3h8.5C17.22 3 18 3.78 18 4.75v15.5l-6-3.3-6 3.3V4.75Z"/>
            </svg>
          </button>
          ${timerHtml}
        </div>
      </div>
      <h2>${escapeHtml(q.poll.question)}</h2>
    `;

    const answersEl = document.createElement("ul");
    answersEl.className = "answers";

    const shouldWarnNoAnswer =
      isSubmitted && (!hasAnswer || allCorrectIndices.length === 0);
    if (shouldWarnNoAnswer) {
      answersEl.classList.add("noanswer");
    }

    // Add instant-feedback class if feedback is shown
    if (feedbackShown && !isSubmitted) {
      answersEl.classList.add("instant-feedback");
    }

    const inputType = isMultiSelect ? "checkbox" : "radio";
    const inputName = isMultiSelect
      ? `multi-question-${currentIndex}`
      : "slide-question";

    q.poll.answers.forEach((answer, answerIndex) => {
      const li = document.createElement("li");
      li.className = "choice";

      let isChecked = false;
      if (isMultiSelect && Array.isArray(selectedAnswer)) {
        isChecked = selectedAnswer.includes(answerIndex);
      } else if (!isMultiSelect) {
        isChecked = selectedAnswer === answerIndex;
      }

      const disabled = isSubmitted || feedbackShown;
      const isCorrectAnswer = allCorrectIndices.includes(answerIndex);

      li.innerHTML = `
        <label>
          <input type="${inputType}" name="${inputName}" value="${answerIndex}" ${
            isChecked ? "checked" : ""
          } ${disabled ? "disabled" : ""}>
          <kbd class="answer-key">${answerIndex + 1}</kbd>
          <span class="answer-text">${escapeHtml(answer.text)}</span>
        </label>
      `;

      // Apply feedback styling
      if (
        (isSubmitted || feedbackShown) &&
        !shouldWarnNoAnswer &&
        allCorrectIndices.length > 0
      ) {
        const label = li.querySelector("label");

        if (isCorrectAnswer) {
          label.classList.add("correct");
          if (feedbackShown && !isSubmitted) {
            li.classList.add("feedback-correct");
          }
        }

        if (isChecked && !isCorrectAnswer) {
          label.classList.add("incorrect");
          if (feedbackShown && !isSubmitted) {
            li.classList.add("feedback-incorrect");
          }
        }
      }

      answersEl.appendChild(li);
    });

    questionEl.appendChild(answersEl);

    // Add submit button for multi-select questions (only if not submitted and no feedback shown)
    if (isMultiSelect && !isSubmitted && !feedbackShown) {
      const submitMultiBtn = document.createElement("button");
      submitMultiBtn.type = "button";
      submitMultiBtn.className = "submit-multi-btn";
      submitMultiBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        تأكيد الاختيارات والمتابعة
      `;
      submitMultiBtn.disabled =
        !Array.isArray(selectedAnswer) || selectedAnswer.length === 0;
      questionEl.appendChild(submitMultiBtn);
    }

    quizContainer.appendChild(questionEl);

    // Add timer pause button event
    const pauseBtn = document.getElementById("timer-pause-btn");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", toggleTimerPause);
    }

    const bookmarkBtn = document.getElementById("bookmark-question-btn");
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener("click", () => {
        toggleBookmark(currentIndex);
      });
    }

    if (!isSubmitted && !feedbackShown) {
      if (isMultiSelect) {
        // Multi-select checkbox handling
        const checkboxes = quizContainer.querySelectorAll(
          `input[type="checkbox"][name="${inputName}"]`,
        );
        checkboxes.forEach((checkbox) => {
          checkbox.addEventListener("change", (e) => {
            const answerIdx = parseInt(e.target.value);

            if (!Array.isArray(userAnswers[currentIndex])) {
              userAnswers[currentIndex] = [];
            }

            if (e.target.checked) {
              if (!userAnswers[currentIndex].includes(answerIdx)) {
                userAnswers[currentIndex].push(answerIdx);
              }
            } else {
              userAnswers[currentIndex] = userAnswers[
                currentIndex
              ].filter((idx) => idx !== answerIdx);
            }

            // Update submit button state
            const submitBtn =
              quizContainer.querySelector(".submit-multi-btn");
            if (submitBtn) {
              submitBtn.disabled = userAnswers[currentIndex].length === 0;
            }

            saveProgress();
          });
        });

        // Submit multi-select button
        const submitMultiBtn =
          quizContainer.querySelector(".submit-multi-btn");
        if (submitMultiBtn) {
          submitMultiBtn.addEventListener("click", () => {
            handleAnswerSubmission(true);
          });
        }
      } else {
        // Single-select radio handling
        const radios = quizContainer.querySelectorAll(
          'input[type="radio"][name="slide-question"]',
        );
        radios.forEach((radio) => {
          radio.addEventListener("change", (e) => {
            const previousAnswer = userAnswers[currentIndex];
            userAnswers[currentIndex] = parseInt(e.target.value);

            handleAnswerSubmission(previousAnswer === null);
          });
        });
      }
    }
  }

  // Handle answer submission (for both single and multi-select)
  function handleAnswerSubmission(isNewAnswer) {
    const isMultiSelect = isMultiSelectQuestion(currentIndex);

    // Track answered questions for milestones
    if (isNewAnswer) {
      questionsAnsweredInSession++;
      checkMilestone();
      checkCurrentChapterCompletion();
    }

    // Show instant feedback if enabled
    if (instantFeedbackEnabled) {
      feedbackShownForQuestion[currentIndex] = true;

      // Check if answer is correct
      const allCorrectIndices = getAllCorrectAnswerIndices(currentIndex);
      const selectedAnswer = userAnswers[currentIndex];
      let isAnswerCorrect = false;

      if (allCorrectIndices.length > 0) {
        if (isMultiSelect && Array.isArray(selectedAnswer)) {
          const sortedSelected = [...selectedAnswer].sort(
            (a, b) => a - b,
          );
          const sortedCorrect = [...allCorrectIndices].sort(
            (a, b) => a - b,
          );
          isAnswerCorrect =
            sortedSelected.length === sortedCorrect.length &&
            sortedSelected.every((v, i) => v === sortedCorrect[i]);
        } else if (!isMultiSelect) {
          isAnswerCorrect = selectedAnswer === allCorrectIndices[0];
        }
      }

      renderSlide();
      saveProgress();

      // Only auto-advance if answer is CORRECT
      // If wrong or incomplete, user needs to manually go to next question
      const nextIndex = getNextActiveQuestionIndex(1);
      if (isAnswerCorrect && nextIndex !== -1) {
        setTimeout(() => {
          goTo(nextIndex);
        }, 1200); // 1.2s delay to see the feedback
      }
      // If wrong: don't auto-advance, let user review the correct answer
    } else {
      renderSlide();
      saveProgress();

      // Auto-advance for single-select only (not multi-select)
      const nextIndex = getNextActiveQuestionIndex(1);
      if (!isMultiSelect && nextIndex !== -1) {
        setTimeout(() => {
          goTo(nextIndex);
        }, 400);
      } else if (isMultiSelect && nextIndex !== -1) {
        // For multi-select, advance after confirmation
        setTimeout(() => {
          goTo(nextIndex);
        }, 400);
      }
    }
  }

  // Check if a question needs review (wrong or unanswered)
  function needsReview(questionIndex) {
    const isMultiSelect = isMultiSelectQuestion(questionIndex);
    const allCorrectIndices = getAllCorrectAnswerIndices(questionIndex);
    const selectedAnswer = userAnswers[questionIndex];

    // Check if user didn't answer
    const hasAnswer = isMultiSelect
      ? Array.isArray(selectedAnswer) && selectedAnswer.length > 0
      : selectedAnswer !== null;

    if (!hasAnswer) return true; // Unanswered

    // If no correct answer in data, treat as needs review
    if (allCorrectIndices.length === 0) return true;

    // Check if answer is correct
    let isCorrect = false;
    if (isMultiSelect && Array.isArray(selectedAnswer)) {
      const sortedSelected = [...selectedAnswer].sort((a, b) => a - b);
      const sortedCorrect = [...allCorrectIndices].sort((a, b) => a - b);
      isCorrect =
        sortedSelected.length === sortedCorrect.length &&
        sortedSelected.every((v, idx) => v === sortedCorrect[idx]);
    } else if (!isMultiSelect) {
      isCorrect = selectedAnswer === allCorrectIndices[0];
    }

    return !isCorrect; // Needs review if not correct
  }

  // Get all question indices that need review
  function getReviewableQuestions() {
    const reviewable = [];
    for (let i = 0; i < polls.length; i++) {
      if (needsReview(i)) reviewable.push(i);
    }
    return reviewable;
  }

  // Find next reviewable question (for review mode navigation)
  function findNextReviewable(fromIndex, direction) {
    const reviewable = getReviewableQuestions();
    if (reviewable.length === 0) return -1;

    if (direction > 0) {
      // Find next
      for (const idx of reviewable) {
        if (idx > fromIndex) return idx;
      }
      return -1; // No more after current
    } else {
      // Find previous
      for (let i = reviewable.length - 1; i >= 0; i--) {
        if (reviewable[i] < fromIndex) return reviewable[i];
      }
      return -1; // No more before current
    }
  }

  function goTo(index) {
    if (index < 0 || index >= polls.length) return;
    if (
      !isSubmitted &&
      hasActiveStudyQueue() &&
      !studyQueueIndices.includes(index)
    ) {
      return;
    }
    const previousIndex = currentIndex;
    currentIndex = index;

    // Clear instant feedback lock for new question if not already shown
    // (This allows re-answering questions when navigating back, unless feedback was shown)

    renderSlide();
    saveProgress();

    // Reset timer for new question (keeps paused state)
    if (!isSubmitted) {
      resetTimer();
    }

    // Check if we completed a chapter
    checkChapterCompletion(previousIndex);
  }

  function jumpToQuestionNumber(questionNumber) {
    const index = Number(questionNumber) - 1;
    if (Number.isNaN(index)) return;

    // Leave review mode so you can answer, then re-run Finish when ready.
    isSubmitted = false;
    studyQueueIndices = null;
    finishBtn.style.display = "inline-flex";
    resetBtn.style.display = "none";
    syncActionsVisibility();
    resultContainer.style.display = "none";
    slidesShell.style.display = "block";

    // Reset feedback for this question so user can re-answer
    feedbackShownForQuestion[index] = false;

    goTo(index);
    slidesShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function evaluateQuizCore(recordAttempt = false) {
    let incorrectQuestions = [];
    let wrongDetails = [];
    let unansweredQuestions = [];
    let score = 0;
    let answeredCount = 0;

    for (let i = 0; i < polls.length; i++) {
      const isMultiSelect = isMultiSelectQuestion(i);
      const allCorrectIndices = getAllCorrectAnswerIndices(i);
      const selectedAnswer = userAnswers[i];

      // Check if user didn't answer
      const hasAnswer = isMultiSelect
        ? Array.isArray(selectedAnswer) && selectedAnswer.length > 0
        : selectedAnswer !== null;

      if (!hasAnswer) {
        unansweredQuestions.push(i + 1);
        continue;
      }

      answeredCount++;

      // If no correct answer in data, user answered but we can't score it
      if (allCorrectIndices.length === 0) {
        continue;
      }

      // Check if answer is correct
      let isCorrect = false;
      if (isMultiSelect && Array.isArray(selectedAnswer)) {
        const sortedSelected = [...selectedAnswer].sort((a, b) => a - b);
        const sortedCorrect = [...allCorrectIndices].sort(
          (a, b) => a - b,
        );
        isCorrect =
          sortedSelected.length === sortedCorrect.length &&
          sortedSelected.every((v, idx) => v === sortedCorrect[idx]);
      } else if (!isMultiSelect) {
        isCorrect = selectedAnswer === allCorrectIndices[0];
      }

      if (isCorrect) {
        score++;
      } else {
        incorrectQuestions.push(i + 1);

        // Build answer text for review
        let yourAnswerText = "";
        let correctAnswerText = "";

        if (isMultiSelect && Array.isArray(selectedAnswer)) {
          yourAnswerText = selectedAnswer
            .map((idx) => getAnswerText(i, idx))
            .join("، ");
          correctAnswerText = allCorrectIndices
            .map((idx) => getAnswerText(i, idx))
            .join("، ");
        } else {
          yourAnswerText = getAnswerText(i, selectedAnswer);
          correctAnswerText = allCorrectIndices
            .map((idx) => getAnswerText(i, idx))
            .join("، ");
        }

        wrongDetails.push({
          number: i + 1,
          question: polls[i].poll.question,
          yourAnswer: yourAnswerText,
          correctAnswer: correctAnswerText,
          isMultiSelect: isMultiSelect,
        });
      }
    }

    const total = polls.length;
    const incorrectCount = incorrectQuestions.length;
    const unansweredCount = unansweredQuestions.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const summary = {
      score,
      total,
      percentage,
      answeredCount,
      incorrectCount,
      unansweredCount,
    };

    if (recordAttempt) {
      saveScoreHistory(summary);
    }

    const hasQuestionsToReview =
      incorrectQuestions.length > 0 || unansweredQuestions.length > 0;
    const bookmarkedQuestions = getBookmarkedQuestionNumbers();

    const retryActionsHtml = hasQuestionsToReview
      ? `
        <div class="results-actions">
          <button type="button" class="result-action-btn primary" id="retry-missed-btn">
            تدريب على الأخطاء
          </button>
        </div>
      `
      : "";

    const bookmarkedCardsHtml = bookmarkedQuestions
      .map(
        (n) => `
          <button type="button" class="review-card bookmark-card" data-jump="${n}">
            <span class="review-card-label">السؤال</span>
            <span class="review-card-num">${n}</span>
          </button>
        `,
      )
      .join("");

    const bookmarksHtml = `
      <section class="saved-questions-panel" aria-label="الأسئلة المحفوظة">
        <h3>الأسئلة المحفوظة</h3>
        ${
          bookmarkedQuestions.length > 0
            ? `<div class="review-grid">${bookmarkedCardsHtml}</div>`
            : '<p class="empty-tab">لم تحفظ أي سؤال بعد.</p>'
        }
      </section>
    `;

    // Build tabbed review section
    let reviewTabsHtml = "";
    if (hasQuestionsToReview) {
      const wrongCardsHtml = incorrectQuestions
        .map(
          (n) => `
          <button type="button" class="review-card wrong-card" data-jump="${n}">
            <span class="review-card-label">السؤال</span>
            <span class="review-card-num">${n}</span>
          </button>
        `,
        )
        .join("");

      const unansweredCardsHtml = unansweredQuestions
        .map(
          (n) => `
          <button type="button" class="review-card unanswered-card" data-jump="${n}">
            <span class="review-card-label">السؤال</span>
            <span class="review-card-num">${n}</span>
          </button>
        `,
        )
        .join("");

      reviewTabsHtml = `
        <div class="review-tabs-container">
          <div class="review-tabs-header">
            <button type="button" class="review-tab ${
              unansweredQuestions.length > 0 ? "active" : ""
            }" data-tab="unanswered" ${
              unansweredQuestions.length === 0 ? "disabled" : ""
            }>
              <span class="tab-icon">⚠️</span>
              <span class="tab-text">بدون إجابة</span>
              <span class="tab-count">${unansweredCount}</span>
            </button>
            <button type="button" class="review-tab ${
              unansweredQuestions.length === 0 &&
              incorrectQuestions.length > 0
                ? "active"
                : ""
            }" data-tab="wrong" ${
              incorrectQuestions.length === 0 ? "disabled" : ""
            }>
              <span class="tab-icon">❌</span>
              <span class="tab-text">إجابات خاطئة</span>
              <span class="tab-count">${incorrectCount}</span>
            </button>
          </div>
          <div class="review-tabs-content">
            <div class="review-tab-panel ${
              unansweredQuestions.length > 0 ? "active" : ""
            }" data-panel="unanswered">
              ${
                unansweredQuestions.length > 0
                  ? `<div class="review-grid">${unansweredCardsHtml}</div>`
                  : '<p class="empty-tab">لا توجد أسئلة بدون إجابة 🎉</p>'
              }
            </div>
            <div class="review-tab-panel ${
              unansweredQuestions.length === 0 &&
              incorrectQuestions.length > 0
                ? "active"
                : ""
            }" data-panel="wrong">
              ${
                incorrectQuestions.length > 0
                  ? `<div class="review-grid">${wrongCardsHtml}</div>`
                  : '<p class="empty-tab">لا توجد إجابات خاطئة 🎉</p>'
              }
            </div>
          </div>
        </div>
      `;
    }

    resultContainer.innerHTML = `
      <div class="score-main">
        <span class="score-percent">${percentage}%</span>
        <span class="score-fraction">${score} / ${total}</span>
      </div>
      <div class="stats-row">
        <div class="stat-card stat-answered">
          <span class="stat-value">${answeredCount}</span>
          <span class="stat-label">تمت الإجابة</span>
        </div>
        <div class="stat-card stat-unanswered">
          <span class="stat-value">${unansweredCount}</span>
          <span class="stat-label">بدون إجابة</span>
        </div>
        <div class="stat-card stat-wrong">
          <span class="stat-value">${incorrectCount}</span>
          <span class="stat-label">خاطئة</span>
        </div>
      </div>
      ${retryActionsHtml}
      <p class="hint">ملاحظة: عند عدم الإجابة، سيظهر السؤال باللون الأحمر ولن يتم إظهار الإجابة الصحيحة.</p>
      ${bookmarksHtml}
      ${reviewTabsHtml}
      ${buildScoreHistoryHtml()}
    `;
    resultContainer.style.display = "block";

    // Tab switching functionality
    const tabs = resultContainer.querySelectorAll(".review-tab");
    const panels = resultContainer.querySelectorAll(".review-tab-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.disabled) return;
        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const panelId = tab.getAttribute("data-tab");
        resultContainer
          .querySelector(`[data-panel="${panelId}"]`)
          ?.classList.add("active");
      });
    });

    // Make review cards clickable (jump to question)
    const jumpBtns = resultContainer.querySelectorAll("[data-jump]");
    jumpBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-jump");
        if (!target) return;
        jumpToQuestionNumber(target);
      });
    });

    const retryMissedBtn = resultContainer.querySelector(
      "#retry-missed-btn",
    );
    if (retryMissedBtn) {
      retryMissedBtn.addEventListener("click", () => {
        startMissedPractice([
          ...unansweredQuestions,
          ...incorrectQuestions,
        ]);
      });
    }

    // Review mode for slides
    isSubmitted = true;
    finishBtn.style.display = "none";
    resetBtn.style.display = "block";
    syncActionsVisibility();
    renderSlide();

    // Jump to first unanswered, else first wrong, else first question
    const jumpTo =
      unansweredQuestions.length > 0
        ? unansweredQuestions[0] - 1
        : incorrectQuestions.length > 0
          ? incorrectQuestions[0] - 1
          : 0;
    currentIndex = jumpTo;
    renderSlide();

    return { incorrectQuestions, unansweredQuestions, ...summary };
  }

  function startMissedPractice(questionNumbers) {
    const queue = [
      ...new Set(
        questionNumbers
          .map((n) => Number(n) - 1)
          .filter((index) => index >= 0 && index < polls.length),
      ),
    ];

    if (!queue.length) {
      showGistLoadNotification("لا توجد أسئلة للتدريب عليها");
      return;
    }

    studyQueueIndices = queue;
    isSubmitted = false;
    currentIndex = queue[0];
    resultContainer.style.display = "none";
    slidesShell.style.display = "block";
    finishBtn.style.display = "inline-flex";
    resetBtn.style.display = "none";
    syncActionsVisibility();

    queue.forEach((index) => {
      userAnswers[index] = null;
      feedbackShownForQuestion[index] = false;
    });

    renderSlide();
    startTimer();
    saveProgress();
    showGistLoadNotification("بدأ تدريب الأخطاء ✓");
    slidesShell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function evaluateQuiz() {
    stopTimer(); // Stop timer when quiz is submitted
    studyQueueIndices = null;
    evaluateQuizCore(true);
    saveProgress();

    // Trigger fireworks celebration for completing the exam!
    triggerExamCompleteFireworks();
  }

  // Used when restoring from localStorage to avoid re-saving
  function evaluateQuizWithoutSave() {
    stopTimer();
    studyQueueIndices = null;
    evaluateQuizCore();
  }

  function resetQuiz() {
    clearProgress();
    resultContainer.style.display = "none";
    resetBtn.style.display = "none";
    syncActionsVisibility();
    currentIndex = 0;
    shuffleInPlace(polls);
    userAnswers = new Array(polls.length).fill(null);
    isSubmitted = false;
    finishBtn.style.display = "inline-flex";

    // Reset gamification state
    questionsAnsweredInSession = 0;
    lastMilestoneShown = 0;
    chapterProgress = {};

    // Reset feedback state (keep instantFeedbackEnabled as user preference)
    feedbackShownForQuestion = new Array(polls.length).fill(false);
    bookmarkedQuestionIds = [];
    studyQueueIndices = null;

    renderSlide();
    startTimer();
  }

  resetBtn.addEventListener("click", resetQuiz);

  prevBtn.addEventListener("click", () => {
    if (isSubmitted) {
      const prevReviewable = findNextReviewable(currentIndex, -1);
      if (prevReviewable !== -1) goTo(prevReviewable);
    } else {
      const prevIndex = getNextActiveQuestionIndex(-1);
      if (prevIndex !== -1) goTo(prevIndex);
    }
  });
  nextBtn.addEventListener("click", () => {
    if (isSubmitted) {
      const nextReviewable = findNextReviewable(currentIndex, 1);
      if (nextReviewable !== -1) goTo(nextReviewable);
    } else {
      const nextIndex = getNextActiveQuestionIndex(1);
      if (nextIndex !== -1) goTo(nextIndex);
    }
  });
  function requestSubmitConfirmation() {
    if (!polls.length || isSubmitted) return;

    const unansweredCount = getActiveQuestionIndices().filter(
      (index) => !hasUserAnswer(index),
    ).length;
    const msg =
      unansweredCount > 0
        ? `لديك ${unansweredCount} سؤال بدون إجابة. هل تريد إنهاء وحساب النتيجة؟`
        : hasActiveStudyQueue()
          ? "هل تريد إنهاء تدريب الأخطاء وحساب النتيجة؟"
        : "هل تريد إنهاء وحساب النتيجة؟";

    // Prefer a styled <dialog>, fallback to window.confirm
    if (
      submitConfirmDialog &&
      typeof submitConfirmDialog.showModal === "function"
    ) {
      if (submitConfirmText) submitConfirmText.textContent = msg;
      submitConfirmDialog.showModal();
      return;
    }

    if (window.confirm(msg)) {
      evaluateQuiz();
    }
  }

  finishBtn.addEventListener("click", requestSubmitConfirmation);

  if (confirmSubmitBtn && submitConfirmDialog) {
    confirmSubmitBtn.addEventListener("click", () => {
      submitConfirmDialog.close("confirm");
      evaluateQuiz();
    });
  }

  if (cancelSubmitBtn && submitConfirmDialog) {
    cancelSubmitBtn.addEventListener("click", () => {
      submitConfirmDialog.close("cancel");
    });
  }

  if (submitConfirmDialog) {
    // ESC closes dialog by default; keep it as "cancel" for clarity.
    submitConfirmDialog.addEventListener("cancel", () => {
      submitConfirmDialog.close("cancel");
    });
  }

  // Keyboard navigation:
  // - RTL-friendly: Right=Prev, Left=Next
  // - 1..9 selects answers (1=first answer)
  // - Space goes to next question (skip allowed)
  // - P pauses/resumes the timer
  document.addEventListener("keydown", (e) => {
    if (!polls.length || slidesShell.style.display === "none") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Arrow navigation (review-only when submitted)
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (isSubmitted) {
        const prevReviewable = findNextReviewable(currentIndex, -1);
        if (prevReviewable !== -1) goTo(prevReviewable);
      } else {
        const prevIndex = getNextActiveQuestionIndex(-1);
        if (prevIndex !== -1) goTo(prevIndex);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (isSubmitted) {
        const nextReviewable = findNextReviewable(currentIndex, 1);
        if (nextReviewable !== -1) goTo(nextReviewable);
      } else {
        const nextIndex = getNextActiveQuestionIndex(1);
        if (nextIndex !== -1) goTo(nextIndex);
      }
      return;
    }

    // Space = next question (do not scroll)
    if (e.key === " ") {
      e.preventDefault();
      if (isSubmitted) {
        const nextReviewable = findNextReviewable(currentIndex, 1);
        if (nextReviewable !== -1) goTo(nextReviewable);
      } else {
        const nextIndex = getNextActiveQuestionIndex(1);
        if (nextIndex !== -1) goTo(nextIndex);
      }
      return;
    }

    // P = pause/resume timer
    if (e.key === "p" || e.key === "P" || e.key === "ح") {
      e.preventDefault();
      if (!isSubmitted) {
        toggleTimerPause();
      }
      return;
    }

    // Enter = confirm multi-select answer
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isSubmitted && !feedbackShownForQuestion[currentIndex]) {
        const isMultiSelect = isMultiSelectQuestion(currentIndex);
        if (
          isMultiSelect &&
          Array.isArray(userAnswers[currentIndex]) &&
          userAnswers[currentIndex].length > 0
        ) {
          handleAnswerSubmission(true);
        }
      }
      return;
    }

    // 1..9 (and numpad) = select answer (only before submit)
    if (isSubmitted) return;

    // Check if feedback is shown for current question
    if (feedbackShownForQuestion[currentIndex]) return;

    const digit = Number.parseInt(e.key, 10);
    if (!Number.isNaN(digit) && digit >= 1 && digit <= 9) {
      const answerIndex = digit - 1;
      const answersCount =
        polls[currentIndex]?.poll?.answers?.length || 0;
      if (answerIndex < answersCount) {
        e.preventDefault();

        const isMultiSelect = isMultiSelectQuestion(currentIndex);

        if (isMultiSelect) {
          // Toggle selection for multi-select
          if (!Array.isArray(userAnswers[currentIndex])) {
            userAnswers[currentIndex] = [];
          }

          const idx = userAnswers[currentIndex].indexOf(answerIndex);
          if (idx === -1) {
            userAnswers[currentIndex].push(answerIndex);
          } else {
            userAnswers[currentIndex].splice(idx, 1);
          }

          renderSlide();
          saveProgress();
          // Don't auto-advance for multi-select - user needs to click confirm
        } else {
          // Single-select behavior
          const previousAnswer = userAnswers[currentIndex];
          userAnswers[currentIndex] = answerIndex;

          handleAnswerSubmission(previousAnswer === null);
        }
      }
    }
  });

  // =============================================
  // Share Result Feature
  // =============================================
  async function shareResult() {
    const shareBtn = document.getElementById("share-result-btn");
    if (!shareBtn) return;

    const originalText = shareBtn.innerHTML;
    shareBtn.disabled = true;
    shareBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      جاري إنشاء الصورة...
    `;

    try {
      // Create a shareable card element
      const shareCard = document.createElement("div");
      shareCard.className = "share-card";
      shareCard.style.cssText =
        "position: fixed; left: -9999px; top: 0; width: 400px; direction: rtl;";

      // Get score data from result container
      const scorePercent =
        resultContainer.querySelector(".score-percent")?.textContent ||
        "0%";
      const scoreFraction =
        resultContainer.querySelector(".score-fraction")?.textContent ||
        "0 / 0";
      const answeredValue =
        resultContainer.querySelector(".stat-answered .stat-value")
          ?.textContent || "0";
      const unansweredValue =
        resultContainer.querySelector(".stat-unanswered .stat-value")
          ?.textContent || "0";
      const wrongValue =
        resultContainer.querySelector(".stat-wrong .stat-value")
          ?.textContent || "0";

      shareCard.innerHTML = `
        <div class="share-card-content">
          <p class="share-title">نتيجتي في الاختبار </p>
          <div class="score-main">
            <span class="score-percent">${scorePercent}</span>
            <span class="score-fraction">${scoreFraction}</span>
          </div>
          <div class="stats-row">
            <div class="stat-card stat-answered">
              <span class="stat-value">${answeredValue}</span>
              <span class="stat-label">تمت الإجابة</span>
            </div>
            <div class="stat-card stat-unanswered">
              <span class="stat-value">${unansweredValue}</span>
              <span class="stat-label">بدون إجابة</span>
            </div>
            <div class="stat-card stat-wrong">
              <span class="stat-value">${wrongValue}</span>
              <span class="stat-label">خاطئة</span>
            </div>
          </div>
          <div class="watermark">
            <span>Made by Shadi Al Milhem</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
        </div>
      `;

      document.body.appendChild(shareCard);

      // Use html2canvas to capture
      const canvas = await html2canvas(shareCard, {
        backgroundColor: "#0b1220",
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
      });

      // Remove the temporary element
      document.body.removeChild(shareCard);

      // Convert to blob
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            showShareNotification("فشل في إنشاء الصورة", true);
            return;
          }

          // Try Web Share API first (mobile-friendly)
          if (navigator.share && navigator.canShare) {
            const file = new File([blob], "sde601-result.png", {
              type: "image/png",
            });
            const shareData = { files: [file] };

            if (navigator.canShare(shareData)) {
              try {
                await navigator.share(shareData);
                showShareNotification("تم مشاركة النتيجة ✓");
              } catch (err) {
                // User cancelled or share failed, fall back to download
                if (err.name !== "AbortError") {
                  downloadBlob(blob);
                }
              }
            } else {
              downloadBlob(blob);
            }
          } else {
            // Fallback to download
            downloadBlob(blob);
          }
        },
        "image/png",
        1.0,
      );
    } catch (error) {
      console.error("Share failed:", error);
      showShareNotification("فشل في إنشاء الصورة. حاول مرة أخرى.", true);
    } finally {
      shareBtn.disabled = false;
      shareBtn.innerHTML = originalText;
    }
  }

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sde601-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showShareNotification("تم تحميل الصورة ✓");
  }

  function showShareNotification(message, isError = false) {
    const notification = document.createElement("div");
    notification.className = "restore-notification";
    notification.textContent = message;
    if (isError) {
      notification.style.borderColor = "rgba(239, 68, 68, 0.4)";
      notification.style.background = "rgba(239, 68, 68, 0.15)";
      notification.style.color = "var(--danger)";
    }
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Add share button when results are shown
  function addShareButton() {
    // Check if button already exists
    if (document.getElementById("share-result-btn")) return;

    const scoreMain = resultContainer.querySelector(".score-main");
    if (!scoreMain) return;

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "share-btn";
    shareBtn.id = "share-result-btn";
    shareBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
      مشاركة النتيجة
    `;

    // Insert inside score-main div
    scoreMain.appendChild(shareBtn);

    // Add click handler
    shareBtn.addEventListener("click", shareResult);
  }

  // Observe result container for changes to add share button
  const resultObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "childList" &&
        resultContainer.innerHTML.trim() !== ""
      ) {
        addShareButton();
        break;
      }
    }
  });

  resultObserver.observe(resultContainer, {
    childList: true,
    subtree: true,
  });

  // Try to restore saved progress on page load
  // (must be after observer setup so share button gets added)
  loadProgress();
});
