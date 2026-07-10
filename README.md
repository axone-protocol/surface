# Axone Surface

> ◌ governed situations - made readable

[![lint](https://img.shields.io/github/actions/workflow/status/axone-protocol/surface/lint-commits.yml?branch=main&label=lint&style=for-the-badge&logo=github)](https://github.com/axone-protocol/surface/actions/workflows/lint-commits.yml)
[![build](https://img.shields.io/github/actions/workflow/status/axone-protocol/surface/build.yml?branch=main&label=build&style=for-the-badge&logo=github)](https://github.com/axone-protocol/surface/actions/workflows/build.yml)

[![Built with Nix](https://img.shields.io/badge/Built_With-Nix-5277C3.svg?style=for-the-badge&logo=nixos&logoColor=white)](https://nixos.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883.svg?style=for-the-badge&logo=vuedotjs&logoColor=white)](https://vuejs.org/)

[![conventional commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg?style=for-the-badge&logo=conventionalcommits)](https://conventionalcommits.org)
[![contributor covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg?style=for-the-badge)](https://github.com/axone-protocol/.github/blob/main/CODE_OF_CONDUCT.md)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg?style=for-the-badge)](https://opensource.org/licenses/BSD-3-Clause)

_Axone Surface_ is the public interface to the [Axone protocol](https://axone.xyz).

It makes the protocol's laws, identities, capabilities, and on-chain acts
readable through an experiential web interface.

Surface presents Axone as a living system, connecting its doctrine with the
activity attested by the chain.

![Axone Surface](surface.webp)

## Development

### Local setup

Enter the development environment, install the dependencies, and start the development server.

```bash
nix develop
pnpm install
pnpm dev
```

### Validation

Run the project checks before submitting changes.

```bash
pnpm run check
pnpm run lint
pnpm run format:check
pnpm run test:unit
pnpm run test:e2e
pnpm run build
```

### Environment

The repository provides a [Nix](https://nixos.org/) development shell with the required tooling.

If you use direnv, run direnv allow once from the repository root.
