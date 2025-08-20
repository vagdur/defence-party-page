import type { Route } from "./+types/home";
import { Form, useActionData, useLoaderData } from "react-router";
import { homeContent } from "../content/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: homeContent.meta.title },
    { name: "description", content: homeContent.meta.description },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  try {
    // Ensure tables exist using batch operations
    await REGISTRANTS.batch([
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS registrants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, dietary_preferences TEXT NOT NULL, dietary_other TEXT, alcohol_preference BOOLEAN NOT NULL, created_at TEXT DEFAULT (datetime('now')))"
      ),
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS relationships (id INTEGER PRIMARY KEY AUTOINCREMENT, new_registrant_id INTEGER NOT NULL, known_registrant_id INTEGER NOT NULL, knows_person BOOLEAN NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (new_registrant_id) REFERENCES registrants(id), FOREIGN KEY (known_registrant_id) REFERENCES registrants(id))"
      )
    ]);

    const { results } = await REGISTRANTS
      .prepare(
        "SELECT id, name FROM registrants ORDER BY name ASC"
      )
      .all<{ id: number; name: string }>();
    
    return { registrants: results ?? [] };
  } catch (error) {
    console.error("Loader error:", error);
    return { registrants: [], error: homeContent.messages.error.load };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const dietary = String(formData.get("dietary") ?? "").trim();
  const dietaryOther = String(formData.get("dietary_other") ?? "").trim();
  const alcohol = formData.get("alcohol");
  
  if (!name || !email || !dietary || !alcohol) {
    return { ok: false, error: homeContent.messages.error.validation };
  }

  // Convert alcohol preference to boolean
  const alcoholPreference = alcohol === "yes";

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }

  // If dietary is "other", dietaryOther is required
  if (dietary === "other" && !dietaryOther) {
    return { ok: false, error: "Please specify your dietary preference." };
  }

  try {
    // Use D1's transaction API:
    const result = await REGISTRANTS.batch([
      // Insert the new registrant
      REGISTRANTS.prepare("INSERT INTO registrants (name, email, dietary_preferences, dietary_other, alcohol_preference) VALUES (?1, ?2, ?3, ?4, ?5)").bind(name, email, dietary, dietaryOther, alcoholPreference)
    ]);
    
    const newRegistrantId = result[0].meta?.last_row_id;
    
    if (!newRegistrantId) {
      throw new Error("Failed to get new registrant ID");
    }
    
    // Get all existing registrants to process relationships
    const { results: existingRegistrants } = await REGISTRANTS
      .prepare("SELECT id FROM registrants WHERE id != ? ORDER BY id")
      .bind(newRegistrantId)
      .all<{ id: number }>();
    
    // Prepare relationship insert statements
    const relationshipStatements = (existingRegistrants ?? []).map((registrant: { id: number }) => {
      const knowsKey = `knows_${registrant.id}`;
      const knowsPerson = formData.get(knowsKey) === "on";
      
      return REGISTRANTS
        .prepare("INSERT INTO relationships (new_registrant_id, known_registrant_id, knows_person) VALUES (?1, ?2, ?3)")
        .bind(newRegistrantId, registrant.id, knowsPerson ? 1 : 0);
    });
    
    // Execute all relationship inserts in a batch if there are any
    if (relationshipStatements.length > 0) {
      await REGISTRANTS.batch(relationshipStatements);
    }
    
    return { ok: true };
  } catch (error) {
    console.error("Action error:", error);
    return { ok: false, error: homeContent.messages.error.save };
  }
}

export default function Home(_: Route.ComponentProps) {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  return (
    <main className="pt-16 p-4 container mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold mb-4 text-center">{homeContent.page.title}</h1>

      {actionData?.error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          {actionData.error}
        </div>
      )}
      {actionData?.ok && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 p-3 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
          {homeContent.messages.success.saved}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">{homeContent.form.sections.information.title}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">{homeContent.form.sections.information.fields.name.label}</label>
                <input 
                  id="name" 
                  name="name" 
                  type="text" 
                  required 
                  className="w-full rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">{homeContent.form.sections.information.fields.email.label}</label>
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  className="w-full rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{homeContent.form.sections.information.fields.dietary.label}</label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    id="dietary_none" 
                    name="dietary" 
                    value="none" 
                    required 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="dietary_none" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.dietary.options.none}
                  </label>
                </div>
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    id="dietary_pescetarian" 
                    name="dietary" 
                    value="pescetarian" 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="dietary_pescetarian" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.dietary.options.pescetarian}
                  </label>
                </div>
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    id="dietary_vegan" 
                    name="dietary" 
                    value="vegan" 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="dietary_vegan" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.dietary.options.vegan}
                  </label>
                </div>
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    id="dietary_other" 
                    name="dietary" 
                    value="other" 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="dietary_other" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.dietary.options.other}
                  </label>
                </div>
                <div className="ml-6">
                  <input 
                    type="text" 
                    name="dietary_other" 
                    placeholder={homeContent.form.sections.information.fields.dietary.otherPlaceholder}
                    className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{homeContent.form.sections.information.fields.alcohol.label}</label>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    id="alcohol_yes" 
                    name="alcohol" 
                    value="yes" 
                    required 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="alcohol_yes" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.alcohol.yes}
                  </label>
                </div>
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    id="alcohol_no" 
                    name="alcohol" 
                    value="no" 
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="alcohol_no" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.alcohol.no}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {data.registrants.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">{homeContent.form.sections.relationships.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {homeContent.form.sections.relationships.description}
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
            {homeContent.form.submit}
          </button>
        </div>
      </Form>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">{homeContent.registrants.title} ({data.registrants.length})</h2>
        {data.error && (
          <p className="text-red-600 dark:text-red-300 mb-3">{data.error}</p>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.registrants.length === 0 ? (
              <li className="p-4 text-gray-500 dark:text-gray-400 text-center">{homeContent.registrants.empty}</li>
            ) : (
              data.registrants.map((r) => (
                <li key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
