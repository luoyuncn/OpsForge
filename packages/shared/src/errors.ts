/** OpsForge base error with a stable code for auditing and branching. */
export class OpsForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "OpsForgeError";
  }
}
