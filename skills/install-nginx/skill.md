# install-nginx

Deterministic OpsForge skill template for installing nginx on the local machine.

## DSL Skeleton

- prechecks: `os-detect`, `privilege-check`
- steps: `package-update-cache`, `package-install nginx`, `service-enable nginx`, `service-start nginx`
- verifications: `package-version nginx`, `service-status nginx active`, `process-alive nginx`
- rollback: `service-stop nginx`, `package-remove nginx`
- risk: `L1`

This template is a planning skeleton only. Execution still goes through policy, guard, executor, verifier, rollback, and audit.
