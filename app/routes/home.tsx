import type { Route } from "./+types/home";
import { Form, useActionData, useLoaderData } from "react-router";
import { homeContent } from "../content/home";
import { useState } from "react";

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
        "CREATE TABLE IF NOT EXISTS relationships (id INTEGER PRIMARY KEY AUTOINCREMENT, new_registrant_id INTEGER NOT NULL, known_registrant_id INTEGER NOT NULL, familiarity INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (new_registrant_id) REFERENCES registrants(id), FOREIGN KEY (known_registrant_id) REFERENCES registrants(id))"
      ),
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS languages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now')))"
      ),
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS topics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now')))"
      ),
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS registrant_languages (id INTEGER PRIMARY KEY AUTOINCREMENT, registrant_id INTEGER NOT NULL, language_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (registrant_id) REFERENCES registrants(id), FOREIGN KEY (language_id) REFERENCES languages(id))"
      ),
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS registrant_topics (id INTEGER PRIMARY KEY AUTOINCREMENT, registrant_id INTEGER NOT NULL, topic_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (registrant_id) REFERENCES registrants(id), FOREIGN KEY (topic_id) REFERENCES topics(id))"
      )
    ]);

    const [registrantsResult, languagesResult, topicsResult] = await Promise.all([
      REGISTRANTS
        .prepare(
          "SELECT id, name FROM registrants ORDER BY name ASC"
        )
        .all<{ id: number; name: string }>(),
      REGISTRANTS
        .prepare(
          "SELECT id, name FROM languages ORDER BY name ASC"
        )
        .all<{ id: number; name: string }>(),
      REGISTRANTS
        .prepare(
          "SELECT id, name FROM topics ORDER BY name ASC"
        )
        .all<{ id: number; name: string }>()
    ]);
    
    return { 
      registrants: registrantsResult.results ?? [],
      languages: languagesResult.results ?? [],
      topics: topicsResult.results ?? []
    };
  } catch (error) {
    console.error("Loader error:", error);
    return { 
      registrants: [], 
      languages: [],
      topics: [],
      error: homeContent.messages.error.load 
    };
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
  
  // Get languages and topics from form data
  const languages = formData.getAll("languages").map(String).filter(Boolean);
  const topics = formData.getAll("topics").map(String).filter(Boolean);
  
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
    
    // Process languages
    const languageStatements = [];
    for (const languageName of languages) {
      const trimmedLanguage = languageName.trim();
      if (trimmedLanguage) {
        // Try to insert the language (will fail if it already exists due to UNIQUE constraint)
        languageStatements.push(
          REGISTRANTS.prepare("INSERT OR IGNORE INTO languages (name) VALUES (?)").bind(trimmedLanguage)
        );
      }
    }
    
    // Process topics
    const topicStatements = [];
    for (const topicName of topics) {
      const trimmedTopic = topicName.trim();
      if (trimmedTopic) {
        // Try to insert the topic (will fail if it already exists due to UNIQUE constraint)
        topicStatements.push(
          REGISTRANTS.prepare("INSERT OR IGNORE INTO topics (name) VALUES (?)").bind(trimmedTopic)
        );
      }
    }
    
    // Execute language and topic inserts
    if (languageStatements.length > 0) {
      await REGISTRANTS.batch(languageStatements);
    }
    if (topicStatements.length > 0) {
      await REGISTRANTS.batch(topicStatements);
    }
    
    // Get language and topic IDs and create relationships
    const registrantLanguageStatements = [];
    const registrantTopicStatements = [];
    
    for (const languageName of languages) {
      const trimmedLanguage = languageName.trim();
      if (trimmedLanguage) {
        // Get the language ID
        const { results: languageResults } = await REGISTRANTS
          .prepare("SELECT id FROM languages WHERE name = ?")
          .bind(trimmedLanguage)
          .all<{ id: number }>();
        
        if (languageResults && languageResults.length > 0) {
          registrantLanguageStatements.push(
            REGISTRANTS.prepare("INSERT INTO registrant_languages (registrant_id, language_id) VALUES (?, ?)")
              .bind(newRegistrantId, languageResults[0].id)
          );
        }
      }
    }
    
    for (const topicName of topics) {
      const trimmedTopic = topicName.trim();
      if (trimmedTopic) {
        // Get the topic ID
        const { results: topicResults } = await REGISTRANTS
          .prepare("SELECT id FROM topics WHERE name = ?")
          .bind(trimmedTopic)
          .all<{ id: number }>();
        
        if (topicResults && topicResults.length > 0) {
          registrantTopicStatements.push(
            REGISTRANTS.prepare("INSERT INTO registrant_topics (registrant_id, topic_id) VALUES (?, ?)")
              .bind(newRegistrantId, topicResults[0].id)
          );
        }
      }
    }
    
    // Execute registrant-language and registrant-topic relationship inserts
    if (registrantLanguageStatements.length > 0) {
      await REGISTRANTS.batch(registrantLanguageStatements);
    }
    if (registrantTopicStatements.length > 0) {
      await REGISTRANTS.batch(registrantTopicStatements);
    }
    
    // Get all existing registrants to process relationships
    const { results: existingRegistrants } = await REGISTRANTS
      .prepare("SELECT id FROM registrants WHERE id != ? ORDER BY id")
      .bind(newRegistrantId)
      .all<{ id: number }>();
    
    // Prepare relationship insert statements (slider 0-100 familiarity)
    const relationshipStatements = (existingRegistrants ?? []).map((registrant: { id: number }) => {
      const familiarityKey = `familiarity_${registrant.id}`;
      const rawValue = formData.get(familiarityKey);
      let familiarity = 0;
      if (typeof rawValue === "string" && rawValue.trim() !== "") {
        const parsed = Number(rawValue);
        if (!Number.isNaN(parsed)) {
          familiarity = Math.min(100, Math.max(0, Math.floor(parsed)));
        }
      }
      
      return REGISTRANTS
        .prepare("INSERT INTO relationships (new_registrant_id, known_registrant_id, familiarity) VALUES (?1, ?2, ?3)")
        .bind(newRegistrantId, registrant.id, familiarity);
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
  
  // State for managing new languages and topics
  const [newLanguage, setNewLanguage] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  
  // State to track if form was successfully submitted
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Check if form was successfully submitted
  if (actionData?.ok && !isSubmitted) {
    setIsSubmitted(true);
  }
  
  const handleAddLanguage = () => {
    const trimmed = newLanguage.trim();
    if (trimmed && !selectedLanguages.includes(trimmed)) {
      setSelectedLanguages([...selectedLanguages, trimmed]);
      setNewLanguage("");
    }
  };
  
  const handleRemoveLanguage = (language: string) => {
    setSelectedLanguages(selectedLanguages.filter((l: string) => l !== language));
  };
  
  const handleAddTopic = () => {
    const trimmed = newTopic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      setSelectedTopics([...selectedTopics, trimmed]);
      setNewTopic("");
    }
  };
  
  const handleRemoveTopic = (topic: string) => {
    setSelectedTopics(selectedTopics.filter((t: string) => t !== topic));
  };
  
  const handleLanguageCheckbox = (language: string, checked: boolean) => {
    if (checked) {
      setSelectedLanguages([...selectedLanguages, language]);
    } else {
      setSelectedLanguages(selectedLanguages.filter((l: string) => l !== language));
    }
  };
  
  const handleTopicCheckbox = (topic: string, checked: boolean) => {
    if (checked) {
      setSelectedTopics([...selectedTopics, topic]);
    } else {
      setSelectedTopics(selectedTopics.filter((t: string) => t !== topic));
    }
  };
  
  return (
    <main className="pt-16 p-4 container mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold mb-4 text-center">{homeContent.page.title}</h1>

      {isSubmitted ? (
        // Show success message when form is submitted
        <div className="text-center">
          <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-6 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
            <h2 className="text-2xl font-semibold mb-2">Thank you for registering!</h2>
            <p className="text-lg">{homeContent.messages.success.saved}</p>
          </div>
        </div>
      ) : (
        // Show form when not submitted
        <>
          {actionData?.error && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
              {actionData.error}
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

            <div>
              <label className="block text-sm font-medium mb-2">{homeContent.form.sections.information.fields.languages.label}</label>
              <div className="space-y-3">
                {/* Existing languages */}
                {data.languages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {data.languages.map((language) => (
                      <div key={language.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`language_${language.id}`}
                          checked={selectedLanguages.includes(language.name)}
                          onChange={(e) => handleLanguageCheckbox(language.name, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`language_${language.id}`} className="ml-2 text-sm font-medium cursor-pointer">
                          {language.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Selected languages display */}
                {selectedLanguages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedLanguages.map((language) => (
                      <span key={language} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {language}
                        <button
                          type="button"
                          onClick={() => handleRemoveLanguage(language)}
                          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500 dark:hover:bg-blue-800 dark:hover:text-blue-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Add new language */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLanguage())}
                    placeholder={homeContent.form.sections.information.fields.languages.placeholder}
                    className="flex-1 rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddLanguage}
                    className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {homeContent.form.sections.information.fields.languages.addButton}
                  </button>
                </div>
                
                {/* Hidden inputs for form submission */}
                {selectedLanguages.map((language) => (
                  <input key={language} type="hidden" name="languages" value={language} />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{homeContent.form.sections.information.fields.topics.label}</label>
              <div className="space-y-3">
                {/* Existing topics */}
                {data.topics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {data.topics.map((topic) => (
                      <div key={topic.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`topic_${topic.id}`}
                          checked={selectedTopics.includes(topic.name)}
                          onChange={(e) => handleTopicCheckbox(topic.name, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`topic_${topic.id}`} className="ml-2 text-sm font-medium cursor-pointer">
                          {topic.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Selected topics display */}
                {selectedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTopics.map((topic) => (
                      <span key={topic} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {topic}
                        <button
                          type="button"
                          onClick={() => handleRemoveTopic(topic)}
                          className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-500 dark:hover:bg-green-800 dark:hover:text-green-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Add new topic */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTopic())}
                    placeholder={homeContent.form.sections.information.fields.topics.placeholder}
                    className="flex-1 rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddTopic}
                    className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    {homeContent.form.sections.information.fields.topics.addButton}
                  </button>
                </div>
                
                {/* Hidden inputs for form submission */}
                {selectedTopics.map((topic) => (
                  <input key={topic} type="hidden" name="topics" value={topic} />
                ))}
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
                <div key={registrant.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="text-sm font-medium mb-2">{registrant.name}</div>
                  <input
                    type="range"
                    id={`familiarity_${registrant.id}`}
                    name={`familiarity_${registrant.id}`}
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={0}
                    className="w-full"
                    list={`familiarity_marks_${registrant.id}`}
                  />
                  <datalist id={`familiarity_marks_${registrant.id}`}>
                    <option value="0" label="0" />
                    <option value="50" label="50" />
                    <option value="100" label="100" />
                  </datalist>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <span>{homeContent.form.sections.relationships.scale.left}</span>
                    <span>{homeContent.form.sections.relationships.scale.middle}</span>
                    <span>{homeContent.form.sections.relationships.scale.right}</span>
                  </div>
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
        </>
      )}
    </main>
  );
}
