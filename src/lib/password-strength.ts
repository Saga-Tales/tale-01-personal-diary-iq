// 사용자가 잊어버리면 영영 복호화 불가능한 백업 비밀번호.
// zxcvbn은 너무 무거워서 휴리스틱으로 자체 평가.
// 4단계 (0~3): weak / fair / good / strong.

export type StrengthLevel = 0 | 1 | 2 | 3

export interface StrengthResult {
  level: StrengthLevel
  label: '약함' | '보통' | '괜찮음' | '강함'
  hint: string                  // 사용자에게 보여줄 개선 힌트
  isCommon: boolean             // 흔한/약한 패턴이면 true
}

// 흔한 패턴들 — substring 매칭. 너무 길면 noise 늘어나니 매우 흔한 것만.
const COMMON_PATTERNS = [
  'password', 'passwd', '비밀번호', '12345', '123456', '1234567', '12345678',
  'qwerty', 'asdf', 'abcdef', 'admin', 'iloveyou', 'letmein', 'welcome',
  '00000', '11111', 'aaaaa', 'sk-ant-',
]

export function evaluatePassword(pwd: string): StrengthResult {
  if (!pwd) {
    return { level: 0, label: '약함', hint: '비밀번호를 입력하세요', isCommon: false }
  }

  const lower = pwd.toLowerCase()
  const isCommon = COMMON_PATTERNS.some((p) => lower.includes(p))

  // 문자 다양성
  const hasLower = /[a-z]/.test(pwd)
  const hasUpper = /[A-Z]/.test(pwd)
  const hasDigit = /[0-9]/.test(pwd)
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

  // 점수 — 길이가 가장 큰 요인 (수학적으로 길이가 brute-force에 가장 큰 영향)
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (pwd.length >= 16) score++
  if (variety >= 3) score++
  if (variety >= 4) score++

  // 흔한 패턴이면 강제 감점
  if (isCommon) score = Math.min(score, 1)

  let level: StrengthLevel
  if (score <= 1) level = 0
  else if (score <= 2) level = 1
  else if (score <= 3) level = 2
  else level = 3

  let hint = ''
  let label: StrengthResult['label']
  if (level === 0) {
    label = '약함'
    hint = isCommon
      ? '흔한 패턴이에요. 잊으면 데이터 영영 복구 불가.'
      : '8자 이상 + 문자 종류 섞어주세요.'
  } else if (level === 1) {
    label = '보통'
    hint = pwd.length < 12
      ? '12자 이상으로 늘리면 훨씬 안전해요.'
      : '대/소문자 + 숫자 + 기호 섞어보세요.'
  } else if (level === 2) {
    label = '괜찮음'
    hint = '쓸 만해요. 잊지 말고 어딘가 적어두세요.'
  } else {
    label = '강함'
    hint = '안전한 비밀번호. 잊지 마세요!'
  }

  return { level, label, hint, isCommon }
}
