import type { Route } from "./+types/home";
import { Form, useActionData, useLoaderData } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Defence Party Registration" },
    { name: "description", content: "Register for the Defence Party!" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { REGISTRANTS, VALUE_FROM_CLOUDFLARE } = context.cloudflare.env;
  try {
    // Ensure table exists; id is auto-increment primary key
    await REGISTRANTS.exec(
      "CREATE TABLE IF NOT EXISTS registrants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))"
    );
    
    await REGISTRANTS.exec(
      "CREATE TABLE IF NOT EXISTS relationships (id INTEGER PRIMARY KEY AUTOINCREMENT, new_registrant_id INTEGER NOT NULL, known_registrant_id INTEGER NOT NULL, knows_person BOOLEAN NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (new_registrant_id) REFERENCES registrants(id), FOREIGN KEY (known_registrant_id) REFERENCES registrants(id))"
    );

    const { results } = await REGISTRANTS
      .prepare(
        "SELECT id, name, phone, created_at FROM registrants ORDER BY name ASC"
      )
      .all<{ id: number; name: string; phone: string; created_at: string }>();
    
    return { message: VALUE_FROM_CLOUDFLARE, registrants: results ?? [] };
  } catch (error) {
    console.error("Loader error:", error);
    return { message: VALUE_FROM_CLOUDFLARE, registrants: [], error: "Failed to load registrants" };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  
  if (!name || !phone) {
    return { ok: false, error: "Please provide both name and phone." };
  }

  try {
    // Start a transaction
    await REGISTRANTS.exec("BEGIN TRANSACTION");
    
    // Insert the new registrant
    const insertResult = await REGISTRANTS
      .prepare("INSERT INTO registrants (name, phone) VALUES (?1, ?2)")
      .bind(name, phone)
      .run();
    
    const newRegistrantId = insertResult.meta.last_row_id;
    
    // Get all existing registrants to process relationships
    const { results: existingRegistrants } = await REGISTRANTS
      .prepare("SELECT id FROM registrants WHERE id != ? ORDER BY id")
      .bind(newRegistrantId)
      .all<{ id: number }>();
    
    // Process relationship checkboxes
    for (const registrant of existingRegistrants ?? []) {
      const knowsKey = `knows_${registrant.id}`;
      const knowsPerson = formData.get(knowsKey) === "on";
      
      await REGISTRANTS
        .prepare("INSERT INTO relationships (new_registrant_id, known_registrant_id, knows_person) VALUES (?1, ?2, ?3)")
        .bind(newRegistrantId, registrant.id, knowsPerson ? 1 : 0)
        .run();
    }
    
    // Commit the transaction
    await REGISTRANTS.exec("COMMIT");
    
    return { ok: true };
  } catch (error) {
    // Rollback on error
    await REGISTRANTS.exec("ROLLBACK");
    console.error("Action error:", error);
    return { ok: false, error: "Failed to save. Please try again." };
  }
}

export default function Home(_: Route.ComponentProps) {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  return (
    <main className="pt-16 p-4 container mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold mb-4 text-center">Defence Party Registration</h1>
      <p className="mb-6 text-gray-600 dark:text-gray-300 text-center">{data.message}</p>

      {actionData?.error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {actionData.error}
        </div>
      )}
      {actionData?.ok && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
          Saved! Thank you for registering.
        </div>
      )}

      <Form method="post" className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Your Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
              <input 
                id="name" 
                name="name" 
                type="text" 
                required 
                className="w-full rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
              <input 
                id="phone" 
                name="phone" 
                type="tel" 
                required 
                className="w-full rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              />
            </div>
          </div>
        </div>

        {data.registrants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Do you know these people?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Check the boxes for people you know. This helps us understand the social connections at the party!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.registrants.map((registrant) => (
                <div key={registrant.id} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="checkbox"
                    id={`knows_${registrant.id}`}
                    name={`knows_${registrant.id}`}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`knows_${registrant.id}`} className="text-sm font-medium cursor-pointer">
                    {registrant.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <button 
            type="submit" 
            className="rounded-md bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Register for Party
          </button>
        </div>
      </Form>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">All Registrants ({data.registrants.length})</h2>
        {data.error && (
          <p className="text-red-600 dark:text-red-300 mb-3">{data.error}</p>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.registrants.length === 0 ? (
              <li className="p-4 text-gray-500 dark:text-gray-400 text-center">No registrations yet.</li>
            ) : (
              data.registrants.map((r) => (
                <li key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{r.phone}</p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
