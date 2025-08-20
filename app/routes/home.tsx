import type { Route } from "./+types/home";
import { Form, useActionData, useLoaderData } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const { REGISTRANTS, VALUE_FROM_CLOUDFLARE } = context.cloudflare.env;
  try {
    // Ensure table exists; id is auto-increment primary key
    await REGISTRANTS.exec(
      "CREATE TABLE IF NOT EXISTS registrants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))"
    );
    const { results } = await REGISTRANTS
      .prepare(
        "SELECT id, name, phone, created_at FROM registrants ORDER BY id DESC LIMIT 20"
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
    await REGISTRANTS
      .prepare("INSERT INTO registrants (name, phone) VALUES (?1, ?2)")
      .bind(name, phone)
      .run();
    return { ok: true };
  } catch (error) {
    console.error("Action error:", error);
    return { ok: false, error: "Failed to save. Please try again." };
  }
}

export default function Home(_: Route.ComponentProps) {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  return (
    <main className="pt-16 p-4 container mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Party Registration</h1>
      <p className="mb-6 text-gray-600 dark:text-gray-300">{data.message}</p>

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

      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
          <input id="name" name="name" type="text" required className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
          <input id="phone" name="phone" type="tel" required className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Register</button>
      </Form>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">Recent Registrants</h2>
        {data.error && (
          <p className="text-red-600 dark:text-red-300 mb-3">{data.error}</p>
        )}
        <ul className="divide-y divide-gray-200 dark:divide-gray-800 rounded-md border border-gray-200 dark:border-gray-800">
          {(data.registrants ?? []).length === 0 ? (
            <li className="p-3 text-gray-500 dark:text-gray-400">No registrations yet.</li>
          ) : (
            (data.registrants ?? []).map((r) => (
              <li key={r.id} className="p-3 flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                <span className="text-gray-600 dark:text-gray-400">{r.phone}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
