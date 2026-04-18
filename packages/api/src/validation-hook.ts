import type { Context } from 'hono';

export function validationHook(
  result: { success: boolean; error?: { issues: { message: string }[] } },
  c: Context,
): Response | void {
  if (!result.success) {
    const firstIssue = result.error!.issues[0];
    return c.json({ error: firstIssue.message }, 400);
  }
}
