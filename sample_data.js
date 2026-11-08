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

  gradeUserComments(code, userCommentsMap, analysisData) {
    const lineItems = (analysisData?.lineByLine || []).filter(item => item.code.trim().length > 0);
    const feedbackList = [];
    let totalEarned = 0;
    let gradedCount = 0;
    let correctCount = 0;
    let partialCount = 0;
    let incorrectCount = 0;

    const antonymTraps = [
      { codePattern: /\/\//, wrongWords: ["소수점 포함", "실수 나눗셈"], reason: "`//` 연산자는 소수점을 버리고 **정수 몫**만 구하는 연산자입니다." },
      { codePattern: /\+=/, wrongWords: ["뺀다", "감소", "차감", "제거"], reason: "`+=` 연산자는 값을 빼는 것이 아니라 **더해서 누적**하는 연산자입니다." },
      { codePattern: /-=/, wrongWords: ["더한다", "증가", "추가"], reason: "`-=` 연산자는 값을 더하는 것이 아니라 **빼서 감소**시키는 연산자입니다." },
      { codePattern: /\+\+/, wrongWords: ["감소", "뺀다", "왼쪽으로"], reason: "`++` 연산자는 값을 1 **증가**시키는 연산자입니다." },
      { codePattern: /--/, wrongWords: ["증가", "더한다", "오른쪽으로"], reason: "`--` 연산자는 값을 1 **감소**시키는 연산자입니다." },
      { codePattern: />(?!=)/, wrongWords: ["작을 때", "작으면", "미만", "이하"], reason: "`>` 기호는 작을 때가 아니라 **클 때(초과)**를 비교하는 연산자입니다." },
      { codePattern: /<(?!=)/, wrongWords: ["클 때", "크면", "초과", "이상"], reason: "`<` 기호는 클 때가 아니라 **작을 때(미만)**를 비교하는 연산자입니다." },
      { codePattern: /popleft\s*\(/, wrongWords: ["맨 뒤", "뒤에서", "마지막"], reason: "`popleft()`는 맨 뒤가 아니라 큐의 **맨 앞(왼쪽)**에서 데이터를 꺼내는 함수입니다." },
      { codePattern: /append\s*\(|push\s*\(/, wrongWords: ["꺼낸다", "삭제", "제거"], reason: "`append/push`는 데이터를 삭제하는 것이 아니라 **맨 뒤에 추가**하는 함수입니다." },
      { codePattern: /clearTimeout/, wrongWords: ["즉시 실행", "실행시"], reason: "`clearTimeout()`은 타이머를 실행하는 것이 아니라 예약된 타이머를 **취소**하는 함수입니다." },
      { codePattern: /\bbreak\b/, wrongWords: ["다음 반복", "건너뛰고 계속"], reason: "`break`는 다음 회차로 건너뛰는(`continue`) 것이 아니라 **반복문을 완전히 종료(탈출)**합니다." },
      { codePattern: /\bcontinue\b/, wrongWords: ["반복문 종료", "완전히 빠져나"], reason: "`continue`는 반복문을 종료(`break`)하는 것이 아니라 **이번 회차만 건너뛰고 다음 반복을 계속**합니다." }
    ];

    lineItems.forEach(item => {
      const userComment = (userCommentsMap[item.lineNumber] || "").trim();
      if (!userComment) return;

      gradedCount++;
      const modelComment = item.beginnerComment || item.advancedComment;

      let trapTriggered = null;
      for (const trap of antonymTraps) {
        if (trap.codePattern.test(item.code)) {
          if (trap.wrongWords.some(w => userComment.includes(w))) {
            trapTriggered = trap.reason;
            break;
          }
        }
      }

      if (trapTriggered) {
        incorrectCount++;
        feedbackList.push({
          lineNumber: item.lineNumber,
          code: item.code.trim(),
          userComment,
          modelComment,
          status: "incorrect",
          verdictLabel: "❌ 오개념 교정 필요",
          feedback: `${trapTriggered}`
        });
        return;
      }

      if (item.code.includes("len(") && item.code.includes("- 1") && userComment.includes("길이") && !userComment.includes("- 1") && !userComment.includes("-1") && !userComment.includes("마지막")) {
        partialCount++;
        totalEarned += 65;
        feedbackList.push({
          lineNumber: item.lineNumber,
          code: item.code.trim(),
          userComment,
          modelComment,
          status: "partial",
          verdictLabel: "⚠️ 보완 권장 (-1 인덱스)",
          feedback: "단순 길이가 아니라 `- 1`을 통해 **마지막 원소의 인덱스**를 가리킨다는 점을 함께 적어주면 더욱 정확합니다!"
        });
        return;
      }

      if (item.code.includes("<=") && userComment.includes("작을 때") && !userComment.includes("같") && !userComment.includes("이하")) {
        partialCount++;
        totalEarned += 70;
        feedbackList.push({
          lineNumber: item.lineNumber,
          code: item.code.trim(),
          userComment,
          modelComment,
          status: "partial",
          verdictLabel: "⚠️ 등호(=) 조건 보완",
          feedback: "`<`가 아닌 `<=`이므로 작을 때뿐만 아니라 **두 값이 같을 때(이하)**도 포함된다는 점이 중요합니다."
        });
        return;
      }

      if (userComment.length < 3 || /^[ㄱ-ㅎㅏ-ㅣ?]+$/.test(userComment)) {
        partialCount++;
        totalEarned += 40;
        feedbackList.push({
          lineNumber: item.lineNumber,
          code: item.code.trim(),
          userComment,
          modelComment,
          status: "partial",
          verdictLabel: "⚠️ 설명 보충 필요",
          feedback: "주석이 너무 짧습니다. 이 코드가 어떤 값을 어떻게 처리하는지 한 문장으로 구체화해 보세요!"
        });
        return;
      }

      correctCount++;
      totalEarned += 100;
      feedbackList.push({
        lineNumber: item.lineNumber,
        code: item.code.trim(),
        userComment,
        modelComment,
        status: "correct",
        verdictLabel: "✅ 정확한 이해",
        feedback: `잘 이해하셨습니다! ${item.why}`
      });
    });

    if (gradedCount === 0) {
      return {
        score: 0,
        grade: "-",
        summaryTitle: "작성된 주석이 없습니다!",
        summaryText: "위 목록에서 채점받고 싶은 코드 줄 옆에 내가 이해한 주석을 1줄 이상 입력한 뒤 다시 버튼을 눌러주세요.",
        correctCount: 0,
        partialCount: 0,
        incorrectCount: 0,
        feedbackList: []
      };
    }

    const finalScore = Math.round(totalEarned / gradedCount);
    let grade = "S";
    let summaryTitle = "🎉 훌륭합니다! 코드의 의도와 동작을 정확하게 이해하고 계십니다.";
    if (finalScore < 60) {
      grade = "C";
      summaryTitle = "🌱 연산자의 방향이나 제어문 조건을 모범 주석과 비교하며 복습해 보세요!";
    } else if (finalScore < 80) {
      grade = "B";
      summaryTitle = "👍 전체적인 흐름은 파악하셨으나, 일부 줄의 개념 교정이 필요합니다.";
    } else if (finalScore < 95) {
      grade = "A";
      summaryTitle = "🌟 아주 잘 이해하셨습니다! 세부 경계 조건만 챙기면 완벽합니다.";
    }

    return {
      score: finalScore,
      grade,
      summaryTitle,
      summaryText: `내가 작성한 총 ${gradedCount}개의 주석을 채점한 결과: 정확 ${correctCount}개, 보완 필요 ${partialCount}개, 오개념 교정 ${incorrectCount}개입니다.`,
      correctCount,
      partialCount,
      incorrectCount,
      feedbackList
    };
  },

  /**
   * API 키 미설정 시에도 코드 문맥에 맞춰 즉답해주는 로컬 AI 튜터 응답기
   */
  answerChatLocally(question, code, analysisData, selectedLine) {
    if (!code || !code.trim()) {
      return "먼저 왼쪽(또는 위쪽) 코드 입력창에 궁금한 코드를 붙여넣고 **분석 버튼**을 눌러주세요! 그러면 그 코드를 기준으로 질문에 상세히 답변해 드립니다.";
    }

    const q = question.trim();
    // 특정 줄 번호에 대한 질문인지 확인 (예: "3번 줄", "5번째 줄")
    const lineMatch = q.match(/(\d+)\s*(번|번째|줄|라인)/);
    if (lineMatch && analysisData?.lineByLine) {
      const targetNum = parseInt(lineMatch[1], 10);
      const item = analysisData.lineByLine.find(l => l.lineNumber === targetNum);
      if (item) {
        return `**${targetNum}번 줄 (\`${item.code.trim()}\`) 설명:**\n• **핵심 의미:** ${item.beginnerComment}\n• **작성 이유(Why):** ${item.why}`;
      }
    }

    if (/복잡도|시간|성능|빅오|빠른/i.test(q) && analysisData?.deepDive) {
      return `⏱️ **이 코드의 복잡도 분석:**\n• **시간 복잡도:** \`${analysisData.deepDive.timeComplexity}\` (${analysisData.deepDive.timeReason})\n• **공간 복잡도:** \`${analysisData.deepDive.spaceComplexity}\` (${analysisData.deepDive.spaceReason})`;
    }

    if (/for|while|반복|블록|구간/i.test(q) && analysisData?.logicalBlocks?.length) {
      const bList = analysisData.logicalBlocks
        .map(b => `• **${b.title}**: ${b.summary}`)
        .join("\n");
      return `🔁 **이 코드의 주요 작동 블록(시작~끝 구간) 정리:**\n${bList}`;
    }

    const selItem = analysisData?.lineByLine?.find(l => l.lineNumber === selectedLine);
    if (selItem && selItem.code.trim()) {
      return `현재 선택하신 **${selItem.lineNumber}번 줄 (\`${selItem.code.trim()}\`)** 기준 설명입니다:\n• **의미:** ${selItem.beginnerComment}\n• **심층 이유:** ${selItem.why}\n\n💡 *우측 상단 [Gemini API 설정]에 API 키를 연결하시면, 현재 선택된 Gemini 모델과 자유롭게 심층 문답을 나누실 수 있습니다!*`;
    }

    return `📌 **코드 전체 요약:**\n${analysisData?.deepDive?.summary || "입력하신 코드를 순차적으로 수행합니다."}\n\n궁금한 줄 번호(예: *"3번 줄이 왜 필요해?"*)나 *"시간 복잡도 알려줘"*, *"반복문 구간 설명해줘"*처럼 물어보시거나, 상단 **Gemini API 설정**에 키를 등록해 AI 모델과 직접 대화해 보세요!`;
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
