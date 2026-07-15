export type ErrorEvent = {
  service: string;
  message: string;
  stack: string;
  route: string;
  timestamp: string;
};

export type Incident = {
  id: string;
  fingerprint: string;
  status: 'investigating' | 'resolved' | 'failed';
  title: string;
  firstSeen: string;
  count: number;
  rca?: RCA;
};

export type AgentStep = {
  incidentId: string;
  index: number;
  type: 'thinking' | 'tool_call' | 'tool_result';
  tool?: string;
  input?: unknown;
  output?: string;
  text?: string;
};

export type RCA = {
  root_cause: string;
  confidence: number;
  suspect_commit: string;
  evidence: string[];
  /** Unified diff that `git apply` accepts (git-style a/,b/ paths, @@ hunks). Applied verbatim by the Phase-5 PR service. */
  proposed_patch: string;
  postmortem_md: string;
};
