export interface HomeContent {
  meta: {
    title: string;
    description: string;
  };
  page: {
    title: string;
    subtitle: string;
  };
  messages: {
    error: {
      validation: string;
      save: string;
      load: string;
    };
    success: {
      saved: string;
    };
  };
  form: {
    sections: {
      information: {
        title: string;
        fields: {
          name: {
            label: string;
          };
          email: {
            label: string;
          };
          dietary: {
            label: string;
            options: {
              none: string;
              pescetarian: string;
              vegan: string;
              other: string;
            };
            otherPlaceholder: string;
          };
          alcohol: {
            label: string;
            yes: string;
            no: string;
          };
          languages: {
            label: string;
            placeholder: string;
            addButton: string;
          };
          topics: {
            label: string;
            placeholder: string;
            addButton: string;
          };
        };
      };
      relationships: {
        title: string;
        description: string;
        scale: {
          left: string;
          middle: string;
          right: string;
        };
      };
    };
    submit: string;
  };
}

export const homeContent: HomeContent = {
  meta: {
    title: "Defence Party Registration",
    description: "Register for the Defence Party!"
  },
  page: {
    title: "Defence Party Registration",
    subtitle: "Welcome to the Defence Party registration page!"
  },
  messages: {
    error: {
      validation: "Please provide name, email, dietary preferences, and alcohol preference.",
      save: "Failed to save. Please try again.",
      load: "Failed to load registrants"
    },
    success: {
      saved: "Saved! Thank you for registering."
    }
  },
  form: {
    sections: {
      information: {
        title: "Your Information",
        fields: {
          name: {
            label: "Name"
          },
          email: {
            label: "Email"
          },
          dietary: {
            label: "Dietary Preferences",
            options: {
              none: "None",
              pescetarian: "Pescetarian",
              vegan: "Vegan",
              other: "Other"
            },
            otherPlaceholder: "Please specify..."
          },
          alcohol: {
            label: "Do you want alcohol?",
            yes: "Yes",
            no: "No"
          },
          languages: {
            label: "Languages you are comfortable having a conversation in",
            placeholder: "Enter a language...",
            addButton: "Add Language"
          },
          topics: {
            label: "Conversation topics of interest",
            placeholder: "Enter a topic...",
            addButton: "Add Topic"
          }
        }
      },
      relationships: {
        title: "Do you know these people?",
        description: "Check the boxes for people you know. This helps us understand the social connections at the party!",
        scale: {
          left: "I don't know this person",
          middle: "An acquaintance",
          right: "We are close"
        }
      }
    },
    submit: "Register for Party"
  }
};
