# Contributing

Open a pull request against `main` for changes. Contributors must wait for an
approval from the repository's code owner, currently **@alpercandemir**, before
merging. Approvals from unrelated GitHub accounts do not satisfy this requirement.

The protected branch requires the `ci` check to pass against an up-to-date branch
and all review conversations to be resolved. New commits dismiss existing
approvals, and the most recent push requires another person's approval. Force
pushes and branch deletion are disabled.

The repository owner retains the administrator override for owner-authored pull
requests, which GitHub does not allow the author to approve. Use this override
only with the owner's authorization and after CI passes. Other contributors
must obtain code-owner approval; do not bypass review requirements.

Run `npm test` and `npm run build` locally. Run the production browser checks with
`npm run test:e2e` after installing Playwright's Chromium browser. See the
[README](README.md) for optional Geoapify configuration and local setup.
