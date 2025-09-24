import * as v from "valibot";

export function formatValiIssues(issues: v.GenericIssue[]) {
  const messages = [];
  for (const issue of issues) {
    const fmt = formatValiIssue(issue);
    if (fmt) {
      messages.push(`${fmt.dotPath}: ${fmt.message}`);
    }
  }
  return messages.join("\n"); // + `--- \n${JSON.stringify(error, undefined, 2)}`;
}

function formatValiIssue(issue: v.GenericIssue): {
  dotPath: string;
  message: string;
} {
  const dotPath = v.getDotPath(issue);
  const message = `${issue.message} (value: ${JSON.stringify(issue.input)})`;
  if (typeof dotPath !== "string") {
    return { dotPath: "", message };
  }
  if (Array.isArray(issue.issues) && issue.issues.length > 0) {
    const fmt = formatValiIssue(
      issue.issues?.find((item) => item?.path?.length ?? 0) ?? issue.issues[0],
    );
    fmt.dotPath = fmt.dotPath ? `${dotPath}.${fmt.dotPath}` : dotPath;
    return fmt;
  }
  return { dotPath, message };
}
