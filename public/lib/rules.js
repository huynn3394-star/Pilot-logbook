// No airline thresholds are shipped. A future validated ruleset must include version and provenance.
export function evaluateRules(duties, ruleset) {
  if (!ruleset?.version || !ruleset?.source || !ruleset?.rules?.length)
    return {
      status: "unknown",
      version: null,
      findings: [],
      message: "Chưa cài bộ quy định Vietnam Airlines. Chưa đánh giá tuân thủ.",
    };
  const findings = [];
  for (const d of duties)
    for (const r of ruleset.rules) {
      if (typeof d[r.field] !== "number") continue;
      const value = d[r.field];
      findings.push({
        status:
          value > r.max
            ? "red"
            : value >= r.max - (r.near || 0)
              ? "yellow"
              : "green",
        value,
        max: r.max,
        source: ruleset.source,
        section: r.section,
        version: ruleset.version,
      });
    }
  const status = findings.some((f) => f.status === "red")
    ? "red"
    : findings.some((f) => f.status === "yellow")
      ? "yellow"
      : findings.length
        ? "green"
        : "unknown";
  return { status, version: ruleset.version, source: ruleset.source, findings };
}
