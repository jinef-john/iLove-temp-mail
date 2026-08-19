import * as db from "@/database/d1";
import * as r2 from "@/database/r2";
import { now } from "@/utils/helpers";
import { logInfo } from "@/utils/logger";
import { sendMessage } from "@/utils/telegram";

/**
 * Cloudflare Scheduled Function
 * Delete emails older than 4 hours
 */
export async function handleScheduled(
	_event: ScheduledEvent,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	const cutoffTimestamp = now() - env.HOURS_TO_DELETE_D1 * 60 * 60;

	const { ids: emailIds, error: idsError } = await db.getEmailIdsOlderThan(
		env.D1,
		cutoffTimestamp,
	);

	if (idsError) {
		const errorMessage = `❌ Email cleanup failed: ${idsError.message}`;
		ctx.waitUntil(sendMessage(errorMessage, env));
		throw new Error(errorMessage);
	}

	await Promise.all(emailIds.map((emailId) => r2.deleteEmailAttachments(env.R2, emailId)));

	const { success, error } = await db.deleteOldEmails(env.D1, cutoffTimestamp);

	if (success) {
		logInfo("Email cleanup completed successfully.", { deletedEmails: emailIds.length });
		ctx.waitUntil(sendMessage("✅ Email cleanup completed successfully.", env));
	} else {
		const errorMessage = `❌ Email cleanup failed: ${error?.message || "Unknown error"}`;
		ctx.waitUntil(sendMessage(errorMessage, env));
		throw new Error(errorMessage);
	}
}
