/**
 * Screenplay semantic classification and filtering utilities.
 * Handles non-character detection (camera shots, time lapses, transitions),
 * super title and non-INT/EXT scene headings, shot elements, and title page stamp filtering.
 */

// Common time lapse markers that should never be tagged as characters
const TIME_LAPSE_REGEX =
  /^(?:THE\s+)?(?:NEXT\s+DAY|NEXT\s+MORNING|SAME\s+DAY|SAME\s+TIME|LATER\s+THAT\s+DAY|LATER\s+THAT\s+NIGHT|LATER|IN\s+THE\s+NIGHT|AT\s+NIGHT|THAT\s+NIGHT|MEANWHILE|CONTINUOUS)$/i;

const TIME_DURATION_REGEX =
  /^(?:AFTER\s+(?:A\s+)?(?:FEW|SEVERAL|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|\d+)\s+(?:SECONDS|MINUTES|HOURS|DAYS|WEEKS|MONTHS|YEARS)|AFTER\s+(?:A\s+WHILE|SOME\s+TIME))$/i;

const LATER_UNITS_REGEX =
  /^(?:MOMENTS|MINUTES|HOURS|DAYS|WEEKS|MONTHS|YEARS)\s+LATER$/i;

const STANDALONE_TIME_REGEX =
  /^(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON)$/i;

// Camera cues, angles, framing, and directorial instructions (Screenplay Shot Element)
export const CAMERA_SHOT_REGEX =
  /^(?:(?:ZOOM\s+(?:OUT|IN)(?:\s+SLOWLY|\s+FAST)?)|(?:CLOSE\s+UP|EXTREME\s+CLOSE\s+UP|ECU|CU|MCU|WIDE\s+SHOT|MEDIUM\s+SHOT|FULL\s+SHOT|LONG\s+SHOT|ESTABLISHING\s+SHOT|EXTREME\s+LONG\s+SHOT|AERIAL\s+SHOT|CRANE\s+SHOT|TRACKING\s+SHOT|DOLLY\s+SHOT|STEADICAM\s+SHOT|MOVING\s+SHOT|HANDHELD\s+SHOT|TWO\s+SHOT|THREE\s+SHOT|INSERT\s+SHOT|INSERT)|(?:(?:A\s+)?CLOSE\s+(?:UP\s+)?ON)|(?:ANGLE\s+ON|REVERSE\s+ANGLE|HIGH\s+ANGLE|LOW\s+ANGLE|DUTCH\s+ANGLE|WIDE\s+ANGLE)|(?:POV|POINT\s+OF\s+VIEW)|(?:PAN\s+(?:TO|ACROSS|LEFT|RIGHT))|(?:TILT\s+(?:UP|DOWN))|(?:TRACKING\s+(?:WITH|ON))|(?:DOLLY\s+(?:IN|OUT|WITH))|(?:SLOW\s+MOTION|SLOW\s+MO)|(?:BACKDROP\s+OF)|(?:OVER\s+THE\s+SHOULDER(?:\s+SHOT)?|OTS)|(?:CUTAWAY|MONTAGE\s+OF\s+SHOTS))(?:[\s:.-].*)?$/i;

/**
 * Returns true if the text matches a screenplay Shot element
 * (camera framing, angle, perspective, camera movement, or background backdrop cue).
 */
export function isShotCandidate(text: string): boolean {
  if (!text) return false;
  const clean = text.replace(/[\(\)\[\]"']/g, '').trim();
  if (clean.length < 2) return false;
  return CAMERA_SHOT_REGEX.test(clean);
}

// Transitions and end markers
const TRANSITION_MARKER_REGEX =
  /^(?:THE\s+END|FIN|END\s+OF\s+(?:EPISODE|ACT|SHOW|PLAY|SCRIPT)|BLACKOUT|FADE\s+OUT|FADE\s+IN|FADE\s+TO\s+BLACK|CUT\s+TO\s+BLACK|DISSOLVE\s+TO\s+BLACK|CUT\s+TO:|DISSOLVE\s+TO:|SMASH\s+CUT:|MATCH\s+CUT:)$/i;

// Super titles, inserts, and structural headings
const SUPER_TITLE_PREFIX_REGEX =
  /^(?:SUPER\s*TITLE|SUPER|TITLE\s*CARD|TITLE|INTERTITLE|FLASHBACK|MONTAGE|INSERT|SERIES\s+OF\s+SHOTS)(?:[\s:.-].*)?$/i;

/**
 * Returns true if the uppercase string is a time marker, camera shot,
 * transition, or editorial cue rather than a legitimate character speaking cue.
 */
export function isNonCharacterCue(text: string): boolean {
  if (!text) return true;
  const clean = text.replace(/[\(\)\[\]"']/g, '').trim().toUpperCase();
  if (!clean || clean.length < 2) return true;

  if (TIME_LAPSE_REGEX.test(clean)) return true;
  if (TIME_DURATION_REGEX.test(clean)) return true;
  if (LATER_UNITS_REGEX.test(clean)) return true;
  if (STANDALONE_TIME_REGEX.test(clean)) return true;
  if (isShotCandidate(clean)) return true;
  if (TRANSITION_MARKER_REGEX.test(clean)) return true;
  if (SUPER_TITLE_PREFIX_REGEX.test(clean)) return true;

  return false;
}

/**
 * Standard and extended scene heading patterns.
 * Supports:
 * 1. Traditional sluglines: INT., EXT., INT/EXT., I/E., EST.
 * 2. Super titles: SUPER TITLE: "3. THE CASE", TITLE CARD: ..., SUPER: ...
 * 3. Numbered sequence headings: 3. THE CASE, 4. THE DEATH, SCENE 1: ...
 * 4. Locations ending with time-of-day without INT/EXT: POLICE STATION - DAY
 * 5. Sequence markers: FLASHBACK - ..., MONTAGE - ..., SERIES OF SHOTS
 */
export function isSceneHeadingCandidate(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // 1. Traditional sluglines or forced Fountain dot
  if (/^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)/i.test(trimmed)) return true;
  if (/^(?:INT|EXT|INT\/EXT|I\/E)\s+[A-Z0-9]/i.test(trimmed)) return true;
  if (/^\.[A-Z0-9]/.test(trimmed)) return true;

  // 2. Super titles & title cards
  if (/^(?:SUPER\s*TITLE|SUPER|TITLE\s*CARD|TITLE|INTERTITLE)[\s:.-]/i.test(trimmed)) return true;

  // 3. Numbered sequence headings: "3. THE CASE", "4. THE DEATH", "SCENE 1: ..."
  if (/^\d+[\.\)]\s+[A-Z0-9\s_\-'"/]{2,}$/i.test(trimmed)) return true;
  if (/^SCENE\s+\d+[\s:.-]/i.test(trimmed)) return true;

  // 4. Locations ending with time-of-day without INT/EXT: "POLICE STATION - DAY"
  if (/^[A-Z0-9\s_\-'"/]{3,}\s+-\s+(?:DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|CONTINUOUS|LATER|SAME\s+TIME)\b/i.test(trimmed)) {
    return true;
  }

  // 5. Sequence markers: FLASHBACK, MONTAGE, SERIES OF SHOTS
  if (/^(?:FLASHBACK|MONTAGE|SERIES\s+OF\s+SHOTS|DREAM\s+SEQUENCE|INSERT)[\s:.-]/i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Detects whether a line on a Title Page is a date/time stamp, draft revision label,
 * copyright, or contact info rather than a screenplay title.
 */
export function isDateOrDraftStamp(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;

  // Standard date/time patterns: "31 DECEMBER 2025 AT 14:30", "November 1, 2026", "14:30"
  if (/\b\d{1,2}\s+(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{2,4}\b/i.test(trimmed)) {
    return true;
  }
  if (/\b(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{1,2},?\s+\d{2,4}\b/i.test(trimmed)) {
    return true;
  }
  if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(trimmed)) {
    return true;
  }
  if (/\b(?:AT\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/i.test(trimmed)) {
    return true;
  }

  // Draft and revision labels
  if (/^(?:.*?\s+)?(?:DRAFT|VERSION|REVISED|REVISION|PRODUCTION\s+DRAFT|WHITE\s+DRAFT|BLUE\s+DRAFT|PINK\s+DRAFT|YELLOW\s+DRAFT)(?:\s+.*)?$/i.test(trimmed)) {
    return true;
  }

  // Author attribution markers
  if (/^(?:WRITTEN\s+BY|SCREENPLAY\s+BY|STORY\s+BY|BY)$/i.test(trimmed)) {
    return true;
  }

  // Contact and copyright
  if (/@|\b(?:PHONE|TEL|EMAIL|CONTACT|ADDRESS|COPYRIGHT|ALL\s+RIGHTS\s+RESERVED)\b/i.test(trimmed)) {
    return true;
  }

  return false;
}


/**
 * Determines whether text wrapped in parentheses is a genuine screenplay actor direction
 * (e.g. `(beat)`, `(smiling)`, `(with sigh)`, `(whispering)`, `(to John)`, `(into phone)`)
 * versus spoken dialogue wrapped in parentheses (e.g. `(What do you think sir?)`,
 * `(Where are no suspects?)`, `(The suspect is girlfriend or wife.)`).
 */
export function isGenuineParenthetical(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return false;

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return false;

  // 1. Questions are NEVER actor directions; questions are dialogue spoken to another character
  if (inner.includes('?')) return false;

  // 2. Lines longer than 55 characters are speech or action paragraphs wrapped in parentheses
  if (inner.length > 55) return false;

  // 3. Known actor directions / delivery cues
  const directionRegex =
    /^(?:beat|pause|smiling|smiles|laughs?|laughing|crying|cries|sighs?|with\s+sigh|whispers?|whispering|sarcastic(?:ally)?|dryly|quietly|softly|shouting|screaming|firmly|angrily|confused|hesitant|calmly|nodding|shrugging|gasping|pointing.*|looks?.*|turns?.*|to\s+[a-z0-9\s'-]+|into\s+phone|on\s+phone|re:.*|o\.s\.|v\.o\.|cont'?d|continuing|filtered|in\s+[a-z]+|translated|subtitled|singing|humming|overlapping|interrupted|clears\s+throat|mutters?|muttering|winks?|winking|grins?|grinning|groans?|snickers?|chuckling|deadpan|mocking|pleading|tearful|mock-serious|under\s+breath|aside|simultaneous(?:ly)?)\b/i;

  if (directionRegex.test(inner)) return true;

  // 4. Conversational markers and sentence punctuation indicate spoken dialogue
  const conversationalSpeech =
    /\b(?:sir|ma'am|hello|hi|yes|no|yeah|nope|please|thanks|thank\s+you|what|where|how|who|why|when|i\b|i'm|i've|i'll|i'd|we\b|we're|we've|you\b|you're|you've|he\b|she\b|they\b|it\b|isn't|aren't|don't|can't|won't|police|officer|suspect|victim|car|house|money|kill|murder|suicide)\b/i;

  if (conversationalSpeech.test(inner)) return false;

  // 5. Short cues (< 30 chars) without sentences or quotes that look like actor directions
  if (inner.length <= 30 && !/[!?"']/.test(inner)) {
    return true;
  }

  return false;
}
