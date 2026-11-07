# Launch Readiness Scoring Formula & Specification

## 1. Executive Summary & Purpose

The **Launch Readiness Score** is an indicative index from **0 to 100** evaluating the baseline security, privacy, accessibility, and consumer compliance of a website before launch or client handover.

It is designed to give technical founders and development agencies immediate visibility into critical compliance and security gaps prior to release.

> **CRITICAL LEGAL NOTICE:**  
> The Launch Readiness Score is strictly an automated heuristic assessment. It is **NOT** legal advice, an official compliance certificate, an ISO/SOC-2 accreditation, or a guarantee against statutory regulatory fines or third-party litigation.

---

## 2. Fundamental Architectural Invariants

The Rules Engine and Scoring Evaluator enforce seven non-negotiable invariants:

1. **Four Immutable Statuses:**
   Every check evaluation strictly concludes with one of:
   - `passed`: The check verified compliance with empirical evidence.
   - `issue_found`: Non-compliance or risk was detected, backed by valid evidence.
   - `not_applicable`: The check does not apply to this site's confirmed jurisdiction or functional profile.
   - `unable_to_verify`: Insufficient data, blocked requests, or missing evidence prevented verification.

2. **Only Applicable Issues Deduct:**  
   `not_applicable` checks are excluded from the score computation. They never reduce nor artificially inflate the score.

3. **Unable to Verify is Never a Pass:**  
   Checks with status `unable_to_verify` represent unassessed operational risk. They are never reported as passed, do not inflate the score, and are tracked as an `unverifiedRatio` risk signal.

4. **Missing Evidence is Never Compliance:**  
   If a detector flags an issue without resolvable evidence records, or evidence was blocked, the system demotes the finding to `unable_to_verify`. It is never assumed to be compliant.

5. **Severity and Confidence are Distinct:**
   - **Severity** (`critical`, `high`, `medium`, `low`, `info`): The intrinsic impact of the vulnerability or violation if confirmed.
   - **Confidence** (`0.0` to `1.0`): The certainty of detection based on the strength and clarity of empirical evidence.

6. **Defensible Legal Applicability:**  
   Legal applicability (e.g., India DPDP, EU GDPR, US CCPA) is governed exclusively by user/customer-confirmed target jurisdictions.  
   **Invariant:** The engine **never** infers legal obligations solely from the website's IP address, DNS routing, or hosting location.

7. **Reviewed, Non-Additive Exposure Models:**  
   Statutory regulatory maximums are never summed across overlapping jurisdictions or correlated violations. Plausible defense and remediation costs use source-backed models without fabricated enforcement probability coefficients.

---

## 3. Mathematical Scoring Formula

### Base Formula

$$\text{Readiness Score} = \max\left(0, \min\left(100, \text{round}\left(100 - \sum_{i \in \text{Applicable Issues}} D_i\right)\right)\right)$$

Where each issue deduction $D_i$ is calculated as:

$$D_i = \text{BaseDeduction}(\text{Severity}_i) \times \text{Confidence}_i$$

### Severity Deduction Table

| Severity | Base Deduction | Rationale & Examples |
|---|---|---|
| **Critical** | `8.0` pts | Severe legal breaches or major security vulnerabilities (e.g., exposed secrets `D1`, TLS failure `D5`, pre-consent tracking `B2`, broken consent withdrawal `B4`). |
| **High** | `5.0` pts | Significant regulatory exposure or privacy risks (e.g., missing privacy policy `A1`, insecure cookie flags `D7`, frontend sensitive data leaks `D12`). |
| **Medium** | `3.0` pts | Noteworthy compliance or quality gaps (e.g., form consent absence `A6`, security headers missing `D6`, accessibility contrast failures `C2`, broken internal links `H1`). |
| **Low** | `1.5` pts | Minor operational or best-practice observations (e.g., heading hierarchy `C5`, touch target sizing `C10`, font licence signals `G6`). |
| **Info** | `0.0` pts | Informational telemetry and observations. Never deducts points. |

### Confidence Weighting

- When confidence is `1.0` (deterministic check with conclusive proof), the finding receives the full deduction.
- When confidence is `0.5` (heuristic match or secondary signal), the deduction is scaled by $0.5 \times \text{BaseDeduction}$.
- Findings with confidence $< 0.5$ are automatically flagged for manual review (`requiresHumanReview = true`).

---

## 4. Unverified Ratio as a Risk Indicator

Because `unable_to_verify` does not deduct points, a scan where 80% of checks timed out could theoretically produce a misleadingly high score if only 20% of checks ran and passed.

To prevent false confidence, the Rules Engine calculates the **Unverified Ratio**:

$$\text{Unverified Ratio} = \frac{N_{\text{unable\_to\_verify}}}{N_{\text{passed}} + N_{\text{issue\_found}} + N_{\text{unable\_to\_verify}}}$$

- **$\le 0.10$**: High assessment reliability.
- **$0.11 - 0.25$**: Moderate reliability; minor scan gaps.
- **$> 0.25$**: Low assessment reliability. The report alerts the user that critical stages were incomplete or blocked.

---

## 5. Scoring Limitations & Caveats

1. **Client-Side Observability Boundary:**  
   The scanner can only inspect what is observable from network traffic, DOM, TLS handshakes, and public responses. It cannot audit server-side databases, backend access controls, internal processing logs, or vendor contracts.

2. **Heuristic Nature of Scoring:**  
   A score of 100 indicates that zero issues were detected by the active checks; it does not constitute certification of complete compliance with statutory laws.

3. **Jurisdiction Specificity:**  
   Selecting only India (`india`) evaluates DPDP and consumer protection rules, skipping EU GDPR-specific transfer rules (`B7`) or California CCPA-specific do-not-sell links (`A10`). The score reflects readiness for the selected operational scope.

4. **Point Additivity Ceiling:**  
   While deductions are cumulative, the score is strictly clamped at 0. A site with numerous critical issues cannot drop below 0.
