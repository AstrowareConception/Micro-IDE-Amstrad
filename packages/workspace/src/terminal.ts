/** Human-operated host commands. Deliberately absent from agent tool contracts. */
export interface TerminalResult {
  id: string; command: string; state: 'running' | 'completed' | 'stopped';
  output: string; exitCode: number | null; reason: string;
}
export interface TerminalPort {
  run(sessionId: string, command: string): Promise<TerminalResult | { error: string } | null>;
  status(sessionId: string, id: string): Promise<TerminalResult | { error: string }>;
  stop(sessionId: string, id: string): Promise<TerminalResult | { error: string }>;
}
