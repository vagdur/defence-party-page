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
        };
      };
      relationships: {
        title: string;
        description: string;
      };
    };
    submit: string;
  };
  registrants: {
    title: string;
    empty: string;
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
          }
        }
      },
      relationships: {
        title: "Do you know these people?",
        description: "Check the boxes for people you know. This helps us understand the social connections at the party!"
      }
    },
    submit: "Register for Party"
  },
  registrants: {
    title: "All Registrants",
    empty: "No registrations yet."
  }
};
