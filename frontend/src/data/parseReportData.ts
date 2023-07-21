export const parseReportData = (lines: any[]): ReportData => {
  const runInfoData = lines[0] as RunInfo;
  const implementationEntries = Object.entries(runInfoData.implementations) as [
    string,
    ImplementationMetadata,
  ][];

  implementationEntries.sort(([id1], [id2]) => id1.localeCompare(id2));
  const caseMap = new Map() as Map<number, Case>;
  const implementationMap = new Map() as Map<string, ImplementationData>;
  implementationEntries.forEach(([id, metadata]) =>
    implementationMap.set(id, {
      id,
      metadata,
      cases: new Map(),
      erroredCases: 0,
      skippedTests: 0,
      unsuccessfulTests: 0,
      erroredTests: 0,
    }),
  );

  let didFailFast = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.case) {
      caseMap.set(line.seq, line.case as Case);
    } else if (line.implementation) {
      const caseData = caseMap.get(line.seq)!;
      const implementationData = implementationMap.get(line.implementation)!;
      if (line.caught !== undefined) {
        const errorMessage = line.context?.message ?? line.context?.stderr;
        implementationData.erroredCases++;
        implementationData.erroredTests += caseData.tests.length;
        implementationData.cases.set(
          line.seq,
          new Array(caseData.tests.length).fill({
            state: "errored",
            message: errorMessage,
          }),
        );
      } else if (line.skipped) {
        implementationData.skippedTests += caseData.tests.length;
        implementationData.cases.set(
          line.seq,
          new Array(caseData.tests.length).fill({
            state: "skipped",
            message: line.message,
          }),
        );
      } else if (line.implementation) {
        const caseResults = (line.results as any[]).map<CaseResult>(
          (res, idx) => {
            if (res.errored) {
              const errorMessage = res.context?.message ?? res.context?.stderr;
              implementationData.erroredTests++;
              return { state: "errored", message: errorMessage };
            } else if (res.skipped) {
              implementationData.skippedTests++;
              return { state: "skipped", message: res.message };
            } else {
              const successful = res.valid === caseData.tests[idx].valid;
              if (successful) {
                return { state: "successful", valid: res.valid };
              } else {
                implementationData.unsuccessfulTests++;
                return { state: "failed", valid: res.valid };
              }
            }
          },
        );
        implementationData.cases.set(line.seq, caseResults);
      } else if (line.did_fail_fast !== undefined) {
        didFailFast = line.did_fail_fast;
      }
    }
  }

  const totalTests = Array.from(caseMap.values()).reduce(
    (prev, curr) => prev + curr.tests.length,
    0,
  );
  const totals = Array.from(implementationMap.values()).reduce(
    (prev, curr) => ({
      erroredCases: prev.erroredCases + curr.erroredCases,
      skippedTests: prev.skippedTests + curr.skippedTests,
      unsuccessfulTests: prev.unsuccessfulTests + curr.unsuccessfulTests,
      erroredTests: prev.erroredTests + curr.erroredTests,
    }),
    {
      erroredCases: 0,
      skippedTests: 0,
      unsuccessfulTests: 0,
      erroredTests: 0,
    },
  );

  return {
    runInfo: runInfoData,
    cases: caseMap,
    implementations: implementationMap,
    totalTests: totalTests,
    erroredCases: totals.erroredCases,
    skippedTests: totals.skippedTests,
    unsuccessfulTests: totals.unsuccessfulTests,
    erroredTests: totals.erroredTests,
    didFailFast: didFailFast,
  };
};

interface ReportData {
  runInfo: RunInfo;
  cases: Map<number, Case>;
  implementations: Map<string, ImplementationData>;
  totalTests: number;
  erroredCases: number;
  skippedTests: number;
  unsuccessfulTests: number;
  erroredTests: number;
  didFailFast: boolean;
}

interface RunInfo {
  started: string;
  bowtie_version: string;
  dialect: string;
  implementations: Record<string, ImplementationMetadata>;
  metadata: any;
}

interface ImplementationData {
  id: string;
  metadata: ImplementationMetadata;
  cases: Map<number, CaseResult[]>;
  erroredCases: number;
  skippedTests: number;
  unsuccessfulTests: number;
  erroredTests: number;
}

interface CaseResult {
  state: "successful" | "failed" | "skipped" | "errored";
  valid?: boolean;
  message?: string;
}

interface ImplementationMetadata {
  language: string;
  name: string;
  version?: string;
  dialects: string[];
  homepage?: string;
  issues: string;
  links?: {
    description?: string;
    url?: string;
    [k: string]: unknown;
  }[];
  os?: string;
  os_version?: string;
  language_version?: string;

  [k: string]: unknown;
}

interface Case {
  description: string;
  comment?: string;
  schema: {
    [k: string]: unknown;
  };
  registry?: {
    [k: string]: unknown;
  };
  tests: [Test, ...Test[]];
}

export interface Test {
  description: string;
  comment?: string;
  instance: any;
  valid?: boolean;
}