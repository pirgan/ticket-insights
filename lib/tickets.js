import ticketsJson from "../data/tickets.json" assert { type: "json" };
// JSON import gives us `string` for the enum fields, so read it once here rather
// than re-validating on every read. `npm run verify:data` is what actually keeps
// the file honest.
const tickets = ticketsJson

/** The whole dataset, unfiltered - the base every stats and page read starts from. */
export function getAllTickets() {
	return tickets;
}

/** Look one ticket up by id; undefined if nothing matches. */
export function getTicketById(id) {
	return tickets.find((ticket) => ticket.id === id);
}