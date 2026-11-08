const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { LocalSmartEngine } = require("../sample_data.js");

describe("LocalSmartEngine - Unit Tests", () => {
  describe("1. 언어 자동 감지 (detectLanguage)", () => {
    it("C 언어 코드 감지 (#include, printf)", () => {
      const code = `#include <stdio.h>\nint main() { printf("Hello"); return 0; }`;
      assert.strictEqual(LocalSmartEngine.detectLanguage(code), "c");
    });

    it("Java 코드 감지 (public class, System.out.print)", () => {
      const code = `public class Solution { public static void main(String[] args) { System.out.println("Hi"); } }`;
      assert.strictEqual(LocalSmartEngine.detectLanguage(code), "java");
    });

    it("JavaScript 코드 감지 (function, const, console.log)", () => {
      const code = `function sum(a, b) {\n  const result = a + b;\n  console.log(result);\n  return result;\n}`;
      assert.strictEqual(LocalSmartEngine.detectLanguage(code), "javascript");
    });

    it("Python 코드 감지 (def, elif)", () => {
      const code = `def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        pass`;
      assert.strictEqual(LocalSmartEngine.detectLanguage(code), "python");
    });
  });

  describe("2. 블록 단위 파싱 (parseLogicalBlocks)", () => {
    it("Python 인덴트 기반 블록(함수, 루프) 범위 및 라인 수 검증", () => {
      const pythonCode = [
        "def find_max(numbers):",
        "    max_val = numbers[0]",
        "    for num in numbers:",
        "        if num > max_val:",
        "            max_val = num",
        "    return max_val"
      ];
      const dummyLines = pythonCode.map((c, i) => ({ lineNumber: i + 1, code: c, beginnerComment: "" }));
      const blocks = LocalSmartEngine.parseLogicalBlocks(pythonCode, "python", dummyLines);

      assert.ok(blocks.length >= 1, "최소 1개 이상의 블록이 파싱되어야 합니다.");
      const rootFuncBlock = blocks[0];
      assert.strictEqual(rootFuncBlock.startLine, 1);
      assert.strictEqual(rootFuncBlock.endLine, 6);
      assert.strictEqual(rootFuncBlock.blockType, "function");
    });

    it("C/JS 중괄호 기반 중첩 루프 및 조건문 블록 파싱", () => {
      const jsCode = [
        "function search(arr, target) {",
        "    let left = 0;",
        "    let right = arr.length - 1;",
        "    while (left <= right) {",
        "        if (arr[left] === target) return left;",
        "        left++;",
        "    }",
        "    return -1;",
        "}"
      ];
      const dummyLines = jsCode.map((c, i) => ({ lineNumber: i + 1, code: c, beginnerComment: "" }));
      const blocks = LocalSmartEngine.parseLogicalBlocks(jsCode, "javascript", dummyLines);

      assert.ok(blocks.length >= 2, "함수와 while 루프 등 복수 블록이 파싱되어야 합니다.");
      const whileBlock = blocks.find((b) => b.blockType === "loop-while");
      assert.ok(whileBlock, "loop-while 블록이 검출되어야 합니다.");
      assert.strictEqual(whileBlock.startLine, 4);
      assert.strictEqual(whileBlock.endLine, 7);
    });
  });

  describe("3. 주석 제거 유틸리티 (stripInlineComment)", () => {
    it("// 인라인 주석 제거", () => {
      assert.strictEqual(LocalSmartEngine.stripInlineComment("int a = 10; // 초기화"), "int a = 10;");
    });

    it("# 인라인 주석 제거", () => {
      assert.strictEqual(LocalSmartEngine.stripInlineComment("arr = [1, 2] # 리스트"), "arr = [1, 2]");
    });
  });

  describe("4. 커스텀 코드 정적 분석 (analyzeCustomCode)", () => {
    it("한 줄 관통 요약(oneLineEssence) 및 줄별 해설 생성 검증", () => {
      const code = `def square(n):\n    return n * n`;
      const result = LocalSmartEngine.analyzeCustomCode(code, "python");

      assert.ok(result.oneLineEssence, "한 줄 관통 요약이 생성되어야 합니다.");
      assert.ok(result.lineByLine.length >= 2, "모든 라인에 대한 분석 객체가 생성되어야 합니다.");
      assert.strictEqual(result.lineByLine[0].lineNumber, 1);
      assert.ok(result.deepDive.timeComplexity, "시간 복잡도 정보가 도출되어야 합니다.");
    });
  });

  describe("5. 구문 강조 토크나이저 (highlightSyntax)", () => {
    it("예약어, 숫자, 문자열 태그 래핑 검증", () => {
      const raw = `const msg = "hello 42";`;
      const highlighted = LocalSmartEngine.highlightSyntax(raw, "javascript");

      assert.ok(highlighted.includes("syn-keyword"), "const 예약어가 syn-keyword로 감싸져야 합니다.");
      assert.ok(highlighted.includes("syn-string"), "문자열이 syn-string으로 감싸져야 합니다.");
      assert.ok(highlighted.includes("syn-number"), "숫자가 syn-number로 감싸져야 합니다.");
    });
  });

  describe("6. 주석 채점 엔진 (gradeUserComments)", () => {
    it("사용자 작성 주석 채점 시 점수 및 피드백 리스트 생성", () => {
      const code = `let count = 0;\ncount++;`;
      const analysis = LocalSmartEngine.analyzeCustomCode(code, "javascript");
      const userComments = {
        1: "변수 count를 0으로 초기화",
        2: "count 값을 1 증가"
      };

      const grade = LocalSmartEngine.gradeUserComments(code, userComments, analysis);
      assert.ok(typeof grade.score === "number");
      assert.ok(["S", "A", "B", "C"].includes(grade.grade));
      assert.ok(Array.isArray(grade.feedbackList));
    });

    it("오개념(함정 키워드) 감지 및 교정 피드백 반환", () => {
      const code = `a += 1;`;
      const analysis = LocalSmartEngine.analyzeCustomCode(code, "javascript");
      const userComments = {
        1: "값을 1 뺀다" // '+='에 대해 '뺀다'는 오개념
      };

      const grade = LocalSmartEngine.gradeUserComments(code, userComments, analysis);
      assert.strictEqual(grade.incorrectCount, 1, "오개념 트랩이 1회 감지되어야 합니다.");
      assert.strictEqual(grade.feedbackList[0].status, "incorrect");
    });

    it("글자 수만 채운 무관한 주석은 0점(incorrect) 처리 검증", () => {
      const code = `for i in range(n):`;
      const analysis = LocalSmartEngine.analyzeCustomCode(code, "python");
      const userComments = {
        1: "오늘 점심 메뉴는 맛있는 돈까스입니다 글자수 채우기"
      };

      const grade = LocalSmartEngine.gradeUserComments(code, userComments, analysis);
      assert.strictEqual(grade.score, 0, "코드 역할과 무관한 문장은 글자 수가 길어도 0점이어야 합니다.");
      assert.strictEqual(grade.feedbackList[0].status, "incorrect");
    });

    it("단순 문법 명칭만 적은 경우 만점이 아닌 부분 점수(partial) 처리 검증", () => {
      const code = `while (left < right) {`;
      const analysis = LocalSmartEngine.analyzeCustomCode(code, "javascript");
      const userComments = {
        1: "반복문입니다"
      };

      const grade = LocalSmartEngine.gradeUserComments(code, userComments, analysis);
      assert.strictEqual(grade.feedbackList[0].status, "partial", "구체적 역할 없이 문법 이름만 적으면 partial이어야 합니다.");
      assert.ok(grade.score < 80, "만점이 부여되면 안 됩니다.");
    });
  });

  describe("7. 지능형 만능 AI 튜터 챗봇 (answerChatLocally)", () => {
    it("특정 변수 역할 질문 시 고정된 1번 줄 답변이 아닌 해당 변수 등장 라인 추적 답변", () => {
      const code = LocalSmartEngine.PRESETS.two_sum_js.code;
      const analysis = LocalSmartEngine.analyzeCustomCode(code, "javascript");
      const reply = LocalSmartEngine.answerChatLocally("right 변수는 무슨 역할이야?", code, analysis, 1);

      assert.ok(reply.includes("right"), "질문한 변수 right에 대한 설명이 포함되어야 합니다.");
      assert.ok(!reply.includes("현재 선택하신 **1번 줄"), "고정된 1번 줄 기본 답변이 나오면 안 됩니다.");
    });

    it("알고리즘 코드 작성 및 CS 개념 질문에 대해 즉시 답변", () => {
      const codeReply = LocalSmartEngine.answerChatLocally("이진 탐색 코드 짜줘", "", null, 1);
      assert.ok(codeReply.includes("binary_search"), "이진 탐색 구현 코드가 포함되어야 합니다.");

      const csReply = LocalSmartEngine.answerChatLocally("재귀함수가 뭐야?", "", null, 1);
      assert.ok(csReply.includes("기저 조건"), "재귀 함수 핵심 개념이 설명되어야 합니다.");
    });
  });
});
