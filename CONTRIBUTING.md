# Contributing to CMPAS

Thank you for your interest in improving CMPAS.

## Getting started
- Python 3.10+
- Create a virtualenv and install deps:
  ```bash
  python -m venv venv
  source venv/bin/activate # Windows: .\\venv\\Scripts\\Activate.ps1
  pip install -r requirements.txt
  ```
- Run dev server:
  ```bash
  uvicorn app.main:app --reload
  ```
- Run tests:
  ```bash
  pytest
  pytest --cov=app tests/
  ```

## Branching and PRs
- Branch from `main` using `feature/<short-name>` or `fix/<short-name>`.
- Keep PRs small and focused; include context: problem, solution, testing notes.
- Link related issues.

## Commit messages (Conventional Commits)
Use the minimal set: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`.
- Examples:
  - `feat(auth): email OTP flow for WebApp`
  - `fix(rate-limit): tighten burst on /api/v1/auth/*`
  - `docs(readme): update MVP scope`

## Code style & quality
- Follow PEP8; prefer type hints.
- If formatters/linters are configured (e.g. black/ruff), run them before committing.
- Add/extend tests for new behavior (see `tests/`).

## Security & privacy
- Do not commit secrets or `.env` files.
- Minimize personal data in fixtures/logs; follow 152‑ФЗ principles.

## Release process
- Update `CHANGELOG.md` (Unreleased → new version) and bump version markers where applicable.
- Ensure README reflects any user-facing changes.
