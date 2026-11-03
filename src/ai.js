// ─────────────────────────────────────────────────────────────
// PROTOTYPE AI (SIMULATED)
// askAI() is the only place the "AI" lives. Right now it uses
// keyword rules on invented sample data. To use a real model later,
// replace the body of askAI() with a call to the model (through a
// here.now proxy route, never a key in this file) and return the
// same shape of result.
// ─────────────────────────────────────────────────────────────

import { DEPARTMENTS } from './sampleData.js'

// Words that point to each department. Strong words count 3 points, others 1.
const RULES = {
  Cardiology: {
    strong: ['cardiology', 'cardiac', 'st changes', 'stress test'],
    weak: ['chest pain', 'ecg', 'ekg', 'palpitation', 'blood pressure', 'murmur', 'arrhythmia'],
  },
  Orthopedics: {
    strong: ['orthopedic', 'orthopaedic', 'fracture', 'meniscus', 'acl'],
    weak: ['knee', 'hip', 'shoulder', 'joint', 'sprain', 'back pain', 'injury'],
  },
  Neurology: {
    strong: ['neurology', 'tia', 'stroke', 'seizure'],
    weak: ['headache', 'migraine', 'numbness', 'blurred vision', 'tremor', 'dizz', 'tingling'],
  },
  Gastroenterology: {
    strong: ['gastro', 'colonoscopy', 'gerd'],
    weak: ['reflux', 'heartburn', 'abdominal', 'bowel', 'liver', 'nausea', 'stomach'],
  },
  Pulmonology: {
    strong: ['pulmonology', 'pulmonary', 'copd', 'asthma'],
    weak: ['cough', 'shortness of breath', 'wheez', 'smoker', 'lung', 'oxygen'],
  },
  Endocrinology: {
    strong: ['endocrinology', 'a1c', 'diabetes', 'thyroid'],
    weak: ['metformin', 'insulin', 'hormone', 'glucose'],
  },
  'Behavioral Health': {
    strong: ['behavioral health', 'counseling', 'psychiatr', 'depression'],
    weak: ['anxiety', 'low mood', 'mood', 'panic', 'trouble sleeping', 'stress at work'],
  },
  Oncology: {
    strong: ['oncology', 'cancer', 'tumor', 'lung mass', 'biopsy'],
    weak: ['mass', 'weight loss', 'lymph', 'lump'],
  },
}

const URGENT_WORDS = ['urgent', 'urgently', 'asap', 'tia', 'stroke', 'st changes', 'mass', 'tumor', 'cancer']
const SOON_WORDS = ['soon', 'severe', 'worsening', 'poorly controlled', 'locking', 'several months']

const CHECKS = [
  { label: 'Insurance', test: /insurance|health plan|medicare|medicaid/i },
  { label: 'Diagnosis', test: /diagnos|suspected/i },
  {
    label: 'Test results',
    test: /attached|results|ecg|ekg|mri|x-ray|xray|ct scan|ultrasound|a1c|labs?\b/i,
  },
]

function findMatches(text, words) {
  return words.filter((w) => text.includes(w))
}

function scoreDepartments(text) {
  return DEPARTMENTS.map((dept) => {
    const strong = findMatches(text, RULES[dept].strong)
    const weak = findMatches(text, RULES[dept].weak)
    return { dept, score: strong.length * 3 + weak.length, clues: [...strong, ...weak] }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Reads one referral and suggests where it should go.
 * @param {string} referralText the text of the fax or email
 * @returns {Promise<object>} either { ok: false, message } or
 *   { ok: true, department, alsoPossible, urgency, missing, confidence, reason }
 */
export async function askAI(referralText) {
  await new Promise((r) => setTimeout(r, 700)) // feels like the AI is thinking

  const text = (referralText || '').trim().toLowerCase()
  if (!text) {
    return { ok: false, message: 'There’s no referral text yet. Paste the fax or email first.' }
  }

  const ranked = scoreDepartments(text)
  const [top, second] = ranked
  if (text.length < 15 || top.score === 0) {
    return {
      ok: false,
      message:
        'I couldn’t tell where this referral should go. It may be too short or unclear. Please pick a department yourself, or check with the referring doctor.',
    }
  }

  const confidence = Math.max(35, Math.min(97, 50 + (top.score - second.score) * 7 + top.score * 3))

  let urgency = 'Routine'
  if (findMatches(text, URGENT_WORDS).length) urgency = 'Urgent'
  else if (findMatches(text, SOON_WORDS).length) urgency = 'Soon'

  const missing = CHECKS.filter((c) => !c.test.test(text)).map((c) => c.label)

  const clues = top.clues.slice(0, 3).map((c) => `“${c}”`).join(', ')
  let reason = `Mentions ${clues}, which usually go to ${top.dept}.`
  const alsoPossible = second.score >= 2 && top.score - second.score <= 3 ? second.dept : null
  if (alsoPossible) reason += ` It could also fit ${alsoPossible}.`

  return { ok: true, department: top.dept, alsoPossible, urgency, missing, confidence, reason }
}
