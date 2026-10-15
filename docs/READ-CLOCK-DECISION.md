# C5 request-clock comparison decision — owner approved

Recommended model/speed: GPT-6.1 Sol/high. This is an approved amendment to the
literal seven-day zero-difference criterion. On2026-10-12 the owner explicitly
approved recording request-clock differences separately. This records design
authorization, not seven-day or production acceptance.

Two independent requests naturally have different generation clocks. With
identical rich synthetic inputs and clocks one second apart, actual canonical
GAS and generated Worker calculations differ only at:

| Route/section | Request-generated field |
| --- | --- |
| home/home | `data.home.updated_at` |
| home/actions | `data.contract_requests.summary.updated_at` |
| revenue | `data.updated_at` |
| tenants, arrears | `data.landlord.updated_at` |
| rooms, properties | No clock-only difference |

The same request-clock issue occurs even when both systems calculate every
amount, count, sort order and rendering field correctly. It explains why the original
literal zero-difference gate needed the approved amendment. Source row timestamps such as tenant, bill,
property and contract `updated_at` are a different category and stay exact.

Approved bounded rule:

1. Keep all public API responses and rendering unchanged. Compare all business
   fields, source timestamps, structure and ordering exactly as now.
2. Only the exact route/section/path combinations above may be classified as
   request-clock differences. Both values must be canonical ISO timestamps and
   differ by no more than60 seconds; invalid/large clock differences remain
   ordinary blocking differences. No blanket `updated_at` exclusion is allowed.
3. Record those paths separately as clock observations, without either value.
   Keep them visible in daily evidence while requiring seven actual full days
   of zero business-field differences, matched receipt-backed read coverage,
   no unresolved failures/missing reports, and the agreed latency/device gates.
4. Classification is authorized by the owner's explicit approval above.
   Preceding actual release gates still apply. A shared calculation-clock API
   contract would require another design approval.

Evidence: `tests/read-shadow.test.mjs` compares original GAS and generated
Worker on identical synthetic data; a one-second difference leaves every other
revenue field identical. The seven-route clock probe confirms the exact table
above. This is local evidence of a clock boundary, not real latency or days.

Rollback: restore the preceding comparator/build and retain all off flags. No formal
deployment, trigger, property, data or fee change is part of this decision.
