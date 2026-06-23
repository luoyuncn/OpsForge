# install-nodejs

Deterministic OpsForge skill template for installing Node.js on the local machine.

## DSL Skeleton

- prechecks: `os-detect`, `privilege-check`
- steps: `package-update-cache`, `package-install nodejs`
- verifications: `package-version nodejs`, `smoke-test node --version`
- rollback: `package-remove nodejs`
- risk: `L1`

This template is a planning skeleton only. Execution still goes through policy, guard, executor, verifier, rollback, and audit.
