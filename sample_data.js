// 사용자 입력 코드 기반 정밀 구문/의미 분석, 작동 블록(for/while/if/함수 시작~끝) 묶음 분석 및 주석 채점 엔진

const LocalSmartEngine = {
  detectLanguage(code, hint = "auto") {
    if (hint && hint !== "auto") return hint;
    if (/#include\s*<|printf\s*\(|scanf\s*\(|\bint\s+\*[a-zA-Z_]/.test(code)) return "c";
    if (/\bpublic\s+class\b|System\.out\.print/.test(code)) return "java";
    if (/\bfunction\b|\bconst\b|\blet\b|=>|console\.log/.test(code)) return "javascript";
    if (/\bfunc\b|\bpackage\s+main\b|\bfmt\.Print/.test(code)) return "go";
    if (/\bdef\s+[a-zA-Z_]|\belif\b|\bimport\s+[a-zA-Z_]|\bfrom\s+[a-zA-Z_]+\s+import/.test(code)) return "python";
    return "python";
  },

  analyzeCustomCode(code, langHint = "auto") {
    const lang = this.detectLanguage(code, langHint);
    const rawLines = code.split(/\r?\n/);
    const lineByLine = [];
    const conceptsMap = new Map();
    const flowSteps = [];
    const variableTrace = [];
    let currentVars = {};

    const context = this.extractCodeContext(code, lang);

    rawLines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const trimmed = rawLine.trim();
      const cleanCode = this.stripInlineComment(trimmed);

      if (!trimmed) {
        lineByLine.push({
          lineNumber: lineNum,
          code: rawLine,
          beginnerComment: "",
          advancedComment: "",
          why: "논리적 단락을 구분하여 가독성을 높이는 빈 줄입니다."
        });
        return;
      }

      if (!cleanCode && (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*"))) {
        const commentContent = trimmed.replace(/^(\/\/|#|\/*|\*)\s*/, "").replace(/\*\/$/, "");
        lineByLine.push({
          lineNumber: lineNum,
          code: rawLine,
          beginnerComment: `주석 설명: ${commentContent || "코드 설명"}`,
          advancedComment: `인라인 주석 라인입니다.`,
          why: "실행에 영향을 주지 않고 코드 의도를 설명하는 주석입니다."
        });
        return;
      }

      const ruleInfo = this.explainLineInDepth(cleanCode || trimmed, lineNum, lang, context);
      lineByLine.push({
        lineNumber: lineNum,
        code: rawLine,
        beginnerComment: ruleInfo.beginner,
        advancedComment: ruleInfo.advanced,
        why: ruleInfo.why,
        keywords: ruleInfo.keywords || []
      });

      if (ruleInfo.concept && !conceptsMap.has(ruleInfo.concept.title)) {
        conceptsMap.set(ruleInfo.concept.title, ruleInfo.concept);
      }

      if (ruleInfo.flowStep && flowSteps.length < 8) {
        flowSteps.push({
          stepTitle: `${flowSteps.length + 1}. ${ruleInfo.flowStep.title}`,
          detail: ruleInfo.flowStep.detail
        });
      }

      if (ruleInfo.traceVar && variableTrace.length < 12) {
        currentVars = { ...currentVars, ...ruleInfo.traceVar };
        variableTrace.push({
          step: variableTrace.length + 1,
          highlightLine: lineNum,
          description: `[${lineNum}번 줄] ${ruleInfo.beginner}`,
          variables: { ...currentVars }
        });
      }
    });

    if (flowSteps.length === 0) {
      flowSteps.push(
        { stepTitle: "1. 코드 시작 및 초기화", detail: "입력된 코드의 변수와 실행 환경을 준비합니다." },
        { stepTitle: "2. 명령어 순차 실행", detail: "작성된 연산과 함수 호출을 위에서 아래로 실행합니다." },
        { stepTitle: "3. 실행 완료", detail: "최종 결과를 도출하고 실행을 마칩니다." }
      );
    }

    if (variableTrace.length === 0) {
      const nonEmpty = lineByLine.filter(l => l.code.trim().length > 0);
      nonEmpty.slice(0, 6).forEach((item, i) => {
        variableTrace.push({
          step: i + 1,
          highlightLine: item.lineNumber,
          description: `[${item.lineNumber}번 줄] ${item.beginnerComment}`,
          variables: { "실행 줄": `${item.lineNumber}번 줄`, "구문": item.code.trim().slice(0, 28) }
        });
      });
    }

    if (conceptsMap.size === 0) {
      conceptsMap.set("순차 실행 및 상태 변화", {
        tag: "기본 원리",
        title: "순차 실행 구조",
        desc: "위에서 아래로 각 줄의 명령어를 차례대로 평가하고 메모리 상태를 변경합니다."
      });
    }

    // 작동 블록(for문, while문, if문, 함수 등 시작~끝) 자동 추출
    const logicalBlocks = this.parseLogicalBlocks(rawLines, lang, lineByLine);
    const deepDive = this.buildDeepDiveForCode(code, lang, context, lineByLine);
    const analogy = this.buildAnalogyForCode(context);
    const oneLineEssence = this.buildOneLineEssence(code, lang, context, lineByLine);

    return {
      lineByLine,
      logicalBlocks,
      oneLineEssence,
      understanding: {
        analogy,
        flowSteps,
        variableTrace,
        concepts: Array.from(conceptsMap.values())
      },
      deepDive
    };
  },

  buildOneLineEssence(code, lang, context, lineByLine) {
    const fn = context.fnNames && context.fnNames[0] ? context.fnNames[0].name : "";
    if (context.isRecursive && fn) {
      return `⚡ 이 코드는 문제를 작은 단위로 쪼개어 자기 자신('${fn}')을 다시 호출함으로써 최종 정답을 완성하는 '재귀(Recursion)' 코드입니다.`;
    }
    if (context.hasBinaryMid) {
      return `⚡ 이 코드는 정렬된 데이터에서 탐색 범위를 매 단계 절반씩 줄여가며 목표 값을 매우 빠르게 찾아내는 '이진 탐색' 코드입니다.`;
    }
    if (context.hasSort || (context.forCount >= 2 && context.totalLoops >= 2)) {
      return `⚡ 이 코드는 데이터들의 크기를 서로 비교하고 위치를 맞바꾸며 순서대로 정렬하는 '이중 루프 비교/정렬' 코드입니다.`;
    }
    if (context.totalLoops >= 1) {
      return `⚡ 이 코드는 주어진 데이터 범위를 처음부터 끝까지 순회하며 조건 검사와 누적 연산을 수행하여 결과를 도출하는 '반복 처리' 코드입니다.`;
    }
    if (fn) {
      return `⚡ 이 코드는 입력 인자를 받아 핵심 조건과 연산을 수행한 뒤 최종 결과값을 호출자에게 돌려주는 '${fn}' 함수 코드입니다.`;
    }
    return `⚡ 이 코드는 변수 초기화부터 순차적 조건 검사와 계산을 거쳐 최종 결과를 도출하는 직관적인 실행 코드입니다.`;
  },

  /**
   * 코드 내의 작동 단위 블록(함수, for문, while문, if/else문, 연속 초기화 블록)의 시작 줄~끝 줄을 파악하여 묶음 해석 생성
   */
  parseLogicalBlocks(rawLines, lang, lineByLine) {
    const blocks = [];
    const total = rawLines.length;
    const isIndentLang = lang === "python";

    const getIndent = (str) => {
      const m = (str || "").match(/^(\s*)/);
      return m ? m[1].replace(/\t/g, "    ").length : 0;
    };

    const stripCommentsAndStrings = (str) => {
      return (str || "")
        .replace(/\/\/.*$/, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''");
    };

    const findBlockEnd = (startIdx) => {
      const startLine = rawLines[startIdx] || "";
      const cleanStart = this.stripInlineComment(startLine.trim());

      if (isIndentLang || cleanStart.endsWith(":")) {
        const baseIndent = getIndent(startLine);
        let lastNonEmpty = startIdx;
        let inDocstring = false;
        let docDelim = "";

        for (let j = startIdx + 1; j < total; j++) {
          const rawJ = rawLines[j] || "";
          const t = rawJ.trim();
          if (!t) continue;

          if (inDocstring) {
            lastNonEmpty = j;
            if (t.includes(docDelim)) inDocstring = false;
            continue;
          }
          if (t.startsWith('"""') || t.startsWith("'''")) {
            docDelim = t.slice(0, 3);
            lastNonEmpty = j;
            const rest = t.slice(3);
            if (!rest.includes(docDelim)) {
              inDocstring = true;
            }
            continue;
          }
          if (t.startsWith("#")) continue;

          const cleanJ = this.stripInlineComment(t);
          const ind = getIndent(rawJ);

          // elif / else / except / finally 가 같은 들여쓰기면 블록의 연장으로 포함
          if (
            ind === baseIndent &&
            /^(elif|else|except|finally)\b/.test(cleanJ) &&
            /^(if|elif|for|while|try)\b/.test(cleanStart)
          ) {
            lastNonEmpty = j;
            continue;
          }
          if (ind > baseIndent) {
            lastNonEmpty = j;
          } else {
            break;
          }
        }
        return lastNonEmpty;
      } else {
        // 중괄호 { } 기반 언어 (C, C++, JS, TS, Java, Go)
        // 시작 줄 또는 바로 다음 줄(시그니처 줄바꿈 포함 최대 +2줄)에 '{'가 있는지 확인
        let openCheckLimit = Math.min(total - 1, startIdx + 2);
        let hasBraceNearStart = false;
        for (let k = startIdx; k <= openCheckLimit; k++) {
          const cleanK = stripCommentsAndStrings(rawLines[k]);
          if (cleanK.includes("{")) {
            hasBraceNearStart = true;
            break;
          }
          // '{'를 만나기 전에 세미콜론으로 끝나는 일반 문장/함수 선언(프로토타입)이면 단일 줄 처리
          if (k === startIdx && !/^for\s*\(/.test(cleanStart) && cleanK.trim().endsWith(";")) {
            break;
          }
        }

        if (!hasBraceNearStart) {
          // 중괄호 없는 단일 문장 if / for / while
          const cleanFirst = stripCommentsAndStrings(startLine).trim();
          if (cleanFirst.endsWith(";")) {
            return startIdx;
          }
          for (let k = startIdx + 1; k < Math.min(total, startIdx + 4); k++) {
            const tk = stripCommentsAndStrings(rawLines[k]).trim();
            if (tk) return k;
          }
          return startIdx;
        }

        let braceCount = 0;
        let foundOpen = false;
        for (let j = startIdx; j < total; j++) {
          const lineStr = stripCommentsAndStrings(rawLines[j]);
          for (const ch of lineStr) {
            if (ch === "{") {
              braceCount++;
              foundOpen = true;
            } else if (ch === "}") {
              braceCount--;
            }
          }
          if (foundOpen && braceCount <= 0) {
            // 바로 다음 줄에 else / else if 가 이어지는 경우 포함
            const nextIdx = j + 1;
            if (nextIdx < total && /^(else\b|catch\b|finally\b)/.test(stripCommentsAndStrings(rawLines[nextIdx]).trim())) {
              const nextLineClean = stripCommentsAndStrings(rawLines[nextIdx]);
              if (nextLineClean.includes("{")) {
                for (const ch of nextLineClean) {
                  if (ch === "{") braceCount++;
                  else if (ch === "}") braceCount--;
                }
                j = nextIdx;
                continue;
              }
            }
            return j;
          }
        }
        return Math.min(total - 1, startIdx + 1);
      }
    };

    // 주요 블록 키워드 스캔
    for (let i = 0; i < total; i++) {
      const raw = rawLines[i];
      const trimmed = this.stripInlineComment(raw.trim());
      if (!trimmed) continue;

      const pyJsGoFnMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:def|function|func)\s+([a-zA-Z0-9_]+)/);
      const arrowFnMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
      const cJavaFnMatch = trimmed.match(
        /^(?:public\s+|private\s+|protected\s+|static\s+|inline\s+|virtual\s+|const\s+|unsigned\s+|signed\s+|struct\s+)*(?:int|void|double|float|char|bool|boolean|long(?:\s+long)?|short|string|String|auto|size_t|vector<[^>]+>|List<[^>]+>|[A-Z][a-zA-Z0-9_]*)\s*[*&]*\s+([a-zA-Z0-9_]+)\s*\([^;]*\)\s*\{?$/
      );

      if (pyJsGoFnMatch || arrowFnMatch || cJavaFnMatch) {
        const fnName = (pyJsGoFnMatch && pyJsGoFnMatch[1]) || (arrowFnMatch && arrowFnMatch[1]) || (cJavaFnMatch && cJavaFnMatch[1]);
        const reserved = ["if", "for", "while", "switch", "catch", "return", "sizeof", "printf", "scanf", "malloc", "free"];
        const isPrototype = !isIndentLang && trimmed.endsWith(";") && !trimmed.includes("{");

        if (fnName && !reserved.includes(fnName) && !isPrototype) {
          const endIdx = findBlockEnd(i);
          if (endIdx >= i) {
            blocks.push({
              blockType: "function",
              badge: "📦 함수 전체 블록",
              title: `'${fnName}' 함수 작동 구간 (${i + 1}번 ~ ${endIdx + 1}번 줄)`,
              startLine: i + 1,
              endLine: endIdx + 1,
              summary: `'${fnName}' 함수가 시작되어 내부 연산과 제어문을 수행하고 결과를 반환하기까지의 전체 작동 범위입니다.`,
              howItWorks: this.summarizeLinesRange(lineByLine, i + 1, endIdx + 1)
            });
          }
        }
      } else if (/^for\b/.test(trimmed)) {
        const endIdx = findBlockEnd(i);
        blocks.push({
          blockType: "loop-for",
          badge: "🔁 for 반복문 블록",
          title: `for 반복 작동 구간 (${i + 1}번 ~ ${endIdx + 1}번 줄)`,
          startLine: i + 1,
          endLine: endIdx + 1,
          summary: `${i + 1}번 줄에서 시작해 ${endIdx + 1}번 줄까지 한 묶음으로 돌아가는 for 반복문입니다. 조건/범위 안의 요소를 순회하며 내부 코드를 반복 실행합니다.`,
          howItWorks: this.summarizeLinesRange(lineByLine, i + 1, endIdx + 1)
        });
      } else if (/^while\b/.test(trimmed)) {
        const endIdx = findBlockEnd(i);
        const cond = trimmed.replace(/^while\s*\(?/, "").replace(/\)?\s*[:{]?$/, "");
        blocks.push({
          blockType: "loop-while",
          badge: "🔄 while 조건 반복 블록",
          title: `while (${cond}) 반복 구간 (${i + 1}번 ~ ${endIdx + 1}번 줄)`,
          startLine: i + 1,
          endLine: endIdx + 1,
          summary: `'${cond}' 조건이 참인 동안 ${i + 1}번 줄부터 ${endIdx + 1}번 줄까지의 코드를 하나의 작동 단위로 계속 반복합니다.`,
          howItWorks: this.summarizeLinesRange(lineByLine, i + 1, endIdx + 1)
        });
      } else if (/^if\b/.test(trimmed)) {
        const endIdx = findBlockEnd(i);
        const cond = trimmed.replace(/^if\s*\(?/, "").replace(/\)?\s*[:{]?$/, "");
        blocks.push({
          blockType: "branch-if",
          badge: "🔀 if 조건 분기 블록",
          title: `if (${cond}) 조건 작동 구간 (${i + 1}번 ~ ${endIdx + 1}번 줄)`,
          startLine: i + 1,
          endLine: endIdx + 1,
          summary: `'${cond}' 조건의 참/거짓 여부에 따라 ${i + 1}번 줄부터 ${endIdx + 1}번 줄 사이의 실행 경로를 결정하는 조건 분기 블록입니다.`,
          howItWorks: this.summarizeLinesRange(lineByLine, i + 1, endIdx + 1)
        });
      }
    }

    // 만약 제어문/함수가 없는 단순 순차 코드라면 전체를 하나의 작동 블록으로 묶어 제공
    if (blocks.length === 0 && lineByLine.length > 0) {
      blocks.push({
        blockType: "sequential",
        badge: "▶️ 순차 실행 블록",
        title: `전체 코드 실행 구간 (1번 ~ ${lineByLine.length}번 줄)`,
        startLine: 1,
        endLine: lineByLine.length,
        summary: "조건 분기나 반복문 없이 위에서 아래로 차례대로 실행되는 코드 블록입니다.",
        howItWorks: this.summarizeLinesRange(lineByLine, 1, lineByLine.length)
      });
    }

    return blocks;
  },

  summarizeLinesRange(lineByLine, startLine, endLine) {
    const sub = lineByLine.filter(
      l => l.lineNumber >= startLine && l.lineNumber <= endLine && l.code.trim().length > 0
    );
    const steps = sub
      .slice(0, 6)
      .map(l => `[${l.lineNumber}줄] ${l.beginnerComment || l.code.trim()}`);
    if (sub.length > 6) {
      steps.push(`...외 ${sub.length - 6}개 줄이 연쇄 동작합니다.`);
    }
    return steps.join(" → ");
  },

  stripInlineComment(trimmedLine) {
    const idxHash = trimmedLine.indexOf("#");
    if (idxHash === 0 && !trimmedLine.startsWith("#include") && !trimmedLine.startsWith("#define")) {
      return "";
    }
    const idxSlash = trimmedLine.indexOf("//");
    if (idxSlash === 0) return "";

    let res = trimmedLine;
    if (idxSlash > 0 && !res.slice(0, idxSlash).includes("http")) {
      res = res.slice(0, idxSlash).trim();
    }
    if (idxHash > 0 && !trimmedLine.startsWith("#include")) {
      res = res.slice(0, idxHash).trim();
    }
    return res;
  },

  extractCodeContext(code, lang) {
    const fnNames = [];
    const fnRegex = /(?:def|function|func)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)|(?:int|void|double|float|char|bool|long|string|auto)\s+\*?\s*([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
    let m;
    while ((m = fnRegex.exec(code)) !== null) {
      const name = m[1] || m[3];
      const params = m[2] || m[4] || "";
      if (name && !["if", "for", "while", "switch", "catch"].includes(name)) {
        fnNames.push({ name, params: params.trim() });
      }
    }

    const forCount = (code.match(/\bfor\b/g) || []).length;
    const whileCount = (code.match(/\bwhile\b/g) || []).length;
    const totalLoops = forCount + whileCount;
    const hasSort = /\b(sort|sorted|qsort)\b/.test(code);
    const hasQueueOrDeque = /\b(deque|queue|Queue|popleft|shift)\b/.test(code);
    const hasPointer = /\*[a-zA-Z_]|\bNULL\b|\bmalloc\b|\bfree\b/.test(code);
    const hasBinaryMid = /\bmid\b/.test(code) && /\b(left|low|start)\b/.test(code) && /\b(right|high|end)\b/.test(code);

    let isRecursive = false;
    for (const fn of fnNames) {
      const callRegex = new RegExp(`\\b${fn.name}\\s*\\(`, "g");
      const matches = code.match(callRegex) || [];
      if (matches.length >= 2) {
        isRecursive = true;
        break;
      }
    }

    return {
      lang,
      fnNames,
      forCount,
      whileCount,
      totalLoops,
      hasSort,
      hasQueueOrDeque,
      hasPointer,
      hasBinaryMid,
      isRecursive
    };
  },

  explainLineInDepth(line, lineNum, lang, context) {
    // C언어/JS 등 닫는 중괄호 } 단독 라인 스마트 처리 (깔끔하고 군더더기 없는 블록 종료 안내)
    if (/^[\}\]\)]+;?$/.test(line.trim())) {
      return {
        beginner: "앞서 열렸던 코드 블록(함수·제어문)의 실행 구간을 닫고 마칩니다.",
        advanced: "현재 로컬 스코프(Scope)를 종료하고 상위 컨텍스트로 복귀합니다.",
        why: "블록의 시작({)과 짝을 맞춰 실행 유효 범위를 명확히 닫기 위한 기호입니다.",
        isClosingBrace: true
      };
    }

    if (/^#include\s*[<"](.+)[>"]/.test(line)) {
      const hdr = line.match(/^#include\s*[<"](.+)[>"]/)[1];
      return {
        beginner: `'${hdr}' 표준 헤더를 불러와 입출력/내장 함수를 준비합니다.`,
        advanced: `전처리기 지시문(#include)으로 '${hdr}' 헤더를 포함합니다.`,
        why: `'${hdr}' 안에 정의된 표준 함수들을 호출하기 위해 선언합니다.`,
        concept: { tag: "전처리기", title: `#include <${hdr}>`, desc: "C/C++에서 표준 라이브러리 헤더를 현재 파일로 가져옵니다." },
        flowStep: { title: "라이브러리 불러오기", detail: `${hdr} 헤더를 준비합니다.` }
      };
    }

    if (/^(from\s+\S+\s+import\s+.+|import\s+.+)/.test(line)) {
      const mod = line.replace(/^(from|import)\s+/, "").trim();
      return {
        beginner: `외부 모듈(${mod})을 현재 코드에서 쓸 수 있게 가져옵니다.`,
        advanced: `모듈 임포트(${line})로 외부 네임스페이스를 로드합니다.`,
        why: "검증된 표준 라이브러리나 패키지 기능을 활용하기 위함입니다.",
        concept: { tag: "모듈 시스템", title: "import (모듈 불러오기)", desc: "필요한 자료구조나 함수를 외부 패키지에서 가져옵니다." },
        flowStep: { title: "모듈 임포트", detail: `${mod} 모듈을 불러옵니다.` }
      };
    }

    if (/^class\s+([a-zA-Z0-9_]+)/.test(line)) {
      const clsName = line.match(/^class\s+([a-zA-Z0-9_]+)/)[1];
      return {
        beginner: `'${clsName}' 클래스를 정의하여 데이터와 기능을 하나로 묶습니다.`,
        advanced: `객체지향 캡슐화를 위한 '${clsName}' 클래스를 선언합니다.`,
        why: "관련된 상태 변수와 메서드를 하나의 구조로 관리하기 위함입니다.",
        concept: { tag: "객체지향", title: `class ${clsName}`, desc: "객체를 생성하는 설계도로, 속성과 메서드를 묶어 관리합니다." },
        flowStep: { title: `${clsName} 클래스 정의`, detail: `클래스 ${clsName}를 선언합니다.` }
      };
    }

    const fnMatch =
      line.match(/^(?:async\s+)?(?:def|function|func)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/) ||
      line.match(/^(?:public\s+|private\s+|static\s+)*(?:int|void|double|float|char|bool|long|string|auto)\s*(\*?)\s*([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);

    if (fnMatch && !/^(if|for|while|switch|return)\b/.test(line)) {
      const fnName = fnMatch[3] ? fnMatch[2] : fnMatch[1];
      const params = (fnMatch[3] !== undefined ? fnMatch[3] : fnMatch[2]) || "없음";
      return {
        beginner: `'${fnName}' 함수를 정의합니다. 입력값 (${params || "없음"})을 받아 작업을 수행합니다.`,
        advanced: `함수 '${fnName}'의 시그니처와 매개변수(${params || "void"})를 선언합니다.`,
        why: `'${fnName}' 로직을 재사용 가능한 함수 단위로 묶어 호출하기 위함입니다.`,
        concept: { tag: "함수 구조", title: `함수 ${fnName}(${params})`, desc: "입력 파라미터를 받아 로직을 처리하고 결과를 반환하는 블록입니다." },
        flowStep: { title: `${fnName} 함수 시작`, detail: `인자 (${params || "없음"})를 받아 시작합니다.` },
        traceVar: { "실행 함수": fnName, "입력 인자": params || "없음" }
      };
    }

    if (/^return\b/.test(line)) {
      const retExpr = line.replace(/^return\s*/, "").replace(/;$/, "").trim();
      return {
        beginner: retExpr
          ? `결과값 '${retExpr}'을(를) 반환하고 함수를 즉시 종료합니다.`
          : `현재 함수의 실행을 즉시 끝내고 복귀합니다.`,
        advanced: retExpr
          ? `표현식 '${retExpr}'을 호출자에게 반환하고 스택 프레임을 종료합니다.`
          : `반환값 없이 함수 실행을 종료합니다.`,
        why: "구한 정답이나 상태를 호출한 곳으로 전달하고 함수를 끝내기 위함입니다.",
        concept: { tag: "함수 제어", title: "return (반환문)", desc: "결과값을 돌려줌과 동시에 함수를 즉시 종료합니다." },
        flowStep: { title: `결과 반환 (${retExpr || "종료"})`, detail: `${retExpr || "함수"} 결과를 반환합니다.` },
        traceVar: { "반환값(return)": retExpr || "종료" }
      };
    }

    if (/^break\s*;?$/.test(line)) {
      return {
        beginner: `현재 돌고 있는 반복문을 즉시 완전히 빠져나갑니다.`,
        advanced: `break 문으로 현재 루프를 즉시 탈출합니다.`,
        why: "목표를 달성했거나 더 이상 반복할 필요가 없을 때 루프를 멈추기 위함입니다.",
        concept: { tag: "루프 제어", title: "break (반복 탈출)", desc: "반복문을 그 즉시 끝내고 바깥으로 빠져나갑니다." },
        traceVar: { "루프 제어": "break (탈출)" }
      };
    }

    if (/^continue\s*;?$/.test(line)) {
      return {
        beginner: `이번 차례의 아래 코드는 건너뛰고 다음 반복 회차로 넘어갑니다.`,
        advanced: `continue 문으로 현재 이터레이션을 생략하고 다음 주기로 이동합니다.`,
        why: "특정 조건에서는 아래 작업을 생략하고 다음 원소로 넘어가기 위함입니다.",
        concept: { tag: "루프 제어", title: "continue (건너뛰기)", desc: "현재 회차의 남은 코드만 건너뛰고 다음 반복을 이어갑니다." },
        traceVar: { "루프 제어": "continue (건너뛰기)" }
      };
    }

    if (/^for\b/.test(line)) {
      const pyFor = line.match(/^for\s+(.+?)\s+in\s+(.+?)\s*:?$/);
      if (pyFor) {
        const iterVar = pyFor[1].trim();
        const iterTarget = pyFor[2].trim();
        return {
          beginner: `'${iterTarget}'에서 값을 하나씩 꺼내 '${iterVar}'에 담으며 반복합니다.`,
          advanced: `이터러블 '${iterTarget}'의 요소를 '${iterVar}'에 바인딩하며 순회합니다.`,
          why: `'${iterTarget}'의 모든 요소에 대해 반복 작업을 수행하기 위함입니다.`,
          concept: { tag: "반복문", title: `for ${iterVar} in ${iterTarget}`, desc: "범위나 컬렉션의 원소를 처음부터 끝까지 꺼내며 반복합니다." },
          flowStep: { title: `반복 순회 (${iterVar})`, detail: `${iterTarget} 범위를 순회합니다.` },
          traceVar: { [iterVar]: `${iterTarget} 순회` }
        };
      }

      const cFor = line.match(/^for\s*\(([^;]*);([^;]*);([^)]*)\)/);
      if (cFor) {
        const init = cFor[1].trim();
        const cond = cFor[2].trim();
        const step = cFor[3].trim();
        return {
          beginner: `'${init}'부터 '${cond}'인 동안 매번 '${step}'하며 반복합니다.`,
          advanced: `초기식(${init}), 조건식(${cond}), 증감식(${step})으로 for 루프를 수행합니다.`,
          why: "시작값, 유지 조건, 증감 폭을 지정하여 정해진 횟수만큼 반복하기 위함입니다.",
          concept: { tag: "반복문", title: "for (초기화; 조건; 증감)", desc: "반복 변수의 시작, 조건, 증감을 제어하는 표준 반복문입니다." },
          flowStep: { title: `for 루프 (${cond})`, detail: `${init}부터 ${cond} 동안 반복합니다.` },
          traceVar: { "초기값": init, "조건": cond, "증감": step }
        };
      }

      return {
        beginner: `지정된 범위를 처음부터 끝까지 차례대로 반복 실행합니다.`,
        advanced: `for 반복 루프를 통해 시퀀스를 순회합니다.`,
        why: "동일한 연산을 데이터 개수만큼 반복 처리하기 위함입니다.",
        flowStep: { title: "for 반복 실행", detail: line }
      };
    }

    if (/^while\b/.test(line)) {
      const cond = line.replace(/^while\s*\(?/, "").replace(/\)?\s*[:{]?$/, "").trim();
      return {
        beginner: `'${cond}' 조건이 참인 동안 아래 블록을 계속 반복합니다.`,
        advanced: `루프 유지 조건식 '${cond}'이 참으로 평가되는 동안 반복합니다.`,
        why: `'${cond}' 상태가 유지되는 동안 작업을 반복하고 거짓이 되면 멈추기 위함입니다.`,
        concept: { tag: "조건부 반복", title: `while (${cond})`, desc: "조건식이 참인 동안 계속해서 블록을 반복 실행합니다." },
        flowStep: { title: `while 조건 반복`, detail: `${cond} 동안 반복합니다.` },
        traceVar: { "while 조건": cond }
      };
    }

    if (/^(if|elif|else\s+if)\b/.test(line)) {
      const isElif = /^(elif|else\s+if)\b/.test(line);
      const cond = line.replace(/^(if|elif|else\s+if)\s*\(?/, "").replace(/\)?\s*[:{]?$/, "").trim();
      return {
        beginner: isElif
          ? `위 조건이 아니고 '${cond}' 조건이 참이면 아래 코드를 실행합니다.`
          : `만약 '${cond}' 조건이 참이면 아래 안쪽 코드를 실행합니다.`,
        advanced: `조건식 '${cond}'이 참(True)일 때 해당 분기 블록으로 진입합니다.`,
        why: `'${cond}' 상황에 맞는 동작을 분기 처리하기 위해 사용합니다.`,
        concept: { tag: "조건 분기", title: `조건문 (${cond})`, desc: "조건식의 참/거짓 여부에 따라 실행 경로를 나눕니다." },
        flowStep: { title: `조건 판별 (${cond})`, detail: `${cond} 여부를 검사합니다.` },
        traceVar: { "조건 검사": cond }
      };
    }

    if (/^else\s*[:{]?$/.test(line) || /^\}\s*else\s*\{?$/.test(line)) {
      return {
        beginner: `위의 조건들이 모두 아닐 때 아래 코드를 실행합니다.`,
        advanced: `선행 조건이 모두 거짓(False)일 때 실행되는 기본(else) 분기입니다.`,
        why: "앞선 조건에 해당하지 않는 나머지 경우를 처리하기 위함입니다."
      };
    }

    if (/^(print|printf|console\.log|System\.out\.print|fmt\.Print|cout\s*<<)/.test(line)) {
      return {
        beginner: `괄호 안의 값을 화면(콘솔)에 출력합니다.`,
        advanced: `표준 출력(stdout)으로 평가된 값을 출력합니다.`,
        why: "계산 결과나 현재 변수 상태를 확인하기 위함입니다.",
        flowStep: { title: "결과 출력", detail: `${line} 결과를 출력합니다.` },
        traceVar: { "출력": line }
      };
    }

    const methodMatch = line.match(/^([a-zA-Z0-9_.\[\]]+)\.(append|push|popleft|pop|shift|add|insert|remove|sort)\s*\((.*)\)\s*;?$/);
    if (methodMatch) {
      const targetObj = methodMatch[1];
      const method = methodMatch[2];
      const arg = methodMatch[3].trim();
      const methodDescriptions = {
        append: `'${targetObj}'의 맨 뒤에 '${arg}'을(를) 추가합니다.`,
        push: `'${targetObj}'의 맨 끝에 '${arg}'을(를) 추가합니다.`,
        popleft: `'${targetObj}' 큐의 맨 앞에서 데이터를 꺼냅니다.`,
        pop: `'${targetObj}'에서 원소(${arg || "맨 뒤"})를 꺼냅니다.`,
        shift: `'${targetObj}'의 맨 앞 원소를 꺼냅니다.`,
        add: `'${targetObj}' 집합(Set)에 '${arg}'을(를) 추가합니다.`,
        sort: `'${targetObj}'의 원소들을 크기순으로 정렬합니다.`,
        insert: `'${targetObj}'에 원소(${arg})를 삽입합니다.`,
        remove: `'${targetObj}'에서 '${arg}'을(를) 제거합니다.`
      };
      return {
        beginner: methodDescriptions[method] || `'${targetObj}.${method}(${arg})'를 실행합니다.`,
        advanced: `'${targetObj}' 컬렉션의 '${method}' 메서드를 호출하여 상태를 갱신합니다.`,
        why: `데이터를 '${targetObj}' 자료구조에 반영하기 위함입니다.`,
        concept: { tag: "자료구조 조작", title: `.${method}() 메서드`, desc: methodDescriptions[method] },
        traceVar: { [targetObj]: `${method}(${arg})` }
      };
    }

    const incDecMatch = line.match(/^([a-zA-Z0-9_.\[\]*]+)\s*(\+\+|--|\+=|-=|\*=|\/=)\s*(.*?)\s*;?$/);
    if (incDecMatch) {
      const targetVar = incDecMatch[1].trim();
      const op = incDecMatch[2].trim();
      const rhs = incDecMatch[3].trim() || "1";
      const opMeaning = {
        "++": `'${targetVar}' 값을 1 증가시킵니다.`,
        "--": `'${targetVar}' 값을 1 감소시킵니다.`,
        "+=": `'${targetVar}'에 '${rhs}'만큼 더해서 누적합니다.`,
        "-=": `'${targetVar}'에서 '${rhs}'만큼 빼서 갱신합니다.`,
        "*=": `'${targetVar}'에 '${rhs}'을(를) 곱해 갱신합니다.`,
        "/=": `'${targetVar}'을(를) '${rhs}'(으)로 나누어 갱신합니다.`
      };
      return {
        beginner: opMeaning[op],
        advanced: `복합 대입/증감 연산자(${op})로 '${targetVar}' 값을 갱신합니다.`,
        why: `반복 진행이나 누적 계산을 위해 '${targetVar}' 상태를 업데이트합니다.`,
        traceVar: { [targetVar]: `${targetVar} ${op} ${op === "++" || op === "--" ? "" : rhs}`.trim() }
      };
    }

    if (/=/.test(line) && !/==|!=|<=|>=|=>/.test(line)) {
      const eqIdx = line.indexOf("=");
      const rawLhs = line.slice(0, eqIdx).trim();
      const rhs = line.slice(eqIdx + 1).replace(/;$/, "").trim();
      const cleanLhs = rawLhs.replace(/^(const|let|var|int|long|double|float|char|bool|auto|size_t|unsigned)\s+/, "").trim();

      let extraHint = "";
      if (rhs.includes("//")) {
        extraHint = " (//는 정수 몫 연산)";
      } else if (rhs.includes("%")) {
        extraHint = " (%는 나머지 연산)";
      } else if (/len\s*\((.+)\)\s*-\s*1/.test(rhs)) {
        extraHint = " (마지막 인덱스 = 길이 - 1)";
      }

      return {
        beginner: `'${rhs}'을(를) 계산해 '${cleanLhs}' 변수에 저장합니다.${extraHint}`,
        advanced: `표현식(${rhs})의 평가 결과를 식별자(${cleanLhs})에 할당합니다.`,
        why: `계산된 '${rhs}' 값을 '${cleanLhs}'에 보관해 다음 줄에서 사용하기 위함입니다.`,
        traceVar: { [cleanLhs]: rhs }
      };
    }

    if (/^[});]+$/.test(line)) {
      return {
        beginner: `현재 블록(함수/조건문/반복문)을 닫아줍니다.`,
        advanced: `현재 렉시컬 스코프 블록을 종료합니다.`,
        why: "블록의 범위를 명확히 닫아주기 위한 구분 기호입니다."
      };
    }

    return {
      beginner: `'${line}' 명령을 실행합니다.`,
      advanced: `구문 '${line}'을(를) 평가 및 실행합니다.`,
      why: "알고리즘의 흐름을 이어가기 위한 실행 단계입니다.",
      traceVar: { [`${lineNum}줄 실행`]: line.slice(0, 28) }
    };
  },

  buildAnalogyForCode(context) {
    if (context.hasBinaryMid) {
      return "📚 **사전에서 절반씩 범위를 줄여가며 찾기 (이진 탐색 원리)**\n시작점과 끝점의 정중앙(mid)을 확인한 뒤, 찾는 값과 비교하여 탐색 범위를 절반씩 줄여나가는 구조입니다.";
    }
    if (context.hasQueueOrDeque) {
      return "🌊 **대기열(큐)에서 들어온 순서대로 처리하기 (BFS / 선입선출 원리)**\n먼저 들어온 데이터를 먼저 꺼내는 대기열(큐) 구조를 활용하여 가까운 상태부터 차례대로 처리합니다.";
    }
    if (context.isRecursive) {
      return "🪆 **마트료시카 인형 열었다가 다시 닫기 (재귀 호출 원리)**\n함수가 자기 자신을 더 작은 크기의 입력으로 다시 호출하며 기저 조건에 도달한 뒤 역순으로 결과를 합칩니다.";
    }
    if (context.hasPointer) {
      return "🏷️ **메모리 주소(포인터)를 따라가서 직접 값 조작하기**\n포인터 변수를 통해 원본 데이터 주소에 직접 접근하여 값을 읽거나 교환하는 구조입니다.";
    }
    if (context.totalLoops > 0) {
      return "⚙️ **반복문 컨베이어 벨트 위에서 조건별로 처리하기**\n초기 변수를 준비한 뒤 반복문으로 데이터를 순회하며 조건에 따라 상태를 갱신하는 구조입니다.";
    }
    return "🧭 **위에서 아래로 차례대로 실행되는 레시피**\n입력값을 받아 변수에 저장하고 연산과 조건 검사를 거쳐 최종 결과를 도출합니다.";
  },

  buildDeepDiveForCode(code, lang, context, lineByLine) {
    const fnListStr =
      context.fnNames.length > 0
        ? context.fnNames.map(f => `${f.name}(${f.params})`).join(", ")
        : "메인 실행 블록";

    let timeComplexity = "O(1)";
    let timeReason = "반복문이나 재귀 없이 고정된 횟수의 연산만 수행하므로 상수 시간이 걸립니다.";

    if (context.hasBinaryMid) {
      timeComplexity = "O(log N)";
      timeReason = "매 반복마다 탐색 구간이 절반씩 줄어들기 때문에 로그 시간 복잡도를 가집니다.";
    } else if (context.isRecursive) {
      timeComplexity = "O(N) ~ O(2^N)";
      timeReason = "재귀 호출 깊이와 분기 수에 비례하여 시간이 소요됩니다.";
    } else if (context.totalLoops >= 2) {
      timeComplexity = context.hasSort ? "O(N log N) ~ O(N²)" : "O(N) 또는 O(N²)";
      timeReason = "복수의 반복문이 포함되어 있어 중첩 구조면 O(N²), 선형 투 포인터 구조면 O(N) 시간이 걸립니다.";
    } else if (context.totalLoops === 1) {
      timeComplexity = context.hasSort ? "O(N log N)" : "O(N)";
      timeReason = "단일 반복문을 통해 데이터를 순차적으로 순회하므로 입력 크기 N에 비례합니다.";
    } else if (context.hasSort) {
      timeComplexity = "O(N log N)";
      timeReason = "정렬 알고리즘 수행에 O(N log N) 시간이 소요됩니다.";
    }

    const usesExtraCollection = /\b(deque|set|dict|Map|Set|\[\]|\{\}|malloc)\b/.test(code);
    const spaceComplexity = usesExtraCollection || context.isRecursive ? "O(N)" : "O(1)";
    const spaceReason =
      spaceComplexity === "O(N)"
        ? "추가 컬렉션(리스트/큐/집합) 또는 재귀 스택 메모리를 사용합니다."
        : "고정된 개수의 변수만 사용하므로 메모리 사용량이 일정합니다.";

    const edgeCases = [];
    if (/\[.+\]/.test(code)) {
      edgeCases.push("⚠️ 인덱스 범위 주의: 빈 배열이거나 인덱스가 범위를 벗어나지 않는지 확인하세요.");
    }
    if (/\/|\/\//.test(code) || /%/.test(code)) {
      edgeCases.push("⚠️ 0으로 나누기 주의: 나눗셈(/, //)이나 나머지(%) 연산 시 분모가 0이 아닌지 확인하세요.");
    }
    if (context.whileCount > 0 || context.isRecursive) {
      edgeCases.push("⚠️ 종료 조건 주의: while문이나 재귀 호출에서 반드시 종료 조건에 도달하는지 확인하세요.");
    }
    if (edgeCases.length === 0) {
      edgeCases.push("⚠️ 경계값(0, 음수, 빈 입력)이 들어왔을 때도 의도대로 동작하는지 점검하세요.");
    }

    const isCStyle = ["javascript", "c", "java", "go"].includes(lang);
    const cmtPrefix = isCStyle ? "//" : "#";
    const annotatedCode = lineByLine
      .map(item => {
        if (!item.code.trim() || !item.beginnerComment) return item.code;
        return `${item.code}  ${cmtPrefix} ${item.beginnerComment}`;
      })
      .join("\n");

    return {
      summary: `입력하신 코드(${fnListStr})는 총 ${lineByLine.length}줄로 구성되어 있으며, ${context.totalLoops > 0 ? `${context.totalLoops}개의 반복 흐름과 조건 분기를 통해` : "순차적인 연산과 조건 처리를 통해"} 결과를 도출합니다.`,
      inputOutput: `대상 구조: ${fnListStr} / 언어: ${lang.toUpperCase()}`,
      timeComplexity,
      timeReason,
      spaceComplexity,
      spaceReason,
      edgeCases,
      improvedCode: annotatedCode
    };
  },

  /**
   * 개별 코드 줄의 실제 역할(Role)과 사용자의 주석이 의미적으로 일치하는지 정밀 평가
   */
  evaluateLineRoleUnderstanding(item, userComment) {
    const cleanCode = this.stripInlineComment(item.code.trim());
    const modelComment = item.beginnerComment || item.advancedComment || "";
    const uTrim = userComment.trim();
    const uLower = uTrim.toLowerCase();

    // 1. 무의미한 글자수 채우기 / 자모음 나열 / 상투적 무관 문구 즉시 차단 (0점)
    const isJamoOrPunctOnly = /^[ㄱ-ㅎㅏ-ㅣ?!.~,0-9\s@#$%^&*()_\-+=\[\]{};:'"<>/\\|`]+$/.test(uTrim);
    const meaninglessPattern =
      /^(모름|모르겠|몰라|아무거나|아무말|테스트|주석|설명|코드|패스|생략|없음|그냥|일정글자|글자수|점수|안녕|반가워|ㅋㅋ+|ㅎㅎ+|ㅇㅇ+|ㄴㄴ+|asdf|qwer|zxcv|점심|저녁|배고파|화이팅|어렵|힘들)/i;
    const repeatedCharPattern = /^(.)\1{3,}$/;

    if (uTrim.length < 2 || isJamoOrPunctOnly || meaninglessPattern.test(uTrim) || repeatedCharPattern.test(uTrim)) {
      return {
        status: "incorrect",
        score: 0,
        verdictLabel: "❌ 코드 역할 미작성",
        feedback: `의미 없는 문구이거나 코드의 역할이 설명되지 않았습니다. 이 줄이 수행하는 실제 역할(**${modelComment}**)을 작성해 보세요.`
      };
    }

    // 2. 원본 코드를 그대로 복사·붙여넣기만 한 경우 차단 (15점)
    const normCode = cleanCode.replace(/[\s;(){}]/g, "").toLowerCase();
    const normUser = uLower.replace(/[\s;(){}]/g, "");
    const hasKorean = /[가-힣]/.test(uTrim);
    if ((normCode && normUser === normCode) || (!hasKorean && normCode.includes(normUser) && uTrim.length <= cleanCode.length + 3)) {
      return {
        status: "incorrect",
        score: 15,
        verdictLabel: "❌ 코드 단순 복사 (역할 설명 필요)",
        feedback: `코드를 그대로 옮겨 적으셨습니다! 코드 문자 자체가 아니라, 이 코드가 **어떤 역할을 수행하는지** 우리말로 풀어서 적어주세요.`
      };
    }

    // 3. 반의어 및 연산 방향/문법 혼동 트랩 검사 (0점)
    const antonymTraps = [
      { codePattern: /\/\//, wrongWords: ["소수점 포함", "실수 나눗셈"], reason: "`//` 연산자는 소수점을 버리고 **정수 몫**만 구하는 연산자입니다." },
      { codePattern: /\+=/, wrongWords: ["뺀다", "빼서", "감소", "차감", "제거"], reason: "`+=` 연산자는 값을 빼는 것이 아니라 **더해서 누적**하는 연산자입니다." },
      { codePattern: /-=/, wrongWords: ["더한다", "더해서", "증가", "추가", "누적"], reason: "`-=` 연산자는 값을 더하는 것이 아니라 **빼서 감소**시키는 연산자입니다." },
      { codePattern: /\+\+/, wrongWords: ["감소", "뺀다", "빼고", "왼쪽으로", "줄인다"], reason: "`++` 연산자는 값을 1 **증가**시키는 연산자입니다." },
      { codePattern: /--/, wrongWords: ["증가", "더한다", "더하고", "오른쪽으로", "늘린다"], reason: "`--` 연산자는 값을 1 **감소**시키는 연산자입니다." },
      { codePattern: />(?!=)/, wrongWords: ["작을 때", "작으면", "미만", "이하"], reason: "`>` 기호는 작을 때가 아니라 **클 때(초과)**를 비교하는 연산자입니다." },
      { codePattern: /<(?!=)/, wrongWords: ["클 때", "크면", "초과", "이상"], reason: "`<` 기호는 클 때가 아니라 **작을 때(미만)**를 비교하는 연산자입니다." },
      { codePattern: /popleft\s*\(/, wrongWords: ["맨 뒤", "뒤에서", "마지막"], reason: "`popleft()`는 맨 뒤가 아니라 큐의 **맨 앞(왼쪽)**에서 데이터를 꺼내는 함수입니다." },
      { codePattern: /append\s*\(|push\s*\(/, wrongWords: ["꺼낸다", "삭제", "제거", "뺀다"], reason: "`append/push`는 데이터를 삭제하는 것이 아니라 **맨 뒤에 추가**하는 함수입니다." },
      { codePattern: /clearTimeout/, wrongWords: ["즉시 실행", "실행시"], reason: "`clearTimeout()`은 타이머를 실행하는 것이 아니라 예약된 타이머를 **취소**하는 함수입니다." },
      { codePattern: /\bbreak\b/, wrongWords: ["다음 반복", "건너뛰고 계속"], reason: "`break`는 다음 회차로 건너뛰는(`continue`) 것이 아니라 **반복문을 완전히 종료(탈출)**합니다." },
      { codePattern: /\bcontinue\b/, wrongWords: ["반복문 종료", "완전히 빠져나", "반복문을 끝"], reason: "`continue`는 반복문을 종료(`break`)하는 것이 아니라 **이번 회차만 건너뛰고 다음 반복을 계속**합니다." },
      { codePattern: /==|===/, wrongWords: ["대입", "할당", "초기화"], reason: "`==`(`===`)는 값을 변수에 저장(대입)하는 것이 아니라 두 값이 **서로 같은지 비교**하는 연산자입니다." }
    ];

    for (const trap of antonymTraps) {
      if (trap.codePattern.test(cleanCode)) {
        if (trap.wrongWords.some(w => uTrim.includes(w))) {
          return {
            status: "incorrect",
            score: 0,
            verdictLabel: "❌ 오개념 교정 필요",
            feedback: trap.reason
          };
        }
      }
    }

    // 단순 대입문(=)을 비교 연산(같은지 확인)으로 오해한 경우
    if (/(?<![=!<>])=(?![=])/.test(cleanCode) && !/^(if|elif|while|for|return)\b/.test(cleanCode)) {
      if (/같은지\s*비교|같다면|일치하는지/.test(uTrim) && !/저장|대입|할당|초기화/.test(uTrim)) {
        return {
          status: "incorrect",
          score: 10,
          verdictLabel: "❌ 대입(=)과 비교(==) 혼동",
          feedback: "단일 등호(`=`)는 두 값이 같은지 비교하는 것이 아니라, 오른쪽 값을 왼쪽 변수에 **저장(할당/대입)**하는 역할을 합니다."
        };
      }
    }

    // 4. 세부 경계 조건 보완 체크 (-1 인덱스, <= 등호)
    if ((cleanCode.includes("len(") || cleanCode.includes(".length")) && cleanCode.includes("- 1") && uTrim.includes("길이") && !uTrim.includes("- 1") && !uTrim.includes("-1") && !uTrim.includes("마지막") && !uTrim.includes("끝")) {
      return {
        status: "partial",
        score: 70,
        verdictLabel: "⚠️ 보완 권장 (-1 인덱스 역할)",
        feedback: "배열 길이를 구한다는 점은 맞았지만, `- 1`을 통해 **배열의 마지막 원소 인덱스(끝 위치)**를 가리키는 역할이라는 점을 함께 적어주면 완벽합니다!"
      };
    }

    if (cleanCode.includes("<=") && uTrim.includes("작을 때") && !uTrim.includes("같") && !uTrim.includes("이하")) {
      return {
        status: "partial",
        score: 75,
        verdictLabel: "⚠️ 등호(=) 조건 보완",
        feedback: "`<`가 아닌 `<=`이므로 작을 때뿐만 아니라 **두 값이 같을 때(이하)**까지 포함하여 동작한다는 점이 중요합니다."
      };
    }

    // 5. 이 코드 줄의 실제 문법적·의미적 역할(Role) 정의 및 판별
    const roles = [];
    const roleKeywords = new Set();
    let primaryRoleLabel = "코드 동작";

    if (/^[{}()\[\];,\s]+$/.test(cleanCode)) {
      roles.push("BLOCK_CLOSE");
      primaryRoleLabel = "블록 닫기/종료";
      ["종료", "끝", "닫", "마침", "블록", "구간", "괄호"].forEach(k => roleKeywords.add(k));
    }
    if (/^(#include|#define|import\s|from\s.+import)/.test(cleanCode)) {
      roles.push("IMPORT");
      primaryRoleLabel = "모듈/헤더 불러오기";
      ["포함", "불러", "가져", "임포트", "import", "include", "헤더", "라이브러리", "모듈", "표준", "입출력", "선언", "기능", "사용"].forEach(k => roleKeywords.add(k));
    }
    if (/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:def|function|func)\s+([a-zA-Z0-9_]+)/.test(cleanCode) ||
        /^(?:public\s+|private\s+|protected\s+|static\s+|inline\s+|const\s+|unsigned\s+|struct\s+)*(?:int|void|double|float|char|bool|boolean|long|short|string|String|auto|size_t)\s*[*&]*\s+[a-zA-Z0-9_]+\s*\(/.test(cleanCode)) {
      roles.push("FUNC_DEF");
      primaryRoleLabel = "함수 정의 및 시작";
      ["함수", "정의", "선언", "생성", "메서드", "시작", "메인", "main", "입력", "매개변수", "파라미터", "인자", "받", "구하", "수행", "알고리즘", "호출", "실행"].forEach(k => roleKeywords.add(k));
    }
    if (/^for\b/.test(cleanCode)) {
      roles.push("LOOP");
      primaryRoleLabel = "for 반복 순회";
      ["반복", "순회", "루프", "돌", "도는", "돌며", "돌면서", "동안", "까지", "부터", "범위", "매번", "차례", "탐색", "확인", "비교", "회차", "인덱스", "원소", "요소", "for"].forEach(k => roleKeywords.add(k));
    }
    if (/^while\b/.test(cleanCode)) {
      roles.push("LOOP");
      primaryRoleLabel = "while 조건 반복";
      ["반복", "순회", "루프", "돌", "도는", "돌며", "돌면서", "동안", "까지", "조건", "참", "탐색", "비교", "좁", "교차", "while", "전진", "이동"].forEach(k => roleKeywords.add(k));
    }
    if (/^(?:else\s+)?if\b|^elif\b|^\}\s*else\s+if\b/.test(cleanCode)) {
      roles.push("BRANCH_IF");
      primaryRoleLabel = "조건 분기 검사";
      ["만약", "조건", "경우", "때", "이면", "라면", "비교", "검사", "확인", "판별", "체크", "작", "크", "같", "다르", "일치", "찾", "초과", "미만", "이상", "이하", "분기", "성립", "참", "짝수", "홀수", "비어", "존재"].forEach(k => roleKeywords.add(k));
    } else if (/^(?:\}\s*)?else\b/.test(cleanCode)) {
      roles.push("BRANCH_ELSE");
      primaryRoleLabel = "else(그 외 조건) 분기";
      ["그 외", "아니면", "그렇지 않", "아닐", "반대", "나머지", "거짓", "실패", "다른", "경우", "조건", "else", "크면", "작으면"].forEach(k => roleKeywords.add(k));
    }
    if (/([a-zA-Z0-9_\[\]\s]+),\s*([a-zA-Z0-9_\[\]\s]+)\s*=\s*\2,\s*\1/.test(cleanCode) || /\bswap\b/i.test(cleanCode)) {
      roles.push("SWAP");
      primaryRoleLabel = "두 값 위치 교환(Swap)";
      ["교환", "바꿈", "바꾸", "바꿔", "스왑", "swap", "자리", "위치", "맞바", "변경", "이동", "정렬", "순서"].forEach(k => roleKeywords.add(k));
    }
    if (/^return\b|\breturn\b/.test(cleanCode)) {
      roles.push("RETURN");
      primaryRoleLabel = "결과값 반환(Return) 및 종료";
      ["반환", "리턴", "return", "돌려", "결과", "정답", "출력", "종료", "끝", "마침", "없", "못 찾", "실패", "재귀", "호출", "더해", "합"].forEach(k => roleKeywords.add(k));
    }
    if (/\b(print|printf|console\.log|System\.out\.print|fmt\.Print)\b/.test(cleanCode)) {
      roles.push("OUTPUT");
      primaryRoleLabel = "화면/콘솔 출력";
      ["출력", "표시", "보여", "화면", "콘솔", "프린트", "print", "찍", "결과", "메시지", "확인"].forEach(k => roleKeywords.add(k));
    }
    if (/\b(input|scanf|readline|cin)\b/.test(cleanCode)) {
      roles.push("INPUT");
      primaryRoleLabel = "데이터 입력 처리";
      ["입력", "받", "읽", "scanf", "input", "사용자", "값"].forEach(k => roleKeywords.add(k));
    }
    if (/\b(break|continue)\b/.test(cleanCode)) {
      roles.push("LOOP_CONTROL");
      primaryRoleLabel = "반복 흐름 제어";
      ["탈출", "종료", "중단", "멈춤", "빠져", "나감", "건너", "다음", "계속", "패스", "스킵", "반복"].forEach(k => roleKeywords.add(k));
    }
    if (/(\+\+|--|\+=|-=|\*=|\/=)/.test(cleanCode) && !roles.includes("LOOP")) {
      roles.push("MUTATION");
      primaryRoleLabel = "변수 값 증감/갱신";
      ["증가", "감소", "더하", "더해", "빼", "뺀", "누적", "갱신", "업데이트", "이동", "변경", "줄", "늘", "오른쪽", "왼쪽", "다음", "이전", "범위", "좁", "포인터", "인덱스", "1", "카운트", "합"].forEach(k => roleKeywords.add(k));
    }
    if (/(?<![=!<>])=(?![=])/.test(cleanCode) && !roles.includes("LOOP") && !roles.includes("BRANCH_IF") && !roles.includes("SWAP")) {
      roles.push("ASSIGN");
      if (roles.length === 1) primaryRoleLabel = "변수 초기화/값 계산 및 저장";
      ["저장", "할당", "대입", "초기화", "선언", "생성", "정의", "설정", "담", "넣", "변수", "계산", "구하", "구해", "값", "시작", "처음", "끝", "마지막", "길이", "개수", "크기", "중간", "가운데", "절반", "합", "더한", "결과", "인덱스", "위치", "호출", "배열", "리스트", "포인터"].forEach(k => roleKeywords.add(k));
    }

    // 6. 코드의 구체적 대상/문맥(Context/Target) 키워드 추출
    const contextKeywords = new Set();

    // 6-1. 코드 내 주요 연산 및 표현식 기반 문맥 키워드
    if (/len\s*\(|\.length\b/.test(cleanCode)) {
      ["길이", "개수", "크기", "원소", "요소", "배열", "리스트", "전체", "끝", "마지막"].forEach(k => contextKeywords.add(k));
    }
    if (/-\s*1\b/.test(cleanCode)) {
      ["마지막", "끝", "-1", "- 1", "이전", "오른쪽", "제외", "줄", "작"].forEach(k => contextKeywords.add(k));
    }
    if (/\+\s*1\b|\+\+/.test(cleanCode)) {
      ["다음", "오른쪽", "+1", "+ 1", "1 증가", "1씩", "증가", "앞", "인덱스", "위치"].forEach(k => contextKeywords.add(k));
    }
    if (/--\b|-=\s*1/.test(cleanCode)) {
      ["이전", "왼쪽", "-1", "1 감소", "1씩", "감소", "뒤", "줄"].forEach(k => contextKeywords.add(k));
    }
    if (/\/\/\s*2|\/\s*2|>>\s*1|\bmid\b/i.test(cleanCode)) {
      ["중간", "가운데", "중앙", "절반", "반", "나누", "몫", "mid", "위치", "인덱스"].forEach(k => contextKeywords.add(k));
    }
    if (/=\s*0\b/.test(cleanCode)) {
      ["0", "처음", "시작", "첫", "초기", "초기화", "왼쪽", "정상"].forEach(k => contextKeywords.add(k));
    }
    if (/\[\s*\]/.test(cleanCode)) {
      ["빈", "배열", "리스트", "없", "실패", "못 찾", "초기화"].forEach(k => contextKeywords.add(k));
    }
    if (/-\s*1\s*;?$/.test(cleanCode) && roles.includes("RETURN")) {
      ["-1", "없", "못 찾", "실패", "존재하지"].forEach(k => contextKeywords.add(k));
    }
    if (/\+/.test(cleanCode)) {
      ["더하", "더해", "더한", "합", "합계", "누적", "증가", "추가", "이동", "다음"].forEach(k => contextKeywords.add(k));
    }
    if (/-/.test(cleanCode)) {
      ["빼", "뺀", "차", "감소", "줄", "이전", "마지막", "남은"].forEach(k => contextKeywords.add(k));
    }
    if (/\*/.test(cleanCode)) {
      ["곱", "배", "제곱", "포인터"].forEach(k => contextKeywords.add(k));
    }
    if (/%/.test(cleanCode)) {
      ["나머지", "짝수", "홀수", "배수", "나누"].forEach(k => contextKeywords.add(k));
    }
    if (/==|===/.test(cleanCode)) {
      ["같", "일치", "찾", "맞", "동일", "목표", "타겟"].forEach(k => contextKeywords.add(k));
    }
    if (/[<>]=?/.test(cleanCode)) {
      ["크", "작", "초과", "미만", "이상", "이하", "비교", "교차", "범위", "앞", "뒤", "정렬", "순서"].forEach(k => contextKeywords.add(k));
    }

    // 6-2. 코드 내 식별자(변수명/함수명) 의미 매핑
    const idMap = {
      left: ["left", "왼쪽", "시작", "앞", "첫", "포인터", "인덱스"],
      start: ["start", "시작", "처음", "왼쪽", "인덱스"],
      low: ["low", "왼쪽", "시작", "최소", "하한"],
      right: ["right", "오른쪽", "끝", "마지막", "뒤", "포인터", "인덱스"],
      end: ["end", "끝", "마지막", "오른쪽", "종료"],
      high: ["high", "오른쪽", "끝", "최대", "상한"],
      mid: ["mid", "중간", "가운데", "중앙", "절반"],
      target: ["target", "목표", "타겟", "찾는", "찾고자", "기준"],
      sum: ["sum", "합", "합계", "더한", "누적", "총합"],
      total: ["total", "총합", "전체", "합계", "누적"],
      arr: ["arr", "배열", "리스트", "원소", "데이터"],
      numbers: ["numbers", "배열", "리스트", "숫자", "원소"],
      nums: ["nums", "배열", "리스트", "숫자", "원소"],
      count: ["count", "개수", "횟수", "카운트", "세기"],
      cnt: ["cnt", "개수", "횟수", "카운트"],
      result: ["result", "결과", "정답", "반환값", "계산"],
      ans: ["ans", "정답", "결과"],
      max: ["max", "최대", "최댓값", "가장 큰"],
      min: ["min", "최소", "최솟값", "가장 작은"],
      fib: ["fib", "피보나치", "재귀", "수열"],
      bubble_sort: ["버블", "정렬", "오름차순", "배열"],
      binary_search: ["이진", "탐색", "중간", "절반"],
      twoSum: ["투 포인터", "두 수", "합", "타겟"]
    };

    const codeTokens = cleanCode.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    codeTokens.forEach(tok => {
      const tLow = tok.toLowerCase();
      if (tLow.length >= 2 && !["def", "int", "let", "var", "const", "for", "while", "return", "function", "public", "class", "void"].includes(tLow)) {
        contextKeywords.add(tLow);
      }
      if (idMap[tok]) idMap[tok].forEach(w => contextKeywords.add(w));
      if (idMap[tLow]) idMap[tLow].forEach(w => contextKeywords.add(w));
    });

    // 6-3. 모범 해설(beginnerComment, advancedComment, why)에서 핵심 의미 어근 추출
    const stopWords = new Set([
      "코드", "줄입니다", "합니다", "입니다", "있는", "에서", "으로", "에게", "부터", "까지",
      "통해", "위해", "대한", "해당", "현재", "경우", "수행", "과정", "단계", "방식", "사용"
    ]);
    const refText = `${item.beginnerComment || ""} ${item.advancedComment || ""} ${item.why || ""}`;
    const refWords = refText
      .replace(/[^\w가-힣\s]/g, " ")
      .split(/\s+/)
      .map(w => w.replace(/(은|는|이|가|을|를|의|에|로|으로|에서|부터|까지|하고|하며|하는|한|된|될|할|입니다|합니다|이다|다)$/, ""))
      .filter(w => w.length >= 2 && !stopWords.has(w));

    refWords.forEach(w => contextKeywords.add(w.toLowerCase()));

    // 7. 사용자 주석의 역할 일치도 & 문맥 일치도 산출
    let matchedRoleCount = 0;
    roleKeywords.forEach(rk => {
      if (uLower.includes(rk.toLowerCase())) matchedRoleCount++;
    });

    let matchedContextCount = 0;
    contextKeywords.forEach(ck => {
      if (ck && ck.length >= 1 && uLower.includes(ck.toLowerCase())) {
        matchedContextCount++;
      }
    });

    // 8. 다른 줄의 역할과 혼동했는지(Cross-Role Misunderstanding) 검사
    if (!roles.includes("LOOP") && /^(반복문|for문|while문|루프를?\s*돈다)/.test(uTrim) && matchedRoleCount === 0) {
      return {
        status: "incorrect",
        score: 10,
        verdictLabel: "❌ 코드 역할 오해 (반복문 아님)",
        feedback: `이 줄은 반복문이 아니라 **${primaryRoleLabel}** 역할을 하는 줄입니다. (${modelComment})`
      };
    }
    if (!roles.includes("RETURN") && !roles.includes("OUTPUT") && /^(결과를?\s*(반환|리턴|출력)한다?)/.test(uTrim) && matchedRoleCount === 0) {
      return {
        status: "incorrect",
        score: 10,
        verdictLabel: "❌ 코드 역할 오해 (출력/반환 아님)",
        feedback: `이 줄은 출력이나 반환을 하는 줄이 아니라 **${primaryRoleLabel}** 역할을 수행합니다. (${modelComment})`
      };
    }
    if (!roles.includes("BRANCH_IF") && !roles.includes("BRANCH_ELSE") && /^(조건문|if문)/.test(uTrim) && matchedRoleCount === 0) {
      return {
        status: "incorrect",
        score: 10,
        verdictLabel: "❌ 코드 역할 오해 (조건문 아님)",
        feedback: `이 줄은 조건 분기문이 아니라 **${primaryRoleLabel}** 역할을 수행합니다. (${modelComment})`
      };
    }

    // 9. 단순 문법 이름만 달랑 적은 경우 (예: "반복문", "조건문입니다", "변수 선언", "함수")
    const bareSyntaxOnly = /^(if문|조건문|분기문|반복문|for문|while문|루프|함수|함수\s*선언|함수\s*정의|변수|변수\s*선언|변수\s*초기화|출력|출력문|리턴|리턴문|반환문|대입문|연산)(입니다|이다|임|이에요|함)?\.?$/i.test(uTrim);
    if (bareSyntaxOnly) {
      return {
        status: "partial",
        score: 50,
        verdictLabel: "⚠️ 문법 종류만 언급 (구체적 역할 필요)",
        feedback: `'${uTrim}'이라는 문법적 분류는 맞지만, 이 코드에서 **구체적으로 어떤 데이터를 어떻게 처리하기 위한 역할**인지 적어주셔야 높은 점수를 받을 수 있습니다! (모범 설명: ${modelComment})`
      };
    }

    // 10. 역할 키워드와 문맥 키워드가 모두 전혀 일치하지 않는 경우 (글자수만 길게 아무 말이나 적은 경우 -> 0점)
    if (matchedRoleCount === 0 && matchedContextCount === 0) {
      return {
        status: "incorrect",
        score: 0,
        verdictLabel: "❌ 코드 역할 미이해 (무관한 주석)",
        feedback: `작성하신 주석이 이 코드의 실제 역할과 일치하지 않습니다. 글자 수와 관계없이 **이 코드가 무슨 역할을 하는지** 정확히 적어야 점수로 인정됩니다.\n• **이 줄의 실제 역할:** ${modelComment}`
      };
    }

    // 11. 역할과 구체적 문맥(대상/목적)을 모두 잘 짚어낸 경우 (95 ~ 100점)
    if ((matchedRoleCount >= 1 && matchedContextCount >= 2) || matchedContextCount >= 3 || (roles.includes("BLOCK_CLOSE") && matchedRoleCount >= 1)) {
      return {
        status: "correct",
        score: 100,
        verdictLabel: "✅ 정확한 역할 이해",
        feedback: `정확합니다! 이 코드가 수행하는 핵심 역할(**${primaryRoleLabel}**)과 의미를 완벽하게 이해하고 계십니다. ${item.why || ""}`
      };
    }

    if (matchedRoleCount >= 1 && matchedContextCount === 1) {
      return {
        status: "correct",
        score: 90,
        verdictLabel: "✅ 핵심 역할 이해",
        feedback: `잘 이해하셨습니다! **${primaryRoleLabel}** 역할을 정확히 짚어내셨습니다. (${item.why || modelComment})`
      };
    }

    // 12. 역할 동작만 적었거나 단편적 키워드 1개만 언급하여 절반만 이해한 경우 (60점)
    return {
      status: "partial",
      score: 60,
      verdictLabel: "⚠️ 부분적 역할 이해 (구체성 보완)",
      feedback: `코드의 대략적인 동작(**${primaryRoleLabel}**)은 파악하셨으나, **무엇을 대상으로 왜 수행하는지** 조금 더 구체적으로 적어주시면 완벽합니다!\n• **모범 역할 설명:** ${modelComment}`
    };
  },

  gradeUserComments(code, userCommentsMap, analysisData) {
    const lineItems = (analysisData?.lineByLine || []).filter(item => item.code.trim().length > 0);
    const feedbackList = [];
    let totalEarned = 0;
    let gradedCount = 0;
    let correctCount = 0;
    let partialCount = 0;
    let incorrectCount = 0;

    lineItems.forEach(item => {
      const userComment = (userCommentsMap[item.lineNumber] || "").trim();
      if (!userComment) return;

      gradedCount++;
      const modelComment = item.beginnerComment || item.advancedComment;
      const evalResult = this.evaluateLineRoleUnderstanding(item, userComment);

      totalEarned += evalResult.score;
      if (evalResult.status === "correct") correctCount++;
      else if (evalResult.status === "partial") partialCount++;
      else incorrectCount++;

      feedbackList.push({
        lineNumber: item.lineNumber,
        code: item.code.trim(),
        userComment,
        modelComment,
        status: evalResult.status,
        verdictLabel: evalResult.verdictLabel,
        feedback: evalResult.feedback
      });
    });

    if (gradedCount === 0) {
      return {
        score: 0,
        grade: "-",
        summaryTitle: "작성된 주석이 없습니다!",
        summaryText: "위 목록에서 채점받고 싶은 코드 줄 옆에 내가 이해한 코드의 역할을 1줄 이상 입력한 뒤 다시 버튼을 눌러주세요.",
        correctCount: 0,
        partialCount: 0,
        incorrectCount: 0,
        feedbackList: []
      };
    }

    const finalScore = Math.round(totalEarned / gradedCount);
    let grade = "S";
    let summaryTitle = "🎉 완벽합니다! 각 코드 줄이 수행하는 실제 역할과 의도를 정확히 꿰뚫고 계십니다.";
    if (finalScore < 50) {
      grade = "C";
      summaryTitle = "🌱 코드의 실제 역할과 다른 설명이 많습니다. 모범 주석과 비교하며 각 줄의 역할을 복습해 보세요!";
    } else if (finalScore < 78) {
      grade = "B";
      summaryTitle = "👍 기본적인 문법 역할은 알고 계시나, 구체적으로 어떤 데이터를 어떻게 처리하는지 보완이 필요합니다.";
    } else if (finalScore < 92) {
      grade = "A";
      summaryTitle = "🌟 훌륭합니다! 코드의 전반적인 역할을 잘 이해하고 계시며, 세부 경계 조건만 챙기면 완벽합니다.";
    }

    return {
      score: finalScore,
      grade,
      summaryTitle,
      summaryText: `[코드 역할 이해도 기준 채점] 총 ${gradedCount}개 줄 평가 결과 — 정확한 역할 이해 ${correctCount}개, 구체성 보완 필요 ${partialCount}개, 역할 미이해/오개념 ${incorrectCount}개 (평균 ${finalScore}점)`,
      correctCount,
      partialCount,
      incorrectCount,
      feedbackList
    };
  },

  /**
   * 어떤 질문이든 막힘없이 답변하는 지능형 코드 문맥 & CS 지식 합성 AI 튜터 엔진
   */
  answerChatLocally(question, code, analysisData, selectedLine, chatHistory = []) {
    const q = (question || "").trim();
    if (!q) {
      return "궁금한 점을 입력해 주세요! 현재 코드의 특정 줄, 변수 역할, 작동 원리부터 알고리즘 개념, 코드 작성 요청까지 무엇이든 답변해 드립니다.";
    }

    const qLower = q.toLowerCase();

    // 코드가 입력되어 있는데 아직 분석 데이터가 없다면 즉시 자동 분석 수행
    let data = analysisData;
    if ((!data || !data.lineByLine) && code && code.trim()) {
      try {
        data = this.analyzeCustomCode(code, "auto");
      } catch (e) {}
    }

    const hasCode = Boolean(code && code.trim() && data && data.lineByLine && data.lineByLine.length > 0);
    const lines = hasCode ? data.lineByLine : [];
    const nonEmptyLines = lines.filter(l => l.code && l.code.trim().length > 0);

    // 1. 인사 / 자기소개 / 도움말 질문 처리
    if (/^(안녕|하이|헬로|hello|hi|반가워|누구|뭐하는|도움말|뭐\s*할\s*수|사용법)/i.test(q)) {
      return `안녕하세요! 저는 **CodeLens AI 코딩 튜터**입니다. 🤖\n\n저에게 이런 질문들을 자유롭게 물어보실 수 있어요:\n• **현재 코드 질문:** *"3번 줄이 무슨 역할이야?"*, *"변수 left는 왜 필요해?"*, *"이 코드 실행 순서 알려줘"*\n• **심층/개선 질문:** *"시간 복잡도가 왜 이래?"*, *"주의할 예외 케이스는?"*, *"더 깔끔하게 리팩토링해줘"*\n• **코드 작성 & CS 개념:** *"이진 탐색 코드 짜줘"*, *"재귀함수가 뭐야?"*, *"포인터 쉽게 설명해줘"* 등 어떤 질문이든 편하게 물어보세요!`;
    }

    if (/^(고마워|감사|땡큐|thanks|오케이|알겠어|최고|굿)/i.test(q)) {
      return `도움이 되었다니 기쁩니다! 😊 코드를 보시다가 또 궁금한 변수, 문법, 원리나 다른 알고리즘 질문이 생기면 언제든 물어보세요!`;
    }

    // 2. 코드 생성 / 예제 구현 요청 ("~ 코드 짜줘", "~ 구현해줘", "~ 예제 보여줘")
    if (/(짜줘|짜\s*봐|만들어\s*줘|구현해|코드\s*보여|코드\s*알려|예제\s*보여|어떻게\s*짜)/.test(q)) {
      if (/버블\s*정렬|bubble/i.test(q)) {
        return `💡 **버블 정렬 (Bubble Sort) 구현 예제 (Python):**\n\`\`\`python\n${this.PRESETS.bubble_sort.code}\n\`\`\`\n• **핵심 원리:** 인접한 두 원소(\`arr[j]\`, \`arr[j+1]\`)를 비교해 앞의 값이 더 크면 자리를 바꾸는 과정을 반복하여 큰 값을 뒤로 밀어냅니다. (시간 복잡도: \`O(N²)\`)`;
      }
      if (/이진\s*탐색|이분\s*탐색|binary\s*search/i.test(q)) {
        return `💡 **이진 탐색 (Binary Search) 구현 예제 (Python):**\n\`\`\`python\n${this.PRESETS.binary_search.code}\n\`\`\`\n• **핵심 원리:** 정렬된 배열에서 항상 중간 위치(\`mid\`)의 값과 목표값(\`target\`)을 비교해 탐색 범위를 절반씩 줄여나갑니다. (시간 복잡도: \`O(log N)\`)`;
      }
      if (/피보나치|fibonacci/i.test(q)) {
        return `💡 **피보나치 수열 구현 예제 (C언어 & 반복문 DP):**\n\`\`\`c\n${this.PRESETS.fibonacci_c.code}\n\`\`\`\n• **팁:** 재귀 함수는 직관적이지만 중복 호출로 인해 \`O(2^N)\`이 걸리므로, 배열이나 변수 2개로 이전 값을 더해가는 반복문(\`O(N)\`) 방식을 사용하면 훨씬 빠릅니다!`;
      }
      if (/투\s*포인터|two\s*pointer|두\s*수의?\s*합|twosum/i.test(q)) {
        return `💡 **투 포인터 (Two Pointers) 구현 예제 (JavaScript):**\n\`\`\`javascript\n${this.PRESETS.two_sum_js.code}\n\`\`\`\n• **핵심 원리:** 양 끝 인덱스(\`left\`, \`right\`)에서 시작해 두 값의 합이 목표보다 작으면 \`left++\`, 크면 \`right--\`로 범위를 좁혀 \`O(N)\` 만에 답을 찾습니다.`;
      }
      if (/팩토리얼|factorial/i.test(q)) {
        return `💡 **팩토리얼 (Factorial) 구현 예제 (Python):**\n\`\`\`python\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\`\`\`\n• **핵심 원리:** \`n! = n × (n-1)!\` 성질을 이용해 \`n <= 1\`일 때 1을 반환(기저 조건)하고, 자기 자신을 재귀 호출하여 곱합니다.`;
      }
      if (/스택|stack/i.test(q)) {
        return `💡 **스택 (Stack - 후입선출 LIFO) 구현 예제 (Python):**\n\`\`\`python\nstack = []\nstack.append(10)  # 데이터 추가 (Push)\nstack.append(20)\ntop = stack.pop() # 가장 나중에 넣은 20 꺼내기 (Pop)\nprint(top)        # 20\n\`\`\``;
      }
      if (/큐|queue|bfs/i.test(q)) {
        return `💡 **큐 (Queue - 선입선출 FIFO) 구현 예제 (Python):**\n\`\`\`python\nfrom collections import deque\nqueue = deque([1, 2])\nqueue.append(3)          # 맨 뒤에 3 추가 (Enqueue)\nfirst = queue.popleft()  # 맨 앞의 1 꺼내기 (Dequeue, O(1))\nprint(first)             # 1\n\`\`\``;
      }
      if (/dfs|깊이\s*우선/i.test(q)) {
        return `💡 **DFS (깊이 우선 탐색) 기본 템플릿 (Python):**\n\`\`\`python\ndef dfs(graph, v, visited):\n    visited[v] = True\n    print(v, end=' ')\n    for next_node in graph[v]:\n        if not visited[next_node]:\n            dfs(graph, next_node, visited)\n\`\`\`\n• **핵심 역할:** 현재 정점을 방문 처리한 뒤, 연결된 정점 중 아직 방문하지 않은 곳을 재귀적으로 끝까지 파고들며 탐색합니다.`;
      }
    }

    // 3. 특정 줄 번호 범위 또는 단일 줄 질문 (예: "3번 줄", "2~5번 줄", "첫 줄", "마지막 줄", "선택한 줄", "이 줄")
    if (hasCode) {
      const rangeMatch = q.match(/(\d+)\s*(?:~|-|에서|부터)\s*(\d+)\s*(?:번|번째|줄|라인)/);
      if (rangeMatch) {
        const sNum = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
        const eNum = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
        const rangeItems = lines.filter(l => l.lineNumber >= sNum && l.lineNumber <= eNum && l.code.trim());
        if (rangeItems.length > 0) {
          const details = rangeItems
            .map(it => `• **${it.lineNumber}번 줄 (\`${it.code.trim()}\`)**: ${it.beginnerComment} *(이유: ${it.why})*`)
            .join("\n");
          return `📌 **${sNum}번 ~ ${eNum}번 줄 구간 상세 해설:**\n${details}`;
        }
      }

      const lineMatch = q.match(/(\d+)\s*(번|번째|줄|라인)/);
      if (lineMatch) {
        const targetNum = parseInt(lineMatch[1], 10);
        const item = lines.find(l => l.lineNumber === targetNum);
        if (item) {
          if (!item.code.trim()) {
            return `**${targetNum}번 줄**은 가독성을 위해 비워둔 빈 줄입니다. 다른 줄 번호를 물어보시면 상세히 설명해 드릴게요!`;
          }
          return `🔍 **${targetNum}번 줄 (\`${item.code.trim()}\`) 집중 분석:**\n• **초보자 눈높이 역할:** ${item.beginnerComment}\n• **전공자/심층 해석:** ${item.advancedComment}\n• **작성 이유(Why):** ${item.why}`;
        } else {
          return `현재 코드는 총 **${lines.length}줄**입니다. 1번부터 ${lines.length}번 줄 사이로 질문해 주세요!`;
        }
      }

      if (/첫\s*(번째\s*)?줄|맨\s*위\s*줄|시작\s*줄/.test(q) && nonEmptyLines.length > 0) {
        const first = nonEmptyLines[0];
        return `🔍 **첫 번째 코드 줄 (${first.lineNumber}번 줄: \`${first.code.trim()}\`) 설명:**\n• **핵심 역할:** ${first.beginnerComment}\n• **이유(Why):** ${first.why}`;
      }

      if (/마지막\s*줄|맨\s*끝\s*줄|끝\s*줄/.test(q) && nonEmptyLines.length > 0) {
        const last = nonEmptyLines[nonEmptyLines.length - 1];
        return `🔍 **마지막 코드 줄 (${last.lineNumber}번 줄: \`${last.code.trim()}\`) 설명:**\n• **핵심 역할:** ${last.beginnerComment}\n• **이유(Why):** ${last.why}`;
      }

      // 사용자가 명시적으로 "선택한 줄", "현재 줄", "이 줄"을 물어본 경우에만 selectedLine 설명
      if (/선택한?\s*줄|현재\s*줄|지금\s*줄|이\s*줄/.test(q)) {
        const selItem = lines.find(l => l.lineNumber === selectedLine) || nonEmptyLines[0];
        if (selItem) {
          return `🎯 **현재 선택된 ${selItem.lineNumber}번 줄 (\`${selItem.code.trim()}\`) 해설:**\n• **핵심 역할:** ${selItem.beginnerComment}\n• **심층 분석:** ${selItem.advancedComment}\n• **작성 이유(Why):** ${selItem.why}`;
        }
      }
    }

    // 4. 현재 코드에 등장하는 특정 변수 / 함수 / 키워드 질문 감지 (예: "left가 뭐야?", "arr 역할 알려줘", "mid는 왜 구해?", "변수 설명해줘")
    if (hasCode) {
      if (/변수.*(뭐|어떤|설명|알려|목록|역할)|쓰인\s*변수/.test(q)) {
        const varLines = nonEmptyLines.filter(l => /(?<![=!<>])=(?![=])|\b(let|const|var|int|double|float|char)\b/.test(l.code));
        if (varLines.length > 0) {
          const listStr = varLines
            .map(l => `• **${l.lineNumber}번 줄 (\`${l.code.trim()}\`)**: ${l.beginnerComment}`)
            .join("\n");
          return `📦 **이 코드에서 선언/갱신되는 주요 변수와 역할:**\n${listStr}`;
        }
      }

      const reservedWords = new Set([
        "def", "for", "while", "if", "elif", "else", "return", "function", "const", "let", "var",
        "int", "void", "double", "float", "char", "public", "class", "static", "true", "false"
      ]);
      const allCodeIdentifiers = new Set();
      nonEmptyLines.forEach(l => {
        const clean = this.stripInlineComment(l.code);
        const matches = clean.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        matches.forEach(m => {
          if (!reservedWords.has(m)) allCodeIdentifiers.add(m);
        });
      });

      const mentionedIds = Array.from(allCodeIdentifiers).filter(id => {
        if (id.length === 1) {
          const singleRegex = new RegExp(`(?:^|[^a-zA-Z0-9_])\`?${id}\`?(?:$|[^a-zA-Z0-9_]|가|이|은|는|을|를|의|역할|값|변수)`, "i");
          return singleRegex.test(q);
        }
        return qLower.includes(id.toLowerCase());
      });

      if (mentionedIds.length > 0 && !/복잡도|시간|공간|빅오|리팩토링|개선|전체/.test(q)) {
        const targetId = mentionedIds[0];
        const idRegex = new RegExp(`\\b${targetId}\\b`);
        const matchingLines = nonEmptyLines.filter(l => idRegex.test(this.stripInlineComment(l.code)));
        if (matchingLines.length > 0) {
          const traceStr = matchingLines
            .map(l => `• **${l.lineNumber}번 줄 (\`${l.code.trim()}\`)**: ${l.beginnerComment}\n  ↳ *이유:* ${l.why}`)
            .join("\n");
          return `🔎 **코드 내 \`${targetId}\`의 역할 및 등장 위치 추적 (총 ${matchingLines.length}곳):**\n${traceStr}`;
        }
      }
    }

    // 5. "왜(Why)" / 이유 / 원리 질문 (예: "왜 -1을 해?", "왜 두 번 반복해?", "왜 return을 해?")
    if (hasCode && /왜|이유|목적|원리|어째서|필요한/.test(q)) {
      const queryTokens = q
        .replace(/[?'"`!~]/g, " ")
        .split(/\s+/)
        .map(w => w.replace(/(은|는|이|가|을|를|의|에|로|으로|에서|왜|이유가?|뭐야|뭔가요|알려줘|설명해줘|하는|할까|인가요|나요|거야|건가요)$/, ""))
        .filter(w => w.length >= 1 && !["왜", "이유", "코드", "여기", "이거", "저거"].includes(w));

      let bestLines = [];
      nonEmptyLines.forEach(l => {
        const hay = `${l.code} ${l.beginnerComment} ${l.advancedComment} ${l.why}`.toLowerCase();
        let score = 0;
        queryTokens.forEach(tok => {
          if (hay.includes(tok.toLowerCase())) score += 2;
        });
        if (score > 0) bestLines.push({ line: l, score });
      });

      bestLines.sort((a, b) => b.score - a.score);
      if (bestLines.length > 0) {
        const topMatches = bestLines.slice(0, 3).map(b => b.line);
        const answerLines = topMatches
          .map(l => `• **${l.lineNumber}번 줄 (\`${l.code.trim()}\`)**\n  - **역할:** ${l.beginnerComment}\n  - **그렇게 작성한 이유(Why):** ${l.why}`)
          .join("\n\n");
        return `💡 **질문하신 이유(Why)에 대한 코드 원리 분석:**\n\n${answerLines}`;
      }
    }

    // 6. 시간/공간 복잡도 & 성능 질문
    if (/복잡도|시간|공간|성능|빅오|big[\s-]*o|얼마나\s*빨|속도|메모리|효율/i.test(q)) {
      if (hasCode && data.deepDive) {
        return `⏱️ **이 코드의 시간 & 공간 복잡도 분석:**\n• **시간 복잡도:** \`${data.deepDive.timeComplexity}\`\n  ↳ *근거:* ${data.deepDive.timeReason}\n• **공간 복잡도:** \`${data.deepDive.spaceComplexity}\`\n  ↳ *근거:* ${data.deepDive.spaceReason}\n\n💡 **참고 (Big-O 빠른 비교):** \`O(1)\` < \`O(log N)\` < \`O(N)\` < \`O(N log N)\` < \`O(N²)\` < \`O(2^N)\` 순으로 실행 시간이 늘어납니다.`;
      }
      return `⏱️ **시간 복잡도(Time Complexity)와 공간 복잡도(Space Complexity)란?**\n• **시간 복잡도:** 입력 크기 \`N\`이 커질 때 연산 횟수가 어떻게 증가하는지 나타냅니다.\n  - \`O(1)\`: 입력 크기와 무관하게 즉시 처리 (예: 배열 인덱스 접근)\n  - \`O(log N)\`: 매번 탐색 범위를 절반으로 줄임 (예: 이진 탐색)\n  - \`O(N)\`: 데이터를 처음부터 끝까지 1번 순회 (예: 단일 for문, 투 포인터)\n  - \`O(N²)\`: 이중 반복문으로 모든 쌍을 비교 (예: 버블 정렬)\n• **공간 복잡도:** 추가로 사용하는 메모리 공간의 크기를 나타냅니다.`;
    }

    // 7. 실행 순서 / 흐름 / 단계별 과정 / 시뮬레이션 질문
    if (hasCode && /순서|흐름|과정|어떻게\s*(돌아|작동|실행|동작)|단계별|시뮬레이션|변화|추적/.test(q)) {
      const steps = (data.understanding?.flowSteps || [])
        .map(s => `• **${s.stepTitle}**: ${s.detail}`)
        .join("\n");
      const traces = (data.understanding?.variableTrace || [])
        .slice(0, 5)
        .map(t => `  ${t.step}단계 (${t.highlightLine}번 줄): ${t.description}`)
        .join("\n");
      return `🔄 **이 코드의 전체 실행 흐름 및 작동 순서:**\n\n${steps || "위에서 아래로 순차 실행됩니다."}\n\n📌 **단계별 실행 추적 요약:**\n${traces}\n\n*(상단 **[💡 코드 이해 도우미]** 탭에서 이전/다음 버튼을 눌러 변수 값의 변화를 한 단계씩 직접 시뮬레이션해 볼 수 있습니다!)*`;
    }

    // 8. 주의할 점 / 예외 / 엣지 케이스 / 버그 / 문제점 질문
    if (hasCode && /주의|예외|엣지|버그|에러|오류|문제점|단점|함정|틀린|고려할/.test(q)) {
      const edges = (data.deepDive?.edgeCases || [])
        .map(e => `• ${e}`)
        .join("\n");
      return `⚠️ **이 코드에서 주의해야 할 예외 상황(Edge Cases) 및 체크포인트:**\n${edges || "• 빈 입력이나 경계값(0, 음수, 최대 길이)이 들어올 때의 동작을 항상 확인해야 합니다."}`;
    }

    // 9. 리팩토링 / 코드 개선 / 최적화 질문
    if (hasCode && /리팩토링|개선|더\s*좋|최적화|깔끔|고쳐|다듬|모범\s*코드|줄여/.test(q)) {
      return `✨ **모범 주석 및 리팩토링 추천 코드:**\n\`\`\`\n${data.deepDive?.improvedCode || code}\n\`\`\`\n• **핵심 포인트:** 변수명을 명확히 하고, 경계 조건(빈 배열, 오버플로우 등)을 방어하며, 불필요한 중복 연산을 줄이면 가독성과 안정성이 크게 높아집니다.`;
    }

    // 10. 반복문 / 조건문 / 작동 블록 질문
    if (hasCode && /반복문|조건문|for|while|if|블록|구간|구조/.test(q) && data.logicalBlocks?.length) {
      const bList = data.logicalBlocks
        .map(b => `• **${b.badge} ${b.title}**\n  - *역할:* ${b.summary}\n  - *내부 흐름:* ${b.howItWorks}`)
        .join("\n\n");
      return `🔁 **이 코드의 작동 블록(시작~끝 구간) 구조 해부:**\n\n${bList}`;
    }

    // 11. 쉽게 설명 / 비유 / 한 줄 요약 / 전체 무슨 코드인지 질문
    if (hasCode && /쉽게|비유|초보|이해가?\s*안|무슨\s*코드|어떤\s*코드|전체|요약|한\s*줄|역할이?\s*뭐|기능이?\s*뭐|무슨\s*일/.test(q)) {
      return `⚡ **한 줄 완벽 이해:**\n${data.oneLineEssence}\n\n📌 **전체 요약:**\n${data.deepDive?.summary || ""}\n\n💡 **일상 비유로 쉽게 이해하기:**\n${data.understanding?.analogy || ""}\n\n🔄 **입출력 구조:**\n${data.deepDive?.inputOutput || ""}`;
    }

    // 12. 내장 CS & 프로그래밍 전공 지식 백과사전 (코드 외 일반 질문도 완벽 대응)
    const csKnowledgeBase = [
      {
        pattern: /재귀|recursion|recursive/i,
        answer: `🪆 **재귀 함수 (Recursion) 완벽 정리:**\n• **개념:** 함수가 자기 자신을 다시 호출하여 큰 문제를 동일한 형태의 작은 부분 문제로 쪼개어 해결하는 기법입니다.\n• **필수 요소 2가지:**\n  1. **기저 조건 (Base Case):** 재귀 호출을 멈추고 값을 반환하는 종료 조건 (없으면 무한 루프/Stack Overflow 발생)\n  2. **재귀 단계 (Recursive Step):** 문제의 크기를 줄여가며 자기 자신을 호출하는 부분`
      },
      {
        pattern: /포인터|pointer|주소값|역참조|malloc/i,
        answer: `👉 **포인터 (Pointer) 핵심 정리:**\n• **개념:** 값 자체를 저장하는 일반 변수와 달리, **메모리의 주소값(위치)**을 저장하는 변수입니다.\n• **핵심 연산자 2개:**\n  - \`&변수\`: 해당 변수가 위치한 **메모리 주소**를 가져옵니다.\n  - \`*포인터\`: 포인터가 가리키는 주소로 찾아가 **실제 저장된 값(역참조)**을 읽거나 수정합니다.`
      },
      {
        pattern: /이진\s*탐색|이분\s*탐색|binary\s*search/i,
        answer: `🎯 **이진 탐색 (Binary Search) 핵심 정리:**\n• **조건:** 데이터가 반드시 **정렬(Sorted)**되어 있어야 합니다.\n• **원리:** 시작(\`left\`)과 끝(\`right\`)의 중간 위치(\`mid\`) 값을 확인하여, 찾는 값보다 작으면 왼쪽 절반을 버리고(\`left = mid + 1\`), 크면 오른쪽 절반을 버리며(\`right = mid - 1\`) 탐색 범위를 반씩 줄입니다.\n• **성능:** 한 번 비교할 때마다 데이터가 1/2로 줄어들어 \`O(log N)\`의 매우 빠른 속도를 가집니다.`
      },
      {
        pattern: /투\s*포인터|two\s*pointer/i,
        answer: `✌️ **투 포인터 (Two Pointers) 알고리즘:**\n• **원리:** 배열이나 리스트에서 두 개의 인덱스 포인터(\`left\`, \`right\`)를 두고, 조건에 따라 포인터를 한 칸씩 이동시키며 원하는 구간이나 두 수의 조합을 찾는 기법입니다.\n• **장점:** 이중 for문으로 \`O(N²)\`이 걸릴 문제를 단 한 번의 선형 스캔인 \`O(N)\`으로 줄일 수 있습니다.`
      },
      {
        pattern: /동적\s*계획|다이나믹|dp|메모이제이션/i,
        answer: `🧩 **동적 계획법 (Dynamic Programming, DP):**\n• **핵심 원리:** 복잡한 문제를 작은 하위 문제로 나누어 풀되, **이미 계산한 하위 문제의 정답을 배열(테이블)에 저장(Memoization)**해 두고 재사용하여 중복 연산을 없애는 기법입니다.\n• **대표 예시:** 피보나치 수열을 재귀로만 풀면 \`O(2^N)\`이지만, DP 배열에 저장하며 풀면 \`O(N)\`에 해결됩니다.`
      },
      {
        pattern: /배열.*리스트|리스트.*배열|array.*list|연결\s*리스트/i,
        answer: `📊 **배열(Array) vs 연결 리스트(Linked List) 비교:**\n• **배열 (Array):** 메모리에 연속된 공간으로 할당됩니다. 인덱스(\`arr[i]\`)로 원하는 위치에 \`O(1)\`로 즉시 접근할 수 있지만, 중간에 데이터를 삽입/삭제할 때는 뒤의 요소들을 밀거나 당겨야 해서 \`O(N)\`이 걸립니다.\n• **연결 리스트 (Linked List):** 각 노드가 데이터와 다음 노드의 포인터를 가집니다. 중간 삽입/삭제는 \`O(1)\`로 빠르지만, 특정 위치 원소를 찾으려면 처음부터 따라가야 해서 \`O(N)\`이 걸립니다.`
      },
      {
        pattern: /스택|큐|stack|queue|lifo|fifo/i,
        answer: `📚 **스택(Stack) vs 큐(Queue) 비교:**\n• **스택 (Stack - LIFO 후입선출):** 프링글스 통처럼 **가장 나중에 들어간 데이터가 가장 먼저 나오는** 구조입니다. 함수 호출 스택(Call Stack), 괄호 검사, DFS에 사용됩니다.\n• **큐 (Queue - FIFO 선입선출):** 줄서기처럼 **가장 먼저 들어간 데이터가 가장 먼저 나오는** 구조입니다. 작업 대기열, BFS(너비 우선 탐색)에 사용됩니다.`
      },
      {
        pattern: /해시|딕셔너리|hash|map|객체/i,
        answer: `🔑 **해시 테이블 (Hash Table / Dictionary / Map):**\n• **원리:** 키(Key)를 해시 함수에 넣어 변환한 인덱스 위치에 값(Value)을 저장하는 자료구조입니다.\n• **장점:** 데이터의 검색, 추가, 삭제를 평균 **\`O(1)\` (상수 시간)** 만에 초고속으로 처리할 수 있습니다.`
      },
      {
        pattern: /비동기|async|await|promise|콜백/i,
        answer: `⚡ **비동기 프로그래밍 (Async / Await / Promise):**\n• 서버 통신(\`fetch\`)이나 파일 읽기처럼 시간이 걸리는 작업을 기다리는 동안 프로그램 전체가 멈추지(Blocking) 않도록 백그라운드에서 처리하는 방식입니다.\n• \`async\` 함수 안에서 \`await\` 키워드를 붙이면 비동기 작업이 끝날 때까지 기다렸다가 결과값을 동기 코드처럼 깔끔하게 받아올 수 있습니다.`
      }
    ];

    for (const kb of csKnowledgeBase) {
      if (kb.pattern.test(q)) {
        if (hasCode) {
          return `${kb.answer}\n\n---\n📌 **현재 입력된 코드와의 연관성:**\n${data.oneLineEssence}`;
        }
        return kb.answer;
      }
    }

    // 13. 자유 질문 키워드 기반 지능형 코드 매칭 & 종합 답변 생성 (절대 고정 답변만 반복하지 않음!)
    if (hasCode) {
      const qWords = q
        .replace(/[?'"`!~.,]/g, " ")
        .split(/\s+/)
        .map(w => w.replace(/(은|는|이|가|을|를|의|에|로|으로|에서|이란|란|뭐야|뭔가요|알려줘|설명해줘|해줘|무슨|어떤|어떻게|할까|인가요|거야)$/, ""))
        .filter(w => w.length >= 2);

      const scoredLines = [];
      nonEmptyLines.forEach(l => {
        const text = `${l.code} ${l.beginnerComment} ${l.advancedComment} ${l.why}`.toLowerCase();
        let hits = 0;
        qWords.forEach(w => {
          if (text.includes(w.toLowerCase())) hits++;
        });
        if (hits > 0) scoredLines.push({ line: l, hits });
      });

      scoredLines.sort((a, b) => b.hits - a.hits);

      if (scoredLines.length > 0) {
        const matchedText = scoredLines
          .slice(0, 3)
          .map(s => `• **${s.line.lineNumber}번 줄 (\`${s.line.code.trim()}\`)**\n  - **역할:** ${s.line.beginnerComment}\n  - **원리:** ${s.line.why}`)
          .join("\n\n");
        return `🤖 **질문하신 "${q}" 관련 코드 분석 결과입니다:**\n\n${matchedText}\n\n💡 **전체 맥락:** ${data.oneLineEssence}`;
      }

      const linesOverview = nonEmptyLines
        .slice(0, 5)
        .map(l => `• **${l.lineNumber}번 줄 (\`${l.code.trim()}\`)**: ${l.beginnerComment}`)
        .join("\n");

      return `🤖 **질문하신 "${q}"에 대해 현재 코드를 기준으로 설명해 드릴게요!**\n\n${data.oneLineEssence}\n\n**📌 핵심 작동 원리:**\n${data.deepDive?.summary || ""}\n\n**🔎 줄별 핵심 역할 요약:**\n${linesOverview}${nonEmptyLines.length > 5 ? `\n*(외 ${nonEmptyLines.length - 5}줄)*` : ""}\n\n궁금하신 **특정 변수 이름**이나 **줄 번호(예: 3번 줄)**, 혹은 **왜 그렇게 동작하는지**를 구체적으로 물어보시면 해당 부분을 더욱 깊게 파고들어 설명해 드립니다!`;
    }

    return `🤖 **질문하신 "${q}"에 대한 답변입니다:**\n\n현재 왼쪽(또는 위쪽) 코드 입력창이 비어 있어 특정 코드 줄 대신 일반 원리로 안내해 드립니다.\n• 분석하고 싶은 코드를 입력창에 넣거나 상단의 **⚡ 빠른 체험 프리셋(버블 정렬, 이진 탐색, 피보나치, 투 포인터)** 버튼을 누르시면 해당 코드의 모든 변수와 줄별 역할을 바탕으로 답변받을 수 있습니다!\n• 또한 *"이진 탐색 코드 짜줘"*, *"재귀함수가 뭐야?"*, *"시간복잡도 설명해줘"*처럼 알고리즘이나 문법 질문을 하시면 코드 없이도 바로 설명해 드립니다.`;
  },

  /**
   * 초경량 순수 정규식 기반 구문 강조 (Syntax Highlighting)
   */
  highlightSyntax(codeStr, lang = "auto") {
    if (!codeStr) return "";
    let s = String(codeStr)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 1) 문자열
    s = s.replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="syn-string">$1</span>');

    // 2) 숫자
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="syn-number">$1</span>');

    // 3) 키워드
    const keywords = [
      "def", "class", "import", "from", "as", "return", "if", "elif", "else",
      "for", "while", "break", "continue", "in", "and", "or", "not", "is", "None", "True", "False",
      "function", "const", "let", "var", "async", "await", "export", "default", "new",
      "int", "void", "double", "float", "char", "bool", "boolean", "long", "short", "struct",
      "public", "private", "protected", "static", "final", "include", "define", "sizeof",
      "switch", "case", "try", "catch", "throw", "typedef"
    ];
    const kwRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
    s = s.replace(kwRegex, '<span class="syn-keyword">$1</span>');

    // 4) 함수 호출부 (예: print(, malloc(, range()
    s = s.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g, '<span class="syn-fn">$1</span>');

    // 5) 닫는 중괄호 및 괄호 강조
    s = s.replace(/(\{|\})/g, '<span class="syn-bracket">$1</span>');

    return s;
  },

  /**
   * 포트폴리오 면접관 & 방문자를 위한 원클릭 대표 알고리즘 프리셋
   */
  PRESETS: {
    bubble_sort: {
      title: "버블 정렬 (Python)",
      lang: "python",
      code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

numbers = [64, 34, 25, 12, 22, 11, 90]
print(bubble_sort(numbers))`
    },
    binary_search: {
      title: "이진 탐색 (Python)",
      lang: "python",
      code: `def binary_search(arr, target):
    left = 0
    right = len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`
    },
    fibonacci_c: {
      title: "피보나치 재귀 (C언어)",
      lang: "c",
      code: `#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    int n = 7;
    int result = fibonacci(n);
    printf("Fibonacci(%d) = %d\\n", n, result);
    return 0;
}`
    },
    two_sum_js: {
      title: "투 포인터 (JavaScript)",
      lang: "javascript",
      code: `function twoSum(numbers, target) {
    let left = 0;
    let right = numbers.length - 1;
    while (left < right) {
        const sum = numbers[left] + numbers[right];
        if (sum === target) {
            return [left + 1, right + 1];
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    return [];
}`
    }
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LocalSmartEngine };
}

