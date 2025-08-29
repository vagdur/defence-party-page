import type { Route } from "./+types/admin.js";
import { useLoaderData, useFetcher } from "react-router";
import { seatConfig, getMaxSeatsForPriority } from "../config/seats";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Admin Panel - Seat Availability" },
    { name: "description", content: "Admin panel for monitoring seat availability" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  
  try {
    // Get seat counts for each priority tier (current assigned priority)
    const seatCounts = await Promise.all(
      [3, 2, 1, 0].map(async (priority) => {
        const { results } = await REGISTRANTS
          .prepare(`
            SELECT COUNT(*) as count 
            FROM registrants 
            WHERE priority = ?
          `)
          .bind(priority)
          .all();
        
        const count = results?.[0]?.count ?? 0;
        const maxSeats = seatConfig.seatsPerTier[priority as keyof typeof seatConfig.seatsPerTier];
        const available = Math.max(0, maxSeats - count);
        
        return {
          priority,
          tierName: getTierName(priority),
          currentSeats: count,
          maxSeats,
          available,
          percentage: maxSeats > 0 ? Math.round((count / maxSeats) * 100) : 0
        };
      })
    );

    // Get original priority counts for each tier
    const originalPriorityCounts = await Promise.all(
      [3, 2, 1, 0].map(async (priority) => {
        const { results } = await REGISTRANTS
          .prepare(`
            SELECT COUNT(*) as count 
            FROM registrants 
            WHERE original_priority = ?
          `)
          .bind(priority)
          .all();
        
        return results?.[0]?.count ?? 0;
      })
    );

    // Get total registrants
    const { results: totalResult } = await REGISTRANTS
      .prepare("SELECT COUNT(*) as count FROM registrants")
      .all();
    
    const totalRegistrants = totalResult?.[0]?.count ?? 0;

    // Combine seat counts with original priority counts
    const seatCountsWithOriginal = seatCounts.map((tier, index) => ({
      ...tier,
      originalPriorityCount: originalPriorityCounts[index]
    }));

    // Get cumulative availability for each tier
    const cumulativeAvailability = seatCountsWithOriginal.map((tier, index) => {
      const cumulativeMax = getMaxSeatsForPriority(tier.priority);
      // Calculate cumulative usage from current tier down to lowest priority (General)
      const cumulativeCurrent = seatCountsWithOriginal
        .slice(index)  // Take from current tier index to end (current to lowest priority)
        .reduce((sum, t) => sum + t.currentSeats, 0);
      
      return {
        ...tier,
        cumulativeMax,
        cumulativeCurrent,
        cumulativeAvailable: Math.max(0, cumulativeMax - cumulativeCurrent)
      };
    });

    return {
      tiers: cumulativeAvailability,
      totalRegistrants,
      totalMaxSeats: getMaxSeatsForPriority(3), // Total seats including all tiers
      totalAvailable: Math.max(0, getMaxSeatsForPriority(3) - totalRegistrants)
    };
  } catch (error) {
    console.error("Admin loader error:", error);
    return {
      tiers: [],
      totalRegistrants: 0,
      totalMaxSeats: 0,
      totalAvailable: 0,
      error: "Failed to load seat data"
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  const formData = await request.formData();
  const action = formData.get("action");

  try {
    if (action === "clear_registrants") {
      // Clear all tables except topics and languages
      await REGISTRANTS.batch([
        REGISTRANTS.prepare("DELETE FROM registrant_languages"),
        REGISTRANTS.prepare("DELETE FROM registrant_topics"),
        REGISTRANTS.prepare("DELETE FROM relationships"),
        REGISTRANTS.prepare("DELETE FROM registrants")
      ]);
      
      return { success: true, message: "All registrant data cleared successfully" };
    }
    
    if (action === "clear_topics_languages") {
      // First check if there are any registrants (to ensure dependencies are met)
      const { results: registrantCheck } = await REGISTRANTS
        .prepare("SELECT COUNT(*) as count FROM registrants")
        .all();
      
      const registrantCount = registrantCheck?.[0]?.count ?? 0;
      
      if (registrantCount > 0) {
        return { 
          success: false, 
          error: "Cannot clear topics and languages while registrants exist. Please clear registrants first." 
        };
      }
      
      // Clear topics and languages
      await REGISTRANTS.batch([
        REGISTRANTS.prepare("DELETE FROM topics"),
        REGISTRANTS.prepare("DELETE FROM languages")
      ]);
      
      return { success: true, message: "Topics and languages cleared successfully" };
    }
    
    return { success: false, error: "Invalid action" };
  } catch (error) {
    console.error("Admin action error:", error);
    return { success: false, error: "Failed to perform database operation" };
  }
}

import { getTierName } from "../config/seats";

export default function Admin(_: Route.ComponentProps) {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting";

  if (data.error) {
    return (
      <main className="pt-16 p-4 container mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
          <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-6 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            <h2 className="text-2xl font-semibold mb-2">Error</h2>
            <p className="text-lg">{data.error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16 p-4 container mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Admin Panel - Seat Availability</h1>
        <a 
          href="/" 
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
        >
          <span>←</span>
          Back to Main Page
        </a>
      </div>
      
      {/* Action Messages */}
      {fetcher.data && (
        <div className={`mb-6 rounded-md border p-6 ${
          fetcher.data.success 
            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200'
            : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200'
        }`}>
          <h2 className="text-xl font-semibold mb-2">
            {fetcher.data.success ? 'Success' : 'Error'}
          </h2>
          <p className="text-lg">
            {fetcher.data.success ? fetcher.data.message : fetcher.data.error}
          </p>
        </div>
      )}
      
      {/* Database Management Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-6">Database Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <fetcher.Form method="post">
            <input type="hidden" name="action" value="clear_registrants" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {isSubmitting ? "Clearing..." : "Clear All Registrant Data"}
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              This will delete all registrants, relationships, registrant-language associations, and registrant-topic associations.
            </p>
          </fetcher.Form>
          
          <fetcher.Form method="post">
            <input type="hidden" name="action" value="clear_topics_languages" />
            <button
              type="submit"
              disabled={isSubmitting || data.totalRegistrants > 0}
              className={`w-full font-semibold py-3 px-6 rounded-lg transition-colors duration-200 ${
                data.totalRegistrants > 0
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white'
              }`}
            >
              {isSubmitting ? "Clearing..." : "Clear Topics & Languages"}
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {data.totalRegistrants > 0 
                ? "Cannot clear while registrants exist. Clear registrants first."
                : "This will delete all topics and languages."
              }
            </p>
          </fetcher.Form>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Total Registrants</h3>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data.totalRegistrants}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Total Capacity</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{data.totalMaxSeats}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Total Available</h3>
          <p className={`text-3xl font-bold ${data.totalAvailable > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {data.totalAvailable}
          </p>
        </div>
      </div>

      {/* Tier Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-6">Tier Breakdown</h2>
        <div className="space-y-6">
          {data.tiers.map((tier) => (
            <div key={tier.priority} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {tier.tierName} (Priority {tier.priority})
                </h3>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Capacity</p>
                  <p className="text-lg font-semibold">{tier.maxSeats} seats</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span>Current: {tier.currentSeats}</span>
                  <span>Available: {tier.available}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-300 ${
                      tier.percentage >= 90 ? 'bg-red-500' : 
                      tier.percentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, tier.percentage)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {tier.percentage}% full
                </p>
              </div>

              {/* Priority Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Currently Assigned</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {tier.currentSeats} / {tier.maxSeats} seats used
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-3">
                  <p className="font-medium text-purple-700 dark:text-purple-300 mb-1">Original Priority</p>
                  <p className="text-purple-600 dark:text-purple-400">
                    {tier.originalPriorityCount} registrants
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3">
                  <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Cumulative (including lower tiers)</p>
                  <p className="text-blue-600 dark:text-blue-400">
                    {tier.cumulativeCurrent} / {tier.cumulativeMax} seats used
                  </p>
                  <p className="text-blue-600 dark:text-blue-400">
                    {tier.cumulativeAvailable} available
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Original Priority Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-8">
        <h2 className="text-2xl font-semibold mb-6">Original Priority Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {data.tiers.map((tier) => (
            <div key={tier.priority} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {tier.tierName}
              </h3>
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {tier.originalPriorityCount}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                registrants originally assigned
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
        Last updated: {new Date().toLocaleString()}
      </div>
    </main>
  );
}
