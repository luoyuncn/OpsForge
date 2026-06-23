import type { Step } from "@opsforge/dsl";
import type { CompiledCommand, HostFacts } from "@opsforge/executor-base";

const selectPackageManager = (facts: HostFacts): "winget" | "choco" => {
  if (facts.packageManagers.includes("winget")) return "winget";
  if (facts.packageManagers.includes("choco")) return "choco";
  throw new Error("No supported Windows package manager detected");
};

const packageCommand = (action: "install" | "remove", name: string, facts: HostFacts): CompiledCommand => {
  const pm = selectPackageManager(facts);
  if (pm === "winget") {
    const verb = action === "install" ? "install" : "uninstall";
    return { shell: "powershell", argv: ["winget", verb, "--id", name, "--silent"], needsElevation: true, describe: `${action === "install" ? "Install" : "Remove"} package ${name} with winget` };
  }

  const verb = action === "install" ? "install" : "uninstall";
  return { shell: "powershell", argv: ["choco", verb, name, "-y"], needsElevation: true, describe: `${action === "install" ? "Install" : "Remove"} package ${name} with choco` };
};

export const compileWindowsStep = (step: Step, facts: HostFacts): CompiledCommand => {
  switch (step.type) {
    case "package-update-cache":
      return { shell: "powershell", argv: ["winget", "source", "update"], needsElevation: false, describe: "Update winget sources" };
    case "package-install":
      return packageCommand("install", step.name, facts);
    case "package-remove":
      return packageCommand("remove", step.name, facts);
    case "service-enable":
      return { shell: "powershell", argv: ["Set-Service", "-Name", step.name, "-StartupType", "Automatic"], needsElevation: true, describe: `Enable service ${step.name}` };
    case "service-start":
      return { shell: "powershell", argv: ["Start-Service", "-Name", step.name], needsElevation: true, describe: `Start service ${step.name}` };
    case "service-stop":
      return { shell: "powershell", argv: ["Stop-Service", "-Name", step.name], needsElevation: true, describe: `Stop service ${step.name}` };
    case "service-status":
      return { shell: "powershell", argv: ["Get-Service", "-Name", step.name], needsElevation: false, describe: `Check service ${step.name}` };
    case "file-write":
      return { shell: "powershell", argv: ["Set-Content", "-LiteralPath", step.path, "-Value", step.content], needsElevation: true, describe: `Write file ${step.path}` };
    case "file-template":
      return { shell: "powershell", argv: ["Set-Content", "-LiteralPath", step.path, "-Value", step.template], needsElevation: true, describe: `Render template to ${step.path}` };
    case "shell":
      return { shell: "powershell", argv: step.cmd, needsElevation: false, describe: "Run PowerShell command" };
  }
};
