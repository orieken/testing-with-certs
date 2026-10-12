# Plain-language writing guide

Use this guide with the [project terminology dictionary](project-terminology.md).
The target is approximately 80% ASD-STE100-inspired writing, with necessary software terms retained.
This target is a project preference. It is not a measured compliance percentage.

The official standard includes writing rules and a controlled dictionary.
See the [official explanation](https://www.asd-ste100.org/STE_faq.html) and
[ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf).
Our terminology dictionary supplements those sources for this software project.
It does not declare every listed word an ASD-approved word.

## Write for the reader's task

Start with the purpose or result. Explain the details in the order the reader needs them.
Give each paragraph one main subject. Use a table for comparable terms or choices.
Use a numbered list for ordered actions.

Use the preferred project terms consistently. Explain an abbreviation at its first use in a standalone document.
Keep necessary technical names. Explain them instead of replacing them with a vague word.
Use “start” instead of “commence” or “initiate” in ordinary instructions.

## Sentence rules

- Prefer active voice with a named actor: “The API checks the access token.”
- Aim for no more than 20 words in an instruction sentence.
- Aim for no more than 25 words in a descriptive sentence.
- Give one instruction in each sentence.
- Put a necessary condition before its action: “If Docker is available, start the lab.”
- Keep a term's meaning consistent throughout the document.
- Keep negative conditions explicit when a check must reject an input.

These are writing targets for our prose. Commands, exact errors, identifiers, and source quotations may need different treatment.
Do not remove an important condition to meet a word limit.
Split the sentence or define the technical term instead.

## Preserve technical facts

Keep commands, paths, flags, versions, hashes, ports, origins, client names, and contract fields exact.
Do not rewrite a command as prose inside a copyable command block.
State the directory where the reader must run a command.
State the required environment and the expected result.
Link the complete procedure when a short guide omits setup or cleanup details.

Keep these boundaries explicit when they matter:

- The shop requires certificate-only login.
- The separate lesson requires both certificate and password.
- TLS verification, PKCE, certificate identity checks, and API authorization remain active.
- Mock authentication does not reach real business APIs.
- Mock results do not prove real login or real-provider behavior.
- Keys, secrets, and browser profiles stay in the prescribed container storage.

These statements describe existing boundaries. A documentation edit does not authorize a behavior change.

## Describe test evidence precisely

State what is under test and what is replaced.
State the expected result and the observed result separately.
Name the suite and environment. Link the completion note with exact commands and versions.
Keep local emulation and native Linux results distinct.
Describe a known limitation as a limitation, even when its probe passes.
Do not convert a planned test into an observed result during editing.

Use this structure for a short example explanation:

1. **Purpose:** the question the example answers.
2. **Replacement:** the dependency that the test substitutes or disturbs.
3. **Command:** the exact command and required setup.
4. **Expected result:** the checks and output the reader should expect.
5. **Evidence:** the observed run and its source.
6. **Limit:** what the result does not prove.
7. **Cleanup:** the normal cleanup and the linked recovery procedure.

## Use Mermaid when it helps

Use a flowchart for system parts or test boundaries.
Use a sequence diagram when request order matters.
Explain arrow meanings and any shortened paths after the diagram.
Keep real-system and mock-system boundaries visible.
Do not show a mocked connection as a real authentication path.
Render new or changed diagrams in the existing pinned container workflow before you finish.

See the [plain-language guides](plain-language/README.md) for examples.
The diagram tooling is in [the rendering wrapper](../infra/render-diagrams.sh).
That wrapper currently extracts diagrams from architecture and workflows documents.
Other documents need explicit extraction to a separate artifact directory before rendering.

## Examples of a rewrite

| Before | After |
| --- | --- |
| Authentication ensures the user can edit inventory. | Keycloak checks user identity. The catalog API checks permission to edit inventory. |
| The mock validates our login system. | The mock test checks the dedicated consumer. It does not prove real Keycloak login. |
| Credentials are persisted securely. | Private keys and secrets stay in Docker volumes. Browser profiles also stay in Docker volumes. |
| The regional boundary suite fully supports timestamp precision. | The suite records the timestamp precision limitation. The affected request still returns the documented failure. |
| Reports were uploaded successfully, so CI passed. | Report upload succeeded. The final gate still requires every required test job to succeed. |
| The certificate grants API access. | The certificate identifies the client. The API also checks the access token, permissions, and identity match. |

## Convert documents in small groups

First, revise the introductory guides and procedures used by learners.
Then, revise current architecture, authentication, API, and test explanations.
Retain historical completion notes as records of the original run.
Add a dated clarification when historical wording conflicts with later evidence.
Do not silently rewrite an old observation into a new result.

Keep canonical contracts and generated documents outside prose-only conversion.
Keep exact agent commands and acceptance criteria when revising adoption prompts.
Preserve earlier source-reference examples and identify their status.

This guide establishes the conversion approach. It does not mean all existing documents have been converted.

## Review before completion

- Can a new reader identify the purpose and required action?
- Are important terms defined and used consistently?
- Are identity checks separate from permission checks?
- Are commands and technical identifiers unchanged?
- Are mock, fault, live-provider, and real-login evidence distinguished?
- Are observed results separate from plans and known limitations?
- Are instructions short, ordered, and complete enough to execute?
- Do local links resolve and Mermaid diagrams render?
- Does the rewrite preserve the original security and data boundaries?

Review meaning before sentence length. A readability check alone cannot establish ASD-STE100 compliance.
