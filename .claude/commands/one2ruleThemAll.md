## **One Prompt to rule them all**

This is a meta-prompt designed for an advanced AI assistant (or an LLM orchestrator) that manages coding tasks as a *project manager, code reviewer, and developer all in one*. Its aim is to **systematically produce flawless, production-ready code** that matches a user's exact requirements.

It does this by:

* Breaking work into *atomic subtasks* (using subagents in parallel)
* Rigorous *self-assessment* and *iteration* until perfect (100/100) quality is reached
* *Verifying* all work at every step, with explicit *success criteria*

---

## **Key Instructions and Workflow**

### 1. **Core Objectives**

* **Understand the user's intent:** Don’t start coding until you’re sure what’s wanted (ask clarifying questions).
* **Deliver high quality code:** Must be production-ready, efficient, maintainable, best-practices.
* **Achieve perfection:** Iterate until the work gets a perfect 100/100 quality score by self-assessment.

### 2. **Process for Task Execution**

#### **Step 1: Task Analysis**

* Read and analyze the user’s request, spot requirements and edge cases.
* Ask questions if anything is unclear.
* Write down how to measure success (what does “done” look like).

#### **Step 2: Parallel Subagent Delegation**

* Break the work into **atomic subtasks** (as small and independent as possible).
* Assign each subtask to a *subagent* working in parallel.
* Each subagent gets:

  * Task description
  * Context (relevant code, requirements)
  * Explicit success criteria (inputs/outputs, examples)
* **Isolation**: Each subagent works in its own “bubble” to prevent overlap.

#### **Step 3: Implementation**

* Subagents code their part, following best practices and code standards.
* Comments for complex logic, edge cases covered, performance considered.
* Output is wrapped in a custom tag (`<xaiArtifact>`), with UUID, title, and content type.

#### **Step 4: Quality Assurance & Iterative Improvement**

* **Self-check:** Each subagent reviews its work against requirements.
* **Score (1–100):** Functionality, code quality, performance, and alignment with user intent.
* **Iterate if not perfect:** If <100, list issues/gaps, spawn new subagents to fix, and verify again.
* **Verification subagent** checks each fix and ensures no regressions.
* Repeat until all work is 100/100.

#### **Step 5: Final Delivery**

* Merge all subtask outputs into a *single artifact*.
* Document the changes and improvement summary.
* Present the code, quality score, and a note that requirements are fully met.

---

## **Example Workflow**

For a sample request (“sort a list of integers”), the prompt:

* Decomposes into subagents (sorting, edge cases, optimization)
* Each one codes and tests its part
* If an edge case is missed, a fix subagent is created
* All code and improvements are tracked, and the final output is a single artifact

---

## **Constraints and Special Instructions**

* **Context is always preserved** across all agents/iterations.
* **Don’t reference the artifact tag outside the code output.**
* **UUID usage**: consistent within an artifact, new ones for unrelated tasks.
* **Special guidelines** for certain languages (Python, React, LaTeX, etc.).
* **Relentless iteration:** Don’t stop until it’s perfect.

---

## **Strengths of the Prompt**

* **Explicit, systematic process:** Clear “assembly line” for producing and refining code.
* **Parallelism:** Subagents can work independently, which (theoretically) speeds up delivery and isolates issues.
* **Automated code review:** QA and iterative improvement are part of the loop, so mistakes don’t go undetected.
* **Success criteria always explicit:** No ambiguity about what’s expected.
* **Promotes maintainable, production-quality code:** Follows best practices and documentation.

---

## **Potential Gaps and Considerations**

* **Requires subagent orchestration:** Real LLM systems may not *natively* support parallel subagents, so this prompt works best in an agentic framework (e.g., CrewAI, CrewAI, or similar).
* **Very “rigid” workflow:** While great for safety and reliability, it could be slow or verbose for simple tasks.
* **Human feedback not part of the loop:** There is no checkpoint where the user reviews partial progress before the final artifact.
* **Relies on perfect context tracking:** Which some current LLM stacks may struggle with for complex, multi-step tasks.
* **Heavy on boilerplate:** The output format, UUIDs, artifact tags, etc., are specialized and may require custom handling.

---

## **When to Use This Prompt**

* When you want **high assurance**, “zero-bug” code generation.
* For production, regulated, or mission-critical code tasks.
* For agentic LLM frameworks that *do* support parallelism and context management.
* For onboarding new contributors to a strict codebase.

---

## **Summary Table**

| Feature                       | Strengths                                    | Considerations                             |
| ----------------------------- | -------------------------------------------- | ------------------------------------------ |
| Task Decomposition            | Catches all requirements, parallel execution | May be overkill for trivial tasks          |
| Iterative Perfection          | Ensures quality, self-improvement            | Could be verbose                           |
| Explicit Success Criteria     | Prevents ambiguity, measurable goals         | May require user to clarify a lot          |
| Subagent Isolation            | Avoids conflicts, clearer debugging          | Needs agentic infra or simulation          |
| Code Review & Verification    | Bugs/edge cases addressed before delivery    | QA step can be time-consuming              |
| Output Formatting (Artifacts) | Good for automation, traceability            | Specialized tags/UUIDs may not be standard |



**Let me know if you want this evaluated for a specific tool or LLM, or if you want advice on how to adapt/simplify it for a single-agent context!**