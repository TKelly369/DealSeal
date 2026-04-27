type RuleInference = { key: string; value: string | number | boolean; confidence: number };

function inferDocFee(text: string): RuleInference[] {
  const m = text.match(/\$?(\d{2,4})/);
  if (!m) return [];
  return [{ key: "docFee", value: Number(m[1]), confidence: 0.82 }];
}

export function processDealerOnboarding(step: string, answers: Record<string, unknown>) {
  const serialized = JSON.stringify(answers).toLowerCase();
  const inferences: RuleInference[] = [];
  if (serialized.includes("doc fee")) {
    inferences.push(...inferDocFee(serialized));
  }
  if (serialized.includes("e-sign") || serialized.includes("esign")) {
    inferences.push({ key: "signingMethod", value: "E_SIGN", confidence: 0.88 });
  }
  return {
    step,
    normalized: answers,
    inferences,
  };
}

export function processLenderOnboarding(step: string, answers: Record<string, unknown>) {
  const serialized = JSON.stringify(answers).toLowerCase();
  const inferences: RuleInference[] = [];
  if (serialized.includes("ltv")) {
    const m = serialized.match(/(\d{2,3})\s*%/);
    if (m) {
      inferences.push({ key: "maxLtvPercent", value: Number(m[1]), confidence: 0.9 });
    }
  }
  if (serialized.includes("required clause")) {
    inferences.push({ key: "requiredClauseSet", value: true, confidence: 0.76 });
  }
  return {
    step,
    normalized: answers,
    inferences,
  };
}
