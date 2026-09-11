# DOC-1 qualification

DOC-1 establishes the public 420Docs site foundation. Its exit gate verifies that the documentation source can be built strictly, that audience navigation resolves to rendered pages, that MkDocs search indexes those entry points, and that the repository README exposes the documentation system.

## Automated checks

The `420Docs Qualification` workflow runs for documentation-related pull requests and relevant pushes to `main`.

It performs the following checks:

1. installs the documentation dependencies from `requirements-docs.txt`;
2. runs `mkdocs build --strict`;
3. confirms the built site contains the Home, Get Started, Use, Build, Operate, Architecture, Reference, and Troubleshooting entry pages;
4. confirms `site/search/search_index.json` is present and valid JSON;
5. confirms each audience section is discoverable through the generated search index;
6. confirms the repository README exposes the public 420Docs URL and core documentation entry points.

The same post-build qualification script runs inside the GitHub Pages workflow before the Pages artifact can be uploaded.

## Authority boundary

Qualification proves that the documentation site is structurally buildable and discoverable. It does not make rendered HTML authoritative. Repository-controlled Markdown and generated canonical reference sources remain the documentation source of truth.

## DOC-1 exit condition

DOC-1 is complete when:

- the MkDocs Material project exists;
- GitHub Pages deployment is configured;
- audience-based navigation and landing pages exist;
- the repository README exposes 420Docs;
- strict build, navigation, search indexing, and repository discoverability checks pass automatically.

Broader documentation CI such as duplicate identifiers, front-matter policy, orphan detection, generated-reference drift, and required-doc enforcement remains in DOC-12.
