# DataMind Project Development Methodology

This document outlines the standard development practices, architecture guidelines, and workflow for contributing to the DataMind project.

## 1. Architecture Overview

DataMind is an AI-powered data analysis tool with a decoupled client-server architecture:
- **Frontend**: React application for an interactive user dashboard, visualizations, and live dataset views.
- **Backend**: FastAPI application serving REST endpoints and managing the AI agents.
- **AI/Agents**: Powered by LangChain, LangGraph, and Google Gemini. Agents handle insights, data engineering, and visualization planning.

## 2. Development Workflow

We follow a structured Git workflow to ensure stability and smooth collaboration.

### Branching Strategy
- **`main`**: Represents the stable production-ready state.
- **`develop`**: The integration branch for features before they go to production.
- **Feature Branches**: Created from `develop` for specific tasks. Naming convention: `feature/<feature-name>` (e.g., `feature/add-csv-export`).
- **Bugfix Branches**: Created from `develop` or `main`. Naming convention: `bugfix/<bug-name>`.

### Commits and Pull Requests
- Write clear, descriptive commit messages.
- Always open a Pull Request (PR) against the `develop` branch for review.
- Ensure all tests pass and code adheres to formatting standards before requesting a review.

## 3. Coding Standards

### Backend (Python)
- **Framework**: FastAPI with Pydantic for data validation.
- **Style**: Follow PEP 8 guidelines. Use `black` for formatting and `flake8` for linting.
- **Type Hinting**: Heavily utilize Python type hints to ensure Pydantic validation and improve code readability.
- **Agent Design**: Agents implemented via LangGraph must be stateless where possible or use explicitly defined `state` schemas. Keep agent prompts in a dedicated configuration or separate files to decouple logic from prompt engineering.

### Frontend (React)
- **Components**: Use functional components and React Hooks.
- **State Management**: Use React Context or standard state management libraries as appropriate.
- **Styling**: Ensure a modern, responsive design. 
- **Style/Linting**: Use `ESLint` and `Prettier` to maintain consistent code formatting.

## 4. AI and Agent Development
- **Prompt Iteration**: Prompts should be treated as code. Test prompt changes rigorously across different dataset sizes and types to avoid regressions.
- **LangGraph State**: Explicitly define the state flow for any multi-agent interactions to ensure deterministic behavior.
- **Rate Limiting & Retries**: Ensure appropriate fallback mechanisms and retries for Gemini API calls.

## 5. Testing Strategy
- **Backend Testing**: Use `pytest` for unit and integration testing. Test API endpoints, data processing utilities, and mock AI responses to validate agent logic.
- **Frontend Testing**: Use tools like Jest and React Testing Library for component rendering and user interaction testing.
- **Manual Verification**: Always verify the end-to-end flow manually with sample CSV datasets before finalizing a feature.

## 6. Security and Environment
- Never commit sensitive keys (e.g., `gemini_api_key`) to version control.
- Use `.env` files for local development.
- Validate and sanitize all user-uploaded data (CSV files) before processing them through the agents to prevent prompt injection or execution of malicious data.
