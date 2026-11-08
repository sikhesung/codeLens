# 🔍 CodeLens — 한 줄 주석 · 작동 블록 해부 · 주석 채점 & AI 튜터

> **"코드를 이해하기 힘든 학습자를 위해, 1자 정렬 주석 · 블록 해부 · 채점 및 실시간 AI 튜터링을 제공하는 인터랙티브 코드 학습 도구"**

[![Live Demo](https://img.shields.io/badge/Live_Demo-웹에서_바로_체험하기-6366f1?style=for-the-badge&logo=googlechrome&logoColor=white)](https://sikhesung.github.io/codeLens/)
[![Standalone EXE](https://img.shields.io/badge/Standalone_EXE-180KB_무설치_다운로드-10b981?style=for-the-badge&logo=windows&logoColor=white)](./CodeLens.exe)

---

## 🌟 핵심 기능 요약

### 1. 📄 한 줄 주석 & 🔁 작동 블록 해부
- **⚡ 한 줄 완벽 이해 (관통 요약)**: 긴 설명 전에 단 1초 만에 코드의 핵심 원리와 최종 목적을 꿰뚫어 볼 수 있는 펀치라인 배너 제공 (선택사항 토글).
- **🎨 실시간 구문 강조 (Syntax Highlighting)**: 가벼운 토크나이징 엔진으로 예약어, 문자열, 숫자, 함수, 괄호를 알록달록하게 컬러링하여 가독성 극대화.
- **1자 정렬 주석 & 들여쓰기 연동**: 기본 상태에서 들여쓰기를 제거해 코드와 주석을 앞쪽 1자로 깔끔하게 정렬하며, `들여쓰기 (주석 같이 이동)` 옵션을 켜면 각 줄의 들여쓰기 위치에 맞춰 코드와 주석이 함께 이동.
- **C언어/JS 닫는 중괄호 `}` 단독 라인 스마트 정돈**: `}`만 덜렁 있는 줄에 불필요하고 긴 주석이 붙지 않도록 컴팩트한 높이와 은은한 닫힘 가이드(`· · · 닫힘`)로 시각적 노이즈 제거.
- **작동 블록 단위 보기 (`for` · `while` · `if` · `함수` 시작~끝)**: 줄 단위뿐 아니라 하나의 작동 블록이 시작하는 줄부터 끝나는 줄까지 묶어서 전체 역할과 내부 연쇄 흐름을 설명.
- **실제 영역이 늘어나는 드래그 조절 & 개인 맞춤 주석 위치**: 코드 영역 폭과 주석 위치/간격을 마우스 드래그나 슬라이더로 직접 조절할 수 있으며, 영역이 물리적으로 실시간 확장·축소.

### 2. ⚡ 원클릭 대표 알고리즘 프리셋
- 버블 정렬(Python), 이진 탐색(Python), 피보나치 재귀(C언어), 투 포인터(JavaScript) 등 코드를 준비하지 않고도 **원클릭으로 3초 만에 모든 기능과 시뮬레이션을 즉시 체험** 가능.

### 3. 💡 코드 이해 도우미
- 직관적 비유(멘탈 모델), 단계별 실행 위치 및 메모리 변수 상태 시뮬레이터, 실행 흐름도(Flowchart), 사용된 핵심 문법/개념 카드를 제공.

### 4. 🔬 코드 완벽 해석
- 핵심 요약(TL;DR), 입출력 명세, 시간 복잡도 및 공간 복잡도 도출 근거, 주의해야 할 엣지 케이스, 리팩토링 모범 코드를 제공.

### 5. 📝 주석 확인 & AI 채점소
- 사용자가 각 줄에 대해 이해한 내용을 주석으로 작성하거나 주석 달린 코드를 붙여넣으면, 코드의 실제 동작과 일치하는지 100점 만점(등급 S~C) 및 줄별 피드백(`정확한 이해` / `보완 필요` / `오개념 교정`)으로 채점.

### 6. 💬 우측 하단 AI 코딩 튜터 챗봇
- Gemini API 모델(`gemini-2.5-flash`, `gemini-2.5-pro` 등)을 연동하여 현재 보고 있는 코드나 선택한 줄, 반복문 작동 원리에 대해 실시간으로 질문하며 학습할 수 있으며, API 키가 없어도 내장 규칙 엔진으로 즉시 답변.

### 7. 🛠️ 모든 UI 마우스 드래그 커스텀
- 코드 입력창과 해석창 4방향(`상/하/좌/우`) 드래그 도킹 및 비율 조절, 상단 탭 드래그 순서 변경, 내부 카드 드래그 순서 변경 및 높이 조절, 심층 해부창 플로팅 분리, 챗봇 창 자유 이동 및 8방향 크기 조절, 원클릭 `↺ UI 초기화`를 지원.

---

## 🛠️ 기술 스택 & 아키텍처

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (CSS Grid & Custom Properties, Flexbox)
- **Engine**: 내장 AST/정규식 기반 `LocalSmartEngine` (오프라인 지원) + Google Gemini API (`gemini-2.5-flash` / `gemini-2.5-pro`)
- **Desktop Launcher**: C# (.NET WinForms / WebView) — 180KB 단일 독립 실행 파일 (Electron 무설치 대체)
- **Deployment**: GitHub Pages (웹) & Standalone EXE (데스크톱)

---

## 🚀 실행 방법

### 1) 웹에서 바로 실행
👉 **[CodeLens Web Live Demo](https://sikhesung.github.io/codeLens/)**

### 2) Windows 데스크톱 무설치 실행
- [`CodeLens.exe`](./CodeLens.exe) 다운로드 후 더블클릭 (추가 런타임 설치 불필요)

### 3) 독립 실행 파일 재컴파일
```bash
python build_exe.py
```
