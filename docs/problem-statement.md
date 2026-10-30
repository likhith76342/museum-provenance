# Problem Statement

**Title:** Museum/Archive Artifact Provenance & Condition-Report Matching

Small museums/archives track artifact history (who owned it, condition over time) via free-text
condition reports written by different curators over decades. Embeddings match new condition
reports against historical ones to auto-detect degradation patterns or inconsistent documentation
(possible forgery/mislabeling flags).

- **SQL:** Artifacts, Curators, OwnershipHistory, ConditionReports
- **Vector:** Embed condition-report text → similarity search across time to flag anomalies
- **Roles:** Admin, Curator, Researcher (read-only)

Verified by a TA. Team: PES1UG24CS675, PES1UG24CS720.
