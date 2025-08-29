import { Hono } from "hono";
import { createRequestHandler } from "react-router";

const app = new Hono();

// Cron job handler to wipe the database every 5 minutes
app.get("/cron/wipe-database", async (c) => {
  try {
    const { REGISTRANTS } = c.env;
    
    // Delete all data from all tables
    await REGISTRANTS.batch([
      REGISTRANTS.prepare("DELETE FROM registrant_languages"),
      REGISTRANTS.prepare("DELETE FROM registrant_topics"),
      REGISTRANTS.prepare("DELETE FROM relationships"),
      REGISTRANTS.prepare("DELETE FROM registrants"),
      REGISTRANTS.prepare("DELETE FROM languages"),
      REGISTRANTS.prepare("DELETE FROM topics")
    ]);
    
    console.log("Database wiped successfully at", new Date().toISOString());
    
    return c.json({ 
      success: true, 
      message: "Database wiped successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error wiping database:", error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Handle Cron triggers
app.get("/__cron", async (c) => {
  try {
    const { REGISTRANTS } = c.env;
    
    // Delete all data from all tables
    await REGISTRANTS.batch([
      REGISTRANTS.prepare("DELETE FROM registrant_languages"),
      REGISTRANTS.prepare("DELETE FROM registrant_topics"),
      REGISTRANTS.prepare("DELETE FROM relationships"),
      REGISTRANTS.prepare("DELETE FROM registrants"),
      REGISTRANTS.prepare("DELETE FROM languages"),
      REGISTRANTS.prepare("DELETE FROM topics")
    ]);
    
    console.log("Database wiped successfully via Cron at", new Date().toISOString());
    
    return c.json({ 
      success: true, 
      message: "Database wiped successfully via Cron",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error wiping database via Cron:", error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Add more routes here

app.all("*", (c) => {
  const requestHandler = createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE,
  );

  return requestHandler(c.req.raw, {
    cloudflare: { env: c.env, ctx: c.executionCtx },
  });
});

export default app;
