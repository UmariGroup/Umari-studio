type PromptSafetyResult = {
  allowed: boolean;
  reason?: string;
  hit?: string;
};

const EXPLICIT_PATTERNS: RegExp[] = [
  /\b(18\+|adult|porn|porno|pornography|nsfw|nude|nudity|naked|erotic|sexual?|hentai|onlyfans|camgirl|blowjob|handjob|anal|vagina|penis|boobs?|breasts?|nipples?)\b/i,
  /(порно|порнография|секс|эротик|обнажен|обнаж[её]н|гол(ый|ая|ые)|нюд|интим|хентай)/i,
  /(pornograf|yalang'?och|jinsiy|erotik|intim|kattalar\s*uchun|18\+)/i,
];

function normalizeText(input: string): string {
  return String(input || '').trim().replace(/\s+/g, ' ');
}

export function checkImagePromptSafety(prompt: string): PromptSafetyResult {
  const text = normalizeText(prompt);
  if (!text) {
    return { allowed: true };
  }

  for (const pattern of EXPLICIT_PATTERNS) {
    const match = pattern.exec(text);
    if (match?.[0]) {
      return {
        allowed: false,
        reason: '18+ yoki pornografik mazmun taqiqlangan',
        hit: match[0],
      };
    }
  }

  return { allowed: true };
}
