# Axone Surface

> ◌ governed situations - made readable

[![lint](https://img.shields.io/github/actions/workflow/status/axone-protocol/axone-surface/lint-commits.yml?branch=main&label=lint&style=for-the-badge&logo=github)](https://github.com/axone-protocol/axone-surface/actions/workflows/lint-commits.yml)

[![Built with Nix](https://img.shields.io/badge/Built_With-Nix-5277C3.svg?style=for-the-badge&logo=nixos&logoColor=white)](https://nixos.org/)
[![conventional commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=for-the-badge&logo=conventionalcommits)](https://conventionalcommits.org)
[![contributor covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg?style=for-the-badge)](https://github.com/axone-protocol/.github/blob/main/CODE_OF_CONDUCT.md)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg?style=for-the-badge)](https://opensource.org/licenses/BSD-3-Clause)

## Getting Started

```bash
nix develop
pnpm install
pnpm dev
```

## Checks

```bash
pnpm run check
pnpm run lint
pnpm run format:check
pnpm run test:unit
pnpm run test:e2e
pnpm run build
```

## Nix

The Nix shell provides the base development environment for this project. If
you use `direnv`, run `direnv allow` once in the repository.
