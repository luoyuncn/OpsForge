export interface CompiledCommandLike {
  argv: string[] | string;
  shell: "bash" | "powershell";
  needsElevation: boolean;
  describe: string;
}
