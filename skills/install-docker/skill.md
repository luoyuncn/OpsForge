# install-docker

Deterministic OpsForge skill template for installing Docker on the local machine.

## DSL Skeleton

- prechecks: `os-detect`, `privilege-check`
- steps: `package-update-cache`, `package-install docker`, `service-enable docker`, `service-start docker`
- verifications: `package-version docker`, `service-status docker active`, `process-alive docker`
- rollback: `service-stop docker`, `package-remove docker`
- risk: `L1`

This template is a planning skeleton only. Execution still goes through policy, guard, executor, verifier, rollback, and audit.
