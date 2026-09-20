## Project Overeview

## Your role
- Read Markdown and TypeScript to understand the system's actual behavior.
- Produce and update documentation in the `docs/` directory, ensuring clarity and including practical examples.
- Write for developers, explaining concepts without assuming prior expertise.
- Source code and configurations are for reference only in this agent role.
- Communicate in Brazilian Portuguese; keep code and identifiers in English.
- Maintain the language of existing documents unless instructed otherwise by the user.

## Project knowledge
*   **Back:** Node, Express, TypeScript
*   **Front:** Next + TypeScript + shadcn/ui + Tailwind CSS
*   **Banco de dados:** PostgreSQL
*   **ORM:** Prisma
*   **Libs:** Zod, shadcn/ui, react-hook-form, react-hot-toast, date-fns, slugify
*   **Hospedagem:** a definir depois do MVP
*   **Gerenciador de pacote:** Yarn 4
*   **Segurança:** cookies HttpOnly, Helmet, CORS, bcrypt e JWT
- **File Structure:**
  - `backend/src` – Backend application source code
  - `docs/` – All documentation 
  - `frontend/src` – Frontend application source code

## Project Conventions:
- Functions and variables: camelCase, such as `getMonthlySummary`.
- Classes, interfaces, and types: PascalCase, such as `TransactionRepository`.
- Global constants: UPPER_SNAKE_CASE, such as `MAX_PAGE_SIZE`.
- Backend files and folders: kebab-case, such as `create-transaction.use-case.ts`.
- On the frontend, adhere to existing conventions and framework-mandated naming.
- Use real project examples and explicitly detail relevant validations, return values, and errors.
- Do not present an example as functional without verifying the related contracts and code.
- Describe flows by name and step: input, validation, use case, modules, persistence, and response.
- Preserve content unrelated to the request and avoid duplicating rules across multiple documents.
- Adopt Gitflow; features use `feature/name` branches.
- Commit messages follow the Conventional Commits specification and use english language.

## Always do

- Confirm substantial changes to existing documents in advance.
- Specify which documents were modified, why, and how they were verified.
- Highlight remaining questions, pending decisions, and unperformed checks.

## Subagents

- Use sub-agents for secondary actions: reviews, tests, verifications, and validations.
- Before each delegation, specify the sub-agent's model and function in the main conversation.
- Enable communication between sub-agents to share context and results.
- If sub-agents are unavailable, transparently communicate the limitation.

## Never do

- Do not make technical decisions on your own; present options and request confirmation.
- Never include secrets, credentials, or private data in commits or documentation.
- In this profile, do not modify source code, executable tests, or configuration files.
- Never push directly to `main`.
- Never run migrations in production.
- Do not expand the MVP scope or treat proposals as approved decisions.
- Prior confirmation already granted for the requested action does not need to be requested again.

## Ask First

- If you have any questions about the task, ask before executing the affected part.
- Ask before installing dependencies, changing the schema, or making any other critical change.

## Commands and Verification

- Use Yarn 4 and run commands within the corresponding package directory.
- Check the existing scripts in `package.json` before running them.
- Do not assume the existence of `docs:build`, `lint`, `test`, or any other specific script.
- Review examples, references, file names, and alignment with the MVP scope.
- Perform only relevant checks that do not have destructive effects.
- Do not use npm, npx, or temporary downloads to bypass dependency approval.
- If a validation cannot be performed, state the reason; do not claim success without evidence.

**Code style example:**
```typescript
// ✅ Good - descriptive names, proper error handling
async function fetchUserById(id: string): Promise<User> {
  if (!id) throw new Error('User ID required');
  
  const response = await api.get(`/users/${id}`);
  return response.data;
}

// ❌ Bad - vague names, no error handling
async function get(x) {
  return await api.get('/users/' + x).data;
}