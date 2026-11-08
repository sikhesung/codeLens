// Google Gemini API 연동 서비스 (코드 분석 + 작동 블록 추출 + 주석 채점 + AI 학습 챗봇)

const GeminiService = {
  STORAGE_KEY: "CODELENS_GEMINI_API_KEY",
  MODEL_KEY: "CODELENS_GEMINI_MODEL",
  _memStore: {},

  _getItem(key) {
    try {
      return localStorage.getItem(key) || this._memStore[key] || "";
    } catch (e) {
      return this._memStore[key] || "";
    }
  },

  _setItem(key, val) {
    this._memStore[key] = val;
    try {
      if (val) localStorage.setItem(key, val);
      else localStorage.removeItem(key);
    } catch (e) {}
  },

  getApiKey() {
    return this._getItem(this.STORAGE_KEY);
  },

  setApiKey(key) {
    if (key && key.trim()) {
      this._setItem(this.STORAGE_KEY, key.trim());
    } else {
      this._setItem(this.STORAGE_KEY, "");
    }
  },

  getModel() {
    return this._getItem(this.MODEL_KEY) || "gemini-2.5-flash";
  },

  setModel(model) {
    this._setItem(this.MODEL_KEY, model);
  },

  hasApiKey() {
    return Boolean(this.getApiKey());
  },

  async analyzeCode(code, lang = "auto") {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      return LocalSmartEngine.analyzeCustomCode(code, lang);
    }

    const lines = code.split(/\r?\n/);
    const numberedCode = lines.map((line, idx) => `${idx + 1}: ${line}`).join("\n");

    const prompt = `당신은 프로그래밍 교육 및 코드 리뷰 최고 전문가 'CodeLens'입니다.
사용자가 입력한 아래 코드를 분석하여 반드시 지정된 JSON 형식으로만 응답하세요 (한국어로 작성).
코드의 총 줄 수는 ${lines.length}줄입니다. lineByLine 배열에는 1번 줄부터 ${lines.length}번 줄까지 모든 줄을 빠짐없이 순서대로 포함하세요(빈 줄은 beginnerComment, advancedComment를 ""로 비워두세요).
또한 logicalBlocks 배열에는 함수, for문, while문, if~else문 등 하나의 작동 코드 블록이 몇 번 줄에서 시작해서 몇 번 줄에서 끝나는지(startLine ~ endLine) 묶어서 설명을 포함하세요.

[분석할 코드 (언어 힌트: ${lang})]
${numberedCode}

[응답 JSON 스키마]
{
  "oneLineEssence": "이 코드 전체를 단 한 문장으로 완벽하게 이해시키는 핵심 관통 요약 (예: '⚡ 이 코드는 1부터 N까지의 숫자 중 짝수만 골라 합계를 구하는 코드입니다.')",
  "lineByLine": [
    {
      "lineNumber": 1,
      "code": "원본 코드 한 줄 (들여쓰기 그대로 유지)",
      "beginnerComment": "초보자도 단번에 이해할 수 있는 친절하고 쉬운 한 줄 주석",
      "advancedComment": "실무자/전공자 수준의 정확한 컴퓨터공학적 한 줄 주석",
      "why": "이 줄을 왜 이렇게 작성했는지 심층 설명"
    }
  ],
  "logicalBlocks": [
    {
      "blockType": "function | loop-for | loop-while | branch-if | sequential",
      "badge": "🔁 for 반복문 블록 (또는 📦 함수 블록 / 🔄 while 블록 / 🔀 if 조건 블록)",
      "title": "블록 제목 (예: for 반복 작동 구간 (5번 ~ 12번 줄))",
      "startLine": 5,
      "endLine": 12,
      "summary": "이 블록(시작 줄~끝 줄)이 하나의 작동 단위로써 무슨 일을 하는지 명확한 설명",
      "howItWorks": "블록 내부가 어떤 순서로 맞물려 돌아가는지 단계별 흐름 요약"
    }
  ],
  "understanding": {
    "analogy": "이 코드의 전체 동작 원리를 일상생활의 비유로 아주 쉽게 설명 (2~4문장)",
    "flowSteps": [
      { "stepTitle": "1. 단계 제목", "detail": "단계 핵심 동작 설명" }
    ],
    "variableTrace": [
      {
        "step": 1,
        "highlightLine": 1,
        "description": "구체적인 예시 입력값을 가정했을 때 현재 실행 단계에서 일어나는 일 설명",
        "variables": { "변수명1": "현재값1", "변수명2": "현재값2" }
      }
    ],
    "concepts": [
      {
        "tag": "분류 태그 (예: 핵심 문법 / 자료구조 / 알고리즘)",
        "title": "개념 또는 문법 이름",
        "desc": "이 코드에서 어떻게 쓰였는지 이해하기 쉬운 설명"
      }
    ]
  },
  "deepDive": {
    "summary": "이 코드의 전체 목적과 동작 원리를 완벽하게 요약 (1~2문장)",
    "inputOutput": "입력(Input)과 출력(Output) 명세 설명",
    "timeComplexity": "빅오 표기법 (예: O(N), O(N log N))",
    "timeReason": "왜 그런 시간 복잡도가 나오는지 명확한 이유",
    "spaceComplexity": "빅오 표기법 (예: O(1), O(N))",
    "spaceReason": "왜 그런 공간 복잡도가 나오는지 명확한 이유",
    "edgeCases": [
      "주의해야 할 엣지 케이스, 잠재적 버그, 또는 주의사항"
    ],
    "improvedCode": "가독성, 안전성, 또는 성능을 개선한 모범 리팩토링 코드"
  }
}`;

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API 호출 실패 (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      throw new Error("Gemini API 응답에서 분석 데이터를 찾을 수 없습니다.");
    }

    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed.lineByLine)) {
      parsed.lineByLine = parsed.lineByLine.map((item, idx) => ({
        ...item,
        lineNumber: parseInt(String(item.lineNumber ?? idx + 1).replace(/\D/g, ""), 10) || idx + 1,
        code: item.code !== undefined ? String(item.code) : (lines[idx] ?? "")
      }));
    }
    if (Array.isArray(parsed.logicalBlocks) && parsed.logicalBlocks.length > 0) {
      parsed.logicalBlocks = parsed.logicalBlocks
        .map((blk) => {
          const s = parseInt(String(blk.startLine ?? 1).replace(/\D/g, ""), 10) || 1;
          const e = parseInt(String(blk.endLine ?? s).replace(/\D/g, ""), 10) || s;
          return {
            ...blk,
            startLine: Math.min(s, e),
            endLine: Math.max(s, e)
          };
        })
        .filter((blk) => blk.endLine >= blk.startLine);
    }
    if (!parsed.logicalBlocks || parsed.logicalBlocks.length === 0) {
      const detectedLang = LocalSmartEngine.detectLanguage(code, lang);
      parsed.logicalBlocks = LocalSmartEngine.parseLogicalBlocks(
        lines,
        detectedLang,
        parsed.lineByLine || []
      );
    }
    if (!parsed.oneLineEssence || typeof parsed.oneLineEssence !== "string") {
      const detectedLang = LocalSmartEngine.detectLanguage(code, lang);
      const ctx = LocalSmartEngine.extractCodeContext(code, detectedLang);
      parsed.oneLineEssence = LocalSmartEngine.buildOneLineEssence(
        code,
        detectedLang,
        ctx,
        parsed.lineByLine || []
      );
    }
    return parsed;
  },

  async gradeComments(code, userCommentsMap, analysisData) {
    const apiKey = this.getApiKey();
    const entries = Object.entries(userCommentsMap).filter(([, val]) => val && val.trim().length > 0);
    if (entries.length === 0 || !apiKey) {
      return LocalSmartEngine.gradeUserComments(code, userCommentsMap, analysisData);
    }

    const lines = code.split(/\r?\n/);
    const submissionText = lines
      .map((line, i) => {
        const lineNum = i + 1;
        const userCmt = (userCommentsMap[lineNum] || "").trim();
        return `${lineNum}번 줄 코드: ${line}\n   -> 사용자가 작성한 주석: ${userCmt ? userCmt : "(미작성)"}`;
      })
      .join("\n");

    const prompt = `당신은 친절하고 날카로운 프로그래밍 튜터입니다.
사용자가 아래 코드의 각 줄에 대해 자신이 이해한 내용을 주석으로 달았습니다.
사용자가 주석을 작성한 줄(미작성 제외)을 하나씩 확인하여 코드의 실제 동작과 일치하는지 채점해 주세요.

[채점 기준]
- "correct": 코드의 동작과 의도를 정확하게 이해한 주석
- "partial": 절반만 맞거나 중요한 경계 조건이 빠진 주석
- "incorrect": 연산 방향을 반대로 적었거나 코드 동작과 다르게 오해한 주석

[코드 및 사용자 주석 제출 내역]
${submissionText}

[응답 JSON 스키마]
{
  "score": 85,
  "grade": "S, A, B, C 중 하나",
  "summaryTitle": "채점 결과 한 줄 총평 제목",
  "summaryText": "사용자의 코드 이해도에 대한 종합 피드백 및 복습 조언",
  "correctCount": 5,
  "partialCount": 1,
  "incorrectCount": 1,
  "feedbackList": [
    {
      "lineNumber": 1,
      "code": "해당 줄의 원본 코드",
      "userComment": "사용자가 적은 주석",
      "modelComment": "모범 정답 주석",
      "status": "correct | partial | incorrect",
      "verdictLabel": "✅ 정확한 이해 | ⚠️ 보완 필요 | ❌ 오개념 교정 필요",
      "feedback": "친절한 설명"
    }
  ]
}`;

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      return LocalSmartEngine.gradeUserComments(code, userCommentsMap, analysisData);
    }

    const result = await response.json();
    const rawJson = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      return LocalSmartEngine.gradeUserComments(code, userCommentsMap, analysisData);
    }

    return JSON.parse(rawJson);
  },

  /**
   * 우측 하단 AI 학습 챗봇 호출 (현재 설정된 Gemini API 모델을 그대로 사용)
   */
  async askChatbot(userQuestion, code, analysisData, selectedLine, chatHistory = []) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return LocalSmartEngine.answerChatLocally(userQuestion, code, analysisData, selectedLine);
    }

    const numberedCode = code
      ? code
          .split(/\r?\n/)
          .map((l, i) => `${i + 1}: ${l}`)
          .join("\n")
      : "(아직 입력된 코드가 없습니다)";

    const recentHistoryText = chatHistory
      .slice(-6)
      .map(m => `${m.role === "user" ? "사용자" : "AI 튜터"}: ${m.text}`)
      .join("\n");

    const systemContext = `당신은 'CodeLens AI 코딩 튜터'입니다.
사용자가 현재 보고 있는 코드에 대해 질문하면 친절하고 이해하기 쉽게 핵심을 짚어 한국어로 답변하세요.
현재 선택된 줄 번호: ${selectedLine || 1}번 줄

[현재 분석 중인 코드]
${numberedCode}

[최근 대화 내역]
${recentHistoryText}

[사용자 질문]
${userQuestion}`;

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemContext }] }],
        generationConfig: {
          temperature: 0.35
        }
      })
    });

    if (!response.ok) {
      return LocalSmartEngine.answerChatLocally(userQuestion, code, analysisData, selectedLine);
    }

    const result = await response.json();
    const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || LocalSmartEngine.answerChatLocally(userQuestion, code, analysisData, selectedLine);
  }
};
