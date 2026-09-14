# DOC-0 Qualification Checklist

DOC-0 is complete when the documentation foundation is coherent enough that new documentation can be added without inventing new structural rules.

## Qualification

- [x] A canonical architecture taxonomy exists.
- [x] Existing documentation has a non-destructive migration rule.
- [x] Documentation page classes are defined.
- [x] Documentation change requirements are defined for externally visible behavior.
- [x] A standard application documentation package is defined.
- [x] Architecture Decision Records have a naming, lifecycle, and content standard.
- [x] Diagram source and labeling conventions are defined.
- [x] Canonical naming, terminology, version, security-warning, and code-formatting conventions are defined.
- [x] Repository Markdown is explicitly defined as the canonical documentation source.

## Deferred by design

The following are not DOC-0 requirements and belong to later phases:

- MkDocs/GitHub Pages configuration — DOC-1.
- Complete architecture prose — DOC-2 through DOC-5 and DOC-7.
- Complete user/application manuals — DOC-6 and DOC-8.
- Generated API/ABI/RPC reference — DOC-10.
- Automated documentation CI enforcement — DOC-12.
- Version selector/public version publishing — DOC-13.

## Gate for DOC-1

DOC-1 may begin once this checklist and the other DOC-0 standards are merged to `main`. DOC-1 must consume these standards rather than redefining the documentation taxonomy.