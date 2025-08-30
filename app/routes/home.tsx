import type { Route } from "./+types/home";
import { Form, useActionData, useLoaderData, useFetcher } from "react-router";
import { homeContent } from "../content/home";
import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import swishLogo from "../assets/swish_logo.png";
import { buildSwishUrl, paymentConfig } from "../config/payment";
import { getPriorityFromCode, getSeatsInTier } from "../config/seats";

// Input sanitization utility functions
function sanitizeString(input: string | null | undefined, maxLength: number = 255): string {
  if (!input) return "";
  return String(input)
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .substring(0, maxLength);
}

function sanitizeEmail(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).trim().toLowerCase();
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

function sanitizeLanguageOrTopic(input: string | null | undefined, maxLength: number = 100): string {
  if (!input) return "";
  return String(input)
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/[^\w\s\-.,()]/g, "") // Only allow alphanumeric, spaces, hyphens, dots, commas, parentheses
    .substring(0, maxLength);
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: homeContent.meta.title },
    { name: "description", content: homeContent.meta.description },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  const url = new URL(request.url);
  const invitationCode = sanitizeString(url.searchParams.get('c'), 10); // Limit invitation code length
  
  try {
    // Ensure tables exist using batch operations
    await REGISTRANTS.batch([
      REGISTRANTS.prepare(
        "CREATE TABLE IF NOT EXISTS registrants (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, dietary_preferences TEXT NOT NULL, dietary_other TEXT, alcohol_preference BOOLEAN NOT NULL, speech_preference BOOLEAN DEFAULT FALSE, research_consent BOOLEAN DEFAULT FALSE, priority INTEGER DEFAULT 0, original_priority INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))"
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

    // Determine user's priority from invitation code
    const userPriority = getPriorityFromCode(invitationCode);

    // Check seat availability for this priority level
    const { results: seatCount } = await REGISTRANTS
      .prepare(`
        SELECT COUNT(*) as count 
        FROM registrants 
        WHERE priority = ?
      `)
      .bind(userPriority)
      .all();

    const currentSeatsInTier = seatCount?.[0]?.count ?? 0;
    const maxSeatsInTier = getSeatsInTier(userPriority);
    const seatsAvailable = maxSeatsInTier - currentSeatsInTier;
    
    // If no seats available at user's priority, check if they can downgrade to a lower tier
    let effectivePriority = userPriority;
    if (seatsAvailable <= 0) {
      // Check each lower priority tier for availability
      let foundAvailableTier = false;
      for (let checkPriority = userPriority - 1; checkPriority >= 0; checkPriority--) {
        const { results: lowerTierCount } = await REGISTRANTS
          .prepare(`
            SELECT COUNT(*) as count 
            FROM registrants 
            WHERE priority = ?
          `)
          .bind(checkPriority)
          .all();
        
        const lowerTierSeats = lowerTierCount?.[0]?.count ?? 0;
        const lowerTierMax = getSeatsInTier(checkPriority);
        
        if (lowerTierSeats < lowerTierMax) {
          effectivePriority = checkPriority;
          foundAvailableTier = true;
          break;
        }
      }
      
      // If no lower tier is available, mark as fully booked
      if (!foundAvailableTier) {
        effectivePriority = -1;
      }
    }

    const [registrantsResult, languagesResult, topicsResult] = await Promise.all([
      REGISTRANTS
        .prepare(
          "SELECT id, name FROM registrants ORDER BY name ASC"
        )
        .all(),
      REGISTRANTS
        .prepare(
          "SELECT id, name FROM languages ORDER BY name ASC"
        )
        .all(),
      REGISTRANTS
        .prepare(
          "SELECT id, name FROM topics ORDER BY name ASC"
        )
        .all()
    ]);
    
    return { 
      registrants: registrantsResult.results ?? [],
      languages: languagesResult.results ?? [],
      topics: topicsResult.results ?? [],
      seatsAvailable,
      userPriority,
      effectivePriority,
      isFullyBooked: effectivePriority === -1
    };
  } catch (error) {
    console.error("Loader error:", error);
    return { 
      registrants: [], 
      languages: [],
      topics: [],
      seatsAvailable: 0,
      userPriority: 0,
      effectivePriority: -1,
      isFullyBooked: true,
      error: homeContent.messages.error.load 
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { REGISTRANTS } = context.cloudflare.env;
  const formData = await request.formData();
  
  // Check the action type
  const actionType = formData.get("action_type");
  
  // Handle save language action
  if (actionType === "save_language") {
    const languageName = sanitizeLanguageOrTopic(String(formData.get("language_name") ?? ""));
    if (!languageName) {
      return { ok: false, error: "Language name is required" };
    }
    
    try {
      // Try to insert the language
      await REGISTRANTS
        .prepare("INSERT OR IGNORE INTO languages (name) VALUES (?)")
        .bind(languageName)
        .run();
      
      // Get the language ID to return
      const { results } = await REGISTRANTS
        .prepare("SELECT id FROM languages WHERE name = ?")
        .bind(languageName)
        .all();
      
      return { 
        ok: true, 
        language: { id: results?.[0]?.id, name: languageName },
        action: "save_language"
      };
    } catch (error) {
      console.error("Save language error:", error);
      return { ok: false, error: "Failed to save language" };
    }
  }
  
  // Handle save topic action
  if (actionType === "save_topic") {
    const topicName = sanitizeLanguageOrTopic(String(formData.get("topic_name") ?? ""));
    if (!topicName) {
      return { ok: false, error: "Topic name is required" };
    }
    
    try {
      // Try to insert the topic
      await REGISTRANTS
        .prepare("INSERT OR IGNORE INTO topics (name) VALUES (?)")
        .bind(topicName)
        .run();
      
      // Get the topic ID to return
      const { results } = await REGISTRANTS
        .prepare("SELECT id FROM topics WHERE name = ?")
        .bind(topicName)
        .all();
      
      return { 
        ok: true, 
        topic: { id: results?.[0]?.id, name: topicName },
        action: "save_topic"
      };
    } catch (error) {
      console.error("Save topic error:", error);
      return { ok: false, error: "Failed to save topic" };
    }
  }
  
  // Handle main registration form submission
  const firstName = sanitizeString(String(formData.get("first_name") ?? ""));
  const lastName = sanitizeString(String(formData.get("last_name") ?? ""));
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  const email = sanitizeEmail(String(formData.get("email") ?? ""));
  const dietary = sanitizeString(String(formData.get("dietary") ?? ""));
  const dietaryOther = sanitizeString(String(formData.get("dietary_other") ?? ""));
  const alcohol = formData.get("alcohol");
  const speechPreferenceRaw = formData.get("speech_preference");
  const researchConsentRaw = formData.get("research_consent");
  let userPriority = Number(formData.get('priority') ?? 0);
  const originalPriority = Number(formData.get('original_priority') ?? 0);
  
  // Get languages and topics from form data
  const languages = formData.getAll("languages").map(String).map(sanitizeLanguageOrTopic).filter(Boolean);
  const topics = formData.getAll("topics").map(String).map(sanitizeLanguageOrTopic).filter(Boolean);
  
  if (!firstName || !lastName || !email || !dietary || !alcohol) {
    return { ok: false, error: homeContent.messages.error.validation };
  }

  // Convert alcohol preference to boolean
  const alcoholPreference = alcohol === "yes";
  // Convert speech preference to boolean (unchecked => null => false)
  const speechPreference = speechPreferenceRaw === "yes";
  // Convert research consent to boolean (unchecked => null => false)
  const researchConsent = researchConsentRaw === "yes";

  // Validate email format
  if (!validateEmail(email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }

  // If dietary is "other", dietaryOther is required
  if (dietary === "other" && !dietaryOther) {
    return { ok: false, error: "Please specify your dietary preference." };
  }

  try {
    // Check for existing registrants with the same name or email
    const { results: duplicateCheck } = await REGISTRANTS
      .prepare("SELECT name, email FROM registrants WHERE name = ? OR email = ?")
      .bind(name, email)
      .all();
    
    if (duplicateCheck && duplicateCheck.length > 0) {
      const duplicateName = duplicateCheck.some((r: { name: string; email: string }) => r.name === name);
      const duplicateEmail = duplicateCheck.some((r: { name: string; email: string }) => r.email === email);
      
      if (duplicateName && duplicateEmail) {
        return { ok: false, error: homeContent.messages.error.duplicateNameAndEmail };
      } else if (duplicateName) {
        return { ok: false, error: homeContent.messages.error.duplicateName };
      } else if (duplicateEmail) {
        return { ok: false, error: homeContent.messages.error.duplicateEmail };
      }
    }

    // Check seat availability again (race condition protection)
    // Use the effective priority determined in the loader
    const { results: seatCount } = await REGISTRANTS
      .prepare(`
        SELECT COUNT(*) as count 
        FROM registrants 
        WHERE priority = ?
      `)
      .bind(userPriority)
      .all();

    const currentSeatsInTier = seatCount?.[0]?.count ?? 0;
    const maxSeatsInTier = getSeatsInTier(userPriority);
    
    // If user's priority tier is full, check for downgrade availability
    if (currentSeatsInTier >= maxSeatsInTier) {
      let canDowngrade = false;
      for (let checkPriority = userPriority - 1; checkPriority >= 0; checkPriority--) {
        const { results: lowerTierCount } = await REGISTRANTS
          .prepare(`
            SELECT COUNT(*) as count 
            FROM registrants 
            WHERE priority = ?
          `)
          .bind(checkPriority)
          .all();
        
        const lowerTierSeats = lowerTierCount?.[0]?.count ?? 0;
        const lowerTierMax = getSeatsInTier(checkPriority);
        
        if (lowerTierSeats < lowerTierMax) {
          canDowngrade = true;
          userPriority = checkPriority; // Update to use the available tier
          break;
        }
      }
      
      if (!canDowngrade) {
        return { ok: false, error: homeContent.messages.error.fullyBooked };
      }
    }

    // Use D1's transaction API:
    const result = await REGISTRANTS.batch([
      // Insert the new registrant with priority and original priority
      REGISTRANTS.prepare("INSERT INTO registrants (name, email, dietary_preferences, dietary_other, alcohol_preference, speech_preference, research_consent, priority, original_priority) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)").bind(name, email, dietary, dietaryOther, alcoholPreference, speechPreference, researchConsent, userPriority, originalPriority)
    ]);
    
    const newRegistrantId = result[0].meta?.last_row_id;
    
    if (!newRegistrantId) {
      throw new Error("Failed to get new registrant ID");
    }
    
    // Process languages
    const languageStatements = [];
    for (const languageName of languages) {
      const trimmedLanguage = sanitizeLanguageOrTopic(languageName);
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
      const trimmedTopic = sanitizeLanguageOrTopic(topicName);
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
      const trimmedLanguage = sanitizeLanguageOrTopic(languageName);
      if (trimmedLanguage) {
        // Get the language ID
        const { results: languageResults } = await REGISTRANTS
          .prepare("SELECT id FROM languages WHERE name = ?")
          .bind(trimmedLanguage)
          .all();
        
        if (languageResults && languageResults.length > 0) {
          registrantLanguageStatements.push(
            REGISTRANTS.prepare("INSERT INTO registrant_languages (registrant_id, language_id) VALUES (?, ?)")
              .bind(newRegistrantId, languageResults[0].id)
          );
        }
      }
    }
    
    for (const topicName of topics) {
      const trimmedTopic = sanitizeLanguageOrTopic(topicName);
      if (trimmedTopic) {
        // Get the topic ID
        const { results: topicResults } = await REGISTRANTS
          .prepare("SELECT id FROM topics WHERE name = ?")
          .bind(trimmedTopic)
          .all();
        
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
      .all();
    
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
  const languageFetcher = useFetcher();
  const topicFetcher = useFetcher();
  
  // State for managing new languages and topics
  const [newLanguage, setNewLanguage] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [newlyAddedLanguages, setNewlyAddedLanguages] = useState<Array<{id: number, name: string}>>([]);
  const [newlyAddedTopics, setNewlyAddedTopics] = useState<Array<{id: number, name: string}>>([]);
  
  // State to track alcohol preference
  const [alcoholPreference, setAlcoholPreference] = useState(false);
  
  // State to track if form was successfully submitted
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if user is on mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Check if form was successfully submitted
  if (actionData?.ok && !isSubmitted) {
    setIsSubmitted(true);
  }
  
  // Handle fetcher responses for language and topic saves
  useEffect(() => {
    if (languageFetcher.data && languageFetcher.state === "idle") {
      const result = languageFetcher.data as any;
      if (result.ok && result.action === "save_language" && result.language) {
        // Add to selected languages immediately
        setSelectedLanguages(prev => [...prev, result.language.name]);
        setNewLanguage("");
        
        // Add to newly added languages list so it appears in the existing languages section
        // Only add if it's not already in the database or newly added list
        const isInDatabase = data.languages.some((lang: { id: number; name: string }) => lang.name === result.language.name);
        const isAlreadyAdded = newlyAddedLanguages.some(lang => lang.name === result.language.name);
        if (!isInDatabase && !isAlreadyAdded) {
          setNewlyAddedLanguages(prev => [...prev, result.language]);
        }
      } else if (!result.ok) {
        console.error("Failed to save language:", result.error);
      }
    }
  }, [languageFetcher.data, languageFetcher.state, newlyAddedLanguages]);

  useEffect(() => {
    if (topicFetcher.data && topicFetcher.state === "idle") {
      const result = topicFetcher.data as any;
      if (result.ok && result.action === "save_topic" && result.topic) {
        // Add to selected topics immediately
        setSelectedTopics(prev => [...prev, result.topic.name]);
        setNewTopic("");
        
        // Add to newly added topics list so it appears in the existing topics section
        // Only add if it's not already in the database or newly added list
        const isInDatabase = data.topics.some((topic: { id: number; name: string }) => topic.name === result.topic.name);
        const isAlreadyAdded = newlyAddedTopics.some(topic => topic.name === result.topic.name);
        if (!isInDatabase && !isAlreadyAdded) {
          setNewlyAddedTopics(prev => [...prev, result.topic]);
        }
      } else if (!result.ok) {
        console.error("Failed to save topic:", result.error);
      }
    }
  }, [topicFetcher.data, topicFetcher.state, newlyAddedTopics]);
  
  const handleAddLanguage = () => {
    const trimmed = newLanguage.trim();
    if (trimmed && !selectedLanguages.includes(trimmed)) {
      // Create form data for the language save action
      const formData = new FormData();
      formData.append("action_type", "save_language");
      formData.append("language_name", trimmed);
      
      // Use the fetcher to submit the form data
      languageFetcher.submit(formData, { method: "post" });
    }
  };
  
  const handleRemoveLanguage = (language: string) => {
    setSelectedLanguages(selectedLanguages.filter((l: string) => l !== language));
  };
  
  const handleAddTopic = () => {
    const trimmed = newTopic.trim();
    if (trimmed && !selectedTopics.includes(trimmed)) {
      // Create form data for the topic save action
      const formData = new FormData();
      formData.append("action_type", "save_topic");
      formData.append("topic_name", trimmed);
      
      // Use the fetcher to submit the form data
      topicFetcher.submit(formData, { method: "post" });
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

  const updateSliderGradient = (inputEl: HTMLInputElement) => {
    const min = Number(inputEl.min || 0);
    const max = Number(inputEl.max || 100);
    const value = Number(inputEl.value || 0);
    const percent = ((value - min) / (max - min)) * 100;
    inputEl.style.backgroundImage = "linear-gradient(90deg, #3b82f6 0%, #f59e0b 100%)"; // blue → orange
    inputEl.style.backgroundSize = `${percent}% 100%`;
    inputEl.style.backgroundRepeat = "no-repeat";
    inputEl.style.backgroundColor = "#e5e7eb"; // gray-200 for unfilled track
  };

  const handleSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSliderGradient(e.target);
  };
  
  // Show fully booked message if no seats available (but not if user just successfully registered)
  if (data.isFullyBooked && !actionData?.ok) {
    return (
      <main className="pt-16 p-4 container mx-auto max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">{homeContent.page.title}</h1>
          <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-6 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            <h2 className="text-2xl font-semibold mb-2">{homeContent.fullyBooked.title}</h2>
            <p className="text-lg">{homeContent.fullyBooked.message}</p>
            <p className="mt-2 text-sm">{homeContent.fullyBooked.contactInfo}</p>
          </div>
        </div>
      </main>
    );
  }
  
  return (
    <main className="pt-16 p-4 container mx-auto max-w-2xl">
      {/* Demo Notice Banner */}
      <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <h2 className="text-lg font-semibold">Demo Page</h2>
            </div>
            <p className="text-sm mb-3">
              This is a demonstration page for testing purposes only. This is not the actual registration page for the event.
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span>🔗</span>
              <a 
                href="/admin" 
                className="font-medium underline hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
              >
                View Admin Panel
              </a>
              <span>to see registrations and manage the demo data.</span>
            </div>
          </div>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-4 text-center">{homeContent.page.title}</h1>
      
      {/* Party Time and Location Information */}
      <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">
            {homeContent.partyDetails.title}
          </h2>
          <p className="text-blue-800 dark:text-blue-200 mb-4 leading-relaxed">
            {homeContent.partyDetails.description}
          </p>
          <div className="space-y-2 text-blue-800 dark:text-blue-200">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">📅</span>
              <span className="font-medium">{homeContent.partyDetails.date}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">🕒</span>
              <span className="font-medium">{homeContent.partyDetails.time}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">📍</span>
              <span className="font-medium">{homeContent.partyDetails.location}</span>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              {homeContent.partyDetails.address}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-lg">👔</span>
              <span className="font-medium">{homeContent.partyDetails.dressCode}</span>
            </div>
          </div>
        </div>
      </div>

      {isSubmitted ? (
        // Show success message when form is submitted
        <div className="text-center">
          <div className="mb-6 rounded-md border border-green-300 bg-green-50 p-6 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-200">
            <h2 className="text-2xl font-semibold mb-2">Thank you for registering!</h2>
            <p className="text-lg">{homeContent.messages.success.saved}</p>
          </div>
          <div className="mx-auto w-full max-w-xs">
            {isMobile ? (
              <>
                <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">{homeContent.payment.title}:</div>
                <a 
                  href={buildSwishUrl(alcoholPreference)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  {homeContent.payment.mobile.buttonText}
                </a>
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  {homeContent.payment.mobile.fallbackText
                    .replace('{amount}', (paymentConfig.swish.amount + (alcoholPreference ? paymentConfig.swish.alcoholCost : 0)).toString())
                    .replace('{currency}', paymentConfig.swish.currency)
                    .replace('{phoneNumber}', paymentConfig.swish.phoneNumber)
                  }
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">{homeContent.payment.desktop.title}</div>
                <div className="relative inline-block">
                  <QRCode
                    value={buildSwishUrl(alcoholPreference)}
                    size={224}
                    style={{ borderRadius: 12 }}
                    bgColor={"#ffffff"}
                    fgColor={"#000000"}
                  />
                  <img
                    src={swishLogo}
                    alt="Swish"
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-md bg-white p-1 shadow"
                  />
                </div>
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  {homeContent.payment.desktop.fallbackText
                    .replace('{amount}', (paymentConfig.swish.amount + (alcoholPreference ? paymentConfig.swish.alcoholCost : 0)).toString())
                    .replace('{currency}', paymentConfig.swish.currency)
                    .replace('{phoneNumber}', paymentConfig.swish.phoneNumber)
                  }
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        // Show form when not submitted
        <>
          <Form method="post" className="space-y-6">
            {/* Hidden priority field */}
              <input type="hidden" name="priority" value={data.effectivePriority} />
              <input type="hidden" name="original_priority" value={data.userPriority} />
            
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">{homeContent.form.sections.information.title}</h2>
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium mb-1">{homeContent.form.sections.information.fields.firstName.label}</label>
                <input 
                  id="first_name" 
                  name="first_name" 
                  type="text" 
                  required 
                  className="w-full rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block text-sm font-medium mb-1">{homeContent.form.sections.information.fields.lastName.label}</label>
                <input 
                  id="last_name" 
                  name="last_name" 
                  type="text" 
                  required 
                  className="w-full rounded-md border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>
              <div className="md:col-span-2">
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
                    checked={alcoholPreference}
                    onChange={() => setAlcoholPreference(true)}
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
                    checked={!alcoholPreference}
                    onChange={() => setAlcoholPreference(false)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="alcohol_no" className="ml-2 text-sm font-medium cursor-pointer">
                    {homeContent.form.sections.information.fields.alcohol.no}
                  </label>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {homeContent.form.sections.information.fields.alcohol.note.replace('{alcoholCost}', paymentConfig.swish.alcoholCost.toString())}
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="speech_preference"
                  value="yes"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm font-medium cursor-pointer">
                  {homeContent.form.sections.information.fields.speech.label}
                </span>
              </label>
            </div>


          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">{homeContent.form.sections.relationships.title}</h2>
          
          {/* Languages Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">{homeContent.form.sections.relationships.subsections.languages}</h3>
            <div>
              <label className="block text-sm font-medium mb-2">{homeContent.form.sections.information.fields.languages.label}</label>
              <div className="space-y-3">
                {/* Existing languages */}
                {(() => {
                  // Combine languages from database and newly added, removing duplicates
                  const existingLanguageNames = data.languages.map((l: { id: number; name: string }) => l.name);
                  const allLanguages = [
                    ...data.languages,
                    ...newlyAddedLanguages.filter(lang => !existingLanguageNames.includes(lang.name))
                  ];
                  
                  return allLanguages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {allLanguages.map((language: { id: number; name: string }) => (
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
                  );
                })()}
                

                
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
          </div>

          {/* Topics Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">{homeContent.form.sections.relationships.subsections.topics}</h3>
            <div>
              <label className="block text-sm font-medium mb-2">{homeContent.form.sections.information.fields.topics.label}</label>
              <div className="space-y-3">
                {/* Existing topics */}
                {(() => {
                  // Combine topics from database and newly added, removing duplicates
                  const existingTopicNames = data.topics.map((t: { id: number; name: string }) => t.name);
                  const allTopics = [
                    ...data.topics,
                    ...newlyAddedTopics.filter(topic => !existingTopicNames.includes(topic.name))
                  ];
                  
                  return allTopics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {allTopics.map((topic: { id: number; name: string }) => (
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
                  );
                })()}
                

                
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

          {/* Relationships Section */}
          {data.registrants.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3">{homeContent.form.sections.relationships.subsections.familiarity}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {homeContent.form.sections.relationships.description}
              </p>
              <div className="space-y-3">
                {data.registrants.map((registrant: { id: number; name: string }) => (
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
                      className="w-full h-2 rounded appearance-none"
                      style={{ backgroundImage: "linear-gradient(90deg, #3b82f6 0%, #f59e0b 100%)", backgroundSize: "0% 100%", backgroundRepeat: "no-repeat", backgroundColor: "#e5e7eb" }}
                      onChange={handleSliderInput}
                      onInput={handleSliderInput}
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
        </div>

        <div className="text-center">
          <button 
            type="submit" 
            className="rounded-md bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            {homeContent.form.submit}
          </button>
        </div>
        
        {actionData?.error && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
            {actionData.error}
          </div>
        )}
        
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 text-center">
          {homeContent.form.disclaimer}
        </p>
        <div className="mt-4 flex items-start justify-center">
          <label className="inline-flex items-start text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="research_consent"
              value="yes"
              className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2">{homeContent.form.researchConsent.label}</span>
          </label>
        </div>
          </Form>
        </>
      )}
    </main>
  );
}
