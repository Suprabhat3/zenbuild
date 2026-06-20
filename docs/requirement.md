AI can help write code faster, but great software is not shipped by code generation alone. Every successful feature follows a process:

Request → Product Thinking → PRD → Tasks → Implementation → Review → Fixes → Approval → Release

Your challenge is to build ZenBuild, a complete AI-assisted product delivery platform that helps software teams move features from idea to production through a structured workflow. You are building a full-stack SaaS platform that manages the entire software delivery lifecycle.


What is my Landscape?
Your customer submits a feature request. The platform should:

Understand the customer / product owner request
Ask for missing context (when necessary)
Generate a structured Product Requirements Document (PRD)
Break the PRD into actionable engineering tasks
Connect work to a GitHub repository
Track implementation through pull requests
Run AI-powered code reviews against requirements
Send issues back for fixes
Re-review updated code
Allow a human reviewer to approve the final release
Mark the feature as shipped
The platform should feel like a real product used by modern product and engineering teams.

Workflow of zenbuild
Product Discovery (Phase 1)
User creates a feature request via email, support ticket, customer service call (or) any mode
AI Agent must gather missing requirements by asking follow up questions to gather context
Not every request requires it to be build
User might not be aware if such offering is already present so we shall educate in such cases
But if the request really doesn't exist then proceed
Using the information, your AI Agent will next generate a structured PRD plan
The PRD should include:

Problem statement
Goals
Non-goals
User stories
Acceptance criteria
Edge cases
Success metrics
Planning (Phase 2)
zenbuild Agent then converts the PRD into engineering tasks
Tasks are organized and tracked on a Kanban board
Software teams can then review and approve the plan for next phase
Development (Phase 3)
Code repository is connected through GitHub
Developers (or) coding agents implement the feature request mentioned in PRD
A Pull requests are created with new code changes meeting the PRD
AI Review Loop (Phase 4)
Your QA Agent powered by AI then reviews the pull request against:
PRD requirements
Acceptance criteria
Engineering tasks
Security concerns
Performance considerations
Edge cases
Code quality
Issues are categorized as:
Blocking
Non-blocking
If problems are found:
Feature returns to a fix-needed state
Developers or Agents update the implementation
Then, your QA Agent will review the new code again
The cycle continues until the feature is ready
Human Approval (Phase 5)
Human reviewer verifies:
PRD
Tasks
Pull request
AI review history
Outstanding issues
Human approves (or) rejects release
Only approved features can move to: Shipped
The Core Loop
The most important part of the product implementation is:

Feature Request → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship

The Agent should act as a QA and engineering reviewer; not merely a syntax checker.

It should evaluate whether the implementation actually satisfies the product requirements and is ready for production. Humans remain the final decision makers.

Technology Stack
Build the project as a tRPC Monorepo using:

Next.js
tRPC
Shadcn UI
BetterAuth
Razorpay
Octokit (GitHub Integration)
AI SDK
Inngest
Prisma or Drizzle
PostgreSQL or MongoDB
Vercel
GitHub Webhooks
SaaS Requirements
The platform should support multi-tenant organizations. Each workspace should have its own:

Users
Projects
Repositories
Feature requests
PRDs
Tasks
Review history
Billing status
Authentication must be handled using BetterAuth. Billing are to be implemented using RazorPay payment gateway.

Examples include:

Free vs paid plans
Usage limits
AI review credits
Repository limits
Premium workflow features
GitHub Integration
GitHub integration using Octokit is mandatory. Your platform should be able to:

Connect repositories
Receive webhook events
Track pull requests
Fetch changed files
Analyze diffs
Generate AI reviews
Post review comments
Track review status
Hardcoded pull request data is not allowed.

AI Requirements
Use AI SDK to power:

Requirement clarification
PRD generation
Task generation
Repository analysis
Code review
QA validation
Release readiness checks
AI should provide actionable feedback and explain why issues exist.

Async Workflows
Use Inngest for long-running processes such as:

PRD generation
Task creation
Repository analysis
Pull request processing
AI reviews
Re-review workflows
Release readiness checks
Workflow progress should be visible inside the application.

Product Experience
The application should feel like a polished SaaS product.

Recommended pages:

Landing Page
Authentication
Dashboard
Workspace Management
Project View
Feature Requests
PRD Editor
Task Board
GitHub Integration
Pull Request Reviews
Review History
Billing
Final Approval & Release
Rules & Guidelines
Project must be built in a tRPC monorepo.

Use proper monorepo structure with separate apps and packages.

tRPC must be used for type-safe API communication.

Next.js must be used for the web app.

PostgreSQL or MongoDB must be used as the primary database.

Prisma or Drizzle must be used for database modeling and access.

Webhook handling is required for GitHub events.

Public GitHub repository is mandatory.

Deployed live project is mandatory.

Demo video is mandatory.

Proper README is mandatory.

README must include:

project overview
tech stack
architecture
setup instructions
environment variables
database schema notes
GitHub integration setup
Inngest workflow explanation
AI features implemented