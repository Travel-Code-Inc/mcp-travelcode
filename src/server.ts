import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TravelCodeApiClient } from "./client/api-client.js";
import { TravelCodeConfig } from "./config.js";
import { registerSearchAirports } from "./tools/search-airports.js";
import { registerGetAirport } from "./tools/get-airport.js";
import { registerSearchAirlines } from "./tools/search-airlines.js";
import { registerSearchFlights } from "./tools/search-flights.js";
import { registerGetFlightResults } from "./tools/get-flight-results.js";
import { registerGetFlightStatus } from "./tools/get-flight-status.js";
import { registerGetAirportFlights } from "./tools/get-airport-flights.js";
import { registerGetFlightDelayStats } from "./tools/get-flight-delay-stats.js";
import { registerGetAirportDelayStats } from "./tools/get-airport-delay-stats.js";
import { registerListOrders } from "./tools/list-orders.js";
import { registerGetOrder } from "./tools/get-order.js";
import { registerCreateOrder } from "./tools/create-order.js";
import { registerCheckOrderCancellation } from "./tools/check-order-cancellation.js";
import { registerCancelOrder } from "./tools/cancel-order.js";
import { registerCheckOrderModification } from "./tools/check-order-modification.js";
import { registerModifyOrder } from "./tools/modify-order.js";
import { registerSearchHotelLocations } from "./tools/search-hotel-locations.js";
import { registerGetHotelLocation } from "./tools/get-hotel-location.js";
import { registerSearchHotels } from "./tools/search-hotels.js";
import { registerGetHotelOffers } from "./tools/get-hotel-offers.js";
import { registerGetMainClient } from "./tools/get-main-client.js";
import { registerGetClient } from "./tools/get-client.js";
import { registerSearchClients } from "./tools/search-clients.js";
import { registerGetCurrentUser } from "./tools/get-current-user.js";
import { registerListNotificationIntegrations } from "./tools/list-notification-integrations.js";
import { registerGetTelegramStatus } from "./tools/get-telegram-status.js";
import { registerGetSlackStatus } from "./tools/get-slack-status.js";
import { registerGetSlackInstallUrl } from "./tools/get-slack-install-url.js";
import { registerInitTelegramLink } from "./tools/init-telegram-link.js";
import { registerActivateNotificationIntegration } from "./tools/activate-notification-integration.js";
import { registerDisconnectNotificationIntegration } from "./tools/disconnect-notification-integration.js";
import { registerListNotificationSettings } from "./tools/list-notification-settings.js";
import { registerGetNotificationSetting } from "./tools/get-notification-setting.js";
import { registerUpdateNotificationSetting } from "./tools/update-notification-setting.js";

export interface CreatedServer {
  server: McpServer;
  apiClient: TravelCodeApiClient;
}

export function createServer(config: TravelCodeConfig): CreatedServer {
  const server = new McpServer({
    name: "TravelCode",
    version: "1.0.0",
  });

  const client = new TravelCodeApiClient(config);

  // Reference data tools
  registerSearchAirports(server, client);
  registerGetAirport(server, client);
  registerSearchAirlines(server, client);

  // Flight search tools
  registerSearchFlights(server, client, config);
  registerGetFlightResults(server, client);

  // Flight statistics tools
  registerGetFlightStatus(server, client);
  registerGetAirportFlights(server, client);
  registerGetFlightDelayStats(server, client);
  registerGetAirportDelayStats(server, client);

  // Order management tools
  registerListOrders(server, client);
  registerGetOrder(server, client);
  registerCreateOrder(server, client);
  registerCheckOrderCancellation(server, client);
  registerCancelOrder(server, client);
  registerCheckOrderModification(server, client);
  registerModifyOrder(server, client);

  // Hotel search tools
  registerSearchHotelLocations(server, client);
  registerGetHotelLocation(server, client);
  registerSearchHotels(server, client);
  registerGetHotelOffers(server, client);

  // Current user / session
  registerGetCurrentUser(server, client);

  // Client (tourist) tools
  registerGetMainClient(server, client);
  registerGetClient(server, client);
  registerSearchClients(server, client);

  // Notification integrations
  registerListNotificationIntegrations(server, client);
  registerGetTelegramStatus(server, client);
  registerGetSlackStatus(server, client);
  registerGetSlackInstallUrl(server, client);
  registerInitTelegramLink(server, client);
  registerActivateNotificationIntegration(server, client);
  registerDisconnectNotificationIntegration(server, client);
  registerListNotificationSettings(server, client);
  registerGetNotificationSetting(server, client);
  registerUpdateNotificationSetting(server, client);

  return { server, apiClient: client };
}
