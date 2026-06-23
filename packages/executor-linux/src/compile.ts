import type { Step } from "@opsforge/dsl";
import type { CompiledCommand, HostFacts } from "@opsforge/executor-base";

const selectPackageManager = (facts: HostFacts): "apt" | "dnf" | "yum" => {
  if (facts.packageManagers.includes("apt")) return "apt";
  if (facts.packageManagers.includes("dnf")) return "dnf";
  if (facts.packageManagers.includes("yum")) return "yum";
  throw new Error("No supported Linux package manager detected");
};

const packageCommand = (action: "install" | "remove" | "update-cache", name: string | undefined, facts: HostFacts): CompiledCommand => {
  const pm = selectPackageManager(facts);
  if (action === "update-cache") {
    const argv = pm === "apt" ? ["apt-get", "update"] : [pm, "makecache"];
    return { shell: "bash", argv, needsElevation: true, describe: `Update package cache with ${pm}` };
  }

  const verb = action === "install" ? "install" : "remove";
  const argv = pm === "apt" ? ["apt-get", verb, "-y", name ?? ""] : [pm, "-y", verb, name ?? ""];
  return { shell: "bash", argv, needsElevation: true, describe: `${action === "install" ? "Install" : "Remove"} package ${name} with ${pm}` };
};

export const compileLinuxStep = (step: Step, facts: HostFacts): CompiledCommand => {
  switch (step.type) {
    case "package-update-cache":
      return packageCommand("update-cache", undefined, facts);
    case "package-install":
      return packageCommand("install", step.name, facts);
    case "package-remove":
      return packageCommand("remove", step.name, facts);
    case "service-enable":
      return { shell: "bash", argv: ["systemctl", "enable", step.name], needsElevation: true, describe: `Enable service ${step.name}` };
    case "service-start":
      return { shell: "bash", argv: ["systemctl", "start", step.name], needsElevation: true, describe: `Start service ${step.name}` };
    case "service-stop":
      return { shell: "bash", argv: ["systemctl", "stop", step.name], needsElevation: true, describe: `Stop service ${step.name}` };
    case "service-status":
      return { shell: "bash", argv: ["systemctl", "status", step.name], needsElevation: false, describe: `Check service ${step.name}` };
    case "file-write":
      return { shell: "bash", argv: ["tee", step.path], needsElevation: true, describe: `Write file ${step.path}` };
    case "file-template":
      return { shell: "bash", argv: ["tee", step.path], needsElevation: true, describe: `Render template to ${step.path}` };
    case "shell":
      return { shell: step.shell ?? "bash", argv: step.cmd, needsElevation: false, describe: "Run shell command" };
  }
};
