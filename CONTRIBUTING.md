# Contributing

Thank you for helping with Vue Privacy. Issues and pull requests are welcome at <https://github.com/structured-world/vue-privacy>.

## Contributor License Agreement

Before a first pull request can be merged, you sign the Structured World Contributor License Agreement once, at <https://sw.foundation/cla>. It covers every repository of the organisation and takes a minute: sign in with GitHub, confirm your e-mail address, sign. The `CLA` status on your pull request then turns green by itself.

You keep the copyright in your contribution. If you contribute as part of your job, your employer may also need to sign the corporate agreement; the page above explains when.

## Setup

The project uses Yarn 4 (through Corepack) and Node.js 22.12 or newer.

```bash
corepack enable
yarn install --immutable
```

## Checks

A pull request merges once these pass on a branch that is up to date with `main`; run them locally first:

```bash
yarn lint
yarn typecheck
yarn build
yarn test --coverage
yarn docs:build
```

A bug fix comes with a test that fails without the fix. Behaviour, options and API changes update the documentation under `docs/` and the README in the same pull request.

## Commits and pull requests

Pull requests are squash-merged, so the pull request title becomes the commit on `main` and drives the release. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): ...`, `fix(scope): ...`, `docs: ...`, and `!` after the type for a breaking change (`feat!: ...`). Reference the issue in the description (`Closes #123`).

Every review thread is resolved before the pull request merges.

## Security issues

Do not open a public issue for a vulnerability; see [SECURITY.md](SECURITY.md).
