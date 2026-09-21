// Next-message feedback detector for pending coach memory (spec section 6):
// a PENDING entry becomes CONFIRMED when the user's NEXT message does not
// correct or dismiss it, and is deleted when it does.
//
// The rule is deliberately dumb, deterministic and CONSERVATIVE, in the same
// spirit as the crisis classifier:
//
//   * The message is lower-cased, curly apostrophes are straightened and
//     whitespace collapsed.
//   * It is a 'dismiss' (correction or dismissal) if it contains ANY whole-word
//     negation / correction / retraction cue from CUES below, or if it is empty.
//   * Otherwise it is a 'confirm'.
//
// So doubt resolves to 'dismiss', and 'dismiss' deletes the entry. That fails
// closed: the worst case is a wanted memory being dropped (the model can
// propose it again, or the user can add it back), never an unwanted or wrong
// one being persisted. Bare negations ("not", "no") are cues even when they are
// about something else entirely ("why is my score not higher"); that
// over-triggering is the accepted price of never having to guess.

const CUES = [
  'no', 'nope', 'nah', 'not', 'never', 'wrong', 'incorrect', 'inaccurate', 'untrue', 'false',
  'actually', 'instead', 'rather', 'mistake', 'mistaken', 'misunderstood', 'misheard', 'meant',
  'correct', 'correction', 'change', 'changed', 'changes', 'changing',
  'forget', 'forgot', 'remove', 'delete', 'erase', 'undo', 'ignore', 'disregard', 'discard', 'cancel',
  'stop', 'wait', 'scratch', 'nvm', 'nevermind',
  "isn't", "wasn't", "aren't", "don't", "doesn't", "didn't", "won't", "can't", 'cannot',
  'isnt', 'wasnt', 'arent', 'dont', 'doesnt', 'didnt', 'wont', 'cant',
];

const CUE_RE = new RegExp(`(?<![\\p{L}\\p{N}'])(${CUES.join('|')})(?![\\p{L}\\p{N}'])`, 'u');

export type MemoryFeedback = 'confirm' | 'dismiss';

export function classifyMemoryFeedback(message: string): MemoryFeedback {
  const text = message.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
  if (text.length === 0) return 'dismiss';
  return CUE_RE.test(text) ? 'dismiss' : 'confirm';
}
