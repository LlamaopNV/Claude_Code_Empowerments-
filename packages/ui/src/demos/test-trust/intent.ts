/**
 * Act 2 of the test-trust demo: "a failing test can be the wrong one."
 *
 * Models the ambiguous-failing-test trap that the `dont-just-make-it-green`
 * skill addresses: a test
 * whose NAME ("free shipping over 50") contradicts its ASSERTION
 * (`shippingFee(50) === 0`). The intended boundary is genuinely unknown, so any
 * fix that just makes the suite green is a guess — only establishing intent is
 * safe.
 */

export interface CandidateRule {
  id: 'inclusive' | 'exclusive';
  label: string;
  meaning: string;
  fixes: string;
}

export type ResolutionId = 'guess-code-gte' | 'guess-test-51' | 'confirm-intent';

export interface Resolution {
  id: ResolutionId;
  label: string;
  action: string;
  safe: boolean;
  verdict: string;
}

export interface IntentScenario {
  functionName: string;
  code: string;
  test: { name: string; call: string; expected: string };
  contradiction: string;
  candidates: CandidateRule[];
  resolutions: Resolution[];
}

export const SHIPPING_INTENT_SCENARIO: IntentScenario = {
  functionName: 'shippingFee',
  code: 'function shippingFee(total: number) {\n  if (total > 50) return 0;\n  return 5;\n}',
  test: { name: 'free shipping over 50', call: 'shippingFee(50)', expected: '0' },
  contradiction:
    'The test NAME says "over 50" (which reads as strictly greater), but the ASSERTION wants 50 itself to ship free. The test disagrees with itself — so it cannot tell you the intended rule.',
  candidates: [
    {
      id: 'inclusive',
      label: '>= 50  (50 ships free)',
      meaning: 'Free shipping at $50 and above. The test assertion is right; the code is wrong.',
      fixes: 'Change the code: total > 50  →  total >= 50.',
    },
    {
      id: 'exclusive',
      label: '> 50  (50 pays)',
      meaning: 'Free shipping only above $50. The code is right; the test assertion is wrong.',
      fixes: 'Change the test: shippingFee(50) → shippingFee(51), and fix its name.',
    },
  ],
  resolutions: [
    {
      id: 'guess-code-gte',
      label: 'Flip the code to >= 50',
      action: 'Edit production code so the failing test passes.',
      safe: false,
      verdict:
        'Unsafe. You picked the inclusive rule because it makes the suite green, not because anyone confirmed it. If the real rule was "over 50", you just shipped a revenue bug with a passing check on top.',
    },
    {
      id: 'guess-test-51',
      label: 'Change the test to shippingFee(51)',
      action: 'Edit the test so the current code passes.',
      safe: false,
      verdict:
        'Unsafe — same trap, other direction. You blessed the current code as correct. If the real rule was "50 ships free", you just deleted the one test that was catching the bug.',
    },
    {
      id: 'confirm-intent',
      label: 'Stop and confirm the intended rule',
      action: 'Name both candidate rules; check the ticket/spec or ask the owner; only then change the artifact that disagrees with intent.',
      safe: true,
      verdict:
        'Safe. A failing test is a question. Once the authority (ticket → spec → human) says whether $50 ships free, exactly one artifact is wrong and the fix is mechanical — and correct.',
    },
  ],
};

export function isSafeResolution(id: ResolutionId): boolean {
  return SHIPPING_INTENT_SCENARIO.resolutions.find((r) => r.id === id)?.safe ?? false;
}

export function safeResolutions(): Resolution[] {
  return SHIPPING_INTENT_SCENARIO.resolutions.filter((r) => r.safe);
}
