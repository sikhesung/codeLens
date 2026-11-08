// CodeLens 메인 컨트롤러
// - 창모드 기준 레이아웃 & 전체화면 유동 간격 + 주석 1자 칼정렬
// - 해석코드 들여쓰기 제거 기본값 + 개인 맞춤 주석 위치/간격 설정
// - 작동 블록(for/while/if/함수 시작~끝) 묶음 해석 + 우측 하단 Gemini AI 튜터 챗봇

const AppState = {
  currentCode: "",
  explanationLevel: "beginner", // "beginner" | "advanced"
  interpretScope: "line", // "line" (한 줄씩 1자 정렬) | "block" (작동 블록 시작~끝 묶음)
  stripIndentation: true, // 해석코드에서 들여쓰기 제거 (기본값 true)
  showOneLineEssence: true, // 한 줄 완벽 이해 관통 요약 배너 표시 (선택사항)
  commentPosition: "right", // "right" | "top" | "bottom" | "left" | "hidden"
  userCodeWidthCh: 32, // 사용자가 드래그/슬라이더로 지정한 코드 영역 폭 (ch 단위)
  userAdjustedCodeWidth: false,
  userCommentGapPx: 32, // 사용자가 지정한 기본 주석 간격 (px)
  userAdjustedGap: false,

  selectedLineNumber: 1,
  currentTraceStepIdx: 0,
  graderMode: "interactive",
  userCommentsMap: {},
  analysisData: null,

  // 슬라이드 & 4방향 도킹 레이아웃 상태
  splitDirection: "vertical", // "vertical" | "vertical-reverse" | "horizontal" | "horizontal-reverse"
  viewMode: "split",
  splitRatioPercent: 36,

  // 챗봇 대화 내역
  chatHistory: []
};

document.addEventListener("DOMContentLoaded", () => {
  initElements();
  bindEvents();
  initSlideSplitters();
  initDragCustomizationSystem();
  initChatbot();
  updateApiStatusUI();
  updateEditorLineNumbers();
  showEmptyState(true);
});

let els = {};

function initElements() {
  els = {
    mainWorkspace: document.getElementById("mainWorkspace"),
    workspaceDockOverlay: document.getElementById("workspaceDockOverlay"),
    codePane: document.getElementById("codePane"),
    analysisPane: document.getElementById("analysisPane"),
    mainSplitter: document.getElementById("mainSplitter"),
    lineInspector: document.getElementById("lineInspector"),
    inspectorResizeHandle: document.getElementById("inspectorResizeHandle"),
    inspectorDragHeader: document.getElementById("inspectorDragHeader"),
    dockInspectorBtn: document.getElementById("dockInspectorBtn"),

    restoreCodeDrawerBtn: document.getElementById("restoreCodeDrawerBtn"),
    restoreAnalysisDrawerBtn: document.getElementById("restoreAnalysisDrawerBtn"),
    toggleInspectorSizeBtn: document.getElementById("toggleInspectorSizeBtn"),
    closeInspectorBtn: document.getElementById("closeInspectorBtn"),
    restoreInspectorPillBtn: document.getElementById("restoreInspectorPillBtn"),
    askSelectedLineToChatBtn: document.getElementById("askSelectedLineToChatBtn"),

    viewModeBtns: document.querySelectorAll("[data-viewmode]"),
    toggleSplitDirBtn: document.getElementById("toggleSplitDirBtn"),
    resetUiLayoutBtn: document.getElementById("resetUiLayoutBtn"),
    featureTabsNav: document.getElementById("featureTabsNav"),
    commentColumnDragBar: document.getElementById("commentColumnDragBar"),
    commentColumnDragThumb: document.getElementById("commentColumnDragThumb"),
    traceSplitContainer: document.getElementById("traceSplitContainer"),
    traceLeftPane: document.getElementById("traceLeftPane"),
    traceSplitResizer: document.getElementById("traceSplitResizer"),
    graderColResizer: document.getElementById("graderColResizer"),
    chatbotDragHeader: document.getElementById("chatbotDragHeader"),

    langSelect: document.getElementById("langSelect"),
    codeInput: document.getElementById("codeInput"),
    inputLineNumbers: document.getElementById("inputLineNumbers"),
    clearCodeBtn: document.getElementById("clearCodeBtn"),
    analyzeAllBtn: document.getElementById("analyzeAllBtn"),
    quickGradeSwitchBtn: document.getElementById("quickGradeSwitchBtn"),
    statusBannerText: document.getElementById("statusBannerText"),
    emptyStateOverlay: document.getElementById("emptyStateOverlay"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    loadingMessage: document.getElementById("loadingMessage"),

    // Topbar
    levelBtns: document.querySelectorAll(".level-btn"),
    openApiModalBtn: document.getElementById("openApiModalBtn"),
    apiStatusDot: document.getElementById("apiStatusDot"),
    apiStatusText: document.getElementById("apiStatusText"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),

    // Tabs
    tabBtns: document.querySelectorAll(".tab-btn"),
    tabPanels: document.querySelectorAll(".tab-panel"),

    // Tab 1: Line & Block Controls
    scopeBtns: document.querySelectorAll(".scope-btn"),
    stripIndentToggle: document.getElementById("stripIndentToggle"),
    oneLineEssenceToggle: document.getElementById("oneLineEssenceToggle"),
    commentPosSelect: document.getElementById("commentPosSelect"),
    codeWidthControlGroup: document.getElementById("codeWidthControlGroup"),
    codeWidthSlider: document.getElementById("codeWidthSlider"),
    codeWidthDragThumb: document.getElementById("codeWidthDragThumb"),
    commentGapControlGroup: document.getElementById("commentGapControlGroup"),
    commentGapSlider: document.getElementById("commentGapSlider"),
    copyCommentedCodeBtn: document.getElementById("copyCommentedCodeBtn"),
    commentColumnDragBar: document.getElementById("commentColumnDragBar"),
    commentColumnDragThumb: document.getElementById("commentColumnDragThumb"),
    tab1EssenceBanner: document.getElementById("tab1EssenceBanner"),
    tab1EssenceText: document.getElementById("tab1EssenceText"),
    lineByLineList: document.getElementById("lineByLineList"),
    blockUnitsList: document.getElementById("blockUnitsList"),
    inspectorLineNum: document.getElementById("inspectorLineNum"),
    inspectorCodePreview: document.getElementById("inspectorCodePreview"),
    inspectorBody: document.getElementById("inspectorBody"),

    // Tab 2: Understanding Helper
    analogyContent: document.getElementById("analogyContent"),
    prevStepBtn: document.getElementById("prevStepBtn"),
    nextStepBtn: document.getElementById("nextStepBtn"),
    stepCounterBadge: document.getElementById("stepCounterBadge"),
    traceCodeView: document.getElementById("traceCodeView"),
    traceStepExplanation: document.getElementById("traceStepExplanation"),
    traceVarsTable: document.getElementById("traceVarsTable"),
    flowStepsContainer: document.getElementById("flowStepsContainer"),
    conceptCardsGrid: document.getElementById("conceptCardsGrid"),

    // Tab 3: Deep Dive
    deepDiveContainer: document.getElementById("deepDiveContainer"),

    // Tab 4: Grader
    graderModeBtns: document.querySelectorAll(".grader-mode-btn"),
    graderInteractiveBox: document.getElementById("graderInteractiveBox"),
    graderRawBox: document.getElementById("graderRawBox"),
    graderLinesInputList: document.getElementById("graderLinesInputList"),
    rawCommentedCodeInput: document.getElementById("rawCommentedCodeInput"),
    clearUserCommentsBtn: document.getElementById("clearUserCommentsBtn"),
    runGradeBtn: document.getElementById("runGradeBtn"),
    gradeResultSection: document.getElementById("gradeResultSection"),

    // Chatbot
    chatbotWidget: document.getElementById("chatbotWidget"),
    chatbotPanel: document.getElementById("chatbotPanel"),
    chatbotToggleBtn: document.getElementById("chatbotToggleBtn"),
    closeChatbotBtn: document.getElementById("closeChatbotBtn"),
    clearChatBtn: document.getElementById("clearChatBtn"),
    chatbotModelBadge: document.getElementById("chatbotModelBadge"),
    chatbotMessages: document.getElementById("chatbotMessages"),
    chatbotForm: document.getElementById("chatbotForm"),
    chatbotInput: document.getElementById("chatbotInput"),
    chatQuickChips: document.querySelectorAll(".chat-chip"),

    // Modal
    apiModal: document.getElementById("apiModal"),
    closeApiModalBtn: document.getElementById("closeApiModalBtn"),
    apiKeyInput: document.getElementById("apiKeyInput"),
    modelSelect: document.getElementById("modelSelect"),
    saveApiKeyBtn: document.getElementById("saveApiKeyBtn"),
    removeApiKeyBtn: document.getElementById("removeApiKeyBtn"),

    toast: document.getElementById("toast")
  };
}

/* =========================================================
 * 코드 최대 길이 계산 & 창모드/전체화면 유동 간격 + 1자 정렬
 * ========================================================= */
function getVisualCharLength(str) {
  let len = 0;
  for (const ch of str) {
    // 한글 등 전각 문자는 2ch, 영문/기호는 1ch로 계산
    len += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return len;
}

function getIndentCh(rawCodeLine) {
  if (!rawCodeLine) return 0;
  const match = rawCodeLine.match(/^(\s+)/);
  if (!match) return 0;
  return match[1].replace(/\t/g, "    ").length;
}

function formatCodeForDisplay(rawCodeLine) {
  if (!rawCodeLine) return "";
  return AppState.stripIndentation ? rawCodeLine.trimStart() : rawCodeLine;
}

function updateDynamicCodeAlignment() {
  if (!AppState.analysisData || !AppState.analysisData.lineByLine) return;

  const lines = AppState.analysisData.lineByLine;
  let maxCh = 12;
  lines.forEach((item) => {
    // 항상 앞 공백을 제거한 순수 코드의 최대 길이를 기준으로 기본 열 너비를 계산합니다.
    // (들여쓰기 켜기 상태에서는 각 줄마다 --line-indent 만큼 코드와 주석이 함께 오른쪽으로 이동합니다!)
    const stripped = (item.code || "").trimStart();
    if (stripped.length > 0) {
      const vLen = getVisualCharLength(stripped);
      if (vLen > maxCh) maxCh = vLen;
    }
  });

  // 코드 최대 길이에 맞춰 코드 컬럼 너비를 ch 단위로 계산
  const autoCh = Math.max(14, Math.min(84, maxCh + 2));
  const finalCodeWidthCh = AppState.userAdjustedCodeWidth
    ? AppState.userCodeWidthCh
    : autoCh;

  if (!AppState.userAdjustedCodeWidth) {
    AppState.userCodeWidthCh = autoCh;
    if (els.codeWidthSlider) els.codeWidthSlider.value = autoCh;
  }

  // 창모드 vs 전체화면에 따라 코드와 주석 사이 간격을 유동적으로 산출 (사용자가 직접 슬라이더를 만진 경우 사용자 값 우선)
  let gapPx = AppState.userCommentGapPx;
  if (!AppState.userAdjustedGap) {
    const winW = window.innerWidth;
    if (winW >= 1500) {
      const extraFluid = Math.max(24, Math.min(140, Math.round((winW - 1100) * 0.12)));
      gapPx = 28 + extraFluid;
    } else {
      gapPx = 24;
    }
    if (els.commentGapSlider) els.commentGapSlider.value = gapPx;
    AppState.userCommentGapPx = gapPx;
  }

  els.lineByLineList.style.setProperty("--comment-gap", `${gapPx}px`);
  els.blockUnitsList.style.setProperty("--comment-gap", `${gapPx}px`);
}

window.addEventListener("resize", () => {
  if (AppState.analysisData) {
    updateDynamicCodeAlignment();
  }
});

/* =========================================================
 * 슬라이드 스플리터 & 화면 보기 모드
 * ========================================================= */
function setSlideViewMode(mode, customRatioPercent = null) {
  AppState.viewMode = mode;
  els.mainWorkspace.classList.remove("view-code-only", "view-analysis-only");
  els.restoreCodeDrawerBtn.classList.add("hidden");
  els.restoreAnalysisDrawerBtn.classList.add("hidden");

  if (mode === "code-only") {
    els.mainWorkspace.classList.add("view-code-only");
    els.codePane.style.flex = "1 1 100%";
    els.analysisPane.style.flex = "0 0 0px";
    els.restoreAnalysisDrawerBtn.classList.remove("hidden");
  } else if (mode === "analysis-only") {
    els.mainWorkspace.classList.add("view-analysis-only");
    els.codePane.style.flex = "0 0 0px";
    els.analysisPane.style.flex = "1 1 100%";
    els.restoreCodeDrawerBtn.classList.remove("hidden");
  } else {
    const ratio = customRatioPercent !== null ? customRatioPercent : AppState.splitRatioPercent;
    AppState.splitRatioPercent = Math.max(16, Math.min(84, ratio));
    els.codePane.style.flex = `0 0 ${AppState.splitRatioPercent}%`;
    els.analysisPane.style.flex = `1 1 ${100 - AppState.splitRatioPercent}%`;
  }

  els.viewModeBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.viewmode === mode);
  });
}

function setWorkspaceDockLayout(direction) {
  AppState.splitDirection = direction;
  els.mainWorkspace.classList.remove(
    "layout-vertical",
    "layout-vertical-reverse",
    "layout-horizontal",
    "layout-horizontal-reverse"
  );
  els.mainWorkspace.classList.add(`layout-${direction}`);

  const isHoriz = direction.startsWith("horizontal");
  els.toggleSplitDirBtn.textContent = isHoriz ? "↔ 좌우" : "↕ 상하";
  setSlideViewMode(AppState.viewMode);
}

function toggleSplitDirection() {
  const isHoriz = AppState.splitDirection.startsWith("horizontal");
  if (!isHoriz) {
    setWorkspaceDockLayout("horizontal");
    showToast("↔ 좌/우 배치 모드로 전환되었습니다.");
  } else {
    setWorkspaceDockLayout("vertical");
    showToast("↕ 위/아래 배치 모드로 전환되었습니다.");
  }
}

function initSlideSplitters() {
  els.viewModeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.viewmode;
      if (mode === "split") {
        setSlideViewMode("split", 36);
      } else {
        setSlideViewMode(mode);
      }
    });
  });

  els.restoreCodeDrawerBtn.addEventListener("click", () => setSlideViewMode("split", 36));
  els.restoreAnalysisDrawerBtn.addEventListener("click", () => setSlideViewMode("split", 36));
  els.toggleSplitDirBtn.addEventListener("click", () => toggleSplitDirection());

  let isDraggingMain = false;
  els.mainSplitter.addEventListener("mousedown", () => {
    isDraggingMain = true;
    els.mainWorkspace.classList.add("is-dragging");
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDraggingMain) return;
    const rect = els.mainWorkspace.getBoundingClientRect();
    let ratio = 50;
    const dir = AppState.splitDirection;
    if (dir === "vertical") {
      ratio = ((e.clientY - rect.top) / rect.height) * 100;
    } else if (dir === "vertical-reverse") {
      ratio = ((rect.bottom - e.clientY) / rect.height) * 100;
    } else if (dir === "horizontal") {
      ratio = ((e.clientX - rect.left) / rect.width) * 100;
    } else if (dir === "horizontal-reverse") {
      ratio = ((rect.right - e.clientX) / rect.width) * 100;
    }

    if (ratio <= 8) setSlideViewMode("analysis-only");
    else if (ratio >= 92) setSlideViewMode("code-only");
    else setSlideViewMode("split", ratio);
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingMain) {
      isDraggingMain = false;
      els.mainWorkspace.classList.remove("is-dragging");
      document.body.style.userSelect = "";
    }
  });

  els.toggleInspectorSizeBtn.addEventListener("click", () => {
    const isMax = els.lineInspector.classList.toggle("inspector-maximized");
    els.toggleInspectorSizeBtn.textContent = isMax ? "⤡ 기본" : "⤢ 크게";
  });

  els.closeInspectorBtn.addEventListener("click", () => {
    els.lineInspector.classList.add("inspector-collapsed");
    els.restoreInspectorPillBtn.classList.remove("hidden");
  });

  els.restoreInspectorPillBtn.addEventListener("click", () => {
    els.lineInspector.classList.remove("inspector-collapsed");
    els.restoreInspectorPillBtn.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "1") {
      e.preventDefault();
      setSlideViewMode("code-only");
    } else if (e.altKey && e.key === "2") {
      e.preventDefault();
      setSlideViewMode("split", 36);
    } else if (e.altKey && e.key === "3") {
      e.preventDefault();
      setSlideViewMode("analysis-only");
    }
  });
}

function bindEvents() {
  els.codeInput.addEventListener("input", () => updateEditorLineNumbers());
  els.codeInput.addEventListener("scroll", () => {
    els.inputLineNumbers.scrollTop = els.codeInput.scrollTop;
  });

  els.codeInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAnalyzeAll();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const start = els.codeInput.selectionStart;
      const end = els.codeInput.selectionEnd;
      els.codeInput.value =
        els.codeInput.value.substring(0, start) + "    " + els.codeInput.value.substring(end);
      els.codeInput.selectionStart = els.codeInput.selectionEnd = start + 4;
      updateEditorLineNumbers();
    }
  });

  // 빠른 알고리즘 프리셋 원클릭 체험 버튼들 (면접관 & 방문자용)
  document.querySelectorAll(".preset-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pKey = btn.dataset.preset;
      const preset = LocalSmartEngine.PRESETS[pKey];
      if (!preset) return;
      els.langSelect.value = preset.lang;
      els.codeInput.value = preset.code;
      updateEditorLineNumbers();
      if (AppState.viewMode === "code-only") setSlideViewMode("split", 36);
      showToast(`⚡ '${preset.title}' 예제를 불러와 즉시 분석합니다!`);
      handleAnalyzeAll();
    });
  });

  els.clearCodeBtn.addEventListener("click", () => {
    els.codeInput.value = "";
    AppState.currentCode = "";
    AppState.analysisData = null;
    AppState.userCommentsMap = {};
    updateEditorLineNumbers();
    showEmptyState(true);
    if (AppState.viewMode === "analysis-only") setSlideViewMode("split");
    els.statusBannerText.textContent = "코드를 입력하고 분석을 실행하세요";
    els.codeInput.focus();
  });

  els.analyzeAllBtn.addEventListener("click", () => handleAnalyzeAll());

  els.quickGradeSwitchBtn.addEventListener("click", async () => {
    const code = els.codeInput.value.trim();
    if (!code) {
      if (AppState.viewMode === "analysis-only") setSlideViewMode("split");
      showToast("⚠️ 먼저 코드 입력창에 채점받을 내 코드를 입력해 주세요!");
      els.codeInput.focus();
      return;
    }

    if (AppState.viewMode === "code-only") setSlideViewMode("split", 34);

    const extracted = extractInlineCommentsFromRawCode(els.codeInput.value);
    if (extracted.hasComments) {
      setLoading(true, "코드와 작성하신 주석을 분석 및 채점하고 있습니다...");
      try {
        AppState.currentCode = extracted.cleanCode;
        AppState.userCommentsMap = extracted.commentsMap;
        AppState.analysisData = await GeminiService.analyzeCode(
          extracted.cleanCode,
          els.langSelect.value
        );
        showEmptyState(false);
        renderAllTabs();
        switchTab("tab-comment-grader");
        await handleRunGrading();
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!AppState.analysisData || els.codeInput.value.trim() !== AppState.currentCode.trim()) {
      await handleAnalyzeAll();
    }
    switchTab("tab-comment-grader");
    showToast("📝 각 코드 줄 옆에 내가 이해한 주석을 적고 채점 버튼을 눌러보세요!");
  });

  // 설명 눈높이 전환
  els.levelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.levelBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.explanationLevel = btn.dataset.level;
      if (AppState.analysisData) {
        renderLineByLineTab();
        renderBlockUnitsTab();
      }
    });
  });

  // 탭1: 한 줄씩 보기 vs 작동 블록(for/if/함수 시작~끝) 보기 전환
  els.scopeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.scopeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.interpretScope = btn.dataset.scope;
      if (AppState.interpretScope === "line") {
        els.lineByLineList.classList.remove("hidden");
        els.blockUnitsList.classList.add("hidden");
      } else {
        els.lineByLineList.classList.add("hidden");
        els.blockUnitsList.classList.remove("hidden");
      }
    });
  });

  // 탭1: 들여쓰기 연동 토글 (기본 해제 = 다 앞에 붙음 / 체크 시 = 코드 들여쓰기 위치에 따라 주석도 같이 이동)
  els.stripIndentToggle.addEventListener("change", (e) => {
    AppState.stripIndentation = !e.target.checked;
    if (AppState.analysisData) {
      updateDynamicCodeAlignment();
      renderLineByLineTab();
      renderBlockUnitsTab();
      renderGraderInputs();
    }
    showToast(
      e.target.checked
        ? "↪ 코드 들여쓰기 위치에 맞춰 주석도 함께 이동합니다."
        : "📏 들여쓰기를 제거하여 코드와 주석이 모두 앞에 붙어 정렬됩니다."
    );
  });

  // 탭1: 한 줄 완벽 이해 관통 요약 토글 (선택사항)
  if (els.oneLineEssenceToggle) {
    els.oneLineEssenceToggle.addEventListener("change", (e) => {
      AppState.showOneLineEssence = e.target.checked;
      updateEssenceBannerVisibility();
      showToast(
        e.target.checked
          ? "⚡ 한 줄 완벽 이해 배너가 활성화되었습니다."
          : "⚡ 한 줄 완벽 이해 배너가 숨겨졌습니다."
      );
    });
  }

  // 탭1: 개인 맞춤 주석 위치 변경
  els.commentPosSelect.addEventListener("change", (e) => {
    AppState.commentPosition = e.target.value;
    const isSidePos = AppState.commentPosition === "right" || AppState.commentPosition === "left";
    els.commentGapControlGroup.style.display = isSidePos ? "inline-flex" : "none";
    if (els.codeWidthControlGroup) {
      els.codeWidthControlGroup.style.display = isSidePos ? "inline-flex" : "none";
    }
    if (els.commentColumnDragBar) {
      els.commentColumnDragBar.style.display = isSidePos ? "flex" : "none";
    }
    if (AppState.analysisData) {
      renderLineByLineTab();
      renderBlockUnitsTab();
    }
  });

  // 탭1: 코드 영역 폭 슬라이더 조절 (코드 영역이 실제로 넓어지거나 좁아짐!)
  if (els.codeWidthSlider) {
    els.codeWidthSlider.addEventListener("input", (e) => {
      AppState.userAdjustedCodeWidth = true;
      AppState.userCodeWidthCh = parseInt(e.target.value, 10);
      els.lineByLineList.style.setProperty("--code-col-width", `${AppState.userCodeWidthCh}ch`);
      els.blockUnitsList.style.setProperty("--code-col-width", `${AppState.userCodeWidthCh}ch`);
    });
  }

  // 탭1: 코드-주석 사이 간격 슬라이더 조절
  els.commentGapSlider.addEventListener("input", (e) => {
    AppState.userAdjustedGap = true;
    AppState.userCommentGapPx = parseInt(e.target.value, 10);
    els.lineByLineList.style.setProperty("--comment-gap", `${AppState.userCommentGapPx}px`);
    els.blockUnitsList.style.setProperty("--comment-gap", `${AppState.userCommentGapPx}px`);
  });

  // 메인 탭 전환
  els.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (AppState.viewMode === "code-only") setSlideViewMode("split", 36);
      if (!AppState.analysisData) {
        if (els.codeInput.value.trim()) {
          handleAnalyzeAll().then(() => switchTab(btn.dataset.tab));
        } else {
          showToast("⚠️ 먼저 코드 입력창에 분석할 코드를 넣어주세요!");
          els.codeInput.focus();
        }
        return;
      }
      switchTab(btn.dataset.tab);
    });
  });

  els.copyCommentedCodeBtn.addEventListener("click", () => {
    if (!AppState.analysisData) return;
    const detectedLang = LocalSmartEngine.detectLanguage(
      AppState.currentCode,
      els.langSelect.value
    );
    const isCStyle = ["javascript", "c", "java", "go"].includes(detectedLang);
    const prefix = isCStyle ? "//" : "#";

    const lines = AppState.analysisData.lineByLine.map((item) => {
      const codeStr = formatCodeForDisplay(item.code);
      const cmt =
        AppState.explanationLevel === "beginner" ? item.beginnerComment : item.advancedComment;
      if (!codeStr.trim() || !cmt) return codeStr;
      return `${codeStr}  ${prefix} ${cmt}`;
    });

    copyTextToClipboard(lines.join("\n")).then(() => {
      showToast("📋 주석 달린 전체 코드가 복사되었습니다!");
    });
  });

  els.prevStepBtn.addEventListener("click", () => {
    if (!AppState.analysisData) return;
    if (AppState.currentTraceStepIdx > 0) {
      AppState.currentTraceStepIdx--;
      renderVariableTracer();
    }
  });

  els.nextStepBtn.addEventListener("click", () => {
    if (!AppState.analysisData) return;
    const trace = AppState.analysisData.understanding.variableTrace || [];
    if (AppState.currentTraceStepIdx < trace.length - 1) {
      AppState.currentTraceStepIdx++;
      renderVariableTracer();
    }
  });

  els.graderModeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      els.graderModeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      AppState.graderMode = btn.dataset.gradermode;
      els.graderInteractiveBox.classList.toggle("hidden", AppState.graderMode !== "interactive");
      els.graderRawBox.classList.toggle("hidden", AppState.graderMode !== "raw");
    });
  });

  els.clearUserCommentsBtn.addEventListener("click", () => {
    AppState.userCommentsMap = {};
    els.rawCommentedCodeInput.value = AppState.currentCode || "";
    renderGraderInputs();
    els.gradeResultSection.classList.add("hidden");
    showToast("🔄 작성한 주석이 초기화되었습니다.");
  });

  els.runGradeBtn.addEventListener("click", () => handleRunGrading());

  els.themeToggleBtn.addEventListener("click", () => {
    const html = document.documentElement;
    const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", nextTheme);
    els.themeToggleBtn.textContent = nextTheme === "dark" ? "🌙" : "☀️";
  });

  els.openApiModalBtn.addEventListener("click", () => {
    els.apiKeyInput.value = GeminiService.getApiKey();
    els.modelSelect.value = GeminiService.getModel();
    els.apiModal.classList.remove("hidden");
  });

  els.closeApiModalBtn.addEventListener("click", () => els.apiModal.classList.add("hidden"));

  els.saveApiKeyBtn.addEventListener("click", () => {
    GeminiService.setApiKey(els.apiKeyInput.value);
    GeminiService.setModel(els.modelSelect.value);
    updateApiStatusUI();
    els.apiModal.classList.add("hidden");
    showToast("✅ Gemini API 및 모델 설정이 저장되었습니다!");
  });

  els.removeApiKeyBtn.addEventListener("click", () => {
    GeminiService.setApiKey("");
    els.apiKeyInput.value = "";
    updateApiStatusUI();
    els.apiModal.classList.add("hidden");
    showToast("ℹ️ API 키가 삭제되어 내장 엔진 모드로 동작합니다.");
  });
}

function showEmptyState(isEmpty) {
  if (isEmpty) {
    els.emptyStateOverlay.classList.remove("hidden");
    els.tabPanels.forEach((p) => p.classList.remove("active"));
  } else {
    els.emptyStateOverlay.classList.add("hidden");
    const activeBtn = document.querySelector(".tab-btn.active");
    const targetId = activeBtn ? activeBtn.dataset.tab : "tab-line-comments";
    switchTab(targetId);
  }
}

function updateApiStatusUI() {
  const model = GeminiService.getModel();
  if (GeminiService.hasApiKey()) {
    els.apiStatusDot.className = "status-dot connected";
    els.apiStatusText.textContent = "Gemini 연결됨";
    els.chatbotModelBadge.textContent = `연결됨 · ${model}`;
  } else {
    els.apiStatusDot.className = "status-dot demo";
    els.apiStatusText.textContent = "API 설정";
    els.chatbotModelBadge.textContent = `기본 튜터 (API 키 설정 시 ${model} 연동)`;
  }
}

function switchTab(tabId) {
  els.tabBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

function updateEditorLineNumbers() {
  const linesCount = (els.codeInput.value.split(/\r?\n/) || []).length || 1;
  const nums = [];
  for (let i = 1; i <= linesCount; i++) nums.push(i);
  els.inputLineNumbers.innerHTML = nums.join("<br/>");
}

async function handleAnalyzeAll() {
  const rawCode = els.codeInput.value;
  if (!rawCode.trim()) {
    if (AppState.viewMode === "analysis-only") setSlideViewMode("split");
    showToast("⚠️ 먼저 코드 입력창에 분석할 내 코드를 붙여넣어 주세요!");
    els.codeInput.focus();
    return;
  }

  if (AppState.viewMode === "code-only") setSlideViewMode("split", 34);

  setLoading(true, "입력하신 코드를 줄 단위 & 작동 블록 단위로 분석하고 있습니다...");
  try {
    const extracted = extractInlineCommentsFromRawCode(rawCode);
    const targetCode = extracted.hasComments ? extracted.cleanCode : rawCode;

    AppState.currentCode = targetCode;
    AppState.selectedLineNumber = 1;
    AppState.currentTraceStepIdx = 0;
    AppState.userCommentsMap = extracted.hasComments ? extracted.commentsMap : {};

    const analysis = await GeminiService.analyzeCode(targetCode, els.langSelect.value);
    AppState.analysisData = analysis;

    showEmptyState(false);
    updateDynamicCodeAlignment();
    renderAllTabs();
    els.gradeResultSection.classList.add("hidden");

    const blockCount = (analysis.logicalBlocks || []).length;
    els.statusBannerText.textContent = `총 ${analysis.lineByLine.length}줄 · 작동 블록 ${blockCount}개 분석 완료`;
    showToast("🔍 코드 1자 정렬 주석 및 작동 블록 해부가 완료되었습니다!");
  } catch (err) {
    console.error(err);
    AppState.analysisData = LocalSmartEngine.analyzeCustomCode(
      AppState.currentCode || rawCode,
      els.langSelect.value
    );
    showEmptyState(false);
    updateDynamicCodeAlignment();
    renderAllTabs();
  } finally {
    setLoading(false);
  }
}

function renderAllTabs() {
  if (!AppState.analysisData) return;
  renderOneLineEssence();
  renderLineByLineTab();
  renderBlockUnitsTab();
  renderUnderstandingTab();
  renderDeepDiveTab();
  renderGraderInputs();
}

function renderOneLineEssence() {
  const essence =
    AppState.analysisData?.oneLineEssence ||
    AppState.analysisData?.deepDive?.summary ||
    "코드를 분석하여 핵심 동작을 단 한 줄로 완벽히 꿰뚫는 요약입니다.";

  if (els.tab1EssenceText) {
    els.tab1EssenceText.textContent = essence;
  }
  updateEssenceBannerVisibility();
}

function updateEssenceBannerVisibility() {
  const shouldShow = Boolean(AppState.showOneLineEssence && AppState.analysisData);
  if (els.tab1EssenceBanner) {
    els.tab1EssenceBanner.classList.toggle("hidden", !shouldShow);
  }
  const tab3Banner = document.getElementById("tab3EssenceBanner");
  if (tab3Banner) {
    tab3Banner.classList.toggle("hidden", !shouldShow);
  }
}

/* =========================================================
 * 공통 코드 줄 & 주석 행 생성기 (한 줄 보기 & 작동 블록별 보기 공통 사용)
 * ========================================================= */
function createCodeLineRowElement(item) {
  const cleanCode = (item.code || "").replace(/\t/g, "    ").trimStart();
  const indentCh = AppState.stripIndentation ? 0 : getIndentCh(item.code);
  const isEmpty = !cleanCode;

  // C언어 / JS / Java 등 단독 닫는 중괄호 } 줄 감지 (다른 줄에 있을 때 산만하지 않고 깔끔하게 보이도록 특별 처리)
  const isClosingBrace = item.isClosingBrace || /^[\}\]\)]+;?$/.test(cleanCode);

  const row = document.createElement("div");
  row.className = "code-line-row";
  if (isClosingBrace) row.classList.add("closing-brace-row");
  row.dataset.linenum = item.lineNumber;
  row.style.setProperty("--line-indent", `${indentCh}ch`);
  if (isEmpty) row.classList.add("empty-line");
  if (item.lineNumber === AppState.selectedLineNumber) row.classList.add("selected");

  let commentText =
    AppState.explanationLevel === "beginner" ? item.beginnerComment : item.advancedComment;

  if (isClosingBrace && !commentText) {
    commentText = "블록 종료";
  }

  const numSpan = document.createElement("span");
  numSpan.className = "row-line-num";
  numSpan.textContent = item.lineNumber;

  const codeSpan = document.createElement("span");
  codeSpan.className = "row-code-text";
  codeSpan.innerHTML = LocalSmartEngine.highlightSyntax(cleanCode, els.langSelect?.value) || "&nbsp;";
  codeSpan.title = "더블클릭하거나 상단 경계선을 드래그하여 코드 영역 너비를 조절할 수 있습니다.";

  const commentDiv = document.createElement("div");
  if (!isEmpty && commentText) {
    commentDiv.className = "row-comment-bubble";
    commentDiv.title = "클릭하여 줄 선택 · 좌/우로 드래그하여 주석 위치/간격 직접 조절";
    commentDiv.textContent = isClosingBrace ? `// ${commentText}` : `# ${commentText}`;
  }

  const pos = AppState.commentPosition;
  if (pos === "right") {
    row.appendChild(numSpan);
    row.appendChild(codeSpan);
    row.appendChild(commentDiv);
  } else if (pos === "left") {
    row.appendChild(numSpan);
    row.appendChild(commentDiv);
    row.appendChild(codeSpan);
  } else if (pos === "top") {
    if (!isEmpty && commentText) row.appendChild(commentDiv);
    const lineWrap = document.createElement("div");
    lineWrap.className = "row-head-inline";
    lineWrap.appendChild(numSpan);
    lineWrap.appendChild(codeSpan);
    row.appendChild(lineWrap);
  } else if (pos === "bottom") {
    const lineWrap = document.createElement("div");
    lineWrap.className = "row-head-inline";
    lineWrap.appendChild(numSpan);
    lineWrap.appendChild(codeSpan);
    row.appendChild(lineWrap);
    if (!isEmpty && commentText) row.appendChild(commentDiv);
  } else {
    row.appendChild(numSpan);
    row.appendChild(codeSpan);
  }

  row.addEventListener("click", () => {
    AppState.selectedLineNumber = item.lineNumber;
    document.querySelectorAll(".code-line-row").forEach((r) => {
      r.classList.toggle("selected", Number(r.dataset.linenum) === item.lineNumber);
    });
    if (els.lineInspector.classList.contains("inspector-collapsed")) {
      els.lineInspector.classList.remove("inspector-collapsed");
      els.restoreInspectorPillBtn.classList.add("hidden");
    }
    updateLineInspector(item);
  });

  return row;
}

/* =========================================================
 * Tab 1 (View A): 한 줄씩 1자 일렬 정렬 & 사용자 지정 주석 위치 렌더링
 * ========================================================= */
function renderLineByLineTab() {
  const listEl = els.lineByLineList;
  listEl.innerHTML = "";

  listEl.className = `line-by-line-container pos-${AppState.commentPosition}`;
  if (AppState.interpretScope !== "line") {
    listEl.classList.add("hidden");
  }

  const lines = AppState.analysisData.lineByLine || [];
  lines.forEach((item) => {
    listEl.appendChild(createCodeLineRowElement(item));
  });

  const initialItem =
    lines.find((l) => l.lineNumber === AppState.selectedLineNumber) ||
    lines.find((l) => (l.code || "").trim().length > 0) ||
    lines[0];
  if (initialItem) updateLineInspector(initialItem);
}

/* =========================================================
 * Tab 1 (View B): 작동 블록 단위 (for/while/if/함수 시작~끝 묶음) 렌더링
 * ========================================================= */
function renderBlockUnitsTab() {
  const container = els.blockUnitsList;
  container.innerHTML = "";

  container.className = `block-units-container pos-${AppState.commentPosition}`;
  if (AppState.interpretScope !== "block") {
    container.classList.add("hidden");
  }

  const allLines = AppState.analysisData?.lineByLine || [];
  let blocks = AppState.analysisData?.logicalBlocks || [];

  // 만약 블록 데이터가 비어있거나 줄 범위 매칭이 깨진 경우 로컬 파서로 즉시 복구
  const hasValidBlocks =
    blocks.length > 0 &&
    blocks.some((b) =>
      allLines.some(
        (l) =>
          Number(l.lineNumber) >= Number(b.startLine) &&
          Number(l.lineNumber) <= Number(b.endLine) &&
          (l.code || "").trim().length > 0
      )
    );

  if (!hasValidBlocks && allLines.length > 0) {
    const rawCode = AppState.currentCode || allLines.map((l) => l.code).join("\n");
    const detectedLang = LocalSmartEngine.detectLanguage(rawCode, els.langSelect.value);
    blocks = LocalSmartEngine.parseLogicalBlocks(
      rawCode.split(/\r?\n/),
      detectedLang,
      allLines
    );
    if (AppState.analysisData) {
      AppState.analysisData.logicalBlocks = blocks;
    }
  }

  blocks.forEach((blk, idx) => {
    const startNum = Number(blk.startLine) || 1;
    const endNum = Math.max(startNum, Number(blk.endLine) || allLines.length);

    let blockLines = allLines.filter(
      (l) =>
        Number(l.lineNumber) >= startNum &&
        Number(l.lineNumber) <= endNum &&
        (l.code || "").trim().length > 0
    );

    if (blockLines.length === 0 && allLines.length > 0) {
      blockLines = allLines.filter((l) => (l.code || "").trim().length > 0);
    }

    const card = document.createElement("div");
    card.className = `block-unit-card draggable-card type-${blk.blockType || "sequential"}`;
    card.dataset.cardId = `blk-${idx}`;

    card.innerHTML = `
      <div class="block-unit-header">
        <div class="block-header-left">
          <span class="drag-grip card-drag-handle" title="드래그하여 작동 블록 카드 순서 변경">⠿</span>
          <span class="block-badge">${escapeHtml(blk.badge || "📦 작동 블록")}</span>
          <strong style="font-size:0.86rem;">${escapeHtml(
            blk.title || `${startNum}번 ~ ${endNum}번 줄 블록`
          )}</strong>
        </div>
        <div class="block-header-right">
          <span class="block-range-pill">${startNum}번 줄 ~ ${endNum}번 줄 (${blockLines.length}줄)</span>
          <button type="button" class="btn btn-ghost btn-sm card-collapse-btn" title="블록 접기/펼치기">▾</button>
        </div>
      </div>
      <div class="block-unit-body">
        <p class="block-summary-text"><strong>💡 이 블록이 하는 일 (시작~끝 통합 해석):</strong> ${escapeHtml(
          blk.summary || "시작 줄부터 끝 줄까지 하나의 작동 단위로 실행되는 코드 블록입니다."
        )}</p>
        ${
          blk.howItWorks
            ? `<div class="block-flow-text"><strong>🔗 내부 연쇄 흐름:</strong> ${escapeHtml(
                blk.howItWorks
              )}</div>`
            : ""
        }
        <div class="block-lines-box"></div>
      </div>
      <div class="card-height-resizer" title="위/아래로 드래그하여 블록 카드 높이 조절"></div>
    `;

    const linesBox = card.querySelector(".block-lines-box");
    blockLines.forEach((ln) => {
      linesBox.appendChild(createCodeLineRowElement(ln));
    });

    container.appendChild(card);
  });

  bindDynamicCardsDragAndResize(container);
}

function updateLineInspector(item) {
  if (!item) return;
  els.inspectorLineNum.textContent = `${item.lineNumber}번 줄 심층 해부`;
  els.inspectorCodePreview.textContent = formatCodeForDisplay(item.code) || "(빈 줄)";

  const beginner = item.beginnerComment || "코드 가독성을 위한 빈 줄입니다.";
  const advanced = item.advancedComment || "";
  const why = item.why || "프로그램 흐름을 구성하는 코드 라인입니다.";

  els.inspectorBody.innerHTML = `
    <p class="inspector-why"><strong>🎯 왜 이렇게 작성했을까요? (Why):</strong> ${escapeHtml(why)}</p>
    <p class="inspector-tip">
      <strong>🌱 초보자 요약:</strong> ${escapeHtml(beginner)}
      ${advanced ? ` · <strong>🚀 실무 표현:</strong> ${escapeHtml(advanced)}` : ""}
    </p>
  `;
}

/* =========================================================
 * 우측 하단 AI 튜터 챗봇 (Gemini API 모델 연동)
 * ========================================================= */
function initChatbot() {
  els.chatbotToggleBtn.addEventListener("click", (e) => {
    if (els.chatbotToggleBtn.dataset.wasDragged === "true") {
      els.chatbotToggleBtn.dataset.wasDragged = "false";
      e.preventDefault();
      return;
    }
    els.chatbotPanel.classList.toggle("hidden");
    if (!els.chatbotPanel.classList.contains("hidden")) {
      els.chatbotInput.focus();
    }
  });

  els.closeChatbotBtn.addEventListener("click", () => {
    els.chatbotPanel.classList.add("hidden");
  });

  els.clearChatBtn.addEventListener("click", () => {
    AppState.chatHistory = [];
    els.chatbotMessages.innerHTML = `
      <div class="chat-msg assistant">
        <div class="chat-bubble">
          대화가 초기화되었습니다. 현재 코드에 대해 궁금한 점을 편하게 물어보세요!
        </div>
      </div>
    `;
  });

  // 인스펙터의 '이 줄 챗봇에게 질문' 버튼 클릭 시
  els.askSelectedLineToChatBtn.addEventListener("click", () => {
    els.chatbotPanel.classList.remove("hidden");
    const lineNum = AppState.selectedLineNumber || 1;
    const item = AppState.analysisData?.lineByLine?.find((l) => l.lineNumber === lineNum);
    const codeSnippet = item ? item.code.trim() : "";
    const q = `${lineNum}번 줄 (${codeSnippet})이 왜 필요한지, 어떻게 동작하는지 더 쉽게 설명해줘!`;
    sendChatMessage(q);
  });

  // 퀵 질문 칩 클릭 시
  els.chatQuickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      sendChatMessage(chip.dataset.prompt);
    });
  });

  els.chatbotForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.chatbotInput.value.trim();
    if (!text) return;
    els.chatbotInput.value = "";
    sendChatMessage(text);
  });
}

async function sendChatMessage(userText) {
  appendChatBubble("user", userText);
  AppState.chatHistory.push({ role: "user", text: userText });

  const loadingBubble = appendChatBubble("assistant", "생각 중입니다... ⏳");

  try {
    const reply = await GeminiService.askChatbot(
      userText,
      AppState.currentCode || els.codeInput.value,
      AppState.analysisData,
      AppState.selectedLineNumber,
      AppState.chatHistory
    );
    loadingBubble.innerHTML = formatSimpleMarkdown(reply);
    AppState.chatHistory.push({ role: "assistant", text: reply });
  } catch (err) {
    loadingBubble.innerHTML = "오류가 발생했습니다. 다시 시도해 주세요.";
  }
  els.chatbotMessages.scrollTop = els.chatbotMessages.scrollHeight;
}

function appendChatBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `chat-msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = formatSimpleMarkdown(text);
  wrap.appendChild(bubble);
  els.chatbotMessages.appendChild(wrap);
  els.chatbotMessages.scrollTop = els.chatbotMessages.scrollHeight;
  return bubble;
}

/* =========================================================
 * Tab 2: 코드 이해 도우미
 * ========================================================= */
function renderUnderstandingTab() {
  const und = AppState.analysisData.understanding || {};

  els.analogyContent.innerHTML = `<div class="analogy-box">${formatSimpleMarkdown(
    und.analogy || "코드의 흐름을 단계별로 따라가며 이해해 보세요."
  )}</div>`;

  renderVariableTracer();

  els.flowStepsContainer.innerHTML = "";
  (und.flowSteps || []).forEach((step, idx) => {
    const node = document.createElement("div");
    node.className = "flow-node";
    node.innerHTML = `
      <div class="flow-step-num">STEP ${idx + 1}</div>
      <div class="flow-step-title">${escapeHtml(step.stepTitle)}</div>
      <div class="flow-step-detail">${escapeHtml(step.detail)}</div>
    `;
    els.flowStepsContainer.appendChild(node);
  });

  els.conceptCardsGrid.innerHTML = "";
  (und.concepts || []).forEach((c) => {
    const card = document.createElement("div");
    card.className = "concept-card";
    card.innerHTML = `
      <span class="concept-tag">${escapeHtml(c.tag || "핵심 개념")}</span>
      <div class="concept-title">${escapeHtml(c.title)}</div>
      <div class="concept-desc">${escapeHtml(c.desc)}</div>
    `;
    els.conceptCardsGrid.appendChild(card);
  });
}

function renderVariableTracer() {
  const und = AppState.analysisData?.understanding || {};
  const traces = und.variableTrace || [];
  const lines = AppState.analysisData?.lineByLine || [];

  if (traces.length === 0) {
    els.stepCounterBadge.textContent = "0 / 0";
    return;
  }

  if (AppState.currentTraceStepIdx >= traces.length) {
    AppState.currentTraceStepIdx = 0;
  }

  const currentTrace = traces[AppState.currentTraceStepIdx];
  els.stepCounterBadge.textContent = `${AppState.currentTraceStepIdx + 1} / ${traces.length}`;
  els.prevStepBtn.disabled = AppState.currentTraceStepIdx === 0;
  els.nextStepBtn.disabled = AppState.currentTraceStepIdx === traces.length - 1;

  els.traceCodeView.innerHTML = "";
  lines.forEach((ln) => {
    const div = document.createElement("div");
    const isHighlighted = ln.lineNumber === currentTrace.highlightLine;
    const dispCode = formatCodeForDisplay(ln.code) || " ";
    div.className = `trace-line ${isHighlighted ? "active-trace-line" : ""}`;
    div.innerHTML = `<span class="row-line-num">${ln.lineNumber}</span><span>${LocalSmartEngine.highlightSyntax(
      dispCode,
      els.langSelect?.value
    )}</span>`;
    els.traceCodeView.appendChild(div);
    if (isHighlighted) {
      setTimeout(() => div.scrollIntoView({ block: "nearest", behavior: "smooth" }), 30);
    }
  });

  els.traceStepExplanation.textContent = currentTrace.description || "";

  els.traceVarsTable.innerHTML = "";
  const varsObj = currentTrace.variables || {};
  Object.entries(varsObj).forEach(([k, v]) => {
    const chip = document.createElement("div");
    chip.className = "var-chip";
    chip.innerHTML = `
      <span class="var-name">${escapeHtml(k)}</span>
      <span class="var-val">${escapeHtml(String(v))}</span>
    `;
    els.traceVarsTable.appendChild(chip);
  });
}

/* =========================================================
 * Tab 3: 코드 완벽 해석
 * ========================================================= */
function renderDeepDiveTab() {
  const deep = AppState.analysisData.deepDive || {};
  const essence =
    AppState.analysisData?.oneLineEssence ||
    deep.summary ||
    "코드를 분석하여 핵심 동작을 단 한 줄로 완벽히 꿰뚫는 요약입니다.";

  const edgeCasesHtml = (deep.edgeCases || [])
    .map((ec) => `<li>${escapeHtml(ec)}</li>`)
    .join("");

  els.deepDiveContainer.innerHTML = `
    <!-- 탭 3 상단 한 줄 완벽 관통 배너 -->
    <div id="tab3EssenceBanner" class="one-line-essence-banner ${AppState.showOneLineEssence ? "" : "hidden"}">
      <span class="essence-badge">⚡ 한 줄 완벽 이해</span>
      <span class="essence-text">${escapeHtml(essence)}</span>
    </div>

    <div class="deep-summary-banner card draggable-card" data-card-id="deep-summary">
      <div class="flex-between" style="margin-bottom:6px;">
        <div class="card-title-with-grip">
          <span class="drag-grip card-drag-handle" title="드래그하여 카드 순서 변경">⠿</span>
          <h3>📌 내 코드 핵심 요약 (TL;DR)</h3>
        </div>
        <button type="button" class="btn btn-ghost btn-sm card-collapse-btn" title="카드 접기/펼치기">▾</button>
      </div>
      <div class="card-body" style="padding:4px 0 0 0;">
        <p>${escapeHtml(deep.summary || "")}</p>
        <p style="margin-top:6px; font-size:0.8rem; color:var(--text-secondary);">
          <strong>🔄 구조 및 입출력:</strong> ${escapeHtml(deep.inputOutput || "")}
        </p>
      </div>
      <div class="card-height-resizer" title="드래그하여 카드 높이 조절"></div>
    </div>

    <div class="card draggable-card" data-card-id="deep-complexity">
      <div class="card-header flex-between">
        <div class="card-title-with-grip">
          <span class="drag-grip card-drag-handle" title="드래그하여 카드 순서 변경">⠿</span>
          <h3>⏱️ 시간 복잡도 & 💾 공간 복잡도</h3>
        </div>
        <button type="button" class="btn btn-ghost btn-sm card-collapse-btn" title="카드 접기/펼치기">▾</button>
      </div>
      <div class="card-body">
        <div class="deep-grid-2">
          <div class="complexity-box">
            <span class="ctrl-label">⏱️ 시간 복잡도</span>
            <div class="complexity-value">${escapeHtml(deep.timeComplexity || "O(N)")}</div>
            <p style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(
              deep.timeReason || ""
            )}</p>
          </div>
          <div class="complexity-box">
            <span class="ctrl-label">💾 공간 복잡도</span>
            <div class="complexity-value">${escapeHtml(deep.spaceComplexity || "O(1)")}</div>
            <p style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(
              deep.spaceReason || ""
            )}</p>
          </div>
        </div>
      </div>
      <div class="card-height-resizer" title="드래그하여 카드 높이 조절"></div>
    </div>

    <div class="card draggable-card" data-card-id="deep-edge">
      <div class="card-header flex-between">
        <div class="card-title-with-grip">
          <span class="drag-grip card-drag-handle" title="드래그하여 카드 순서 변경">⠿</span>
          <h3>⚠️ 이 코드에서 주의해야 할 점 & 엣지 케이스</h3>
        </div>
        <button type="button" class="btn btn-ghost btn-sm card-collapse-btn" title="카드 접기/펼치기">▾</button>
      </div>
      <div class="card-body">
        <ul class="deep-list">
          ${edgeCasesHtml}
        </ul>
      </div>
      <div class="card-height-resizer" title="드래그하여 카드 높이 조절"></div>
    </div>

    <div class="card draggable-card" data-card-id="deep-refactor">
      <div class="card-header flex-between">
        <div class="card-title-with-grip">
          <span class="drag-grip card-drag-handle" title="드래그하여 카드 순서 변경">⠿</span>
          <h3>✨ 주석 정리 / 리팩토링 코드</h3>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button type="button" id="copyImprovedCodeBtn" class="btn btn-outline btn-sm">📋 코드 복사</button>
          <button type="button" class="btn btn-ghost btn-sm card-collapse-btn" title="카드 접기/펼치기">▾</button>
        </div>
      </div>
      <div class="card-body">
        <pre class="code-block-pre"><code>${escapeHtml(deep.improvedCode || "")}</code></pre>
      </div>
      <div class="card-height-resizer" title="드래그하여 카드 높이 조절"></div>
    </div>
  `;

  const copyBtn = document.getElementById("copyImprovedCodeBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      copyTextToClipboard(deep.improvedCode || "").then(() => {
        showToast("📋 코드가 복사되었습니다!");
      });
    });
  }

  bindDynamicCardsDragAndResize(els.deepDiveContainer);
}

/* =========================================================
 * Tab 4: 주석 확인 및 채점
 * ========================================================= */
function renderGraderInputs() {
  const listEl = els.graderLinesInputList;
  listEl.innerHTML = "";

  const lines = AppState.analysisData?.lineByLine || [];
  lines.forEach((item) => {
    if (!item.code.trim()) return;

    const row = document.createElement("div");
    row.className = "grader-line-item";

    const existingVal = AppState.userCommentsMap[item.lineNumber] || "";

    row.innerHTML = `
      <span class="row-line-num">${item.lineNumber}</span>
      <code class="grader-code-snippet">${escapeHtml(formatCodeForDisplay(item.code))}</code>
      <input
        type="text"
        class="grader-comment-input"
        data-linenum="${item.lineNumber}"
        value="${escapeAttr(existingVal)}"
        placeholder="이 줄의 동작을 내가 이해한 대로 적어보세요..."
      />
    `;

    const inputEl = row.querySelector("input");
    inputEl.addEventListener("input", (e) => {
      AppState.userCommentsMap[item.lineNumber] = e.target.value;
    });

    listEl.appendChild(row);
  });

  syncMapToRawCommentedTextarea();
}

function syncMapToRawCommentedTextarea() {
  if (!AppState.analysisData) return;
  const detectedLang = LocalSmartEngine.detectLanguage(
    AppState.currentCode,
    els.langSelect.value
  );
  const isCStyle = ["javascript", "c", "java", "go"].includes(detectedLang);
  const prefix = isCStyle ? "//" : "#";

  const lines = AppState.analysisData.lineByLine.map((item) => {
    const userCmt = (AppState.userCommentsMap[item.lineNumber] || "").trim();
    if (!item.code.trim() || !userCmt) return item.code;
    return `${item.code}  ${prefix} ${userCmt}`;
  });
  els.rawCommentedCodeInput.value = lines.join("\n");
}

function extractInlineCommentsFromRawCode(rawText) {
  const lines = rawText.split(/\r?\n/);
  const cleanLines = [];
  const commentsMap = {};
  let hasComments = false;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (line.trim().startsWith("#include") || line.trim().startsWith("#define")) {
      cleanLines.push(line);
      return;
    }
    const match = line.match(/^(.*?)\s*(?:#|\/\/)\s*(.+)$/);
    if (match && match[1].trim().length > 0) {
      cleanLines.push(match[1]);
      commentsMap[lineNum] = match[2].trim();
      hasComments = true;
    } else {
      cleanLines.push(line);
    }
  });

  return {
    hasComments,
    cleanCode: cleanLines.join("\n"),
    commentsMap
  };
}

async function handleRunGrading() {
  if (!AppState.analysisData) {
    await handleAnalyzeAll();
    if (!AppState.analysisData) return;
  }

  if (AppState.graderMode === "raw" && els.rawCommentedCodeInput.value.trim()) {
    const extracted = extractInlineCommentsFromRawCode(els.rawCommentedCodeInput.value);
    if (extracted.cleanCode.trim() && extracted.cleanCode.trim() !== AppState.currentCode.trim()) {
      AppState.currentCode = extracted.cleanCode;
      els.codeInput.value = extracted.cleanCode;
      updateEditorLineNumbers();
      AppState.analysisData = await GeminiService.analyzeCode(
        extracted.cleanCode,
        els.langSelect.value
      );
      updateDynamicCodeAlignment();
      renderAllTabs();
    }
    if (extracted.hasComments) {
      AppState.userCommentsMap = extracted.commentsMap;
      renderGraderInputs();
    }
  }

  setLoading(true, "내가 작성한 주석의 정확도를 채점하고 있습니다...");
  try {
    const report = await GeminiService.gradeComments(
      AppState.currentCode,
      AppState.userCommentsMap,
      AppState.analysisData
    );
    renderGradeReport(report);
    if (report.grade !== "-") {
      showToast(`🏆 주석 채점 완료! 종합 점수: ${report.score}점 (${report.grade}등급)`);
    } else {
      showToast("⚠️ 채점할 주석을 최소 1줄 이상 입력해 주세요!");
    }
  } catch (err) {
    console.error(err);
    const fallbackReport = LocalSmartEngine.gradeUserComments(
      AppState.currentCode,
      AppState.userCommentsMap,
      AppState.analysisData
    );
    renderGradeReport(fallbackReport);
  } finally {
    setLoading(false);
  }
}

function renderGradeReport(report) {
  const sec = els.gradeResultSection;
  sec.classList.remove("hidden");

  const feedbackItemsHtml = (report.feedbackList || [])
    .map(
      (item) => `
      <div class="grade-item-card status-${item.status}">
        <div class="grade-item-top">
          <div>
            <span class="inspector-badge">${item.lineNumber}번 줄</span>
            <code class="inspector-code">${escapeHtml(formatCodeForDisplay(item.code))}</code>
          </div>
          <span class="verdict-badge ${item.status}">${escapeHtml(item.verdictLabel)}</span>
        </div>
        <div class="grade-compare-grid">
          <div class="compare-box">
            <div class="compare-label">✏️ 내가 작성한 주석</div>
            <div>${escapeHtml(item.userComment)}</div>
          </div>
          <div class="compare-box">
            <div class="compare-label">🎯 모범 정답 주석</div>
            <div style="color:var(--comment-green);">${escapeHtml(item.modelComment)}</div>
          </div>
        </div>
        <div class="grade-feedback-text">
          <strong>💡 피드백:</strong> ${formatSimpleMarkdown(item.feedback)}
        </div>
      </div>
    `
    )
    .join("");

  sec.innerHTML = `
    <div class="score-hero-card">
      <div class="score-circle">
        <span class="score-num">${report.score}점</span>
        <span class="score-grade-badge">등급: ${escapeHtml(report.grade)}</span>
      </div>
      <div class="score-summary-info">
        <h4>${escapeHtml(report.summaryTitle)}</h4>
        <p style="font-size:0.82rem; color:var(--text-secondary);">${escapeHtml(
          report.summaryText
        )}</p>
        <div class="score-stats-pills">
          <span class="stat-pill correct">✅ 정확함 ${report.correctCount}개</span>
          <span class="stat-pill partial">⚠️ 보완 필요 ${report.partialCount}개</span>
          <span class="stat-pill incorrect">❌ 오개념 교정 ${report.incorrectCount}개</span>
        </div>
      </div>
    </div>

    <div class="grade-feedback-list">
      ${feedbackItemsHtml}
    </div>
  `;

  setTimeout(() => {
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 60);
}

/* =========================================================
 * 유틸리티 함수
 * ========================================================= */
function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }
  return fallbackCopyText(text);
}

function fallbackCopyText(text) {
  return new Promise((resolve) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
    resolve();
  });
}

function setLoading(isLoading, msg = "분석 중...") {
  if (isLoading) {
    els.loadingMessage.textContent = msg;
    els.loadingOverlay.classList.remove("hidden");
  } else {
    els.loadingOverlay.classList.add("hidden");
  }
}

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 3000);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function formatSimpleMarkdown(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}

/* =========================================================
 * All-UI Drag Customization System (모든 UI 마우스 드래그 커스텀 엔진)
 * 1) 메인 코드창/해석창 4방향(상/하/좌/우) 드래그 도킹 배치
 * 2) 주석 시작선 & 주석 말풍선 좌/우 직접 드래그로 주석 위치/간격 조절
 * 3) 하단 '선택한 줄 심층 해부' 창 상단 리사이즈 & 자유 플로팅 드래그 이동
 * 4) 상단 1~4번 탭 드래그 순서 변경
 * 5) 각 탭 내부 카드(블록 해부 카드·이해 도우미·완벽 해석·채점) 드래그 순서 변경 & 하단 높이 조절 & 접기/펼치기
 * 6) 시뮬레이터/채점창 내부 좌우 구분선 드래그 비율 조절
 * 7) AI 튜터 챗봇 버튼/창 자유 드래그 이동 & 8방향 크기 조절
 * 8) 상단 [↺ UI 초기화] 버튼으로 원클릭 복구
 * ========================================================= */
function initDragCustomizationSystem() {
  // 1. 메인 패널(코드창 / 해석창) 4방향 드래그 도킹
  let draggingPaneName = null;
  let activeDockZone = null;
  const dockZones = document.querySelectorAll(".dock-drop-zone");

  document.querySelectorAll(".pane-dock-handle").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      draggingPaneName = handle.dataset.pane;
      els.workspaceDockOverlay.classList.remove("hidden");
      document.body.style.userSelect = "none";
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (!draggingPaneName) return;
    activeDockZone = null;
    dockZones.forEach((zone) => {
      const r = zone.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      zone.classList.toggle("active-drop", inside);
      if (inside) activeDockZone = zone.dataset.dock;
    });
  });

  window.addEventListener("mouseup", () => {
    if (!draggingPaneName) return;
    els.workspaceDockOverlay.classList.add("hidden");
    dockZones.forEach((z) => z.classList.remove("active-drop"));
    document.body.style.userSelect = "";

    if (activeDockZone) {
      const isCodePane = draggingPaneName === "codePane";
      if (activeDockZone === "top") {
        setWorkspaceDockLayout(isCodePane ? "vertical" : "vertical-reverse");
      } else if (activeDockZone === "bottom") {
        setWorkspaceDockLayout(isCodePane ? "vertical-reverse" : "vertical");
      } else if (activeDockZone === "left") {
        setWorkspaceDockLayout(isCodePane ? "horizontal" : "horizontal-reverse");
      } else if (activeDockZone === "right") {
        setWorkspaceDockLayout(isCodePane ? "horizontal-reverse" : "horizontal");
      }
      if (AppState.viewMode !== "split") {
        setSlideViewMode("split", 38);
      }
      showToast("✨ 패널 위치가 드래그한 방향으로 재배치되었습니다!");
    }
    draggingPaneName = null;
    activeDockZone = null;
  });

  // 2. 코드 영역 폭 & 주석 간격 직접 드래그 조절 (코드 영역이 실제로 넓어지거나 좁아짐!)
  let isDraggingCodeWidth = false;
  let codeWidthStartX = 0;
  let codeWidthStartCh = 32;

  const startCodeWidthDrag = (clientX) => {
    isDraggingCodeWidth = true;
    codeWidthStartX = clientX;
    codeWidthStartCh = AppState.userCodeWidthCh || 32;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  };

  if (els.codeWidthDragThumb) {
    els.codeWidthDragThumb.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startCodeWidthDrag(e.clientX);
    });
  }

  // 코드 텍스트(.row-code-text) 오른쪽 경계를 더블클릭하면 최적 너비로 자동 맞춤
  const bindCodeRowTextDrag = (containerEl) => {
    if (!containerEl) return;
    containerEl.addEventListener("dblclick", (e) => {
      if (e.target.closest(".row-code-text")) {
        AppState.userAdjustedCodeWidth = false;
        updateDynamicCodeAlignment();
        showToast("↔ 코드 영역 너비가 내용 길이에 맞게 자동 정렬되었습니다.");
      }
    });
  };
  bindCodeRowTextDrag(els.lineByLineList);
  bindCodeRowTextDrag(els.blockUnitsList);

  let isDraggingCommentCol = false;
  let commentDragStartX = 0;
  let commentDragStartGap = 32;

  const startCommentGapDrag = (clientX) => {
    isDraggingCommentCol = true;
    commentDragStartX = clientX;
    commentDragStartGap = AppState.userCommentGapPx || 32;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  };

  if (els.commentColumnDragThumb) {
    els.commentColumnDragThumb.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startCommentGapDrag(e.clientX);
    });
  }

  // 주석 말풍선(.row-comment-bubble)을 마우스로 잡고 좌/우로 끌어도 주석 간격이 즉시 조절됨
  const bindCommentBubbleDrag = (containerEl) => {
    if (!containerEl) return;
    containerEl.addEventListener("mousedown", (e) => {
      const bubble = e.target.closest(".row-comment-bubble");
      if (!bubble) return;
      startCommentGapDrag(e.clientX);
    });
  };
  bindCommentBubbleDrag(els.lineByLineList);
  bindCommentBubbleDrag(els.blockUnitsList);

  window.addEventListener("mousemove", (e) => {
    if (isDraggingCodeWidth) {
      // 마우스 8px 이동당 약 1ch 너비 변경
      const deltaX = e.clientX - codeWidthStartX;
      const nextCh = Math.max(14, Math.min(100, Math.round(codeWidthStartCh + deltaX / 8)));
      AppState.userAdjustedCodeWidth = true;
      AppState.userCodeWidthCh = nextCh;
      if (els.codeWidthSlider) els.codeWidthSlider.value = nextCh;
      els.lineByLineList.style.setProperty("--code-col-width", `${nextCh}ch`);
      els.blockUnitsList.style.setProperty("--code-col-width", `${nextCh}ch`);
    } else if (isDraggingCommentCol) {
      const deltaX = e.clientX - commentDragStartX;
      const dirMultiplier = AppState.commentPosition === "left" ? -1 : 1;
      const nextGap = Math.max(4, Math.min(360, Math.round(commentDragStartGap + deltaX * dirMultiplier)));
      AppState.userAdjustedGap = true;
      AppState.userCommentGapPx = nextGap;
      if (els.commentGapSlider) {
        els.commentGapSlider.value = Math.min(280, Math.max(8, nextGap));
      }
      els.lineByLineList.style.setProperty("--comment-gap", `${nextGap}px`);
      els.blockUnitsList.style.setProperty("--comment-gap", `${nextGap}px`);
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingCodeWidth || isDraggingCommentCol) {
      isDraggingCodeWidth = false;
      isDraggingCommentCol = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
  });

  // 3. 하단 '선택한 줄 심층 해부(Why)' 패널 상단 리사이즈 & 플로팅 드래그 이동
  let isResizingInspector = false;
  let inspStartY = 0;
  let inspStartHeight = 125;

  if (els.inspectorResizeHandle) {
    els.inspectorResizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingInspector = true;
      inspStartY = e.clientY;
      inspStartHeight = els.lineInspector.getBoundingClientRect().height;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";
    });
  }

  let isMovingInspector = false;
  let inspMoveOffsetX = 0;
  let inspMoveOffsetY = 0;

  if (els.inspectorDragHeader) {
    els.inspectorDragHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      const grip = e.target.closest(".drag-grip");
      if (!grip && !els.lineInspector.classList.contains("is-floating")) return;

      e.preventDefault();
      const rect = els.lineInspector.getBoundingClientRect();
      if (!els.lineInspector.classList.contains("is-floating")) {
        els.lineInspector.classList.add("is-floating");
        els.lineInspector.style.left = `${Math.max(12, rect.left)}px`;
        els.lineInspector.style.top = `${Math.max(50, rect.top)}px`;
        els.lineInspector.style.width = `${Math.min(620, rect.width)}px`;
        if (els.dockInspectorBtn) els.dockInspectorBtn.classList.remove("hidden");
      }
      isMovingInspector = true;
      inspMoveOffsetX = e.clientX - rect.left;
      inspMoveOffsetY = e.clientY - rect.top;
      document.body.style.userSelect = "none";
    });
  }

  if (els.dockInspectorBtn) {
    els.dockInspectorBtn.addEventListener("click", () => {
      els.lineInspector.classList.remove("is-floating");
      els.lineInspector.style.left = "";
      els.lineInspector.style.top = "";
      els.lineInspector.style.width = "";
      els.dockInspectorBtn.classList.add("hidden");
      showToast("📌 심층 해부창이 하단 기본 위치로 고정되었습니다.");
    });
  }

  window.addEventListener("mousemove", (e) => {
    if (isResizingInspector) {
      const deltaY = inspStartY - e.clientY;
      const nextH = Math.max(68, Math.min(480, inspStartHeight + deltaY));
      els.lineInspector.style.maxHeight = `${nextH}px`;
      els.lineInspector.style.height = `${nextH}px`;
    } else if (isMovingInspector) {
      const nextX = Math.max(8, Math.min(window.innerWidth - 220, e.clientX - inspMoveOffsetX));
      const nextY = Math.max(46, Math.min(window.innerHeight - 90, e.clientY - inspMoveOffsetY));
      els.lineInspector.style.left = `${nextX}px`;
      els.lineInspector.style.top = `${nextY}px`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (isResizingInspector || isMovingInspector) {
      isResizingInspector = false;
      isMovingInspector = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
  });

  // 4. 상단 1~4번 기능 탭 드래그 앤 드롭 순서 변경
  if (els.featureTabsNav) {
    let draggedTab = null;
    els.featureTabsNav.querySelectorAll(".tab-btn").forEach((tabBtn) => {
      tabBtn.addEventListener("dragstart", (e) => {
        draggedTab = tabBtn;
        tabBtn.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      tabBtn.addEventListener("dragend", () => {
        tabBtn.classList.remove("dragging");
        els.featureTabsNav.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("drag-over"));
        draggedTab = null;
      });
      tabBtn.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggedTab || draggedTab === tabBtn) return;
        tabBtn.classList.add("drag-over");
      });
      tabBtn.addEventListener("dragleave", () => {
        tabBtn.classList.remove("drag-over");
      });
      tabBtn.addEventListener("drop", (e) => {
        e.preventDefault();
        tabBtn.classList.remove("drag-over");
        if (!draggedTab || draggedTab === tabBtn) return;
        const allTabs = Array.from(els.featureTabsNav.querySelectorAll(".tab-btn"));
        const fromIdx = allTabs.indexOf(draggedTab);
        const toIdx = allTabs.indexOf(tabBtn);
        if (fromIdx < toIdx) {
          els.featureTabsNav.insertBefore(draggedTab, tabBtn.nextSibling);
        } else {
          els.featureTabsNav.insertBefore(draggedTab, tabBtn);
        }
        showToast("✨ 탭 순서가 변경되었습니다.");
      });
    });
  }

  // 5. 탭 2 (이해 도우미) & 탭 4 (채점소) 정적 카드들의 드래그 순서 변경 & 높이 조절 바인딩
  document.querySelectorAll(".sortable-card-list").forEach((listEl) => {
    bindDynamicCardsDragAndResize(listEl);
  });

  // 6. 내부 좌우 구분선 리사이즈 (탭 2 시뮬레이터 좌우 비율 & 탭 4 코드/주석 열 비율)
  let isDraggingTraceSplit = false;
  if (els.traceSplitResizer && els.traceSplitContainer && els.traceLeftPane) {
    els.traceSplitResizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDraggingTraceSplit = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    });
  }

  let isDraggingGraderCol = false;
  let graderStartX = 0;
  let graderStartRatio = 45;
  if (els.graderColResizer) {
    els.graderColResizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isDraggingGraderCol = true;
      graderStartX = e.clientX;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    });
  }

  window.addEventListener("mousemove", (e) => {
    if (isDraggingTraceSplit && els.traceSplitContainer) {
      const rect = els.traceSplitContainer.getBoundingClientRect();
      const pct = Math.max(22, Math.min(78, ((e.clientX - rect.left) / rect.width) * 100));
      els.traceSplitContainer.style.setProperty("--trace-split-ratio", `${pct}%`);
    } else if (isDraggingGraderCol && els.graderLinesInputList) {
      const delta = e.clientX - graderStartX;
      graderStartX = e.clientX;
      graderStartRatio = Math.max(20, Math.min(75, graderStartRatio + delta * 0.12));
      els.graderLinesInputList.style.setProperty("--grader-code-col", `${graderStartRatio}%`);
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingTraceSplit || isDraggingGraderCol) {
      isDraggingTraceSplit = false;
      isDraggingGraderCol = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
  });

  // 7. 우측 하단 AI 튜터 챗봇 버튼(FAB) & 챗봇 창 자유 드래그 이동 + 8방향 크기 조절
  initChatbotDragAndResize();

  // 8. 상단바 [↺ UI 초기화] 버튼
  if (els.resetUiLayoutBtn) {
    els.resetUiLayoutBtn.addEventListener("click", () => resetAllCustomUiLayout());
  }
}

function bindDynamicCardsDragAndResize(containerEl) {
  if (!containerEl) return;

  // (A) 접기/펼치기 버튼 바인딩
  containerEl.querySelectorAll(".card-collapse-btn").forEach((btn) => {
    if (btn.dataset.boundCollapse === "true") return;
    btn.dataset.boundCollapse = "true";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".card, .block-unit-card");
      if (!card) return;
      const collapsed = card.classList.toggle("is-collapsed");
      btn.textContent = collapsed ? "▸" : "▾";
    });
  });

  // (B) 카드 하단 높이 드래그 조절 바인딩
  containerEl.querySelectorAll(".card-height-resizer").forEach((resizer) => {
    if (resizer.dataset.boundResize === "true") return;
    resizer.dataset.boundResize = "true";
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = resizer.closest(".card, .block-unit-card");
      if (!card) return;
      const startY = e.clientY;
      const startH = card.getBoundingClientRect().height;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";

      const onMove = (ev) => {
        const nextH = Math.max(64, startH + (ev.clientY - startY));
        card.style.height = `${nextH}px`;
        card.style.overflowY = "auto";
      };
      const onUp = () => {
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  });

  // (C) 카드 드래그 앤 드롭 순서 변경 바인딩 (⠿ 핸들을 잡았을 때만 draggable 활성화)
  let draggedCard = null;
  containerEl.querySelectorAll(".draggable-card").forEach((card) => {
    if (card.dataset.boundDrag === "true") return;
    card.dataset.boundDrag = "true";

    const handle = card.querySelector(".card-drag-handle");
    if (handle) {
      handle.addEventListener("mousedown", () => {
        card.setAttribute("draggable", "true");
      });
      handle.addEventListener("mouseup", () => {
        card.removeAttribute("draggable");
      });
    }

    card.addEventListener("dragstart", (e) => {
      draggedCard = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      card.removeAttribute("draggable");
      containerEl
        .querySelectorAll(".draggable-card")
        .forEach((c) => c.classList.remove("drag-over"));
      draggedCard = null;
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedCard || draggedCard === card || draggedCard.parentElement !== containerEl) return;
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (!draggedCard || draggedCard === card || draggedCard.parentElement !== containerEl) return;
      const cards = Array.from(containerEl.querySelectorAll(".draggable-card"));
      const fromIdx = cards.indexOf(draggedCard);
      const toIdx = cards.indexOf(card);
      if (fromIdx < toIdx) {
        containerEl.insertBefore(draggedCard, card.nextSibling);
      } else {
        containerEl.insertBefore(draggedCard, card);
      }
      showToast("✨ 카드 배치 순서가 변경되었습니다.");
    });
  });
}

function initChatbotDragAndResize() {
  // 1) 플로팅 런처 버튼(#chatbotToggleBtn)을 잡아서 위젯 전체 위치 이동
  let isDraggingFab = false;
  let fabStartX = 0;
  let fabStartY = 0;
  let widgetStartLeft = 0;
  let widgetStartTop = 0;

  if (els.chatbotToggleBtn) {
    els.chatbotToggleBtn.addEventListener("mousedown", (e) => {
      isDraggingFab = true;
      fabStartX = e.clientX;
      fabStartY = e.clientY;
      const rect = els.chatbotWidget.getBoundingClientRect();
      widgetStartLeft = rect.left;
      widgetStartTop = rect.top;
      document.body.style.userSelect = "none";
    });
  }

  // 2) 열린 챗봇 창 헤더(#chatbotDragHeader)를 잡아서 이동
  let isDraggingChatHeader = false;
  let chatHdrStartX = 0;
  let chatHdrStartY = 0;

  if (els.chatbotDragHeader) {
    els.chatbotDragHeader.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      isDraggingChatHeader = true;
      chatHdrStartX = e.clientX;
      chatHdrStartY = e.clientY;
      const rect = els.chatbotWidget.getBoundingClientRect();
      widgetStartLeft = rect.left;
      widgetStartTop = rect.top;
      document.body.style.userSelect = "none";
    });
  }

  // 3) 챗봇 창 8방향 모서리/테두리 크기 조절(.chat-resizer)
  let activeResizeDir = null;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let startPanelW = 360;
  let startPanelH = 460;

  els.chatbotPanel.querySelectorAll(".chat-resizer").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeResizeDir = handle.dataset.dir;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      const rect = els.chatbotPanel.getBoundingClientRect();
      startPanelW = rect.width;
      startPanelH = rect.height;
      document.body.style.userSelect = "none";
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingFab) {
      const dx = e.clientX - fabStartX;
      const dy = e.clientY - fabStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        els.chatbotToggleBtn.dataset.wasDragged = "true";
        const nextL = Math.max(8, Math.min(window.innerWidth - 120, widgetStartLeft + dx));
        const nextT = Math.max(8, Math.min(window.innerHeight - 50, widgetStartTop + dy));
        els.chatbotWidget.style.left = `${nextL}px`;
        els.chatbotWidget.style.top = `${nextT}px`;
        els.chatbotWidget.style.right = "auto";
        els.chatbotWidget.style.bottom = "auto";
      }
    } else if (isDraggingChatHeader) {
      const dx = e.clientX - chatHdrStartX;
      const dy = e.clientY - chatHdrStartY;
      const nextL = Math.max(8, Math.min(window.innerWidth - 180, widgetStartLeft + dx));
      const nextT = Math.max(8, Math.min(window.innerHeight - 100, widgetStartTop + dy));
      els.chatbotWidget.style.left = `${nextL}px`;
      els.chatbotWidget.style.top = `${nextT}px`;
      els.chatbotWidget.style.right = "auto";
      els.chatbotWidget.style.bottom = "auto";
    } else if (activeResizeDir) {
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      let nextW = startPanelW;
      let nextH = startPanelH;

      if (activeResizeDir.includes("e")) nextW = startPanelW + dx;
      if (activeResizeDir.includes("w")) nextW = startPanelW - dx;
      if (activeResizeDir.includes("s")) nextH = startPanelH + dy;
      if (activeResizeDir.includes("n")) nextH = startPanelH - dy;

      nextW = Math.max(280, Math.min(window.innerWidth - 24, nextW));
      nextH = Math.max(260, Math.min(window.innerHeight - 40, nextH));

      els.chatbotPanel.style.width = `${nextW}px`;
      els.chatbotPanel.style.height = `${nextH}px`;
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingFab || isDraggingChatHeader || activeResizeDir) {
      isDraggingFab = false;
      isDraggingChatHeader = false;
      activeResizeDir = null;
      document.body.style.userSelect = "";
    }
  });
}

function resetAllCustomUiLayout() {
  // 1) 메인 워크스페이스 도킹 및 비율 초기화
  setWorkspaceDockLayout("vertical");
  setSlideViewMode("split", 36);

  // 2) 코드 영역 폭 및 주석 위치·간격 초기화
  AppState.commentPosition = "right";
  els.commentPosSelect.value = "right";
  AppState.userAdjustedCodeWidth = false;
  AppState.userAdjustedGap = false;
  AppState.userCommentGapPx = 32;
  AppState.showOneLineEssence = true;
  if (els.oneLineEssenceToggle) els.oneLineEssenceToggle.checked = true;
  els.commentGapControlGroup.style.display = "inline-flex";
  if (els.codeWidthControlGroup) els.codeWidthControlGroup.style.display = "inline-flex";
  if (els.commentColumnDragBar) els.commentColumnDragBar.style.display = "flex";
  updateDynamicCodeAlignment();

  // 3) 인스펙터 위치 및 높이 초기화
  els.lineInspector.classList.remove("is-floating", "inspector-collapsed", "inspector-maximized");
  els.lineInspector.style.left = "";
  els.lineInspector.style.top = "";
  els.lineInspector.style.width = "";
  els.lineInspector.style.height = "";
  els.lineInspector.style.maxHeight = "";
  if (els.dockInspectorBtn) els.dockInspectorBtn.classList.add("hidden");
  els.restoreInspectorPillBtn.classList.add("hidden");

  // 4) 챗봇 위치 및 크기 초기화
  els.chatbotWidget.style.left = "";
  els.chatbotWidget.style.top = "";
  els.chatbotWidget.style.right = "16px";
  els.chatbotWidget.style.bottom = "16px";
  els.chatbotPanel.style.width = "";
  els.chatbotPanel.style.height = "";

  // 5) 내부 스플리터 및 카드 높이/접힘 초기화
  if (els.traceSplitContainer) {
    els.traceSplitContainer.style.removeProperty("--trace-split-ratio");
  }
  if (els.graderLinesInputList) {
    els.graderLinesInputList.style.removeProperty("--grader-code-col");
  }
  document.querySelectorAll(".card, .block-unit-card").forEach((c) => {
    c.classList.remove("is-collapsed");
    c.style.height = "";
    c.style.overflowY = "";
  });
  document.querySelectorAll(".card-collapse-btn").forEach((b) => {
    b.textContent = "▾";
  });

  // 6) 상단 1~4번 탭 기본 순서 복원
  if (els.featureTabsNav) {
    const order = [
      "tab-line-comments",
      "tab-understanding",
      "tab-deep-dive",
      "tab-comment-grader"
    ];
    order.forEach((tabId) => {
      const btn = els.featureTabsNav.querySelector(`[data-tab="${tabId}"]`);
      if (btn) els.featureTabsNav.appendChild(btn);
    });
  }

  if (AppState.analysisData) {
    renderAllTabs();
  }
  showToast("↺ 모든 UI 크기·위치·배치 순서가 기본 상태로 초기화되었습니다!");
}
