import { queryEvents, readEvents, summarizeEventCounts } from "../../events.js";
import { successResult, type ApplicationResult } from "../../contracts/application-result.js";
import type {
  EventsQueryCommand,
  EventsQueryOutcome,
} from "../../contracts/knowledge.js";

export async function executeQueryEvents(params: {
  loomRoot: string;
  command: EventsQueryCommand;
}): Promise<ApplicationResult<EventsQueryOutcome>> {
  const all = await readEvents(params.loomRoot);
  const events = queryEvents(all, {
    type: params.command.type,
    since: params.command.since,
    limit: params.command.limit,
    order: params.command.order ?? "desc",
  });
  return successResult(
    {
      total: events.length,
      counts: summarizeEventCounts(events),
      events,
    },
    [],
    [],
    { shouldFail: false },
  );
}
