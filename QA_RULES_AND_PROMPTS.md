# Permanent System Design & Rules: Website Migration QA Auditor

## Core Principles & Source of Truth
1. **Source of Truth Priority**: A REAL DEFECT can ONLY exist when the **Legacy System** proves that the **New System** is incorrect. Never flag New-only observations as defects without explicit evidence from Legacy.
2. **Human-Readable Content Only**: Do NOT analyze raw HTML code, tags, or scripts. Compare content strictly as a student experiences it in the web browser (human-readable text, headings, tables, callouts, images, and links).
3. **Generic & Dynamic Execution**: Do NOT hardcode any specific course names, page titles, URLs, or specific text strings. All rules, crawlers, parsers, and report generators must work dynamically across any current or future LMS course migration.

## Defect Detection & False-Positive Elimination Rules

### 1. Link Anchor Cross-Check & Active Health Validation Rule
- **Cross-Check Requirement**: The auditor must cross-check EVERY hyperlink and anchor destination across both Legacy and New systems.
- **Active HTTP Link Health Validation**:
  - Send concurrent HTTP requests (`HEAD` / `GET`) to validate the active status of every link URL.
  - Flag a **Broken Link Defect** if a link in the New System returns `404 Not Found`, `500 Server Error`, or fails to connect/timeout.
- **Cross-Check Procedures**:
  a. **Missing Link Check**: Verify whether links present in Legacy are missing in New.
  b. **Destination URL Mismatch Check**: Compare target URLs for each matching link text between Legacy and New. Flag a defect if New points to a different, incorrect, or broken destination relative to Legacy's expected URL.
  c. **Extra / Irrelevant Link Check**: Flag unexpected extra links introduced in New that do not exist in Legacy.
  d. **Anchor Consistency**: Ensure anchor destinations (`#section-id`) resolve to equivalent corresponding content locations in both systems.

### 2. Duplicate Headings & Repeated Lines Rule
- Compare occurrence counts between Legacy and New systems.
- If Legacy itself contains repeated titles/headings or repeated lines, that repetition is expected and MUST NOT be flagged as a defect.
- Flag a **Duplicate Heading Defect** ONLY when New contains an *EXTRA* occurrence compared with Legacy.

### 3. Missing Content & Dropped Text Rule
- Flag missing paragraphs, dropped bullet pointers, truncated sentences, missing callout statements, and missing notes.
- Flag lines that are incorrectly repeated twice in New when present once in Legacy.

### 4. Tables & Visual Layout Rule
- Harmless CSS spacing, border styling, or container padding differences are ignored.
- Flag a **Table Structure Defect** ONLY when cell data, row/column counts, or visible table text is missing, reordered, or corrupted.
- Flag visual layout defects if images overlap or obscure text content.

## Color Scheme
- **Red**: Critical Errors, Missing Content, Dropped Paragraphs, Missing Pages, Broken / Mismatched Links (404/500 errors).
- **Orange / Amber**: Formatting Mismatches, Duplicate Headings, Table Structure Corruptions.
- **Green**: Expected / Matching Legacy Content, Verified Working Links.

## Mandatory Field Template
```text
[Section / Topic Heading]

ERROR [N]: [Error Title]
Error Type : [Error Classification]
Location: [Topic Path -> Section]
issue: [Clear explanation of defect with Legacy proof]
Legacy (Expected) : [Exact expected content from Legacy System]
New System: [Actual deficient content in New System]
```
