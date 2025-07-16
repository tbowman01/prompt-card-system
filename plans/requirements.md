# Prompt Card System MVP — Requirements

## Functional Requirements

- **Prompt Card CRUD**
  - Users can create, read, update, and delete prompt cards.
  - Each card includes:
    - Title
    - Prompt template (with variables)
    - Description

- **Test Case Management**
  - Users can add, edit, and remove test cases for each prompt card.
  - Each test case specifies input variables and expected assertions (e.g., output contains a phrase).

- **Prompt Testing**
  - Users can run prompt cards (with all test cases) against a local LLM via Ollama.
  - Results display LLM outputs and pass/fail status for each test case and assertion.

- **Promptfoo Integration**
  - System uses [Promptfoo](https://github.com/promptfoo/promptfoo) evaluation engine in the backend for automated prompt testing and assertions.

- **YAML Import/Export**
  - Users can import prompt cards and test cases from a Promptfoo-compatible YAML format.
  - Users can export prompt cards/tests to YAML.

- **Results Visualization**
  - Test results are presented in a readable UI with pass/fail summary and output details for each test.

- **Documentation and Examples**
  - A README includes setup, usage, and example prompt cards.

---

## Non-Functional Requirements

- **Self-hosted MVP**
  - All services run locally via Docker Compose (Next.js frontend, Node.js backend, SQLite, Ollama LLM).

- **Performance**
  - Test runs should complete within reasonable time on a developer machine using a local model (some slowness with large models is acceptable).

- **Usability**
  - UI is developer-friendly, clean, and functional.
  - Provides clear error messages and validation for user actions.

- **Extensibility**
  - System is designed for easy addition of new models, providers, or features (e.g., multi-model support, CI integration).

- **Portability**
  - System can be cloned and run via `docker-compose up` with minimal manual steps.

- **Security**
  - No external access or authentication required for MVP; local use only.

---

## Assumptions

- **Team size:** 1–3 developers.
- **Timeline:** 30 days for MVP.
- **Deployment:** MVP is for local use, not production/cloud.
- **LLM Models:** Only free, locally-hosted models (e.g., via Ollama) are in scope.
- **Promptfoo:** Used as a library in backend for prompt testing.
- **Users:** Target audience is developers; minimal onboarding/help is provided.
- **Resources:** Docker and Docker Compose are available; user has sufficient RAM for selected LLM model.

